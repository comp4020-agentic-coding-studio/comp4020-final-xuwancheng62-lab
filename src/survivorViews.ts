import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { BEAST, CHARACTER, GEAR, RECOVERY, SLOTS, TIME_SCALE, XP, type ItemKind, type Slot } from "./game/config.ts";
import { capacity, damageRange, total, type Haul } from "./game/character.ts";
import type { Character } from "./character.ts";
import { ESCAPE_PCT, isOpen, type EncounterView, type TurnView } from "./encounter.ts";
import { portraitSrc } from "./public.ts";
import type { ShelterView } from "./shelter.ts";

// The survivor's panel on the Shelter page, and the fight on the Activity
// page. Every action is a plain form; the animations only replay a result
// the server has already recorded.

type H = HtmlEscapedString | Promise<HtmlEscapedString>;

const SLOT_LABEL: Record<Slot, string> = { weapon: "Weapon", armour: "Armour", tool: "Tool" };
export const DEFEAT_WARNING = "Defeat means losing all equipped gear and supplies collected on this trip.";
export const ESCAPE_WARNING = "Escape success preserves your gear and half your collected supplies. Failure locks you into combat.";

export const hpBar = (hp: number, max: number, label: string, cls = "") => {
  const pct = Math.max(0, Math.min(100, Math.round((hp / max) * 100)));
  return html`<div class="hp ${cls} ${pct <= 25 ? "is-low" : ""}">
  <span class="hp-label">${label}</span>
  <span class="hp-track" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${hp}"><span class="hp-fill" style="width:${pct}%"></span></span>
  <span class="hp-num">${hp}/${max}</span>
</div>`;
};

export const haulText = (h: Haul): string => {
  const parts = Object.entries(h).filter(([, n]) => (n ?? 0) > 0).map(([k, n]) => `${n} ${k[0].toUpperCase()}${k.slice(1)}`);
  return parts.length ? parts.join(", ") : "nothing yet";
};

export const gearLine = (c: Character): string =>
  SLOTS.map((s) => (c.gear[s] ? GEAR[c.gear[s]!].name : null)).filter(Boolean).join(" · ") || "No gear";

const effect = (k: ItemKind): string => {
  const g = GEAR[k];
  return g.damage ? `${g.damage[0]}–${g.damage[1]} damage + Strength` : g.armour ? `−${g.armour} damage taken per bite` : `+${g.capacity} carrying capacity`;
};

// What swapping an item in would change, so the trade-off is visible before you choose.
function tradeOff(c: Character, k: ItemKind): string {
  const g = GEAR[k];
  const now = c.gear[g.slot];
  const gear = { ...c.gear, [g.slot]: k };
  if (g.slot === "weapon") {
    const [lo, hi] = damageRange(c.strength, gear);
    return `Your hits would be ${lo}–${hi} (now ${c.damage[0]}–${c.damage[1]}).`;
  }
  if (g.slot === "tool") return `You'd carry ${capacity(c.strength, gear)} (now ${c.capacity}).`;
  return now ? `Replaces your ${GEAR[now].name.toLowerCase()}.` : "Each bite would hurt less.";
}

const minutes = (ms: number): string => {
  const m = Math.ceil(ms / 60_000);
  return m <= 1 ? "about a minute" : `about ${m} min`;
};

// A compact line under the shelter's name.
export const survivorChip = (c: Character) => html`<div class="sv-chip">
  ${hpBar(c.hp, c.maxHp, "HP", "hp-compact")}
  <a class="sv-chip-link" href="#survivor">Level ${c.level}${c.unspent ? html` · <strong>${c.unspent} point${c.unspent > 1 ? "s" : ""} to spend</strong>` : ""}</a>
</div>`;

