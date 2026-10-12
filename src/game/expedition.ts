import { LOWER_DECK, type DungeonDef } from "./dungeons.ts";
import { CHARACTER, COMBAT, EXPEDITION_TRAVEL_MULTIPLIER, GEAR, SUPPLIES, type RoomDef, type SupplyKind } from "./config.ts";
import { enemyFighter, fight, memberFighter, tryEscape, type Fighter, type PartyMember, type RetreatRule } from "./combat.ts";
import { between, effective, packLoad, rollDrop, rollPiece, type Gear, type Supplies } from "./items.ts";
import { seeded } from "./rng.ts";

// An expedition through the Lower Deck (PLAN.md, "Expeditions"), as one
// pure function: the party and a seed in, every event with its time out.
// It is run once, at departure, and revealed as the clock passes; nothing
// about it depends on anyone being online.

export type Approach = "sneak" | "fight";
export interface Expedition {
  dungeon?: DungeonDef;
  seed: number;
  members: PartyMember[];
  approach: Approach;
  retreat: RetreatRule;
  // records any member's shelter holds, for what they unlock down there
  records: readonly string[];
  players: number;
}

export interface RunEvent {
  at: number; // ms after departure
  room: string;
  tone: "info" | "danger" | "loot";
  text: string;
}
export type Resources = { food: number; water: number; scrap: number };
export interface RunResult {
  outcome: "cleared" | "turned-back" | "wiped";
  events: RunEvent[];
  endsAt: number;
  cleared: string[];
  members: { key: string; hp: number; down: boolean; belt: Supplies; pack: Supplies; shots: number }[];
  loot: { resources: Resources; supplies: Supplies; gear: Gear[] };
}

const addSupplies = (a: Supplies, b: Supplies) => {
  for (const [k, n] of Object.entries(b) as [SupplyKind, number][]) a[k] = (a[k] ?? 0) + n;
};
const halveAll = (s: Supplies): Supplies =>
  Object.fromEntries((Object.entries(s) as [SupplyKind, number][]).map(([k, n]) => [k, Math.floor(n / 2)]).filter(([, n]) => (n as number) > 0));

// Does anyone carry light, or anything that opens a lock?
const lit = (ms: readonly PartyMember[]) => ms.some((m) => (m.gear.tool && GEAR[m.gear.tool.kind].light) || effective(m.body, m.gear).traits.bright);
const opener = (ms: readonly PartyMember[]) => ms.find((m) => (m.gear.weapon && GEAR[m.gear.weapon.kind].opens) || (m.gear.tool && GEAR[m.gear.tool.kind].opens));

