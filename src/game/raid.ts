import { RAID, WORKER_GUARD } from "./config.ts";
import { statsOf, type Gear } from "./items.ts";

// Someone at home: how tough they are, what they're holding, and whether
// they're keeping guard or busy with their work.
export interface Guard {
  combat: number;
  weapon?: Gear;
  working: boolean;
}

export const guardValue = (g: Guard): number => {
  // a better weapon guards better: its kind, level and quality all count
  const v = g.combat + (g.weapon ? statsOf(g.weapon).guard : 0);
  return g.working ? Math.floor(v * WORKER_GUARD) : v;
};

// Everyone at home defends the shelter; nobody home, and only neighbours'
// reinforcements stand in the way.
export const defence = (guards: readonly Guard[], reinforces: number, extra = 0): number =>
  RAID.baseDefence + guards.reduce((t, g) => t + guardValue(g), 0) + RAID.reinforceBonus * Math.min(reinforces, RAID.maxReinforce) + extra;

// How well a raid goes, 0–1: your combat power against their defence.
export const raidStrength = (attack: number, def: number): number =>
  Math.min(RAID.strengthMax, Math.max(RAID.strengthMin, attack / (attack + def)));

export const spare = (stock: number): number => Math.max(0, Math.floor(stock) - RAID.protectedMin);

// Every raid gets in; strength and luck decide how much comes out. Weak raids
// can come back with nothing, and none takes the target below the minimum.
export const raidHaul = (stock: number, strength: number, luck: number): number =>
  Math.min(RAID.maxSteal, spare(stock), Math.floor(spare(stock) * strength * luck));

export type Security = "Low" | "Medium" | "High";
export const securityBand = (def: number): Security => (def < 25 ? "Low" : def < 40 ? "Medium" : "High");
