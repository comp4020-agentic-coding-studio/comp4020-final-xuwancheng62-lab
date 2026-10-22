import type {DatabaseSync} from 'node:sqlite';
import {randomInt} from 'node:crypto';
import {tx} from './db.ts';
import {loadForUpdate,log} from './shelter.ts';
import {questState} from './quests.ts';
import {EVENTS,FACTIONS,SUPPLIES,type Faction,type Choice} from './game/narrative.ts';
export type NarrativeState={shelter_id:number;faction:Faction|null;kell:number;repairers:number;hounds:number};
export type Occurrence={event_id:string;choice:string|null;result:string|null;created_at:number;resolved_at:number|null};
export function narrativeState(db:DatabaseSync,sid:number):NarrativeState{
 return db.prepare('SELECT * FROM narrative_state WHERE shelter_id=?').get(sid) as NarrativeState??{shelter_id:sid,faction:null,kell:0,repairers:0,hounds:0};
}
export const occurrences=(db:DatabaseSync,sid:number)=>db.prepare('SELECT * FROM narrative_events WHERE shelter_id=? ORDER BY created_at DESC,event_id').all(sid) as Occurrence[];
export const worksChoice=(db:DatabaseSync,sid:number)=>questState(db,sid,'old-works').marks.find(x=>x==='warning'||x==='relief');
// Scheduling is tied to completed trips, not elapsed/offline time. One pending encounter.
export function scheduleEvent(db:DatabaseSync,sid:number,now:number){return tx(db,()=>{
 const rows=occurrences(db,sid).filter(x=>EVENTS.some(e=>e.id===x.event_id));
 if(rows.some(x=>!x.choice))return;
 const trips=(db.prepare('SELECT count(*) AS n FROM journeys WHERE shelter_id=? AND resolved_at IS NOT NULL').get(sid) as {n:number}).n;
 if(trips<1+rows.length*2)return;
 const remaining=EVENTS.filter(e=>!rows.some(r=>r.event_id===e.id));
 if(!remaining.length)return;
 db.prepare('INSERT INTO narrative_events(shelter_id,event_id,created_at) VALUES(?,?,?)').run(sid,remaining[randomInt(remaining.length)].id,now);
});}
function relation(db:DatabaseSync,sid:number,changes:Choice['relations']){
 db.prepare('INSERT OR IGNORE INTO narrative_state(shelter_id) VALUES(?)').run(sid);
 for(const f of Object.keys(FACTIONS) as Faction[])if(changes?.[f])db.prepare(`UPDATE narrative_state SET ${f}=max(-10,min(10,${f}+?)) WHERE shelter_id=?`).run(changes[f]!,sid);
}
function reward(db:DatabaseSync,sid:number,gain:Choice['gain']){
 // Loot is retained above the production cap, matching exploration rewards.
 if(!gain)return;
 db.prepare('UPDATE shelters SET water=water+?,food=food+?,scrap=scrap+? WHERE id=?').run(gain.water??0,gain.food??0,gain.scrap??0,sid);
}
export function resolveNarrative(db:DatabaseSync,uid:number,id:string,pick:string,now:number):{ok:boolean;reason?:string}{
 return tx(db,()=>{
 const s=loadForUpdate(db,'user_id',uid,now)!;
 const rows=occurrences(db,s.id);
 const old=rows.find(r=>r.event_id===id);
 if(old?.choice&&!id.startsWith('join-'))return {ok:true};
 if(s.journey)return {ok:false,reason:'Return home before making this decision.'};
 let choice:Choice|undefined;
 if(id==='works-followup'){
  const branch=worksChoice(db,s.id);if(!branch||pick!=='hear')return {ok:false,reason:'Send the east-side warning first.'};
  choice=branch==='relief'?{id:pick,label:'The parcel arrived',result:'The walkers report that your parcel reached the east-side households. They repaired a small communal pump and stayed together. The main intake remains chained. Their repair yard is now open to you.',relations:{kell:2,repairers:1}}:{id:pick,label:'They took the back path',result:'Your warning reached the east side. Several households left before the Hounds arrived. A walker has marked a safe supply cache along their evacuation path. The main intake remains chained.',relations:{kell:1,hounds:-1}};
 }else if(id==='east-side-cache'){
  if(!rows.some(r=>r.event_id==='works-followup'&&r.choice)||pick!=='collect')return {ok:false,reason:'Hear back from the east side first.'};
  const relief=worksChoice(db,s.id)==='relief';choice={id:pick,label:relief?'Visit the repair yard':'Follow the safe path',gain:relief?{scrap:12,water:8}:{food:8,water:8},result:relief?'You visit the east-side repair yard. The residents share spare parts and clean water.':'The walkers’ marked path leads to a small cache left for those following them. You collect its supplies.'};
 }else if(id.startsWith('join-')){
  const f=id.slice(5) as Faction;if(!Object.hasOwn(FACTIONS,f)||pick!=='join')return {ok:false,reason:'Unknown allegiance.'};
  const state=narrativeState(db,s.id);
  if(state.faction)return {ok:false,reason:'Leave your current faction before joining another.'};
  if(state[f]<2)return {ok:false,reason:'Build at least 2 trust with this faction through encounters first.'};
  relation(db,s.id,old?{}:f==='hounds'?{kell:-3,repairers:-2}:f==='kell'?{hounds:-2}:{});
  db.prepare('UPDATE narrative_state SET faction=? WHERE shelter_id=?').run(f,s.id);
  choice={id:pick,label:`Join ${FACTIONS[f].name}`,result:`You joined ${FACTIONS[f].name}. Their first supply assignment is now available. Your allegiance does not rewrite anyone’s past.`};
 }else if(id==='leave-faction'){
  const state=narrativeState(db,s.id);if(!state.faction||pick!=='leave')return {ok:false,reason:'You are already independent.'};
  db.prepare('UPDATE narrative_state SET faction=NULL WHERE shelter_id=?').run(s.id);
  log(db,s.id,now,'info',`You left ${FACTIONS[state.faction].name}. You are independent again; previous choices and trust remain.`);
  // Membership history uses unique rows; joining again never repays first-join rewards.
  db.prepare('INSERT INTO narrative_events(shelter_id,event_id,choice,result,created_at,resolved_at) VALUES(?,?,?,?,?,?)').run(s.id,`left-${now}`,'leave',`Left ${FACTIONS[state.faction].name}.`,now,now);
  return {ok:true};
 }else if(id.startsWith('assignment-')){
  const f=id.slice(11) as Faction;const state=narrativeState(db,s.id);
  if(!Object.hasOwn(FACTIONS,f)||state.faction!==f||state[f]<2||pick!=='complete')return {ok:false,reason:'This assignment requires membership and 2 trust.'};
  choice={id:pick,label:'Complete supply assignment',cost:f==='kell'?{scrap:6}:f==='repairers'?{water:8}:{water:8},gain:SUPPLIES[f],relations:{[f]:1},result:f==='kell'?'You repair a handcart for the walkers. Their return run brings food and water.':f==='repairers'?'You bring clean water to a workshop shift. They share the usable parts from their salvage.':'You provision the checkpoint. The Hounds pay you from confiscated supplies. Those supplies once belonged to travellers.'};
 }else{
  const event=EVENTS.find(e=>e.id===id);
  if(!event||!old)return {ok:false,reason:'This encounter is not available.'};
  choice=event.choices.find(c=>c.id===pick);
 }
 if(!choice)return {ok:false,reason:'Choose an available response.'};
 const c=choice.cost??{};
 if(s.stock.water<(c.water??0)||s.stock.food<(c.food??0)||s.stock.scrap<(c.scrap??0))return {ok:false,reason:'You do not have the supplies for this choice.'};
 db.prepare('UPDATE shelters SET water=water-?,food=food-?,scrap=scrap-? WHERE id=?').run(c.water??0,c.food??0,c.scrap??0,s.id);
 reward(db,s.id,choice.gain);relation(db,s.id,choice.relations);
 db.prepare('INSERT INTO narrative_events(shelter_id,event_id,choice,result,created_at,resolved_at) VALUES(?,?,?,?,?,?) ON CONFLICT(shelter_id,event_id) DO UPDATE SET choice=excluded.choice,result=excluded.result,resolved_at=excluded.resolved_at').run(s.id,id,pick,choice.result,old?.created_at??now,now);
 log(db,s.id,now,'info',`${choice.label}: ${choice.result}`);
 return {ok:true};
 });
}
