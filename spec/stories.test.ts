import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { MIGRATIONS, openDb, tx } from "../src/db.ts";
import { carry } from "../src/game/character.ts";
import { DESTINATIONS, rollOutcome } from "../src/game/world.ts";
import {
  CONNECTIONS, FRAGMENTS, LEADS, LOOK_AROUND, QUESTIONS, STATUS_TEXT, connectionsFor, defaultFocus, openLeads, openQuestions,
  pickFragment, placeStatus, type FragmentId,
} from "../src/game/stories.ts";
import { attack } from "../src/encounter.ts";
import { createShelter, depart, loadShelter, recentLog } from "../src/shelter.ts";
import { foundIds } from "../src/stories.ts";
import { journalPage } from "../src/journalViews.ts";

// Records in the wasteland (PLAN.md): the rules as pure functions, then the
// timed flow on a throwaway database, as spec/encounter.test.ts does.

// Plays a run of trips by the pure rules: each step is [place, focus], with
// focus undefined for whatever the form defaults to.
function play(steps: [string, string | undefined][]): FragmentId[] {
  const found: FragmentId[] = [];
  for (const [place, focus] of steps) {
    const f = pickFragment(found, place, focus ?? defaultFocus(found, place));
    if (f) found.push(f);
  }
  return found;
}

describe("the records and their leads", () => {
  it("are all reachable from what you can find by looking around", () => {
    const found: FragmentId[] = [];
    for (let changed = true; changed; ) {
      changed = false;
      for (const f of FRAGMENTS) {
        if (found.includes(f.id)) continue;
        if (f.order || openLeads(found, f.place).some((l) => l.lead.fragment === f.id)) {
          found.push(f.id);
          changed = true;
        }
      }
    }
    expect(found.sort()).toEqual(FRAGMENTS.map((f) => f.id).sort());
  });

  it("are written consistently: every lead's record sits behind it, at its place", () => {
    for (const l of LEADS) {
      const f = FRAGMENTS.find((x) => x.id === l.fragment)!;
      expect(f.lead).toBe(l.id);
      expect(f.place).toBe(l.place);
      expect(Object.keys(l.from).length).toBeGreaterThan(0);
    }
    for (const f of FRAGMENTS) expect(Boolean(f.order) !== Boolean(f.lead)).toBe(true);
    for (const c of [...CONNECTIONS.flatMap((c) => [c.a, c.b]), ...QUESTIONS.flatMap((q) => [...q.openedBy, ...q.about])]) {
      expect(FRAGMENTS.some((f) => f.id === c)).toBe(true);
    }
  });

  it("give the same short introduction to anyone who takes the defaults at the Supermarket", () => {
    expect(play([["supermarket", undefined], ["supermarket", undefined], ["supermarket", undefined]])).toEqual(["ration-sign", "locker-6", "bus-2"]);
    // and the first two already have something in common
    expect(connectionsFor(["ration-sign", "locker-6"])).toHaveLength(1);
  });

  it("let someone who never picks a lead still find the opening records, then the leads", () => {
    const look: [string, string][] = Array(7).fill(["supermarket", LOOK_AROUND]);
    // then the oldest lead each time: the locker, the basement, the lists
    expect(play(look)).toEqual(["ration-sign", "store-instruction", "cart-dogs", "chalk-warning", "locker-6", "cs4-board", "bus-2"]);
  });

  it("start the form on the newest lead there, ties going to the one written first", () => {
    expect(defaultFocus([], "supermarket")).toBe(LOOK_AROUND);
    expect(defaultFocus(["ration-sign"], "supermarket")).toBe("kerrys-locker");
    // the radio log opens two leads at once, at different places
    expect(defaultFocus(["radio-log"], "supermarket")).toBe("passenger-lists");
    expect(defaultFocus(["radio-log"], "reservoir")).toBe("station-office");
  });

  it("treat a lead you don't have, or have already followed, as looking around", () => {
    expect(pickFragment([], "supermarket", "passenger-lists")).toBe("ration-sign");
    expect(pickFragment(["ration-sign", "locker-6"], "supermarket", "kerrys-locker")).toBe("store-instruction");
    expect(pickFragment([], "supermarket", "__proto__")).toBe("ration-sign");
  });

  it("make out-of-order runs work: Reservoir first, then the lists", () => {
    const found = play([["reservoir", undefined], ["reservoir", undefined], ["reservoir", undefined], ["supermarket", "passenger-lists"]]);
    expect(found).toEqual(["our-loop", "radio-log", "day-140", "bus-2"]);
    expect(connectionsFor(found).map((c) => c.text)).toContain("The Bus 2 list has 48 seats. The radio log records 46 arriving.");
  });

  it("give nothing once a place is read, and say so without naming any record", () => {
    const all = play(Array(9).fill(["supermarket", undefined]));
    expect(all).toHaveLength(7);
    expect(pickFragment(all, "supermarket", LOOK_AROUND)).toBeNull();
    // Toby's chalked reply waits behind a lead you can't have yet
    expect(placeStatus(all, "supermarket")).toBe("unknown");
    expect(placeStatus([], "supermarket")).toBe("corners");
    expect(placeStatus(["ration-sign"], "supermarket")).toBe("leads");
    // the exercise book points into the gallery, and the gallery to the valve
    expect(placeStatus(["our-loop", "radio-log", "day-140"], "reservoir")).toBe("leads");
    // the radio log and the exercise book also point to the bore house, and the run sheet to its motor
    expect(placeStatus(["our-loop", "radio-log", "day-140", "dev-toolbag", "chained-valve"], "reservoir")).toBe("leads");
    expect(placeStatus(["our-loop", "radio-log", "day-140", "dev-toolbag", "chained-valve", "pump-log", "mags-bore-tag"], "reservoir")).toBe("done");
    expect(placeStatus([], "nest")).toBe("corners");
    expect(placeStatus([], "workshop")).toBe("corners");
    expect(placeStatus([], "nowhere")).toBeNull();
    for (const text of Object.values(STATUS_TEXT)) for (const f of FRAGMENTS) expect(text).not.toContain(f.title);
  });

  it("show a connection only once both records are found, and never answer a question", () => {
    expect(connectionsFor(["store-instruction"])).toEqual([]);
    expect(connectionsFor(["store-instruction", "radio-log"])).toHaveLength(1);
    expect(openQuestions([]).length).toBe(0);
    expect(openQuestions(["cart-dogs"]).map((q) => q.id)).toEqual(["dogs", "gerald"]);
    const page = String(journalPage(FRAGMENTS.map((f) => ({ id: f.id, at: 0, journeyId: null }))));
    expect(page).not.toMatch(/answered|solved|the truth/i);
  });
});

