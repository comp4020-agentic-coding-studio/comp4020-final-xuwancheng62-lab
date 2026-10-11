import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { GEAR, ORIGIN, QUALITY, SUPPLIES, SUPPLY_KINDS, USES, type Bonus, type Slot, type SupplyKind } from "./game/config.ts";
import { bonusText, cannotUse, effective, legendaryOf, nameOfGear, packLoad, power, qualityRank, requirement, statsOf, traitText, type Gear, type Supplies } from "./game/items.ts";
import type { Member, ShelterView } from "./shelter.ts";

// Items on the page (PLAN.md, "Items"): one card shape for every piece of
// equipment, so any two can be compared at a glance, and the shelter's
// stash. Quality is always written as well as coloured.

type H = HtmlEscapedString | Promise<HtmlEscapedString>;

const SLOT_NAME: Record<Slot, string> = { weapon: "Weapon", armour: "Armour", tool: "Tool" };
const NOISE = ["Silent", "Quiet", "Noisy", "Loud", "Deafening"];

// The words that say how a kind plays, beyond its main number.
export function tags(g: Gear): string[] {
  const d = GEAR[g.kind];
  const t: string[] = [];
  if (d.range === "reach") t.push("Reach: hits from the back row");
  if (d.range === "ranged") t.push(`Ranged: uses ${SUPPLIES[d.ammo!].name.toLowerCase()}`);
  if (d.range === "melee") t.push("Melee: front row");
  if (d.speed) t.push(d.speed > 0 ? "Quick" : "Slow");
  if (d.noise !== undefined) t.push(NOISE[d.noise]);
  if (d.pierce) t.push(`Ignores ${d.pierce} armour`);
  if (d.targets && d.targets > 1) t.push(d.targets > 10 ? "Hits every enemy" : `Hits up to ${d.targets}`);
  if (d.stagger) t.push(`${d.stagger}% to stagger`);
  if (d.recover) t.push(`${Math.round(d.recover * 100)}% of ammo recovered`);
  if (d.vsArmour) t.push("Weak against armour");
  if (d.oncePerFight) t.push("Once a fight");
  if (d.backblast) t.push(`Backblast ${d.backblast} to your back row`);
  if (d.opens) t.push("Opens locks");
  if (d.sealed) t.push("Sealed: ignores sprays");
  if (d.filter) t.push("Halves spray and dust");
  if (d.light) t.push("Light");
  if (d.belt) t.push(`+${d.belt} belt`);
  return t;
}

const mainStat = (g: Gear): string => {
  const s = statsOf(g);
  if (s.damage) return `Damage ${s.damage[0]}–${s.damage[1]}`;
  if (s.armour !== undefined) return `Armour ${s.armour}`;
  if (s.capacity) return `+${s.capacity} capacity`;
  const d = GEAR[g.kind];
  return d.light ? "Light" : d.opens ? "Opens locks" : d.filter ? "Halves spray and dust" : d.belt ? `+${d.belt} belt` : SLOT_NAME[d.slot];
};

// Arrows as well as colour, so better and worse read without colour.
const delta = (now: number, then: number, label: string, lowerIsBetter = false) => {
  if (now === then) return "";
  const up = lowerIsBetter ? then < now : then > now;
  return html`<span class="${up ? "is-up" : "is-down"}">${up ? "▲" : "▼"} ${label} ${then > now ? "+" : ""}${then - now}</span>`;
};

// What putting this on someone would change for them. A ranged weapon is
// compared as if they packed its ammunition, when the stash has some.
export function compareFor(m: Member, g: Gear, stash: Supplies = {}): H {
  const c = m.character;
  const slot = GEAR[g.kind].slot;
  const ammo = GEAR[g.kind].ammo;
  const pack = ammo && !(c.pack[ammo] ?? 0) && (stash[ammo] ?? 0) > 0 ? { ...c.pack, [ammo]: 1 } : c.pack;
  const next = effective(c.base, { ...c.gear, [slot]: g }, pack);
  const now = effective(c.base, c.gear, c.pack);
  const avg = (r: [number, number]) => (r[0] + r[1]) / 2;
  const parts = [
    delta(Math.round(avg(now.damage)), Math.round(avg(next.damage)), "damage"),
    delta(now.armour, next.armour, "armour"),
    delta(now.capacity - packLoad(c.pack), next.capacity - packLoad(c.pack), "capacity"),
    delta(now.agility, next.agility, "Agility"),
    delta(now.maxHp, next.maxHp, "max HP"),
    delta(now.strength, next.strength, "Strength"),
    delta(now.constitution, next.constitution, "Constitution"),
  ].filter(Boolean);
  const note = ammo && pack !== c.pack ? html` <span class="it-cmp-who">(with ${SUPPLIES[ammo].name.toLowerCase()} packed)</span>` : ammo && !(pack[ammo] ?? 0) ? html` <span class="it-cmp-who">(no ${SUPPLIES[ammo].name.toLowerCase()}: a club)</span>` : "";
  return html`<p class="it-cmp"><span class="it-cmp-who">${m.who === "you" ? "You" : m.name}:</span> ${parts.length ? parts.map((p, i) => html`${i ? " " : ""}${p}`) : html`<span>no change</span>`}${note}</p>`;
}

