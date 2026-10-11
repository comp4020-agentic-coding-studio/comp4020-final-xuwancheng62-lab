import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { MIGRATIONS, openDb, tx } from "../src/db.ts";
import { CHARACTER, DOT, RESIDENTS, STARTING_STOCK } from "../src/game/config.ts";
import { dotTicks, maxHpOf } from "../src/game/character.ts";
import { effective } from "../src/game/items.ts";
import { equip, grantGear, starter, train, unequip } from "../src/character.ts";
import { createShelter, loadShelter } from "../src/shelter.ts";

// Constitution (PLAN.md, "Character"): max HP comes from attributes only,
// equipment can't heal anyone, and the migration keeps everyone's progress.

const T0 = 1_800_000_000_000;

describe("max HP from attributes", () => {
  it("is 60 + 5 per Constitution + 2 per Strength, and a new survivor still starts on 100", () => {
    expect(maxHpOf(CHARACTER.strength, CHARACTER.constitution)).toBe(100);
    expect(maxHpOf(5, 7) - maxHpOf(5, 6)).toBe(CHARACTER.hpPerConstitution);
    expect(maxHpOf(6, 6) - maxHpOf(5, 6)).toBe(CHARACTER.hpPerStrength);
    // Toby keeps his own build: frailer than you, never below his old 80
    expect(maxHpOf(RESIDENTS.toby.strength, RESIDENTS.toby.constitution)).toBe(83);
  });

  it("adds nothing for levels, and counts what's worn", () => {
    const body = { level: 1, strength: 5, agility: 5, constitution: 6 };
    expect(effective({ ...body, level: 20 }, {}).maxHp).toBe(effective(body, {}).maxHp);
    const vest = { ...starter("jacket"), bonuses: { constitution: 2, strength: 1 } };
    expect(effective(body, { armour: vest }).maxHp).toBe(100 + 2 * CHARACTER.hpPerConstitution + CHARACTER.hpPerStrength);
  });

  it("shortens poison and bleeding by a tick per few points, never below one, and never touches a hit", () => {
    expect(dotTicks(5, 3)).toBe(5);
    expect(dotTicks(5, DOT.constitutionPerTick)).toBe(4);
    expect(dotTicks(5, 99)).toBe(DOT.minTicks);
    expect(dotTicks(0, 99)).toBe(0);
  });
});

function player(db: DatabaseSync): number {
  return tx(db, () => {
    const { lastInsertRowid } = db.prepare("INSERT INTO users (username, password_hash, created_at) VALUES ('c', 'x', ?)").run(T0);
    createShelter(db, Number(lastInsertRowid), "c", T0);
    return Number(lastInsertRowid);
  });
}

describe("no free healing", () => {
  it("raises max HP, never current HP, when gear or training adds to it", () => {
    const db = openDb(mkdtempSync(join(tmpdir(), "holdout-con-")));
    const u = player(db);
    const sid = (db.prepare("SELECT id FROM shelters WHERE user_id = ?").get(u) as { id: number }).id;
    const vest = grantGear(db, sid, { ...starter("jacket"), bonuses: { constitution: 3 } }, T0);
    db.prepare("UPDATE characters SET hp = 60, hp_at = ?, unspent = 1").run(T0);
    expect(equip(db, u, vest, T0).ok).toBe(true);
    expect(loadShelter(db, u, T0).character).toMatchObject({ hp: 60, maxHp: 115 });
    expect(unequip(db, u, "armour", T0).ok).toBe(true);
    expect(loadShelter(db, u, T0).character).toMatchObject({ hp: 60, maxHp: 100 });
    expect(train(db, u, "constitution", T0).ok).toBe(true);
    expect(loadShelter(db, u, T0).character).toMatchObject({ hp: 60, maxHp: 105, constitution: 7 });
  });

  it("doesn't bank rest at full health to spend on new max HP later", () => {
    const db = openDb(mkdtempSync(join(tmpdir(), "holdout-con-")));
    const u = player(db);
    const sid = (db.prepare("SELECT id FROM shelters WHERE user_id = ?").get(u) as { id: number }).id;
    const vest = grantGear(db, sid, { ...starter("jacket"), bonuses: { constitution: 3 } }, T0);
    // full at T0, then nobody looks for a long time
    loadShelter(db, u, T0);
    const later = T0 + 6 * 3_600_000;
    expect(equip(db, u, vest, later).ok).toBe(true);
    expect(loadShelter(db, u, later).character).toMatchObject({ hp: 100, maxHp: 115 });
    // off and on again: the cap takes HP down, nothing brings it back
    expect(unequip(db, u, "armour", later).ok).toBe(true);
    expect(equip(db, u, vest, later).ok).toBe(true);
    expect(loadShelter(db, u, later).character.hp).toBe(100);
  });
});

describe("migrating to Constitution", () => {
  it("keeps everyone's max HP or more, current HP as it was, and item bonuses as the same HP", () => {
    const old = mkdtempSync(join(tmpdir(), "holdout-v14-"));
    const raw = new DatabaseSync(join(old, "game.db"));
    for (const m of MIGRATIONS.slice(0, 14)) raw.exec(m);
    raw.exec("PRAGMA user_version = 14");
    raw.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (1, 'old', 'x', ?)").run(T0);
    const s = STARTING_STOCK;
    raw.prepare("INSERT INTO shelters (id, user_id, name, food, water, power, scrap, settled_at) VALUES (1, 1, 'old', ?, ?, ?, ?, ?)").run(s.food, s.water, s.power, s.scrap, T0);
    // you trained +10 max HP twice and Strength twice; Toby is as he joined
    raw.prepare("INSERT INTO characters (shelter_id, who, combat, strength, agility, max_hp, hp, hp_at) VALUES (1, 'you', 10, 7, 5, 120, 90, ?), (1, 'toby', 6, 4, 7, 80, 80, ?)").run(T0, T0);
    raw.prepare(`INSERT INTO items (shelter_id, kind, level, quality, bonuses_json, created_at) VALUES (1, 'jacket', 3, 'uncommon', '{"maxHp":10}', ?)`).run(T0);
    raw.close();

    const db = openDb(old);
    const rows = db.prepare("SELECT who, strength, constitution, hp FROM characters ORDER BY who != 'you'").all() as { who: string; strength: number; constitution: number; hp: number }[];
    const before = { you: 120, toby: 80 };
    for (const r of rows) expect(maxHpOf(r.strength, r.constitution)).toBeGreaterThanOrEqual(before[r.who as "you" | "toby"]);
    // the least Constitution that does it: one point less would fall short
    for (const r of rows) expect(maxHpOf(r.strength, r.constitution - 1)).toBeLessThan(before[r.who as "you" | "toby"]);
    expect(rows.map((r) => r.hp)).toEqual([90, 80]);
    expect(JSON.parse((db.prepare("SELECT bonuses_json FROM items").get() as { bonuses_json: string }).bonuses_json)).toEqual({ constitution: 2 });
    expect(loadShelter(db, 1, T0 + 1).character.hp).toBe(90);
  });
});
