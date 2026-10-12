import { randomInt } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { BEAST, COMBAT, ESCAPE_CHANCE, GEAR, RESIDENTS, SUPPLIES, XP, type ResidentId, type Resource, type SupplyKind } from "./game/config.ts";
import { add, bitten, carry, escapes, exchange, halve, total, type Haul, type Turn } from "./game/character.ts";
import { destination, rollHoard, travelMs } from "./game/world.ts";
import { addSupply, awardXp, levelNote, loseCarried, memberOf, takeSupply, toughen, wordsFor } from "./character.ts";
import { findOnTrip } from "./items.ts";
import { tx } from "./db.ts";
import { loadForUpdate, log, type Member, type ShelterView } from "./shelter.ts";

// The scavenger beast at the Creature Nest: one encounter per trip there,
// fought in turns. Every roll is made here and stored with the turn, so a
// reload, a retry or a second tab replays it rather than rolling again.

export type EncounterState = "awaiting" | "combat" | "won" | "escaped" | "defeated";

export interface TurnView {
  n: number;
  action: "attack" | "escape" | "use";
  item: SupplyKind | null;
  playerHit: number;
  beastBite: number;
  playerHp: number;
  beastHp: number;
  outcome: string;
  escaped: boolean | null;
}

export interface EncounterView {
  id: number;
  state: EncounterState;
  escapeBonus: number;
  beastHp: number;
  beastMaxHp: number;
  escapeUsed: boolean;
  turns: number;
  carried: Haul;
  log: TurnView[];
}

interface EncounterRow {
  id: number;
  journey_id: number;
  shelter_id: number;
  character_id: number;
  state: EncounterState;
  beast_hp: number;
  escape_used: number;
  escape_roll: number | null;
  ammo_used: number;
  escape_bonus: number;
  beast_skips: number;
  first_hit: number;
  seal_used: number;
  turns: number;
  carried_json: string;
  announced: number;
  resolved_at: number | null;
}

export const isOpen = (state: EncounterState): boolean => state === "awaiting" || state === "combat";

export const encounterRow = (db: DatabaseSync, journeyId: number): EncounterRow | undefined =>
  db.prepare("SELECT * FROM encounters WHERE journey_id = ?").get(journeyId) as EncounterRow | undefined;

export function encounterView(db: DatabaseSync, row: EncounterRow): EncounterView {
  const turns = db
    .prepare("SELECT n, action, item, player_hit, beast_bite, player_hp, beast_hp, outcome FROM encounter_turns WHERE encounter_id = ? ORDER BY n")
    .all(row.id) as { n: number; action: "attack" | "escape" | "use"; item: SupplyKind | null; player_hit: number; beast_bite: number; player_hp: number; beast_hp: number; outcome: string }[];
  return {
    id: row.id,
    state: row.state,
    escapeBonus: row.escape_bonus,
    beastHp: row.beast_hp,
    beastMaxHp: BEAST.hp,
    escapeUsed: Boolean(row.escape_used),
    turns: row.turns,
    carried: JSON.parse(row.carried_json),
    log: turns.map((t) => ({
      n: t.n,
      action: t.action,
      item: t.item,
      playerHit: t.player_hit,
      beastBite: t.beast_bite,
      playerHp: t.player_hp,
      beastHp: t.beast_hp,
      outcome: t.outcome,
      escaped: t.action === "escape" ? t.outcome === "escaped" : null,
    })),
  };
}

const haulText = (h: Haul): string => {
  const parts = Object.entries(h).filter(([, n]) => (n ?? 0) > 0).map(([k, n]) => `${n} ${k[0].toUpperCase()}${k.slice(1)}`);
  return parts.length ? parts.join(", ") : "nothing";
};

export type FightResult = { ok: true; replay: boolean } | { ok: false; status: 400 | 404 | 409; reason: string };

