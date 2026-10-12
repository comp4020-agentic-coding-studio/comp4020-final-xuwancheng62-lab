import { DUNGEONS, type DungeonDef } from "../src/game/dungeons.ts";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, tx } from "../src/db.ts";
import { LOWER_DECK } from "../src/game/config.ts";
import { shareLoot } from "../src/game/expedition.ts";
import { rollGear } from "../src/game/items.ts";
import { seeded } from "../src/game/rng.ts";
import { addSupply, equip, grantGear, stashOf } from "../src/character.ts";
import { answerInvite, inviteFriend, settleInvites, unfriend, befriend, createParty, dispatchFriend, joinParty, leaveSeat, openParties, partyRow, pastParties, setDispatch } from "../src/parties.ts";
import { createShelter, depart, loadShelter, recentLog } from "../src/shelter.ts";

// Parties (PLAN.md, "Parties, friends and dispatch"): mustering locks a
// character and its rations, a full party leaves on its own, friends can
// send each other's chosen character within the owner's limits, and every
// shelter settles its own seat when it's next loaded. On a throwaway
// database with a fixed clock; the pages are in spec/expeditions-http.test.ts.

let db: DatabaseSync;
const T0 = 1_800_000_000_000;

function player(name: string): number {
  return tx(db, () => {
    const { lastInsertRowid } = db.prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, 'x', ?)").run(name, T0);
    createShelter(db, Number(lastInsertRowid), name, T0);
    return Number(lastInsertRowid);
  });
}
const shelterOf = (u: number) => (db.prepare("SELECT id FROM shelters WHERE user_id = ?").get(u) as { id: number }).id;
const charOf = (u: number, who = "you") => (db.prepare("SELECT id FROM characters WHERE shelter_id = ? AND who = ?").get(shelterOf(u), who) as { id: number }).id;
const find = (u: number, f: string) => db.prepare("INSERT OR IGNORE INTO discoveries (shelter_id, fragment_id, found_at) VALUES (?, ?, ?)").run(shelterOf(u), f, T0);
const stock = (u: number, at = T0) => loadShelter(db, u, at).stock;
const setStock = (u: number, food: number, water: number) => db.prepare("UPDATE shelters SET food = ?, water = ?, settled_at = ? WHERE id = ?").run(food, water, T0, shelterOf(u));

// someone who's been around: level 10, Lower Deck gear, a light and bandages
function veteran(u: number) {
  db.prepare("UPDATE characters SET level = 10, strength = 12, agility = 8, constitution = 15, hp = 159 WHERE id = ?").run(charOf(u));
  const s = shelterOf(u);
  for (const [i, k] of (["machete", "riot", "headtorch"] as const).entries()) grantGear(db, s, rollGear(seeded(i + 1), k, 8, "epic"), T0);
  for (const g of stashOf(db, s).gear.filter((g) => g.level === 8)) expect(equip(db, u, g.id!, T0).ok).toBe(true);
  addSupply(db, s, "bandage", 2, T0, { id: charOf(u), slot: "belt" });
}
const settings = { size: "2", approach: "fight", retreat: "half", row: "front", min_level: "1" };

let a: number, b: number, c: number;
beforeEach(() => {
  db = openDb(mkdtempSync(join(tmpdir(), "holdout-party-")));
  a = player("ana");
  b = player("ben");
  c = player("cai");
  find(a, "day-fifteen");
});

