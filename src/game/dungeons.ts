import { LATE_TEAM, TEAM_PROGRESSION, EXPLORATION_ACCESS } from "./config.ts";
import type { EnemyId, DropTable, ResidentId } from "./config.ts";

export interface DungeonDef {
  id: string; name: string; description: string; danger: string;
  level?: [number, number]; map?: { km: number; bearing: number; labelOffset?: [number, number] };
  combatScale?: { hp: number; damage: number; armour: number };
  art?: string; shortName?: string; rewardSummary?: string[];
  arrivalText: string; successText: string;
  travelMs: number; players: { min: number; max: number };
  hoard: Record<"food" | "water" | "scrap", [number, number]>;
  storesGear: number; hoardDrop: string; drops: Record<string, DropTable>;
  rooms: RoomDef[]; xp: number; expireMs: number;
  readiness: { runs: number; likely: number; risky: number };
  reward?: { quest?: string; record?: string; text: string };
}

export interface RoomDef {
  id: string;
  name: string;
  text: string;
  ms: number;
  dark?: boolean;
  needs?: { players: number; text?: string };
  enemies?: { id: EnemyId; n: number }[];
  wave?: { id: EnemyId; n: number };
  optional?: boolean;
  // the record that makes this room's enemy stand down, if anyone holds it
  standDown?: string;
  standDownText?: string;
  skippedText?: string;
  // something only a lock-opener gets into, or a resident's knack adds
  locked?: boolean;
  find?: keyof typeof DUNGEON_DROPS;
  knack?: { resident: ResidentId; water: number; text: string };
  hoard?: boolean;
}

// What the Lower Deck's rooms hold, rolled per run.
export const DUNGEON_DROPS: Record<string, DropTable> = {
  plant: {
    supplies: [{ kind: "sorbent", chance: 0.6, qty: [1, 2] }, { kind: "circuit", chance: 0.3, qty: [1, 1] }],
    gear: { chance: 0.3, kinds: ["respirator", "hazmat", "fireaxe"], levels: TEAM_PROGRESSION.deck.levels, quality: TEAM_PROGRESSION.deck.quality },
  },
  locker: {
    supplies: [{ kind: "flare", chance: 0.7, qty: [1, 2] }, { kind: "firstaid", chance: 0.5, qty: [1, 1] }, { kind: "smoke", chance: 0.4, qty: [1, 1] }],
    gear: { chance: 1, kinds: ["spear", "riot", "webbing"], levels: TEAM_PROGRESSION.deck.levels, quality: TEAM_PROGRESSION.deck.quality },
  },
  stores: {
    supplies: [{ kind: "peaches", chance: 0.9, qty: [3, 6] }, { kind: "bandage", chance: 0.7, qty: [2, 4] }, { kind: "cloth", chance: 0.6, qty: [2, 4] }, { kind: "shell", chance: 0.3, qty: [4, 8] }],
    gear: { chance: 1, kinds: ["spear", "fireaxe", "servicerifle", "shotgun", "bodyarmour", "hazmat", "hikingpack"], levels: TEAM_PROGRESSION.deck.levels, quality: TEAM_PROGRESSION.deck.quality },
  },
};