// What a test can fix in place of the dice.
export interface Rolls {
  hit?: number;
  bite?: number;
  escape?: number;
  stagger?: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// How likely someone is to get away: the dogs know Toby; Lucky gear and a
// smoke canister lit this fight help anyone. Never certain.
const escapeChance = (m: Member, bonus = 0): number =>
  Math.min(0.95, (m.who === "you" ? ESCAPE_CHANCE : RESIDENTS[m.who as ResidentId]?.escape ?? ESCAPE_CHANCE) + (m.character.escape + bonus) / 100);
export const escapePct = (m: Member, bonus = 0): number => Math.round(escapeChance(m, bonus) * 100);

// The common checks: they're out, the beast is in front of them, and this
// request hasn't already been answered. `who` is whose fight it is.
function begin(db: DatabaseSync, userId: number, who: unknown, requestId: string, now: number):
  | { s: ShelterView; m: Member; e: EncounterRow; replay: false }
  | { replay: true }
  | { error: FightResult } {
  const s = loadForUpdate(db, "user_id", userId, now)!;
  const m = memberOf(s, who);
  // A final blow can already have brought them home. Replays still belong
  // to the same character, even after the journey has been settled.
  if (m && db.prepare("SELECT 1 FROM encounter_turns t JOIN encounters e ON e.id = t.encounter_id WHERE e.character_id = ? AND t.request_id = ?").get(m.id, requestId)) return { replay: true };
  const e = m?.journey ? encounterRow(db, m.journey.id) : undefined;
  if (e && db.prepare("SELECT 1 FROM encounter_turns WHERE encounter_id = ? AND request_id = ?").get(e.id, requestId)) return { replay: true };
  if (m?.journey?.automatic) return { error: { ok:false, status:409, reason:"This exploration fights automatically; no manual turns are needed." } };
  if (!m?.journey || !e) return { error: { ok: false, status: 409, reason: "There's nothing to fight right now." } };
  if (!isOpen(e.state)) return { error: { ok: false, status: 409, reason: "That fight is already over." } };
  if (m.journey.phase !== "encounter") return { error: { ok: false, status: 409, reason: "Nothing has found them yet." } };
  return { s, m, e, replay: false };
}

export function attack(db: DatabaseSync, userId: number, requestId: string, turn: number, now: number, rolls: Rolls = {}, who?: unknown): FightResult {
  if (!UUID.test(requestId)) return { ok: false, status: 400, reason: "That request was malformed. Reload and try again." };
  return tx(db, (): FightResult => {
    const b = begin(db, userId, who, requestId, now);
    if ("error" in b) return b.error;
    if (b.replay) return { ok: true, replay: true };
    const { s, m, e } = b;
    // a form drawn before the last blow (a second tab, an old page) is refused
    if (turn !== e.turns) return { ok: false, status: 409, reason: "The fight moved on since that page was drawn. Here's where it stands." };
    const c = m.character;
    // a ranged weapon fires one round from the pack; with none left it's a club
    const fired = Boolean(c.ammo && !c.clubbing && takeSupply(db, s.id, c.ammo, 1, { id: m.id, slot: "pack" }));
    const roll = rolls.hit ?? randomInt(c.damage[0], c.damage[1] + 1);
    // the beast has no armour: serrated edges bite; a brutal first blow lands harder
    const hit = roll + (c.traits.serrated ?? 0) + (e.first_hit && c.traits.brutal ? Math.floor((roll * c.traits.brutal) / 100) : 0);
    const bite = rolls.bite ?? randomInt(BEAST.bite[0], BEAST.bite[1] + 1);
    // a baton can stagger it out of its next bite
    const staggerPct = c.gear.weapon ? (GEAR[c.gear.weapon.kind].stagger ?? 0) : 0;
    const stagger = staggerPct > 0 && (rolls.stagger ?? randomInt(100)) < staggerPct;
    const t = sealed(db, e, c, exchange(c.hp, e.beast_hp, hit, bite, c.armour, { skip: e.beast_skips > 0, spiked: c.traits.spiked }));
    const n = e.turns + 1;
    db.prepare(
      `INSERT INTO encounter_turns (encounter_id, n, request_id, action, hit_roll, bite_roll, player_hit, beast_bite, player_hp, beast_hp, outcome, at)
       VALUES (?, ?, ?, 'attack', ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(e.id, n, requestId, roll, bite, t.playerHit, t.beastBite, t.playerHp, t.beastHp, t.outcome, now);
    db.prepare("UPDATE characters SET hp = ?, hp_at = ? WHERE id = ?").run(t.playerHp, now, m.id);
    db.prepare("UPDATE encounters SET beast_hp = ?, turns = ?, state = 'combat', first_hit = 0, ammo_used = ammo_used + ?, beast_skips = ? WHERE id = ?").run(
      t.beastHp, n, fired ? 1 : 0, Math.max(0, e.beast_skips - 1) + (stagger ? 1 : 0), e.id,
    );
    if (t.outcome !== "fighting") resolve(db, s, m, { ...e, beast_hp: t.beastHp, turns: n, ammo_used: e.ammo_used + (fired ? 1 : 0) }, t.outcome, now);
    return { ok: true, replay: false };
  });
}

export function escape(db: DatabaseSync, userId: number, requestId: string, now: number, rolls: Rolls = {}, who?: unknown): FightResult {
  if (!UUID.test(requestId)) return { ok: false, status: 400, reason: "That request was malformed. Reload and try again." };
  return tx(db, (): FightResult => {
    const b = begin(db, userId, who, requestId, now);
    if ("error" in b) return b.error;
    if (b.replay) return { ok: true, replay: true };
    const { s, m, e } = b;
    const you = m.who === "you";
    const roll = rolls.escape ?? randomInt(100);
    // spent by the same update that checks it's unspent: there is only one try
    const used = db.prepare("UPDATE encounters SET escape_used = 1, escape_roll = ? WHERE id = ? AND escape_used = 0").run(roll, e.id);
    if (used.changes !== 1) return { ok: false, status: 409, reason: you ? "You've already tried to run. Now you have to fight." : `${m.name}'s already tried to run. Now it's a fight.` };
    const ok = escapes(roll, escapeChance(m, e.escape_bonus));
    const n = e.turns + 1;
    db.prepare(
      `INSERT INTO encounter_turns (encounter_id, n, request_id, action, escape_roll, player_hp, beast_hp, outcome, at)
       VALUES (?, ?, ?, 'escape', ?, ?, ?, ?, ?)`,
    ).run(e.id, n, requestId, roll, m.character.hp, e.beast_hp, ok ? "escaped" : "caught", now);
    db.prepare("UPDATE encounters SET turns = ?, state = ? WHERE id = ?").run(n, ok ? e.state : "combat", e.id);
    if (ok) resolve(db, s, m, { ...e, turns: n }, "escaped", now);
    else log(db, s.id, now, "danger", you
      ? `You tried to slip away from the ${BEAST.name.toLowerCase()}, but it cut you off. There's no running now: you have to fight.`
      : `${m.name} tried to slip away from the ${BEAST.name.toLowerCase()}, but it cut them off. No running now: it's a fight.`);
    return { ok: true, replay: false };
  });
}

// Using something from the belt takes a turn. Healing and a Molotov let the
// beast bite back; smoke readies an escape; a flare scatters it, no bite.
export function useItem(db: DatabaseSync, userId: number, requestId: string, turn: number, item: string, now: number, rolls: Rolls = {}, who?: unknown): FightResult {
  if (!UUID.test(requestId)) return { ok: false, status: 400, reason: "That request was malformed. Reload and try again." };
  const k = item as SupplyKind;
  const def = SUPPLIES[k];
  if (!def || !Object.hasOwn(SUPPLIES, item) || def.type !== "consumable") return { ok: false, status: 400, reason: "That can't be used in a fight." };
  return tx(db, (): FightResult => {
    const b = begin(db, userId, who, requestId, now);
    if ("error" in b) return b.error;
    if (b.replay) return { ok: true, replay: true };
    const { s, m, e } = b;
    if (turn !== e.turns) return { ok: false, status: 409, reason: "The fight moved on since that page was drawn. Here's where it stands." };
    if (k === "smoke" && e.escape_used) return { ok: false, status: 409, reason: "There's no running now; smoke won't help." };
    if (!takeSupply(db, s.id, k, 1, { id: m.id, slot: "belt" })) return { ok: false, status: 409, reason: `There's no ${def.name.toLowerCase()} on the belt.` };
    const c = m.character;
    const bite = rolls.bite ?? randomInt(BEAST.bite[0], BEAST.bite[1] + 1);
    let hp = Math.min(c.maxHp, c.hp + (def.heal ?? 0));
    let beastHp = e.beast_hp - (k === "molotov" ? MOLOTOV : 0);
    let t = beastHp <= 0
      ? { playerHit: MOLOTOV, beastHp: 0, beastBite: 0, playerHp: hp, outcome: "won" as const }
      : sealed(db, e, c, bitten(hp, beastHp, k === "molotov" ? MOLOTOV : 0, bite, c.armour, { skip: k === "flare" || e.beast_skips > 0, spiked: c.traits.spiked }));
    hp = t.playerHp;
    beastHp = t.beastHp;
    const n = e.turns + 1;
    db.prepare(
      `INSERT INTO encounter_turns (encounter_id, n, request_id, action, item, bite_roll, player_hit, beast_bite, player_hp, beast_hp, outcome, at)
       VALUES (?, ?, ?, 'use', ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(e.id, n, requestId, k, bite, t.playerHit, t.beastBite, hp, beastHp, t.outcome, now);
    db.prepare("UPDATE characters SET hp = ?, hp_at = ? WHERE id = ?").run(hp, now, m.id);
    db.prepare("UPDATE encounters SET beast_hp = ?, turns = ?, state = 'combat', escape_bonus = escape_bonus + ?, beast_skips = ? WHERE id = ?").run(
      beastHp, n, def.escape ?? 0, k === "flare" ? e.beast_skips : Math.max(0, e.beast_skips - 1), e.id,
    );
    if (t.outcome !== "fighting") resolve(db, s, m, { ...e, beast_hp: beastHp, turns: n }, t.outcome, now);
    return { ok: true, replay: false };
  });
}
const MOLOTOV = COMBAT.molotov;

// A Last-seal Legendary turns the blow that would drop its wearer into 1 HP, once a fight.
function sealed(db: DatabaseSync, e: EncounterRow, c: Member["character"], t: Turn): Turn {
  if (t.outcome !== "defeated" || !c.traits.lastseal || e.seal_used) return t;
  db.prepare("UPDATE encounters SET seal_used = 1 WHERE id = ?").run(e.id);
  return { ...t, playerHp: 1, outcome: "fighting" };
}

// Ends the fight: settles what's carried, gear, experience, and starts the
// walk home. Runs once, inside the transaction of the action that ended it.
function resolve(db: DatabaseSync, s: ShelterView, m: Member, e: EncounterRow, outcome: "won" | "escaped" | "defeated", now: number): void {
  const j = m.journey!;
  const you = m.who === "you";
  const They = you ? "You" : m.name;
  const w = wordsFor(m.who);
  const their = w.their;
  const d = destination(j.targetId)!;
  let carried: Haul = JSON.parse(e.carried_json);
  let message: string;
  if (outcome === "won") {
    const room = m.character.capacity - total(carried);
    const hoard = carry(rollHoard(j.id), room);
    carried = add(carried, hoard.carried);
    // its hoard always has one piece of equipment in it
    const found = findOnTrip(db, s.id, "beast", j.id, now, 1);
    // arrows and shot that missed or went through are picked up after
    const w0 = m.character.gear.weapon ? GEAR[m.character.gear.weapon.kind] : undefined;
    const back = w0?.ammo && w0.recover ? Math.floor(e.ammo_used * w0.recover) : 0;
    if (back > 0) addSupply(db, s.id, w0!.ammo!, back, now, { id: m.id, slot: "pack" });
    const xp = awardXp(db, m.id, XP.won);
    // surviving the nest still toughens them for raids and for keeping watch
    toughen(db, m.id);
    message =
      `${They} killed the ${BEAST.name.toLowerCase()}. Its hoard: ${haulText(hoard.carried)}` +
      (hoard.left > 0 ? ` (${hoard.left} left behind, ${their} pack is full)` : "") +
      `.${found}${back > 0 ? ` Picked up ${back} ${SUPPLIES[w0!.ammo!].name.toLowerCase()}.` : ""} +${XP.won} XP.${levelNote(xp)} Heading home.`;
  } else if (outcome === "escaped") {
    const before = carried;
    carried = halve(carried);
    const xp = awardXp(db, m.id, XP.escaped);
    message = `${They} got away from the ${BEAST.name.toLowerCase()}, dropping half of what ${w.had} found: kept ${haulText(carried)} of ${haulText(before)}. ${w.their[0].toUpperCase() + w.their.slice(1)} gear is safe. +${XP.escaped} XP.${levelNote(xp)} Heading home.`;
  } else {
    // only what the fallen one was carrying is lost; nobody else's gear
    const lost = loseCarried(db, m.id);
    message = `The ${BEAST.name.toLowerCase()} brought ${you ? "you" : m.name} down. ${They} crawled away with nothing: lost ${lost.length ? lost.join(", ") : "no gear"} and ${haulText(carried)}. Wounded, heading home. The stash and the shelter's stock are untouched.`;
    carried = {};
  }
  db.prepare("UPDATE encounters SET state = ?, carried_json = ?, resolved_at = ? WHERE id = ?").run(outcome, JSON.stringify(carried), now, e.id);
  // Exploration ends now; demo travel returns them immediately.
  db.prepare("UPDATE journeys SET explore_until = ?, return_at = ? WHERE id = ?").run(now, now + travelMs(d), j.id);
  log(db, s.id, now, outcome === "defeated" ? "danger" : outcome === "won" ? "loot" : "info", message);
}

export const ESCAPE_PCT = Math.round(ESCAPE_CHANCE * 100);
export type { Resource };
