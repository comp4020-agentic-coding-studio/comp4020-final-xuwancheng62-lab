import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, inject, it } from "vitest";
import { openDb, tx } from "../src/db.ts";
import { BELT, BONUSES, DROPS, GEAR, ITEM_KINDS, ORIGIN, QUALITIES, QUALITY, SUPPLIES, TRAITS, USES, type ItemKind } from "../src/game/config.ts";
import { cannotUse, effective, packLoad, requirement, rollDrop, rollGear, statsOf, traitSize, type Gear } from "../src/game/items.ts";
import { seeded } from "../src/game/rng.ts";
import { addSupply, carrySupply, equip, grantGear, starter, stashOf } from "../src/character.ts";
import { attack, escape, escapePct, useItem } from "../src/encounter.ts";
import { useAtHome, useMaterial } from "../src/items.ts";
import { createShelter, defenceOf, depart, loadShelter } from "../src/shelter.ts";

// Items (PLAN.md, "Items"): level is baseline power, quality is rarity and
// distinctive effects, origin is a separate label; duplicates are kept in
// the shelter's stash; supplies and materials have fixed uses. Rules are
// pure functions; the stash, trips and fights run on a throwaway database
// with fixed dice; the pages are checked over HTTP.

const body = { level: 1, strength: 5, agility: 5, maxHp: 100 };
const piece = (kind: ItemKind, o: Partial<Gear> = {}): Gear => ({ ...starter(kind), ...o });