export function runExpedition(x: Expedition): RunResult {
  const def = x.dungeon ?? LOWER_DECK;
  const rng = seeded(x.seed);
  const rooms = def.rooms;
  const party: Fighter[] = x.members.map(memberFighter);
  const events: RunEvent[] = [];
  const loot = { resources: { food: 0, water: 0, scrap: 0 }, supplies: {} as Supplies, gear: [] as Gear[] };
  const cleared: string[] = [];
  let t = def.travelMs * EXPEDITION_TRAVEL_MULTIPLIER;
  let outcome: RunResult["outcome"] = "cleared";
  const say = (room: string, text: string, tone: RunEvent["tone"] = "info") => events.push({ at: t, room, tone, text });
  say(def.rooms[0]?.id ?? "arrival", `${x.members.map((m) => m.name).join(", ")} ${def.arrivalText}`);

  for (const room of rooms as RoomDef[]) {
    if (room.needs && x.players < room.needs.players) {
      say(room.id, room.needs.text ?? `It takes ${room.needs.players} people. They turned back.`, "danger");
      outcome = "turned-back";
      break;
    }
    say(room.id, room.text);
    let fought = false;
    let skipped = false;
    let molotovs = 0;
    let rockets = 0;
    if (room.enemies?.length) {
      const enemies = room.enemies.flatMap((e) => Array.from({ length: e.n }, (_, i) => enemyFighter(e.id, i)));
      const wave = room.wave ? Array.from({ length: room.wave.n }, (_, i) => enemyFighter(room.wave!.id, 100 + i)) : [];
      let ambush: "party" | "enemy" | null = room.dark ? (lit(x.members) ? "party" : "enemy") : null;
      if (room.standDown && x.records.includes(room.standDown)) {
        say(room.id, room.standDownText ?? "Their information let them pass without a fight.", "loot");
        skipped = false;
      } else {
        const log: string[] = [];
        if (room.optional && x.approach === "sneak") {
          if (tryEscape(rng, party, 0, log, "They tried to slip past")) skipped = true;
          else ambush = "enemy";
        }
        for (const line of log) say(room.id, line, "info");
        if (!skipped) {
          fought = true;
          const r = fight(rng, party, enemies, { ambush, wave, retreat: x.retreat });
          molotovs = r.molotovs;
          rockets = r.rockets;
          for (const line of r.log) say(room.id, line, line.includes("the others will carry") || line.includes("No running") ? "danger" : "info");
          t += r.rounds * COMBAT.roundMs;
          if (r.result === "wiped") {
            say(room.id, "Nobody was left standing. They dragged each other out, with nothing.", "danger");
            outcome = "wiped";
            break;
          }
          if (r.result === "escaped") {
            say(room.id, "They turned back, carrying half of what they'd found.", "danger");
            outcome = "turned-back";
            break;
          }
          say(room.id, `They cleared ${room.name.replace(/^The /, "the ")}.`, "loot");
        }
      }
    }
    t += room.ms;
    if (skipped) {
      say(room.id, room.skippedText ?? `They slipped past ${room.name}.`);
      continue;
    }
    if (room.locked) {
      const o = opener(x.members);
      if (!o) {
        say(room.id, "Nobody had anything to open it with.");
        continue;
      }
      say(room.id, `${o.name} got it open.`);
    }
    cleared.push(room.id);
    if (room.find) {
      const d = rollDrop(rng, def.drops[room.find]);
      addSupplies(loot.supplies, d.supplies);
      if (d.gear) loot.gear.push(d.gear);
    }
    if (room.knack && x.members.some((m) => m.who === room.knack!.resident)) {
      loot.resources.water += room.knack.water;
      say(room.id, room.knack.text, "loot");
    }
    if (room.hoard) {
      const h = def.hoard;
      loot.resources.food += between(rng, h.food);
      loot.resources.water += between(rng, h.water);
      loot.resources.scrap += between(rng, h.scrap);
      for (let i = 0; i < def.storesGear; i++) loot.gear.push(rollPiece(rng, def.drops[def.hoardDrop]));
      // what a fight in here did to it: fire takes food, a rocket takes everything
      if (molotovs) {
        const before = loot.resources.food;
        loot.resources.food = Math.floor(before * Math.max(0, 1 - COMBAT.molotovBurns * molotovs));
        if (before > loot.resources.food) say(room.id, `The fire took ${before - loot.resources.food} Food in the fight.`, "danger");
      }
      if (rockets) {
        const keep = (1 - COMBAT.launcherWrecks) ** rockets;
        for (const k of ["food", "water", "scrap"] as const) loot.resources[k] = Math.floor(loot.resources[k] * keep);
        loot.gear.splice(Math.max(0, loot.gear.length - rockets));
        say(room.id, "The blast wrecked half of what was on the shelves.", "danger");
      }
    }
    if (!fought) continue;
    // a breather: anyone hurt opens a tin of peaches
    for (const f of party) {
      if (f.hp > 0 && f.hp < f.maxHp * 0.7 && (f.belt.peaches ?? 0) > 0) {
        f.belt.peaches! -= 1;
        f.hp = Math.min(f.maxHp, f.hp + (SUPPLIES.peaches.heal ?? 0));
        say(room.id, `${f.name} ate a tin of peaches.`);
      }
    }
  }

  // what they carry out: the party's pockets cap the supplies they bring home
  if (outcome === "wiped") {
    loot.resources = { food: 0, water: 0, scrap: 0 };
    loot.supplies = {};
    loot.gear = [];
  } else {
    if (outcome === "turned-back") {
      loot.resources = { food: Math.floor(loot.resources.food / 2), water: Math.floor(loot.resources.water / 2), scrap: Math.floor(loot.resources.scrap / 2) };
      loot.supplies = halveAll(loot.supplies);
      loot.gear = loot.gear.slice(0, Math.floor(loot.gear.length / 2));
    }
    const room = x.members.reduce((a, m) => a + Math.max(0, effective(m.body, m.gear, m.pack).capacity - packLoad(m.pack)), 0);
    let over = loot.resources.food + loot.resources.water + loot.resources.scrap - room;
    for (const k of ["scrap", "water", "food"] as const) {
      const cut = Math.min(over, loot.resources[k]);
      if (cut <= 0) continue;
      loot.resources[k] -= cut;
      over -= cut;
    }
    if (outcome === "cleared") say(def.rooms.at(-1)?.id ?? "return", def.successText, "loot");
  }
  // arrows and shot are picked up after, unless nobody walked out
  if (outcome !== "wiped")
    for (const f of party) {
      const m = x.members.find((y) => y.key === f.key)!;
      const w = m.gear.weapon ? GEAR[m.gear.weapon.kind] : undefined;
      if (w?.ammo && w.recover && f.shots) f.pack[w.ammo] = (f.pack[w.ammo] ?? 0) + Math.floor(f.shots * w.recover);
    }
  t += def.travelMs * EXPEDITION_TRAVEL_MULTIPLIER;
  return {
    outcome,
    events,
    endsAt: t,
    cleared,
    members: party.map((f) => ({ key: f.key, hp: f.hp, down: f.hp <= 0, belt: f.belt, pack: f.pack, shots: f.shots })),
    loot,
  };
}

