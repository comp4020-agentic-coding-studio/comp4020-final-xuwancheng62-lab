import { TIME_SCALE, TRAVEL_SEC_PER_KM, type Resource } from "./config.ts";
import { seeded } from "./rng.ts";

export interface Destination {
  id: string;
  name: string;
  blurb: string;
  km: number; // from your shelter
  bearing: number; // degrees clockwise from north, for the map
  travelSec: number; // each way: km × TRAVEL_SEC_PER_KM
  exploreSec: number;
  danger: number;
  loot: Partial<Record<Resource, [min: number, max: number]>>;
}

const place = (d: Omit<Destination, "travelSec">): Destination => ({ ...d, travelSec: d.km * TRAVEL_SEC_PER_KM });

export const DESTINATIONS: readonly Destination[] = [
  place({
    id: "supermarket",
    name: "Abandoned Supermarket",
    blurb: "Shelves mostly stripped. Mostly.",
    km: 2,
    bearing: 7,
    exploreSec: 90,
    danger: 0.15,
    loot: { food: [8, 16], scrap: [0, 3] },
  }),
  place({
    id: "workshop",
    name: "Ruined Workshop",
    blurb: "Rusted tools, wiring, the odd battery.",
    km: 3,
    bearing: 247,
    exploreSec: 120,
    danger: 0.2,
    loot: { scrap: [6, 12], power: [0, 4] },
  }),
  place({
    id: "reservoir",
    name: "Dry Reservoir",
    blurb: "A few pools left under the silt.",
    km: 4,
    bearing: 276,
    exploreSec: 90,
    danger: 0.1,
    loot: { water: [10, 18] },
  }),
  place({
    id: "nest",
    name: "Creature Nest",
    blurb: "Whatever lives here hoards. It also bites.",
    km: 4,
    bearing: 319,
    exploreSec: 180,
    danger: 0.5,
    loot: { food: [10, 20], scrap: [8, 15] },
  }),
];

export const destination = (id: string): Destination | undefined => DESTINATIONS.find((d) => d.id === id);

export interface JourneyTimes {
  departedAt: number;
  arriveAt: number;
  exploreUntil: number;
  returnAt: number;
}

export function planJourney(d: Destination, now: number): JourneyTimes {
  const travel = (d.travelSec * 1000) / TIME_SCALE;
  const explore = (d.exploreSec * 1000) / TIME_SCALE;
  return {
    departedAt: now,
    arriveAt: now + travel,
    exploreUntil: now + travel + explore,
    returnAt: now + travel + explore + travel,
  };
}

export type Phase = "traveling" | "exploring" | "returning" | "done";

export function journeyPhase(j: JourneyTimes, now: number): { phase: Phase; until: number } {
  if (now < j.arriveAt) return { phase: "traveling", until: j.arriveAt };
  if (now < j.exploreUntil) return { phase: "exploring", until: j.exploreUntil };
  if (now < j.returnAt) return { phase: "returning", until: j.returnAt };
  return { phase: "done", until: j.returnAt };
}

export interface Outcome {
  result: "clean" | "hurt" | "empty";
  loot: Partial<Record<Resource, number>>;
}

// Seeded by journey id: the same journey always gives the same outcome.
export function rollOutcome(d: Destination, journeyId: number): Outcome {
  const rand = seeded(journeyId * 2_654_435_761);
  const danger = rand();
  const result = danger < d.danger / 2 ? "empty" : danger < d.danger ? "hurt" : "clean";
  const loot: Partial<Record<Resource, number>> = {};
  if (result !== "empty") {
    for (const [k, [min, max]] of Object.entries(d.loot) as [Resource, [number, number]][]) {
      let n = min + Math.floor(rand() * (max - min + 1));
      if (result === "hurt") n = Math.floor(n / 2);
      if (n > 0) loot[k] = n;
    }
  }
  return { result, loot };
}
