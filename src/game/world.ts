import { BEAST, TIME_SCALE, TRAVEL_SEC_PER_KM, type Resource } from "./config.ts";
import { exploreMs, type Haul } from "./character.ts";
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
  beast?: true; // the scavenger beast is met here, halfway through exploring
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
    beast: true,
  }),
];

export const destination = (id: string): Destination | undefined => DESTINATIONS.find((d) => d.id === id);

export interface JourneyTimes {
  departedAt: number;
  arriveAt: number;
  exploreUntil: number;
  returnAt: number;
  encounterAt?: number | null;
}

export const travelMs = (d: Destination): number => (d.travelSec * 1000) / TIME_SCALE;

// Every timestamp is fixed here, at departure: Agility shortens only the
// exploring leg, and nothing changed later moves a journey already under way.
export function planJourney(d: Destination, now: number, agility = 0): JourneyTimes {
  const travel = travelMs(d);
  const explore = exploreMs(d.exploreSec * 1000, agility) / TIME_SCALE;
  return {
    departedAt: now,
    arriveAt: now + travel,
    exploreUntil: now + travel + explore,
    returnAt: now + travel + explore + travel,
    encounterAt: d.beast ? Math.round(now + travel + explore * BEAST.at) : null,
  };
}

export type Phase = "traveling" | "exploring" | "encounter" | "returning" | "done";

// An unresolved encounter holds the journey where it is: no timer runs past it.
export function journeyPhase(j: JourneyTimes, now: number, encounterOpen = false): { phase: Phase; until: number } {
  if (now < j.arriveAt) return { phase: "traveling", until: j.arriveAt };
  if (encounterOpen && j.encounterAt != null) {
    if (now >= j.encounterAt) return { phase: "encounter", until: Infinity };
    return { phase: "exploring", until: j.encounterAt };
  }
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

// What a trip to a place with a beast has turned up by the time it appears:
// its loot table, without the old danger roll, which the beast replaces.
export function rollFound(d: Destination, journeyId: number): Haul {
  const rand = seeded(journeyId * 2_246_822_519);
  const found: Haul = {};
  for (const [k, [min, max]] of Object.entries(d.loot) as [Resource, [number, number]][]) {
    const n = min + Math.floor(rand() * (max - min + 1));
    if (n > 0) found[k] = n;
  }
  return found;
}

export function rollHoard(journeyId: number): Haul {
  const rand = seeded(journeyId * 3_266_489_917);
  const hoard: Haul = {};
  for (const [k, [min, max]] of Object.entries(BEAST.hoard) as [Resource, [number, number]][]) {
    hoard[k] = min + Math.floor(rand() * (max - min + 1));
  }
  return hoard;
}
