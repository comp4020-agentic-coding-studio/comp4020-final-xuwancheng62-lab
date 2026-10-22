import { lootStrip } from './lootViews.ts';
import {colouredLoot} from "./lootText.ts";
import {html} from 'hono/html';
import type {BattleReport} from './battleReports.ts';
const RESULTS:Record<string,string>={won:'Victory',escaped:'Retreated',defeated:'Defeat',peaceful:'No combat'};
// Combat's compact tally is preserved in storage. Expand its shorthand for
// reading; never interpret damage numbers as a survivor's remaining health.
export function readableAction(text:string):string {
 const clean=text.replace(/\.$/,'');
 const incoming=clean.match(/^(.+?) (sprayed|shot|bit) (.+?) (?:for )?(\d+)$/);
 if(incoming){
  const target=incoming[3].match(/^(.+?) (\d+)×$/);
  return `${incoming[1]} ${incoming[2]} ${target?`${target[1]} ${target[2]} times`:incoming[3]} for ${incoming[4]} damage.`;
 }
 const hit=clean.match(/^(.+?) (\d+(?:\+\d+)*)(?:, (\d+) down)?$/);
 if(hit)return `${hit[1]} dealt ${hit[2]} damage${hit[3]?`; ${hit[3]} defeated`:''}.`;
 return text.replace('the others will carry them out.','the exploration ended.');
}
function line(text:string){
 const stage=text.match(/^(\d+)\/(\d+) · (.+)$/);
 if(stage)return html`<li class="br-stage">Encounter ${stage[1]} / ${stage[2]} · ${stage[3]}</li>`;
 const round=text.match(/^Round (\d+) — (.+)$/);
 if(round)return html`<li class="br-round"><b>Round ${round[1]}</b><div>${round[2].split(' · ').map(a=>html`<p>${readableAction(a)}</p>`)}</div></li>`;
 return html`<li class="br-event">${readableAction(text)}</li>`;
}
export function battleReportCard(r:BattleReport){
 const summary=r.summary.replace(/^.*?Health [\d.]+; lost [\d.]+ HP\.\s*/, '').replace(/([^.]) Found /,'$1. Found ');
 return html`<article class="card ex-party is-past br-card br-${r.result}" data-report="${r.id}"><header class="ex-head"><div><h3>${r.place} · ${RESULTS[r.result]??r.result}</h3><span>${r.traveller} · <time data-ago="${r.at}">${new Date(r.at).toISOString()}</time></span></div></header>
 <div class="br-health">${r.hp!==null?html`<span>Returned with <b>${Math.floor(r.hp)} HP</b></span>`:''}${r.lost!==null?html`<span>Lost <b>${Math.floor(r.lost)} HP</b></span>`:''}</div>
 ${r.rewards ? html`<h4>Your loot</h4>${lootStrip(r.loot,r.rewards.supplies,r.rewards.gear)}<details class="br-summary"><summary>Outcome details</summary><p>${colouredLoot(summary)}</p></details>` : html`<p class="br-summary">${colouredLoot(summary)}</p>`}
 ${r.lessons.length?html`<details class="br-lessons"><summary>What you learned</summary>${r.lessons.map(t=>html`<p>${t}</p>`)}</details>`:''}
 <details><summary>The whole run · ${r.log.filter(x=>x.startsWith('Round ')).length} rounds</summary><ol class="br-events">${r.log.map(line)}</ol></details></article>`;
}
