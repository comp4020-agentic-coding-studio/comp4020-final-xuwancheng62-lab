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

// World chat: one channel for everyone, a little slower than talk at a gate.
export const WORLD_CHAT = {
  maxLength: 200,
  gapMs: 3000,
  shown: 40,
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
  maxLevel: 20,
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

// ---- items (PLAN.md, "Items")

// Quality is rarity, stronger numbers and more distinctive effects. `mult`
// scales the main stat; `bonuses` and `traits` are how many are rolled;
// `traitScale` strengthens an Epic's trait.
export type Quality = "common" | "uncommon" | "rare" | "epic" | "legendary";
export const QUALITIES: readonly Quality[] = ["common", "uncommon", "rare", "epic", "legendary"];
export const QUALITY: Record<Quality, { name: string; mult: number; bonuses: number; traits: number; traitScale: number }> = {
  common: { name: "Common", mult: 1, bonuses: 0, traits: 0, traitScale: 1 },
  uncommon: { name: "Uncommon", mult: 1.08, bonuses: 1, traits: 0, traitScale: 1 },
  rare: { name: "Rare", mult: 1.16, bonuses: 1, traits: 1, traitScale: 1 },
  epic: { name: "Epic", mult: 1.26, bonuses: 2, traits: 1, traitScale: 1.5 },
  legendary: { name: "Legendary", mult: 1.38, bonuses: 2, traits: 1, traitScale: 1.5 },
};

// Where a thing was made: a label beside quality, never instead of it.
export type Origin = "improvised" | "civilian" | "council" | "police" | "military" | "experimental";
export const ORIGIN: Record<Origin, string> = {
  improvised: "Improvised",
  civilian: "Civilian",
  council: "Council",
  police: "Police",
  military: "Military",
  experimental: "Experimental",
};

// Level is baseline power: each level above 1 adds this much of the main stat.
export const ITEM_LEVEL = {
  max: 20,
  perLevel: { damage: 0.08, armour: 0.06, capacity: 0.05 },
  // a character can use an item up to this many levels above their own
  reach: 2,
  // bonuses grow a step every this many levels
  bonusStep: 7,
};

export type Trait =
  | "serrated" | "piercing" | "quick" | "brutal" | "hushed" | "lucky"
  | "padded" | "sealed" | "light" | "spiked" | "sturdy"
  | "deep" | "bright" | "keen"
  | "sweeping" | "lastseal";
// What each trait does, with its size at ×1 (an Epic's is ×1.5, rounded).
// `on` is the slots it can roll on.
// `signature` traits belong to named Legendaries and are never rolled.
export const TRAITS: Record<Trait, { name: string; on: readonly Slot[]; value: number; text: string; signature?: true }> = {
  serrated: { name: "Serrated", on: ["weapon"], value: 3, text: "+{v} damage against anything unarmoured" },
  piercing: { name: "Piercing", on: ["weapon"], value: 3, text: "ignores {v} armour" },
  quick: { name: "Quick", on: ["weapon"], value: 2, text: "+{v} initiative on expeditions" },
  brutal: { name: "Brutal", on: ["weapon"], value: 50, text: "the first hit of each fight does +{v}%" },
  hushed: { name: "Hushed", on: ["weapon"], value: 1, text: "{v} less noise" },
  lucky: { name: "Lucky", on: ["weapon", "tool"], value: 5, text: "+{v}% to escape" },
  padded: { name: "Padded", on: ["armour"], value: 2, text: "+{v} armour against swarms" },
  sealed: { name: "Sealed", on: ["armour"], value: 1, text: "ignores sprays" },
  light: { name: "Light", on: ["armour"], value: 1, text: "no Agility penalty" },
  spiked: { name: "Spiked", on: ["armour"], value: 2, text: "{v} damage back to anything that bites you" },
  sturdy: { name: "Sturdy", on: ["armour"], value: 10, text: "+{v} max HP" },
  deep: { name: "Deep pockets", on: ["tool"], value: 10, text: "+{v} carrying capacity" },
  bright: { name: "Bright", on: ["tool"], value: 1, text: "your party strikes first in the dark" },
  keen: { name: "Keen-eyed", on: ["tool"], value: 1, text: "+{v} to everything found on a trip" },
  sweeping: { name: "Sweeping", on: ["weapon"], value: 1, text: "each blow hits {v} more enemy", signature: true },
  lastseal: { name: "Last seal", on: ["armour"], value: 1, text: "once a run, the blow that would drop you leaves you on 1 HP", signature: true },
};

// Named Legendaries: a kind, its signature and one more trait, and a line
// of where it's been. Rolled only where a table allows Legendary.
export const LEGENDARIES: { id: string; name: string; kind: ItemKind; traits: Trait[]; lore: string }[] = [
  { id: "bin-hook", name: "Gary's Bin Hook", kind: "spear", traits: ["sweeping", "serrated"], lore: "CS-4's bin warden kept the car park clear with it for fifteen days." },
  { id: "seal-suit", name: "CS-4 Seal-Suit", kind: "hazmat", traits: ["lastseal", "padded"], lore: "Issued to whoever worked the dust room. Somebody patched it twice." },
];

// Plain numbers an item can roll, at their first step; later steps multiply.
export type Bonus = "strength" | "agility" | "maxHp" | "damage" | "armour" | "capacity";
export const BONUSES: Record<Bonus, { name: string; on: readonly Slot[]; step: number }> = {
  strength: { name: "Strength", on: ["weapon", "armour", "tool"], step: 1 },
  agility: { name: "Agility", on: ["weapon", "armour", "tool"], step: 1 },
  maxHp: { name: "max HP", on: ["weapon", "armour", "tool"], step: 5 },
  damage: { name: "damage", on: ["weapon"], step: 1 },
  armour: { name: "armour", on: ["armour"], step: 1 },
  capacity: { name: "capacity", on: ["tool"], step: 5 },
};

export type SupplyKind =
  | "bandage" | "firstaid" | "peaches" | "smoke" | "flare" | "molotov"
  | "shot" | "arrow" | "r22" | "shell" | "r556" | "rocket84"
  | "cloth" | "nails" | "ducttape" | "circuit" | "sorbent";
export type SupplyType = "consumable" | "ammo" | "material";

// Equipment kinds, at level 1 and Common. `range` is melee (Front row only),
// reach (either row) or ranged (either row, uses `ammo`). `minLevel` is the
// lowest level it's ever found at. `guard` is what it adds to the shelter's
// defence while its holder is home on guard (PLAN.md, "Steal").
export type ItemKind =
  | "stick" | "crowbar" | "nailbat" | "machete" | "spear" | "baton" | "fireaxe"
  | "slingshot" | "bow" | "rifle22" | "shotgun" | "servicerifle" | "launcher"
  | "jacket" | "tyreplates" | "hazmat" | "riot" | "bodyarmour"
  | "backpack" | "hikingpack" | "headtorch" | "boltcutters" | "respirator" | "webbing";
export interface GearDef {
  name: string;
  slot: Slot;
  origin: Origin;
  minLevel: number;
  note: string;
  guard?: number;
  needs?: { strength?: number; agility?: number };
  // weapons
  damage?: [number, number];
  range?: "melee" | "reach" | "ranged";
  ammo?: SupplyKind;
  speed?: number; // initiative
  noise?: number; // 0 silent … 4 deafening
  pierce?: number; // armour ignored
  targets?: number; // enemies hit by one attack
  recover?: number; // share of ammo picked up after a fight
  vsArmour?: number; // armour counts this much more against it
  stagger?: number; // % chance the target loses its next attack
  backblast?: number; // damage to your own Back row
  oncePerFight?: boolean;
  // armour
  armour?: number;
  agility?: number; // a penalty, negative
  sealed?: boolean;
  // tools
  capacity?: number;
  belt?: number;
  light?: boolean;
  opens?: boolean;
  filter?: boolean;
}
export const GEAR: Record<ItemKind, GearDef> = {
  stick: { name: "Wooden stick", slot: "weapon", origin: "improvised", minLevel: 1, damage: [3, 6], range: "melee", speed: 1, noise: 0, guard: 0, note: "Better than bare hands, and it never runs out." },
  crowbar: { name: "Crowbar", slot: "weapon", origin: "civilian", minLevel: 1, damage: [6, 10], range: "melee", noise: 1, guard: 1, opens: true, note: "Hits hard enough, and opens what's locked." },
  nailbat: { name: "Nail bat", slot: "weapon", origin: "improvised", minLevel: 1, damage: [7, 12], range: "melee", noise: 1, guard: 1, vsArmour: 2, note: "Vicious on flesh, useless on shell." },
  machete: { name: "Machete", slot: "weapon", origin: "civilian", minLevel: 2, damage: [8, 13], range: "melee", speed: 1, noise: 0, guard: 1, note: "Quick, and it cuts." },
  spear: { name: "Spear", slot: "weapon", origin: "improvised", minLevel: 2, damage: [10, 15], range: "reach", noise: 0, guard: 3, note: "Long enough to fight from behind someone." },
  baton: { name: "Riot baton", slot: "weapon", origin: "police", minLevel: 3, damage: [7, 11], range: "melee", noise: 1, guard: 2, stagger: 20, note: "Made to stop people, and it stops other things too." },
  fireaxe: { name: "Fire axe", slot: "weapon", origin: "council", minLevel: 3, damage: [13, 19], range: "melee", speed: -2, noise: 1, guard: 3, needs: { strength: 6 }, note: "Slow, and devastating when it lands." },
  slingshot: { name: "Slingshot", slot: "weapon", origin: "improvised", minLevel: 1, damage: [4, 7], range: "ranged", ammo: "shot", recover: 0.5, noise: 0, guard: 0, note: "Silent, and its shot is cheap." },
  bow: { name: "Compound bow", slot: "weapon", origin: "civilian", minLevel: 4, damage: [10, 16], range: "ranged", ammo: "arrow", recover: 0.5, noise: 0, guard: 2, needs: { agility: 6 }, note: "Silent, and half the arrows come back." },
  rifle22: { name: ".22 farm rifle", slot: "weapon", origin: "civilian", minLevel: 3, damage: [9, 14], range: "ranged", ammo: "r22", noise: 2, guard: 3, note: "Every farm had one. Loud enough to carry." },
  shotgun: { name: "Pump shotgun", slot: "weapon", origin: "civilian", minLevel: 5, damage: [8, 12], range: "ranged", ammo: "shell", targets: 3, noise: 3, guard: 4, note: "Hits up to three at once. Everything hears it." },
  servicerifle: { name: "Service rifle", slot: "weapon", origin: "military", minLevel: 8, damage: [14, 20], range: "ranged", ammo: "r556", pierce: 5, noise: 3, guard: 5, note: "Built for war. Goes through armour." },
  launcher: { name: "84 mm recoilless launcher", slot: "weapon", origin: "military", minLevel: 12, damage: [60, 90], range: "ranged", ammo: "rocket84", targets: 99, oncePerFight: true, noise: 4, backblast: 10, guard: 2, needs: { strength: 7 }, note: "One shot, and the fight's mostly over. Nobody near it walks away unhurt." },
  jacket: { name: "Reinforced jacket", slot: "armour", origin: "improvised", minLevel: 1, armour: 4, note: "Takes the edge off every bite." },
  tyreplates: { name: "Tyre-rubber plates", slot: "armour", origin: "improvised", minLevel: 2, armour: 5, agility: -1, note: "Cut from truck tyres and strapped on. Heavy." },
  hazmat: { name: "Hazmat coverall", slot: "armour", origin: "council", minLevel: 3, armour: 2, sealed: true, note: "Thin, but nothing sprayed gets in." },
  riot: { name: "Riot armour", slot: "armour", origin: "police", minLevel: 5, armour: 7, agility: -2, needs: { strength: 6 }, note: "Checkpoint issue. Stops almost anything; slows you down." },
  bodyarmour: { name: "Military body armour", slot: "armour", origin: "military", minLevel: 9, armour: 9, agility: -1, note: "Plates and webbing. The best there is, and heavy with it." },
  backpack: { name: "Backpack", slot: "tool", origin: "civilian", minLevel: 1, capacity: 15, note: "Carry more home from every trip." },
  hikingpack: { name: "Hiking pack", slot: "tool", origin: "civilian", minLevel: 4, capacity: 30, agility: -1, note: "Carries twice as much, and you feel it." },
  headtorch: { name: "Head torch", slot: "tool", origin: "civilian", minLevel: 1, light: true, note: "Light where there isn't any: you see them first." },
  boltcutters: { name: "Bolt cutters", slot: "tool", origin: "civilian", minLevel: 2, opens: true, note: "Through any padlock, chain or cage." },
  respirator: { name: "Respirator", slot: "tool", origin: "council", minLevel: 3, filter: true, note: "Halves what sprays and dust do to you." },
  webbing: { name: "Webbing", slot: "tool", origin: "police", minLevel: 3, belt: 2, note: "Pouches for two more things on your belt." },
};
export const ITEM_KINDS = Object.keys(GEAR) as ItemKind[];
export const UNARMED: [number, number] = [2, 5];
// a ranged weapon with nothing to shoot is swung like this
export const CLUBBED: [number, number] = [2, 5];

// Supplies are stacks. Each kind has one quality. Capacity is per unit carried.
export const SUPPLIES: Record<SupplyKind, { name: string; type: SupplyType; quality: Quality; note: string; heal?: number; escape?: number; perUnit?: number }> = {
  bandage: { name: "Bandage", type: "consumable", quality: "common", heal: 20, note: "+20 HP, used in a fight or at home." },
  firstaid: { name: "First-aid kit", type: "consumable", quality: "rare", heal: 50, note: "+50 HP." },
  peaches: { name: "Tinned peaches", type: "consumable", quality: "common", heal: 10, note: "+10 HP between rooms, or at home." },
  smoke: { name: "Smoke canister", type: "consumable", quality: "uncommon", escape: 30, note: "+30% to an escape." },
  flare: { name: "Flare", type: "consumable", quality: "uncommon", note: "Animals scatter: they lose their first attack." },
  molotov: { name: "Molotov", type: "consumable", quality: "rare", note: "15 to every enemy. Burns food in the stores." },
  shot: { name: "Shot", type: "ammo", quality: "common", perUnit: 0.1, note: "Ball bearings and nuts, for a slingshot." },
  arrow: { name: "Arrows", type: "ammo", quality: "common", perUnit: 0.2, note: "For a compound bow." },
  r22: { name: ".22 rounds", type: "ammo", quality: "uncommon", perUnit: 0.1, note: "For a .22 rifle." },
  shell: { name: "Shotgun shells", type: "ammo", quality: "uncommon", perUnit: 0.2, note: "For a pump shotgun." },
  r556: { name: "5.56 rounds", type: "ammo", quality: "epic", perUnit: 0.1, note: "For a service rifle." },
  rocket84: { name: "84 mm round", type: "ammo", quality: "legendary", perUnit: 5, note: "For a recoilless launcher." },
  cloth: { name: "Cloth", type: "material", quality: "common", note: "Two make a bandage." },
  nails: { name: "Nails", type: "material", quality: "common", note: "Four turn a wooden stick into a nail bat." },
  ducttape: { name: "Duct tape", type: "material", quality: "uncommon", note: "Tapes the hatch seal: +5 defence for 30 min." },
  circuit: { name: "Circuit board", type: "material", quality: "rare", note: "Fixes the generator's regulator: +20 Power." },
  sorbent: { name: "RC-40 sorbent media", type: "material", quality: "rare", note: "Re-packs the purifier: +24 Water, if it has power." },
};
export const SUPPLY_KINDS = Object.keys(SUPPLIES) as SupplyKind[];

// Belt units everyone has; webbing adds more.
export const BELT = 2;

// Fixed uses for materials (not a crafting system): what goes in, what you get.
export const USES = {
  bandage: { takes: { cloth: 2 }, label: "Tear cloth into a bandage" },
  nailbat: { takes: { nails: 4 }, label: "Hammer nails into a stick" },
  shot: { scrap: 3, makes: 10, label: "Cut scrap into shot" },
  tape: { takes: { ducttape: 1 }, defence: 5, ms: 30 * 60_000, label: "Tape the hatch seal" },
  circuit: { takes: { circuit: 1 }, power: 20, label: "Fix the generator's regulator" },
  sorbent: { takes: { sorbent: 1 }, water: 24, label: "Re-pack the purifier" },
} as const;

// What each place can turn up, rolled once per trip home (seeded by the
// journey). `supplies`: chance of each, and how many. `gear`: the chance of
// one piece of equipment, which kinds, and at what levels and qualities.
export interface DropTable {
  supplies: { kind: SupplyKind; chance: number; qty: [number, number] }[];
  gear: { chance: number; kinds: ItemKind[]; levels: [number, number]; quality: Record<Quality, number> };
}
const SOLO_QUALITY: Record<Quality, number> = { common: 70, uncommon: 22, rare: 7, epic: 1, legendary: 0 };
export const DROPS: Record<string, DropTable> = {
  supermarket: {
    supplies: [
      { kind: "bandage", chance: 0.3, qty: [1, 2] },
      { kind: "peaches", chance: 0.3, qty: [1, 2] },
      { kind: "cloth", chance: 0.35, qty: [1, 3] },
    ],
    gear: { chance: 0.12, kinds: ["stick", "machete", "backpack", "headtorch", "slingshot"], levels: [1, 3], quality: SOLO_QUALITY },
  },
  reservoir: {
    supplies: [
      { kind: "sorbent", chance: 0.15, qty: [1, 1] },
      { kind: "ducttape", chance: 0.2, qty: [1, 1] },
      { kind: "cloth", chance: 0.2, qty: [1, 2] },
    ],
    gear: { chance: 0.1, kinds: ["stick", "spear", "hazmat", "respirator"], levels: [1, 3], quality: SOLO_QUALITY },
  },
  workshop: {
    supplies: [
      { kind: "nails", chance: 0.4, qty: [2, 4] },
      { kind: "ducttape", chance: 0.2, qty: [1, 1] },
      { kind: "circuit", chance: 0.1, qty: [1, 1] },
      { kind: "shot", chance: 0.2, qty: [5, 10] },
    ],
    gear: { chance: 0.3, kinds: ["crowbar", "nailbat", "backpack", "boltcutters", "headtorch", "tyreplates", "fireaxe"], levels: [2, 4], quality: SOLO_QUALITY },
  },
  nest: {
    supplies: [
      { kind: "arrow", chance: 0.2, qty: [3, 6] },
      { kind: "r22", chance: 0.15, qty: [4, 8] },
    ],
    gear: { chance: 0, kinds: [], levels: [3, 6], quality: SOLO_QUALITY },
  },
  // beating the beast: always one piece, from its hoard
  beast: {
    supplies: [{ kind: "flare", chance: 0.3, qty: [1, 1] }],
    gear: { chance: 1, kinds: ["spear", "jacket", "machete", "tyreplates", "rifle22", "bow", "hikingpack", "baton"], levels: [3, 6], quality: { common: 50, uncommon: 30, rare: 14, epic: 6, legendary: 0 } },
  },
};

export const BEAST = {
  name: "Scavenger beast",
  hp: 55,
  bite: [8, 15] as [number, number],
  // met this far into the exploring leg
  at: 0.5,
  hoard: { food: [6, 12], scrap: [4, 8] } as Partial<Record<Resource, [number, number]>>,
};
export const ESCAPE_CHANCE = 0.5;

export const XP = {
  trip: { supermarket: 8, reservoir: 8, workshop: 10, nest: 12 } as Record<string, number>,
  won: 25,
  escaped: 8,
};

// Completing a story collection: experience, paid once per shelter and set.
export const COLLECTION_XP: Record<string, number> = { toby: 50, ruth: 50, mags: 50, dev: 50, helen: 50 };

// Quests (src/game/quests.ts): experience paid once when one is finished, and
// what a step costs.
export const QUEST_XP: Record<string, number> = { "last-reply": 40 };
export const QUEST_COST = { intakeScrap: 10 };

// People who live in your shelter besides you: full characters with their
// own stats and gear (PLAN.md, "Character, gear and the beast"), and what
// makes each of them themselves. Toby is Dev's apprentice: on work he
// re-packs the purifier's filter; he always eats; and the Nest's dogs know
// him, so he gets away from the beast more often.
export const RESIDENTS = {
  toby: {
    name: "Toby",
    pronouns: { they: "he", them: "him", their: "his" },
    strength: 4,
    agility: 7,
    maxHp: 80,
    combat: 6,
    gear: ["crowbar"] as ItemKind[],
    purifierWater: 4,
    food: 1,
    escape: 0.8,
    work: "Re-packs the purifier",
  },
} as const;
export type ResidentId = keyof typeof RESIDENTS;
export type Who = "you" | ResidentId;
// A worker counts for this much of their guard value.
export const WORKER_GUARD = 0.5;

// Resting at home, and a meal to speed it up.
export const RECOVERY = {
  msPerHp: 20_000,
  meal: { food: 4, water: 4, hp: 25, cooldownMs: 5 * 60_000 },
};

// The Workshop salvages basic gear you're missing, one piece a trip.

// ---- party combat and the Lower Deck (PLAN.md, "Expeditions, parties and items")

export const COMBAT = {
  roundMs: 5_000,
  maxRounds: 40,
  // at or below this share of max HP, a bandage or first-aid kit comes off the belt
  healAt: 0.35,
  molotov: 15,
  // any blow, either side, can land badly: this chance, for double
  crit: 0.1,
  // only weapons at least this loud carry beyond the room
  carries: 2,
  // a room this noisy brings another wave, once
  noiseWave: 8,
  // each point of noise takes this much off an escape
  noiseEscape: 0.5,
  // party escape: base, per point of the lowest Agility above 5, and limits
  escape: { base: 50, perAgility: 5, min: 5, max: 95 },
  // sprays: armour counts for this much; a respirator halves what's left
  sprayArmour: 0.5,
};

export type Attack = "bite" | "spray" | "swarm";
export interface EnemyDef {
  name: string;
  hp: number;
  armour: number;
  hit: [number, number];
  attack: Attack; // bite: the front row; spray: all the front row; swarm: anyone
  speed: number;
  kind: "animal" | "machine";
}
export const ENEMIES = {
  rustshell: { name: "Rustshell", hp: 18, armour: 5, hit: [5, 8], attack: "bite", speed: 4, kind: "animal" },
  warden: { name: "The warden", hp: 300, armour: 8, hit: [10, 15], attack: "spray", speed: 2, kind: "machine" },
  rat: { name: "Rat", hp: 8, armour: 0, hit: [4, 7], attack: "swarm", speed: 7, kind: "animal" },
} satisfies Record<string, EnemyDef>;
export type EnemyId = keyof typeof ENEMIES;

export interface RoomDef {
  id: string;
  name: string;
  text: string;
  ms: number;
  dark?: boolean;
  needs?: { players: number };
  enemies?: { id: EnemyId; n: number }[];
  wave?: { id: EnemyId; n: number };
  optional?: boolean;
  // the record that makes this room's enemy stand down, if anyone holds it
  standDown?: string;
  // something only a lock-opener gets into, or a resident's knack adds
  locked?: boolean;
  find?: keyof typeof DUNGEON_DROPS;
  knack?: { resident: "toby"; water: number; text: string };
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

export const LOWER_DECK = {
  id: "lower-deck",
  name: "The Lower Deck",
  // through the Supermarket and down the ramp; each way
  travelMs: 3 * 60_000,
  players: { min: 2, max: 4 },
  // everyone brings these from their shelter's stock
  rations: { food: 5, water: 5 },
  // the stores' hoard, before it's shared out
  hoard: { food: [30, 50], water: [24, 40], scrap: [12, 24] } as Record<"food" | "water" | "scrap", [number, number]>,
  // pieces of equipment in the stores' hoard, besides the one its table gives
  storesGear: 2,
  rooms: [
    { id: "crank", name: "The crank door", ms: 90_000, needs: { players: 2 }, text: "Down the B1 ramp to the Council door. One holds, one cranks. It gives with a sound like a sigh." },
    { id: "plant", name: "The plant room", ms: 120_000, dark: true, optional: true, enemies: [{ id: "rustshell", n: 5 }], wave: { id: "rustshell", n: 2 }, find: "plant",
      knack: { resident: "toby", water: 12, text: "Toby got the old purifier stack turning, the way Dev taught him. Water came through." },
      text: "Warm pipes, and something clicking inside them. A brood of rustshells has made the plant room theirs." },
    { id: "dust", name: "The dust room", ms: 120_000, enemies: [{ id: "warden", n: 1 }], standDown: "all-clear",
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

// What friends may do with your designated character until you say otherwise.
export const DISPATCH_DEFAULTS = { who: "you", enabled: true, risk: "risky" as const, row: "front" as const, keepFood: 20, keepWater: 20 };
