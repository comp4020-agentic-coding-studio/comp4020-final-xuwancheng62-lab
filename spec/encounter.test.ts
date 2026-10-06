import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { MIGRATIONS, openDb, tx } from "../src/db.ts";
import { BEAST, CHARACTER, RECOVERY, STARTING_STOCK, XP } from "../src/game/config.ts";
import { carry, halve, total } from "../src/game/character.ts";
import { DESTINATIONS, rollFound, rollHoard } from "../src/game/world.ts";
import { equip, grantItem, meal, train } from "../src/character.ts";
import { attack, escape } from "../src/encounter.ts";
import { createShelter, depart, loadShelter } from "../src/shelter.ts";

// The fight comes minutes into a trip, which CI can't wait for over HTTP. So
// this drives the same transaction functions the routes call, against a
// throwaway database, at chosen times and with the dice fixed where an
// outcome has to be forced. Nothing here touches the running app's data.

const nest = DESTINATIONS.find((d) => d.id === "nest")!;
let dir: string;
let db: DatabaseSync;
let userId: number;
const T0 = 1_800_000_000_000;

function player(d = db, name = `p${Math.random().toString(36).slice(2, 8)}`): number {
  return tx(d, () => {
    const { lastInsertRowid } = d.prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, 'x', ?)").run(name, T0);
    createShelter(d, Number(lastInsertRowid), name, T0);
    return Number(lastInsertRowid);
  });
}

const id = () => randomUUID();
const shelterId = () => (db.prepare("SELECT id FROM shelters WHERE user_id = ?").get(userId) as { id: number }).id;
const journeyRow = () => db.prepare("SELECT * FROM journeys WHERE shelter_id = ? ORDER BY id DESC").get(shelterId()) as Record<string, number | string | null>;
const encounterRowNow = () => db.prepare("SELECT * FROM encounters WHERE shelter_id = ? ORDER BY id DESC").get(shelterId()) as Record<string, number | string | null>;
const items = () => db.prepare("SELECT kind, equipped FROM items WHERE shelter_id = ? ORDER BY kind").all(shelterId()) as { kind: string; equipped: number }[];

// Departs for the Nest and returns the moment the beast appears.
function toTheBeast(at = T0): number {
  expect(depart(db, userId, "nest", at).ok).toBe(true);
  return Number(journeyRow().encounter_at);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "holdout-enc-"));
  db = openDb(dir);
  userId = player();
});

describe("the journey to the beast", () => {
  it("fixes every timestamp at departure; later changes to Agility don't move it", () => {
    toTheBeast();
    const before = journeyRow();
    db.prepare("UPDATE characters SET agility = 60 WHERE shelter_id = ?").run(shelterId());
    loadShelter(db, userId, T0 + 1000);
    const after = journeyRow();
    for (const k of ["arrive_at", "explore_until", "return_at", "encounter_at"]) expect(after[k]).toBe(before[k]);
  });

  it("can't be finished by its timer while the beast is waiting", () => {
    const at = toTheBeast();
    const s = loadShelter(db, userId, Number(journeyRow().return_at) + 6 * 3_600_000);
    expect(s.journey?.phase).toBe("encounter");
    expect(journeyRow().resolved_at).toBeNull();
    expect(encounterRowNow().state).toBe("awaiting");
    // it waited without acting: no turn, no damage
    expect(s.character.hp).toBe(CHARACTER.maxHp);
    expect(at).toBeGreaterThan(T0);
  });

  it("survives a restart exactly as it was", () => {
    const at = toTheBeast();
    expect(escape(db, userId, id(), at, { escape: 99 }).ok).toBe(true);
    db.close();
    db = openDb(dir);
    const s = loadShelter(db, userId, at + 60_000);
    expect(s.journey?.phase).toBe("encounter");
    expect(s.journey?.encounter).toMatchObject({ state: "combat", escapeUsed: true, turns: 1 });
  });

  it("blocks gear changes until you're home", () => {
    grantItem(db, shelterId(), "spear", T0);
    toTheBeast();
    expect(equip(db, userId, "spear", T0 + 1000)).toMatchObject({ ok: false, status: 409 });
  });

  it("needs enough health to set out", () => {
    db.prepare("UPDATE characters SET hp = ?, hp_at = ? WHERE shelter_id = ?").run(CHARACTER.travelMinHp - 1, T0, shelterId());
    expect(depart(db, userId, "reservoir", T0)).toMatchObject({ ok: false, status: 409 });
  });
});

