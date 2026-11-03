import {it,expect,afterEach,inject} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {JSDOM} from 'jsdom';
import {openDb} from '../src/db.ts';
import {createShelter} from '../src/shelter.ts';
import {addResident} from '../src/character.ts';
import {earnedAchievements,featuredAchievements,saveFeaturedAchievements,publicAchievements} from '../src/achievements.ts';
import {achievementStrip,achievementPanel} from '../src/achievementViews.ts';
const now=1800000000000,cleanup:(()=>void)[]=[];
afterEach(()=>cleanup.splice(0).forEach(f=>f()));
function fixture(){const dir=mkdtempSync(join(tmpdir(),'holdout-achievements-')),db=openDb(dir);cleanup.push(()=>{db.close();rmSync(dir,{recursive:true,force:true});});for(let i=1;i<=2;i++){db.prepare("INSERT INTO users(id,username,password_hash,created_at) VALUES(?,?,'x',?)").run(i,'badge'+i,now);createShelter(db,i,'badge'+i,now);}return {db,sid:Number((db.prepare('SELECT id FROM shelters WHERE user_id=1').get() as {id:number}).id)};}
it('recognises historical collection and recruitment without changing source records',()=>{
 const {db,sid}=fixture();expect(earnedAchievements(db,1,now)).toEqual([]);
 db.prepare("INSERT INTO collection_rewards(shelter_id,set_id,xp,rewarded_at) VALUES(?,'toby',50,?)").run(sid,now-100);
 db.prepare("INSERT INTO quest_marks(owner,quest_id,mark,at) VALUES(?,'toby','invited',?)").run(`shelter:${sid}`,now-50);
 expect(earnedAchievements(db,1,now).map(a=>[a.id,a.at])).toEqual([['stories',now-100],['recruit',now-50]]);
 expect(earnedAchievements(db,2,now)).toEqual([]);
 expect(earnedAchievements(db,1,now)).toHaveLength(2);
});
it('requires a finished clear and distinct owners for cooperation, not two characters',()=>{
 const {db,sid}=fixture();
 const char=(uid:number)=>Number((db.prepare("SELECT c.id FROM characters c JOIN shelters s ON s.id=c.shelter_id WHERE s.user_id=? AND who='you'").get(uid) as {id:number}).id);
 const party=Number(db.prepare("INSERT INTO parties(dungeon,leader_user_id,size,approach,retreat,seed,created_at,expires_at,ends_at,result_json) VALUES('freight-yard',1,2,'fight','half',1,?,?,?,?)").run(now-1000,now+1000,now+1,JSON.stringify({outcome:'cleared'})).lastInsertRowid);
 db.prepare("INSERT INTO party_seats(party_id,user_id,shelter_id,character_id,row,joined_at) VALUES(?,1,?,?,'front',?)").run(party,sid,char(1),now-1000);
 expect(earnedAchievements(db,1,now)).toEqual([]);
 expect(earnedAchievements(db,1,now+1).map(a=>a.id)).toEqual(['expedition']);
 const npc=addResident(db,sid,'toby',now)!;
 db.prepare("INSERT INTO party_seats(party_id,user_id,shelter_id,character_id,row,joined_at) VALUES(?,1,?,?,'front',?)").run(party,sid,npc,now-1000);
 expect(earnedAchievements(db,1,now+1).map(a=>a.id)).toEqual(['recruit','expedition']);
 db.prepare("INSERT INTO party_seats(party_id,user_id,shelter_id,character_id,row,joined_at) SELECT ?,2,id,?,'front',? FROM shelters WHERE user_id=2").run(party,char(2),now-1000);
 expect(earnedAchievements(db,1,now+1).map(a=>a.id)).toEqual(['recruit','expedition','cooperation']);
 db.prepare('UPDATE parties SET result_json=?').run(JSON.stringify({outcome:'turned-back'}));
 expect(earnedAchievements(db,1,now+1).map(a=>a.id)).toEqual(['recruit']);
});
it('counts accepted player trades for both sides, never open offers or shop purchases',()=>{
 const {db}=fixture();
 db.prepare("INSERT INTO trade_offers(sender,recipient,state,give_json,want_json,created_at,expires_at) VALUES(1,2,'open','{}','{}',?,?)").run(now-100,now+100);
 expect(earnedAchievements(db,1,now)).toEqual([]);
 db.prepare("UPDATE trade_offers SET state='accepted'").run();
 for(const uid of [1,2])expect(earnedAchievements(db,uid,now).map(a=>[a.id,a.at])).toEqual([['trade',null]]);
});
it('only saves unique earned badges, supports an empty showcase and hides editing from visitors',async()=>{
 const {db,sid}=fixture();db.prepare("INSERT INTO collection_rewards(shelter_id,set_id,xp,rewarded_at) VALUES(?,'toby',50,?)").run(sid,now);
 expect(featuredAchievements(db,1,earnedAchievements(db,1,now))).toEqual(['stories']);
 expect(saveFeaturedAchievements(db,1,['cooperation'],now)).toBe(false);
 expect(saveFeaturedAchievements(db,1,['stories','stories'],now)).toBe(false);
 expect(saveFeaturedAchievements(db,1,[],now)).toBe(true);
 expect(featuredAchievements(db,1,earnedAchievements(db,1,now))).toEqual([]);
 const visitor=new JSDOM(String(await achievementPanel(db,1,'badge1',false,now))).window.document;
 expect(visitor.querySelector('form')).toBeNull();expect(visitor.querySelectorAll('.is-locked')).toHaveLength(0);
 const owner=new JSDOM(String(await achievementPanel(db,1,'badge1',true,now))).window.document;
 expect(owner.querySelectorAll('select')).toHaveLength(3);expect(owner.querySelectorAll('.is-locked')).toHaveLength(4);
});
const base=inject('baseUrl');
it('over HTTP protects showcase ownership and rejects forged unlocks',async()=>{
 const name='spec_badges'+Date.now().toString(36);
 const r=await fetch(new URL('/register',base),{method:'POST',redirect:'manual',body:new URLSearchParams({username:name,password:'correct horse battery'})});
 const cookie=r.headers.getSetCookie().find(c=>c.startsWith('sid='))!.split(';')[0];
 const post=(name:string,body:string)=>fetch(new URL(`/players/${name}/achievements`,base),{method:'POST',redirect:'manual',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body});
 expect((await post('someone-else','badge0=stories')).status).toBe(403);
 expect((await post(name,'badge0=stories')).status).toBe(400);
 expect((await post(name,'')).status).toBe(303);
 const page=new JSDOM(await(await fetch(new URL(`/players/${name}`,base),{headers:{cookie}})).text()).window.document;
 expect(page.querySelector('[aria-label="Achievements"]')).not.toBeNull();
 expect(page.querySelectorAll('[data-achievement]')).toHaveLength(0);
});

it('public strips show only selected earned badges and no private progress',async()=>{
 const {db,sid}=fixture();
 db.prepare("INSERT INTO collection_rewards(shelter_id,set_id,xp,rewarded_at) VALUES(?,'toby',50,?)").run(sid,now);
 const badges=publicAchievements(db,1,now);
 expect(badges.map(a=>a.id)).toEqual(['stories']);
 expect(badges[0]).not.toHaveProperty('at');
 const doc=new JSDOM(String(await achievementStrip(badges,'badge1'))).window.document;
 expect(doc.querySelector('.name-achievements a')?.getAttribute('href')).toBe('/players/badge1');
 expect(doc.querySelectorAll('img')).toHaveLength(1);
 saveFeaturedAchievements(db,1,[],now);
 expect(String(await achievementStrip(publicAchievements(db,1,now),'badge1'))).toBe('');
});
