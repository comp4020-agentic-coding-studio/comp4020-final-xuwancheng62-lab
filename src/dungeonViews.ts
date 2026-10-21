import { COMBAT, explorationTime } from "./game/config.ts";
import { canEnterDungeon, dungeonUnlockLevel } from "./game/dungeons.ts";
import { html, raw } from "hono/html";
import { DUNGEONS, type DungeonDef } from "./game/dungeons.ts";
export const dungeonMinutes = (d: DungeonDef) => Math.max(1, Math.ceil(d.rooms.reduce((sum, r) => sum + r.ms, 0) / 60_000));
export function dungeonCard(d: DungeonDef, selected?: string, playerLevel=1) {
  const locked=!canEnterDungeon(playerLevel,d);
  const photo=html`<img src="${d.art ?? "/static/img/world/supermarket.jpg"}" alt="${d.name}" width="960" height="640" loading="lazy"><span class="dg-badge">◆ Team · ${d.players.min}–${d.players.max}</span>`;
  return html`<article class="dg-card${selected === d.id ? " is-selected" : ""}${locked?' is-locked':''}" id="dungeon-${d.id}" data-dungeon="${d.id}">
    ${locked ? html`<div class="dg-image">${photo}</div>` : html`<a class="dg-image" href="/expeditions?dungeon=${d.id}#ex-call-h">${photo}</a>`}
    <div class="dg-body"><h3>${d.name}</h3><p class="dg-meta">Recommended Lv ${d.level?.join("–") ?? "5–8"} · ${explorationTime(1) ? `~${dungeonMinutes(d)} min exploration` : "Instant exploration"}${COMBAT.roundMs ? " + combat" : ""}</p><p class="dg-rewards">Equipment Lv ${d.level?.join("–")} · ${d.id === "freight-yard" ? "Starter quality" : "Rare / Epic"}${d.level && d.level[0] >= 8 ? " / Legendary" : ""}<br>${(d.rewardSummary ?? ["Equipment", "Supplies"]).join(" · ")}</p>${locked ? html`<button disabled>Player Lv ${dungeonUnlockLevel(d)} required</button>` : html`<a class="button" href="/expeditions?dungeon=${d.id}#ex-call-h">${selected === d.id ? "Selected · Form party" : "Form a party"}</a>`}</div>
  </article>`;
}
export const dungeonCards = (selected?: string, playerLevel=1) => html`<div class="dg-grid">${DUNGEONS.map(d => dungeonCard(d, selected,playerLevel))}</div>`;

// Positions belong to this illustrated overview, not the solo map's geography.
const ENTRANCES:Record<string,{x:number;y:number}>={
  'freight-yard':{x:19,y:25},'pump-station':{x:50,y:25},'road-checkpoint':{x:81,y:25},
  'lower-deck':{x:19,y:72},'convoy':{x:50,y:72},'kestrel':{x:81,y:72},
};
const spiral=()=>html`<span class="dg-vortex" aria-hidden="true"><span><svg viewBox="0 0 140 140" fill="none">${Array.from({length:6},(_,i)=>html`<path d="M70 70 C47 62 42 44 54 24 C68 1 106 1 126 23" transform="rotate(${i*60} 70 70)" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>`)}</svg></span><i></i></span>`;
export function teamEntranceMap(playerLevel:number){
 return html`<div class="tm-scroll" tabindex="0" aria-label="Scrollable team expedition map"><div class="tm-map">
 <img class="tm-background" src="/static/img/dungeons/team-map.jpg" alt="Dark industrial district with a freight yard, pumping station, road checkpoint and underground bunker entrance." width="1536" height="864" loading="lazy">
 ${DUNGEONS.map((d,i)=>{
  const pos=ENTRANCES[d.id] ?? {x:20+(i%3)*30,y:30+Math.floor(i/3)*30};
  const locked=!canEnterDungeon(playerLevel,d);
  const content=html`${spiral()}<span class="tm-label"><b>${d.name}</b><small>${d.id === "freight-yard" ? "Demo · " : ""}Lv ${d.level?.join('–')} · ${d.players.min}–${d.players.max} characters</small>${locked?html`<small>Player Lv ${dungeonUnlockLevel(d)} required</small>`:''}</span>`;
  return locked?html`<div class="tm-entrance is-locked" id="entrance-${d.id}" data-dungeon="${d.id}" style="left:${pos.x}%;top:${pos.y}%" aria-disabled="true">${content}</div>`:html`<a class="tm-entrance" id="entrance-${d.id}" data-dungeon="${d.id}" style="left:${pos.x}%;top:${pos.y}%" aria-label="Enter ${d.name}" href="/expeditions?dungeon=${d.id}#ex-call-h">${content}</a>`;
 })}</div></div><p class="tm-note">Choose an entrance to form or join a party. <span>Swipe the map ↔ on mobile.</span></p>`;
}
