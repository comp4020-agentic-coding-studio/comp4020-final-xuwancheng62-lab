import type { DatabaseSync } from 'node:sqlite';
import { ECONOMY } from './game/config.ts';
import { dayOf } from './game/economy.ts';
// Call inside the surrounding game transaction. No timers, no separate commits.
export const balance=(db:DatabaseSync,sid:number):number=>(db.prepare('SELECT credits FROM wallets WHERE shelter_id=?').get(sid) as {credits:number}|undefined)?.credits??ECONOMY.starterCredits;
export function money(db:DatabaseSync,sid:number,delta:number,reason:string,key:string,now:number):boolean {
  if(!Number.isSafeInteger(delta)) throw new Error('Invalid credit amount');
  const created=db.prepare('INSERT OR IGNORE INTO wallets VALUES (?,?)').run(sid,ECONOMY.starterCredits);
  if(created.changes)db.prepare('INSERT INTO credit_ledger(shelter_id,delta,reason,event_key,at) VALUES(?,?,?,?,?)').run(sid,ECONOMY.starterCredits,'Starting Credits','initial',now);
  if(db.prepare('SELECT 1 FROM credit_ledger WHERE shelter_id=? AND event_key=?').get(sid,key)) return false;
  if(db.prepare('UPDATE wallets SET credits=credits+? WHERE shelter_id=? AND credits+?>=0').run(delta,sid,delta).changes!==1) throw new Error('Not enough Credits.');
  db.prepare('INSERT INTO credit_ledger(shelter_id,delta,reason,event_key,at) VALUES(?,?,?,?,?)').run(sid,delta,reason,key,now);
  return true;
}
export function earnedToday(db:DatabaseSync,sid:number,prefix:string,now:number):number {
  return (db.prepare('SELECT COALESCE(SUM(delta),0) AS n FROM credit_ledger WHERE shelter_id=? AND event_key LIKE ? AND delta>0 AND at>=? AND at<?').get(sid,`${prefix}%`,dayOf(now)*ECONOMY.dayMs,(dayOf(now)+1)*ECONOMY.dayMs) as {n:number}).n;
}
export function expeditionCredits(db:DatabaseSync,sid:number,journey:number,level:number,now:number):number {
  const key=`expedition:${journey}`;
  if(db.prepare('SELECT 1 FROM credit_ledger WHERE shelter_id=? AND event_key=?').get(sid,key))return 0;
  const amount=Math.max(0,Math.min(ECONOMY.expeditionDaily-earnedToday(db,sid,'expedition:',now),ECONOMY.expeditionBase+level*ECONOMY.expeditionPerLevel));
  money(db,sid,amount,'Expedition cleared',key,now);return amount;
}
