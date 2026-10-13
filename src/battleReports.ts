import type { DatabaseSync } from 'node:sqlite';
import { destination } from './game/world.ts';
import type { Haul } from './game/character.ts';
import type { SoloResult } from './game/solo.ts';
import { RESIDENTS, type ResidentId } from './game/config.ts';
export interface BattleReport {
 id:number;at:number;place:string;traveller:string;result:string;
 hp:number|null;lost:number|null;loot:Haul;log:string[];summary:string;logIds:number[];
}
// Only settled journeys belonging to this shelter. New reports retain their
// snapshot; older trips can still be reconstructed from the original log IDs.
export function battleReports(db:DatabaseSync,shelterId:number,limit=8):BattleReport[]{
 const trips=db.prepare(`SELECT j.id,j.target_id,j.return_at,j.outcome_json,c.who,u.username
 FROM journeys j JOIN characters c ON c.id=j.character_id
 JOIN shelters s ON s.id=j.shelter_id JOIN users u ON u.id=s.user_id
 WHERE j.shelter_id=? AND j.target_kind='location' AND j.resolved_at IS NOT NULL
 ORDER BY j.return_at DESC,j.id DESC LIMIT ?`).all(shelterId,limit) as unknown as {id:number;target_id:string;return_at:number;outcome_json:string|null;who:string;username:string}[];
 const reports:BattleReport[]=[];
 for(const j of trips){
  const place=destination(j.target_id)?.name ?? j.target_id;
  const rows=db.prepare('SELECT id,kind,message FROM activity_log WHERE shelter_id=? AND at=? ORDER BY id').all(shelterId,j.return_at) as unknown as {id:number;kind:string;message:string}[];
  const prefix=j.who==='you'?'':`${RESIDENTS[j.who as ResidentId]?.name ?? j.who}: `;
  const finish=rows.findIndex(r=>r.message.startsWith(`${prefix}Returned from ${place}:`));
  if(finish<0)continue; // Old manual encounters keep their existing UI/log.
  let start=finish;
  while(start>0 && !rows[start-1].message.includes('Returned from '))start--;
  const payload=j.outcome_json ? JSON.parse(j.outcome_json) : {};
  const saved=payload.report as SoloResult|undefined;
  const summary=rows[finish].message;
  const numbers=summary.match(/Health ([\d.]+); lost ([\d.]+) HP/);
  const lines=saved?.log ?? rows.slice(start,finish).filter(r=>r.kind==='danger').map(r=>prefix&&r.message.startsWith(prefix)?r.message.slice(prefix.length):r.message);
  const ids=saved ? rows.filter(r=>saved.log.some(line=>r.message===prefix+line)).map(r=>r.id) : rows.slice(start,finish).filter(r=>r.kind==='danger').map(r=>r.id);
  reports.push({id:j.id,at:j.return_at,place,traveller:j.who==='you'?j.username:RESIDENTS[j.who as ResidentId]?.name ?? j.who,
   result:saved?.result??payload.result??'finished',hp:saved?.hp??(numbers?Number(numbers[1]):null),lost:saved?Math.max(0,saved.startingHp-saved.hp):numbers?Number(numbers[2]):null,
   loot:saved?.loot??payload.loot??{},log:lines,summary,logIds:[...ids,rows[finish].id]});
 }
 return reports;
}