describe("winning", () => {
  it("adds the hoard, gear and experience exactly once, deposited on arrival", () => {
    const at = toTheBeast();
    const found = carry(rollFound(nest, Number(journeyRow().id)), 40).carried;
    const req = id();
    expect(attack(db, userId, req, 0, at, { hit: 999, bite: 8 })).toEqual({ ok: true, replay: false });
    // the same request again, and a stale form: neither does anything
    expect(attack(db, userId, req, 0, at + 1, { hit: 999 })).toEqual({ ok: true, replay: true });
    expect(attack(db, userId, id(), 0, at + 2, { hit: 999 })).toMatchObject({ ok: false, status: 409 });
    const e = encounterRowNow();
    expect(e.state).toBe("won");
    const hoard = carry(rollHoard(Number(journeyRow().id)), 40 - total(found)).carried;
    const carried = JSON.parse(String(e.carried_json));
    expect(total(carried)).toBe(total(found) + total(hoard));
    expect(items().find((i) => i.kind === "spear")).toMatchObject({ equipped: 0 });

    // still walking home: nothing deposited yet
    const walking = loadShelter(db, userId, at + 1000);
    expect(walking.journey?.phase).toBe("returning");
    const before = walking.stock.food;
    const home = loadShelter(db, userId, Number(journeyRow().return_at) + 1);
    expect(home.journey).toBeNull();
    // food rises by what was carried, less a few seconds of upkeep
    expect(home.stock.food - before).toBeGreaterThan((carried.food ?? 0) - 1);
    expect(home.character.xp + (home.character.level - 1) * 40).toBe(XP.won + XP.trip.nest);
    const again = loadShelter(db, userId, Number(journeyRow().return_at) + 2);
    expect(again.stock.food).toBeCloseTo(home.stock.food, 0);
    expect(again.character.xp).toBe(home.character.xp);
  });
});

describe("escaping", () => {
  it("keeps all gear and exactly half of each supply, and takes no hoard", () => {
    const at = toTheBeast();
    const found = carry(rollFound(nest, Number(journeyRow().id)), 40).carried;
    expect(escape(db, userId, id(), at, { escape: 0 }).ok).toBe(true);
    const e = encounterRowNow();
    expect(e.state).toBe("escaped");
    expect(JSON.parse(String(e.carried_json))).toEqual(halve(found));
    expect(items()).toEqual([{ kind: "crowbar", equipped: 1 }]);
    // the normal walk home, not a teleport
    expect(loadShelter(db, userId, at + 1).journey?.phase).toBe("returning");
  });

  it("can be tried once: a failure locks you into the fight, even after a restart, and is never rerolled", () => {
    const at = toTheBeast();
    const req = id();
    expect(escape(db, userId, req, at, { escape: 99 }).ok).toBe(true);
    expect(encounterRowNow()).toMatchObject({ state: "combat", escape_used: 1, escape_roll: 99 });
    // the same request replays; a new one is refused, whatever the dice would say
    expect(escape(db, userId, req, at + 1, { escape: 0 })).toEqual({ ok: true, replay: true });
    db.close();
    db = openDb(dir);
    expect(escape(db, userId, id(), at + 2, { escape: 0 })).toMatchObject({ ok: false, status: 409 });
    expect(encounterRowNow()).toMatchObject({ state: "combat", escape_roll: 99 });
    const log = db.prepare("SELECT message FROM activity_log WHERE shelter_id = ? AND message LIKE '%cut you off%'").all(shelterId());
    expect(log).toHaveLength(1);
  });
});

describe("defeat", () => {
  it("loses all equipped gear and everything found, but nothing stored or at home, once", () => {
    grantItem(db, shelterId(), "jacket", T0);
    expect(equip(db, userId, "jacket", T0).ok).toBe(true);
    grantItem(db, shelterId(), "backpack", T0); // stays in storage
    db.prepare("UPDATE characters SET hp = 30, hp_at = ? WHERE shelter_id = ?").run(T0, shelterId());
    const at = toTheBeast();
    const stockBefore = loadShelter(db, userId, at).stock;
    expect(attack(db, userId, id(), 0, at, { hit: 1, bite: 99 }).ok).toBe(true);
    expect(encounterRowNow()).toMatchObject({ state: "defeated", carried_json: "{}" });
    expect(items()).toEqual([{ kind: "backpack", equipped: 0 }]);

    // a wounded walk home: no fighting, no new trip
    const walking = loadShelter(db, userId, at + 1000);
    expect(walking.journey?.phase).toBe("returning");
    expect(walking.character.hp).toBe(0);
    expect(attack(db, userId, id(), 1, at + 1000, { hit: 999 })).toMatchObject({ ok: false, status: 409 });
    expect(depart(db, userId, "reservoir", at + 1000)).toMatchObject({ ok: false, status: 409 });

    const home = loadShelter(db, userId, Number(journeyRow().return_at) + 1);
    expect(home.journey).toBeNull();
    // stock only ran down with upkeep: nothing was added, nothing taken
    expect(home.stock.food).toBeLessThanOrEqual(stockBefore.food);
    expect(stockBefore.food - home.stock.food).toBeLessThan(1);
    expect(home.character.xp).toBe(0);
    expect(JSON.parse(String(journeyRow().outcome_json))).toEqual({ result: "defeated", loot: {} });
  });
});

