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

// ---- the survivor, their gear, and the one creature (PLAN.md, "Character,
// gear and the beast")

export const CHARACTER = {
  maxHp: 100,
  strength: 5,
  agility: 5,
  maxLevel: 10,
  xpPerLevel: 40, // the next level needs this × the current level
  baseCapacity: 20,
  capacityPerStrength: 4,
  travelMinHp: 20,
  // what a level-up point can buy
  train: { strength: 1, agility: 1, maxHp: 10 },
};

// Agility shortens only the exploring leg, and never below half of it.
export const AGILITY = { perPoint: 0.05, floor: 0.5 };

export type Slot = "weapon" | "armour" | "tool";
export const SLOTS: readonly Slot[] = ["weapon", "armour", "tool"];
export type ItemKind = "crowbar" | "spear" | "jacket" | "backpack";
export const GEAR: Record<ItemKind, { name: string; slot: Slot; damage?: [number, number]; armour?: number; capacity?: number; note: string }> = {
  crowbar: { name: "Crowbar", slot: "weapon", damage: [6, 10], note: "A basic melee weapon." },
  spear: { name: "Spear", slot: "weapon", damage: [10, 15], note: "Hits harder than the crowbar." },
  jacket: { name: "Reinforced jacket", slot: "armour", armour: 4, note: "Takes the edge off every bite." },
  backpack: { name: "Backpack", slot: "tool", capacity: 15, note: "Carry more home from every trip." },
};
export const ITEM_KINDS = Object.keys(GEAR) as ItemKind[];
export const UNARMED: [number, number] = [2, 5];

export const BEAST = {
  name: "Scavenger beast",
  hp: 55,
  bite: [8, 15] as [number, number],
  // met this far into the exploring leg
  at: 0.5,
  hoard: { food: [6, 12], scrap: [4, 8] } as Partial<Record<Resource, [number, number]>>,
  // the gear its hoard gives, the first you don't own
  gear: ["spear", "jacket"] as ItemKind[],
};
export const ESCAPE_CHANCE = 0.5;

export const XP = {
  trip: { supermarket: 8, reservoir: 8, workshop: 10, nest: 12 } as Record<string, number>,
  won: 25,
  escaped: 8,
};

// Resting at home, and a meal to speed it up.
export const RECOVERY = {
  msPerHp: 20_000,
  meal: { food: 4, water: 4, hp: 25, cooldownMs: 5 * 60_000 },
};

// The Workshop salvages basic gear you're missing, one piece a trip.
export const SALVAGE: ItemKind[] = ["crowbar", "backpack"];
