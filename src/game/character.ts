import { AGILITY, BEAST, CHARACTER, ESCAPE_CHANCE, GEAR, RECOVERY, TIME_SCALE, UNARMED, type ItemKind, type Resource, type Slot } from "./config.ts";

// The survivor's rules, as pure functions. The database layer is
// src/character.ts and src/encounter.ts.

export interface Stats {
  strength: number;
  agility: number;
  maxHp: number;
}

export type Equipped = Partial<Record<Slot, ItemKind>>;
export type Haul = Partial<Record<Resource, number>>;

// Agility only shortens the exploring leg, and never below half of it.
export const exploreMs = (baseMs: number, agility: number): number =>
  Math.max(baseMs * AGILITY.floor, baseMs / (1 + AGILITY.perPoint * agility));

export const damageRange = (strength: number, gear: Equipped): [number, number] => {
  const [lo, hi] = (gear.weapon && GEAR[gear.weapon].damage) || UNARMED;
  return [lo + strength, hi + strength];
};

export const armour = (gear: Equipped): number => (gear.armour && GEAR[gear.armour].armour) || 0;

export const capacity = (strength: number, gear: Equipped): number =>
  CHARACTER.baseCapacity + CHARACTER.capacityPerStrength * strength + ((gear.tool && GEAR[gear.tool].capacity) || 0);

// Fills the pack in a fixed order until it's full; returns what's carried and what's left behind.
const ORDER: Resource[] = ["food", "water", "scrap", "power"];
export function carry(found: Haul, room: number): { carried: Haul; left: number } {
  const carried: Haul = {};
  let free = Math.max(0, room);
  let left = 0;
  for (const k of ORDER) {
    const n = found[k] ?? 0;
    const take = Math.min(n, free);
    if (take > 0) carried[k] = take;
    free -= take;
    left += n - take;
  }
  return { carried, left };
}

export const total = (h: Haul): number => Object.values(h).reduce((a, n) => a + (n ?? 0), 0);

export const halve = (h: Haul): Haul =>
  Object.fromEntries(Object.entries(h).map(([k, n]) => [k, Math.floor((n ?? 0) / 2)]).filter(([, n]) => (n as number) > 0));

export const add = (a: Haul, b: Haul): Haul => {
  const out: Haul = { ...a };
  for (const [k, n] of Object.entries(b)) out[k as Resource] = (out[k as Resource] ?? 0) + (n ?? 0);
  return out;
};

// Experience: the next level needs xpPerLevel × the current level.
export const xpToNext = (level: number): number => CHARACTER.xpPerLevel * level;
export function gainXp(level: number, xp: number, gained: number): { level: number; xp: number; levelsGained: number } {
  let l = level;
  let x = xp + gained;
  let up = 0;
  while (l < CHARACTER.maxLevel && x >= xpToNext(l)) {
    x -= xpToNext(l);
    l += 1;
    up += 1;
  }
  if (l >= CHARACTER.maxLevel) x = Math.min(x, xpToNext(l));
  return { level: l, xp: x, levelsGained: up };
}

// Resting: HP comes back at a steady rate from the server's clock.
export const rested = (hp: number, maxHp: number, from: number, now: number): number =>
  Math.min(maxHp, hp + Math.max(0, now - from) / (RECOVERY.msPerHp / TIME_SCALE));

// One exchange of blows. `hit` and `bite` are the rolls, each in its range.
export interface Turn {
  playerHit: number;
  beastHp: number;
  beastBite: number; // 0 when the beast didn't survive to bite
  playerHp: number;
  outcome: "fighting" | "won" | "defeated";
}
export function exchange(playerHp: number, beastHp: number, hit: number, bite: number, gear: Equipped): Turn {
  const after = Math.max(0, beastHp - hit);
  if (after === 0) return { playerHit: hit, beastHp: 0, beastBite: 0, playerHp, outcome: "won" };
  const dealt = Math.max(1, bite - armour(gear));
  const hp = Math.max(0, playerHp - dealt);
  return { playerHit: hit, beastHp: after, beastBite: dealt, playerHp: hp, outcome: hp === 0 ? "defeated" : "fighting" };
}

// Escape succeeds when a roll of 0–99 falls under the chance.
export const escapes = (roll: number): boolean => roll < Math.round(ESCAPE_CHANCE * 100);

export const BITE = BEAST.bite;
