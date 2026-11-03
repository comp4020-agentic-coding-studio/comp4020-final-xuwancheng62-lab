import { JSDOM } from 'jsdom';
import { expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PLAYTEST } from '../src/game/config.ts';
import { FREIGHT_YARD } from '../src/game/dungeons.ts';
import { destination, planJourney } from '../src/game/world.ts';
import { openDb } from '../src/db.ts';
import { createShelter, loadShelter } from '../src/shelter.ts';
import { createParty, joinParty, partyRow } from '../src/parties.ts';

it('waits three seconds before settling solo exploration once, with two equipment drops',async()=>{
 process.env.DATA_DIR=mkdtempSync(join(tmpdir(),'holdout-instant-http-'));
 const {app}=await import('../src/server.ts');
 const previous=PLAYTEST.instantExploration;PLAYTEST.instantExploration=true;
 try {
  const register=await app.request('http://localhost/register',{method:'POST',headers:{host:'localhost'},body:new URLSearchParams({username:`spec_instant${Date.now().toString(36)}`,password:'instant-testing123'})});
  expect(register.status,await register.clone().text()).toBe(303);
  const cookie=register.headers.get('set-cookie')!.split(';')[0];
  const post=await app.request('/world/depart',{method:'POST',headers:{cookie,host:'localhost'},body:new URLSearchParams({destination:'supermarket'})});
  expect(post.status).toBe(303);
  const pending=new JSDOM(await (await app.request('/activity',{headers:{cookie,host:'localhost'}})).text()).window.document;
  expect(pending.querySelector('.br-card')).toBeNull();
  vi.spyOn(Date,'now').mockReturnValue(Date.now()+PLAYTEST.explorationMs+1);
  const first=await (await app.request('/activity',{headers:{cookie,host:'localhost'}})).text();
  const report=new JSDOM(first).window.document.querySelector('.br-card')!;
  expect(report).not.toBeNull();
  expect((report.querySelector('.br-summary')!.textContent!.match(/level /g)||[])).toHaveLength(2);
  const names=[...report.querySelectorAll('.br-summary .loot-name')];expect(names).toHaveLength(2);for(const name of names){expect(name.className).toMatch(/q-(common|uncommon|rare|epic|legendary)/);expect(name.textContent).not.toContain('level');}
  const home=await (await app.request('/',{headers:{cookie,host:'localhost'}})).text();
  expect(home).toContain('At Shelter');
  const second=await (await app.request('/activity',{headers:{cookie,host:'localhost'}})).text();
  expect(new JSDOM(second).window.document.querySelectorAll('.br-card')).toHaveLength(1);
  expect(new JSDOM(second).window.document.querySelector('.br-summary')!.textContent).toBe(report.querySelector('.br-summary')!.textContent);
  const t=planJourney(destination('supermarket')!,1000,5);expect(t.returnAt).toBe(4000);
 }finally{vi.restoreAllMocks();PLAYTEST.instantExploration=previous;}
});
it('waits for the party run and does not grant its doubled loot again on refresh',()=>{
 const previous=PLAYTEST.instantExploration;PLAYTEST.instantExploration=true;
 const db=openDb(mkdtempSync(join(tmpdir(),'holdout-instant-party-'))),now=1800000000000;
 try {
  const users=['a','b'].map(name=>{const id=Number(db.prepare("INSERT INTO users(username,password_hash,created_at) VALUES (?,'x',?)").run(name,now).lastInsertRowid);createShelter(db,id,name,now);return id;});
  const made=createParty(db,users[0],{dungeon:FREIGHT_YARD.id,size:2,approach:'fight',retreat:'never'},now);if(!made.ok)throw Error(made.reason);
  expect(joinParty(db,users[1],made.partyId!,{},now).ok).toBe(true);
  const party=partyRow(db,made.partyId!)!;expect(party.ends_at).toBeGreaterThan(now);
  for(const u of users)expect(loadShelter(db,u,now).journey).not.toBeNull();
  for(const u of users)expect(loadShelter(db,u,party.ends_at!).journey).toBeNull();
  const items=db.prepare('SELECT * FROM items ORDER BY id').all();
  for(const u of users)loadShelter(db,u,party.ends_at!+1);
  expect(db.prepare('SELECT * FROM items ORDER BY id').all()).toEqual(items);
  expect(JSON.parse(party.result_json!).loot.gear).toHaveLength(4);
 }finally{db.close();PLAYTEST.instantExploration=previous;}
});
