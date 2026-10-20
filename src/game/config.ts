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
  gateRounds: 3,
  gateArmourPerTier: 2,
  minimumSurvivorHp: 1,
  stationUntil: 253402300799000, // indefinite posting; returned only by an explicit POST
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

// Demo pacing: arrive immediately and return when exploration finishes.
export const TRAVEL_SEC_PER_KM = 0;
export const EXPEDITION_TRAVEL_MULTIPLIER = 0;

// Temporary manual playtest: set enabled=false to restore ordinary loot and combat timing.
export const PLAYTEST = { enabled: true, equipmentCopies: 5, instantExploration: process.env.PLAYTEST_INSTANT_EXPLORATION !== "0" };
export const explorationTime = (ms: number): number => PLAYTEST.enabled && PLAYTEST.instantExploration ? 0 : ms;

// ---- the survivor, their gear, and the one creature (PLAN.md, "Character,
// gear and the beast")

// Max HP comes only from attributes (PLAN.md, "Character"): a base, +5 per
// point of Constitution, +2 per point of Strength. Levels add none of their
// own. Starting numbers give 100, as before Constitution existed.
export const CHARACTER = {
  strength: 5,
  agility: 5,
  constitution: 6,
  hpBase: 60,
  hpPerConstitution: 5,
  hpPerStrength: 2,
  rangedDamagePerAgility: 1,
  maxLevel: 20,
  xpPerLevel: 40, // the next level needs this × the current level
  baseCapacity: 20,
  capacityPerStrength: 4,
  travelMinHp: 20,
  // what a level-up point can buy
  train: { strength: 1, agility: 1, constitution: 1 },
};

// Poison, bleeding and the like (none exist yet): Constitution shortens them
// by a tick per this many points, never below one tick. It never softens a
// direct hit, so it doesn't stack with armour.
export const DOT = { constitutionPerTick: 4, minTicks: 1 };

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
  keen: { name: "Keen-eyed", on: ["tool"], value: 1, text: "+{v} to each kind of supply a trip of yours finds" },
  sweeping: { name: "Sweeping", on: ["weapon"], value: 1, text: "each blow also hits {v} more", signature: true },
  lastseal: { name: "Last seal", on: ["armour"], value: 1, text: "once a run, the blow that would drop you leaves you on 1 HP", signature: true },
};

// Named Legendaries: a kind, its signature and one more trait, and a line
// of where it's been. Rolled only where a table allows Legendary.
export const LEGENDARIES: { id: string; name: string; kind: ItemKind; traits: Trait[]; lore: string }[] = [
  { id: "bin-hook", name: "Gary's Bin Hook", kind: "spear", traits: ["sweeping", "serrated"], lore: "CS-4's bin warden kept the car park clear with it for fifteen days." },
  { id: "seal-suit", name: "CS-4 Seal-Suit", kind: "hazmat", traits: ["lastseal", "padded"], lore: "Issued to whoever worked the dust room. Somebody patched it twice." },
];

// Plain numbers an item can roll, at their first step; later steps multiply.
export type Bonus = "strength" | "agility" | "constitution" | "damage" | "armour" | "capacity";
export const BONUSES: Record<Bonus, { name: string; on: readonly Slot[]; step: number }> = {
  strength: { name: "Strength", on: ["weapon", "armour", "tool"], step: 1 },
  agility: { name: "Agility", on: ["weapon", "armour", "tool"], step: 1 },
  constitution: { name: "Constitution", on: ["weapon", "armour", "tool"], step: 1 },
  damage: { name: "damage", on: ["weapon"], step: 1 },
  armour: { name: "armour", on: ["armour"], step: 1 },
  capacity: { name: "capacity", on: ["tool"], step: 5 },
};

