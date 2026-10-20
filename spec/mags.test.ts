import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, inject, it } from "vitest";
import { addResident, addSupply, starter } from "../src/character.ts";
import { changeBase } from "../src/base.ts";
import { openDb, tx } from "../src/db.ts";
import { discountedScrap } from "../src/game/base.ts";
import { BASE, BASE_BUILD_COSTS, CHARACTER, RECRUIT, RESIDENTS } from "../src/game/config.ts";
import { recruitLevel } from "../src/game/character.ts";
import type { PartyMember } from "../src/game/combat.ts";
import { effective } from "../src/game/items.ts";
import { EMPTY_IS_EMPTY, INVITED, questProgress } from "../src/game/quests.ts";
import { runSolo } from "../src/game/solo.ts";
import { fragment, openLeads, storyRouteBlock, type FragmentId } from "../src/game/stories.ts";
import { destination } from "../src/game/world.ts";
import { invite, questState } from "../src/quests.ts";
import { createShelter, depart, loadShelter, recentLog } from "../src/shelter.ts";
import { foundIds } from "../src/stories.ts";

// Mags (PLAN.md, "Empty Is Empty"): her quest, her work cutting what
// building costs in scrap, and her fighting strength against yours.

const T0 = 1_800_000_000_000;
const SET: FragmentId[] = ["mags-jobbook", "bus-2", "mags-bore-tag", "patels-keys", "ferris-docket", "mags-dropboard", "tagged-door"];

describe("Empty Is Empty, as rules", () => {
  const steps = (found: FragmentId[], marks: string[] = []) =>
    Object.fromEntries(questProgress(EMPTY_IS_EMPTY, { found, marks }).steps.map((s) => [s.step.id, s.state]));
  it("needs her whole set and the ledger before the warning, and the warning before asking her in", () => {
    expect(steps([])).toEqual({ "forty-one": "current", "week-17": "current", "note-on-the-board": "locked", "a-key-here": "locked" });
    expect(steps(SET)["note-on-the-board"]).toBe("locked");
    expect(steps(["wade-ledger"])["note-on-the-board"]).toBe("locked");
    expect(steps([...SET.slice(0, 6), "wade-ledger"])["note-on-the-board"]).toBe("locked");
    expect(steps([...SET, "wade-ledger"])["note-on-the-board"]).toBe("current");
    expect(steps([...SET, "wade-ledger", "mags-reply"])["a-key-here"]).toBe("current");
    expect(questProgress(EMPTY_IS_EMPTY, { found: [...SET, "wade-ledger", "mags-reply"], marks: [INVITED] }).complete).toBe(true);
  });
  it("opens the warning only with every card and the ledger, the plate standing in for the docket", () => {
    const opens = (found: FragmentId[]) => openLeads(found, "workshop").some((l) => l.lead.id === "note-for-mh");
    const all: FragmentId[] = [...SET, "wade-ledger"];
    expect(opens(all)).toBe(true);
    expect(opens(all.map((r) => (r === "ferris-docket" ? "unit-plate" : r)))).toBe(true);
    for (const r of all) expect(opens(all.filter((x) => x !== r)), `without ${r}`).toBe(false);
  });
  it("puts the scale house behind Helen's stolen post, and closes it once the ledger is found", () => {
    expect(storyRouteBlock("scale-house", [])).toBe("Recover the stolen post from the Weighbridge outskirts first");
    expect(storyRouteBlock("scale-house", ["convoy-manifest"])).not.toBeNull();
    expect(storyRouteBlock("scale-house", ["convoy-manifest", "helen-letter"])).toBeNull();
    expect(storyRouteBlock("scale-house", ["helen-letter", "wade-ledger"])).toBe("Investigation complete");
    expect(fragment("wade-ledger")!.afterVictory).toBe(true);
  });
});

