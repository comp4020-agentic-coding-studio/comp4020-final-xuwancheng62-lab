import type { DatabaseSync } from 'node:sqlite';
import { tx } from './db.ts';

export const ACHIEVEMENTS = [
  {id:'stories',name:'Storykeeper',description:'Complete a character collection.',art:'/static/img/cards/mags/jobbook.webp'},
  {id:'recruit',name:'New Neighbour',description:'Recruit your first survivor.',art:'/static/img/survivors/toby.jpg'},
  {id:'expedition',name:'Expedition Veteran',description:'Clear a team expedition.',art:'/static/img/dungeons/freight-yard.webp'},
  {id:'cooperation',name:'Side by Side',description:'Clear an expedition with another player.',art:'/static/img/dungeons/convoy.webp'},
  {id:'trade',name:'Deal Made',description:'Complete a trade with another player.',art:'/static/img/cards/helen/manifest.webp'},
] as const;
export type AchievementId = typeof ACHIEVEMENTS[number]['id'];
export type EarnedAchievement = typeof ACHIEVEMENTS[number] & {at:number|null};

// Read durable completion records, never activity text or a client's claim.
// Historical saves need no replay. Unknown historical dates stay unknown.
export function earnedAchievements(db:DatabaseSync,userId:number,now:number):EarnedAchievement[] {
  const shelter=db.prepare('SELECT id FROM shelters WHERE user_id=?').get(userId) as {id:number}|undefined;
  if(!shelter)return [];
  const sid=shelter.id;
  const dates=new Map<AchievementId,number|null>();
  const first=(sql:string,...args:(string|number)[]) => (db.prepare(sql).get(...args) as {at:number|null}|undefined)?.at ?? null;
  const collection=first('SELECT MIN(rewarded_at) at FROM collection_rewards WHERE shelter_id=?',sid);
  if(collection!==null)dates.set('stories',collection);
  const recruited=first("SELECT MIN(at) at FROM quest_marks WHERE owner=? AND mark='invited'",`shelter:${sid}`);
  const legacyRecruit=first('SELECT MIN(joined_at) at FROM residents WHERE shelter_id=?',sid);
  if(recruited!==null || legacyRecruit!==null || db.prepare("SELECT 1 FROM characters WHERE shelter_id=? AND who!='you'").get(sid)) dates.set('recruit',recruited??legacyRecruit);
  const runs=db.prepare(`SELECT p.ends_at,p.result_json,
    (SELECT COUNT(DISTINCT user_id) FROM party_seats WHERE party_id=p.id) players
    FROM parties p WHERE p.ends_at<=? AND p.result_json IS NOT NULL
    AND EXISTS(SELECT 1 FROM party_seats WHERE party_id=p.id AND user_id=?) ORDER BY p.ends_at`).all(now,userId) as unknown as {ends_at:number;result_json:string;players:number}[];
  for(const run of runs){
    let result;try{result=JSON.parse(run.result_json);}catch{continue;}
    if(result?.outcome!=='cleared')continue;
    if(!dates.has('expedition'))dates.set('expedition',run.ends_at);
    if(run.players>=2&&!dates.has('cooperation'))dates.set('cooperation',run.ends_at);
  }
  const traded=db.prepare("SELECT id FROM trade_offers WHERE state='accepted' AND sender!=recipient AND (sender=? OR recipient=?)").all(userId,userId) as {id:number}[];
  if(traded.length){
    const times=traded.map(t=>first('SELECT MIN(at) at FROM credit_ledger WHERE shelter_id=? AND event_key=?',sid,`trade:${t.id}:receive`)).filter((t):t is number=>t!==null);
    dates.set('trade',times.length?Math.min(...times):null);
  }
  return ACHIEVEMENTS.filter(a=>dates.has(a.id)).map(a=>({...a,at:dates.get(a.id)!}));
}
export function featuredAchievements(db:DatabaseSync,userId:number,earned:EarnedAchievement[]):string[] {
  const saved=db.prepare('SELECT featured_json FROM profile_achievements WHERE user_id=?').get(userId) as {featured_json:string}|undefined;
  if(!saved)return earned.slice(0,3).map(a=>a.id);
  return (JSON.parse(saved.featured_json) as string[]).filter(id=>earned.some(a=>a.id===id)).slice(0,3);
}
export function saveFeaturedAchievements(db:DatabaseSync,userId:number,ids:string[],now:number):boolean {
  return tx(db,()=>{
    const earned=earnedAchievements(db,userId,now);
    if(ids.length>3 || new Set(ids).size!==ids.length || ids.some(id=>!earned.some(a=>a.id===id)))return false;
    db.prepare('INSERT INTO profile_achievements(user_id,featured_json) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET featured_json=excluded.featured_json').run(userId,JSON.stringify(ids));
    return true;
  });
}

export type PublicAchievement = Pick<EarnedAchievement,'id'|'name'|'description'|'art'>;
export function publicAchievements(db:DatabaseSync,userId:number,now:number):PublicAchievement[] {
  const earned=earnedAchievements(db,userId,now);
  return featuredAchievements(db,userId,earned).map(id=>{
    const {name,description,art}=earned.find(a=>a.id===id)!;
    return {id:id as AchievementId,name,description,art};
  });
}
