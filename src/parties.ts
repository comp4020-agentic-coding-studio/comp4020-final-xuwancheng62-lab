import { randomInt } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { CHARACTER, DISPATCH_DEFAULTS, LOWER_DECK, RESIDENTS, TIME_SCALE, WORLD_CHAT, type ResidentId, type SupplyKind } from "./game/config.ts";
import type { LiveEvent } from "./realtime.ts";
import { chatEvent, postRecruit } from "./worldChat.ts";
import type { PartyMember, RetreatRule, Row } from "./game/combat.ts";
import { readiness, runExpedition, shareLoot, type Approach, type Readiness, type RunEvent, type RunResult, type Share } from "./game/expedition.ts";
import { CLEARED } from "./game/quests.ts";
import { addSupply, awardXp, grantGear, levelNote, loseCarried, type CharacterRow } from "./character.ts";
import { tx } from "./db.ts";
import { suppliesText } from "./items.ts";
import { loadForUpdate, log, type Member, type ShelterView } from "./shelter.ts";
import type { Stock } from "./game/resources.ts";
import { foundIds } from "./stories.ts";

// Parties, friends and dispatch (PLAN.md, "Expeditions, parties and
// items"). A party musters one character per player; when it fills, the run
// is decided from its seed and each seat's share written, and each seat
// becomes a journey that its own shelter settles when it's next loaded.

export interface PartyRow {
  id: number;
  dungeon: string;
  leader_user_id: number;
  size: number;
  approach: Approach;
  retreat: RetreatRule;
  min_level: number;
  state: "mustering" | "out" | "expired";
  readiness: Readiness | null;
  seed: number;
  created_at: number;
  expires_at: number;
  departed_at: number | null;
  ends_at: number | null;
  result_json: string | null;
}
export interface SeatRow {
  id: number;
  party_id: number;
  user_id: number;
  shelter_id: number;
  character_id: number;
  row: Row;
  dispatched_by: number | null;
  food: number;
  water: number;
  active: number;
  share_json: string | null;
  joined_at: number;
}
export interface SeatView extends SeatRow {
  owner: string;
  who: string;
  name: string;
  level: number;
  dispatcher: string | null;
}
export interface PartyView extends PartyRow {
  leader: string;
  seats: SeatView[];
  result: RunResult | null;
}

export type PartyResult = { ok: true; message: string; partyId?: number; events?: LiveEvent[] } | { ok: false; status: 400 | 403 | 404 | 409 | 429; reason: string };
const no = (status: 400 | 403 | 404 | 409 | 429, reason: string): PartyResult => ({ ok: false, status, reason });

// Live news of a party: its card wherever it's shown, and a word to whoever's in it.
const alert = (userId: number, tone: "ok" | "bad", message: string): LiveEvent => ({ channel: `user:${userId}`, event: "alert", data: { tone, message } });
function partyNews(db: DatabaseSync, partyId: number): LiveEvent[] {
  const p = partyRow(db, partyId);
  if (!p) return [];
  const v = partyView(db, p);
  const data = { id: p.id, filled: v.seats.length, size: p.size, readiness: p.readiness, state: p.state, names: v.seats.map((x) => x.name) };
  return [{ channel: "world", event: "party", data }];
}

const BANDS: Readiness[] = ["likely", "risky", "grim"];
export const worse = (a: Readiness, b: Readiness) => BANDS.indexOf(a) > BANDS.indexOf(b);

export const partyRow = (db: DatabaseSync, id: number) => db.prepare("SELECT * FROM parties WHERE id = ?").get(id) as PartyRow | undefined;
const seatRows = (db: DatabaseSync, partyId: number) => db.prepare("SELECT * FROM party_seats WHERE party_id = ? ORDER BY id").all(partyId) as unknown as SeatRow[];
const username = (db: DatabaseSync, userId: number) => (db.prepare("SELECT username FROM users WHERE id = ?").get(userId) as { username: string } | undefined)?.username ?? "someone";

