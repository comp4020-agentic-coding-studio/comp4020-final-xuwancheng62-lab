import { randomInt } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { BEAST, ESCAPE_CHANCE, GEAR, RESIDENTS, XP, type ResidentId, type Resource } from "./game/config.ts";
import { add, carry, escapes, exchange, halve, total, type Haul } from "./game/character.ts";
import { destination, rollHoard, travelMs } from "./game/world.ts";
import { awardXp, firstMissing, grantItem, levelNote, memberOf, toughen, wordsFor } from "./character.ts";
import { tx } from "./db.ts";
import { loadForUpdate, log, type Member, type ShelterView } from "./shelter.ts";

// The scavenger beast at the Creature Nest: one encounter per trip there,
// fought in turns. Every roll is made here and stored with the turn, so a
// reload, a retry or a second tab replays it rather than rolling again.

export type EncounterState = "awaiting" | "combat" | "won" | "escaped" | "defeated";

export interface TurnView {
  n: number;
  action: "attack" | "escape";
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
    .prepare("SELECT n, action, player_hit, beast_bite, player_hp, beast_hp, outcome FROM encounter_turns WHERE encounter_id = ? ORDER BY n")
    .all(row.id) as { n: number; action: "attack" | "escape"; player_hit: number; beast_bite: number; player_hp: number; beast_hp: number; outcome: string }[];
  return {
    id: row.id,
    state: row.state,
    beastHp: row.beast_hp,
    beastMaxHp: BEAST.hp,
    escapeUsed: Boolean(row.escape_used),
    turns: row.turns,
    carried: JSON.parse(row.carried_json),
    log: turns.map((t) => ({
      n: t.n,
      action: t.action,
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
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// How likely someone is to get away: the dogs know Toby.
const escapeChance = (m: Member): number => (m.who === "you" ? ESCAPE_CHANCE : RESIDENTS[m.who as ResidentId]?.escape ?? ESCAPE_CHANCE);
export const escapePct = (m: Member): number => Math.round(escapeChance(m) * 100);

// The common checks: they're out, the beast is in front of them, and this
// request hasn't already been answered. `who` is whose fight it is.
function begin(db: DatabaseSync, userId: number, who: unknown, requestId: string, now: number):
  | { s: ShelterView; m: Member; e: EncounterRow; replay: false }
  | { replay: true }
  | { error: FightResult } {
  const s = loadForUpdate(db, "user_id", userId, now)!;
  const m = memberOf(s, who);
  const e = m?.journey ? encounterRow(db, m.journey.id) : undefined;
  if (e && db.prepare("SELECT 1 FROM encounter_turns WHERE encounter_id = ? AND request_id = ?").get(e.id, requestId)) return { replay: true };
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
    const hit = rolls.hit ?? randomInt(c.damage[0], c.damage[1] + 1);
    const bite = rolls.bite ?? randomInt(BEAST.bite[0], BEAST.bite[1] + 1);
    const t = exchange(c.hp, e.beast_hp, hit, bite, c.gear);
    const n = e.turns + 1;
    db.prepare(
      `INSERT INTO encounter_turns (encounter_id, n, request_id, action, hit_roll, bite_roll, player_hit, beast_bite, player_hp, beast_hp, outcome, at)
       VALUES (?, ?, ?, 'attack', ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(e.id, n, requestId, hit, bite, t.playerHit, t.beastBite, t.playerHp, t.beastHp, t.outcome, now);
    db.prepare("UPDATE characters SET hp = ?, hp_at = ? WHERE id = ?").run(t.playerHp, now, m.id);
    db.prepare("UPDATE encounters SET beast_hp = ?, turns = ?, state = 'combat' WHERE id = ?").run(t.beastHp, n, e.id);
    if (t.outcome !== "fighting") resolve(db, s, m, { ...e, beast_hp: t.beastHp, turns: n }, t.outcome, now);
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
    const ok = escapes(roll, escapeChance(m));
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
    const prize = firstMissing(db, m.id, BEAST.gear);
    if (prize) grantItem(db, m.id, prize, now);
    const xp = awardXp(db, m.id, XP.won);
    // surviving the nest still toughens them for raids and for keeping watch
    toughen(db, m.id);
    message =
      `${They} killed the ${BEAST.name.toLowerCase()}. Its hoard: ${haulText(hoard.carried)}` +
      (hoard.left > 0 ? ` (${hoard.left} left behind, ${their} pack is full)` : "") +
      (prize ? `, and a ${GEAR[prize].name.toLowerCase()}, waiting in storage at home` : "") +
      `. +${XP.won} XP.${levelNote(xp)} Heading home.`;
  } else if (outcome === "escaped") {
    const before = carried;
    carried = halve(carried);
    const xp = awardXp(db, m.id, XP.escaped);
    message = `${They} got away from the ${BEAST.name.toLowerCase()}, dropping half of what ${w.had} found: kept ${haulText(carried)} of ${haulText(before)}. ${w.their[0].toUpperCase() + w.their.slice(1)} gear is safe. +${XP.escaped} XP.${levelNote(xp)} Heading home.`;
  } else {
    // only what the fallen one was carrying is lost; nobody else's gear
    const lost = (db.prepare("SELECT kind FROM items WHERE character_id = ? AND equipped = 1").all(m.id) as { kind: keyof typeof GEAR }[]).map((r) => GEAR[r.kind].name.toLowerCase());
    db.prepare("DELETE FROM items WHERE character_id = ? AND equipped = 1").run(m.id);
    message = `The ${BEAST.name.toLowerCase()} brought ${you ? "you" : m.name} down. ${They} crawled away with nothing: lost ${lost.length ? lost.join(", ") : "no gear"} and ${haulText(carried)}. Wounded, heading home. Stored gear and the shelter's stock are untouched.`;
    carried = {};
  }
  db.prepare("UPDATE encounters SET state = ?, carried_json = ?, resolved_at = ? WHERE id = ?").run(outcome, JSON.stringify(carried), now, e.id);
  // exploring ends now; the walk home is the normal one
  db.prepare("UPDATE journeys SET explore_until = ?, return_at = ? WHERE id = ?").run(now, now + travelMs(d), j.id);
  log(db, s.id, now, outcome === "defeated" ? "danger" : outcome === "won" ? "loot" : "info", message);
}

export const ESCAPE_PCT = Math.round(ESCAPE_CHANCE * 100);
export type { Resource };