describe("calling and joining a party", () => {
  it("lets a newcomer call a party without the Day 15 notice, but validates settings", () => {
    expect(createParty(db, b, settings, T0)).toMatchObject({ ok: true });
    expect(createParty(db, a, { ...settings, size: "9" }, T0)).toMatchObject({ ok: false, status: 400 });
    expect(createParty(db, a, settings, T0)).toMatchObject({ ok: true });
  });

  it("allows an expedition with empty stores and never charges rations", () => {
    setStock(b, 0, 3);
    expect(createParty(db, b, settings, T0)).toMatchObject({ ok: true });
    expect(openParties(db, T0)).toHaveLength(1);
    expect(stock(b).food).toBe(0);
    expect(stock(b).water).toBe(3);
  });

  it("charges no rations when joining or leaving, but locks the character meanwhile", () => {
    const before = stock(a);
    const r = createParty(db, a, { ...settings, size: "3" }, T0) as { partyId: number };
    const after = stock(a);
    expect(before.food - after.food).toBeCloseTo(0, 0);
    expect(before.water - after.water).toBeCloseTo(0, 0);
    // no solo trip, no gear change, no second party while it gathers
    expect(depart(db, a, "supermarket", T0)).toMatchObject({ ok: false, status: 409 });
    const spare = grantGear(db, shelterOf(a), rollGear(seeded(1), "spear", 1, "common"), T0);
    expect(equip(db, a, spare, T0)).toMatchObject({ ok: false, status: 409 });
    expect(createParty(db, a, settings, T0)).toMatchObject({ ok: false, status: 409 });
    // still home: still guarding
    expect(loadShelter(db, a, T0).anyoneHome).toBe(true);
    expect(leaveSeat(db, a, r.partyId, null, T0)).toMatchObject({ ok: true });
    expect(stock(a).food).toBeCloseTo(before.food, 0);
    expect(depart(db, a, "supermarket", T0).ok).toBe(true);
  });

  it("calls itself off when it doesn't fill in time, without an entry charge", () => {
    const before = stock(b);
    const r = createParty(db, a, { ...settings, size: "3" }, T0) as { partyId: number };
    expect(joinParty(db, b, r.partyId, {}, T0).ok).toBe(true);
    const later = T0 + LOWER_DECK.expireMs + 1;
    expect(stock(b, later).food).toBeCloseTo(before.food - 3 * (later - T0) / 3_600_000, 5);
    expect(partyRow(db, r.partyId)!.state).toBe("expired");
    expect(depart(db, b, "supermarket", later).ok).toBe(true);
  });

  it("leaves on its own when it's full, with everyone on their way", () => {
    const r = createParty(db, a, settings, T0) as { partyId: number };
    expect(joinParty(db, b, r.partyId, { row: "back" }, T0 + 1).ok).toBe(true);
    const p = partyRow(db, r.partyId)!;
    expect(p.state).toBe("out");
    expect(p.ends_at).toBeGreaterThan(T0 + 2 * LOWER_DECK.travelMs);
    expect(loadShelter(db, a, T0 + 2).journey?.destinationName).toBe(LOWER_DECK.name);
    expect(loadShelter(db, b, T0 + 2).journey?.partyId).toBe(r.partyId);
    // full and gone: nobody else gets in
    expect(joinParty(db, c, r.partyId, {}, T0 + 3)).toMatchObject({ ok: false, status: 404 });
  });

  it("lets the leader call it off, refunding every seat", () => {
    const r = createParty(db, a, { ...settings, size: "3" }, T0) as { partyId: number };
    const before = stock(b);
    expect(joinParty(db, b, r.partyId, {}, T0).ok).toBe(true);
    expect(leaveSeat(db, a, r.partyId, null, T0).ok).toBe(true);
    expect(stock(b).food).toBeCloseTo(before.food, 0);
    expect(partyRow(db, r.partyId)!.state).toBe("expired");
  });
});

