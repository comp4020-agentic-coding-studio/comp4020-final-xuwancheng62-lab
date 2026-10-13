import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect,it,inject} from 'vitest';
import {JSDOM} from 'jsdom';
import {openDb} from '../src/db.ts';
import {createShelter,depart,loadShelter} from '../src/shelter.ts';
import {battleReports,learnedExplorationLessons} from '../src/battleReports.ts';
import {failureLessons,SPRAY_LESSON} from '../src/game/lessons.ts';
import {runSolo} from '../src/game/solo.ts';
import {destination} from '../src/game/world.ts';
import {worldPage,activityPage} from '../src/views.ts';
import {GEAR} from '../src/game/config.ts';
const now=1800000000000;
it('reveals spray advice only after defeat with actual damaging spray, not from future rooms or sealed zero-damage hits',()=>{
 const hit=['Round 1 — Explorer 20 · The warden sprayed Explorer 11.'];
 expect(failureLessons('won',hit)).toEqual([]);expect(failureLessons('escaped',hit)).toEqual([]);
 expect(failureLessons('defeated',['Round 1 — A rustshell bit Explorer for 4.'])).toEqual([]);
 expect(failureLessons('defeated',['Round 1 — The warden sprayed Explorer (sealed) 0.'])).toEqual([]);
 expect(failureLessons('defeated',hit)).toEqual([SPRAY_LESSON]);
 expect(GEAR.hazmat.note).toContain('blocks spray');expect(GEAR.respirator.note).toContain('Halves spray');
});
it('retains failure knowledge in the report and destination details, including reconstructed old reports',async()=>{
 const db=openDb(mkdtempSync(join(tmpdir(),'holdout-lessons-')));const user=Number(db.prepare("INSERT INTO users(username,password_hash,created_at) VALUES('lessons','x',?)").run(now).lastInsertRowid);createShelter(db,user,'lessons',now);
 let s=loadShelter(db,user,now);db.prepare('UPDATE characters SET level=8 WHERE id=?').run(s.character.id);s=loadShelter(db,user,now);
 expect(learnedExplorationLessons(db,s.id)).toEqual({});
 expect(depart(db,user,'research-station',now).ok).toBe(true);
 const j=db.prepare('SELECT id,return_at FROM journeys').get() as {id:number;return_at:number};
 const member={key:'you',name:'lessons',who:'you',hp:s.character.hp,body:s.character.base,gear:s.character.gear,belt:s.character.belt,pack:s.character.pack,row:'front' as const};
 let failed=runSolo(destination('research-station')!,member,1);
 for(let seed=1;seed<500&&(failed.result!=='defeated'||!failureLessons(failed.result,failed.log).length);seed++)failed=runSolo(destination('research-station')!,member,seed);
 expect(failed.result).toBe('defeated');expect(failureLessons(failed.result,failed.log)).toHaveLength(1);
 db.prepare('UPDATE journeys SET outcome_json=? WHERE id=?').run(JSON.stringify(failed),j.id);
 expect(learnedExplorationLessons(db,s.id)).toEqual({}); // Still pending.
 s=loadShelter(db,user,j.return_at);const reports=battleReports(db,s.id);
 expect(reports[0].lessons).toEqual([SPRAY_LESSON]);const learned=learnedExplorationLessons(db,s.id);expect(learned['research-station']).toEqual([SPRAY_LESSON]);expect(learned.armoury).toBeUndefined();
 const doc=new JSDOM(String(await worldPage(s,[],undefined,[],undefined,learned))).window.document;
 expect(doc.querySelector('#dest-research-station details .br-lessons')!.textContent).toContain(SPRAY_LESSON);expect(doc.querySelector('#dest-armoury .br-lessons')).toBeNull();
 const activity=new JSDOM(String(await activityPage(s,[],{reports}))).window.document;expect(activity.querySelector('.br-lessons')!.textContent).toContain('What you learned');
 db.prepare('UPDATE journeys SET outcome_json=? WHERE id=?').run(JSON.stringify({result:failed.result,loot:failed.loot}),j.id);expect(learnedExplorationLessons(db,s.id)).toEqual(learned);
 expect(learnedExplorationLessons(db,s.id+1)).toEqual({});db.close();
});
it('keeps defensive solutions out of a first-time World page over HTTP',async()=>{
 const base=inject('baseUrl');const r=await fetch(`${base}/register`,{method:'POST',redirect:'manual',body:new URLSearchParams({username:`spec_learn${Date.now().toString(36)}`,password:'abc123456'})});const cookie=r.headers.get('set-cookie')!.split(';')[0];
 const page=await fetch(`${base}/world`,{headers:{cookie}});const doc=new JSDOM(await page.text()).window.document;
 expect(doc.querySelector('.br-lessons')).toBeNull();expect(doc.querySelector('#dest-research-station')!.textContent).not.toContain('respirator');
});