// ---- the timed flow, on a throwaway database

const supermarket = DESTINATIONS.find((d) => d.id === "supermarket")!;
let dir: string;
let db: DatabaseSync;
let userId: number;
let t: number;
const T0 = 1_800_000_000_000;

function player(d = db, name = `p${Math.random().toString(36).slice(2, 8)}`): number {
  return tx(d, () => {
    const { lastInsertRowid } = d.prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, 'x', ?)").run(name, T0);
    createShelter(d, Number(lastInsertRowid), name, T0);
    return Number(lastInsertRowid);
  });
}
const shelterId = () => (db.prepare("SELECT id FROM shelters WHERE user_id = ?").get(userId) as { id: number }).id;
const journeyRow = () => db.prepare("SELECT * FROM journeys WHERE shelter_id = ? ORDER BY id DESC").get(shelterId()) as Record<string, number | string | null>;

// One whole trip: leave at t, come home, and t moves on past the return.
function trip(place: string, focus?: string): Record<string, number | string | null> {
  expect(depart(db, userId, place, t, focus).ok).toBe(true);
  const j = journeyRow();
  loadShelter(db, userId, Number(j.return_at) + 1);
  t = Number(j.return_at) + 1000;
  return journeyRow();
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "holdout-rec-"));
  db = openDb(dir);
  userId = player();
  t = T0;
});