// Sharing out (PLAN.md, "The loop"): equipment dealt at random but evenly,
// round the table from a random seat; everything else split equally, what
// doesn't divide going to seats at random. Seeded, so it's decided once.
export interface Share {
  resources: Resources;
  supplies: Supplies;
  gear: Gear[];
}
export function shareLoot(seed: number, seats: number, loot: RunResult["loot"]): Share[] {
  const rng = seeded(seed * 31 + 7);
  const out: Share[] = Array.from({ length: seats }, () => ({ resources: { food: 0, water: 0, scrap: 0 }, supplies: {}, gear: [] }));
  if (!seats) return out;
  const start = Math.floor(rng() * seats);
  loot.gear.forEach((g, i) => out[(start + i) % seats].gear.push(g));
  const deal = (n: number, give: (seat: number, k: number) => void) => {
    const each = Math.floor(n / seats);
    for (let i = 0; i < seats; i++) if (each) give(i, each);
    const lucky = [...Array(seats).keys()];
    for (let i = lucky.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [lucky[i], lucky[j]] = [lucky[j], lucky[i]];
    }
    for (let i = 0; i < n % seats; i++) give(lucky[i], 1);
  };
  for (const k of ["food", "water", "scrap"] as const) deal(loot.resources[k], (i, n) => (out[i].resources[k] += n));
  for (const [k, n] of Object.entries(loot.supplies) as [SupplyKind, number][]) deal(n, (i, m) => (out[i].supplies[k] = (out[i].supplies[k] ?? 0) + m));
  return out;
}

// How likely this party is to clear it: a band from many runs, never a
// number to game.
export type Readiness = "likely" | "risky" | "grim";
export function readiness(x: Omit<Expedition, "seed">, runs = (x.dungeon ?? LOWER_DECK).readiness.runs): { band: Readiness; share: number } {
  const def = x.dungeon ?? LOWER_DECK;
  let won = 0;
  for (let i = 1; i <= runs; i++) if (runExpedition({ ...x, seed: i * 7919 }).outcome === "cleared") won += 1;
  const share = won / runs;
  return { band: share >= def.readiness.likely ? "likely" : share >= def.readiness.risky ? "risky" : "grim", share };
}

// Who can go at all: a minimum the recruit card shows.
export const fitToGo = (m: PartyMember): string | null => (m.hp < CHARACTER.travelMinHp ? `Needs ${CHARACTER.travelMinHp} HP` : null);
