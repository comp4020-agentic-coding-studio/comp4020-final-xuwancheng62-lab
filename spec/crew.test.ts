import { legacyDepart as depart } from './legacy-trip.ts';
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, inject, it } from "vitest";
import { MIGRATIONS, openDb, tx } from "../src/db.ts";
import { CHARACTER, RAID, RATES, RECOVERY, RESIDENTS, STARTING_STOCK, XP } from "../src/game/config.ts";
import { escapes, maxHpOf } from "../src/game/character.ts";
import { defence, guardValue, securityBand } from "../src/game/raid.ts";
import { addResident, equip, grantGear, meal, setTask, starter, stashOf, train, unequip } from "../src/character.ts";
import { attack, escape } from "../src/encounter.ts";
import { publicShelter } from "../src/public.ts";
import { createShelter,  guardsOf, loadShelter } from "../src/shelter.ts";

// Everyone in a shelter is a character (PLAN.md, "Character, gear and the
// beast"): their own HP, stats, experience, gear and trips; whoever is home
// defends it. Rules are pure; play runs on a throwaway database with a fixed
// clock, as in spec/encounter.test.ts; the pages are checked over HTTP.

const toby = RESIDENTS.toby;

describe("defence from whoever is home", () => {
  it("counts each guard's combat and weapon, a worker at half, and nobody home as only the walls", () => {
    const you = { combat: RAID.startingCombat, weapon: starter("crowbar"), working: false };
    const tobyGuard = { combat: toby.combat, weapon: starter("crowbar"), working: false };
    expect(guardValue(you)).toBe(RAID.startingCombat + 1);
    expect(guardValue({ ...tobyGuard, weapon: starter("spear") })).toBe(toby.combat + 3);
    expect(guardValue({ ...tobyGuard, working: true })).toBe(Math.floor((toby.combat + 1) / 2));
    expect(defence([], 0)).toBe(RAID.baseDefence);
    expect(defence([you, tobyGuard], 0)).toBe(RAID.baseDefence + guardValue(you) + guardValue(tobyGuard));
    expect(defence([], 1)).toBe(RAID.baseDefence + RAID.reinforceBonus);
  });

  it("lets Toby get away from the Nest's dogs more often than you", () => {
    expect(escapes(60)).toBe(false);
    expect(escapes(60, toby.escape)).toBe(true);
  });
});

let db: DatabaseSync;
let userId: number;
let t: number;
const T0 = 1_800_000_000_000;

const shelterId = () => (db.prepare("SELECT id FROM shelters WHERE user_id = ?").get(userId) as { id: number }).id;
const charId = (who: string) => (db.prepare("SELECT id FROM characters WHERE shelter_id = ? AND who = ?").get(shelterId(), who) as { id: number }).id;
const items = (who: string) => db.prepare("SELECT kind, slot FROM items WHERE held_by = ? ORDER BY kind").all(charId(who));
const row = (who: string) => db.prepare("SELECT level, xp, combat, unspent, strength, hp FROM characters WHERE id = ?").get(charId(who)) as Record<string, number>;
const tripOf = (who: string) => db.prepare("SELECT * FROM journeys WHERE character_id = ? ORDER BY id DESC").get(charId(who)) as Record<string, number | string | null>;
const view = (at = t) => loadShelter(db, userId, at);
const member = (who: string, at = t) => view(at).crew.find((m) => m.who === who)!;

beforeEach(() => {
  db = openDb(mkdtempSync(join(tmpdir(), "holdout-crew-")));
  userId = tx(db, () => {
    const { lastInsertRowid } = db.prepare("INSERT INTO users (username, password_hash, created_at) VALUES ('c', 'x', ?)").run(T0);
    createShelter(db, Number(lastInsertRowid), "c", T0);
    return Number(lastInsertRowid);
  });
  tx(db, () => addResident(db, shelterId(), "toby", T0, "guard"));
  t = T0;
});

