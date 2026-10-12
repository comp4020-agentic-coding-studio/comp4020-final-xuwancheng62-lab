import { randomUUID } from "node:crypto";
import { steal } from "../src/interactions.ts";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, inject, it } from "vitest";
import { JSDOM } from "jsdom";
import { openDb, tx } from "../src/db.ts";
import { createShelter, loadShelter, defenceOf } from "../src/shelter.ts";
import { changeBase, craftAtBase, salvageAtBase } from "../src/base.ts";
import { addSupply, grantGear, starter } from "../src/character.ts";
import { BASE } from "../src/game/config.ts";
import { baseDefaults, gateReduction } from "../src/game/base.ts";
import { settle } from "../src/game/resources.ts";
const hour=3_600_000, now=1800000000000;
function setup() {
 const dir=mkdtempSync(join(tmpdir(),"holdout-base-")),db=openDb(dir);
 const id=tx(db,()=>{const id=Number(db.prepare("INSERT INTO users(username,password_hash,created_at) VALUES('builder','x',?)").run(now).lastInsertRowid);createShelter(db,id,"builder",now);return id;});
 const sid=loadShelter(db,id,now).id;
 db.prepare("UPDATE shelters SET scrap=1000,power=100,water=100,food=100 WHERE id=?").run(sid);
 for(const k of ["nails","cloth","ducttape","circuit","sorbent"] as const)addSupply(db,sid,k,50,now);
 return {dir,db,id,sid};
}
it("settles before upgrading or pausing, persists rooms, and rejects stale double upgrades",()=>{
 const {dir,db,id,sid}=setup();
 expect(changeBase(db,id,"generator","toggle","off",now).ok).toBe(true);
 expect(changeBase(db,id,"purifier","toggle","off",now).ok).toBe(true);
 const before=loadShelter(db,id,now).stock;
 const stopped=loadShelter(db,id,now+hour).stock;
 expect(stopped.scrap).toBe(before.scrap);expect(stopped.power).toBe(before.power);
 expect(changeBase(db,id,"farm","upgrade","0",now+hour).ok).toBe(true);
 const paid=loadShelter(db,id,now+hour).stock.scrap;
 expect(changeBase(db,id,"farm","upgrade","0",now+hour).ok).toBe(false);
 expect(loadShelter(db,id,now+hour).stock.scrap).toBe(paid);
 expect(loadShelter(db,id,now+hour).base.farm.tier).toBe(1);
 db.close();const reopened=openDb(dir);expect(loadShelter(reopened,id,now+hour).base.generator.enabled).toBe(false);reopened.close();
});
it("automatic arrows and food are paid once, pause cleanly and never exceed production caps",()=>{
 const b=baseDefaults();b.workshop.tier=1;b.farm.tier=1;
 const r=settle({food:40,water:100,power:100,scrap:100},now,now+hour,[],[],b,0);
 expect(r.arrows).toBe(15);expect(r.stock.food).toBeCloseTo(41);expect(r.stock.scrap).toBeCloseTo(99);
 b.workshop.enabled=false;b.farm.enabled=false;
 const paused=settle(r.stock,now+hour,now+2*hour,[],[],b,r.arrows);
 expect(paused.arrows).toBe(0);expect(paused.stock.food).toBeCloseTo(38);
 const full=settle({food:500,water:500,power:500,scrap:500},now,now+hour,[],[],baseDefaults());
 expect(full.stock.scrap).toBe(500);expect(full.stock.power).toBe(500);expect(full.stock.food).toBeCloseTo(497);
 const {db,id}=setup();expect(changeBase(db,id,"workshop","upgrade","0",now).ok).toBe(true);
 const a=loadShelter(db,id,now+hour);const again=loadShelter(db,id,now+hour);
 expect(a.stash.supplies.arrow).toBe(15);expect(again.stash.supplies.arrow).toBe(15);db.close();
});
it("provides renewable scrap without unbounded accumulation",()=>{
 const b=baseDefaults();b.generator.tier=3;b.recycler.tier=3;b.purifier.enabled=false;
 const r=settle({food:100,water:100,power:100,scrap:100},now,now+72*hour,[],[],b);
 expect(r.stock.scrap).toBeGreaterThan(100);expect(r.stock.scrap).toBeLessThanOrEqual(BASE.storage[0]);
 expect(r.stock.power).toBeLessThanOrEqual(BASE.storage[0]);
});
it("requires materials and workshop tier for crafting and creates real usable stash items",()=>{
 const {db,id,sid}=setup();
 db.prepare("DELETE FROM items WHERE shelter_id=? AND level=0").run(sid);
 addSupply(db,sid,"nails",3,now);
 expect(craftAtBase(db,id,"arrows",now).ok).toBe(false);
 expect(changeBase(db,id,"workshop","upgrade","0",now).ok).toBe(true);
 expect(craftAtBase(db,id,"arrows",now).ok).toBe(false);
 addSupply(db,sid,"nails",3,now);
 expect(craftAtBase(db,id,"arrows",now).ok).toBe(true);
 expect(craftAtBase(db,id,"spear",now).ok).toBe(true);
 const s=loadShelter(db,id,now);expect(s.stash.supplies.arrow).toBe(10);expect(s.stash.gear.some(g=>g.kind==="spear")).toBe(true);
 expect(craftAtBase(db,id,"bow",now).ok).toBe(false);db.close();
});
it("doors protect an empty shelter, wear under sieges, and repair without stacked offline losses",()=>{
 const {db,id,sid}=setup();
 expect(changeBase(db,id,"gate","upgrade","1",now).ok).toBe(true);
 const s=loadShelter(db,id,now);expect(defenceOf(s)).toBeGreaterThan(25);expect(gateReduction(s.base,s.gateHp)).toBe(.2);
 const later=loadShelter(db,id,now+BASE.siegeIntervalMs*10);
 expect(later.gateHp).toBe(BASE.gateHp[1]-BASE.siegeDamage/2);
 expect(loadShelter(db,id,now+BASE.siegeIntervalMs*10).gateHp).toBe(later.gateHp);
 expect(changeBase(db,id,"gate","repair","",now+BASE.siegeIntervalMs*10).ok).toBe(true);
 expect(loadShelter(db,id,now+BASE.siegeIntervalMs*10).gateHp).toBe(BASE.gateHp[1]);
 expect(db.prepare("SELECT COUNT(*) n FROM activity_log WHERE shelter_id=? AND kind='danger'").get(sid)).toEqual({n:1});db.close();
});
it("offers plain HTTP facility controls without number shortcuts and refuses unaffordable builds",async()=>{
 const url=(p:string)=>new URL(p,inject("baseUrl"));
 const response=await fetch(url('/register'),{method:"POST",redirect:"manual",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({username:`spec_base${Date.now().toString(36)}`,password:"correct horse battery"})});
 const cookie=response.headers.getSetCookie().find(c=>c.startsWith('sid='))!.split(';')[0];
 const doc=new JSDOM(await(await fetch(url('/'),{headers:{cookie}})).text()).window.document;
 expect(doc.querySelectorAll('[data-facility]')).toHaveLength(5);
 expect(doc.querySelector(".base-grid")).toBeNull();
 expect(doc.querySelectorAll(".sc-entry-corridor")).toHaveLength(2);
 expect(doc.querySelector("#info-generator form[action='/base/facility']")).not.toBeNull();expect(doc.querySelectorAll('.sc-key')).toHaveLength(0);
 const post=(fields:Record<string,string>)=>fetch(url('/base/facility'),{method:'POST',redirect:'manual',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields)});
 expect((await post({kind:'workshop',action:'upgrade',expected:'0'})).status).toBe(409);
 const paused=await post({kind:'generator',action:'toggle',expected:'off'});expect(paused.status).toBe(303);expect(paused.headers.get('location')).toBe('/#info-generator');
 const after=await(await fetch(url('/'),{headers:{cookie}})).text();expect(after).toContain('Paused · no operating costs');
 expect((await post({kind:'constructor',action:'upgrade',expected:'0'})).status).toBe(400);
});
it("migrates an existing shelter without changing its stock, equipment or character",()=>{
 const {db,id,dir}=setup();const before=loadShelter(db,id,now);
 db.exec("DROP TABLE facilities; ALTER TABLE shelters DROP COLUMN gate_hp; ALTER TABLE shelters DROP COLUMN siege_at; PRAGMA user_version=17;");
 db.close();const migrated=openDb(dir);const after=loadShelter(migrated,id,now);
 expect(after.stock).toEqual(before.stock);expect(after.character).toEqual(before.character);
 expect(after.base.generator.tier).toBe(1);expect(after.base.workshop.tier).toBe(0);expect(after.gateHp).toBe(BASE.gateHp[0]);migrated.close();
});
it("does not produce renewable scrap without enough electricity",()=>{
 const b=baseDefaults();b.generator.enabled=false;b.recycler.tier=3;b.purifier.enabled=false;
 const stock={food:100,water:100,power:.001,scrap:100};
 const next=settle(stock,now,now+60_000,[],[],b).stock;
 expect(next.scrap).toBe(stock.scrap);expect(next.power).toBe(stock.power);
 expect(b.recycler.progress).toBe(0);
});

