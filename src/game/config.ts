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
