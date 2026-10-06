import { RAID } from "./config.ts";

export const defence = (ownerHome: boolean, ownerCombat: number, reinforces: number): number =>
  RAID.baseDefence + (ownerHome ? ownerCombat : 0) + RAID.reinforceBonus * Math.min(reinforces, RAID.maxReinforce);

export const stealChance = (attack: number, def: number): number =>
  Math.min(RAID.chanceMax, Math.max(RAID.chanceMin, attack / (attack + def)));

// Never takes the target below the protected minimum.
export const stealAmount = (stock: number): number => {
  const spare = Math.floor(stock) - RAID.protectedMin;
  return spare <= 0 ? 0 : Math.min(RAID.maxSteal, Math.ceil(spare * RAID.stealFraction));
};

export type Security = "Low" | "Medium" | "High";
export const securityBand = (def: number): Security => (def < 25 ? "Low" : def < 40 ? "Medium" : "High");