export function partyView(db: DatabaseSync, p: PartyRow): PartyView {
  const seats = db
    .prepare(
      `SELECT s.*, u.username AS owner, c.who, c.level, d.username AS dispatcher
       FROM party_seats s JOIN users u ON u.id = s.user_id JOIN characters c ON c.id = s.character_id LEFT JOIN users d ON d.id = s.dispatched_by
       WHERE s.party_id = ? ORDER BY s.id`,
    )
    .all(p.id) as unknown as (SeatRow & { owner: string; who: string; level: number; dispatcher: string | null })[];
  return {
    ...p,
    leader: username(db, p.leader_user_id),
    seats: seats.map((s) => ({ ...s, name: s.who === "you" ? s.owner : `${RESIDENTS[s.who as ResidentId]?.name ?? s.who} (${s.owner}'s)` })),
    result: p.result_json ? JSON.parse(p.result_json) : null,
  };
}

// Parties still gathering, and the ones still out, newest first.
export const openParties = (db: DatabaseSync, now: number): PartyView[] =>
  (db.prepare("SELECT * FROM parties WHERE state = 'mustering' OR (state = 'out' AND ends_at > ?) ORDER BY state = 'out', id DESC LIMIT 30").all(now) as unknown as PartyRow[]).map((p) => partyView(db, p));

// Runs someone of yours went on that are over, newest first: their whole story.
export const pastParties = (db: DatabaseSync, userId: number, now: number, limit = 5): PartyView[] =>
  (db
    .prepare("SELECT p.* FROM parties p WHERE p.state = 'out' AND p.ends_at <= ? AND EXISTS (SELECT 1 FROM party_seats s WHERE s.party_id = p.id AND s.user_id = ?) ORDER BY p.ends_at DESC LIMIT ?")
    .all(now, userId, limit) as unknown as PartyRow[]).map((p) => partyView(db, p));

// The seat a character holds while a party gathers, if any.
export const musteringSeat = (db: DatabaseSync, characterId: number) =>
  db.prepare("SELECT * FROM party_seats WHERE character_id = ? AND active = 1").get(characterId) as SeatRow | undefined;

// What the Shelter page says about someone and a party.
export function partyOfMember(db: DatabaseSync, characterId: number, partyId: number | null): { mustering: boolean; sentBy: string | null } | null {
  const seat = partyId === null
    ? musteringSeat(db, characterId)
    : (db.prepare("SELECT * FROM party_seats WHERE party_id = ? AND character_id = ?").get(partyId, characterId) as SeatRow | undefined);
  if (!seat) return null;
  return { mustering: seat.active === 1, sentBy: seat.dispatched_by ? username(db, seat.dispatched_by) : null };
}

// ---- friends and dispatch

const pair = (x: number, y: number) => (x < y ? [x, y] : [y, x]);
export const areFriends = (db: DatabaseSync, x: number, y: number) => Boolean(db.prepare("SELECT 1 FROM friends WHERE a = ? AND b = ? AND accepted_at IS NOT NULL").get(...pair(x, y)));

export interface Friend {
  userId: number;
  username: string;
  accepted: boolean;
  askedByMe: boolean;
}
export function friendsOf(db: DatabaseSync, userId: number): Friend[] {
  const rows = db
    .prepare(
      `SELECT f.*, u.username FROM friends f JOIN users u ON u.id = CASE WHEN f.a = ? THEN f.b ELSE f.a END
       WHERE f.a = ? OR f.b = ? ORDER BY u.username`,
    )
    .all(userId, userId, userId) as { a: number; b: number; requested_by: number; accepted_at: number | null; username: string }[];
  return rows.map((r) => ({ userId: r.a === userId ? r.b : r.a, username: r.username, accepted: r.accepted_at !== null, askedByMe: r.requested_by === userId }));
}