export const LOWER_DECK: DungeonDef = {
  id: "lower-deck",
  name: "The Lower Deck",
  shortName: "Deck", level: TEAM_PROGRESSION.deck.levels, combatScale: TEAM_PROGRESSION.deck, map: { km: 2, bearing: 7, labelOffset: [30, 95] },
  art: "/static/img/world/supermarket.jpg", rewardSummary: ["Rare equipment", "Supplies", "CS-4 records"],
  description: "CS-4's sealed level, under the Supermarket.",
  danger: "High danger: basic gear is unlikely to survive. Bring equipped teammates and healing supplies.",
  arrivalText: "went down the B1 ramp.",
  successText: "They came back up the ramp with the stores on their backs.",
  drops: DUNGEON_DROPS,
  hoardDrop: "stores",
  reward: { quest: "day-fifteen", record: "cs4-last-log", text: "Day Fifteen is done, and CS-4's last log is in your journal." },
  // through the Supermarket and down the ramp; each way
  travelMs: 3 * 60_000,
  players: { min: 2, max: 4 },
  // the stores' hoard, before it's shared out
  hoard: { food: [30, 50], water: [24, 40], scrap: [12, 24] } as Record<"food" | "water" | "scrap", [number, number]>,
  // pieces of equipment in the stores' hoard, besides the one its table gives
  storesGear: 2,
  rooms: [
    { id: "crank", name: "The crank door", ms: 90_000, needs: { players: 2, text: "It takes two to work the crank. They turned back." }, text: "Down the B1 ramp to the Council door. One holds, one cranks. It gives with a sound like a sigh." },
    { id: "plant", name: "The plant room", ms: 120_000, dark: true, optional: true, skippedText: "They left it to the rustshells, and whatever's in there with them.", enemies: [{ id: "rustshell", n: 5 }], wave: { id: "rustshell", n: 2 }, find: "plant",
      knack: { resident: "toby", water: 12, text: "Toby got the old purifier stack turning, the way Dev taught him. Water came through." },
      text: "Warm pipes, and something clicking inside them. A brood of rustshells has made the plant room theirs." },
    { id: "dust", name: "The dust room", ms: 120_000, enemies: [{ id: "warden", n: 1 }], standDown: "all-clear", standDownText: "Someone said the all-clear word. The amber light stopped turning, and the warden stood down.",
      text: "The decontamination machine still holds the dust room. Its amber light turns. \"Hold seal until all-clear.\"" },
    { id: "locker", name: "The police locker", ms: 60_000, locked: true, find: "locker", text: "A steel locker, padlocked, POLICE stencilled on the door." },
    { id: "stores", name: "The stores", ms: 150_000, enemies: [{ id: "rat", n: 8 }], wave: { id: "rat", n: 4 }, find: "stores", hoard: true,
      text: "What Gary's ute couldn't take on Day 15, sealed in for whoever came back. The rats found it first." },
  ] as RoomDef[],
  xp: TEAM_PROGRESSION.deck.xp,
  // a party that doesn't fill in this long is called off, and refunded
  expireMs: 30 * 60_000,
  // readiness: share of simulated runs that clear it
  readiness: { runs: 200, likely: 0.75, risky: 0.4 },
};


