import {it,expect,afterEach} from 'vitest';
import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {JSDOM} from 'jsdom';
import {openDb} from '../src/db.ts';
import {createShelter,loadShelter} from '../src/shelter.ts';
import {scheduleEvent,resolveNarrative,narrativeState,occurrences} from '../src/narrative.ts';
import {narrativePage} from '../src/narrativeViews.ts';
import {EVENTS} from '../src/game/narrative.ts';
const now=1800000000000,cleanups:(()=>void)[]=[];
afterEach(()=>{for(const f of cleanups.splice(0))f();});
function fixture(){const dir=mkdtempSync(join(tmpdir(),'holdout-narrative-')),db=openDb(dir);cleanups.push(()=>{db.close();rmSync(dir,{recursive:true,force:true});});for(let id=1;id<=2;id++){db.prepare('INSERT INTO users(id,username,password_hash,created_at) VALUES(?,?,?,?)').run(id,'story'+id,'x',now);createShelter(db,id,'story'+id,now);}const s=loadShelter(db,1,now);return {db,s};}
function pending(db:ReturnType<typeof openDb>,sid:number,id:string){db.prepare('INSERT INTO narrative_events(shelter_id,event_id,created_at) VALUES(?,?,?)').run(sid,id,now);}
it('never invents an encounter on reload or elapsed offline time; completed trips schedule one durable event',()=>{
 const {db,s}=fixture();scheduleEvent(db,s.id,now);scheduleEvent(db,s.id,now+999999999);expect(occurrences(db,s.id)).toHaveLength(0);
 db.prepare("INSERT INTO journeys(shelter_id,character_id,target_kind,target_id,action,departed_at,arrive_at,explore_until,return_at,resolved_at) VALUES(?,?,'location','supermarket','explore',?,?,?,?,?)").run(s.id,s.character.id,now,now,now,now,now);
 scheduleEvent(db,s.id,now);const rows=occurrences(db,s.id);expect(rows).toHaveLength(1);scheduleEvent(db,s.id,now+999999);expect(occurrences(db,s.id)).toEqual(rows);
});
it('validates ownership, available choices and resources, then resolves each event only once',()=>{
 const {db,s}=fixture();pending(db,s.id,'thirst');
 expect(resolveNarrative(db,2,'thirst','help',now).ok).toBe(false);
 expect(resolveNarrative(db,1,'thirst','invented',now).ok).toBe(false);
 db.prepare('UPDATE shelters SET water=0 WHERE id=?').run(s.id);expect(resolveNarrative(db,1,'thirst','help',now).ok).toBe(false);expect(occurrences(db,s.id)[0].choice).toBeNull();
 db.prepare('UPDATE shelters SET water=20 WHERE id=?').run(s.id);expect(resolveNarrative(db,1,'thirst','help',now).ok).toBe(true);
 expect(narrativeState(db,s.id).kell).toBe(2);expect(db.prepare('SELECT water FROM shelters WHERE id=?').get(s.id)).toMatchObject({water:12});
 resolveNarrative(db,1,'thirst','refuse',now);expect(narrativeState(db,s.id).kell).toBe(2);expect(occurrences(db,s.id)[0].choice).toBe('help');
});
it('requires trust and explicit allegiance, enables a real assignment, and allows independence without repeating rewards',()=>{
 const {db,s}=fixture();expect(resolveNarrative(db,1,'join-kell','join',now).ok).toBe(false);
 pending(db,s.id,'thirst');db.prepare('UPDATE shelters SET water=40,scrap=30 WHERE id=?').run(s.id);resolveNarrative(db,1,'thirst','help',now);
 expect(narrativeState(db,s.id).faction).toBeNull();expect(resolveNarrative(db,1,'join-kell','join',now).ok).toBe(true);
 expect(narrativeState(db,s.id).faction).toBe('kell');expect(resolveNarrative(db,1,'assignment-hounds','complete',now).ok).toBe(false);
 expect(resolveNarrative(db,1,'assignment-kell','complete',now).ok).toBe(true);const stock=db.prepare('SELECT food,water,scrap FROM shelters WHERE id=?').get(s.id);
 resolveNarrative(db,1,'assignment-kell','complete',now);expect(db.prepare('SELECT food,water,scrap FROM shelters WHERE id=?').get(s.id)).toEqual(stock);
 expect(resolveNarrative(db,1,'leave-faction','leave',now+1).ok).toBe(true);expect(narrativeState(db,s.id).faction).toBeNull();expect(resolveNarrative(db,1,'join-kell','join',now+2).ok).toBe(true);expect(narrativeState(db,s.id).faction).toBe('kell');expect(narrativeState(db,s.id).hounds).toBe(-2);
});
it.each(['warning','relief'])('turns the %s branch into a distinct follow-up and a one-time playable supply lead',branch=>{
 const {db,s}=fixture();expect(resolveNarrative(db,1,'works-followup','hear',now).ok).toBe(false);
 db.prepare('INSERT INTO quest_marks(owner,quest_id,mark,at) VALUES(?,?,?,?)').run('shelter:'+s.id,'old-works',branch,now);
 expect(resolveNarrative(db,1,'east-side-cache','collect',now).ok).toBe(false);
 expect(resolveNarrative(db,1,'works-followup','hear',now).ok).toBe(true);expect(occurrences(db,s.id)[0].result).toContain(branch==='relief'?'repaired':'left before');
 expect(resolveNarrative(db,1,'east-side-cache','collect',now+1).ok).toBe(true);const stock=db.prepare('SELECT food,water,scrap FROM shelters WHERE id=?').get(s.id);resolveNarrative(db,1,'east-side-cache','collect',now+2);expect(db.prepare('SELECT food,water,scrap FROM shelters WHERE id=?').get(s.id)).toEqual(stock);
});
it('renders choices with costs, no outcome spoilers and all required art',async()=>{
 const {db,s}=fixture();pending(db,s.id,'thirst');const doc=new JSDOM(String(await narrativePage(db,s,'thirst'))).window.document;
 expect(doc.querySelectorAll('.story-choice')).toHaveLength(2);expect(doc.body.textContent).toContain('8 water');expect(doc.body.textContent).not.toContain('will hear who helped');
 for(const e of EVENTS){expect(existsSync('static/img/story-events/'+e.art+'.webp')).toBe(true);}
 expect(doc.querySelector('a[href="/journal"]')?.textContent).toContain('Decide later');
});
it.each(EVENTS)('resolves every option for $id without producing negative stocks',e=>{
 for(const c of e.choices){const {db,s}=fixture();pending(db,s.id,e.id);db.prepare('UPDATE shelters SET water=100,food=100,scrap=100 WHERE id=?').run(s.id);expect(resolveNarrative(db,1,e.id,c.id,now).ok).toBe(true);expect(occurrences(db,s.id)[0].result).toBe(c.result);}
});
it('serves the story hub behind login and rejects forged encounter posts for a new account',async()=>{
 const url='http://localhost:8080';
 const guest=await fetch(url+'/story',{redirect:'manual'});expect(guest.status).toBe(302);
 const res=await fetch(url+'/register',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'story_http_'+Date.now().toString(36),password:'correct horse battery'})});
 const cookie=res.headers.getSetCookie().find(c=>c.startsWith('sid='))!.split(';')[0];
 const hub=await fetch(url+'/story',{headers:{cookie}});expect(hub.status).toBe(200);expect(await hub.text()).toContain('Who will you stand with?');
 const forged=await fetch(url+'/story/thirst/choose',{method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:'choice=help'});expect(forged.status).toBe(409);
 const locked=await fetch(url+'/story/old-works?page=NaN',{headers:{cookie}});expect(await locked.text()).toContain('Follow the evidence');
});
it('blocks new decisions while away without consuming supplies',()=>{
 const {db,s}=fixture();pending(db,s.id,'thirst');db.prepare("INSERT INTO journeys(shelter_id,character_id,target_kind,target_id,action,departed_at,arrive_at,explore_until,return_at) VALUES(?,?,'location','supermarket','explore',?,?,?,?)").run(s.id,s.character.id,now,now+99999,now+199999,now+299999);
 const result=resolveNarrative(db,1,'thirst','refuse',now);expect(result.ok).toBe(false);expect(result.reason).toContain('Return home');expect(occurrences(db,s.id)[0].choice).toBeNull();
});