export type SupplyKind =
  | "bandage" | "firstaid" | "peaches" | "smoke" | "flare" | "molotov"
  | "shot" | "arrow" | "r22" | "shell" | "r556" | "rocket84" | "heavyround" | "mininuke"
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
  | "backpack" | "hikingpack" | "headtorch" | "boltcutters" | "respirator" | "webbing"
  | "chainsaw" | "warpick" | "powerhammer" | "breachhammer" | "lightsaber" | "huntingrifle" | "carbine" | "antimateriel" | "lmg" | "nuclearlauncher" | "industrialarmour" | "compositearmour" | "powerarmour" | "powerassist";
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
  ammoPerAttack?: number;
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
chainsaw: {"name": "Chainsaw", "slot": "weapon", "origin": "civilian", "minLevel": 14, "damage": [20, 27], "range": "melee", "guard": 6, "note": "A sustained cutting weapon. Strength improves its damage; no fuel packing required.", "noise": 4, "speed": -1},
warpick: {"name": "Armour-piercing war pick", "slot": "weapon", "origin": "military", "minLevel": 17, "damage": [18, 25], "range": "melee", "guard": 6, "note": "A narrow hardened point defeats thick plating.", "pierce": 12, "noise": 1},
powerhammer: {"name": "Powered demolition hammer", "slot": "weapon", "origin": "military", "minLevel": 20, "damage": [26, 35], "range": "melee", "guard": 6, "note": "A heavy powered impact, slow but devastating.", "pierce": 8, "speed": -3, "noise": 4},
breachhammer: {"name": "Assault breaching hammer", "slot": "weapon", "origin": "military", "minLevel": 15, "damage": [21, 29], "range": "melee", "guard": 6, "note": "Smashes armour and locked doors.", "pierce": 8, "speed": -2, "opens": true, "noise": 3},
lightsaber: {"name": "Lightsaber", "slot": "weapon", "origin": "military", "minLevel": 15, "damage": [22, 30], "range": "melee", "guard": 6, "note": "A recovered military energy blade. Strength drives its strikes; its sealed power module needs no packed ammunition.", "pierce": 10, "speed": 1, "noise": 2},
huntingrifle: {"name": "Heavy hunting rifle", "slot": "weapon", "origin": "military", "minLevel": 14, "damage": [23, 31], "range": "ranged", "guard": 6, "note": "Refitted for salvaged 5.56 ammunition. Powerful single shots.", "ammo": "r556", "pierce": 7, "speed": -1, "noise": 3},
carbine: {"name": "Assault carbine", "slot": "weapon", "origin": "military", "minLevel": 17, "damage": [24, 32], "range": "ranged", "guard": 6, "note": "A fast-handling automatic carbine; each turn resolves a controlled burst as one hit.", "ammo": "r556", "pierce": 5, "speed": 3, "noise": 3},
antimateriel: {"name": "Anti-materiel rifle", "slot": "weapon", "origin": "military", "minLevel": 20, "damage": [28, 38], "range": "ranged", "guard": 6, "note": "Heavy single-target fire penetrates armoured machines.", "ammo": "heavyround", "pierce": 15, "speed": -2, "noise": 4},
lmg: {"name": "Light machine gun", "slot": "weapon", "origin": "military", "minLevel": 15, "damage": [14, 20], "range": "ranged", "guard": 6, "note": "A three-round burst hits up to three targets and attracts reinforcements.", "ammo": "r556", "targets": 3, "noise": 4, "ammoPerAttack": 3},
nuclearlauncher: {"name": "Portable nuclear launcher", "slot": "weapon", "origin": "military", "minLevel": 20, "damage": [75, 100], "range": "ranged", "guard": 6, "note": "An extremely rare pre-war prototype. One miniature warhead per fight; backblast threatens your back row and ruins supplies.", "ammo": "mininuke", "targets": 99, "oncePerFight": true, "noise": 4, "backblast": 15},
industrialarmour: {"name": "Industrial armour", "slot": "armour", "origin": "military", "minLevel": 14, "armour": 10, "agility": -1, "note": "Reinforced mill-worker plates."},
compositearmour: {"name": "Composite armour", "slot": "armour", "origin": "military", "minLevel": 20, "armour": 12, "agility": 0, "note": "Light layered military protection."},
powerarmour: {"name": "Heavy power armour", "slot": "armour", "origin": "military", "minLevel": 20, "armour": 16, "agility": -3, "note": "Powered plating with a sealed internal power module. Heavy protection costs initiative; no extra fuel management."},
powerassist: {name:"Powered load harness",slot:"tool",origin:"military",minLevel:20,capacity:35,belt:2,note:"Powered assistance carries supplies and two additional belt items."},
  stick: { name: "Wooden stick", slot: "weapon", origin: "improvised", minLevel: 1, damage: [3, 6], range: "melee", speed: 1, noise: 0, guard: 0, note: "Better than bare hands, and it never runs out." },
  crowbar: { name: "Crowbar", slot: "weapon", origin: "civilian", minLevel: 1, damage: [6, 10], range: "melee", noise: 1, guard: 1, opens: true, note: "Hits hard enough, and opens what's locked." },
  nailbat: { name: "Nail bat", slot: "weapon", origin: "improvised", minLevel: 1, damage: [7, 12], range: "melee", noise: 1, guard: 1, vsArmour: 2, note: "Vicious on flesh, useless on shell." },
  machete: { name: "Machete", slot: "weapon", origin: "civilian", minLevel: 2, damage: [8, 13], range: "melee", speed: 1, noise: 0, guard: 1, note: "Quick, and it cuts." },
  spear: { name: "Spear", slot: "weapon", origin: "improvised", minLevel: 2, damage: [10, 15], range: "reach", noise: 0, guard: 3, note: "Long enough to fight from behind someone." },
  baton: { name: "Riot baton", slot: "weapon", origin: "police", minLevel: 3, damage: [7, 11], range: "melee", noise: 1, guard: 2, stagger: 20, note: "Made to stop people, and it stops other things too." },
  fireaxe: { name: "Fire axe", slot: "weapon", origin: "council", minLevel: 3, damage: [13, 19], range: "melee", speed: -2, noise: 1, guard: 3, needs: { strength: 6 }, note: "Slow, and devastating when it lands." },
  slingshot: { name: "Slingshot", slot: "weapon", origin: "improvised", minLevel: 1, damage: [4, 7], range: "ranged", ammo: "shot", recover: 0.5, noise: 0, guard: 0, note: "Silent, and its shot is cheap." },
  bow: { name: "Compound bow", slot: "weapon", origin: "civilian", minLevel: 4, damage: [10, 16], range: "ranged", ammo: "arrow", recover: 0.5, noise: 0, guard: 2, needs: { agility: 6 }, note: "Silent, and half the arrows come back." },
  rifle22: { name: ".22 farm rifle", slot: "weapon", origin: "civilian", minLevel: 3, damage: [14, 20], range: "ranged", ammo: "r22", noise: 2, guard: 3, note: "Every farm had one. Loud enough to carry." },
  shotgun: { name: "Pump shotgun", slot: "weapon", origin: "civilian", minLevel: 5, damage: [8, 12], range: "ranged", ammo: "shell", targets: 3, noise: 3, guard: 4, note: "Hits up to three at once. Everything hears it." },
  servicerifle: { name: "Service rifle", slot: "weapon", origin: "military", minLevel: 8, damage: [20, 28], range: "ranged", ammo: "r556", pierce: 5, noise: 3, guard: 5, note: "Built for war. Goes through armour." },
  launcher: { name: "84 mm recoilless launcher", slot: "weapon", origin: "military", minLevel: 12, damage: [60, 90], range: "ranged", ammo: "rocket84", targets: 99, oncePerFight: true, noise: 4, backblast: 10, guard: 2, needs: { strength: 7 }, note: "One shot, and the fight's mostly over. Nobody near it walks away unhurt." },
  jacket: { name: "Reinforced jacket", slot: "armour", origin: "improvised", minLevel: 1, armour: 4, note: "Takes the edge off every bite." },
  tyreplates: { name: "Tyre-rubber plates", slot: "armour", origin: "improvised", minLevel: 2, armour: 5, agility: -1, note: "Cut from truck tyres and strapped on. Heavy." },
  hazmat: { name: "Hazmat coverall", slot: "armour", origin: "council", minLevel: 3, armour: 2, sealed: true, note: "Sealed protection blocks spray attacks. Its thin armour offers little protection against bites and gunfire." },
  riot: { name: "Riot armour", slot: "armour", origin: "police", minLevel: 5, armour: 7, agility: -2, needs: { strength: 6 }, note: "Checkpoint issue. Stops almost anything; slows you down." },
  bodyarmour: { name: "Military body armour", slot: "armour", origin: "military", minLevel: 9, armour: 9, agility: -1, note: "Plates and webbing. The best there is, and heavy with it." },
  backpack: { name: "Backpack", slot: "tool", origin: "civilian", minLevel: 1, capacity: 15, note: "Carry more home from every trip." },
  hikingpack: { name: "Hiking pack", slot: "tool", origin: "civilian", minLevel: 4, capacity: 30, agility: -1, note: "Carries twice as much, and you feel it." },
  headtorch: { name: "Head torch", slot: "tool", origin: "civilian", minLevel: 1, light: true, note: "Light where there isn't any: you see them first." },
  boltcutters: { name: "Bolt cutters", slot: "tool", origin: "civilian", minLevel: 2, opens: true, note: "Through any padlock, chain or cage." },
  respirator: { name: "Respirator", slot: "tool", origin: "council", minLevel: 3, filter: true, note: "Filters spray and dust. Halves spray damage after armour; it does not block bites or gunfire." },
  webbing: { name: "Webbing", slot: "tool", origin: "police", minLevel: 3, belt: 2, note: "Pouches for two more things on your belt." },
};
export const ITEM_KINDS = Object.keys(GEAR) as ItemKind[];
export const UNARMED: [number, number] = [2, 5];
// a ranged weapon with nothing to shoot is swung like this
export const CLUBBED: [number, number] = [2, 5];