export function survivorPanel(s: ShelterView, now: number, ctx: { message?: string; error?: string } = {}): H {
  const c = s.character;
  const home = !s.journey;
  const lock = home ? "" : raw("disabled");
  const restMs = ((c.maxHp - c.hp) * RECOVERY.msPerHp) / TIME_SCALE;
  const m = RECOVERY.meal;
  const mealWait = c.mealAt + m.cooldownMs - now;
  return html`<section class="sv-panel" id="survivor" aria-labelledby="sv-h">
  <div class="sv-panel-head">
    <img class="sv-panel-face" src="${portraitSrc(s.portrait)}" alt="" width="48" height="48">
    <div>
      <h2 id="sv-h">${s.owner}, level ${c.level}</h2>
      <p class="sv-xp">${c.xp} / ${c.toNext} XP to level ${c.level + 1} · trips give ${XP.trip.supermarket}–${XP.trip.nest}, beating the beast ${XP.won}</p>
    </div>
  </div>
  ${ctx.message ? html`<p class="sh-result tone-ok" role="status">${ctx.message}</p>` : ""}
  ${ctx.error ? html`<p class="sh-result tone-bad" role="alert">${ctx.error}</p>` : ""}
  ${hpBar(c.hp, c.maxHp, "Health")}
  <dl class="sv-stats">
    <div><dt>Strength</dt><dd>${c.strength}</dd><dd class="sv-stat-why">Hits ${c.damage[0]}–${c.damage[1]} · carries ${c.capacity}</dd></div>
    <div><dt>Agility</dt><dd>${c.agility}</dd><dd class="sv-stat-why">Explores ${Math.round((1 - 1 / (1 + 0.05 * c.agility)) * 100)}% faster (travel unchanged)</dd></div>
    <div><dt>Armour</dt><dd>${c.armour}</dd><dd class="sv-stat-why">Taken off each bite</dd></div>
  </dl>

  <div class="sv-recover">
    <h3>Recovery</h3>
    ${c.hp >= c.maxHp
      ? html`<p>You're at full health.</p>`
      : home
        ? html`<p>Resting: 1 HP every ${Math.round(RECOVERY.msPerHp / TIME_SCALE / 1000)} s, full in ${minutes(restMs)}.${c.hp < CHARACTER.travelMinHp ? html` <strong>You need ${CHARACTER.travelMinHp} HP to travel.</strong>` : ""}</p>`
        : html`<p>You recover only while you're home.</p>`}
    ${home && c.hp < c.maxHp
      ? html`<form method="post" action="/character/meal" class="sv-inline">
      <button ${mealWait > 0 || s.stock.food < m.food || s.stock.water < m.water ? raw("disabled") : ""}>Eat a meal: +${m.hp} HP</button>
      <span class="sv-note">Costs ${m.food} Food and ${m.water} Water${mealWait > 0 ? `; you can eat again in ${minutes(mealWait)}` : `; once every ${m.cooldownMs / 60_000} min`}.</span>
    </form>`
      : ""}
  </div>

  ${c.unspent > 0
    ? html`<div class="sv-train">
    <h3>${c.unspent} point${c.unspent > 1 ? "s" : ""} to spend</h3>
    <div class="sv-train-opts">
      ${(
        [
          ["strength", `+${CHARACTER.train.strength} Strength`, "Harder hits, and carry more"],
          ["agility", `+${CHARACTER.train.agility} Agility`, "Shorter exploring on every trip"],
          ["maxHp", `+${CHARACTER.train.maxHp} max HP`, "Last longer in a fight"],
        ] as const
      ).map(
        ([stat, label, why]) => html`<form method="post" action="/character/train"><input type="hidden" name="stat" value="${stat}"><button ${lock}>${label}</button><span class="sv-note">${why}</span></form>`,
      )}
    </div>
  </div>`
    : ""}

  <div class="sv-gear">
    <h3>Equipped <span class="sv-note">carried on every trip</span></h3>
    ${home ? "" : html`<p class="sv-note">Gear can only change at the shelter, between trips.</p>`}
    <ul class="sv-slots">
      ${SLOTS.map((slot) => {
        const k = c.gear[slot];
        return html`<li class="sv-slot ${k ? "" : "is-empty"}">
        <span class="sv-slot-name">${SLOT_LABEL[slot]}</span>
        ${k
          ? html`<span class="sv-item"><b>${GEAR[k].name}</b><small>${effect(k)}</small></span>
          <form method="post" action="/gear/unequip"><input type="hidden" name="slot" value="${slot}"><button class="sv-small" ${lock}>Put away</button></form>`
          : html`<span class="sv-item"><b>Empty</b><small>${slot === "weapon" ? "Bare hands: 2–5 + Strength" : "—"}</small></span>`}
      </li>`;
      })}
    </ul>
    <h3>In storage <span class="sv-note">kept safe at the shelter, even if you're defeated</span></h3>
    ${c.stored.length
      ? html`<ul class="sv-stored">
      ${c.stored.map(
        (k) => html`<li><span class="sv-item"><b>${GEAR[k].name}</b><small>${GEAR[k].note} ${effect(k)}. ${tradeOff(c, k)}</small></span>
        <form method="post" action="/gear/equip"><input type="hidden" name="item" value="${k}"><button class="sv-small" ${lock}>Equip</button></form></li>`,
      )}
    </ul>`
      : html`<p class="sv-note">Nothing stored. The Ruined Workshop turns up basic gear you're missing; beating the beast at the Nest wins better.</p>`}
  </div>
</section>`;
}

// ---- the fight

const turnText = (t: TurnView): string =>
  t.action === "escape"
    ? t.escaped
      ? "You ran for it, and got away."
      : "You ran for it, but it cut you off. No escaping now."
    : t.outcome === "won"
      ? `You hit for ${t.playerHit}. The beast goes down.`
      : t.outcome === "defeated"
        ? `You hit for ${t.playerHit}. It bites for ${t.beastBite}, and you go down.`
        : `You hit for ${t.playerHit}. It bites back for ${t.beastBite}.`;

// The last turn, as the animation to play: only right after it happened.
const lastMove = (e: EncounterView, fresh: boolean): string => {
  const t = e.log.at(-1);
  if (!t || !fresh) return "";
  if (t.action === "escape") return t.escaped ? "fx-fled" : "fx-caught";
  return t.outcome === "won" ? "fx-won" : t.outcome === "defeated" ? "fx-down" : "fx-trade";
};

export function warningSigns(): H {
  return html`<p class="fight-sign" role="note"><strong>Signs of danger:</strong> fresh claw marks, gnawed bones, and a smell like wet scrap. Something big hoards here, and it's close.</p>`;
}

