import { AGILITY, BEAST, CHARACTER, DOT, ESCAPE_CHANCE, RECOVERY, RECRUIT, TIME_SCALE, type Resource } from "./config.ts";

// The survivor's rules, as pure functions. The database layer is
// src/character.ts and src/encounter.ts.

export interface Stats {
  strength: number;
  agility: number;
  constitution: number;
}

// Max HP from attributes alone: levels add none of their own.
export const maxHpOf = (strength: number, constitution: number): number =>
  CHARACTER.hpBase + CHARACTER.hpPerConstitution * constitution + CHARACTER.hpPerStrength * strength;

// How many ticks of poison or bleeding actually land (none exist yet).
export const dotTicks = (ticks: number, constitution: number): number =>
  Math.max(Math.min(ticks, DOT.minTicks), ticks - Math.floor(constitution / DOT.constitutionPerTick));

export type Haul = Partial<Record<Resource, number>>;

// Agility only shortens the exploring leg, and never below half of it.
export const exploreMs = (baseMs: number, agility: number): number =>
  Math.max(baseMs * AGILITY.floor, baseMs / (1 + AGILITY.perPoint * agility));

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

// A keen eye finds a little more of each thing there is to find.
export const keener = (h: Haul, n = 0): Haul =>
  n > 0 ? Object.fromEntries(Object.entries(h).map(([k, v]) => [k, (v ?? 0) > 0 ? (v ?? 0) + n : v])) : h;

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

// The level a recruit starts at beside a player of this level. Pure.
export const recruitLevel = (playerLevel: number): number =>
  Math.max(1, Math.min(CHARACTER.maxLevel, playerLevel - RECRUIT.levelGap));
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

// One exchange of blows. `hit` and `bite` are the rolls, each in its range;
// armour takes from the bite (never below 1). A flare can cost the beast its
// bite (`skip`); spiked armour hurts it back when it does bite.
export interface Turn {
  playerHit: number;
  beastHp: number;
  beastBite: number; // 0 when the beast didn't survive to bite, or was scattered
  playerHp: number;
  outcome: "fighting" | "won" | "defeated";
}
export function exchange(playerHp: number, beastHp: number, hit: number, bite: number, armour: number, o: { skip?: boolean; spiked?: number } = {}): Turn {
  const after = Math.max(0, beastHp - hit);
  if (after === 0) return { playerHit: hit, beastHp: 0, beastBite: 0, playerHp, outcome: "won" };
  return bitten(playerHp, after, hit, bite, armour, o);
}

// The beast's answer to anything that isn't a killing blow.
export function bitten(playerHp: number, beastHp: number, hit: number, bite: number, armour: number, o: { skip?: boolean; spiked?: number } = {}): Turn {
  if (o.skip) return { playerHit: hit, beastHp, beastBite: 0, playerHp, outcome: "fighting" };
  const dealt = Math.max(1, bite - armour);
  const hp = Math.max(0, playerHp - dealt);
  const left = Math.max(0, beastHp - (o.spiked ?? 0));
  if (hp === 0) return { playerHit: hit, beastHp: left, beastBite: dealt, playerHp: 0, outcome: "defeated" };
  return { playerHit: hit, beastHp: left, beastBite: dealt, playerHp: hp, outcome: left === 0 ? "won" : "fighting" };
}

// Escape succeeds when a roll of 0–99 falls under the chance.
export const escapes = (roll: number, chance: number = ESCAPE_CHANCE): boolean => roll < Math.round(chance * 100);

export const BITE = BEAST.bite;
