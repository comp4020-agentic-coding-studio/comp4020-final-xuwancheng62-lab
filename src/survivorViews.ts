import { itemIcon } from './itemIcons.ts';
import { escapeChance as autoEscapeChance, memberFighter } from './game/combat.ts';
import { soloEscapeBonus } from './game/solo.ts';
import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { BEAST, CHARACTER, RECOVERY, RESIDENTS, SLOTS, SUPPLIES, TIME_SCALE, XP, type ResidentId, type Slot, type SupplyKind } from "./game/config.ts";
import { total, type Haul } from "./game/character.ts";
import { nameOfGear } from "./game/items.ts";
import { carried, itemCard } from "./itemViews.ts";
import { wordsFor, type Character } from "./character.ts";
import { escapePct, isOpen, type EncounterView, type TurnView } from "./encounter.ts";
import { portraitSrc } from "./public.ts";
import type { Member, ShelterView } from "./shelter.ts";

// The survivor's panel on the Shelter page, and the fight on the Activity
// page. Every action is a plain form; the animations only replay a result
// the server has already recorded.

type H = HtmlEscapedString | Promise<HtmlEscapedString>;

const SLOT_LABEL: Record<Slot, string> = { weapon: "Weapon", armour: "Armour", tool: "Tool" };
export const DEFEAT_WARNING = "Defeat means losing everything carried: equipped gear, belt and pack, and supplies collected on this trip.";
export const escapeWarning = (their = "your", them = "you") =>
  `Escape success preserves ${their} gear and half ${their} collected supplies. Failure locks ${them} into combat.`;
export const ESCAPE_WARNING = escapeWarning();
const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

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
  SLOTS.map((s) => (c.gear[s] ? nameOfGear(c.gear[s]!) : null)).filter(Boolean).join(" · ") || "No gear";

const minutes = (ms: number): string => {
  const m = Math.ceil(ms / 60_000);
  return m <= 1 ? "about a minute" : `about ${m} min`;
};

// A compact line under the shelter's name.
export const survivorChip = (c: Character) => html`<div class="sv-chip">
  ${hpBar(c.hp, c.maxHp, "HP", "hp-compact")}
  <a class="sv-chip-link" href="#survivor">Level ${c.level}${c.unspent ? html` · <strong>${c.unspent} point${c.unspent > 1 ? "s" : ""} to spend</strong>` : ""}</a>
</div>`;

// A face for someone: your portrait, or the resident's own
// (static/img/survivors/<who>.jpg, cut from their painted figure).
export const faceOf = (s: ShelterView, m: Member, size: number, cls = "sv-panel-face"): H =>
  html`<img class="${cls}" src="${m.who === "you" ? portraitSrc(s.portrait) : `/static/img/survivors/${m.who}.jpg`}" alt="" width="${size}" height="${size}">`;

// Everyone who lives here, each with their own health, points, gear and
// what they're doing. Every form names who it's for.
export function survivorPanel(s: ShelterView, now: number, ctx: { message?: string; error?: string } = {}): H {
  return html`<section class="sv-panel" id="survivor" aria-labelledby="sv-h">
  <h2 id="sv-h" class="sv-people-h">${s.crew.length > 1 ? "Your people" : "Your survivor"}</h2>
  ${ctx.message ? html`<p class="sh-result tone-ok" role="status">${ctx.message}</p>` : ""}
  ${ctx.error ? html`<p class="sh-result tone-bad" role="alert">${ctx.error}</p>` : ""}
  ${s.reinforcement ? html`<aside class="card"><h3>Visiting defender</h3><p>${s.reinforcement.name} · from ${s.reinforcement.owner}</p><form method="post" action="/reinforcements/${s.reinforcement.characterId}/end"><button>Dismiss reinforcement</button></form></aside>` : ''}
  <div class="sv-people-grid">${s.crew.map((m) => personCard(s, m, now, Boolean(ctx.message || ctx.error)))}</div>
</section>`;
}

