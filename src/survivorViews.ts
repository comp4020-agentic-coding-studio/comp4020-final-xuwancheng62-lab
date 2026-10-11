import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { BEAST, CHARACTER, GEAR, RECOVERY, RESIDENTS, SLOTS, TIME_SCALE, XP, type ItemKind, type ResidentId, type Slot } from "./game/config.ts";
import { capacity, damageRange, total, type Haul } from "./game/character.ts";
import { wordsFor, type Character } from "./character.ts";
import { escapePct, isOpen, type EncounterView, type TurnView } from "./encounter.ts";
import { portraitSrc } from "./public.ts";
import type { Member, ShelterView } from "./shelter.ts";

// The survivor's panel on the Shelter page, and the fight on the Activity
// page. Every action is a plain form; the animations only replay a result
// the server has already recorded.

type H = HtmlEscapedString | Promise<HtmlEscapedString>;

const SLOT_LABEL: Record<Slot, string> = { weapon: "Weapon", armour: "Armour", tool: "Tool" };
export const DEFEAT_WARNING = "Defeat means losing all equipped gear and supplies collected on this trip.";
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

// A face for someone: your portrait, or a resident's initial in their colour.
export const faceOf = (s: ShelterView, m: Member, size: number, cls = "sv-panel-face"): H =>
  m.who === "you"
    ? html`<img class="${cls}" src="${portraitSrc(s.portrait)}" alt="" width="${size}" height="${size}">`
    : html`<span class="${cls} sv-initial sv-initial--${m.who}" style="width:${size}px;height:${size}px" aria-hidden="true">${m.name[0]}</span>`;

// Everyone who lives here, each with their own health, points, gear and
// what they're doing. Every form names who it's for.
export function survivorPanel(s: ShelterView, now: number, ctx: { message?: string; error?: string } = {}): H {
  return html`<section class="sv-panel" id="survivor" aria-labelledby="sv-h">
  <h2 id="sv-h" class="sv-people-h">${s.crew.length > 1 ? "Your people" : "Your survivor"}</h2>
  ${ctx.message ? html`<p class="sh-result tone-ok" role="status">${ctx.message}</p>` : ""}
  ${ctx.error ? html`<p class="sh-result tone-bad" role="alert">${ctx.error}</p>` : ""}
  ${s.crew.map((m) => personCard(s, m, now))}
</section>`;
}