it("damages the door once per real raid, preserves protected reserves, and never repeats wear on replay",()=>{
 const {db,id,sid}=setup();changeBase(db,id,"gate","upgrade","1",now);
 const attacker=tx(db,()=>{const id=Number(db.prepare("INSERT INTO users(username,password_hash,created_at) VALUES('raider','x',?)").run(now).lastInsertRowid);createShelter(db,id,"raider",now);return id;});
 const request=randomUUID();const action=()=>steal(db,{id:attacker,username:"raider"},sid,"food",request,now);
 expect(action().ok).toBe(true);const after=loadShelter(db,id,now);
 expect(after.gateHp).toBe(BASE.gateHp[1]-BASE.raidWear);expect(after.stock.food).toBeGreaterThanOrEqual(20);
 expect(action().ok).toBe(true);expect(loadShelter(db,id,now).gateHp).toBe(after.gateHp);db.close();
});

it("charges mixed building materials atomically and does not partially charge missing ingredients",()=>{
 const {db,id,sid}=setup();db.prepare("DELETE FROM items WHERE shelter_id=? AND kind='nails'").run(sid);
 const before=loadShelter(db,id,now);
 expect(changeBase(db,id,"generator","upgrade","1",now).ok).toBe(false);
 const after=loadShelter(db,id,now);expect(after.stock).toEqual(before.stock);expect(after.stash.supplies).toEqual(before.stash.supplies);
 addSupply(db,sid,"nails",4,now);expect(changeBase(db,id,"generator","upgrade","1",now).ok).toBe(true);
 const built=loadShelter(db,id,now);expect(built.stash.supplies.nails??0).toBe(0);expect(built.stash.supplies.ducttape).toBe((before.stash.supplies.ducttape??0)-2);db.close();
});
it("dismantles spare equipment once and refuses equipped items",()=>{
 const {db,id,sid}=setup();const item=grantGear(db,sid,starter("spear"),now),before=loadShelter(db,id,now);
 expect(salvageAtBase(db,id,String(before.character.gear.weapon?.id),now).ok).toBe(false);
 expect(salvageAtBase(db,id,String(item),now).ok).toBe(true);
 const after=loadShelter(db,id,now);expect(after.stock.scrap-before.stock.scrap).toBe(BASE.salvageScrap.common+BASE.salvagePerLevel);
 expect(salvageAtBase(db,id,String(item),now).ok).toBe(false);expect(loadShelter(db,id,now).stock.scrap).toBe(after.stock.scrap);db.close();
});
it("puts built extensions in the walking graph and keeps the entrance before the ladder on both layouts",async()=>{
 const {db,id}=setup();for(const k of ['workshop','farm','recycler'])expect(changeBase(db,id,k,'upgrade','0',now).ok).toBe(true);
 const {shelterScreen}=await import('../src/shelterScreen.ts');
 const doc=new JSDOM(String(await shelterScreen(loadShelter(db,id,now),now))).window.document;
 for(const scene of doc.querySelectorAll('.sc')) {
  const layout=JSON.parse(scene.getAttribute('data-layout')!);
  expect(layout.spots.hatch.x).toBeGreaterThan(layout.shaftX);
  const tunnel=scene.querySelector('.sc-entry-corridor rect')!;
  expect(Number(tunnel.getAttribute('x'))).toBeLessThanOrEqual(layout.shaftX);
  expect(Number(tunnel.getAttribute('x'))+Number(tunnel.getAttribute('width'))).toBe(layout.spots.hatch.x);
  for(const k of ['workshop','farm','recycler']) {
   expect(layout.spots[k].y).toBeGreaterThan(layout.spots.greenhouse.y);
   expect(scene.querySelector(`a[data-key="${k}"]`)?.getAttribute('href')).toBe(`#info-${k}`);
  }
 }
 expect(doc.querySelector('.base-grid')).toBeNull();expect(doc.querySelector('#base form')).toBeNull();
 expect(doc.querySelector('#info-workshop form[action="/base/craft"]')).not.toBeNull();db.close();
});