function personCard(s: ShelterView, p: Member, now: number, expanded = false): H {
  const c = p.character;
  const you = p.who === "you";
  const home = !p.journey;
  const lock = home ? "" : raw("disabled");
  const restMs = ((c.maxHp - c.hp) * RECOVERY.msPerHp) / TIME_SCALE;
  const m = RECOVERY.meal;
  const mealWait = c.mealAt + m.cooldownMs - now;
  const who = html`<input type="hidden" name="who" value="${p.who}">`;
  const r = you ? undefined : RESIDENTS[p.who as ResidentId];
  return html`<article class="sv-person${home ? "" : " is-out"}" id="person-${p.who}" data-who="${p.who}">
  <div class="sv-panel-head">
    ${faceOf(s, p, 48)}
    <div>
      <h3 class="sv-name">${you ? s.owner : p.name}, level ${c.level}</h3>
      <p class="sv-state">${p.party?.mustering ? "Preparing expedition" : !home ? `${p.journey!.label} · ${p.journey!.destinationName}` : you ? "Home" : "Home · working and keeping guard"}</p>
    </div>
  </div>
  ${p.journey?.reinforcement ? html`<form method="post" action="/reinforcements/${p.id}/end"><button>Recall reinforcement</button></form>` : ''}
  ${hpBar(c.hp, c.maxHp, "Health")}
  <div class="sv-loadout-preview" aria-label="Equipped items">
    ${SLOTS.map(slot => c.gear[slot] ? html`<span title="${SLOT_LABEL[slot]}: ${nameOfGear(c.gear[slot]!)}">${itemIcon(c.gear[slot]!.kind)}<span>${nameOfGear(c.gear[slot]!)}</span></span>` : '')}
    ${SLOTS.every(slot=>!c.gear[slot]) ? html`<span class="sv-note">No equipment</span>` : ''}
  </div>
  ${c.hp < c.maxHp ? html`  <div class="sv-recover">
    ${home
        ? html`<p>Resting · full in ${minutes(restMs)}.${c.hp < CHARACTER.travelMinHp ? html` <strong>${CHARACTER.travelMinHp} HP to travel.</strong>` : ""}</p>`
        : html`<p>Recovers only at home.</p>`}
    ${home && c.hp < c.maxHp
      ? html`<form method="post" action="/character/meal" class="sv-inline">${who}
      <button ${mealWait > 0 || s.stock.food < m.food || s.stock.water < m.water ? raw("disabled") : ""}>Meal +${m.hp} HP</button>
      <span class="sv-note">${m.food} Food · ${m.water} Water${mealWait > 0 ? `; again in ${minutes(mealWait)}` : ``}.</span>
    </form>`
      : ""}
  </div>
` : ''}
  <details class="sv-details" ${expanded ? raw('open') : ''}>
    <summary><span>Attributes &amp; equipment</span>${c.unspent ? html`<span class="sv-points">+${c.unspent} point${c.unspent===1?'':'s'}</span>` : ''}</summary>
    <div class="sv-details-body">
    <p class="sv-xp">${c.xp} / ${c.toNext} XP · combat ${c.combat}</p>
  <dl class="sv-stats">
    <div><dt>Strength</dt><dd>${c.strength}</dd><dd class="sv-stat-why">Hits ${c.damage[0]}–${c.damage[1]} · carries ${c.capacity} · +${CHARACTER.hpPerStrength * c.strength} HP</dd></div>
    <div><dt>Agility</dt><dd>${c.agility}</dd><dd class="sv-stat-why">Explores ${Math.round((1 - 1 / (1 + 0.05 * c.agility)) * 100)}% faster (travel unchanged)</dd></div>
    <div><dt>Constitution</dt><dd>${c.constitution}</dd><dd class="sv-stat-why">+${CHARACTER.hpPerConstitution * c.constitution} max HP</dd></div>
    <div><dt>Armour</dt><dd>${c.armour}</dd><dd class="sv-stat-why">Damage reduction</dd></div>
  </dl>
    ${r ? html`<p class="sv-note">${r.work}: +${r.purifierWater} Water/h while working. Uses ${r.food} Food/h. Familiar with the Nest's dogs.</p>` : ''}

  ${c.unspent > 0
    ? html`<div class="sv-train">
    <h4>${c.unspent} point${c.unspent > 1 ? "s" : ""} to spend</h4>
    <div class="sv-train-opts">
      ${(
        [
          ["strength", `+${CHARACTER.train.strength} Strength`, `Harder hits, carry more, +${CHARACTER.hpPerStrength * CHARACTER.train.strength} max HP`],
          ["agility", `+${CHARACTER.train.agility} Agility`, "Shorter exploring on every trip"],
          ["constitution", `+${CHARACTER.train.constitution} Constitution`, `+${CHARACTER.hpPerConstitution * CHARACTER.train.constitution} max HP`],
        ] as const
      ).map(
        ([stat, label, why]) => html`<form method="post" action="/character/train">${who}<input type="hidden" name="stat" value="${stat}"><button ${lock}>${label}</button><span class="sv-note">${why}</span></form>`,
      )}
    </div>
  </div>`
    : ""}

  <div class="sv-gear">
    <h4>Equipment</h4>
    ${home ? "" : html`<p class="sv-note">Gear can only change at the shelter, between trips.</p>`}
    <ul class="sv-slots">
      ${SLOTS.map((slot) => {
        const g = c.gear[slot];
        return html`<li class="sv-slot ${g ? "" : "is-empty"}">
        <span class="sv-slot-name">${SLOT_LABEL[slot]}</span>
        ${g
          ? html`${itemCard(g, { compact: true })}
          <form method="post" action="/gear/unequip">${who}<input type="hidden" name="slot" value="${slot}"><button class="sv-small" ${lock}>Put away</button></form>`
          : html`<span class="sv-item"><b>Empty</b><small>${slot === "weapon" ? "Bare hands: 2–5 + Strength" : "Equip one from the stash."}</small></span>`}
      </li>`;
      })}
    </ul>
    ${carried(p, !home)}
  </div>
  </div></details>
</article>`;
}

// ---- the fight

const turnText = (t: TurnView, name = "You"): string => {
  const them = name === "You" ? "you" : name;
  const bite = t.beastBite ? ` It bites back for ${t.beastBite}.` : " It doesn't get a bite in.";
  const down = (lead: string) => `${lead} It bites for ${t.beastBite}, and ${them} ${name === "You" ? "go" : "goes"} down.`;
  if (t.action === "escape") return t.escaped ? `${name} ran for it, and got away.` : `${name} ran for it, but it cut ${them} off. No escaping now.`;
  if (t.action === "use") {
    const item = t.item ? SUPPLIES[t.item].name.toLowerCase() : "something";
    const lead =
      t.item === "molotov" ? `${name} threw a Molotov: ${t.playerHit} burn.` : t.item === "smoke" ? `${name} lit a smoke canister: easier to slip away now.` : t.item === "flare" ? `${name} lit a flare. It shies from the light.` : `${name} used ${item}.`;
    return t.outcome === "won" ? `${lead} The beast goes down.` : t.outcome === "defeated" ? down(lead) : `${lead}${bite}`;
  }
  return t.outcome === "won" ? `${name} hit for ${t.playerHit}. The beast goes down.` : t.outcome === "defeated" ? down(`${name} hit for ${t.playerHit}.`) : `${name} hit for ${t.playerHit}.${bite}`;
};
const fightId = (m: Member) => (m.who === "you" ? "fight" : `fight-${m.who}`);

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

export function fightCard(s: ShelterView, m: Member, e: EncounterView, ids: { attack: string; escape: string; use?: string }, fresh: boolean, error?: string): H {
  const c = m.character;
  const you = m.who === "you";
  const name = you ? "You" : m.name;
  const t = e.log.at(-1);
  const carrying = total(e.carried);
  const pct = escapePct(m, e.escapeBonus);
  const belt = (Object.entries(c.belt) as [SupplyKind, number][]).filter(([k, n]) => n > 0 && !(k === "smoke" && e.escapeUsed));
  const who = html`<input type="hidden" name="who" value="${m.who}">`;
  return html`<section class="card fight ${lastMove(e, fresh)}" id="${fightId(m)}" aria-labelledby="${fightId(m)}-h">
  <h2 id="${fightId(m)}-h">${e.state === "awaiting" ? `A ${BEAST.name.toLowerCase()} blocks ${you ? "your" : `${m.name}'s`} way` : `${you ? "Fighting" : `${m.name} is fighting`} the ${BEAST.name.toLowerCase()}`}</h2>
  ${error ? html`<p class="banner danger" role="alert">${error}</p>` : ""}
  <div class="fight-sides">
    <figure class="fight-side is-you">
      ${faceOf(s, m, 72, "fight-you")}
      <figcaption><b>${you ? s.owner : m.name}</b>${hpBar(c.hp, c.maxHp, you ? "Your health" : `${m.name}'s health`)}<small>${gearLine(c)} · hits ${c.damage[0]}–${c.damage[1]}${c.armour ? ` · armour ${c.armour}` : ""}</small></figcaption>
    </figure>
    <figure class="fight-side is-beast">
      <img class="fight-beast" src="/static/img/shelter/beast.webp" alt="A hunched, mangy scavenger beast with scrap tangled in its fur" width="240" height="149">
      <figcaption><b>${BEAST.name}</b>${hpBar(e.beastHp, e.beastMaxHp, "Its health", "hp-beast")}<small>Bites for ${BEAST.bite[0]}–${BEAST.bite[1]}</small></figcaption>
    </figure>
  </div>
  ${t ? html`<p class="fight-last" role="status">${turnText(t, name)}</p>` : html`<p class="fight-last" role="status">It hasn't moved yet. It won't, until ${you ? "you do" : `${m.name} does`}.</p>`}
  <div class="fight-stakes">
    <p><strong>At stake:</strong> ${you ? "you're" : `${m.name}'s`} carrying ${haulText(e.carried)}${carrying ? "" : ""}, and ${wordsFor(m.who).their} equipped gear. ${DEFEAT_WARNING}</p>
    <p>Win, and its hoard is yours too, with +${XP.won} XP.</p>
  </div>
  <div class="fight-actions">
    <form method="post" action="/encounter/attack">${who}
      <input type="hidden" name="request_id" value="${ids.attack}">
      <input type="hidden" name="turn" value="${e.turns}">
      <button class="fight-go">Attack <small>hit for ${c.damage[0]}–${c.damage[1]}${c.ammo ? (c.clubbing ? " · out of ammo, clubbing" : ` · ${c.pack[c.ammo] ?? 0} ${SUPPLIES[c.ammo].name.toLowerCase()} left`) : ""}</small></button>
    </form>
    ${belt.length && ids.use
      ? html`<div class="fight-belt"><p class="sv-note"><strong>Belt:</strong> using something takes the turn.</p>${belt.map(
          ([k, n]) => html`<form method="post" action="/encounter/use">${who}
      <input type="hidden" name="request_id" value="${ids.use}">
      <input type="hidden" name="turn" value="${e.turns}">
      <input type="hidden" name="item" value="${k}">
      <button class="sv-small">${SUPPLIES[k].name} ×${n} <small>${SUPPLIES[k].note}</small></button>
    </form>`,
        )}</div>`
      : ""}
    ${e.escapeUsed
      ? html`<p class="fight-locked">${name} already tried to run. Escape is locked: this ends in a win or a defeat.</p>`
      : html`<form method="post" action="/encounter/escape" class="fight-escape">${who}
      <input type="hidden" name="request_id" value="${ids.escape}">
      <p><strong>Escape: ${pct}% chance, one try.</strong> ${escapeWarning(wordsFor(m.who).their, wordsFor(m.who).them)}</p>
      <button class="fight-run">Try to escape (${pct}%)</button>
    </form>`}
  </div>
  ${e.log.length ? html`<ol class="fight-log">${e.log.map((x) => html`<li>${turnText(x, name)}</li>`)}</ol>` : ""}
</section>`;
}

// After the fight, on the walk home: what happened and what you're carrying.
export function aftermath(s: ShelterView, m: Member, e: EncounterView, fresh: boolean): H {
  if (isOpen(e.state)) return html``;
  const you = m.who === "you";
  const name = you ? "You" : m.name;
  const w = wordsFor(m.who);
  const [title, text] =
    e.state === "won"
      ? [`${name} beat the beast`, `Carrying home ${haulText(e.carried)}. Anything new from its hoard is waiting in storage.`]
      : e.state === "escaped"
        ? [`${name} got away`, `${cap(w.their)} gear is safe. Carrying home ${haulText(e.carried)}, half of what ${w.had} found.`]
        : [you ? "Defeated" : `${m.name} was defeated`, `${cap(w.they)} lost the equipped gear and everything found. Wounded and walking home; rest when ${w.gets} there.`];
  return html`<section class="card fight fight-after is-${e.state} ${lastMove(e, fresh)}" id="${fightId(m)}" aria-labelledby="${fightId(m)}-h">
  <h2 id="${fightId(m)}-h">${title}</h2>
  <div class="fight-sides is-after">
    ${faceOf(s, m, 56, "fight-you")}
    <img class="fight-beast" src="/static/img/shelter/beast.webp" alt="" width="160" height="99">
  </div>
  <p>${text} Supplies reach the shelter when ${w.does}.</p>
  ${e.log.length ? html`<ol class="fight-log">${e.log.map((x) => html`<li>${turnText(x, name)}</li>`)}</ol>` : ""}
</section>`;
}

// On the World page, before you leave for the Nest.
export function nestWarning(people: readonly Member[]): H {
  return html`<div class="nest-warn" role="note">
  <p><strong>A ${BEAST.name.toLowerCase()} guards this place.</strong> Whoever goes meets it halfway through exploring: automatic combat (${BEAST.hp} HP, bites ${BEAST.bite[0]}–${BEAST.bite[1]}). Below 30% HP, use available healing and attempt escape once; failure forces the fight to continue.</p>
  <p class="nest-warn-stakes">${DEFEAT_WARNING}</p>
  ${people.map((m) => {
    const c = m.character;
    const escape = autoEscapeChance([memberFighter({key:`c${m.id}`,name:m.name,who:m.who,hp:c.hp,body:c.base,gear:c.gear,belt:c.belt,pack:c.pack,row:'front'})],0,false,soloEscapeBonus(m.who,true));
    return html`<p class="nest-warn-you">${m.who === "you" ? "You" : m.name}: ${c.hp}/${c.maxHp} HP · ${gearLine(c)} · hits ${c.damage[0]}–${c.damage[1]}${c.armour ? ` · armour ${c.armour}` : ""} · escape ${escape}% before noise/smoke</p>`;
  })}
</div>`;
}
