import type { EnemyId, DropTable, ResidentId } from "./config.ts";

export interface DungeonDef {
  id: string; name: string; description: string; danger: string;
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
    gear: { chance: 0.3, kinds: ["respirator", "hazmat", "fireaxe"], levels: [4, 6], quality: { common: 40, uncommon: 32, rare: 20, epic: 8, legendary: 0 } },
  },
  locker: {
    supplies: [{ kind: "flare", chance: 0.7, qty: [1, 2] }, { kind: "firstaid", chance: 0.5, qty: [1, 1] }, { kind: "smoke", chance: 0.4, qty: [1, 1] }],
    gear: { chance: 1, kinds: ["baton", "riot", "webbing"], levels: [4, 7], quality: { common: 35, uncommon: 32, rare: 21, epic: 10, legendary: 2 } },
  },
  stores: {
    supplies: [{ kind: "peaches", chance: 0.9, qty: [3, 6] }, { kind: "bandage", chance: 0.7, qty: [2, 4] }, { kind: "cloth", chance: 0.6, qty: [2, 4] }, { kind: "shell", chance: 0.3, qty: [4, 8] }],
    gear: { chance: 1, kinds: ["shotgun", "machete", "hikingpack", "bow", "headtorch", "riot", "hazmat", "spear"], levels: [4, 8], quality: { common: 40, uncommon: 32, rare: 18, epic: 8, legendary: 2 } },
  },
};

export const LOWER_DECK: DungeonDef = {
  id: "lower-deck",
  name: "The Lower Deck",
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
  xp: 40,
  // a party that doesn't fill in this long is called off, and refunded
  expireMs: 30 * 60_000,
  // readiness: share of simulated runs that clear it
  readiness: { runs: 200, likely: 0.75, risky: 0.4 },
};


export const DUNGEONS: readonly DungeonDef[] = [LOWER_DECK];
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
