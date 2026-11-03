import type {DatabaseSync} from 'node:sqlite';
import {html} from 'hono/html';
import {battleReports} from './battleReports.ts';
import {battleReportCard, reportFrame} from './battleReportViews.ts';
import {pastParties} from './parties.ts';
import {pastCard} from './expeditionViews.ts';
import {lootStrip} from './lootViews.ts';
import type {Haul} from './game/character.ts';

// Authorised, completed actions only. Rendering never advances another shelter.
export function activityReports(db:DatabaseSync,userId:number,shelterId:number,now:number){
 const solo=battleReports(db,shelterId);
 const parties=pastParties(db,userId,now);
 const raids=db.prepare(`SELECT i.id,i.created_at,i.actor_shelter_id,i.success,i.report_json,
   t.name AS target,u.username AS actor,l.message
   FROM interactions i JOIN shelters t ON t.id=i.target_shelter_id JOIN users u ON u.id=i.actor_user_id
   JOIN activity_log l ON l.interaction_id=i.id AND l.shelter_id=?
   WHERE i.report_json IS NOT NULL AND i.created_at<=? ORDER BY i.created_at DESC,i.id DESC LIMIT 8`).all(shelterId,now) as unknown as {id:number;created_at:number;actor_shelter_id:number;success:number;report_json:string;target:string;actor:string;message:string}[];
 const cards=[...solo.map(r=>({at:r.at,body:battleReportCard(r)})),...parties.map(p=>({at:p.ends_at!,body:pastCard(p,userId)})),...raids.map(r=>{
   const attacking=r.actor_shelter_id===shelterId;
   const lines=JSON.parse(r.report_json) as string[];
   const loot:Haul={};
   const taken=lines.find(l=>l.startsWith('Taken:'))??'';
   for(const match of taken.matchAll(/(\d+) (food|water|scrap)/g))loot[match[2] as keyof Haul]=Number(match[1]);
   return {at:r.created_at,body:html`<article class="card ex-party is-past" data-raid-report="${r.id}">${reportFrame(`Raid · ${r.target} · ${r.success?'Breached':'Repelled'}`,r.created_at,r.actor,html`
     <h4>${attacking?'Your loot':'Supplies taken'}</h4>${Object.keys(loot).length?lootStrip(loot):html`<p>Nothing taken.</p>`}
     <details><summary>The whole run</summary><p>${r.message}</p><ol class="ex-events">${lines.map(l=>html`<li>${l}</li>`)}</ol></details>`)}</article>`};
 })].sort((a,b)=>b.at-a.at);
 return {cards};
}