export function itemCard(g: Gear, o: { compare?: H[]; actions?: H; unmet?: string | null; compact?: boolean } = {}): H {
  const d = GEAR[g.kind];
  const r = requirement(g);
  const reqs = [`level ${r.level}`, r.strength ? `Strength ${r.strength}` : "", r.agility ? `Agility ${r.agility}` : ""].filter(Boolean).join(", ");
  const bonuses = Object.entries(g.bonuses) as [Bonus, number][];
  const penalty = statsOf(g).agility;
  return html`<article class="it q-${g.quality}${o.compact ? " is-compact" : ""}" data-quality="${g.quality}" data-kind="${g.kind}"${g.id ? raw(` data-item="${g.id}"`) : ""}>
  <header class="it-head"><b class="it-name">${nameOfGear(g)}</b><span class="it-q">${QUALITY[g.quality].name}</span></header>
  <p class="it-meta">Level ${g.level} · ${ORIGIN[d.origin]} · ${SLOT_NAME[d.slot]}</p>
  <p class="it-main">${mainStat(g)}${penalty ? html` <span class="it-pen">${penalty} Agility</span>` : ""}</p>
  ${o.compact
    ? ""
    : html`${bonuses.length || g.traits.length
        ? html`<ul class="it-mods">${bonuses.map(([b, n]) => html`<li>${bonusText(b, n)}</li>`)}${g.traits.map((t) => html`<li class="it-trait">${traitText(t, g.quality)}</li>`)}</ul>`
        : ""}
  <p class="it-tags">${tags(g).join(" · ")}</p>
  ${legendaryOf(g) ? html`<p class="it-lore">${legendaryOf(g)!.lore}</p>` : html`<p class="it-note">${d.note}</p>`}
  <p class="it-req${o.unmet ? " is-unmet" : ""}">Requires ${reqs}${o.unmet ? html` — <strong>${o.unmet}</strong>` : ""}</p>`}
  ${o.compare ?? ""}
  ${o.actions ?? ""}
</article>`;
}

const sortGear = (a: Gear, b: Gear) => qualityRank(b.quality) - qualityRank(a.quality) || b.level - a.level || power(b) - power(a);

const supplyLine = (k: SupplyKind, n: number) => html`<span class="it-supply q-${SUPPLIES[k].quality}"><b>${SUPPLIES[k].name}</b> <span class="it-n">×${n}</span><span class="it-q">${QUALITY[SUPPLIES[k].quality].name}</span></span>`;

