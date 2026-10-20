import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, inject, it } from "vitest";
import { JSDOM } from "jsdom";
import { openDb } from "../src/db.ts";
import { createShelter, depart, loadShelter } from "../src/shelter.ts";
import { foundIds } from "../src/stories.ts";
import { sendHelenLetter } from "../src/helenQuest.ts";
import { UNDELIVERED, questProgress } from "../src/game/quests.ts";
import { SETS, isComplete } from "../src/game/collections.ts";
import { openLeads, pickFragment } from "../src/game/stories.ts";

let db: ReturnType<typeof openDb>;
let sid: number;
let now: number;
beforeEach(() => {
  now = 1_800_000_000_000;
  db = openDb(mkdtempSync(join(tmpdir(), "holdout-helen-")));
  db.prepare("INSERT INTO users (id,username,password_hash,created_at) VALUES (1,'helen_test','x',?)").run(now);
  createShelter(db, 1, "helen_test", now);
  sid = (db.prepare("SELECT id FROM shelters WHERE user_id=1").get() as {id:number}).id;
  // Strong fixture to exercise the full real solo-combat/settlement path.
  db.prepare("UPDATE characters SET level=7,strength=100,constitution=100,hp=700,max_hp=760 WHERE shelter_id=?").run(sid);
});
afterEach(() => db.close());
function clue(id: string) { db.prepare("INSERT OR IGNORE INTO discoveries(shelter_id,fragment_id,found_at) VALUES (?,?,?)").run(sid,id,now); }
function travel(place: string, focus: string) {
  expect(depart(db,1,place,now,focus).ok).toBe(true);
  const j=db.prepare("SELECT * FROM journeys ORDER BY id DESC LIMIT 1").get() as {id:number;return_at:number;arrive_at:number;outcome_json:string};
  return j;
}
function finish(j: {return_at:number}) { now=j.return_at+1; loadShelter(db,1,now); }
it("plays the northern recovery, unlocks Helen's collection, and delivers only on explicit consent",()=>{
  for(const id of ["day-140","bus-2","radio-log","siren-talk","council-bulletin"]) clue(id);
  expect(pickFragment([],"weighbridge","stolen-post")).toBe(null);
  expect(depart(db,1,'weighbridge',now,'stolen-post').ok).toBe(false);
  const ridge=travel("ridge-road","relief-convoy");
  expect(JSON.parse(ridge.outcome_json).result).toBe("won");
  finish(ridge);
  expect(foundIds(db,sid)).toContain("convoy-manifest");
  const store=travel("weighbridge","stolen-post");
  expect(JSON.parse(store.outcome_json).result).toBe("won");
  finish(store);
  expect(isComplete(SETS.find(s=>s.id==='helen')!,foundIds(db,sid))).toBe(true);
  expect(foundIds(db,sid)).not.toContain("helen-forwarded");
  expect(sendHelenLetter(db,1,now).ok).toBe(true);
  expect(sendHelenLetter(db,1,now).ok).toBe(true);
  expect(db.prepare("SELECT COUNT(*) AS n FROM discoveries WHERE fragment_id='helen-forwarded'").get()).toEqual({n:1});
  expect(openLeads(foundIds(db,sid),'workshop').some(x=>x.lead.id==='ruth-receipt')).toBe(true);
  finish(travel("workshop","ruth-receipt"));
  expect(questProgress(UNDELIVERED,{found:foundIds(db,sid),marks:[]}).complete).toBe(true);
  loadShelter(db,1,now+1);
  expect(db.prepare("SELECT COUNT(*) AS n FROM discoveries WHERE fragment_id='ruth-received'").get()).toEqual({n:1});
});
it("does not reveal guarded evidence on arrival, retreat or defeat",()=>{
  clue('convoy-manifest');
  const j=travel('weighbridge','stolen-post');
  db.prepare("UPDATE journeys SET return_at=?,explore_until=?,arrive_at=? WHERE id=?").run(now+10000,now+10000,now,j.id);
  loadShelter(db,1,now+1);
  expect(foundIds(db,sid)).not.toContain('helen-letter');
  const outcome=JSON.parse(j.outcome_json); outcome.result='escaped';
  db.prepare("UPDATE journeys SET outcome_json=? WHERE id=?").run(JSON.stringify(outcome),j.id);
  finish({return_at:now+10000});
  expect(foundIds(db,sid)).not.toContain('helen-letter');
  const retry=travel('weighbridge','stolen-post');
  const loss=JSON.parse(retry.outcome_json);loss.result='defeated';loss.hp=0;
  db.prepare("UPDATE journeys SET outcome_json=? WHERE id=?").run(JSON.stringify(loss),retry.id);
  finish(retry);
  expect(foundIds(db,sid)).not.toContain('helen-letter');
});
it("rejects sending before recovery or while away",()=>{
  expect(sendHelenLetter(db,1,now).ok).toBe(false);
  clue('convoy-manifest');clue('helen-letter');
  const j=travel('reservoir','look');
  db.prepare("UPDATE journeys SET return_at=?,explore_until=? WHERE id=?").run(now+10000,now+10000,j.id);
  expect(sendHelenLetter(db,1,now).ok).toBe(false);
});
const base=inject('baseUrl');
it("exposes northern routes and a real quest over HTTP without exposing the letter or accepting a forged delivery",async()=>{
  const reg=await fetch(new URL('/register',base),{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:`h_${Date.now().toString(36)}`,password:'correct horse battery'})});
  expect(reg.status).toBe(303);
  const cookie=reg.headers.getSetCookie().find(c=>c.startsWith('sid='))!.split(';')[0];
  const journal=new JSDOM(await (await fetch(new URL('/journal',base),{headers:{cookie}})).text()).window.document;
  expect(journal.querySelector('[data-quest="undelivered"] [data-step="envelope"]')?.getAttribute('data-state')).toBe('locked');
  expect(journal.querySelector('form[action="/quests/undelivered/send"]')).toBeNull();
  const refused=await fetch(new URL('/quests/undelivered/send',base),{method:'POST',redirect:'manual',headers:{cookie}});
  expect(refused.status).toBe(409);
  expect((await fetch(new URL('/quests/undelivered/send',base),{method:'POST',redirect:'manual'})).status).toBe(303);
  const world=new JSDOM(await (await fetch(new URL('/world',base),{headers:{cookie}})).text()).window.document;
  for(const id of ['ridge-road','weighbridge']) expect(world.querySelector(`[data-story-route][href="#dest-${id}"]`)).not.toBeNull();
  expect((await fetch(new URL('/collection/helen/comic',base),{headers:{cookie}})).status).toBe(403);
});