describe("friends and dispatch", () => {
  it("sends a friend's chosen character only between friends, if they allow it, within their risk limit", () => {
    const r = createParty(db, a, { ...settings, size: "3" }, T0) as { partyId: number };
    expect(dispatchFriend(db, a, r.partyId, b, T0)).toMatchObject({ ok: false, status: 403 });
    expect(befriend(db, a, "ben", T0).ok).toBe(true);
    expect(dispatchFriend(db, a, r.partyId, b, T0)).toMatchObject({ ok: false, status: 403 });
    expect(befriend(db, b, "ana", T0).ok).toBe(true);
    // ben allows only Likely runs; two fresh characters at the Lower Deck aren't
    expect(setDispatch(db, b, { who: "you", risk: "likely", row: "front", keep_food: "20", keep_water: "20" }, T0).ok).toBe(true);
    expect(dispatchFriend(db, a, r.partyId, b, T0)).toMatchObject({ ok: false, status: 409 });
    expect(setDispatch(db, b, { who: "off", risk: "grim", row: "front", keep_food: "20", keep_water: "20" }, T0).ok).toBe(true);
    expect(dispatchFriend(db, a, r.partyId, b, T0)).toMatchObject({ ok: false, status: 409 });
    expect(setDispatch(db, b, { who: "you", risk: "grim", row: "back", keep_food: "20", keep_water: "20" }, T0).ok).toBe(true);
    expect(dispatchFriend(db, a, r.partyId, b, T0)).toMatchObject({ ok: true });
    expect(recentLog(db, shelterOf(b), 5).some((e) => e.message.includes("ana took your survivor"))).toBe(true);
    // ben can recall his survivor before it leaves
    const seat = db.prepare("SELECT id, dispatched_by FROM party_seats WHERE user_id = ?").get(b) as { id: number; dispatched_by: number };
    expect(seat.dispatched_by).toBe(a);
    expect(leaveSeat(db, b, r.partyId, seat.id, T0).ok).toBe(true);
  });

  it("ignores legacy ration reserves because expeditions are free", () => {
    befriend(db, a, "ben", T0);
    befriend(db, b, "ana", T0);
    setDispatch(db, b, { who: "you", risk: "grim", row: "front", keep_food: "30", keep_water: "0" }, T0);
    setStock(b, 0, 0);
    const r = createParty(db, a, { ...settings, size: "3" }, T0) as { partyId: number };
    expect(dispatchFriend(db, a, r.partyId, b, T0)).toMatchObject({ ok: true });
  });
});

