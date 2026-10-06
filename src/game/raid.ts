import { RAID } from "./config.ts";

export const defence = (ownerHome: boolean, ownerCombat: number, reinforces: number): number =>
  RAID.baseDefence + (ownerHome ? ownerCombat : 0) + RAID.reinforceBonus * Math.min(reinforces, RAID.maxReinforce);

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
