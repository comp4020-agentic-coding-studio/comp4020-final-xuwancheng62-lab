import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {JSDOM} from 'jsdom';
import {expect,it,inject} from 'vitest';
import {openDb} from '../src/db.ts';
import {createShelter,depart,loadShelter,recentLog} from '../src/shelter.ts';
import {battleReports} from '../src/battleReports.ts';
import {activityPage} from '../src/views.ts';
const now=1800000000000;
function setup(){const db=openDb(mkdtempSync(join(tmpdir(),'holdout-reports-')));const user=Number(db.prepare("INSERT INTO users(username,password_hash,created_at) VALUES('reports','x',?)").run(now).lastInsertRowid);createShelter(db,user,'reports',now);return{db,user};}
it('shows settled fights in a collapsed chronological report, labels damage and retains original logs',async()=>{
 const {db,user}=setup();const initial=loadShelter(db,user,now);expect(depart(db,user,'supermarket',now).ok).toBe(true);
 expect(battleReports(db,initial.id)).toEqual([]);
 const j=db.prepare('SELECT id,return_at FROM journeys').get() as {id:number;return_at:number};
 const s=loadShelter(db,user,j.return_at);const count=db.prepare('SELECT COUNT(*) n FROM activity_log').get();
 const reports=battleReports(db,s.id);expect(reports).toHaveLength(1);expect(reports[0].lost).toBeGreaterThan(0);
 const ids=new Set(reports.flatMap(r=>r.logIds));
 const entries=recentLog(db,s.id,200).filter(e=>!ids.has(e.id!));
 const doc=new JSDOM(String(await activityPage(s,entries,{reports}))).window.document;
 const card=doc.querySelector('[data-report]')!;expect(card.querySelector('details')!.hasAttribute('open')).toBe(false);
 expect(card.textContent).toContain('Victory');expect(card.textContent).toContain('Returned with');expect(card.textContent).toContain('dealt');expect(card.textContent).toContain('damage');expect(card.textContent).not.toContain('for dealt');
 const rounds=[...card.querySelectorAll('.br-round>b')].map(x=>Number(x.textContent!.replace('Round ','')));expect(rounds).toEqual([...rounds].sort((a,b)=>a-b));
 expect(doc.querySelector('.log')!.textContent).not.toContain('Round ');expect(db.prepare('SELECT COUNT(*) n FROM activity_log').get()).toEqual(count);
 expect(battleReports(db,s.id+100)).toEqual([]);
 const saved=JSON.parse(String((db.prepare('SELECT outcome_json FROM journeys').get() as {outcome_json:string}).outcome_json));expect(saved.report.log.length).toBeGreaterThan(0);
 // Pre-feature outcomes can be reconstructed without changing saved rows.
 delete saved.report;db.prepare('UPDATE journeys SET outcome_json=? WHERE id=?').run(JSON.stringify(saved),j.id);
 const old=battleReports(db,s.id)[0];expect(old.log).toEqual(reports[0].log);expect(old.hp).toBe(reports[0].hp);expect(old.lost).toBe(reports[0].lost);db.close();
});
it('keeps encounter order when later fights restart at round one',async()=>{
 const {db,user}=setup();const s=loadShelter(db,user,now);expect(depart(db,user,'raider-camp',now).ok).toBe(true);
 const j=db.prepare('SELECT return_at FROM journeys').get() as {return_at:number};loadShelter(db,user,j.return_at);
 const reports=battleReports(db,s.id);const doc=new JSDOM(String(await activityPage(loadShelter(db,user,j.return_at),[],{reports}))).window.document;
 const stages=[...doc.querySelectorAll('.br-stage')].map(x=>x.textContent);expect(stages[0]).toContain('Encounter 1 / 2');
 if(stages.length===2)expect(stages[1]).toContain('Encounter 2 / 2');db.close();
});
it('does not reveal a pending battle outcome over HTTP',async()=>{
 const base=inject('baseUrl');const user=`spec_report${Date.now().toString(36)}`;
 const r=await fetch(`${base}/register`,{method:'POST',redirect:'manual',body:new URLSearchParams({username:user,password:'abc123456'})});
 const cookie=r.headers.get('set-cookie')!.split(';')[0];
 await fetch(`${base}/world/depart`,{method:'POST',redirect:'manual',headers:{cookie},body:new URLSearchParams({destination:'supermarket'})});
 const page=await fetch(`${base}/activity`,{headers:{cookie}});const doc=new JSDOM(await page.text()).window.document;
 expect(page.status).toBe(200);expect(doc.querySelector('[data-report]')).toBeNull();expect(doc.body.textContent).toContain('Combat runs automatically');
});