describe("Toby as a full character", () => {
  it("joins with his own numbers and a crowbar, separate from yours", () => {
    const m = member("toby");
    expect(m.character).toMatchObject({ strength: toby.strength, agility: toby.agility, constitution: toby.constitution, maxHp: maxHpOf(toby.strength, toby.constitution), hp: maxHpOf(toby.strength, toby.constitution), level: 1, combat: toby.combat });
    expect(items("toby")).toEqual([{ kind: "crowbar", slot: "weapon" }]);
    expect(items("you")).toEqual([{ kind: "crowbar", slot: "weapon" }]);
  });

  it("goes out on his own trip while you go on yours, and each comes home with their own experience", () => {
    expect(depart(db, userId, "workshop", t, "look", "you").ok).toBe(true);
    expect(depart(db, userId, "supermarket", t, "look", "toby").ok).toBe(true);
    // nobody can be in two places
    expect(depart(db, userId, "reservoir", t, "look", "toby")).toMatchObject({ ok: false, status: 409 });
    const s = view();
    expect(s.crew.every((m) => m.journey)).toBe(true);
    expect(s.anyoneHome).toBe(false);
    const back = Math.max(Number(tripOf("you").return_at), Number(tripOf("toby").return_at)) + 1;
    view(back);
    expect(row("you").xp).toBe(XP.trip.workshop);
    expect(row("toby").xp).toBe(XP.trip.supermarket);
    expect(view(back).anyoneHome).toBe(true);
  });

  it("keeps watch while you're out, and nobody does when he's out too", () => {
    expect(depart(db, userId, "workshop", t, "look", "you").ok).toBe(true);
    const watched = view();
    expect(watched.anyoneHome).toBe(true);
    expect(guardsOf(watched)).toHaveLength(1);
    const guarded = publicShelter(watched, t);
    expect(guarded).toMatchObject({ home: false, guarded: true });
    expect(depart(db, userId, "supermarket", t, "look", "toby").ok).toBe(true);
    const empty = publicShelter(view(), t);
    expect(empty).toMatchObject({ home: false, guarded: false, security: securityBand(RAID.baseDefence) });
    expect(defence(guardsOf(watched), 0)).toBeGreaterThan(defence([], 0));
  });

  it("fights the beast as himself, and a defeat takes only his gear", () => {
    grantGear(db, shelterId(), starter("jacket"), T0, charId("you"));
    expect(depart(db, userId, "nest", t, "look", "toby").ok).toBe(true);
    const j = tripOf("toby");
    view(Number(j.encounter_at));
    db.prepare("UPDATE characters SET hp = 1 WHERE id = ?").run(charId("toby"));
    // your fight form can't act for him, and his can't act for you
    expect(attack(db, userId, randomUUID(), 0, Number(j.encounter_at), { hit: 1, bite: 15 }, "you")).toMatchObject({ ok: false, status: 409 });
    expect(attack(db, userId, randomUUID(), 0, Number(j.encounter_at), { hit: 1, bite: 15 }, "toby").ok).toBe(true);
    expect(items("toby")).toEqual([]);
    expect(items("you")).toEqual([{ kind: "crowbar", slot: "weapon" }, { kind: "jacket", slot: "armour" }]);
  });

  it("gets away from the beast on a roll that would catch you", () => {
    expect(depart(db, userId, "nest", t, "look", "toby").ok).toBe(true);
    const j = tripOf("toby");
    expect(escape(db, userId, randomUUID(), Number(j.encounter_at), { escape: 60 }, "toby").ok).toBe(true);
    expect(db.prepare("SELECT state FROM encounters WHERE journey_id = ?").get(j.id)).toEqual({ state: "escaped" });
    expect(row("toby").xp).toBe(XP.escaped);
  });

  it("equips anyone at home from the shared stash, one holder at a time", () => {
    const spear = grantGear(db, shelterId(), starter("spear"), T0);
    expect(equip(db, userId, spear, t, "toby").ok).toBe(true);
    // his crowbar goes back to the stash for anyone
    expect(items("toby")).toEqual([{ kind: "spear", slot: "weapon" }]);
    expect(stashOf(db, shelterId()).gear.map((g) => g.kind)).toEqual(["crowbar"]);
    // you can't take it out of his hands
    expect(equip(db, userId, spear, t, "you")).toMatchObject({ ok: false, status: 409 });
    // nor use something far above your level
    const big = grantGear(db, shelterId(), { ...starter("spear"), level: 9 }, T0);
    expect(equip(db, userId, big, t, "toby")).toMatchObject({ ok: false, status: 409 });
    expect(unequip(db, userId, "weapon", t, "toby").ok).toBe(true);
    expect(depart(db, userId, "workshop", t, "look", "you").ok).toBe(true);
    // you're out: you can't change gear, though Toby still can
    expect(equip(db, userId, spear, t, "you")).toMatchObject({ ok: false, status: 409 });
    expect(equip(db, userId, spear, t, "toby").ok).toBe(true);
  });

  it("trains and eats as himself", () => {
    db.prepare("UPDATE characters SET unspent = 1, hp = 40, hp_at = ? WHERE id = ?").run(t, charId("toby"));
    expect(train(db, userId, "strength", t, "toby").ok).toBe(true);
    expect(row("toby")).toMatchObject({ unspent: 0, strength: toby.strength + 1 });
    expect(row("you").strength).toBe(CHARACTER.strength);
    expect(meal(db, userId, t, "toby").ok).toBe(true);
    expect(Math.floor(row("toby").hp)).toBe(40 + RECOVERY.meal.hp);
  });

  it("adds his water only while home on work, and eats either way", () => {
    expect(setTask(db, userId, "toby", "work", t).ok).toBe(true);
    expect(view().residents).toEqual([{ who: "toby", working: true }]);
    db.prepare("UPDATE shelters SET food = 100, water = 100, power = 100, scrap = 100, settled_at = ? WHERE id = ?").run(t, shelterId());
    // an hour at home on work, then an hour out
    const hour = 3_600_000;
    const atHome = view(t + hour).stock;
    expect(atHome.water - 100).toBeCloseTo(RATES.purifier.waterOut + toby.purifierWater - RATES.upkeep.water, 5);
    expect(atHome.food - 100).toBeCloseTo(-RATES.upkeep.food - toby.food, 5);
    expect(depart(db, userId, "nest", t + hour, "look", "toby").ok).toBe(true);
    const out = view(t + hour + 30 * 60_000).stock;
    expect(out.water - atHome.water).toBeCloseTo((RATES.purifier.waterOut - RATES.upkeep.water) / 2, 5);
    expect(setTask(db, userId, "you", "work", t)).toMatchObject({ ok: false, status: 404 });
  });
});

