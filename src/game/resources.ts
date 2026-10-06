import { RATES, SETTLE_CAP_MS, SETTLE_STEP_MS, type Resource } from "./config.ts";

export type Stock = Record<Resource, number>;

export interface Rates {
  generator: boolean;
  purifier: boolean;
  net: Stock;
}

// Which facilities can run right now, and the resulting net change per hour.
export function currentRates(s: Stock): Rates {
  const generator = s.scrap > 0;
  const purifier = s.power > 0;
  const g = RATES.generator;
  const p = RATES.purifier;
  return {
    generator,
    purifier,
    net: {
      scrap: generator ? -g.scrapIn : 0,
      power: (generator ? g.powerOut : 0) - (purifier ? p.powerIn : 0),
      water: (purifier ? p.waterOut : 0) - RATES.upkeep.water,
      food: -RATES.upkeep.food,
    },
  };
}

// Advances stock from `from` to `now` in fixed steps, so a facility stops the
// moment its input runs out. Returns the new stock and the time it's settled to.
export function settle(stock: Stock, from: number, now: number): { stock: Stock; settledAt: number } {
  const start = Math.max(from, now - SETTLE_CAP_MS);
  const steps = Math.floor((now - start) / SETTLE_STEP_MS);
  const s = { ...stock };
  const perStep = SETTLE_STEP_MS / 3_600_000;
  for (let i = 0; i < steps; i++) {
    const { net } = currentRates(s);
    for (const k of Object.keys(net) as Resource[]) {
      s[k] = Math.max(0, s[k] + net[k] * perStep);
    }
  }
  return { stock: s, settledAt: start + steps * SETTLE_STEP_MS };
}
