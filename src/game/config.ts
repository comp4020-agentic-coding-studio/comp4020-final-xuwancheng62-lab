export type Resource = "food" | "water" | "power" | "scrap";
export const RESOURCES: readonly Resource[] = ["food", "water", "power", "scrap"];

export const STARTING_STOCK: Record<Resource, number> = { food: 40, water: 40, power: 20, scrap: 15 };

// Units per hour.
export const RATES = {
  generator: { scrapIn: 1, powerOut: 6 },
  purifier: { powerIn: 2, waterOut: 8 },
  upkeep: { food: 3, water: 3 },
};

export const SETTLE_STEP_MS = 60_000;
export const SETTLE_CAP_MS = 72 * 3_600_000;

// Divides every journey duration; >1 only for local testing.
export const TIME_SCALE = Math.max(1, Number(process.env.TIME_SCALE) || 1);

export const SESSION_TTL_MS = 30 * 24 * 3_600_000;

// Raiding and helping. Defence and attack are plain points; see src/game/raid.ts.
export const RAID = {
  baseDefence: 15,
  startingCombat: 10,
  maxCombat: 30,
  protectedMin: 20,
  maxSteal: 15,
  strengthMin: 0.1,
  strengthMax: 0.85,
  luckMin: 0.5,
  luckMax: 1.5,
  awayMs: 60_000,
  shieldAfterRaidMs: 5 * 60_000,
  cooldownMs: 2 * 60_000,
  pairCooldownMs: 10 * 60_000,
  reinforceBonus: 5,
  maxReinforce: 3,
  reinforceMs: 30 * 60_000,
  helpCooldownMs: 60 * 60_000,
};
export type Stealable = "food" | "water" | "scrap";
export const STEALABLE: readonly Stealable[] = ["food", "water", "scrap"];

// The greenhouse: planting costs water up front, needs power on, and every
// growing plot draws water and power per hour until it's ready.
export type Crop = "mushrooms" | "potatoes" | "beans";
export const GREENHOUSE = {
  plots: 3,
  perPlot: { water: 4, power: 2 },
  crops: {
    mushrooms: { name: "Mushrooms", water: 2, growMin: 3, food: 6 },
    potatoes: { name: "Potatoes", water: 4, growMin: 8, food: 14 },
    beans: { name: "Beans", water: 6, growMin: 20, food: 30 },
  } satisfies Record<Crop, { name: string; water: number; growMin: number; food: number }>,
};
export const CROPS = Object.keys(GREENHOUSE.crops) as Crop[];

// Talking at a shelter: short lines, kept for a day, heard by anyone there.
export const TALK = {
  maxLength: 200,
  gapMs: 1500,
  shown: 30,
  keepMs: 24 * 60 * 60_000,
};

// Walking pace out in the wasteland. A destination's travel time is its
// distance at this pace, each way, so the map and the clock always agree.
export const TRAVEL_SEC_PER_KM = 30;
