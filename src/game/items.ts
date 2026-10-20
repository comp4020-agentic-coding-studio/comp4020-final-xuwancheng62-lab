import {
  PLAYTEST, BELT, BONUSES, CHARACTER, CLUBBED, GEAR, ITEM_LEVEL, LEGENDARIES, ORIGIN, QUALITIES, QUALITY, SUPPLIES, TRAITS, UNARMED,
  type Bonus, type DropTable, type ItemKind, type Quality, type Slot, type SupplyKind, type Trait,
} from "./config.ts";
import { maxHpOf } from "./character.ts";

// Items, as pure functions (PLAN.md, "Items"): what an item is, what it does
// at its level and quality, who can use it, and what a place turns up. The
// database layer is src/character.ts and src/items.ts.

export interface Gear {
  id?: number;
  kind: ItemKind;
  level: number;
  quality: Quality;
  bonuses: Partial<Record<Bonus, number>>;
  traits: Trait[];
  // a Legendary's own name
  name?: string | null;
}
export type Loadout = Partial<Record<Slot, Gear>>;
export type Supplies = Partial<Record<SupplyKind, number>>;

export type Rng = () => number;
export const between = (rng: Rng, [lo, hi]: readonly [number, number]): number => lo + Math.floor(rng() * (hi - lo + 1));

function weighted<T extends string>(rng: Rng, weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const sum = entries.reduce((a, [, w]) => a + w, 0);
  let r = rng() * sum;
  for (const [k, w] of entries) {
    if (w <= 0) continue;
    r -= w;
    if (r < 0) return k;
  }
  return entries.filter(([, w]) => w > 0).at(-1)![0];
}

