import { describe, it, expect, inject } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { resolveRaid } from '../src/game/raidCombat.ts';
import type { PartyMember } from '../src/game/combat.ts';
import { seeded } from '../src/game/rng.ts';
import { RAID } from '../src/game/config.ts';
import { openDb } from '../src/db.ts';
import { createShelter, loadShelter, depart } from '../src/shelter.ts';
import { addResident, starter, addSupply } from '../src/character.ts';
import { help, steal, endReinforcement } from '../src/interactions.ts';

const fighter=(key:string):PartyMember=>({key,name:key,who:'you',hp:95,body:{level:1,strength:5,agility:5,constitution:5},gear:{weapon:starter('crowbar')},belt:{},pack:{},row:'front'});
describe('raid combat',()=>{
 it('an intact strong door stops a weak raider without damaging defenders',()=>{
  const r=resolveRaid(seeded(1),fighter('1'),[fighter('2')],280,6);
  expect(r.won).toBe(false);expect(r.gateHp).toBeGreaterThan(0);expect(r.gateHp).toBeLessThan(280);
  expect(r.guards[0].hp).toBe(95);expect(r.log.join(' ')).toContain('door held');
 });
 it('a broken door opens access but equipped guards can repel the attack',()=>{
  const guard=fighter('2');guard.body.strength=100;guard.hp=300;
  const r=resolveRaid(seeded(4),fighter('1'),[guard],0,0);
  expect(r.won).toBe(false);expect(r.guards[0].hp).toBeGreaterThan(0);
  expect(r.log.join(' ')).toContain('repelled');
 });
 it('uses defender ammunition and healing with their equipment, not generic enemy damage',()=>{
  const guard=fighter('2');guard.gear.weapon={...starter('rifle22'),level:6};guard.pack={r22:20};guard.hp=20;guard.belt={firstaid:1};
  const r=resolveRaid(seeded(11),fighter('1'),[guard],0,0);
  expect(r.guards[0].belt.firstaid??0).toBe(0);expect(r.guards[0].shots).toBeGreaterThan(0);
  expect(r.guards[0].pack.r22).toBeLessThan(20);
 });
});

it('posting excludes production and exploration, persists on reopening, and only host or owner can return it',()=>{
 const dir=mkdtempSync(join(tmpdir(),'holdout-reinforce-'));let db=openDb(dir);const now=1800000000000;
 const player=(name:string)=>{const id=Number(db.prepare("INSERT INTO users(username,password_hash,created_at) VALUES(?,'x',?)").run(name,now).lastInsertRowid);createShelter(db,id,name,now);return {id,username:name};};
 const a=player('a'),b=player('b'),outsider=player('outsider');const av=loadShelter(db,a.id,now),bv=loadShelter(db,b.id,now);
 const toby=addResident(db,av.id,'toby',now)!;
 const key=randomUUID();expect(help(db,a,bv.id,key,now,'toby').ok).toBe(true);
 expect(help(db,a,bv.id,key,now,'toby').ok).toBe(true);
 expect(loadShelter(db,a.id,now).residents.find(r=>r.who==='toby')?.working).toBe(false);
 expect(depart(db,a.id,'workshop',now,undefined,'toby').ok).toBe(false);
 expect(endReinforcement(db,outsider,toby,now).ok).toBe(false);
 db.close();db=openDb(dir);
 expect(loadShelter(db,a.id,now+100000).crew.find(m=>m.id===toby)?.journey?.reinforcement).toBe(true);
 expect(loadShelter(db,b.id,now+100000).reinforcement?.characterId).toBe(toby);
 expect(endReinforcement(db,b,toby,now+100000).ok).toBe(true);
 expect(loadShelter(db,a.id,now+100000).crew.find(m=>m.id===toby)?.journey).toBeNull();
 expect(loadShelter(db,b.id,now+100000).reinforcement).toBeNull();db.close();
});