export function fightCard(s: ShelterView, e: EncounterView, ids: { attack: string; escape: string }, fresh: boolean, error?: string): H {
  const c = s.character;
  const t = e.log.at(-1);
  const carrying = total(e.carried);
  return html`<section class="card fight ${lastMove(e, fresh)}" id="fight" aria-labelledby="fight-h">
  <h2 id="fight-h">${e.state === "awaiting" ? `A ${BEAST.name.toLowerCase()} blocks your way` : `Fighting the ${BEAST.name.toLowerCase()}`}</h2>
  ${error ? html`<p class="banner danger" role="alert">${error}</p>` : ""}
  <div class="fight-sides">
    <figure class="fight-side is-you">
      <img class="fight-you" src="${portraitSrc(s.portrait)}" alt="" width="72" height="72">
      <figcaption><b>${s.owner}</b>${hpBar(c.hp, c.maxHp, "Your health")}<small>${gearLine(c)} · hits ${c.damage[0]}–${c.damage[1]}${c.armour ? ` · armour ${c.armour}` : ""}</small></figcaption>
    </figure>
    <figure class="fight-side is-beast">
      <img class="fight-beast" src="/static/img/shelter/beast.webp" alt="A hunched, mangy scavenger beast with scrap tangled in its fur" width="240" height="149">
      <figcaption><b>${BEAST.name}</b>${hpBar(e.beastHp, e.beastMaxHp, "Its health", "hp-beast")}<small>Bites for ${BEAST.bite[0]}–${BEAST.bite[1]}</small></figcaption>
    </figure>
  </div>
  ${t ? html`<p class="fight-last" role="status">${turnText(t)}</p>` : html`<p class="fight-last" role="status">It hasn't moved yet. It won't, until you do.</p>`}
  <div class="fight-stakes">
    <p><strong>At stake:</strong> you're carrying ${haulText(e.carried)}${carrying ? "" : ""}, and your equipped gear. ${DEFEAT_WARNING}</p>
    <p>Win, and its hoard is yours too, with +${XP.won} XP.</p>
  </div>
  <div class="fight-actions">
    <form method="post" action="/encounter/attack">
      <input type="hidden" name="request_id" value="${ids.attack}">
      <input type="hidden" name="turn" value="${e.turns}">
      <button class="fight-go">Attack <small>hit for ${c.damage[0]}–${c.damage[1]}</small></button>
    </form>
    ${e.escapeUsed
      ? html`<p class="fight-locked">You already tried to run. Escape is locked: this ends in a win or a defeat.</p>`
      : html`<form method="post" action="/encounter/escape" class="fight-escape">
      <input type="hidden" name="request_id" value="${ids.escape}">
      <p><strong>Escape: ${ESCAPE_PCT}% chance, one try.</strong> ${ESCAPE_WARNING}</p>
      <button class="fight-run">Try to escape (${ESCAPE_PCT}%)</button>
    </form>`}
  </div>
  ${e.log.length ? html`<ol class="fight-log">${e.log.map((x) => html`<li>${turnText(x)}</li>`)}</ol>` : ""}
</section>`;
}

// After the fight, on the walk home: what happened and what you're carrying.
export function aftermath(e: EncounterView, fresh: boolean): H {
  if (isOpen(e.state)) return html``;
  const [title, text] =
    e.state === "won"
      ? ["You beat the beast", `Carrying home ${haulText(e.carried)}. Anything new from its hoard is waiting in storage.`]
      : e.state === "escaped"
        ? ["You got away", `Your gear is safe. Carrying home ${haulText(e.carried)}, half of what you'd found.`]
        : ["Defeated", "You lost your equipped gear and everything you'd found. Wounded, you're walking home; rest when you get there."];
  return html`<section class="card fight fight-after is-${e.state} ${lastMove(e, fresh)}" id="fight" aria-labelledby="fight-h">
  <h2 id="fight-h">${title}</h2>
  <p>${text} Supplies reach the shelter when you do.</p>
  ${e.log.length ? html`<ol class="fight-log">${e.log.map((x) => html`<li>${turnText(x)}</li>`)}</ol>` : ""}
</section>`;
}

// On the World page, before you leave for the Nest.
export function nestWarning(c: Character): H {
  return html`<div class="nest-warn" role="note">
  <p><strong>A ${BEAST.name.toLowerCase()} guards this place.</strong> You'll meet it halfway through exploring: fight it (${BEAST.hp} HP, bites ${BEAST.bite[0]}–${BEAST.bite[1]}), or try once to escape (${ESCAPE_PCT}%).</p>
  <p class="nest-warn-stakes">${DEFEAT_WARNING}</p>
  <p class="nest-warn-you">You: ${c.hp}/${c.maxHp} HP · ${gearLine(c)} · hits ${c.damage[0]}–${c.damage[1]}${c.armour ? ` · armour ${c.armour}` : ""}</p>
</div>`;
}