// Picks `n` different things from a list.
function pick<T>(rng: Rng, from: readonly T[], n: number): T[] {
  const pool = [...from];
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

const clampLevel = (n: number) => Math.max(1, Math.min(ITEM_LEVEL.max, Math.round(n)));

// A bonus's size at a level: it grows a step every few levels.
export const bonusSize = (b: Bonus, level: number): number => BONUSES[b].step * (1 + Math.floor((level - 1) / ITEM_LEVEL.bonusStep));
export const traitSize = (t: Trait, quality: Quality): number => Math.round(TRAITS[t].value * QUALITY[quality].traitScale);

// Traits that would do nothing on this kind are never rolled.
function useless(kind: ItemKind, t: Trait): boolean {
  const g = GEAR[kind];
  if (TRAITS[t].signature) return true;
  if (t === "hushed") return !g.noise;
  if (t === "light") return !g.agility;
  if (t === "sealed") return Boolean(g.sealed);
  if (t === "piercing") return Boolean(g.pierce);
  return false;
}

// A new piece of equipment: its numbers are rolled once, here, and kept.
export function rollGear(rng: Rng, kind: ItemKind, level: number, quality: Quality): Gear {
  const g = GEAR[kind];
  const q = QUALITY[quality];
  const lvl = clampLevel(Math.max(level, g.minLevel));
  const bonusPool = (Object.keys(BONUSES) as Bonus[]).filter((b) => BONUSES[b].on.includes(g.slot));
  const bonuses: Partial<Record<Bonus, number>> = {};
  for (const b of pick(rng, bonusPool, q.bonuses)) bonuses[b] = bonusSize(b, lvl);
  const traitPool = (Object.keys(TRAITS) as Trait[]).filter((t) => TRAITS[t].on.includes(g.slot) && !useless(kind, t));
  return { kind, level: lvl, quality, bonuses, traits: pick(rng, traitPool, q.traits) };
}

// What one trip home turns up at a place: supplies, and maybe one piece.
export function rollDrop(rng: Rng, table: DropTable): { supplies: Supplies; gear?: Gear } {
  const supplies: Supplies = {};
  for (const s of table.supplies) if (rng() < s.chance) supplies[s.kind] = (supplies[s.kind] ?? 0) + between(rng, s.qty);
  if (!table.gear.kinds.length || rng() >= table.gear.chance) return { supplies };
  return { supplies, gear: rollPiece(rng, table) };
}

// One piece of equipment from a table. A Legendary is one of the named ones.
export function rollPiece(rng: Rng, table: DropTable): Gear {
  const quality = weighted(rng, table.gear.quality);
  const level = between(rng, table.gear.levels);
  if (quality === "legendary" && !table.gear.localLegendary) return rollLegendary(rng, level);
  const kind = table.gear.kindWeights ? weighted(rng, Object.fromEntries(table.gear.kinds.map(k=>[k,table.gear.kindWeights?.[k] ?? 1])) as Record<ItemKind,number>) : table.gear.kinds[Math.floor(rng() * table.gear.kinds.length)];
  return rollGear(rng, kind, level, quality);
}

// Extra playtest pieces are rolled independently, preserving level and rarity rules.
export function equipmentRewards(rng: Rng, table: DropTable, first?: Gear): Gear[] {
  if (!PLAYTEST.enabled) return first ? [first] : [];
  if (!table.gear.kinds.length) return [];
  return Array.from({length: PLAYTEST.equipmentCopies}, (_, i) => i === 0 && first ? first : rollPiece(rng, table));
}

export const legendaryOf = (g: Gear) => (g.name ? LEGENDARIES.find((l) => l.name === g.name) : undefined);

// One of the named Legendaries at a level, picked and rolled from the rng:
// the same seed always gives the same piece.
export function rollLegendary(rng: Rng, level: number): Gear {
  const l = LEGENDARIES[Math.floor(rng() * LEGENDARIES.length)];
  const g = rollGear(rng, l.kind, level, "legendary");
  return { ...g, traits: [...l.traits], name: l.name };
}

// ---- what an item does

const scaled = (base: number, per: number, g: Gear) => base * (1 + per * (g.level - 1)) * QUALITY[g.quality].mult;

export interface GearStats {
  damage?: [number, number];
  armour?: number;
  capacity?: number;
  agility: number; // its penalty, after a Light trait
  guard: number;
}
export function statsOf(g: Gear): GearStats {
  const d = GEAR[g.kind];
  const per = ITEM_LEVEL.perLevel;
  const out: GearStats = { agility: g.traits.includes("light") ? 0 : (d.agility ?? 0), guard: 0 };
  if (d.damage) {
    const plus = g.bonuses.damage ?? 0;
    out.damage = [Math.round(scaled(d.damage[0], per.damage, g)) + plus, Math.round(scaled(d.damage[1], per.damage, g)) + plus];
  }
  if (d.armour !== undefined) out.armour = Math.round(scaled(d.armour, per.armour, g)) + (g.bonuses.armour ?? 0);
  if (d.capacity || g.bonuses.capacity || g.traits.includes("deep"))
    out.capacity = Math.round(scaled(d.capacity ?? 0, per.capacity, g)) + (g.bonuses.capacity ?? 0) + (g.traits.includes("deep") ? traitSize("deep", g.quality) : 0);
  if (d.guard) out.guard = Math.round(d.guard * QUALITY[g.quality].mult) + Math.floor((g.level - 1) / 5);
  return out;
}

export const nameOfGear = (g: Gear): string => g.name ?? GEAR[g.kind].name;
export const qualityName = (q: Quality) => QUALITY[q].name;
export const originName = (g: Gear) => ORIGIN[GEAR[g.kind].origin];

// The level and stats someone needs to use an item.
export interface Requirement {
  level: number;
  strength?: number;
  agility?: number;
}
export const requirement = (g: Gear): Requirement => ({
  level: Math.max(1, g.level - ITEM_LEVEL.reach),
  ...GEAR[g.kind].needs,
});
export interface Body {
  level: number;
  strength: number;
  agility: number;
  constitution: number;
}
// Why someone can't use it, or null if they can. Stats are their own, before
// what they're wearing, so an item can't hold itself up.
export function cannotUse(g: Gear, body: Body): string | null {
  const r = requirement(g);
  if (body.level < r.level) return `Needs level ${r.level}`;
  if (r.strength && body.strength < r.strength) return `Needs Strength ${r.strength}`;
  if (r.agility && body.agility < r.agility) return `Needs Agility ${r.agility}`;
  return null;
}

// Everything a person brings to a fight or a trip, from their own numbers
// and what they've equipped.
export interface Effective {
  strength: number;
  agility: number;
  constitution: number;
  maxHp: number;
  damage: [number, number];
  // the weapon wants ammo of this kind (and has `ammo` of it)
  ammo?: SupplyKind;
  ranged: boolean;
  clubbing: boolean; // a ranged weapon with nothing to shoot
  armour: number;
  capacity: number;
  belt: number;
  escape: number; // added to the chance, in points
  traits: Partial<Record<Trait, number>>;
  guard: number;
}
export function effective(body: Body, l: Loadout, pack: Supplies = {}): Effective {
  const items = Object.values(l).filter(Boolean) as Gear[];
  const sum = (b: Bonus) => items.reduce((a, g) => a + (g.bonuses[b] ?? 0), 0);
  const traits: Partial<Record<Trait, number>> = {};
  for (const g of items) for (const t of g.traits) traits[t] = (traits[t] ?? 0) + traitSize(t, g.quality);
  const stats = items.map(statsOf);
  const strength = body.strength + sum("strength");
  const constitution = body.constitution + sum("constitution");
  const agility = Math.max(0, body.agility + sum("agility") + stats.reduce((a, s) => a + s.agility, 0));
  const w = l.weapon ? GEAR[l.weapon.kind] : undefined;
  const ranged = w?.range === "ranged";
  const ammo = ranged ? w!.ammo : undefined;
  const clubbing = ranged && (pack[ammo!] ?? 0) < (w?.ammoPerAttack ?? 1);
  let damage: [number, number];
  if (!l.weapon) damage = [UNARMED[0] + strength, UNARMED[1] + strength];
  else if (clubbing) damage = [CLUBBED[0] + strength, CLUBBED[1] + strength];
  else {
    const [lo, hi] = statsOf(l.weapon).damage!;
    const plus = ranged ? Math.floor(agility * CHARACTER.rangedDamagePerAgility) : strength;
    damage = [lo + plus, hi + plus];
  }
  const tool = l.tool ? statsOf(l.tool) : undefined;
  return {
    strength,
    agility,
    constitution,
    // all of it from attributes, worn ones included, and a Sturdy trait
    maxHp: maxHpOf(strength, constitution) + (traits.sturdy ?? 0),
    damage,
    ammo,
    ranged,
    clubbing,
    armour: l.armour ? statsOf(l.armour).armour! : 0,
    capacity: CHARACTER.baseCapacity + CHARACTER.capacityPerStrength * strength + (tool?.capacity ?? 0),
    belt: BELT + (l.tool ? (GEAR[l.tool.kind].belt ?? 0) : 0),
    escape: traits.lucky ?? 0,
    traits,
    guard: l.weapon ? statsOf(l.weapon).guard : 0,
  };
}

// How much of someone's carrying room their pack of ammunition takes.
export const packLoad = (pack: Supplies): number =>
  Math.ceil((Object.entries(pack) as [SupplyKind, number][]).reduce((a, [k, n]) => a + n * (SUPPLIES[k].perUnit ?? 0), 0));

export const supplyCount = (s: Supplies): number => Object.values(s).reduce((a, n) => a + (n ?? 0), 0);

// One number for sorting and a quick "better or worse": what the item is for.
export function power(g: Gear): number {
  const s = statsOf(g);
  const extras = Object.values(g.bonuses).reduce((a, n) => a + (n ?? 0), 0) + g.traits.length * 3;
  if (s.damage) return (s.damage[0] + s.damage[1]) / 2 + extras;
  if (s.armour !== undefined) return s.armour * 2 + extras;
  return (s.capacity ?? 0) / 3 + extras;
}

export const qualityRank = (q: Quality) => QUALITIES.indexOf(q);

// One line for what a trait does, at this item's quality.
export const traitText = (t: Trait, q: Quality): string => `${TRAITS[t].name}: ${TRAITS[t].text.replace("{v}", String(traitSize(t, q)))}`;
export const bonusText = (b: Bonus, n: number): string => `+${n} ${BONUSES[b].name}`;