it('successful raids respect capacity and reserves; a replay repeats neither damage nor supplies and equipment survives defeat',()=>{
 const db=openDb(mkdtempSync(join(tmpdir(),'holdout-pvp-'))),now=1800000000000;
 const player=(name:string)=>{const id=Number(db.prepare("INSERT INTO users(username,password_hash,created_at) VALUES(?,'x',?)").run(name,now).lastInsertRowid);createShelter(db,id,name,now);return {id,username:name};};
 const a=player('a'),b=player('b');const av=loadShelter(db,a.id,now),bv=loadShelter(db,b.id,now);
 db.prepare('UPDATE shelters SET gate_hp=0,food=100 WHERE id=?').run(bv.id);
 db.prepare('UPDATE characters SET strength=500,hp=1000 WHERE id=?').run(av.character.id);
 addSupply(db,av.id,'firstaid',2,now,{id:av.character.id,slot:'belt'});
 const key=randomUUID();const result=steal(db,a,bv.id,'food',key,now);expect(result.ok).toBe(true);
 const first=loadShelter(db,b.id,now);expect(first.stock.food).toBe(100-RAID.maxSteal);
 expect(first.character.hp).toBeGreaterThanOrEqual(1);
 expect(db.prepare('SELECT id FROM items WHERE held_by=? AND level>0').all(bv.character.id)).toHaveLength(1);
 expect(steal(db,a,bv.id,'food',key,now).ok).toBe(true);expect(loadShelter(db,b.id,now).stock.food).toBe(first.stock.food);
 db.close();
});

const base=inject('baseUrl');
it('over HTTP: selectable character, posting locks travel/equipment, host dismissal, private raid report and concurrent slots',async()=>{
 const make=async()=>{const r=await fetch(new URL('/register',base),{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'spec_pvp'+randomUUID().slice(0,8),password:'correct horse battery'})});expect(r.status).toBe(303);const cookie=r.headers.getSetCookie().find(c=>c.startsWith('sid='))!.split(';')[0];const h=await(await fetch(new URL('/',base),{headers:{cookie}})).text();return {cookie,address:h.match(/\/shelters\/\d+/)![0]};};
 const get=async(p:{cookie:string},path:string)=>(await fetch(new URL(path,base),{headers:{cookie:p.cookie}}));
 const post=(p:{cookie:string},path:string,data:Record<string,string>={})=>fetch(new URL(path,base),{method:'POST',redirect:'manual',headers:{cookie:p.cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data)});
 const [a,b,c]=await Promise.all([make(),make(),make()]);
 const page=await(await get(a,b.address)).text();expect(new JSDOM(page).window.document.querySelector('#reinforce-character option')?.getAttribute('value')).toBe('you');
 const key=randomUUID();const sends=await Promise.all([post(a,b.address+'/help',{request_id:key,who:'you'}),post(c,b.address+'/help',{request_id:randomUUID(),who:'you'})]);
 expect(sends.map(r=>r.status).sort()).toEqual([303,409]);
 const sender=sends[0].status===303?a:c;const other=sender===a?c:a;
 expect((await post(sender,'/world/depart',{destination:'workshop'})).status).toBe(409);
 expect((await post(sender,'/gear/unequip',{slot:'weapon'})).status).toBe(409);
 const doc=new JSDOM(await(await get(sender,'/')).text()).window.document;
 expect(doc.querySelector('.status')?.textContent).toContain('until recalled');
 expect(doc.querySelector('.status [data-until]')).toBeNull();
 const recall=doc.querySelector<HTMLFormElement>('form[action^="/reinforcements/"]')!.getAttribute('action')!;
 expect((await post(other,recall)).status).toBe(404);
 expect((await post(b,recall)).status).toBe(303);
 expect((await get(sender,'/')).status).toBe(200);
 const raid=await post(sender,b.address+'/steal',{request_id:randomUUID(),resource:'food'});expect(raid.status).toBe(303);
 const result=new URL(raid.headers.get('location')!,base).searchParams.get('r');
 expect((await get(sender,`/raids/${result}`)).status).toBe(200);
 expect((await get(b,`/raids/${result}`)).status).toBe(200);
 expect((await get(other,`/raids/${result}`)).status).toBe(404);
 expect(await(await get(b,'/activity')).text()).toContain(`/raids/${result}`);
});
