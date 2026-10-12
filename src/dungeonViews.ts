import { html } from "hono/html";
import { DUNGEONS, type DungeonDef } from "./game/dungeons.ts";

export const dungeonMinutes = (d: DungeonDef) => Math.max(1, Math.ceil(d.rooms.reduce((sum, r) => sum + r.ms, 0) / 60_000));
export function dungeonCard(d: DungeonDef, selected?: string) {
  return html`<article class="dg-card${selected === d.id ? " is-selected" : ""}" id="dungeon-${d.id}" data-dungeon="${d.id}">
    <a class="dg-image" href="/expeditions?dungeon=${d.id}#ex-call-h"><img src="${d.art ?? "/static/img/world/supermarket.jpg"}" alt="${d.name}" width="960" height="640" loading="lazy"><span class="dg-badge">◆ Team · ${d.players.min}–${d.players.max}</span></a>
    <div class="dg-body"><h3>${d.name}</h3><p class="dg-meta">Recommended Lv ${d.level?.join("–") ?? "5–8"} · ~${dungeonMinutes(d)} min + combat</p><p class="dg-rewards">${(d.rewardSummary ?? ["Equipment", "Supplies"]).join(" · ")}</p><a class="button" href="/expeditions?dungeon=${d.id}#ex-call-h">${selected === d.id ? "Selected · Form party" : "Form a party"}</a></div>
  </article>`;
}
export const dungeonCards = (selected?: string) => html`<div class="dg-grid">${DUNGEONS.map(d => dungeonCard(d, selected))}</div>`;
