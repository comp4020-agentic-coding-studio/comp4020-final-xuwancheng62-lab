import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, inject } from 'vitest';
import { JSDOM } from 'jsdom';
import { openDb, tx } from '../src/db.ts';
import { createShelter, depart, loadShelter } from '../src/shelter.ts';
import { addResident, addSupply, starter } from '../src/character.ts';
import { attack } from '../src/encounter.ts';
import { CHARACTER } from '../src/game/config.ts';
import { halve, maxHpOf } from '../src/game/character.ts';
import { runSolo, soloResult } from '../src/game/solo.ts';
import { destination } from '../src/game/world.ts';
import { knownEnemies } from '../src/bestiary.ts';
import type { PartyMember } from '../src/game/combat.ts';

const now=1800000000000;
const member:PartyMember={key:'you',name:'Starter',who:'you',hp:maxHpOf(CHARACTER.strength,CHARACTER.constitution),body:{level:1,strength:CHARACTER.strength,agility:CHARACTER.agility,constitution:CHARACTER.constitution},gear:{weapon:starter('crowbar')},belt:{},pack:{},row:'front'};
function setup(){
 const db=openDb(mkdtempSync(join(tmpdir(),'holdout-solo-')));
 const user=tx(db,()=>{const id=Number(db.prepare("INSERT INTO users(username,password_hash,created_at) VALUES ('solo','x',?)").run(now).lastInsertRowid);createShelter(db,id,'solo',now);return id;});
 return {db,user};
}
it('healthy starters clear every gathering encounter with real HP loss across 2000 seeds per location',()=>{
 for(const place of ['supermarket','workshop','reservoir'])for(let seed=1;seed<=2000;seed++){
  const r=runSolo(destination(place)!,member,seed);
  expect(r.result).toBe('won');expect(r.hp).toBeGreaterThan(0);expect(r.hp).toBeLessThan(member.hp);
  expect(r.enemies).toHaveLength(1);expect(r.log.length).toBeGreaterThan(0);
  expect(runSolo(destination(place)!,member,seed)).toEqual(r);
 }
});
it('retreats once below 30%, keeps half the haul, and fights on after a failed escape',()=>{
 const low={...member,hp:29,body:{...member.body,agility:10},gear:{},belt:{smoke:1}};
 let escaped=false,failed=false;
 for(let seed=1;seed<300;seed++){
  const r=runSolo(destination('nest')!,low,seed);
  const attempts=r.log.filter(s=>s.includes('tried to turn back'));
  expect(attempts.length).toBeLessThanOrEqual(1);
  if(r.result==='escaped'){
   escaped=true;expect(r.hp).toBeGreaterThan(0);expect(r.belt.smoke??0).toBe(0);
   expect(r.loot).toEqual(halve(runSolo(destination('nest')!,low,seed,true).loot));
  }
  if(attempts.some(s=>s.includes('No running now'))){failed=true;expect(r.result).not.toBe('escaped');expect(r.log.length).toBeGreaterThan(attempts.length);}
 }
 expect(escaped).toBe(true);expect(failed).toBe(true);
});
it('uses carried healing before attempting retreat',()=>{
 const r=runSolo(destination('nest')!,{...member,hp:29,belt:{firstaid:1}},11);
 expect(r.belt.firstaid??0).toBe(0);
 const heal=r.log.findIndex(s=>s.includes('first-aid'));
 expect(heal).toBeGreaterThanOrEqual(0);
 const escape=r.log.findIndex(s=>s.includes('tried to turn back'));
 if(escape>=0)expect(heal).toBeLessThan(escape);
});
it('settles solo HP, supplies, XP and enemy cards once; offline completion needs no manual turns',()=>{
 const {db,user}=setup();const s=loadShelter(db,user,now);
 addSupply(db,s.id,'bandage',1,now,{id:s.character.id,slot:'belt'});
 expect(depart(db,user,'supermarket',now).ok).toBe(true);
 const j=db.prepare('SELECT * FROM journeys ORDER BY id DESC').get() as {id:number;encounter_at:number;return_at:number;outcome_json:string};
 const snapshot=soloResult(j.outcome_json)!;
 expect(knownEnemies(db,s.id)).toEqual([]);
 const halfway=loadShelter(db,user,j.encounter_at);
 expect(halfway.journey?.automatic).toBe(true);expect(halfway.journey?.phase).toBe('exploring');expect(halfway.journey?.encounter).toBeNull();
 expect(knownEnemies(db,s.id)).toEqual(['rat']);
 expect(attack(db,user,randomUUID(),0,j.encounter_at).ok).toBe(false);
 const home=loadShelter(db,user,j.return_at);
 expect(home.journey).toBeNull();expect(home.character.hp).toBe(Math.floor(snapshot.hp));expect(home.character.hp).toBeLessThan(s.character.hp);
 const xp=home.character.xp;const items=db.prepare('SELECT * FROM items ORDER BY id').all();
 expect(loadShelter(db,user,j.return_at).character.xp).toBe(xp);expect(db.prepare('SELECT * FROM items ORDER BY id').all()).toEqual(items);
 expect(knownEnemies(db,s.id)).toEqual(['rat']);db.close();
});
it('automates Nest encounters too, while calm story visits remain peaceful',()=>{
 const {db,user}=setup();expect(depart(db,user,'nest',now).ok).toBe(true);
 const j=db.prepare('SELECT * FROM journeys').get() as {encounter_at:number;return_at:number};
 const during=loadShelter(db,user,j.encounter_at);
 expect(during.journey?.phase).toBe('exploring');expect(during.journey?.automatic).toBe(true);
 expect(loadShelter(db,user,j.return_at).journey).toBeNull();
 const calm=runSolo(destination('nest')!,member,15,true);expect(calm.result).toBe('peaceful');expect(calm.hp).toBe(member.hp);expect(calm.enemies).toEqual([]);db.close();
});
it('defeat removes only the traveller’s carried items and leaves the home stash and other crew safe',()=>{
 const {db,user}=setup();const s=loadShelter(db,user,now);addResident(db,s.id,'toby',now);
 db.prepare('UPDATE characters SET hp=20 WHERE id=?').run(s.character.id);
 addSupply(db,s.id,'cloth',3,now);
 expect(depart(db,user,'nest',now).ok).toBe(true);
 const j=db.prepare('SELECT * FROM journeys').get() as {return_at:number;outcome_json:string};
 const r=soloResult(j.outcome_json)!;
 // Find the deterministic failing seed without relying on dice at settlement.
 if(r.result!=='defeated'){
  let forced=r;for(let seed=1;seed<100;seed++){forced=runSolo(destination('nest')!,{...member,hp:20,body:{...member.body,agility:0}},seed);if(forced.result==='defeated')break;}
  expect(forced.result).toBe('defeated');db.prepare('UPDATE journeys SET outcome_json=?').run(JSON.stringify(forced));
 }
 loadShelter(db,user,j.return_at);
 expect(db.prepare('SELECT COUNT(*) n FROM items WHERE held_by=?').get(s.character.id)).toEqual({n:0});
 expect(db.prepare("SELECT qty FROM items WHERE kind='cloth' AND held_by IS NULL").get()).toEqual({qty:3});
 expect(db.prepare("SELECT COUNT(*) n FROM items i JOIN characters c ON c.id=i.held_by WHERE c.who='toby'").get()).toEqual({n:1});db.close();
});
const base=inject('baseUrl');
it('explains automatic combat and default retreat over HTTP without adding a choice to departure forms',async()=>{
 const name=`spec_solo${Date.now().toString(36)}`;
 const res=await fetch(`${base}/register`,{method:'POST',redirect:'manual',body:new URLSearchParams({username:name,password:'abc123456',confirm:'abc123456',portrait:'1'})});
 const cookie=res.headers.get('set-cookie')!.split(';')[0];
 const doc=new JSDOM(await(await fetch(`${base}/world`,{headers:{cookie}})).text()).window.document;
 for(const place of ['supermarket','workshop','reservoir']){
  const card=doc.querySelector(`#dest-${place}`)!;expect(card.textContent).toContain('automatic combat');expect(card.textContent).toContain('30% HP');
  expect(card.querySelector('[name="retreat"]')).toBeNull();
 }
 expect(doc.querySelector('#dest-nest')!.textContent).toContain('automatic combat');
 const started=await fetch(`${base}/world/depart`,{method:'POST',redirect:'manual',headers:{cookie},body:new URLSearchParams({destination:'supermarket'})});expect(started.status).toBe(303);
 const activity=new JSDOM(await(await fetch(`${base}/activity`,{headers:{cookie}})).text()).window.document;
 expect(activity.body.textContent).toContain('Combat runs automatically');expect(activity.querySelector('form[action="/encounter/attack"]')).toBeNull();
});
