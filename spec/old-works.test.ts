import {it,expect} from 'vitest';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {JSDOM} from 'jsdom';
import {openDb} from '../src/db.ts';
import {createShelter,loadShelter} from '../src/shelter.ts';
import {respondOldWorks,questState,progressOf} from '../src/quests.ts';
import {OLD_WORKS,questProgress} from '../src/game/quests.ts';
import {journalPage} from '../src/journalViews.ts';
const now=1800000000000;
const clues=['unit-plate','dev-toolbag','chained-valve','wade-ledger','mags-reply'] as const;
function fixture(){const db=openDb(mkdtempSync(join(tmpdir(),'holdout-works-')));db.prepare("INSERT INTO users(id,username,password_hash,created_at) VALUES(1,'works','x',?)").run(now);createShelter(db,1,'works',now);const s=loadShelter(db,1,now);return {db,s,discover:()=>{for(const id of clues)db.prepare('INSERT INTO discoveries(shelter_id,fragment_id,found_at) VALUES(?,?,?)').run(s.id,id,now);}};}
it('requires all evidence, spends relief exactly once and remembers the chosen response',()=>{
 const {db,s,discover}=fixture();expect(respondOldWorks(db,1,'relief',now).ok).toBe(false);discover();
 db.prepare('UPDATE shelters SET water=19,scrap=10 WHERE id=?').run(s.id);
 expect(respondOldWorks(db,1,'relief',now).ok).toBe(false);expect(questState(db,s.id,OLD_WORKS.id).marks).toEqual([]);
 db.prepare('UPDATE shelters SET water=40,scrap=30 WHERE id=?').run(s.id);
 expect(respondOldWorks(db,1,'relief',now).ok).toBe(true);
 const stocks=db.prepare('SELECT water,scrap FROM shelters WHERE id=?').get(s.id);
 expect(stocks).toMatchObject({water:20,scrap:20});
 const character=db.prepare('SELECT xp,level FROM characters WHERE id=?').get(s.character.id);
 expect(respondOldWorks(db,1,'warning',now).ok).toBe(true);
 expect(db.prepare('SELECT water,scrap FROM shelters WHERE id=?').get(s.id)).toEqual(stocks);
 expect(db.prepare('SELECT xp,level FROM characters WHERE id=?').get(s.character.id)).toEqual(character);
 expect(questState(db,s.id,OLD_WORKS.id).marks).toEqual(['relief']);
 expect(progressOf(db,s.id).find(p=>p.quest.id===OLD_WORKS.id)?.quest.after).toContain('20 Water');db.close();
});
it('offers an affordable warning and keeps the new chapter hidden until evidence is found',async()=>{
 const {db,s,discover}=fixture();let doc=new JSDOM(String(await journalPage([],progressOf(db,s.id),'tasks','',s))).window.document;
 expect(doc.querySelector('[data-quest=old-works]')).toBeNull();discover();
 const records=clues.map(id=>({id,at:now,journeyId:null}));doc=new JSDOM(String(await journalPage(records,progressOf(db,s.id),'tasks','',s))).window.document;
 expect(doc.querySelector('a[href="/story/old-works"]')).not.toBeNull();
 db.prepare('UPDATE shelters SET water=0,scrap=0 WHERE id=?').run(s.id);
 expect(respondOldWorks(db,1,'wrong',now).ok).toBe(false);
 expect(respondOldWorks(db,1,'warning',now).ok).toBe(true);
 expect(questProgress(OLD_WORKS,questState(db,s.id,OLD_WORKS.id)).complete).toBe(true);db.close();
});