describe("Mags on work", () => {
  it("cuts scrap by a quarter, rounded down, never below one, and leaves free jobs free", () => {
    expect(discountedScrap(40, [])).toBe(40);
    expect(discountedScrap(40, [RESIDENTS.mags.buildDiscount])).toBe(30);
    expect(discountedScrap(10, [RESIDENTS.mags.buildDiscount])).toBe(7);
    expect(discountedScrap(1, [RESIDENTS.mags.buildDiscount])).toBe(1);
    expect(discountedScrap(0, [RESIDENTS.mags.buildDiscount])).toBe(0);
    expect(discountedScrap(40, [0, RESIDENTS.mags.buildDiscount])).toBe(30);
  });

  let db: DatabaseSync;
  let user: number;
  const shelter = () => (db.prepare("SELECT id FROM shelters WHERE user_id = ?").get(user) as { id: number }).id;
  const scrap = () => (db.prepare("SELECT scrap FROM shelters WHERE user_id = ?").get(user) as { scrap: number }).scrap;
  const setScrap = (n: number) => db.prepare("UPDATE shelters SET scrap = ? WHERE user_id = ?").run(n, user);
  const task = (t: "work" | "guard") => db.prepare("UPDATE characters SET task = ? WHERE who = 'mags'").run(t);
  beforeEach(() => {
    db = openDb(mkdtempSync(join(tmpdir(), "holdout-mags-")));
    user = tx(db, () => {
      const id = Number(db.prepare("INSERT INTO users (username, password_hash, created_at) VALUES ('ana', 'x', ?)").run(T0).lastInsertRowid);
      createShelter(db, id, "ana", T0);
      return id;
    });
    tx(db, () => addResident(db, shelter(), "mags", T0));
  });

  it("charges the cut price for an upgrade while she's home on work, and the full price on guard", () => {
    const full = BASE_BUILD_COSTS.generator[1];
    task("work"); setScrap(100);
    tx(db, () => { addSupply(db, shelter(), "nails", 20, T0); addSupply(db, shelter(), "ducttape", 20, T0); addSupply(db, shelter(), "circuit", 4, T0); });
    expect(changeBase(db, user, "generator", "upgrade", "1", T0 + 1)).toEqual({ ok: true });
    expect(100 - scrap()).toBe(discountedScrap(full.scrap, [RESIDENTS.mags.buildDiscount]));
    task("guard"); setScrap(100);
    expect(changeBase(db, user, "generator", "upgrade", "2", T0 + 2)).toEqual({ ok: true });
    expect(100 - scrap()).toBe(BASE_BUILD_COSTS.generator[2].scrap);
  });

  it("repairs the door for less, and says what it cost", () => {
    task("work"); setScrap(100);
    db.prepare("UPDATE shelters SET gate_hp = 1 WHERE user_id = ?").run(user);
    expect(changeBase(db, user, "gate", "repair", "", T0 + 1)).toEqual({ ok: true });
    const cut = discountedScrap(BASE.repairScrap, [RESIDENTS.mags.buildDiscount]);
    expect(100 - scrap()).toBe(cut);
    expect(recentLog(db, shelter(), 5).some((e) => e.message === `Repaired the vault door for ${cut} scrap.`)).toBe(true);
  });

  it("gives no cut while she's out on a trip", () => {
    task("work"); setScrap(100);
    const mags = (db.prepare("SELECT id FROM characters WHERE who = 'mags'").get() as { id: number }).id;
    db.prepare(`INSERT INTO journeys (shelter_id, character_id, target_kind, target_id, action, departed_at, arrive_at, explore_until, return_at)
      VALUES (?, ?, 'place', 'supermarket', 'look', ?, ?, ?, ?)`).run(shelter(), mags, T0, T0 + 1e9, T0 + 2e9, T0 + 3e9);
    db.prepare("UPDATE shelters SET gate_hp = 1 WHERE user_id = ?").run(user);
    expect(changeBase(db, user, "gate", "repair", "", T0 + 1)).toEqual({ ok: true });
    expect(100 - scrap()).toBe(BASE.repairScrap);
  });

  it("joins once from the quest, never twice, and never before it's done", () => {
    const fresh = openDb(mkdtempSync(join(tmpdir(), "holdout-mags-quest-")));
    const u = tx(fresh, () => {
      const id = Number(fresh.prepare("INSERT INTO users (username, password_hash, created_at) VALUES ('ben', 'x', ?)").run(T0).lastInsertRowid);
      createShelter(fresh, id, "ben", T0);
      return id;
    });
    const sid = (fresh.prepare("SELECT id FROM shelters WHERE user_id = ?").get(u) as { id: number }).id;
    expect(invite(fresh, u, "mags", T0)).toMatchObject({ ok: false, status: 409 });
    for (const f of [...SET, "wade-ledger"]) fresh.prepare("INSERT INTO discoveries (shelter_id, fragment_id, found_at) VALUES (?, ?, ?)").run(sid, f, T0);
    expect(invite(fresh, u, "mags", T0)).toMatchObject({ ok: false, status: 409 });
    fresh.prepare("INSERT INTO discoveries (shelter_id, fragment_id, found_at) VALUES (?, 'mags-reply', ?)").run(sid, T0);
    expect(invite(fresh, u, "mags", T0 + 1)).toEqual({ ok: true });
    expect(invite(fresh, u, "mags", T0 + 2)).toEqual({ ok: true });
    expect(loadShelter(fresh, u, T0 + 3).crew.map((m) => m.who)).toEqual(["you", "mags"]);
    expect(recentLog(fresh, sid, 50).filter((e) => e.message.startsWith("Mags moved in"))).toHaveLength(1);
    expect(questState(fresh, sid, EMPTY_IS_EMPTY.id).marks).toEqual([INVITED]);
  });
});