describe("level and quality", () => {
  it("scale the main stat: level adds a little each step, quality multiplies it", () => {
    expect(statsOf(piece("crowbar")).damage).toEqual([6, 10]);
    const l10 = statsOf(piece("crowbar", { level: 10 })).damage!;
    expect(l10[0]).toBeGreaterThan(6);
    expect(l10[1]).toBeGreaterThan(10);
    const ranks = QUALITIES.map((q) => statsOf(piece("crowbar", { level: 10, quality: q })).damage![1]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(ranks[4]).toBeGreaterThan(ranks[0]);
    expect(statsOf(piece("jacket", { level: 10 })).armour).toBeGreaterThan(statsOf(piece("jacket")).armour!);
  });

  it("rolls more, and more distinctive, extras the rarer an item is, and the same item from the same seed", () => {
    for (const q of QUALITIES) {
      for (const kind of ["machete", "riot", "headtorch"] as ItemKind[]) {
        const g = rollGear(seeded(7), kind, 4, q);
        expect(Object.keys(g.bonuses)).toHaveLength(QUALITY[q].bonuses);
        expect(g.traits).toHaveLength(QUALITY[q].traits);
        // only extras that make sense where they sit
        for (const b of Object.keys(g.bonuses)) expect(BONUSES[b as keyof typeof BONUSES].on).toContain(GEAR[kind].slot);
        for (const t of g.traits) expect(TRAITS[t].on).toContain(GEAR[kind].slot);
        expect(rollGear(seeded(7), kind, 4, q)).toEqual(g);
      }
    }
    expect(traitSize("serrated", "epic")).toBeGreaterThan(traitSize("serrated", "rare"));
  });

  it("keeps origin separate from quality: any origin can come in any quality", () => {
    expect(new Set(Object.values(ORIGIN))).toEqual(new Set(["Improvised", "Civilian", "Council", "Police", "Military", "Experimental"]));
    for (const q of QUALITIES) expect(Object.values(ORIGIN)).not.toContain(QUALITY[q].name);
    expect(rollGear(seeded(1), "spear", 3, "legendary").quality).toBe("legendary");
    expect(GEAR.spear.origin).toBe("improvised");
  });

  it("asks for a level near the item's, and some kinds for Strength or Agility", () => {
    expect(requirement(piece("spear", { level: 9 })).level).toBe(7);
    expect(requirement(piece("spear")).level).toBe(1);
    expect(cannotUse(piece("spear", { level: 9 }), body)).toBe("Needs level 7");
    expect(cannotUse(piece("fireaxe"), body)).toBe("Needs Strength 6");
    expect(cannotUse(piece("bow", { level: 4 }), { ...body, level: 2 })).toBe("Needs Agility 6");
    expect(cannotUse(piece("crowbar"), body)).toBeNull();
  });
});

describe("tradeoffs beyond bigger numbers", () => {
  it("adds Strength to melee and half Agility to ranged, and swings a gun with no ammo as a club", () => {
    const bow = piece("bow", { level: 4 });
    const agile = { ...body, agility: 8 };
    const [lo] = statsOf(bow).damage!;
    expect(effective(agile, { weapon: bow }, { arrow: 5 }).damage[0]).toBe(lo + 4);
    const empty = effective(agile, { weapon: bow }, {});
    expect(empty.clubbing).toBe(true);
    expect(empty.damage).toEqual([2 + agile.strength, 5 + agile.strength]);
  });

  it("slows you in heavy armour unless it's Light, and counts ammunition against the pack", () => {
    expect(effective(body, { armour: piece("tyreplates") }).agility).toBe(body.agility - 1);
    expect(effective(body, { armour: piece("tyreplates", { traits: ["light"] }) }).agility).toBe(body.agility);
    expect(packLoad({ shot: 10 })).toBe(1);
    expect(packLoad({ rocket84: 1 })).toBe(5);
    expect(effective(body, { tool: piece("webbing") }).belt).toBe(BELT + 2);
    expect(effective(body, { armour: piece("jacket", { traits: ["sturdy"] }) }).maxHp).toBe(body.maxHp + TRAITS.sturdy.value);
  });
});

describe("what places turn up", () => {
  it("never gives Legendaries on solo trips, keeps levels in range, and names only real kinds", () => {
    for (const [place, t] of Object.entries(DROPS)) {
      for (const k of t.gear.kinds) expect(ITEM_KINDS).toContain(k);
      for (const s of t.supplies) expect(SUPPLIES[s.kind]).toBeDefined();
      expect(t.gear.quality.legendary).toBe(0);
      for (let seed = 1; seed < 300; seed++) {
        const g = rollDrop(seeded(seed), t).gear;
        if (!g) continue;
        expect(g.level, place).toBeGreaterThanOrEqual(Math.max(t.gear.levels[0], GEAR[g.kind].minLevel));
        expect(g.level, place).toBeLessThanOrEqual(Math.max(t.gear.levels[1], GEAR[g.kind].minLevel));
      }
    }
  });
});

let db: DatabaseSync;
let userId: number;
const T0 = 1_800_000_000_000;
const shelterId = () => (db.prepare("SELECT id FROM shelters WHERE user_id = ?").get(userId) as { id: number }).id;
const you = () => (db.prepare("SELECT id FROM characters WHERE shelter_id = ? AND who = 'you'").get(shelterId()) as { id: number }).id;
const journeyRow = () => db.prepare("SELECT * FROM journeys WHERE shelter_id = ? ORDER BY id DESC").get(shelterId()) as Record<string, number>;
const stash = () => stashOf(db, shelterId());

beforeEach(() => {
  db = openDb(mkdtempSync(join(tmpdir(), "holdout-items-")));
  userId = tx(db, () => {
    const { lastInsertRowid } = db.prepare("INSERT INTO users (username, password_hash, created_at) VALUES ('i', 'x', ?)").run(T0);
    createShelter(db, Number(lastInsertRowid), "i", T0);
    return Number(lastInsertRowid);
  });
});

describe("the stash", () => {
  it("keeps duplicates, for trading later", () => {
    grantGear(db, shelterId(), starter("crowbar"), T0);
    grantGear(db, shelterId(), starter("crowbar"), T0);
    expect(stash().gear.map((g) => g.kind)).toEqual(["crowbar", "crowbar"]);
  });

  it("fills a trip's finds in once, however often the shelter is loaded", () => {
    expect(depart(db, userId, "workshop", T0, "look").ok).toBe(true);
    const back = journeyRow().return_at + 1;
    loadShelter(db, userId, back);
    const once = JSON.stringify(stash());
    loadShelter(db, userId, back + 1);
    expect(JSON.stringify(stash())).toBe(once);
  });

  it("holds only so much on a belt, more with webbing, and only consumables there", () => {
    addSupply(db, shelterId(), "bandage", 5, T0);
    expect(carrySupply(db, userId, "bandage", BELT + 1, T0)).toMatchObject({ ok: false, status: 409 });
    expect(carrySupply(db, userId, "bandage", BELT, T0).ok).toBe(true);
    expect(stash().supplies.bandage).toBe(5 - BELT);
    const webbing = grantGear(db, shelterId(), starter("webbing"), T0);
    expect(equip(db, userId, webbing, T0).ok).toBe(true);
    expect(carrySupply(db, userId, "bandage", 2, T0).ok).toBe(true);
    addSupply(db, shelterId(), "nails", 4, T0);
    expect(carrySupply(db, userId, "nails", 1, T0)).toMatchObject({ ok: false, status: 400 });
    expect(carrySupply(db, userId, "bandage", -4, T0).ok).toBe(true);
    expect(stash().supplies.bandage).toBe(5);
  });

  it("lets a packed rocket take room a trip would fill", () => {
    const before = loadShelter(db, userId, T0).character.capacity;
    addSupply(db, shelterId(), "rocket84", 1, T0);
    expect(carrySupply(db, userId, "rocket84", 1, T0).ok).toBe(true);
    expect(loadShelter(db, userId, T0).character.capacity).toBe(before - SUPPLIES.rocket84.perUnit!);
  });
});

describe("materials have uses", () => {
  it("tears cloth into bandages and heals with them at home", () => {
    addSupply(db, shelterId(), "cloth", 3, T0);
    expect(useMaterial(db, userId, "bandage", T0).ok).toBe(true);
    expect(useMaterial(db, userId, "bandage", T0)).toMatchObject({ ok: false, status: 409 });
    expect(stash().supplies).toMatchObject({ cloth: 1, bandage: 1 });
    db.prepare("UPDATE characters SET hp = 50, hp_at = ? WHERE id = ?").run(T0, you());
    expect(useAtHome(db, userId, "bandage", T0).ok).toBe(true);
    expect(loadShelter(db, userId, T0).character.hp).toBe(50 + SUPPLIES.bandage.heal!);
  });

  it("turns a stick into a nail bat with the stick's own level and quality", () => {
    const stick = grantGear(db, shelterId(), piece("stick", { level: 3, quality: "rare", traits: ["quick"] }), T0);
    expect(useMaterial(db, userId, "nailbat", T0, stick)).toMatchObject({ ok: false, status: 409 });
    addSupply(db, shelterId(), "nails", 4, T0);
    expect(useMaterial(db, userId, "nailbat", T0, stick).ok).toBe(true);
    expect(stash().gear).toEqual([expect.objectContaining({ id: stick, kind: "nailbat", level: 3, quality: "rare", traits: ["quick"] })]);
  });

  it("cuts scrap into shot, tapes the seal for defence, and feeds the generator and purifier", () => {
    const s0 = loadShelter(db, userId, T0);
    expect(useMaterial(db, userId, "shot", T0).ok).toBe(true);
    expect(stash().supplies.shot).toBe(USES.shot.makes);
    addSupply(db, shelterId(), "ducttape", 2, T0);
    expect(useMaterial(db, userId, "tape", T0).ok).toBe(true);
    expect(useMaterial(db, userId, "tape", T0)).toMatchObject({ ok: false, status: 409 });
    expect(defenceOf(loadShelter(db, userId, T0))).toBe(defenceOf(s0) + USES.tape.defence);
    expect(defenceOf(loadShelter(db, userId, T0 + USES.tape.ms + 1))).toBe(defenceOf(s0));
    addSupply(db, shelterId(), "circuit", 1, T0);
    addSupply(db, shelterId(), "sorbent", 2, T0);
    const before = loadShelter(db, userId, T0).stock;
    expect(useMaterial(db, userId, "circuit", T0).ok).toBe(true);
    expect(useMaterial(db, userId, "sorbent", T0).ok).toBe(true);
    const after = loadShelter(db, userId, T0).stock;
    expect(after.power - before.power).toBeCloseTo(USES.circuit.power, 0);
    expect(after.water - before.water).toBeCloseTo(USES.sorbent.water, 0);
    // a purifier with no power can't use a fresh stack
    db.prepare("UPDATE shelters SET power = 0, settled_at = ? WHERE id = ?").run(T0, shelterId());
    expect(useMaterial(db, userId, "sorbent", T0)).toMatchObject({ ok: false, status: 409 });
    expect(useMaterial(db, userId, "nonsense", T0)).toMatchObject({ ok: false, status: 400 });
  });
});

describe("items in a fight", () => {
  function toTheBeast(): number {
    expect(depart(db, userId, "nest", T0, "look").ok).toBe(true);
    const at = journeyRow().encounter_at;
    loadShelter(db, userId, at);
    return at;
  }
  const enc = () => db.prepare("SELECT * FROM encounters WHERE shelter_id = ? ORDER BY id DESC").get(shelterId()) as Record<string, number | string>;

  it("fires one round a shot, picks half up after a win, and clubs when it runs out", () => {
    const sling = grantGear(db, shelterId(), starter("slingshot"), T0);
    expect(equip(db, userId, sling, T0).ok).toBe(true);
    addSupply(db, shelterId(), "shot", 4, T0);
    expect(carrySupply(db, userId, "shot", 4, T0).ok).toBe(true);
    const at = toTheBeast();
    for (let n = 0; n < 4; n++) expect(attack(db, userId, randomUUID(), n, at, { hit: 1, bite: 1 }).ok).toBe(true);
    expect(loadShelter(db, userId, at).character.clubbing).toBe(true);
    expect(attack(db, userId, randomUUID(), 4, at, { hit: 999, bite: 1 }).ok).toBe(true);
    expect(enc()).toMatchObject({ state: "won", ammo_used: 4 });
    expect(loadShelter(db, userId, at).character.pack).toEqual({ shot: 2 });
  });

  it("takes the turn to use a bandage, lets a flare scatter it, and never makes escape certain", () => {
    addSupply(db, shelterId(), "bandage", 1, T0, { id: you(), slot: "belt" });
    addSupply(db, shelterId(), "flare", 1, T0, { id: you(), slot: "belt" });
    db.prepare("UPDATE characters SET hp = 50 WHERE id = ?").run(you());
    const at = toTheBeast();
    expect(useItem(db, userId, randomUUID(), 0, "bandage", at, { bite: 10 }).ok).toBe(true);
    expect(loadShelter(db, userId, at).character.hp).toBe(50 + SUPPLIES.bandage.heal! - 10);
    expect(useItem(db, userId, randomUUID(), 1, "flare", at, { bite: 15 }).ok).toBe(true);
    expect(loadShelter(db, userId, at).character.hp).toBe(60);
    // used up: nothing left to use
    expect(useItem(db, userId, randomUUID(), 2, "bandage", at)).toMatchObject({ ok: false, status: 409 });
    expect(useItem(db, userId, randomUUID(), 2, "nails", at)).toMatchObject({ ok: false, status: 400 });
    // even a very lucky escape can fail
    const m = loadShelter(db, userId, at).crew[0];
    expect(escapePct(m, 500)).toBe(95);
    expect(escape(db, userId, randomUUID(), at, { escape: 96 }).ok).toBe(true);
    expect(enc()).toMatchObject({ state: "combat", escape_used: 1 });
  });

  it("lets a Last-seal Legendary keep its wearer up once, alone at the Nest too", () => {
    const suit = grantGear(db, shelterId(), piece("hazmat", { level: 3, quality: "legendary", traits: ["lastseal"], name: "CS-4 Seal-Suit" }), T0);
    expect(equip(db, userId, suit, T0).ok).toBe(true);
    const at = toTheBeast();
    db.prepare("UPDATE characters SET hp = 5 WHERE id = ?").run(you());
    expect(attack(db, userId, randomUUID(), 0, at, { hit: 1, bite: 15 }).ok).toBe(true);
    expect(enc()).toMatchObject({ state: "combat", seal_used: 1 });
    expect(loadShelter(db, userId, at).character.hp).toBe(1);
    expect(attack(db, userId, randomUUID(), 1, at, { hit: 1, bite: 15 }).ok).toBe(true);
    expect(enc().state).toBe("defeated");
  });

  it("lights smoke to help one escape", () => {
    addSupply(db, shelterId(), "smoke", 1, T0, { id: you(), slot: "belt" });
    const at = toTheBeast();
    expect(useItem(db, userId, randomUUID(), 0, "smoke", at, { bite: 1 }).ok).toBe(true);
    // 50% alone would fail on 70; with smoke it's 80%
    expect(escape(db, userId, randomUUID(), at, { escape: 70 }).ok).toBe(true);
    expect(enc().state).toBe("escaped");
  });
});

const baseUrl = inject("baseUrl");
const url = (path: string) => new URL(path, baseUrl);
async function post(path: string, fields: Record<string, string>, cookie?: string): Promise<Response> {
  return fetch(url(path), { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded", ...(cookie ? { cookie } : {}) }, body: new URLSearchParams(fields) });
}
async function register(): Promise<string> {
  const res = await post("/register", { username: `spec_it${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, password: "correct horse battery" });
  expect(res.status).toBe(303);
  return res.headers.getSetCookie().find((c) => c.startsWith("sid="))!.split(";")[0];
}
const doc = async (path: string, cookie: string) => new JSDOM(await (await fetch(url(path), { headers: { cookie } })).text()).window.document;

describe("items over HTTP", () => {
  it("writes quality out as well as colouring it, with level, origin and type, and compares for each person", async () => {
    const me = await register();
    expect((await post("/gear/unequip", { slot: "weapon" }, me)).status).toBe(303);
    const card = (await doc("/", me)).querySelector("#stash .it")!;
    expect(card.getAttribute("data-quality")).toBe("common");
    expect(card.classList.contains("q-common")).toBe(true);
    expect(card.querySelector(".it-q")!.textContent).toBe("Common");
    expect(card.querySelector(".it-meta")!.textContent).toBe("Level 1 · Civilian · Weapon");
    expect(card.querySelector(".it-cmp")!.textContent).toContain("▲");
  });

  it("refuses nonsense and fights that aren't happening", async () => {
    const me = await register();
    expect((await post("/gear/carry", { kind: "__proto__", n: "1" }, me)).status).toBe(400);
    expect((await post("/gear/carry", { kind: "bandage", n: "1" }, me)).status).toBe(409);
    expect((await post("/stash/use", { use: "constructor" }, me)).status).toBe(400);
    expect((await post("/encounter/use", { request_id: randomUUID(), turn: "0", item: "bandage" }, me)).status).toBe(409);
  });
});