// The shelter's stash: shared by everyone here, and never lost on a trip.
export function stashPanel(s: ShelterView, ctx: { message?: string; error?: string } = {}): H {
  const home = s.crew.filter((m) => !m.journey);
  const groups: [Slot, string][] = [["weapon", "Weapons"], ["armour", "Armour"], ["tool", "Tools"]];
  const supplies = SUPPLY_KINDS.filter((k) => (s.stash.supplies[k] ?? 0) > 0);
  const stick = s.stash.gear.find((g) => g.kind === "stick");
  const useBtn = (use: keyof typeof USES, ok: boolean, extra?: H) =>
    html`<form method="post" action="/stash/use"><input type="hidden" name="use" value="${use}">${extra ?? ""}<button class="sv-small" ${ok ? "" : raw("disabled")}>${USES[use].label}</button></form>`;
  const has = (k: SupplyKind, n: number) => (s.stash.supplies[k] ?? 0) >= n;
  return html`<section class="sv-panel st-panel" id="stash" aria-labelledby="st-h">
  <h2 id="st-h" class="sv-people-h">Stash</h2>
  <p class="sv-note">Shared by everyone here, and safe at home whatever happens out there. Better finds come from farther, harder places.</p>
  ${ctx.message ? html`<p class="sh-result tone-ok" role="status">${ctx.message}</p>` : ""}
  ${ctx.error ? html`<p class="sh-result tone-bad" role="alert">${ctx.error}</p>` : ""}
  ${s.journey ? html`<p class="sv-note">You're out. Whoever's home can still equip and pack from here.</p>` : ""}
  ${groups.map(([slot, label]) => {
    const items = s.stash.gear.filter((g) => GEAR[g.kind].slot === slot).sort(sortGear);
    if (!items.length) return "";
    return html`<h3 class="st-h">${label} <span class="sv-note">${items.length}</span></h3>
    <div class="st-grid">${items.map((g) =>
      itemCard(g, {
        unmet: home.length && home.every((m) => cannotUse(g, m.character.base)) ? cannotUse(g, home[0].character.base) : null,
        compare: home.map((m) => compareFor(m, g, s.stash.supplies)),
        actions: html`<div class="it-acts">${home.map((m) => {
          const no = cannotUse(g, m.character.base);
          return html`<form method="post" action="/gear/equip"><input type="hidden" name="who" value="${m.who}"><input type="hidden" name="item" value="${g.id}"><button class="sv-small" ${no ? html`disabled title="${no}"` : ""}>Equip on ${m.who === "you" ? "you" : m.name}</button></form>`;
        })}${g.kind === "stick" ? useBtn("nailbat", has("nails", USES.nailbat.takes.nails), html`<input type="hidden" name="item" value="${g.id}">`) : ""}</div>`,
      }),
    )}</div>`;
  })}
  ${!s.stash.gear.length ? html`<p class="sv-note">No spare equipment. Trips turn it up: the Workshop most often, the beast's hoard the best.</p>` : ""}
  <h3 class="st-h">Supplies</h3>
  ${supplies.length
    ? html`<ul class="st-supplies">${supplies.map((k) => {
        const def = SUPPLIES[k];
        const n = s.stash.supplies[k]!;
        const acts: H[] = [];
        if (def.type === "consumable")
          for (const m of home) {
            const on = Object.values(m.character.belt).reduce((a, x) => a + (x ?? 0), 0);
            acts.push(html`<form method="post" action="/gear/carry"><input type="hidden" name="who" value="${m.who}"><input type="hidden" name="kind" value="${k}"><input type="hidden" name="n" value="1"><button class="sv-small" ${on >= m.character.belt_size ? raw("disabled") : ""}>Belt for ${m.who === "you" ? "you" : m.name}</button></form>`);
            if (def.heal && m.character.hp < m.character.maxHp)
              acts.push(html`<form method="post" action="/gear/use"><input type="hidden" name="who" value="${m.who}"><input type="hidden" name="kind" value="${k}"><button class="sv-small">Use on ${m.who === "you" ? "you" : m.name}</button></form>`);
          }
        if (def.type === "ammo")
          for (const m of home)
            acts.push(html`<form method="post" action="/gear/carry"><input type="hidden" name="who" value="${m.who}"><input type="hidden" name="kind" value="${k}"><input type="hidden" name="n" value="${Math.min(n, 10)}"><button class="sv-small">Pack ${Math.min(n, 10)} for ${m.who === "you" ? "you" : m.name}</button></form>`);
        if (k === "cloth") acts.push(useBtn("bandage", has("cloth", USES.bandage.takes.cloth)));
        if (k === "ducttape") acts.push(useBtn("tape", !s.taped));
        if (k === "circuit") acts.push(useBtn("circuit", true));
        if (k === "sorbent") acts.push(useBtn("sorbent", s.stock.power > 0));
        return html`<li>${supplyLine(k, n)}<small>${def.note}</small><span class="sv-item-acts">${acts}</span></li>`;
      })}</ul>`
    : html`<p class="sv-note">Nothing yet. Bandages and food turn up at the Supermarket, nails and parts at the Workshop.</p>`}
  <div class="sv-item-acts st-make">${useBtn("shot", s.stock.scrap >= USES.shot.scrap)}<span class="sv-note">${USES.shot.scrap} Scrap → ${USES.shot.makes} shot</span></div>
  ${s.taped ? html`<p class="sv-note">The hatch seal is taped: +${USES.tape.defence} defence.</p>` : ""}
</section>`;
}

// What someone carries besides their equipment: belt and pack.
export function carried(m: Member, lock: boolean): H {
  const c = m.character;
  const belt = (Object.entries(c.belt) as [SupplyKind, number][]).filter(([, n]) => n > 0);
  const pack = (Object.entries(c.pack) as [SupplyKind, number][]).filter(([, n]) => n > 0);
  const used = belt.reduce((a, [, n]) => a + n, 0);
  const back = (k: SupplyKind, n: number) =>
    html`<form method="post" action="/gear/carry"><input type="hidden" name="who" value="${m.who}"><input type="hidden" name="kind" value="${k}"><input type="hidden" name="n" value="${-n}"><button class="sv-small" ${lock ? raw("disabled") : ""}>Put back</button></form>`;
  return html`<h4>Belt <span class="sv-note">${used} of ${c.belt_size} · used in a fight</span></h4>
  ${belt.length ? html`<ul class="sv-stored">${belt.map(([k, n]) => html`<li>${supplyLine(k, n)}${back(k, n)}</li>`)}</ul>` : html`<p class="sv-note">Empty. Put bandages or smoke on it from the stash.</p>`}
  ${c.ammo || pack.length
    ? html`<h4>Pack <span class="sv-note">ammunition, using ${packLoad(c.pack)} of the carrying room</span></h4>
  ${pack.length ? html`<ul class="sv-stored">${pack.map(([k, n]) => html`<li>${supplyLine(k, n)}${back(k, n)}</li>`)}</ul>` : ""}
  ${c.clubbing ? html`<p class="sv-note"><strong>No ${SUPPLIES[c.ammo!].name.toLowerCase()} packed:</strong> the ${nameOfGear(c.gear.weapon!).toLowerCase()} will be swung like a club.</p>` : ""}`
    : ""}`;
}