describe("Mags in a fight", () => {
  const body = (id: "you" | "mags") => {
    const r = id === "you" ? CHARACTER : RESIDENTS.mags;
    return { level: 1, strength: r.strength, agility: r.agility, constitution: r.constitution };
  };
  const member = (id: "you" | "mags"): PartyMember => {
    const b = body(id);
    const gear = { weapon: starter("crowbar") };
    return { key: id, name: id, who: id, body: b, gear, pack: {}, belt: {}, hp: effective(b, gear, {}).maxHp, row: "front" };
  };
  const odds = (id: "you" | "mags", place: string) => {
    let wins = 0, left = 0;
    for (let seed = 1; seed <= 500; seed++) {
      const m = member(id);
      const r = runSolo(destination(place)!, m, seed);
      if (r.result === "won") { wins++; left += r.hp / m.hp; }
    }
    return { win: wins / 500, left: left / Math.max(1, wins) };
  };

  it("is stronger and slower than you: more HP lost, about the same chance to win", () => {
    expect(effective(body("mags"), { weapon: starter("crowbar") }, {}).maxHp).toBe(92);
    for (const place of ["supermarket", "workshop", "reservoir", "nest"]) {
      const her = odds("mags", place), you = odds("you", place);
      expect(her.win, place).toBeGreaterThanOrEqual(0.95);
      // never stronger than a fresh survivor, and never far weaker
      expect(her.left, place).toBeLessThanOrEqual(you.left + 0.02);
      expect(her.left, place).toBeGreaterThanOrEqual(you.left - 0.12);
    }
  });
});

describe("over HTTP", () => {
  it("won't let a newcomer ask Mags to stay, and 404s for nobody", async () => {
    const base = inject("baseUrl");
    const r = await fetch(new URL("/register", base), { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ username: `spec_mg${Date.now().toString(36)}`, password: "correct horse battery" }) });
    const cookie = r.headers.getSetCookie().find((c) => c.startsWith("sid="))!.split(";")[0];
    expect((await fetch(new URL("/residents/mags/invite", base), { method: "POST", redirect: "manual", headers: { cookie } })).status).toBe(409);
    expect((await fetch(new URL("/residents/nobody/invite", base), { method: "POST", redirect: "manual", headers: { cookie } })).status).toBe(404);
  });
});

describe("Week 17, played", () => {
  let db: DatabaseSync;
  let sid: number;
  let now: number;
  beforeEach(() => {
    now = T0;
    db = openDb(mkdtempSync(join(tmpdir(), "holdout-ledger-")));
    db.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (1, 'ledger_test', 'x', ?)").run(now);
    createShelter(db, 1, "ledger_test", now);
    sid = (db.prepare("SELECT id FROM shelters WHERE user_id = 1").get() as { id: number }).id;
    // strong enough to win, so this checks the story path, not the fight
    db.prepare("UPDATE characters SET level = 8, strength = 100, constitution = 100, hp = 700, max_hp = 760 WHERE shelter_id = ?").run(sid);
  });
  const clue = (id: string) => db.prepare("INSERT OR IGNORE INTO discoveries (shelter_id, fragment_id, found_at) VALUES (?, ?, ?)").run(sid, id, now);
  const go = (focus: string) => {
    const r = depart(db, 1, "scale-house", now, focus);
    return { r, j: db.prepare("SELECT * FROM journeys ORDER BY id DESC LIMIT 1").get() as { id: number; return_at: number; outcome_json: string } };
  };

  it("is refused before the stolen post, found only after winning and coming home, and never twice", () => {
    expect(go("scale-house-office").r.ok).toBe(false);
    clue("convoy-manifest"); clue("helen-letter");
    const { r, j } = go("scale-house-office");
    expect(r.ok).toBe(true);
    expect(JSON.parse(j.outcome_json).result).toBe("won");
    loadShelter(db, 1, j.return_at - 1);
    expect(foundIds(db, sid)).not.toContain("wade-ledger");
    now = j.return_at + 1;
    loadShelter(db, 1, now);
    expect(foundIds(db, sid)).toContain("wade-ledger");
    expect(depart(db, 1, "scale-house", now, "scale-house-office")).toMatchObject({ ok: false, status: 409 });
  });

  it("keeps the ledger back after an escape", () => {
    clue("convoy-manifest"); clue("helen-letter");
    const { j } = go("scale-house-office");
    const o = JSON.parse(j.outcome_json); o.result = "escaped";
    db.prepare("UPDATE journeys SET outcome_json = ? WHERE id = ?").run(JSON.stringify(o), j.id);
    loadShelter(db, 1, j.return_at + 1);
    expect(foundIds(db, sid)).not.toContain("wade-ledger");
  });
});