// Supplies are stacks. Each kind has one quality. Capacity is per unit carried.
export const SUPPLIES: Record<SupplyKind, { name: string; type: SupplyType; quality: Quality; note: string; heal?: number; escape?: number; perUnit?: number }> = {
  heavyround: {name:"Heavy rifle rounds",type:"ammo",quality:"rare",perUnit:0.2,note:"For anti-materiel rifles."},
  mininuke: {name:"Miniature nuclear warhead",type:"ammo",quality:"legendary",perUnit:5,note:"For the portable nuclear launcher."},
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
  gear: { chance: number; kinds: ItemKind[]; levels: [number, number]; quality: Record<Quality, number>; kindWeights?: Partial<Record<ItemKind, number>>; localLegendary?: boolean };
}
const SOLO_QUALITY: Record<Quality, number> = { common: 70, uncommon: 25, rare: 5, epic: 0, legendary: 0 };
export const DROPS: Record<string, DropTable> = {
  supermarket: {
    supplies: [
      { kind: "bandage", chance: 0.3, qty: [1, 2] },
      { kind: "peaches", chance: 0.3, qty: [1, 2] },
      { kind: "cloth", chance: 0.35, qty: [1, 3] },
    ],
    gear: { chance: 0.12, kinds: ["stick", "machete", "jacket", "backpack", "headtorch", "slingshot"], levels: [1, 3], quality: SOLO_QUALITY },
  },
  reservoir: {
    supplies: [
      { kind: "sorbent", chance: 0.15, qty: [1, 1] },
      { kind: "ducttape", chance: 0.2, qty: [1, 1] },
      { kind: "cloth", chance: 0.2, qty: [1, 2] },
      // the Council's emergency kit at the pumping station
      { kind: "smoke", chance: 0.12, qty: [1, 1] },
    ],
    gear: { chance: 0.1, kinds: ["spear", "hazmat", "respirator"], levels: [1, 3], quality: SOLO_QUALITY },
  },
  workshop: {
    supplies: [
      { kind: "nails", chance: 0.4, qty: [2, 4] },
      { kind: "ducttape", chance: 0.2, qty: [1, 1] },
      { kind: "circuit", chance: 0.1, qty: [1, 1] },
      { kind: "shot", chance: 0.2, qty: [5, 10] },
      // bottles, rag and fuel off the bench; a farm rifle's rounds in a drawer
      { kind: "molotov", chance: 0.12, qty: [1, 1] },
      { kind: "r22", chance: 0.15, qty: [4, 8] },
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
  "raider-camp": {
    supplies: [{kind:"r22",chance:1,qty:[10,18]},{kind:"shell",chance:.7,qty:[4,8]},{kind:"bandage",chance:.8,qty:[2,4]}],
    gear: {chance:1,kinds:["spear","fireaxe","rifle22","shotgun","jacket","riot","hazmat","respirator","webbing"],levels:[5,7],quality:{common:50,uncommon:40,rare:10,epic:0,legendary:0}},
  },
  "research-station": {
    supplies: [{kind:"r556",chance:1,qty:[12,20]},{kind:"firstaid",chance:.8,qty:[1,2]},{kind:"circuit",chance:1,qty:[2,4]},{kind:"sorbent",chance:1,qty:[2,4]}],
    gear: {chance:1,kinds:["spear","fireaxe","servicerifle","hazmat","respirator","bodyarmour"],levels:[8,10],quality:{common:37,uncommon:45,rare:15,epic:3,legendary:0}},
  },
  armoury: {
    supplies: [{kind:"r556",chance:1,qty:[18,30]},{kind:"rocket84",chance:.35,qty:[1,2]},{kind:"firstaid",chance:1,qty:[1,3]}],
    gear: {chance:1,kinds:["spear","fireaxe","servicerifle","launcher","bodyarmour","shotgun"],levels:[11,13],quality:{common:25,uncommon:50,rare:20,epic:5,legendary:0}},
  },
  // beating the beast: always one piece, from its hoard
  beast: {
    supplies: [{ kind: "flare", chance: 0.3, qty: [1, 1] }],
    gear: { chance: 1, kinds: ["spear", "jacket", "machete", "tyreplates", "rifle22", "bow", "hikingpack", "baton"], levels: [3, 6], quality: { common: 60, uncommon: 32, rare: 8, epic: 0, legendary: 0 } },
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
export const SOLO_COMBAT = { retreatHp: 0.3, encounterAt: 0.5 };
export const EXPLORATION_ACCESS = { maxLevelGap: 5 };
export const ESCAPE_CHANCE = 0.5;

export const XP = {
  trip: { supermarket: 8, reservoir: 8, workshop: 10, nest: 12, "raider-camp": 45, "research-station": 70, "armoury": 100 } as Record<string, number>,
  won: 25,
  escaped: 8,
};

// Completing a story collection: experience, paid once per shelter and set.
export const COLLECTION_XP: Record<string, number> = { toby: 50, ruth: 50, mags: 50, dev: 50, helen: 50 };

// Quests (src/game/quests.ts): experience paid once when one is finished, and
// what a step costs.
export const QUEST_XP: Record<string, number> = { "last-reply": 40, "empty-is-empty": 40 };
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
    // 83 HP: no whole Constitution gives his old 80, and nobody loses HP
    constitution: 3,
    combat: 6,
    gear: ["crowbar"] as ItemKind[],
    purifierWater: 4,
    buildDiscount: 0,
    food: 1,
    escape: 0.8,
    work: "Re-packs the purifier",
  },
  // Mags fixed forty households' Units for five years: strong hands, 77, slow
  // on her feet, and the cough. On work she cuts what building costs in scrap.
  mags: {
    name: "Mags",
    pronouns: { they: "she", them: "her", their: "her" },
    strength: 6,
    agility: 3,
    constitution: 4,
    combat: 5,
    gear: ["crowbar"] as ItemKind[],
    purifierWater: 0,
    buildDiscount: 0.25,
    food: 1,
    escape: 0.5,
    work: "Cuts the scrap that building and repairs cost",
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
  roundMs: PLAYTEST.enabled ? 0 : 5_000,
  maxRounds: 40,
  // at or below this share of max HP, a bandage or first-aid kit comes off the belt
  healAt: 0.35,
  molotov: 15,
  // in a room with a hoard, each Molotov burns this share of its food, and
  // each launcher round wrecks this share of everything and a piece of gear
  molotovBurns: 0.25,
  launcherWrecks: 0.5,
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

export type Attack = "bite" | "spray" | "swarm" | "shot";
export interface EnemyDef {
  name: string;
  hp: number;
  armour: number;
  hit: [number, number];
  attack: Attack; // bite: the front row; spray: all the front row; swarm: anyone
  speed: number;
  kind: "animal" | "machine" | "human";
}
export const ENEMIES = {
 "slag-beetle":{name:"Slag beetle",hp:85,armour:12,hit:[12,18],attack:"bite",speed:3,kind:"animal"},
 "hound-gunner":{name:"Ash Hounds gunner",hp:110,armour:8,hit:[14,20],attack:"shot",speed:8,kind:"human"},
 "armoured-hound":{name:"Armoured attack hound",hp:80,armour:8,hit:[12,17],attack:"bite",speed:10,kind:"animal"},
 "war-guardian":{name:"Military guardian",hp:210,armour:16,hit:[18,25],attack:"shot",speed:5,kind:"machine"},
  rustshell: { name: "Rustshell", hp: 18, armour: 5, hit: [5, 8], attack: "bite", speed: 4, kind: "animal" },
  warden: { name: "The warden", hp: 300, armour: 8, hit: [10, 15], attack: "spray", speed: 2, kind: "machine" },
  "feral-dog": { name: "Feral dog", hp: 18, armour: 0, hit: [3, 5], attack: "bite", speed: 5, kind: "animal" },
  mudback: { name: "Mudback crab", hp: 34, armour: 3, hit: [4, 7], attack: "bite", speed: 2, kind: "animal" },
  raider: { name: "Road raider", hp: 42, armour: 2, hit: [6, 9], attack: "shot", speed: 4, kind: "human" },
  sentry: { name: "Checkpoint sentry", hp: 70, armour: 4, hit: [5, 8], attack: "spray", speed: 2, kind: "machine" },
  rat: { name: "Rat", hp: 8, armour: 0, hit: [4, 7], attack: "swarm", speed: 7, kind: "animal" },
} satisfies Record<string, EnemyDef>;
export type EnemyId = keyof typeof ENEMIES;

// Compatibility exports; expedition content lives in the registry.


// What friends may do with your designated character until you say otherwise.
export const DISPATCH_DEFAULTS = { who: "you", enabled: true, risk: "risky" as const, row: "front" as const, keepFood: 20, keepWater: 20 };

// An invitation waits inviteMs for an answer, then joins. Open pages refresh on live events, and fall back to pollMs.
export const SOCIAL = { inviteMs: 8000, inviteCooldownMs: 10000, shown: 60, maxLength: 300, gapMs: 1000, pollMs: 10000, partyThreads: 6, cardMessages: 4 };

// Base construction: renewable salvaging is slow and bounded by storage.
export const BASE = {
  maxTier: 3, storage: [200, 350, 600],
  gateHp: [80, 160, 280], gateDefence: [5, 12, 25],
  gateReduction: [.1, .2, .4], raidWear: 12, repairScrap: 6, repairHp: 40,
  generatorOutput: [6, 9, 13], generatorFuel: [.25, .3, .4],
  purifierOutput: [8, 12, 17], purifierPower: [2, 2.5, 3],
  farmFood: [4, 7, 10], farmWater: [3, 4, 5], farmPower: [2, 3, 4],
  recyclerScrap: [2, 3, 4], recyclerPower: [2, 3, 4],
  workshopPower: [.5, .75, 1], arrowMinutes: [20, 15, 10], arrowScrap: .25, arrowBatch: 5,
  arrowStockLimit: 100,
  salvageScrap: {common:3,uncommon:5,rare:8,epic:12,legendary:18}, salvagePerLevel: 1,
  siegeIntervalMs: 6 * 3_600_000, siegeDamage: 16, siegeLoss: 5,
};
export const BASE_RECIPES = {
  arrows: { name: "Arrows", tier: 1, scrap: 2, material: "nails", amount: 1, output: "arrow", count: 10 },
  bandage: { name: "Bandages", tier: 1, scrap: 0, material: "cloth", amount: 2, output: "bandage", count: 2 },
  spear: { name: "Spear", tier: 1, scrap: 8, material: "nails", amount: 2, gear: "spear" },
  bow: { name: "Compound bow", tier: 2, scrap: 25, material: "ducttape", amount: 2, gear: "bow" },
  firstaid: { name: "First-aid kit", tier: 3, scrap: 0, material: "cloth", amount: 4, output: "firstaid", count: 1 },
} as const;

export type BaseCost = { scrap: number; water?: number; materials?: Partial<Record<SupplyKind,number>> };
export const BASE_BUILD_COSTS: Record<string, readonly BaseCost[]> = {
 gate: [{scrap:10},{scrap:20,materials:{nails:4,ducttape:2}},{scrap:40,materials:{nails:8,circuit:1}}],
 generator: [{scrap:10},{scrap:15,materials:{nails:4,ducttape:2}},{scrap:30,materials:{circuit:2,ducttape:3}}],
 purifier: [{scrap:8},{scrap:12,materials:{sorbent:1,ducttape:2}},{scrap:25,materials:{sorbent:2,circuit:1}}],
 storage: [{scrap:8},{scrap:10,materials:{nails:4,cloth:2}},{scrap:20,materials:{nails:8,cloth:4}}],
 workshop: [{scrap:12,materials:{nails:3}},{scrap:20,materials:{ducttape:2,nails:4}},{scrap:35,materials:{circuit:1,nails:6}}],
 farm: [{scrap:5,water:12,materials:{cloth:4}},{scrap:10,water:20,materials:{cloth:6}},{scrap:20,water:30,materials:{sorbent:1,cloth:8}}],
 recycler: [{scrap:8,materials:{nails:2}},{scrap:15,materials:{circuit:1,ducttape:2}},{scrap:25,materials:{circuit:2,ducttape:3}}],
};

export const TEAM_PROGRESSION = {
  minimumPlayerLevel: 5,
  pump: { levels: [5, 7] as [number, number], hp: 2.2, damage: 1.5, armour: 1, xp: 45, quality: { common: 0, uncommon: 20, rare: 65, epic: 15, legendary: 0 } },
  checkpoint: { levels: [8, 10] as [number, number], hp: 2.5, damage: 1.8, armour: 2, xp: 70, quality: { common: 0, uncommon: 0, rare: 65, epic: 33, legendary: 2 } },
  deck: { levels: [11, 13] as [number, number], hp: 1.6, damage: 1.6, armour: 2, xp: 100, quality: { common: 0, uncommon: 0, rare: 35, epic: 60, legendary: 5 } },
};


// Later progression: each destination retains one weapon and introduces one per build.
export const LATE_SOLO = {
 "steelworks": {name:"Abandoned Steelworks",level:[14,16] as [number,number],km:3,bearing:92,exploreSec:480,xp:130,loot:{scrap:[38,54] as [number,number],power:[12,20] as [number,number]},weapons:["fireaxe","chainsaw","servicerifle","huntingrifle"] as ItemKind[],armour:"industrialarmour" as ItemKind},
 "rail-terminal": {name:"Sealed Rail Terminal",level:[17,19] as [number,number],km:5.8,bearing:255,exploreSec:540,xp:165,loot:{scrap:[44,60] as [number,number],food:[24,36] as [number,number]},weapons:["chainsaw","warpick","huntingrifle","carbine"] as ItemKind[],armour:"bodyarmour" as ItemKind},
 "command-bunker": {name:"Underground Command Bunker",level:[20,20] as [number,number],km:3,bearing:25,exploreSec:600,xp:200,loot:{scrap:[50,70] as [number,number],power:[20,32] as [number,number]},weapons:["chainsaw","powerhammer","carbine","antimateriel"] as ItemKind[],armour:"compositearmour" as ItemKind},
};
for (const [id,d] of Object.entries(LATE_SOLO)) {
 DROPS[id]={supplies:[{kind:"r556",chance:1,qty:[24,40]},{kind:"heavyround",chance:1,qty:[12,20]},{kind:"firstaid",chance:1,qty:[1,2]}],gear:{chance:1,kinds:[...d.weapons,d.armour,"respirator","webbing"],levels:d.level,quality:{common:25,uncommon:50,rare:20,epic:5,legendary:0}}};
 XP.trip[id]=d.xp;
}
export const LATE_TEAM = {
 quality:{common:0,uncommon:0,rare:35,epic:55,legendary:10},
 convoy:{levels:[15,17] as [number,number],xp:180,hp:1.8,damage:1.1,armour:1},
 kestrel:{levels:[20,20] as [number,number],xp:250,hp:1.8,damage:1.1,armour:1},
 expireMs:30*60_000,roomMs:90_000,readiness:{runs:200,likely:.75,risky:.4},
 nuclearWeight:.12,
 nuclearAmmoChance:.25,
 hoard:{food:[30,45] as [number,number],water:[25,40] as [number,number],scrap:[40,60] as [number,number]},
 storesGear:2,
 supplies:[{kind:"r556" as SupplyKind,chance:1,qty:[36,60] as [number,number]},{kind:"heavyround" as SupplyKind,chance:1,qty:[16,24] as [number,number]},{kind:"firstaid" as SupplyKind,chance:1,qty:[2,4] as [number,number]}],
};

// Credits are a shelter wallet, never carried into combat. UTC days reset stock.
export const ECONOMY = {
  starterCredits: 200, dayMs: 86_400_000, offerMs: 48 * 3_600_000,
  maxAmount: 100_000, maxLines: 3, maxOpenOffers: 10, maxIncomingOffers: 20,
  sellDaily: 600, sellPerLevel: 150, expeditionDaily: 400,
  expeditionBase: 25, expeditionPerLevel: 5, questCredits: 100, collectionCredits: 50,
  sellRatio: .25, gearBase: 25, gearPerLevel: 12, bonusPrice: 5, traitPrice: 15,
  qualityPrice: { common: 1, uncommon: 2, rare: 4, epic: 10, legendary: 25 },
  epicSlots: 3, epicStock: 1, defaultSupplyPrice: 8,
  damagePrice: 2, armourPrice: 4, utilityPrice: 10,
  supplyPrice: { shot: 1, r22: 2, shell: 4, r556: 5, arrow: 2, bandage: 8, firstaid: 30, peaches: 6, smoke: 25, flare: 15, molotov: 30, mininuke: 400, rocket84: 150, heavyround: 12, cloth: 3, nails: 3, ducttape: 8, circuit: 20, sorbent: 15 },
  resourcePrice: { food: 3, water: 3, scrap: 8 },
} as const;

// Story journeys reuse ordinary solo combat; they are not a new gear tier.
export const HELEN_STORY = {
  ridge: { enemies: [{id:"feral-dog" as const,n:2}], km: 16, bearing: 350, exploreSec: 150, danger: 0.35, level: [5, 7] as [number, number] },
  weighbridge: { enemies: [{id:"raider" as const,n:2}], km: 18, bearing: 10, exploreSec: 180, danger: 0.55, level: [5, 7] as [number, number] },
};