export function befriend(db: DatabaseSync, userId: number, name: string, now: number): PartyResult {
  return tx(db, (): PartyResult => {
    const other = db.prepare("SELECT id, username FROM users WHERE username = ?").get(name.trim()) as { id: number; username: string } | undefined;
    if (!other) return no(404, "Nobody goes by that name.");
    if (other.id === userId) return no(400, "You can't befriend yourself.");
    const [a, b] = pair(userId, other.id);
    const row = db.prepare("SELECT * FROM friends WHERE a = ? AND b = ?").get(a, b) as { requested_by: number; accepted_at: number | null } | undefined;
    if (row?.accepted_at) return { ok: true, message: `You and ${other.username} are already friends.` };
    if (row && row.requested_by !== userId) {
      // they asked first: asking back is saying yes
      db.prepare("UPDATE friends SET accepted_at = ? WHERE a = ? AND b = ?").run(now, a, b);
      return { ok: true, message: `You and ${other.username} are friends now.` };
    }
    if (row) return { ok: true, message: `You've asked ${other.username} already.` };
    db.prepare("INSERT INTO friends (a, b, requested_by, created_at) VALUES (?, ?, ?, ?)").run(a, b, userId, now);
    return { ok: true, message: `Asked ${other.username}. You're friends once they say yes.` };
  });
}

export function unfriend(db: DatabaseSync, userId: number, otherId: number): PartyResult {
  return tx(db, (): PartyResult => {
    const [a, b] = pair(userId, otherId);
    const gone = db.prepare("DELETE FROM friends WHERE a = ? AND b = ?").run(a, b).changes;
    return gone ? { ok: true, message: "Done." } : no(404, "You aren't friends.");
  });
}

export interface Dispatch {
  who: string;
  enabled: boolean;
  risk: Readiness;
  row: Row;
  keepFood: number;
  keepWater: number;
}
export function dispatchOf(db: DatabaseSync, userId: number): Dispatch {
  const r = db.prepare("SELECT * FROM dispatch WHERE user_id = ?").get(userId) as
    | { who: string; enabled: number; risk: Readiness; row: Row; keep_food: number; keep_water: number }
    | undefined;
  if (!r) return { ...DISPATCH_DEFAULTS };
  return { who: r.who, enabled: Boolean(r.enabled), risk: r.risk, row: r.row, keepFood: r.keep_food, keepWater: r.keep_water };
}

export function setDispatch(db: DatabaseSync, userId: number, f: Record<string, unknown>, now: number): PartyResult {
  const risk = String(f.risk ?? "") as Readiness;
  const row = String(f.row ?? "") as Row;
  const keepFood = Number(f.keep_food);
  const keepWater = Number(f.keep_water);
  const who = String(f.who ?? "");
  if (!BANDS.includes(risk) || (row !== "front" && row !== "back") || !Number.isInteger(keepFood) || !Number.isInteger(keepWater) || keepFood < 0 || keepWater < 0 || keepFood > 999 || keepWater > 999)
    return no(400, "Those settings don't make sense.");
  return tx(db, (): PartyResult => {
    const s = loadForUpdate(db, "user_id", userId, now)!;
    const off = who === "off";
    if (!off && !s.crew.some((m) => m.who === who)) return no(400, "Nobody by that name lives with you.");
    db.prepare(
      `INSERT INTO dispatch (user_id, who, enabled, risk, row, keep_food, keep_water) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET who = excluded.who, enabled = excluded.enabled, risk = excluded.risk, row = excluded.row, keep_food = excluded.keep_food, keep_water = excluded.keep_water`,
    ).run(userId, off ? dispatchOf(db, userId).who : who, off ? 0 : 1, risk, row, keepFood, keepWater);
    return { ok: true, message: off ? "Friends can't send anyone of yours now." : "Saved." };
  });
}

// ---- the party itself

// Who a seat would bring, as they are right now.
function snapshot(s: ShelterView, m: Member, row: Row): PartyMember {
  const c = m.character;
  return { key: `c${m.id}`, name: m.who === "you" ? s.owner : m.name, who: m.who, hp: c.hp, body: c.base, gear: c.gear, belt: c.belt, pack: c.pack, row };
}