describe("recruits join near your level", () => {
  it("starts them two below you, never below 1, never past the cap", () => {
    expect(recruitLevel(1)).toBe(1);
    expect(recruitLevel(3)).toBe(1);
    expect(recruitLevel(10)).toBe(10 - RECRUIT.levelGap);
    expect(recruitLevel(CHARACTER.maxLevel)).toBe(CHARACTER.maxLevel - RECRUIT.levelGap);
  });

  const shelterFor = (name: string) => {
    const db = openDb(mkdtempSync(join(tmpdir(), `holdout-recruit-${name}-`)));
    const u = tx(db, () => {
      const id = Number(db.prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, 'x', ?)").run(name, T0).lastInsertRowid);
      createShelter(db, id, name, T0);
      return id;
    });
    const sid = (db.prepare("SELECT id FROM shelters WHERE user_id = ?").get(u) as { id: number }).id;
    return { db, u, sid };
  };
  const row = (db: DatabaseSync, who: string) => db.prepare("SELECT level, xp, unspent, strength, agility, constitution FROM characters WHERE who = ?").get(who) as { level: number; xp: number; unspent: number; strength: number; agility: number; constitution: number };

  it("gives a level-9 player a level-7 Mags with her own stats and 6 points to spend", () => {
    const { db, u, sid } = shelterFor("lv9");
    db.prepare("UPDATE characters SET level = 9 WHERE who = 'you'").run();
    for (const f of [...SET, "wade-ledger", "mags-reply"]) db.prepare("INSERT INTO discoveries (shelter_id, fragment_id, found_at) VALUES (?, ?, ?)").run(sid, f, T0);
    expect(invite(db, u, "mags", T0 + 1)).toEqual({ ok: true });
    const m = row(db, "mags");
    expect(m).toEqual({ level: 7, xp: 0, unspent: 6, strength: RESIDENTS.mags.strength, agility: RESIDENTS.mags.agility, constitution: RESIDENTS.mags.constitution });
    // asking again changes nothing
    expect(invite(db, u, "mags", T0 + 2)).toEqual({ ok: true });
    expect(row(db, "mags").unspent).toBe(6);
  });

  it("raises someone who joined before this, once, and leaves a new shelter's residents alone", () => {
    const { db, u, sid } = shelterFor("early");
    tx(db, () => addResident(db, sid, "toby", T0));
    db.prepare("UPDATE characters SET level = 2, xp = 15, unspent = 1 WHERE who = 'toby'").run();
    db.prepare("UPDATE characters SET level = 8 WHERE who = 'you'").run();
    // a shelter from before the change
    db.prepare("UPDATE shelters SET residents_levelled = 0 WHERE id = ?").run(sid);
    loadShelter(db, u, T0 + 1000);
    expect(row(db, "toby")).toMatchObject({ level: 6, xp: 0, unspent: 1 + 4 });
    // you level up later: they don't follow
    db.prepare("UPDATE characters SET level = 15 WHERE who = 'you'").run();
    loadShelter(db, u, T0 + 2000);
    expect(row(db, "toby").level).toBe(6);

    const fresh = shelterFor("fresh");
    tx(fresh.db, () => addResident(fresh.db, fresh.sid, "toby", T0));
    fresh.db.prepare("UPDATE characters SET level = 8 WHERE who = 'you'").run();
    loadShelter(fresh.db, fresh.u, T0 + 1000);
    expect(row(fresh.db, "toby").level).toBe(1);
  });

  it("never lowers a resident who is already ahead", () => {
    const { db, u, sid } = shelterFor("ahead");
    tx(db, () => addResident(db, sid, "toby", T0));
    db.prepare("UPDATE characters SET level = 12, unspent = 0 WHERE who = 'toby'").run();
    db.prepare("UPDATE characters SET level = 5 WHERE who = 'you'").run();
    db.prepare("UPDATE shelters SET residents_levelled = 0 WHERE id = ?").run(sid);
    loadShelter(db, u, T0 + 1000);
    expect(row(db, "toby")).toMatchObject({ level: 12, unspent: 0 });
  });
});