describe("finding records on a trip", () => {
  it("picks the record when you leave, and gives it to you only when you arrive", () => {
    expect(depart(db, userId, "supermarket", t).ok).toBe(true);
    const j = journeyRow();
    expect(j.fragment_id).toBe("ration-sign");
    expect(loadShelter(db, userId, Number(j.arrive_at) - 1).journey?.found).toBeNull();
    expect(foundIds(db, shelterId())).toEqual([]);
    const s = loadShelter(db, userId, Number(j.arrive_at));
    expect(s.journey?.found?.title).toBe("Limits until further notice");
    expect(foundIds(db, shelterId())).toEqual(["ration-sign"]);
  });

  it("records it once and logs it once, however often the shelter is loaded", () => {
    expect(depart(db, userId, "supermarket", t).ok).toBe(true);
    const j = journeyRow();
    for (let i = 0; i < 5; i++) loadShelter(db, userId, Number(j.arrive_at) + i);
    expect(db.prepare("SELECT COUNT(*) AS n FROM discoveries").get()).toEqual({ n: 1 });
    expect(recentLog(db, shelterId()).filter((e) => e.kind === "record")).toHaveLength(1);
  });

  it("gives one new record per trip while there's one to find, then none", () => {
    const got = Array.from({ length: 9 }, () => trip("supermarket").fragment_id);
    expect(got).toEqual(["ration-sign", "locker-6", "bus-2", "store-instruction", "cs4-board", "cart-dogs", "chalk-warning", null, null]);
    expect(foundIds(db, shelterId())).toHaveLength(7);
  });

  it("follows the lead you choose, and ignores one you can't follow", () => {
    trip("supermarket");
    expect(trip("supermarket", LOOK_AROUND).fragment_id).toBe("store-instruction");
    // not a lead here, so the trip starts on the newest one: the basement
    expect(trip("supermarket", "station-office").fragment_id).toBe("cs4-board");
  });

  it("doesn't change what you bring home", () => {
    trip("supermarket");
    for (const focus of ["kerrys-locker", LOOK_AROUND]) {
      const j = trip("supermarket", focus);
      const rolled = rollOutcome(supermarket, Number(j.id));
      expect(JSON.parse(String(j.outcome_json)).loot).toEqual(carry(rolled.loot, 40).carried);
    }
  });

  it("keeps what you've found through a defeat and the loss of your gear", () => {
    trip("supermarket");
    trip("supermarket");
    expect(depart(db, userId, "nest", t).ok).toBe(true);
    const at = Number(journeyRow().encounter_at);
    db.prepare("UPDATE characters SET hp = 1 WHERE shelter_id = ?").run(shelterId());
    expect(attack(db, userId, randomUUID(), 0, at, { hit: 1, bite: 15 }).ok).toBe(true);
    loadShelter(db, userId, Number(journeyRow().return_at) + 1);
    expect(db.prepare("SELECT state FROM encounters").get()).toEqual({ state: "defeated" });
    // the camp at the Nest's mouth is found on arrival, before the beast
    expect(foundIds(db, shelterId())).toEqual(["ration-sign", "locker-6", "chime-camp"]);
  });

  it("keeps each player's records to themselves", () => {
    trip("supermarket");
    const other = player();
    const otherShelter = (db.prepare("SELECT id FROM shelters WHERE user_id = ?").get(other) as { id: number }).id;
    expect(foundIds(db, otherShelter)).toEqual([]);
    // the other player starts at the beginning, not where this one left off
    expect(depart(db, other, "supermarket", t).ok).toBe(true);
    expect((db.prepare("SELECT fragment_id FROM journeys WHERE shelter_id = ?").get(otherShelter) as { fragment_id: string }).fragment_id).toBe("ration-sign");
  });

  it("leaves a trip already under way before the update without a record", () => {
    const old = mkdtempSync(join(tmpdir(), "holdout-v6-"));
    const raw = new DatabaseSync(join(old, "game.db"));
    for (const m of MIGRATIONS.slice(0, 6)) raw.exec(m);
    raw.exec("PRAGMA user_version = 6");
    raw.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (1, 'old', 'x', ?)").run(T0);
    raw.prepare("INSERT INTO shelters (id, user_id, name, food, water, power, scrap, settled_at) VALUES (1, 1, 'old', 10, 10, 10, 10, ?)").run(T0);
    raw.prepare("INSERT INTO characters (shelter_id, hp_at) VALUES (1, ?)").run(T0);
    raw.prepare("INSERT INTO journeys (shelter_id, target_kind, target_id, action, departed_at, arrive_at, explore_until, return_at) VALUES (1, 'location', 'supermarket', 'scavenge', ?, ?, ?, ?)").run(T0, T0 + 1000, T0 + 2000, T0 + 3000);
    raw.close();

    const migrated = openDb(old);
    expect(loadShelter(migrated, 1, T0 + 1500).journey?.found).toBeNull();
    loadShelter(migrated, 1, T0 + 4000);
    expect(foundIds(migrated, 1)).toEqual([]);
    expect(depart(migrated, 1, "supermarket", T0 + 5000).ok).toBe(true);
    expect(migrated.prepare("SELECT fragment_id FROM journeys ORDER BY id DESC").get()).toEqual({ fragment_id: "ration-sign" });
  });
});
