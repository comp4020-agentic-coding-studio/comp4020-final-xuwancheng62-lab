import { html } from "hono/html";
import { BESTIARY, enemyStats, type BestiaryId } from "./game/bestiary.ts";

export function bestiaryPage(known: readonly BestiaryId[]) {
  return html`<nav class="collection-tabs" aria-label="Collection type"><a href="/collection">Stories</a><a href="/collection/enemies" aria-current="page">Enemies</a></nav>
  <h1>Wasteland field guide</h1><p class="sv-note">${known.length} / ${BESTIARY.length} discovered · One enemy, one card. Encounter it to keep its card, even if you retreat.</p>
  <div class="be-grid">${BESTIARY.map((e, i) => known.includes(e.id) ? html`<details class="be-card" data-enemy="${e.id}"><summary><img src="/static/img/enemies/${e.id}.webp" alt="${e.name} in its habitat" width="768" height="512" loading="lazy"><span><b>${e.name}</b><small>${e.habitat}</small><span class="be-hint">View field notes ↓</span></span></summary><div class="be-notes"><p class="be-stats">${enemyStats(e.id).hp} HP · ${enemyStats(e.id).armour} armour · ${enemyStats(e.id).hit[0]}–${enemyStats(e.id).hit[1]} base damage</p><h3>Behaviour</h3><p>${e.habit}</p><h3>How to handle it</h3><p>${e.counter}</p><h3>Background</h3><p>${e.background}</p></div></details>` : html`<article class="be-card is-unknown"><div class="be-back" aria-label="Undiscovered enemy card ${i + 1}"><span>?</span></div><h2>Unknown encounter</h2><p>Discover it while exploring.</p></article>`)}</div>`;
}
