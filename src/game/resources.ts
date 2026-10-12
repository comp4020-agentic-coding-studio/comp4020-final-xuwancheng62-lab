import { BASE } from "./config.ts";
import { capacity, runs, tierIndex, type BaseState } from "./base.ts";
import { GREENHOUSE, RATES, RESIDENTS, SETTLE_CAP_MS, SETTLE_STEP_MS, type ResidentId, type Resource } from "./config.ts";

export type Stock = Record<Resource, number>;

export interface Rates {
  generator: boolean;
  purifier: boolean;
  greenhouse: boolean;
  workshop: boolean;
  farm: boolean;
  recycling: boolean;
  net: Stock;
}

export interface GrowingPlot {
  plantedAt: number;
  readyAt: number;
}

export const growingAt = (plots: GrowingPlot[], t: number) => plots.filter((p) => p.plantedAt <= t && t < p.readyAt).length;

// Which facilities can run right now, and the resulting net change per hour.
// The greenhouse's lights need power; its plants drink water either way.
// Anyone living here eats, home or out; someone home on work adds their
// speciality, like Toby getting more out of a running purifier.
export interface Hand {
  who: ResidentId;
  working: boolean;
}

export function currentRates(s: Stock, growing = 0, residents: readonly Hand[] = [], base?: BaseState, arrowStock=0): Rates {
  const g = RATES.generator, p = RATES.purifier, gh = GREENHOUSE.perPlot;
  const gi=base?tierIndex(base,"generator"):0, pi=base?tierIndex(base,"purifier"):0;
  const fi=base?tierIndex(base,"farm"):0, ri=base?tierIndex(base,"recycler"):0, wi=base?tierIndex(base,"workshop"):0;
  const fuel=base?BASE.generatorFuel[gi]:g.scrapIn, generation=base?BASE.generatorOutput[gi]:g.powerOut;
  const waterPower=base?BASE.purifierPower[pi]:p.powerIn;
  const step=SETTLE_STEP_MS/3_600_000;
  const generator=s.scrap>0 && (!base || (runs(base,"generator") && s.power<capacity(base) && s.scrap>=fuel*step));
  // Reserve real available input for each producer; generators cannot fund
  // machines whose demand exceeds stored power plus this minute's output.
  let powerBudget=base?s.power/step+(generator?generation:0):Infinity;
  const reserve=(cost:number)=>{if(powerBudget<cost)return false;powerBudget-=cost;return true;};
  const purifier=s.power>0 && (!base || (runs(base,"purifier") && s.water<capacity(base))) && reserve(waterPower);
  const greenhouse=growing>0 && s.power>0 && reserve(gh.power*growing);
  const farm=!!base && runs(base,"farm") && s.power>0 && s.food<capacity(base) && s.water>=(BASE.farmWater[fi]+gh.water*growing+RATES.upkeep.water)*step && reserve(BASE.farmPower[fi]);
  const arrowFuel=BASE.arrowScrap*60/BASE.arrowMinutes[wi];
  const workshop=!!base && runs(base,"workshop") && s.power>0 && s.scrap>=((generator?fuel:0)+arrowFuel)*step && arrowStock+BASE.arrowBatch<=BASE.arrowStockLimit && reserve(BASE.workshopPower[wi]);
  const recycling=!!base && runs(base,"recycler") && s.power>0 && s.scrap<capacity(base) && reserve(BASE.recyclerPower[ri]);
  const sum = (f: (x: (typeof RESIDENTS)[ResidentId]) => number, working = false) =>
    residents.filter((h) => !working || h.working).reduce((t, h) => t + f(RESIDENTS[h.who]), 0);
  return {
    generator,
    purifier,
    greenhouse,
    workshop,
    farm,
    recycling,
    net: {
      scrap: (generator ? -(base?BASE.generatorFuel[gi]:g.scrapIn) : 0) + (recycling ? BASE.recyclerScrap[ri] : 0) - (workshop?arrowFuel:0),
      power: (generator ? (base?BASE.generatorOutput[gi]:g.powerOut) : 0) - (purifier ? (base?BASE.purifierPower[pi]:p.powerIn) : 0) - (greenhouse ? gh.power * growing : 0) - (farm?BASE.farmPower[fi]:0) - (recycling?BASE.recyclerPower[ri]:0) - (workshop?BASE.workshopPower[tierIndex(base!,"workshop")]:0),
      water: (purifier ? (base?BASE.purifierOutput[pi]:p.waterOut) + sum((x) => x.purifierWater, true) : 0) - RATES.upkeep.water - gh.water * growing - (farm?BASE.farmWater[fi]:0),
      food: -RATES.upkeep.food - sum((x) => x.food) + (farm?BASE.farmFood[fi]:0),
    },
  };
}

// Advances stock from `from` to `now` in fixed steps, so a facility stops the
// moment its input runs out. Returns the new stock and the time it's settled to.
export function settle(stock: Stock, from: number, now: number, plots: GrowingPlot[] = [], residents: readonly Hand[] = [], base?: BaseState, arrowStock = 0): { stock: Stock; settledAt: number; arrows: number; base?: BaseState } {
  base=base?structuredClone(base):undefined;
  const start = Math.max(from, now - SETTLE_CAP_MS);
  const steps = Math.floor((now - start) / SETTLE_STEP_MS);
  const s = { ...stock };
  let arrows=0;
  const perStep = SETTLE_STEP_MS / 3_600_000;
  for (let i = 0; i < steps; i++) {
    const { net, workshop } = currentRates(s, growingAt(plots, start + i * SETTLE_STEP_MS), residents, base, arrowStock+arrows);
    for (const k of Object.keys(net) as Resource[]) {
      const next = Math.max(0, s[k] + net[k] * perStep);
      // Never discard stock acquired as loot; only stop production at the cap.
      s[k] = base && net[k]>0 ? Math.min(next,Math.max(s[k],capacity(base))) : next;
    }
    if(base && workshop) {
      const f=base.workshop; f.progress+=SETTLE_STEP_MS;
      const batch=BASE.arrowMinutes[tierIndex(base,"workshop")]*60_000;
      if(f.progress>=batch && arrowStock+arrows+BASE.arrowBatch<=BASE.arrowStockLimit) {
        arrows+=BASE.arrowBatch; f.progress-=batch;
      }
    }
  }
  return { stock: s, arrows, base, settledAt: start + steps * SETTLE_STEP_MS };
}