function personCard(s: ShelterView, p: Member, now: number): H {
  const c = p.character;
  const you = p.who === "you";
  const home = !p.journey;
  const lock = home ? "" : raw("disabled");
  const restMs = ((c.maxHp - c.hp) * RECOVERY.msPerHp) / TIME_SCALE;
  const m = RECOVERY.meal;
  const mealWait = c.mealAt + m.cooldownMs - now;
  const who = html`<input type="hidden" name="who" value="${p.who}">`;
  const others = s.crew.filter((o) => o.id !== p.id && !o.journey);
  const r = you ? undefined : RESIDENTS[p.who as ResidentId];
  return html`<article class="sv-person${home ? "" : " is-out"}" id="person-${p.who}" data-who="${p.who}">
  <div class="sv-panel-head">
    ${faceOf(s, p, 48)}
    <div>
      <h3 class="sv-name">${you ? s.owner : p.name}, level ${c.level}</h3>
      <p class="sv-xp">${home ? (you ? "Home" : p.task === "work" ? `Home, on work: ${r!.work.toLowerCase()}` : "Home, keeping guard") : `Out: ${p.journey!.label.toLowerCase()} at the ${p.journey!.destinationName}`} · ${c.xp} / ${c.toNext} XP to level ${c.level + 1} · combat ${c.combat}</p>
    </div>
  </div>
  ${hpBar(c.hp, c.maxHp, "Health")}
  <dl class="sv-stats">
    <div><dt>Strength</dt><dd>${c.strength}</dd><dd class="sv-stat-why">Hits ${c.damage[0]}–${c.damage[1]} · carries ${c.capacity}</dd></div>
    <div><dt>Agility</dt><dd>${c.agility}</dd><dd class="sv-stat-why">Explores ${Math.round((1 - 1 / (1 + 0.05 * c.agility)) * 100)}% faster (travel unchanged)</dd></div>
    <div><dt>Armour</dt><dd>${c.armour}</dd><dd class="sv-stat-why">Taken off each bite</dd></div>
  </dl>
  ${r
    ? html`<div class="sv-task">
    <p class="sv-note"><strong>${p.name}'s knack:</strong> on work, ${r.work.toLowerCase()} (+${r.purifierWater} Water/h while the purifier runs); on guard, counts fully toward defence. Eats ${r.food} Food/h either way. The Nest's dogs know him: ${Math.round(r.escape * 100)}% to get away.</p>
    <form method="post" action="/crew/task" class="sv-inline">${who}
      <button name="task" value="guard" ${p.task === "guard" ? raw('aria-pressed="true" disabled') : raw('aria-pressed="false"')}>${p.task === "guard" ? "✓ " : ""}Keep guard</button>
      <button name="task" value="work" ${p.task === "work" ? raw('aria-pressed="true" disabled') : raw('aria-pressed="false"')}>${p.task === "work" ? "✓ " : ""}Work</button>
    </form>
  </div>`
    : ""}

  <div class="sv-recover">
    <h4>Recovery</h4>
    ${c.hp >= c.maxHp
      ? html`<p>${you ? "You're" : `${p.name}'s`} at full health.</p>`
      : home
        ? html`<p>Resting: 1 HP every ${Math.round(RECOVERY.msPerHp / TIME_SCALE / 1000)} s, full in ${minutes(restMs)}.${c.hp < CHARACTER.travelMinHp ? html` <strong>${CHARACTER.travelMinHp} HP to travel.</strong>` : ""}</p>`
        : html`<p>Recovers only at home.</p>`}
    ${home && c.hp < c.maxHp
      ? html`<form method="post" action="/character/meal" class="sv-inline">${who}
      <button ${mealWait > 0 || s.stock.food < m.food || s.stock.water < m.water ? raw("disabled") : ""}>Eat a meal: +${m.hp} HP</button>
      <span class="sv-note">Costs ${m.food} Food and ${m.water} Water${mealWait > 0 ? `; again in ${minutes(mealWait)}` : `; once every ${m.cooldownMs / 60_000} min`}.</span>
    </form>`
      : ""}
  </div>

  ${c.unspent > 0
    ? html`<div class="sv-train">
    <h4>${c.unspent} point${c.unspent > 1 ? "s" : ""} to spend</h4>
    <div class="sv-train-opts">
      ${(
        [
          ["strength", `+${CHARACTER.train.strength} Strength`, "Harder hits, and carry more"],
          ["agility", `+${CHARACTER.train.agility} Agility`, "Shorter exploring on every trip"],
          ["maxHp", `+${CHARACTER.train.maxHp} max HP`, "Last longer in a fight"],
        ] as const
      ).map(
        ([stat, label, why]) => html`<form method="post" action="/character/train">${who}<input type="hidden" name="stat" value="${stat}"><button ${lock}>${label}</button><span class="sv-note">${why}</span></form>`,
      )}
    </div>
  </div>`
    : ""}

  <div class="sv-gear">
    <h4>Equipped <span class="sv-note">carried on every trip</span></h4>
    ${home ? "" : html`<p class="sv-note">Gear can only change at the shelter, between trips.</p>`}
    <ul class="sv-slots">
      ${SLOTS.map((slot) => {
        const k = c.gear[slot];
        return html`<li class="sv-slot ${k ? "" : "is-empty"}">
        <span class="sv-slot-name">${SLOT_LABEL[slot]}</span>
        ${k
          ? html`<span class="sv-item"><b>${GEAR[k].name}</b><small>${effect(k)}</small></span>
          <form method="post" action="/gear/unequip">${who}<input type="hidden" name="slot" value="${slot}"><button class="sv-small" ${lock}>Put away</button></form>`
          : html`<span class="sv-item"><b>Empty</b><small>${slot === "weapon" ? "Bare hands: 2–5 + Strength" : "—"}</small></span>`}
      </li>`;
      })}
    </ul>
    <h4>In storage <span class="sv-note">kept safe at the shelter, even after a defeat</span></h4>
    ${c.stored.length
      ? html`<ul class="sv-stored">
      ${c.stored.map(
        (k) => html`<li><span class="sv-item"><b>${GEAR[k].name}</b><small>${GEAR[k].note} ${effect(k)}. ${tradeOff(c, k)}</small></span>
        <span class="sv-item-acts">
        <form method="post" action="/gear/equip">${who}<input type="hidden" name="item" value="${k}"><button class="sv-small" ${lock}>Equip</button></form>
        ${home
          ? others.map(
              (o) => html`<form method="post" action="/gear/give"><input type="hidden" name="from" value="${p.who}"><input type="hidden" name="to" value="${o.who}"><input type="hidden" name="item" value="${k}"><button class="sv-small">Give to ${o.who === "you" ? "you" : o.name}</button></form>`,
            )
          : ""}
        </span></li>`,
      )}
    </ul>`
      : html`<p class="sv-note">Nothing stored. The Ruined Workshop turns up basic gear that's missing; beating the beast at the Nest wins better.</p>`}
  </div>
</article>`;
}

// ---- the fight

const turnText = (t: TurnView, name = "You"): string => {
  const them = name === "You" ? "you" : name;
  return t.action === "escape"
    ? t.escaped
      ? `${name} ran for it, and got away.`
      : `${name} ran for it, but it cut ${them} off. No escaping now.`
    : t.outcome === "won"
      ? `${name} hit for ${t.playerHit}. The beast goes down.`
      : t.outcome === "defeated"
        ? `${name} hit for ${t.playerHit}. It bites for ${t.beastBite}, and ${them} ${name === "You" ? "go" : "goes"} down.`
        : `${name} hit for ${t.playerHit}. It bites back for ${t.beastBite}.`;
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

export function fightCard(s: ShelterView, m: Member, e: EncounterView, ids: { attack: string; escape: string }, fresh: boolean, error?: string): H {
  const c = m.character;
  const you = m.who === "you";
  const name = you ? "You" : m.name;
  const t = e.log.at(-1);
  const carrying = total(e.carried);
  const pct = escapePct(m);
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
      <button class="fight-go">Attack <small>hit for ${c.damage[0]}–${c.damage[1]}</small></button>
    </form>
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
  <p><strong>A ${BEAST.name.toLowerCase()} guards this place.</strong> Whoever goes meets it halfway through exploring: fight it (${BEAST.hp} HP, bites ${BEAST.bite[0]}–${BEAST.bite[1]}), or try once to escape.</p>
  <p class="nest-warn-stakes">${DEFEAT_WARNING}</p>
  ${people.map((m) => {
    const c = m.character;
    return html`<p class="nest-warn-you">${m.who === "you" ? "You" : m.name}: ${c.hp}/${c.maxHp} HP · ${gearLine(c)} · hits ${c.damage[0]}–${c.damage[1]}${c.armour ? ` · armour ${c.armour}` : ""} · escape ${escapePct(m)}%</p>`;
  })}
</div>`;
}
