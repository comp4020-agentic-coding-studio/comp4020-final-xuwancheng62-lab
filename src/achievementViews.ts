import type { DatabaseSync } from 'node:sqlite';
import { html, raw } from 'hono/html';
import { ACHIEVEMENTS,earnedAchievements,featuredAchievements,type EarnedAchievement } from './achievements.ts';
const badge=(a:EarnedAchievement)=>html`<details class="achievement" data-achievement="${a.id}"><summary title="${a.description}"><img src="${a.art}" alt="" width="64" height="64" loading="lazy"><strong>${a.name}</strong></summary><div><p>${a.description}</p>${a.at!==null?html`<time datetime="${new Date(a.at).toISOString()}">${new Date(a.at).toISOString().slice(0,10)}</time>`:html`<small>Earned</small>`}</div></details>`;
export function achievementPanel(db:DatabaseSync,userId:number,name:string,self:boolean,now:number){
 const earned=earnedAchievements(db,userId,now),featured=featuredAchievements(db,userId,earned);
 return html`<section class="pc-achievements card" aria-label="Achievements"><header><h2>Achievements</h2><span>${earned.length} / ${ACHIEVEMENTS.length}</span></header>
 <div class="achievement-grid">${featured.map(id=>badge(earned.find(a=>a.id===id)!))}</div>
 ${!earned.length?html`<p class="sv-note">No achievements yet.</p>`:''}
 ${earned.length||self?html`<details class="achievement-all"><summary>All achievements · ${earned.length}</summary><div class="achievement-grid">${earned.map(badge)}${self?ACHIEVEMENTS.filter(a=>!earned.some(e=>e.id===a.id)).map(a=>html`<details class="achievement is-locked"><summary><img src="${a.art}" alt="" width="64" height="64" loading="lazy"><strong>${a.name}</strong><small>Locked</small></summary><p>${a.description}</p></details>`):''}</div></details>`:''}
 ${self&&earned.length?html`<details class="achievement-edit"><summary>Edit showcase</summary><form method="post" action="/players/${encodeURIComponent(name)}/achievements">${[0,1,2].map(i=>html`<label>Badge ${i+1}<select name="badge${i}"><option value="">None</option>${earned.map(a=>html`<option value="${a.id}" ${featured[i]===a.id?raw('selected'):''}>${a.name}</option>`)}</select></label>`)}<button>Save badges</button></form></details>`:''}</section>`;
}

// Reuse the owner's selected showcase; do not expose locked progress here.
export function achievementStrip(badges:readonly import('./achievements.ts').PublicAchievement[] = [], name:string) {
 return badges.length?html`<span class="name-achievements" aria-label="${name}'s achievements">${badges.map(a=>html`<a href="/players/${encodeURIComponent(name)}" target="_top" title="${a.name} — ${a.description}" aria-label="${a.name}" data-achievement="${a.id}"><img src="${a.art}" alt="" width="28" height="28" loading="lazy"></a>`)}</span>`:'';
}