// One starter demo, then levelled expeditions leading to the Lower Deck.
const commonQuality = { common: 72, uncommon: 24, rare: 4, epic: 0, legendary: 0 };
const early = (id: string, name: string, description: string, level: [number, number], map: { km: number; bearing: number }, rooms: RoomDef[], drops: Record<string, DropTable>, hoard: DungeonDef["hoard"], rewards: string[], xp: number): DungeonDef => ({
  id, name, description, level, map, shortName: id.split("-")[0].replace(/^./, c => c.toUpperCase()), art: `/static/img/dungeons/${id}.webp`, rewardSummary: rewards,
  danger: level[0] === 1 ? "Beginner: basic equipment is enough for two healthy survivors." : "Prepare armour, healing and ammunition before joining.",
  arrivalText: `arrived at ${name}.`, successText: `They secured the supplies at ${name} and returned home.`,
  travelMs: 0, players: { min: 2, max: 4 }, rooms, drops, hoard, storesGear: 1, hoardDrop: "cache", xp,
  expireMs: 30 * 60_000, readiness: { runs: 200, likely: 0.75, risky: 0.4 },
});
export const FREIGHT_YARD = early("freight-yard", "Abandoned Freight Yard", "Search the loading sheds beyond the eastern rail siding.", [1, 3], { km: 2.3, bearing: 77 }, [
  { id: "gate", name: "Broken gate", text: "Rat tracks cross the loading ramp. The stores are not empty after all.", ms: 30_000, enemies: [{ id: "rat", n: 2 }] },
  { id: "loading", name: "Loading shed", text: "Hungry dogs guard a nest beneath the old loading canopy.", ms: 45_000, enemies: [{ id: "feral-dog", n: 2 }] },
  { id: "cache", name: "Freight cache", text: "An overlooked container still holds emergency supplies.", ms: 30_000, find: "cache", hoard: true },
], { cache: { supplies: [{ kind: "bandage", chance: 1, qty: [2, 4] }, { kind: "cloth", chance: .8, qty: [2, 4] }, { kind: "nails", chance: .7, qty: [2, 5] }, { kind: "arrow", chance: .45, qty: [4, 8] }], gear: { chance: 1, kinds: ["stick", "crowbar", "jacket", "backpack", "slingshot"], levels: [1, 3], quality: commonQuality } } }, { food: [12, 20], water: [8, 12], scrap: [8, 14] }, ["Basic equipment", "Bandages", "Materials"], 18);
export const PUMP_STATION = early("pump-station", "Old Pump Station", "Recover filtration supplies from the southern settling pools.", TEAM_PROGRESSION.pump.levels, { km: 1.6, bearing: 172 }, [
  { id: "walkway", name: "Flooded walkway", text: "Small claws tap against the grating. Mudbacks shelter in the shallow pools.", ms: 40_000, enemies: [{ id: "mudback", n: 2 }] },
  { id: "pump", name: "Pump chamber", text: "A heavier crab blocks the pump chamber's broken door.", ms: 50_000, enemies: [{ id: "mudback", n: 1 }, { id: "rat", n: 2 }] },
  { id: "cache", name: "Filter store", text: "The spare filters are still wrapped inside a dry cabinet.", ms: 30_000, find: "cache", hoard: true },
], { cache: { supplies: [{ kind: "sorbent", chance: 1, qty: [2, 3] }, { kind: "ducttape", chance: .8, qty: [1, 3] }, { kind: "bandage", chance: 1, qty: [2, 4] }], gear: { chance: 1, kinds: ["spear", "fireaxe", "bow", "rifle22", "jacket", "tyreplates", "hazmat", "respirator"], levels: TEAM_PROGRESSION.pump.levels, quality: TEAM_PROGRESSION.pump.quality } } }, { food: [8, 12], water: [20, 30], scrap: [10, 16] }, ["Water", "Filter media", "Armour & tools"], 24);
export const ROAD_CHECKPOINT = early("road-checkpoint", "Road Checkpoint", "Clear a small roadside toll camp on the western service road.", TEAM_PROGRESSION.checkpoint.levels, { km: 3.6, bearing: 290 }, [
  { id: "barrier", name: "Road barrier", text: "A raider behind the barricade raises a stolen farm rifle.", ms: 35_000, enemies: [{ id: "raider", n: 1 }, { id: "feral-dog", n: 1 }] },
  { id: "inspection", name: "Inspection lane", text: "The old inspection machine still sprays anyone crossing its lane. Another raider uses it for cover.", ms: 55_000, enemies: [{ id: "sentry", n: 1 }, { id: "raider", n: 1 }] },
  { id: "cache", name: "Seized supplies", text: "The camp's confiscated supplies lie behind its watch post.", ms: 30_000, find: "cache", hoard: true },
], { cache: { supplies: [{ kind: "r22", chance: 1, qty: [8, 14] }, { kind: "shell", chance: .8, qty: [4, 8] }, { kind: "arrow", chance: .8, qty: [6, 12] }, { kind: "firstaid", chance: .7, qty: [1, 2] }], gear: { chance: 1, kinds: ["spear", "fireaxe", "servicerifle", "shotgun", "riot", "webbing"], levels: TEAM_PROGRESSION.checkpoint.levels, quality: TEAM_PROGRESSION.checkpoint.quality } } }, { food: [14, 22], water: [12, 18], scrap: [16, 24] }, ["Weapons", "Ammunition", "Medical supplies"], 30);
// Combat tuning is snapshotted with the dungeon when the party is formed.
PUMP_STATION.combatScale = TEAM_PROGRESSION.pump;
PUMP_STATION.xp = TEAM_PROGRESSION.pump.xp;
ROAD_CHECKPOINT.combatScale = TEAM_PROGRESSION.checkpoint;
ROAD_CHECKPOINT.xp = TEAM_PROGRESSION.checkpoint.xp;
export const dungeonUnlockLevel = (d: DungeonDef): number => Math.max(d.id === "freight-yard" ? 1 : TEAM_PROGRESSION.minimumPlayerLevel, d.level ? d.level[0] - EXPLORATION_ACCESS.maxLevelGap : 1);
export const canEnterDungeon = (playerLevel: number, d: DungeonDef): boolean => playerLevel >= dungeonUnlockLevel(d);