describe("migrating a shelter with Toby in it", () => {
  it("makes you and Toby characters, gives your gear to you, and keeps your trips yours", () => {
    const old = mkdtempSync(join(tmpdir(), "holdout-v9-"));
    const raw = new DatabaseSync(join(old, "game.db"));
    for (const m of MIGRATIONS.slice(0, 9)) raw.exec(m);
    raw.exec("PRAGMA user_version = 9");
    raw.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (1, 'old', 'x', ?)").run(T0);
    const s = STARTING_STOCK;
    raw.prepare("INSERT INTO shelters (id, user_id, name, food, water, power, scrap, settled_at, combat_power) VALUES (1, 1, 'old', ?, ?, ?, ?, ?, 14)").run(s.food, s.water, s.power, s.scrap, T0);
    raw.prepare("INSERT INTO characters (shelter_id, hp_at, level, xp) VALUES (1, ?, 3, 50)").run(T0);
    raw.prepare("INSERT INTO items (shelter_id, kind, equipped, created_at) VALUES (1, 'crowbar', 1, ?), (1, 'spear', 0, ?)").run(T0, T0);
    raw.prepare("INSERT INTO residents (shelter_id, who, joined_at) VALUES (1, 'toby', ?)").run(T0);
    raw.prepare("INSERT INTO journeys (shelter_id, target_kind, target_id, action, departed_at, arrive_at, explore_until, return_at) VALUES (1, 'location', 'supermarket', 'scavenge', ?, ?, ?, ?)").run(T0, T0 + 1, T0 + 2, T0 + 3);
    raw.close();

    const migrated = openDb(old);
    const people = migrated.prepare("SELECT who, combat, task, level, xp, strength, constitution FROM characters ORDER BY who != 'you'").all();
    expect(people).toEqual([
      // v9 had max HP 100 and Toby 80; Constitution keeps that or more (migration 15)
      { who: "you", combat: 14, task: "guard", level: 3, xp: 50, strength: CHARACTER.strength, constitution: CHARACTER.constitution },
      { who: "toby", combat: toby.combat, task: "work", level: 1, xp: 0, strength: toby.strength, constitution: toby.constitution },
    ]);
    // what each held is still theirs; what was stored is in the shelter's stash
    const kit = migrated.prepare("SELECT c.who, i.kind FROM items i JOIN characters c ON c.id = i.held_by ORDER BY c.who, i.kind").all();
    expect(kit).toEqual([{ who: "toby", kind: "crowbar" }, { who: "you", kind: "crowbar" }]);
    expect(migrated.prepare("SELECT shelter_id, kind, level, quality FROM items WHERE held_by IS NULL").all()).toEqual([{ shelter_id: 1, kind: "spear", level: 1, quality: "common" }]);
    expect(migrated.prepare("SELECT c.who FROM journeys j JOIN characters c ON c.id = j.character_id").all()).toEqual([{ who: "you" }]);
    expect(migrated.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    const v = loadShelter(migrated, 1, T0 + 10);
    expect(v.crew.map((m) => m.who)).toEqual(["you", "toby"]);
    expect(v.combatPower).toBe(14);
  });
});

const baseUrl = inject("baseUrl");
const url = (path: string) => new URL(path, baseUrl);

async function register(): Promise<string> {
  const res = await fetch(url("/register"), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: `spec_c${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, password: "correct horse battery" }),
  });
  expect(res.status).toBe(303);
  return res.headers.getSetCookie().find((c) => c.startsWith("sid="))!.split(";")[0];
}

describe("people over HTTP", () => {
  it("won't act for someone who doesn't live here", async () => {
    const me = await register();
    const post = (path: string, fields: Record<string, string>) =>
      fetch(url(path), { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded", cookie: me }, body: new URLSearchParams(fields) });
    expect((await post("/world/depart", { destination: "supermarket", who: "toby" })).status).toBe(404);
    expect((await post("/character/train", { stat: "strength", who: "toby" })).status).toBe(404);
    expect((await post("/crew/task", { who: "toby", task: "work" })).status).toBe(404);
  });

  it("shows a newcomer's people panel with just them in it", async () => {
    const me = await register();
    const doc = new JSDOM(await (await fetch(url("/"), { headers: { cookie: me } })).text()).window.document;
    expect([...doc.querySelectorAll("#survivor [data-who]")].map((e) => e.getAttribute("data-who"))).toEqual(["you"]);
  });
});
