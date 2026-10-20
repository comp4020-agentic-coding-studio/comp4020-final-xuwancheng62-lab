import { HELEN_STORY, LATE_SOLO, explorationTime, BEAST, EXPLORATION_ACCESS, SOLO_COMBAT, TIME_SCALE, TRAVEL_SEC_PER_KM, type Resource, type EnemyId } from "./config.ts";
import { exploreMs, type Haul } from "./character.ts";
import { seeded } from "./rng.ts";

export interface SoloStage { name: string; enemies: { id: EnemyId; n: number }[]; ambush?: boolean; }
export interface Destination {
  id: string;
  name: string;
  mapName?: string;
  image?: string;
  offMap?: boolean;
  blurb: string;
  km: number; // from your shelter
  bearing: number; // degrees clockwise from north, for the map
  travelSec: number; // each way: km × TRAVEL_SEC_PER_KM
  exploreSec: number;
  danger: number;
  loot: Partial<Record<Resource, [min: number, max: number]>>;
  enemies?: { id: EnemyId; n: number }[];
  level?: [number, number];
  stages?: SoloStage[];
  rewards?: string[];
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
    enemies: [{ id: "rat", n: 1 }],
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
    enemies: [{ id: "feral-dog", n: 1 }],
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
    enemies: [{ id: "mudback", n: 1 }],
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
  place({id:"raider-camp",name:"Raider Camp",blurb:"A roadside motel turned into a toll camp. Its stolen supplies are guarded.",km:3.3,bearing:65,exploreSec:240,danger:.65,level:[5,7],rewards:["Spears, axes & firearms","Armour & filters"],
    stages:[{name:"Lookout",enemies:[{id:"feral-dog",n:1},{id:"raider",n:1}]},{name:"Supply yard",enemies:[{id:"raider",n:2}]}],loot:{food:[14,22],scrap:[16,24]}}),
  place({id:"research-station",name:"Contaminated Research Station",mapName:"Research Station",blurb:"The filtration wing is sealed. Decontamination machines still patrol the infested laboratories.",km:2.1,bearing:145,exploreSec:330,danger:.8,level:[8,10],rewards:["Spears, axes & military rifles","Protective gear"],
    stages:[{name:"Service tunnel",enemies:[{id:"rustshell",n:3}]},{name:"Decontamination wing",enemies:[{id:"warden",n:1}]},{name:"Specimen hall",enemies:[{id:"rustshell",n:5},{id:"mudback",n:1}]}],loot:{water:[18,30],scrap:[24,36],power:[8,14]}}),
  place({id:"armoury",name:"Abandoned Armoury",blurb:"Military stores behind occupied barricades and an active decontamination seal.",km:4.2,bearing:290,exploreSec:420,danger:.95,level:[11,13],rewards:["High-level melee & firearms","Military armour"],
    stages:[{name:"Outer barricade",enemies:[{id:"raider",n:3}]},{name:"Inspection corridor",enemies:[{id:"sentry",n:2}]},{name:"Vault guardian",enemies:[{id:"warden",n:1},{id:"raider",n:2}]}],loot:{food:[20,30],scrap:[32,48],power:[12,20]}}),

  place({id:"ridge-road",name:"Ridge Road",blurb:"Burnt relief trucks in the cutting. Search the lead truck for a record of who sent them.",...HELEN_STORY.ridge,offMap:true,image:"/static/img/cards/helen/manifest.webp",stages:[{name:"Roadside scavengers",enemies:HELEN_STORY.ridge.enemies}],loot:{}}),
  place({id:"weighbridge",name:"Weighbridge Outskirts",blurb:"A detached stolen-goods store outside the Ash Hounds' checkpoint. This is a recovery trip, not an assault on their stronghold.",...HELEN_STORY.weighbridge,offMap:true,image:"/static/img/cards/helen/envelope.webp",stages:[{name:"Store guards",enemies:HELEN_STORY.weighbridge.enemies}],loot:{}}),
  ...Object.entries(LATE_SOLO).map(([id,d])=>place({...d,id,mapName:id==="steelworks"?"Steelworks":id==="rail-terminal"?"Rail Terminal":"Command Bunker",danger:.95,rewards:["Melee & ranged equipment","Armour & ammunition"],
    blurb:id==="steelworks"?"Cold furnaces shelter armoured insects and armed salvage crews.":id==="rail-terminal"?"The Ash Hounds hold the platforms and hunt between the carriages.":"Pre-war military guardians still defend the buried command vault.",
    stages:id==="steelworks"?[{name:"Foundry floor",enemies:[{id:"slag-beetle" as const,n:2}]},{name:"Salvage gantry",enemies:[{id:"hound-gunner" as const,n:2}]}]:id==="rail-terminal"?[{name:"Platform patrol",enemies:[{id:"armoured-hound" as const,n:2}]},{name:"Signal tower",enemies:[{id:"hound-gunner" as const,n:3}]}]:[{name:"Security corridor",enemies:[{id:"war-guardian" as const,n:1}]},{name:"Command vault",enemies:[{id:"war-guardian" as const,n:2}]}],
  })),
];

export const canExplore = (playerLevel: number, recommended?: readonly number[]): boolean => !recommended || recommended[0] - playerLevel <= EXPLORATION_ACCESS.maxLevelGap;
export const unlockLevel = (recommended?: readonly number[]): number => Math.max(1, (recommended?.[0] ?? 1) - EXPLORATION_ACCESS.maxLevelGap);
export const destinationEnemies = (d: Destination) => d.stages?.flatMap(s => s.enemies) ?? d.enemies ?? [];

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
  const explore = explorationTime(exploreMs(d.exploreSec * 1000, agility) / TIME_SCALE);
  return {
    departedAt: now,
    arriveAt: now + travel,
    exploreUntil: now + travel + explore,
    returnAt: now + travel + explore + travel,
    encounterAt: d.beast || destinationEnemies(d).length ? Math.round(now + travel + explore * (d.stages ? 1/(d.stages.length+1) : SOLO_COMBAT.encounterAt)) : null,
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