describe("one blow per turn", () => {
  it("lands once, however many tabs or retries send it", () => {
    const at = toTheBeast();
    const a = id();
    const results = [attack(db, userId, a, 0, at, { hit: 5, bite: 5 }), attack(db, userId, a, 0, at, { hit: 5, bite: 5 }), attack(db, userId, id(), 0, at, { hit: 5, bite: 5 })];
    expect(results.map((r) => r.ok)).toEqual([true, true, false]);
    const e = encounterRowNow();
    expect(e).toMatchObject({ turns: 1, beast_hp: BEAST.hp - 5 });
    expect(loadShelter(db, userId, at).character.hp).toBe(CHARACTER.maxHp - 5);
  });
});

describe("recovery", () => {
  it("needs no supplies, comes from the clock, and can't be sped up by asking again", () => {
    db.prepare("UPDATE characters SET hp = 0, hp_at = ? WHERE shelter_id = ?").run(T0, shelterId());
    db.prepare("UPDATE shelters SET food = 0, water = 0, settled_at = ? WHERE id = ?").run(T0, shelterId());
    const later = T0 + RECOVERY.msPerHp * CHARACTER.travelMinHp;
    expect(loadShelter(db, userId, later).character.hp).toBe(CHARACTER.travelMinHp);
    // reloading at the same moment gives nothing more
    expect(loadShelter(db, userId, later).character.hp).toBe(CHARACTER.travelMinHp);
    expect(meal(db, userId, later)).toMatchObject({ ok: false, status: 409 });
    expect(depart(db, userId, "reservoir", later).ok).toBe(true);
  });

  it("lets a meal help once per cooldown", () => {
    db.prepare("UPDATE characters SET hp = 10, hp_at = ? WHERE shelter_id = ?").run(T0, shelterId());
    expect(meal(db, userId, T0).ok).toBe(true);
    expect(meal(db, userId, T0 + 1000)).toMatchObject({ ok: false, status: 429 });
    expect(loadShelter(db, userId, T0 + 1000).character.hp).toBe(10 + RECOVERY.meal.hp);
  });

  it("spends a level point only if there is one", () => {
    expect(train(db, userId, "strength", T0)).toMatchObject({ ok: false, status: 409 });
    db.prepare("UPDATE characters SET unspent = 1 WHERE shelter_id = ?").run(shelterId());
    expect(train(db, userId, "strength", T0).ok).toBe(true);
    expect(train(db, userId, "strength", T0)).toMatchObject({ ok: false });
    expect(loadShelter(db, userId, T0).character.strength).toBe(CHARACTER.strength + 1);
  });
});

describe("trips without a beast", () => {
  it("work as before, with experience and the Workshop's salvage", () => {
    db.prepare("DELETE FROM items WHERE shelter_id = ?").run(shelterId());
    expect(depart(db, userId, "workshop", T0).ok).toBe(true);
    expect(encounterRowNow()).toBeUndefined();
    const home = loadShelter(db, userId, Number(journeyRow().return_at) + 1);
    expect(home.journey).toBeNull();
    const outcome = JSON.parse(String(journeyRow().outcome_json));
    if (outcome.result !== "empty") expect(items()).toEqual([{ kind: "crowbar", equipped: 0 }]);
    expect(home.character.xp).toBe(XP.trip.workshop);
  });
});

describe("migrating an existing database", () => {
  it("gives every player a survivor and a crowbar, and finishes trips already under way the old way", () => {
    const old = mkdtempSync(join(tmpdir(), "holdout-mig-"));
    const raw = new DatabaseSync(join(old, "game.db"));
    for (const m of MIGRATIONS.slice(0, 5)) raw.exec(m);
    raw.exec("PRAGMA user_version = 5");
    raw.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (1, 'old', 'x', ?)").run(T0);
    const s = STARTING_STOCK;
    raw.prepare("INSERT INTO shelters (id, user_id, name, food, water, power, scrap, settled_at) VALUES (1, 1, 'old shelter', ?, ?, ?, ?, ?)").run(s.food, s.water, s.power, s.scrap, T0);
    // a Nest trip from before the beast existed
    raw.prepare("INSERT INTO journeys (shelter_id, target_kind, target_id, action, departed_at, arrive_at, explore_until, return_at) VALUES (1, 'location', 'nest', 'scavenge', ?, ?, ?, ?)").run(T0, T0 + 1, T0 + 2, T0 + 3);
    raw.close();

    const migrated = openDb(old);
    expect(migrated.prepare("SELECT kind, equipped FROM items").all()).toEqual([{ kind: "crowbar", equipped: 1 }]);
    const view = loadShelter(migrated, 1, T0 + 10);
    expect(view.journey).toBeNull();
    expect(view.character).toMatchObject({ level: 1, hp: CHARACTER.maxHp, strength: CHARACTER.strength });
    expect(migrated.prepare("SELECT COUNT(*) AS n FROM encounters").get()).toEqual({ n: 0 });
    expect(JSON.parse(String((migrated.prepare("SELECT outcome_json FROM journeys").get() as { outcome_json: string }).outcome_json)).result).toMatch(/clean|hurt|empty/);
  });
});