function partyState(db: DatabaseSync, seats: SeatRow[], now: number, extra?: { s: ShelterView; m: Member; row: Row }) {
  const members: PartyMember[] = [];
  const records = new Set<string>();
  for (const seat of seats) {
    const s = loadForUpdate(db, "id", seat.shelter_id, now)!;
    const m = s.crew.find((x) => x.id === seat.character_id);
    if (m) members.push(snapshot(s, m, seat.row));
    for (const r of foundIds(db, s.id)) records.add(r);
  }
  if (extra) {
    members.push(snapshot(extra.s, extra.m, extra.row));
    for (const r of foundIds(db, extra.s.id)) records.add(r);
  }
  return { members, records: [...records] };
}

const bandFor = (p: PartyRow, st: { members: PartyMember[]; records: string[] }) =>
  readiness({ members: st.members, records: st.records, approach: p.approach, retreat: p.retreat, players: st.members.length }).band;

// Gives back a seat's rations and frees its character.
function release(db: DatabaseSync, seat: SeatRow, now: number, why: string, ev: LiveEvent[] = []): void {
  db.prepare("UPDATE shelters SET food = food + ?, water = water + ? WHERE id = ?").run(seat.food, seat.water, seat.shelter_id);
  db.prepare("DELETE FROM party_seats WHERE id = ?").run(seat.id);
  log(db, seat.shelter_id, now, "info", why);
  ev.push(alert(seat.user_id, "bad", why));
}

function disband(db: DatabaseSync, p: PartyRow, now: number, why: string, ev: LiveEvent[] = []): void {
  for (const seat of seatRows(db, p.id)) release(db, seat, now, why, ev);
  db.prepare("UPDATE parties SET state = 'expired' WHERE id = ?").run(p.id);
  ev.push(...partyNews(db, p.id));
}

// Parties that didn't fill in time are called off and refunded. Runs at the
// top of every shelter load, before its row is read, and of every party
// action. It only adds rations back, so it never needs another shelter loaded.
export function expireParties(db: DatabaseSync, now: number): void {
  const old = db.prepare("SELECT * FROM parties WHERE state = 'mustering' AND expires_at <= ?").all(now) as unknown as PartyRow[];
  for (const p of old) disband(db, p, now, "The party for the Lower Deck didn't fill in time. It's called off; the rations are back in stock.");
}

// Can this person take a seat: home, fit, not busy, and the shelter can spare rations.
function canSeat(db: DatabaseSync, p: PartyRow, s: ShelterView, m: Member, keep = { food: 0, water: 0 }): string | null {
  const name = m.who === "you" ? "You" : m.name;
  if (m.journey) return `${name} ${m.who === "you" ? "are" : "is"} out.`;
  if (musteringSeat(db, m.id)) return `${name} ${m.who === "you" ? "are" : "is"} already in a party.`;
  if (m.character.hp < CHARACTER.travelMinHp) return `${name} needs ${CHARACTER.travelMinHp} HP to go.`;
  if (m.character.level < p.min_level) return `This party wants level ${p.min_level} or more.`;
  const r = LOWER_DECK.rations;
  if (s.stock.food - r.food < keep.food || s.stock.water - r.water < keep.water) return `It takes ${r.food} Food and ${r.water} Water from the shelter's stock.`;
  return null;
}

function seat(db: DatabaseSync, p: PartyRow, s: ShelterView, m: Member, userId: number, row: Row, now: number, dispatchedBy: number | null = null): void {
  const r = LOWER_DECK.rations;
  db.prepare("UPDATE shelters SET food = food - ?, water = water - ? WHERE id = ?").run(r.food, r.water, s.id);
  db.prepare("INSERT INTO party_seats (party_id, user_id, shelter_id, character_id, row, dispatched_by, food, water, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    p.id, userId, s.id, m.id, row, dispatchedBy, r.food, r.water, now,
  );
}

const ROWS: Row[] = ["front", "back"];
const memberFor = (s: ShelterView, who: unknown) => s.crew.find((m) => m.who === (who === undefined || who === "" ? "you" : who));

