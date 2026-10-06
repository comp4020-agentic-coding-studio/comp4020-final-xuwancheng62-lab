import { GREENHOUSE, RATES, SETTLE_CAP_MS, SETTLE_STEP_MS, type Resource } from "./config.ts";

export type Stock = Record<Resource, number>;

export interface Rates {
  generator: boolean;
  purifier: boolean;
  greenhouse: boolean;
  net: Stock;
}

export interface GrowingPlot {
  plantedAt: number;
  readyAt: number;
}

export const growingAt = (plots: GrowingPlot[], t: number) => plots.filter((p) => p.plantedAt <= t && t < p.readyAt).length;

// Which facilities can run right now, and the resulting net change per hour.
// The greenhouse's lights need power; its plants drink water either way.
export function currentRates(s: Stock, growing = 0): Rates {
  const generator = s.scrap > 0;
  const purifier = s.power > 0;
  const greenhouse = growing > 0 && s.power > 0;
  const g = RATES.generator;
  const p = RATES.purifier;
  const gh = GREENHOUSE.perPlot;
  return {
    generator,
    purifier,
    greenhouse,
    net: {
      scrap: generator ? -g.scrapIn : 0,
      power: (generator ? g.powerOut : 0) - (purifier ? p.powerIn : 0) - (greenhouse ? gh.power * growing : 0),
      water: (purifier ? p.waterOut : 0) - RATES.upkeep.water - gh.water * growing,
      food: -RATES.upkeep.food,
    },
  };
}

// Advances stock from `from` to `now` in fixed steps, so a facility stops the
// moment its input runs out. Returns the new stock and the time it's settled to.
export function settle(stock: Stock, from: number, now: number, plots: GrowingPlot[] = []): { stock: Stock; settledAt: number } {
  const start = Math.max(from, now - SETTLE_CAP_MS);
  const steps = Math.floor((now - start) / SETTLE_STEP_MS);
  const s = { ...stock };
  const perStep = SETTLE_STEP_MS / 3_600_000;
  for (let i = 0; i < steps; i++) {
    const { net } = currentRates(s, growingAt(plots, start + i * SETTLE_STEP_MS));
    for (const k of Object.keys(net) as Resource[]) {
      s[k] = Math.max(0, s[k] + net[k] * perStep);
    }
  }
  return { stock: s, settledAt: start + steps * SETTLE_STEP_MS };
}