const lateDungeon = (id:"convoy"|"kestrel", name:string, kinds: import("./config.ts").ItemKind[], rooms:RoomDef[]):DungeonDef=>({
 id,name,shortName:id==="convoy"?"Convoy":"Kestrel",description:id==="convoy"?"Break the Ash Hounds' armed supply column.":"Enter the buried prototype weapons facility.",
 level:LATE_TEAM[id].levels,combatScale:LATE_TEAM[id],map:id==="convoy"?{km:3,bearing:120}:{km:3.5,bearing:220},
 art:`/static/img/dungeons/${id}.webp`,rewardSummary:["Rare / Epic / Legendary","Melee & ranged equipment"],danger:"Armoured enemies. Bring a prepared team, healing and sufficient ammunition.",
 arrivalText:`entered ${name}.`,successText:`They secured ${name} and returned with the weapons.`,travelMs:0,players:{min:2,max:4},
 hoard:LATE_TEAM.hoard,storesGear:LATE_TEAM.storesGear,hoardDrop:"cache",rooms,xp:LATE_TEAM[id].xp,expireMs:LATE_TEAM.expireMs,readiness:LATE_TEAM.readiness,
 drops:{cache:{supplies:[...LATE_TEAM.supplies,...(id==="kestrel"?[{kind:"mininuke" as const,chance:LATE_TEAM.nuclearAmmoChance,qty:[1,1] as [number,number]}]:[])],gear:{chance:1,kinds,levels:LATE_TEAM[id].levels,quality:LATE_TEAM.quality,localLegendary:true,kindWeights:{nuclearlauncher:LATE_TEAM.nuclearWeight}}}},
});
export const ARMOURED_CONVOY=lateDungeon("convoy","Ash Hounds Armoured Convoy",["lightsaber","breachhammer","huntingrifle","lmg","bodyarmour","webbing"],[
 {id:"escort",name:"Escort screen",text:"Attack hounds run beside the column while gunmen cover the road.",ms:LATE_TEAM.roomMs,enemies:[{id:"armoured-hound",n:2},{id:"hound-gunner",n:1}]},
 {id:"command",name:"Command vehicle",text:"The last gun crew barricades the weapons truck.",ms:LATE_TEAM.roomMs,enemies:[{id:"hound-gunner",n:3}]},
 {id:"cache",name:"Weapons truck",text:"Captured crates hold the convoy's equipment.",ms:LATE_TEAM.roomMs,find:"cache",hoard:true},
]);
export const KESTREL_FACILITY=lateDungeon("kestrel","Kestrel Underground Arsenal",["lightsaber","powerhammer","lmg","nuclearlauncher","powerarmour","powerassist"],[
 {id:"security",name:"Automated security",text:"Military guardians step out of their charging bays.",ms:LATE_TEAM.roomMs,enemies:[{id:"war-guardian",n:2}]},
 {id:"vault",name:"Prototype vault",text:"The final guardians lock their weapons on the intruders.",ms:LATE_TEAM.roomMs,enemies:[{id:"war-guardian",n:3}]},
 {id:"cache",name:"Prototype stores",text:"Experimental equipment is sealed in shockproof cases.",ms:LATE_TEAM.roomMs,find:"cache",hoard:true},
]);

export const DUNGEONS: readonly DungeonDef[] = [FREIGHT_YARD, PUMP_STATION, ROAD_CHECKPOINT, LOWER_DECK, ARMOURED_CONVOY, KESTREL_FACILITY];
export const dungeon = (id: string): DungeonDef | undefined => DUNGEONS.find((d) => d.id === id);

// Fail on content mistakes at startup rather than halfway through a party.
export function validateDungeon(def: DungeonDef): void {
  if (!def.id || def.players.min < 2 || def.players.max > 4 || def.players.min > def.players.max || !Number.isInteger(def.players.min) || !Number.isInteger(def.players.max)) throw new Error(`Invalid player limits: ${def.id}`);
  if (new Set(def.rooms.map((r) => r.id)).size !== def.rooms.length) throw new Error(`Duplicate room IDs: ${def.id}`);
  for (const r of def.rooms) {
    if (r.find && !def.drops[r.find]) throw new Error(`Missing drop table ${r.find} in ${def.id}`);
    if (r.hoard && def.storesGear > 0 && !def.drops[def.hoardDrop]?.gear) throw new Error(`Missing hoard gear table: ${def.id}`);
    if (!Number.isFinite(r.ms) || r.ms < 0) throw new Error(`Invalid room duration: ${def.id}/${r.id}`);
  }
  if (def.travelMs < 0 || def.expireMs <= 0 || def.xp < 0) throw new Error(`Invalid expedition timing or XP: ${def.id}`);
}
if (new Set(DUNGEONS.map((d) => d.id)).size !== DUNGEONS.length) throw new Error('Duplicate expedition IDs');
for (const def of DUNGEONS) validateDungeon(def);