export function createParty(db: DatabaseSync, userId: number, f: Record<string, unknown>, now: number): PartyResult {
  const size = Number(f.size);
  const approach = String(f.approach ?? "") as Approach;
  const retreat = String(f.retreat ?? "") as RetreatRule;
  const row = String(f.row ?? "front") as Row;
  const minLevel = Number(f.min_level ?? 1);
  if (!Number.isInteger(size) || size < LOWER_DECK.players.min || size > LOWER_DECK.players.max || !["sneak", "fight"].includes(approach) || !["anyone", "half", "never"].includes(retreat) || !ROWS.includes(row) || !Number.isInteger(minLevel) || minLevel < 1 || minLevel > CHARACTER.maxLevel)
    return no(400, "Those party settings don't make sense.");
  return tx(db, (): PartyResult => {
    expireParties(db, now);
    const s = loadForUpdate(db, "user_id", userId, now)!;
    if (!foundIds(db, s.id).includes("day-fifteen")) return no(409, "You'd need to know where the Lower Deck is first: the level below CS-4, at the Supermarket.");
    const m = memberFor(s, f.who);
    if (!m) return no(404, "Nobody by that name lives with you.");
    const { lastInsertRowid } = db
      .prepare("INSERT INTO parties (dungeon, leader_user_id, size, approach, retreat, min_level, seed, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(LOWER_DECK.id, userId, size, approach, retreat, minLevel, randomInt(1, 2 ** 31), now, now + LOWER_DECK.expireMs);
    const p = partyRow(db, Number(lastInsertRowid))!;
    const why = canSeat(db, p, s, m);
    if (why) {
      db.prepare("DELETE FROM parties WHERE id = ?").run(p.id);
      return no(409, why);
    }
    seat(db, p, s, m, userId, row, now);
    const ev: LiveEvent[] = [];
    refresh(db, p.id, now, ev);
    log(db, s.id, now, "info", `You called a party of ${size} for the Lower Deck. ${m.who === "you" ? "You're" : `${m.name}'s`} going.`);
    // and says so in world chat, where anyone can join from the card
    const line = postRecruit(db, userId, p.id, recruitText(p), now);
    ev.unshift(chatEvent(line));
    return { ok: true, message: "Party called, and posted in world chat. It leaves when it's full.", partyId: p.id, events: ev };
  });
}

// Recomputes the band, and sends a full party off.
function refresh(db: DatabaseSync, partyId: number, now: number, ev: LiveEvent[] = []): void {
  const p = partyRow(db, partyId)!;
  const seats = seatRows(db, partyId);
  if (!seats.length) {
    db.prepare("UPDATE parties SET state = 'expired' WHERE id = ?").run(partyId);
    ev.push(...partyNews(db, partyId));
    return;
  }
  const st = partyState(db, seats, now);
  const band = bandFor(p, st);
  db.prepare("UPDATE parties SET readiness = ? WHERE id = ?").run(band, partyId);
  if (seats.length < p.size) {
    ev.push(...partyNews(db, partyId));
    return;
  }
  // nobody goes into worse odds than their owner allowed
  const over = seats.filter((x) => x.dispatched_by !== null && worse(band, dispatchOf(db, x.user_id).risk));
  if (over.length) {
    for (const x of over) release(db, x, now, `The party for the Lower Deck got riskier than you allow, so your character stayed home.`, ev);
    refresh(db, partyId, now, ev);
    return;
  }
  depart(db, { ...p, readiness: band }, seats, st, now, ev);
}

function depart(db: DatabaseSync, p: PartyRow, seats: SeatRow[], st: { members: PartyMember[]; records: string[] }, now: number, ev: LiveEvent[]): void {
  const result = runExpedition({ seed: p.seed, members: st.members, approach: p.approach, retreat: p.retreat, records: st.records, players: seats.length });
  const shares = shareLoot(p.seed, seats.length, result.loot);
  // the run's own clock, sped up like every other trip for local testing
  const ends = now + result.endsAt / TIME_SCALE;
  const travel = LOWER_DECK.travelMs / TIME_SCALE;
  db.prepare("UPDATE parties SET state = 'out', departed_at = ?, ends_at = ?, result_json = ? WHERE id = ?").run(now, ends, JSON.stringify(result), p.id);
  const names = st.members.map((m) => m.name).join(", ");
  seats.forEach((seat, i) => {
    db.prepare("UPDATE party_seats SET active = 0, share_json = ? WHERE id = ?").run(JSON.stringify(shares[i]), seat.id);
    db.prepare(
      `INSERT INTO journeys (shelter_id, character_id, target_kind, target_id, action, departed_at, arrive_at, explore_until, return_at, party_id)
       VALUES (?, ?, 'party', ?, 'expedition', ?, ?, ?, ?, ?)`,
    ).run(seat.shelter_id, seat.character_id, p.dungeon, now, now + travel, ends - travel, ends, p.id);
    log(db, seat.shelter_id, now, "info", `The party left for the Lower Deck: ${names}.`);
    ev.push(alert(seat.user_id, "ok", `The party left for the Lower Deck: ${names}.`));
  });
  ev.push(...partyNews(db, p.id));
}

export function joinParty(db: DatabaseSync, userId: number, partyId: number, f: Record<string, unknown>, now: number): PartyResult {
  const row = String(f.row ?? "front") as Row;
  if (!ROWS.includes(row)) return no(400, "Front or back.");
  return tx(db, (): PartyResult => {
    expireParties(db, now);
    const p = partyRow(db, partyId);
    if (!p || p.state !== "mustering") return no(404, "That party isn't gathering any more.");
    const seats = seatRows(db, partyId);
    if (seats.some((x) => x.user_id === userId)) return no(409, "You already have someone in this party.");
    if (seats.length >= p.size) return no(409, "It's full.");
    const s = loadForUpdate(db, "user_id", userId, now)!;
    const m = memberFor(s, f.who);
    if (!m) return no(404, "Nobody by that name lives with you.");
    const why = canSeat(db, p, s, m);
    if (why) return no(409, why);
    seat(db, p, s, m, userId, row, now);
    log(db, s.id, now, "info", `${m.who === "you" ? "You" : m.name} joined ${username(db, p.leader_user_id)}'s party for the Lower Deck.`);
    const ev: LiveEvent[] = seats.map((x) => alert(x.user_id, "ok", `${s.owner} joined your party for the Lower Deck (${seats.length + 1} of ${p.size}).`));
    refresh(db, partyId, now, ev);
    return { ok: true, message: "Joined.", partyId, events: ev };
  });
}

// Putting a friend's designated character in, while they may be offline.
export function dispatchFriend(db: DatabaseSync, userId: number, partyId: number, friendId: number, now: number): PartyResult {
  return tx(db, (): PartyResult => {
    expireParties(db, now);
    const p = partyRow(db, partyId);
    if (!p || p.state !== "mustering") return no(404, "That party isn't gathering any more.");
    const seats = seatRows(db, partyId);
    if (!seats.some((x) => x.user_id === userId)) return no(403, "Only someone in the party can bring a friend.");
    if (!areFriends(db, userId, friendId)) return no(403, "You can only send a friend's character.");
    if (seats.some((x) => x.user_id === friendId)) return no(409, "They already have someone in this party.");
    if (seats.length >= p.size) return no(409, "It's full.");
    const d = dispatchOf(db, friendId);
    if (!d.enabled) return no(409, "They don't let friends send anyone of theirs.");
    const s = loadForUpdate(db, "user_id", friendId, now)!;
    const m = s.crew.find((x) => x.who === d.who);
    if (!m) return no(409, "Their chosen character isn't there.");
    const why = canSeat(db, p, s, m, { food: d.keepFood, water: d.keepWater });
    if (why) return no(409, why.replace(/^You(?: are)?/, s.owner));
    const band = bandFor(p, partyState(db, seats, now, { s, m, row: d.row }));
    if (worse(band, d.risk)) return no(409, `With them it would be ${band}; ${s.owner} allows no worse than ${d.risk}.`);
    seat(db, p, s, m, friendId, d.row, now, userId);
    const name = m.who === "you" ? "your survivor" : m.name;
    const said = `${username(db, userId)} took ${name} into a party for the Lower Deck. You can recall them before it leaves.`;
    log(db, s.id, now, "info", said);
    const ev: LiveEvent[] = [alert(friendId, "ok", said)];
    refresh(db, partyId, now, ev);
    return { ok: true, message: `${m.who === "you" ? s.owner : `${m.name} (${s.owner}'s)`} is in.`, partyId, events: ev };
  });
}

// Leaving your own seat, a leader removing one, or an owner recalling theirs.
export function leaveSeat(db: DatabaseSync, userId: number, partyId: number, seatId: number | null, now: number): PartyResult {
  return tx(db, (): PartyResult => {
    expireParties(db, now);
    const p = partyRow(db, partyId);
    if (!p || p.state !== "mustering") return no(404, "That party isn't gathering any more.");
    const seats = seatRows(db, partyId);
    const target = seatId === null ? seats.find((x) => x.user_id === userId) : seats.find((x) => x.id === seatId);
    if (!target) return no(404, "There's no such seat.");
    const mine = target.user_id === userId;
    const leader = p.leader_user_id === userId;
    if (!mine && !leader) return no(403, "That isn't your seat to empty.");
    const ev: LiveEvent[] = [];
    if (mine && leader) {
      disband(db, p, now, `${username(db, userId)} called off the party for the Lower Deck. The rations are back in stock.`, ev);
      return { ok: true, message: "Party called off.", events: ev };
    }
    release(db, target, now, mine ? (target.dispatched_by ? "You recalled your character from a party for the Lower Deck." : "You left the party for the Lower Deck.") : `${username(db, userId)} took your character out of their party for the Lower Deck.`, ev);
    refresh(db, partyId, now, ev);
    return { ok: true, message: mine ? "Out of the party." : "Removed.", events: ev };
  });
}

// What a recruit card says; its seats and band are drawn live.
const recruitText = (p: PartyRow) =>
  `Gathering ${p.size} for the Lower Deck. ${p.approach === "sneak" ? "Sneaking where we can" : "Fighting everything"}; ${p.retreat === "never" ? "never turning back" : `turning back if ${p.retreat === "anyone" ? "anyone" : "half"} fall`}.${p.min_level > 1 ? ` Level ${p.min_level}+.` : ""}`;

// A leader can post the card again, as often as chat allows.
export function repostRecruit(db: DatabaseSync, userId: number, partyId: number, now: number): PartyResult {
  return tx(db, (): PartyResult => {
    expireParties(db, now);
    const p = partyRow(db, partyId);
    if (!p || p.state !== "mustering") return no(404, "That party isn't gathering any more.");
    if (p.leader_user_id !== userId) return no(403, "Only the leader posts the card.");
    const last = db.prepare("SELECT MAX(at) AS at FROM world_chat WHERE author_id = ?").get(userId) as { at: number | null };
    if (last.at !== null && now - last.at < WORLD_CHAT.gapMs) return no(429, "Slow down a moment.");
    const line = postRecruit(db, userId, p.id, recruitText(p), now);
    return { ok: true, message: "Posted in world chat.", partyId, events: [chatEvent(line)] };
  });
}

// ---- coming home

// One seat's trip home, run by its own shelter's load: health and what was
// used, a wipe's losses, the seat's share, and on success the experience,
// the quest and CS-4's last log.
export function settleSeat(db: DatabaseSync, shelterId: number, c: CharacterRow, j: { id: number; party_id: number | null; return_at: number }, stock: Stock): Stock {
  const seat = db.prepare("SELECT * FROM party_seats WHERE party_id = ? AND character_id = ?").get(j.party_id, c.id) as SeatRow | undefined;
  const p = j.party_id ? partyRow(db, j.party_id) : undefined;
  const result: RunResult | null = p?.result_json ? JSON.parse(p.result_json) : null;
  const at = j.return_at;
  const who = c.who === "you" ? "You" : (RESIDENTS[c.who as ResidentId]?.name ?? c.who);
  if (!seat || !result) {
    db.prepare("UPDATE journeys SET resolved_at = ? WHERE id = ?").run(at, j.id);
    return stock;
  }
  const me = result.members.find((x) => x.key === `c${c.id}`);
  db.prepare("UPDATE characters SET hp = ?, hp_at = ? WHERE id = ?").run(Math.max(0, me?.hp ?? 0), at, c.id);
  let message: string;
  if (result.outcome === "wiped") {
    const lost = loseCarried(db, c.id);
    message = `Back from the Lower Deck, carried: the party was wiped out. ${who} lost ${lost.length ? lost.join(", ") : "nothing carried"}. The stash at home is untouched.`;
  } else {
    // what's left on the belt and in the pack comes home as it was used
    db.prepare("DELETE FROM items WHERE held_by = ? AND slot IN ('belt', 'pack')").run(c.id);
    for (const [k, n] of Object.entries(me?.belt ?? {}) as [SupplyKind, number][]) if (n > 0) addSupply(db, shelterId, k, n, at, { id: c.id, slot: "belt" });
    for (const [k, n] of Object.entries(me?.pack ?? {}) as [SupplyKind, number][]) if (n > 0) addSupply(db, shelterId, k, n, at, { id: c.id, slot: "pack" });
    const share: Share = seat.share_json ? JSON.parse(seat.share_json) : { resources: { food: 0, water: 0, scrap: 0 }, supplies: {}, gear: [] };
    stock.food += share.resources.food;
    stock.water += share.resources.water;
    stock.scrap += share.resources.scrap;
    for (const [k, n] of Object.entries(share.supplies) as [SupplyKind, number][]) addSupply(db, shelterId, k, n, at);
    for (const g of share.gear) grantGear(db, shelterId, g, at);
    const parts = [
      ...(["food", "water", "scrap"] as const).filter((k) => share.resources[k] > 0).map((k) => `+${share.resources[k]} ${k[0].toUpperCase()}${k.slice(1)}`),
      suppliesText(share.supplies),
      ...share.gear.map((g) => `${g.name ?? g.kind} (${g.quality}, level ${g.level})`),
    ].filter(Boolean);
    if (result.outcome === "cleared") {
      const xp = awardXp(db, c.id, LOWER_DECK.xp);
      db.prepare("INSERT OR IGNORE INTO quest_marks (owner, quest_id, mark, at) VALUES (?, 'day-fifteen', ?, ?)").run(`shelter:${shelterId}`, CLEARED, at);
      const first = db.prepare("INSERT OR IGNORE INTO discoveries (shelter_id, fragment_id, journey_id, found_at) VALUES (?, 'cs4-last-log', ?, ?)").run(shelterId, j.id, at).changes === 1;
      message = `Back from the Lower Deck: cleared. Your share: ${parts.join(", ") || "nothing"}. +${LOWER_DECK.xp} XP.${levelNote(xp)}${first ? " Day Fifteen is done, and CS-4's last log is in your journal." : ""}`;
    } else message = `Back from the Lower Deck: they turned back. Your share of what they carried out: ${parts.join(", ") || "nothing"}.`;
  }
  db.prepare("UPDATE journeys SET resolved_at = ?, outcome_json = ? WHERE id = ?").run(at, JSON.stringify({ result: result.outcome }), j.id);
  log(db, shelterId, at, result.outcome === "wiped" ? "danger" : "loot", c.who === "you" ? message : `${who}: ${message}`);
  return stock;
}

// What the party has been through so far: only events whose time has come.
export const eventsSoFar = (p: PartyView, now: number): RunEvent[] =>
  p.result && p.departed_at !== null ? p.result.events.filter((e) => p.departed_at! + e.at / TIME_SCALE <= now) : [];