describe("coming home", () => {
  function clearRun() {
    veteran(a);
    veteran(b);
    find(a, "all-clear");
    const r = createParty(db, a, settings, T0) as { partyId: number };
    expect(joinParty(db, b, r.partyId, {}, T0).ok).toBe(true);
    return partyRow(db, r.partyId)!;
  }

  it("shares out what was found, once, each shelter settling its own seat", () => {
    const p = clearRun();
    const result = JSON.parse(p.result_json!);
    expect(result.outcome).toBe("cleared");
    const end = p.ends_at! + 1;
    const xpBefore = (db.prepare("SELECT xp, level FROM characters WHERE id = ?").get(charOf(a)) as { xp: number }).xp;
    const before = { a: stock(a, T0 + 1), b: stock(b, T0 + 1) };
    const had = { a: stashOf(db, shelterOf(a)).gear.length, b: stashOf(db, shelterOf(b)).gear.length };
    loadShelter(db, a, end);
    // ben hasn't loaded: his seat is still out there
    expect(db.prepare("SELECT resolved_at FROM journeys WHERE shelter_id = ? AND party_id = ?").get(shelterOf(b), p.id)).toEqual({ resolved_at: null });
    loadShelter(db, b, end);
    loadShelter(db, a, end + 1);
    const after = { a: stock(a, end), b: stock(b, end) };
    // every unit of the haul went to someone, and nobody got two more than another
    const got = (k: "food" | "water" | "scrap") => [after.a[k] - before.a[k], after.b[k] - before.b[k]];
    for (const k of ["food", "water", "scrap"] as const) {
      const [x, y] = got(k);
      expect(Math.abs(Math.round(x) - Math.round(y))).toBeLessThanOrEqual(LOWER_DECK.rooms.length + 2);
    }
    const gearA = stashOf(db, shelterOf(a)).gear.length - had.a;
    const gearB = stashOf(db, shelterOf(b)).gear.length - had.b;
    expect(gearA + gearB).toBe(result.loot.gear.length);
    expect(Math.abs(gearA - gearB)).toBeLessThanOrEqual(1);
    // the quest, the record and the experience, once each
    expect(db.prepare("SELECT COUNT(*) AS n FROM quest_marks WHERE quest_id = 'day-fifteen'").get()).toEqual({ n: 2 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM discoveries WHERE fragment_id = 'cs4-last-log'").get()).toEqual({ n: 2 });
    const xpAfter = (db.prepare("SELECT xp, level FROM characters WHERE id = ?").get(charOf(a)) as { xp: number; level: number });
    expect(xpAfter.level === 10 ? true : xpAfter.xp > xpBefore).toBe(true);
    expect(recentLog(db, shelterOf(a), 10).filter((e) => e.message.startsWith(`Back from ${LOWER_DECK.name}`)).length).toBe(1);
    // over: off the list of parties, and into each member's own history
    expect(openParties(db, end).map((x) => x.id)).not.toContain(p.id);
    expect(pastParties(db, a, end).map((x) => x.id)).toEqual([p.id]);
    expect(pastParties(db, c, end)).toEqual([]);
  });

  it("splits evenly: equipment round the table, the rest equally", () => {
    const loot = { resources: { food: 31, water: 20, scrap: 7 }, supplies: { bandage: 5 }, gear: [1, 2, 3, 4, 5].map((i) => rollGear(seeded(i), "spear", 4, "rare")) };
    const shares = shareLoot(99, 3, loot);
    expect(shares.reduce((t, s) => t + s.resources.food, 0)).toBe(31);
    expect(shares.reduce((t, s) => t + (s.supplies.bandage ?? 0), 0)).toBe(5);
    const counts = shares.map((s) => s.gear.length).sort();
    expect(counts).toEqual([1, 2, 2]);
    for (const k of ["food", "water", "scrap"] as const) {
      const xs = shares.map((s) => s.resources[k]);
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(1);
    }
    expect(shareLoot(99, 3, loot)).toEqual(shares);
  });

  it("loses what everyone carried in a wipe, never the stash or the character", () => {
    const keep = grantGear(db, shelterOf(a), rollGear(seeded(5), "spear", 1, "common"), T0);
    addSupply(db, shelterOf(a), "bandage", 1, T0, { id: charOf(a), slot: "belt" });
    db.prepare("UPDATE characters SET hp = 20").run();
    const r = createParty(db, a, { ...settings, retreat: "never" }, T0) as { partyId: number };
    expect(joinParty(db, b, r.partyId, {}, T0).ok).toBe(true);
    const p = partyRow(db, r.partyId)!;
    expect(JSON.parse(p.result_json!).outcome).toBe("wiped");
    const home = loadShelter(db, a, p.ends_at! + 1);
    expect(home.character.gear).toEqual({});
    expect(home.character.belt).toEqual({});
    expect(home.character.hp).toBe(0);
    expect(stashOf(db, shelterOf(a)).gear.map((g) => g.id)).toEqual([keep]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM characters WHERE shelter_id = ?").get(shelterOf(a))).toEqual({ n: 1 });
  });
});


describe("five-second party invitations", () => {
  const friend = () => { befriend(db, a, "ben", T0); befriend(db, b, "ana", T0); setDispatch(db, b, { who: "you", risk: "grim", row: "front" }, T0); };
  const pendingId = () => (db.prepare("SELECT id FROM party_invites ORDER BY id DESC LIMIT 1").get() as { id: number }).id;
  it("waits five seconds, then joins and launches exactly once", () => {
    friend(); setStock(b, 0, 0);
    const r = createParty(db, a, settings, T0) as { partyId: number };
    expect(inviteFriend(db, a, r.partyId, b, T0).ok).toBe(true);
    expect(inviteFriend(db, a, r.partyId, b, T0 + 1).ok).toBe(true);
    expect(db.prepare("SELECT COUNT(*) n FROM party_invites").get()).toEqual({ n: 1 });
    settleInvites(db, T0 + 4999);
    expect(partyRow(db, r.partyId)?.state).toBe("mustering");
    settleInvites(db, T0 + 5000);
    expect(partyRow(db, r.partyId)?.state).toBe("out");
    const end = partyRow(db, r.partyId)?.ends_at;
    settleInvites(db, T0 + 9000);
    expect(partyRow(db, r.partyId)?.ends_at).toBe(end);
    expect(stock(b, T0 + 5000).food).toBe(0);
  });
  it("allows early acceptance, rejects other people's answers, and respects a timely decline", () => {
    friend();
    const r = createParty(db, a, settings, T0) as { partyId: number };
    inviteFriend(db, a, r.partyId, b, T0);
    const id = pendingId();
    expect(answerInvite(db, c, id, "accept", T0 + 1)).toMatchObject({ ok: false, status: 403 });
    expect(answerInvite(db, b, id, "decline", T0 + 4999).ok).toBe(true);
    settleInvites(db, T0 + 5000);
    expect(partyRow(db, r.partyId)?.state).toBe("mustering");
    expect(inviteFriend(db, a, r.partyId, b, T0 + 6000)).toMatchObject({ ok: false, status: 429 });
    inviteFriend(db, a, r.partyId, b, T0 + 10000);
    answerInvite(db, b, pendingId(), "accept", T0 + 10001);
    expect(partyRow(db, r.partyId)?.state).toBe("out");
  });
  it("rechecks friendship and records a failure instead of sending a revoked friend", () => {
    friend(); const r = createParty(db, a, settings, T0) as { partyId: number };
    inviteFriend(db, a, r.partyId, b, T0); unfriend(db, a, b);
    settleInvites(db, T0 + 5000);
    expect(partyRow(db, r.partyId)?.state).toBe("mustering");
    expect(db.prepare("SELECT state FROM party_invites").get()).toEqual({ state: "failed" });
  });
  it("does not reserve a seat or overfill when someone else joins first", () => {
    friend(); const r = createParty(db, a, settings, T0) as { partyId: number };
    inviteFriend(db, a, r.partyId, b, T0);
    joinParty(db, c, r.partyId, {}, T0 + 1000);
    settleInvites(db, T0 + 5000);
    expect(db.prepare("SELECT COUNT(*) n FROM party_seats WHERE party_id = ?").get(r.partyId)).toEqual({ n: 2 });
    expect(loadShelter(db, b, T0 + 5000).journey).toBeNull();
    expect(db.prepare("SELECT state FROM party_invites").get()).toEqual({ state: "failed" });
  });
});


it("creates and settles a new configured dungeon, keeping its original definition", () => {
  const def: DungeonDef = { ...LOWER_DECK, id: 'test-annex', name: 'Test Annex', travelMs: 1000, rooms: [], xp: 7, reward: undefined, arrivalText: 'entered the annex.', successText: 'Annex explored.' };
  (DUNGEONS as DungeonDef[]).push(def);
  try {
    expect(createParty(db, c, { ...settings, dungeon: 'unknown' }, T0)).toMatchObject({ ok: false, status: 400 });
    const made = createParty(db, a, { ...settings, dungeon: def.id }, T0) as { partyId: number };
    def.xp = 999; // editing content must not change an already-created party
    joinParty(db, b, made.partyId, {}, T0);
    const p = partyRow(db, made.partyId)!;
    loadShelter(db, a, p.ends_at!);
    const character = db.prepare("SELECT xp FROM characters WHERE id = ?").get(charOf(a)) as { xp: number };
    expect(character.xp).toBe(7);
    expect(foundWithoutLastLog()).toBe(true);
    expect(JSON.parse(p.result_json!).events.map((e: { text: string }) => e.text).join(' ')).toContain('Annex');
  } finally { (DUNGEONS as DungeonDef[]).pop(); }
  function foundWithoutLastLog() { return !db.prepare("SELECT 1 FROM discoveries WHERE shelter_id = ? AND fragment_id = 'cs4-last-log'").get(shelterOf(a)); }
});

it("uses the stored invitation deadline when both players return much later", () => {
  befriend(db, a, "ben", T0); befriend(db, b, "ana", T0);
  setDispatch(db, b, { who: "you", risk: "grim", row: "front" }, T0);
  const p = createParty(db, a, settings, T0) as { partyId: number };
  inviteFriend(db, a, p.partyId, b, T0);
  settleInvites(db, T0 + 86_400_000);
  expect(partyRow(db, p.partyId)?.departed_at).toBe(T0 + 5000);
  expect(loadShelter(db, b, T0 + 86_400_000).journey).toBeNull();
});
