import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect,it,inject} from 'vitest';
import {JSDOM} from 'jsdom';
import {openDb} from '../src/db.ts';
import {createShelter,depart,loadShelter} from '../src/shelter.ts';
import {addResident} from '../src/character.ts';
import {createParty,joinParty} from '../src/parties.ts';
import {DUNGEONS,LOWER_DECK,type DungeonDef} from '../src/game/dungeons.ts';
import {canExplore,destination} from '../src/game/world.ts';
import {effective,type Gear} from '../src/game/items.ts';
import {runSolo,soloResult} from '../src/game/solo.ts';
import type {PartyMember} from '../src/game/combat.ts';
import {knownEnemies} from '../src/bestiary.ts';
const now=1800000000000;
const gear=(kind:Gear['kind'],level:number):Gear=>({kind,level,quality:'common',bonuses:{},traits:[]});
function fighter(level:number,armed=false):PartyMember{
 const body={level,strength:7,agility:7,constitution:8};
 const loadout={weapon:gear(armed?'servicerifle':'machete',level),armour:gear(armed?'hazmat':'jacket',level),tool:gear(armed?'respirator':'backpack',level)};
 const pack=armed?{r556:60}:{};
 return {key:'you',name:'Explorer',who:'you',body,gear:loadout,hp:effective(body,loadout,pack).maxHp,belt:armed?{firstaid:3}:{bandage:3},pack,row:'front'};
}
function setup(){const db=openDb(mkdtempSync(join(tmpdir(),'holdout-midgame-')));const user=Number(db.prepare("INSERT INTO users(username,password_hash,created_at) VALUES('test','x',?)").run(now).lastInsertRowid);createShelter(db,user,'test',now);const s=loadShelter(db,user,now);addResident(db,s.id,'toby',now);return{db,user,s};}
it('uses the owner level, permits a five-level gap, and rejects a six-level gap even for a high-level NPC',()=>{
 expect(canExplore(3,[8,10])).toBe(true);expect(canExplore(2,[8,10])).toBe(false);
 const {db,user,s}=setup();db.prepare("UPDATE characters SET level=20 WHERE who='toby'").run();
 const before=db.prepare('SELECT COUNT(*) n FROM journeys').get();
 expect(depart(db,user,'research-station',now,undefined,'toby').ok).toBe(false);
 expect(db.prepare('SELECT COUNT(*) n FROM journeys').get()).toEqual(before);
 db.prepare('UPDATE characters SET level=3 WHERE id=?').run(s.character.id);
 db.prepare("UPDATE characters SET level=1 WHERE who='toby'").run();
 expect(depart(db,user,'research-station',now,undefined,'toby').ok).toBe(true);db.close();
});
it('enforces player admission for team creation and joining, including when sending Toby',()=>{
 const registry=DUNGEONS as DungeonDef[];
 registry.push({...LOWER_DECK,id:'test-high-level',level:[12,14]});
 const {db,user,s}=setup();
 const settings={dungeon:'test-high-level',size:2,approach:'fight',retreat:'half',who:'toby'};
 try{
  db.prepare("UPDATE characters SET level=20 WHERE who='toby'").run();
  expect(createParty(db,user,settings,now).ok).toBe(false);
  expect(db.prepare('SELECT COUNT(*) n FROM parties').get()).toEqual({n:0});
  db.prepare('UPDATE characters SET level=7 WHERE id=?').run(s.character.id);
  db.prepare("UPDATE characters SET level=1 WHERE who='toby'").run();
  const created=createParty(db,user,settings,now);expect(created.ok).toBe(true);
  const second=Number(db.prepare("INSERT INTO users(username,password_hash,created_at) VALUES('second','x',?)").run(now).lastInsertRowid);
  createShelter(db,second,'second',now);const other=loadShelter(db,second,now);
  if(!created.ok)throw Error('Party not created');
  expect(joinParty(db,second,created.partyId!,{},now).ok).toBe(false);
  expect(db.prepare('SELECT COUNT(*) n FROM party_seats').get()).toEqual({n:1});
  db.prepare('UPDATE characters SET level=7 WHERE id=?').run(other.character.id);
  expect(joinParty(db,second,created.partyId!,{},now).ok).toBe(true);
 }finally{registry.pop();db.close();}
});
it('runs sequential fights deterministically and distinguishes ordinary level-five gear from specialist preparation',()=>{
 const basic=fighter(5),prepared=fighter(8,true);let camp=0,research=0,armoury=0;
 for(let seed=1;seed<=300;seed++){
  const c=runSolo(destination('raider-camp')!,basic,seed);if(c.result==='won')camp++;
  const r=runSolo(destination('research-station')!,basic,seed);if(r.result==='won')research++;
  const a=runSolo(destination('armoury')!,prepared,seed);if(a.result==='won')armoury++;
  expect(r.log.filter(x=>x.includes('tried to turn back')).length).toBeLessThanOrEqual(1);
  expect(runSolo(destination('research-station')!,basic,seed)).toEqual(r);
  if(a.result==='won'){expect(a.log).toContain('3/3 · Vault guardian');expect(a.pack.r556??0).toBeLessThan(60);expect(a.hp).toBeLessThan(a.startingHp);}
 }
 expect(camp).toBeGreaterThan(270);expect(research).toBeLessThan(30);expect(armoury).toBeGreaterThan(270);
});
it('unlocks only reached enemies at their stage timestamps and settles rewards once',()=>{
 const {db,user,s}=setup();db.prepare('UPDATE characters SET level=5 WHERE id=?').run(s.character.id);
 expect(depart(db,user,'raider-camp',now).ok).toBe(true);
 const j=db.prepare('SELECT * FROM journeys').get() as {encounter_at:number;return_at:number;outcome_json:string};
 const result=soloResult(j.outcome_json)!;expect(result.sightings?.length).toBeGreaterThan(0);
 loadShelter(db,user,j.encounter_at-1);expect(knownEnemies(db,s.id)).toEqual([]);
 loadShelter(db,user,j.encounter_at);expect(knownEnemies(db,s.id)).toContain('raider');
 loadShelter(db,user,j.return_at);const rows=db.prepare('SELECT * FROM items ORDER BY id').all();const xp=loadShelter(db,user,j.return_at).character.xp;
 loadShelter(db,user,j.return_at);expect(db.prepare('SELECT * FROM items ORDER BY id').all()).toEqual(rows);expect(loadShelter(db,user,j.return_at).character.xp).toBe(xp);db.close();
});
it('serves locked entrances and rejects direct HTTP departure while keeping team entrances below solo and off the map',async()=>{
 const base=inject('baseUrl');const name=`spec_mid${Date.now().toString(36)}`;
 const register=await fetch(`${base}/register`,{method:'POST',redirect:'manual',body:new URLSearchParams({username:name,password:'abc123456'})});
 const cookie=register.headers.get('set-cookie')!.split(';')[0];
 const page=await fetch(`${base}/world`,{headers:{cookie}});const doc=new JSDOM(await page.text()).window.document;
 expect(doc.querySelectorAll('.wm-team-pin')).toHaveLength(0);
 const background=doc.querySelector('.tm-background')!;expect(background).not.toBeNull();
 expect((await fetch(`${base}${background.getAttribute('src')}`)).status).toBe(200);
 expect(doc.querySelectorAll('.tm-map .tm-entrance')).toHaveLength(DUNGEONS.length);
 for(const d of DUNGEONS)expect(doc.querySelector(`.tm-map a[data-dungeon="${d.id}"]`)?.getAttribute('href')).toContain(`dungeon=${d.id}`);
 expect(doc.querySelector('#dest-research-station button[disabled]')?.textContent).toContain('Player Lv 3');
 expect(doc.querySelector('#dest-armoury button[disabled]')?.textContent).toContain('Player Lv 6');
 for(const id of ['raider-camp','research-station','armoury']) expect((await fetch(`${base}/static/img/world/${id}.jpg`)).status).toBe(200);
 const headings=[...doc.querySelectorAll('h2')].map(x=>x.textContent);expect(headings.indexOf('Team entrances')).toBeLessThan(headings.indexOf('Team expeditions'));
 const rejected=await fetch(`${base}/world/depart`,{method:'POST',headers:{cookie},body:new URLSearchParams({destination:'armoury'})});
 expect(rejected.status).toBe(409);expect(await rejected.text()).toContain('Reach player level 6');
});
