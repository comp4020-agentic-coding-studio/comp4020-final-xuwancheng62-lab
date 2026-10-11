import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, inject, it } from "vitest";
import { openDb, tx } from "../src/db.ts";
import { QUEST_COST, QUEST_XP, RATES } from "../src/game/config.ts";
import { SETS, isComplete } from "../src/game/collections.ts";
import { gainXp } from "../src/game/character.ts";
import { INVITED, LAST_REPLY, questProgress } from "../src/game/quests.ts";
import { currentRates } from "../src/game/resources.ts";
import { openLeads, type FragmentId } from "../src/game/stories.ts";
import { escape } from "../src/encounter.ts";
import { inviteToby, questState } from "../src/quests.ts";
import { createShelter, depart, loadShelter, recentLog } from "../src/shelter.ts";
import { foundIds } from "../src/stories.ts";

// Quests (PLAN.md, "Quests"): The Last Reply, Toby's recruitment. The rules
// are checked as pure functions; the whole quest is played on a throwaway
// database with a fixed clock, as in spec/collection.test.ts; the page and
// the invite are checked over HTTP.

const toby = SETS.find((s) => s.id === "toby")!;
const steps = (found: FragmentId[], marks: string[] = []) =>
  Object.fromEntries(questProgress(LAST_REPLY, { found, marks }).steps.map((s) => [s.step.id, s.state]));

describe("The Last Reply, as rules", () => {
  it("starts with Toby's cards and word for T, and unlocks the rest in order", () => {
    expect(steps([])).toEqual({ "signed-t": "current", "word-for-t": "current", "hold-for-him": "locked", underpass: "locked", screens: "locked", bench: "locked" });
    const parcel: FragmentId[] = ["exchange-chit", "left-word", "toby-answer", "word-north", "ruth-parcel"];
    // the letters alone don't find him: you have to know who T is
    expect(steps(parcel).underpass).toBe("locked");
    const all = [...parcel, "cart-dogs", "bus-2", "chime-camp", "dev-toolbag", "chained-valve", "chalk-warning", "toby-letter"] as FragmentId[];
    expect(steps(all).underpass).toBe("current");
    expect(steps([...all, "last-reply"]).screens).toBe("current");
    expect(steps([...all, "last-reply", "intake-screens"]).bench).toBe("current");
    const done = questProgress(LAST_REPLY, { found: [...all, "last-reply", "intake-screens"], marks: [INVITED] });
    expect(done.complete).toBe(true);
    expect(questProgress(LAST_REPLY, { found: ["cart-dogs", "chime-camp"], marks: [] }).steps[0].count).toEqual({ got: 2, of: toby.cards.length });
  });

  it("opens the way to the underpass exactly when Toby's set is complete and you hold the letters", () => {
    const groups = toby.cards.map((c) => c.evidence.map((e) => e.record));
    const opens = (found: FragmentId[]) => openLeads(found, "nest").some((l) => l.lead.id === "underpass");
    // every way of completing the set, with and without one card
    const combos = groups.reduce<FragmentId[][]>((acc, g) => acc.flatMap((a) => g.map((r) => [...a, r])), [[]]);
    for (const set of combos) {
      expect(isComplete(toby, set)).toBe(true);
      expect(opens(["ruth-parcel", ...set])).toBe(true);
      expect(opens(set)).toBe(false);
      for (let i = 0; i < set.length; i++) {
        const less = set.filter((r) => !groups[i].includes(r));
        expect(isComplete(toby, less)).toBe(false);
        expect(opens(["ruth-parcel", ...less])).toBe(false);
      }
    }
  });

  it("has Toby add to a running purifier, and eat", () => {
    const stock = { food: 10, water: 10, power: 10, scrap: 10 };
    const base = currentRates(stock).net;
    const withToby = currentRates(stock, 0, [{ who: "toby", working: true }]).net;
    expect(withToby.water - base.water).toBe(4);
    expect(withToby.food - base.food).toBe(-1);
    // no power, no purifier: he can't make water out of nothing
    const dry = { ...stock, power: 0 };
    expect(currentRates(dry, 0, [{ who: "toby", working: true }]).net.water).toBe(-RATES.upkeep.water);
  });
});

let db: DatabaseSync;
let userId: number;
let t: number;
const T0 = 1_800_000_000_000;

const shelterId = () => (db.prepare("SELECT id FROM shelters WHERE user_id = ?").get(userId) as { id: number }).id;
const journeyRow = () => db.prepare("SELECT * FROM journeys WHERE shelter_id = ? ORDER BY id DESC").get(shelterId()) as Record<string, number | string | null>;
const xpOf = () => db.prepare("SELECT level, xp FROM characters WHERE shelter_id = ? AND who = 'you'").get(shelterId()) as { level: number; xp: number };
const scrap = () => (db.prepare("SELECT scrap FROM shelters WHERE id = ?").get(shelterId()) as { scrap: number }).scrap;
const setScrap = (n: number) => db.prepare("UPDATE shelters SET scrap = ?, settled_at = ? WHERE id = ?").run(n, t, shelterId());
const residents = () => db.prepare("SELECT who FROM characters WHERE shelter_id = ? AND who != 'you'").all(shelterId());

// One whole trip; at the Nest, slip past the beast if there is one.
function trip(place: string, focus?: string): FragmentId | null {
  expect(depart(db, userId, place, t, focus).ok).toBe(true);
  let j = journeyRow();
  if (j.encounter_at != null) {
    expect(escape(db, userId, randomUUID(), Number(j.encounter_at), { escape: 0 }).ok).toBe(true);
    j = journeyRow();
  }
  loadShelter(db, userId, Number(j.return_at) + 1);
  t = Number(j.return_at) + 1000;
  return journeyRow().fragment_id as FragmentId | null;
}

// Everything up to meeting Toby: his seven cards, then the letters from Ruth.
function upToTheLetters() {
  for (const f of ["our-loop", "bus-2", "chime-camp", "dev-toolbag", "chained-valve", "chalk-warning", "toby-letter"]) {
    db.prepare("INSERT INTO discoveries (shelter_id, fragment_id, found_at) VALUES (?, ?, ?)").run(shelterId(), f, T0);
  }
  expect(trip("workshop", "look")).toBe("exchange-chit");
  for (const r of ["left-word", "toby-answer", "word-north", "ruth-parcel"]) expect(trip("workshop")).toBe(r);
}

beforeEach(() => {
  db = openDb(mkdtempSync(join(tmpdir(), "holdout-quest-")));
  userId = tx(db, () => {
    const { lastInsertRowid } = db.prepare("INSERT INTO users (username, password_hash, created_at) VALUES ('q', 'x', ?)").run(T0);
    createShelter(db, Number(lastInsertRowid), "q", T0);
    return Number(lastInsertRowid);
  });
  t = T0;
});

describe("The Last Reply, played", () => {
  it("meets Toby at the Nest with no fight, clears the screens with him, and he moves in once", () => {
    upToTheLetters();
    // Toby calls the dogs off: the trip that finds him has no beast
    expect(depart(db, userId, "nest", t, "underpass").ok).toBe(true);
    expect(journeyRow().encounter_at).toBeNull();
    expect(db.prepare("SELECT COUNT(*) AS n FROM encounters WHERE journey_id = ?").get(journeyRow().id)).toEqual({ n: 0 });
    loadShelter(db, userId, Number(journeyRow().return_at) + 1);
    t = Number(journeyRow().return_at) + 1000;
    expect(journeyRow().fragment_id).toBe("last-reply");

    // not yet: the screens come first
    expect(inviteToby(db, userId, t)).toMatchObject({ ok: false, status: 409 });

    // the rake costs scrap, taken when you leave
    setScrap(QUEST_COST.intakeScrap - 1);
    const short = depart(db, userId, "reservoir", t, "clear-intake");
    expect(short).toMatchObject({ ok: false, status: 409 });
    expect(scrap()).toBe(QUEST_COST.intakeScrap - 1);
    setScrap(50);
    expect(depart(db, userId, "reservoir", t, "clear-intake").ok).toBe(true);
    expect(scrap()).toBe(50 - QUEST_COST.intakeScrap);
    loadShelter(db, userId, Number(journeyRow().return_at) + 1);
    t = Number(journeyRow().return_at) + 1000;
    expect(journeyRow().fragment_id).toBe("intake-screens");

    // away from home, you can't ask him
    expect(depart(db, userId, "supermarket", t, "look").ok).toBe(true);
    expect(inviteToby(db, userId, t + 1)).toMatchObject({ ok: false, status: 409 });
    loadShelter(db, userId, Number(journeyRow().return_at) + 1);
    t = Number(journeyRow().return_at) + 1000;

    const before = xpOf();
    expect(inviteToby(db, userId, t)).toEqual({ ok: true });
    expect(inviteToby(db, userId, t + 1)).toEqual({ ok: true });
    expect(residents()).toEqual([{ who: "toby" }]);
    const expected = gainXp(before.level, before.xp, QUEST_XP["last-reply"]);
    expect(xpOf()).toEqual({ level: expected.level, xp: expected.xp });
    expect(recentLog(db, shelterId(), 100).filter((e) => e.message.startsWith("Toby moved in"))).toHaveLength(1);
    expect(questProgress(LAST_REPLY, questState(db, shelterId(), LAST_REPLY.id)).complete).toBe(true);
    expect(loadShelter(db, userId, t + 2).crew.map((m) => m.who)).toEqual(["you", "toby"]);

    // and his thanks to Ruth turns up on the bus shelter wall after all this
    expect(trip("supermarket", "bus-shelter-chalk")).toBe("toby-thanks");
  });

  it("doesn't find him without the letters, or let a trip there fight its way to him", () => {
    for (const f of ["our-loop", "bus-2", "chime-camp", "dev-toolbag", "chained-valve", "chalk-warning", "toby-letter"]) {
      db.prepare("INSERT INTO discoveries (shelter_id, fragment_id, found_at) VALUES (?, ?, ?)").run(shelterId(), f, T0);
    }
    expect(trip("nest", "underpass")).not.toBe("last-reply");
    expect(foundIds(db, shelterId())).not.toContain("last-reply");
  });

  it("skips a costed record you can't pay for when you're only looking around", () => {
    upToTheLetters();
    trip("nest", "underpass");
    setScrap(0);
    // looking around the reservoir still goes; it just can't be the screens
    expect(depart(db, userId, "reservoir", t, "look").ok).toBe(true);
    expect(journeyRow().fragment_id).not.toBe("intake-screens");
    expect(scrap()).toBe(0);
  });
});

const baseUrl = inject("baseUrl");
const url = (path: string) => new URL(path, baseUrl);

async function register(): Promise<string> {
  const res = await fetch(url("/register"), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: `spec_q${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, password: "correct horse battery" }),
  });
  expect(res.status).toBe(303);
  return res.headers.getSetCookie().find((c) => c.startsWith("sid="))!.split(";")[0];
}

describe("quests over HTTP", () => {
  it("shows The Last Reply in the journal from the start, at its first steps", async () => {
    const me = await register();
    const doc = new JSDOM(await (await fetch(url("/journal"), { headers: { cookie: me } })).text()).window.document;
    const quest = doc.querySelector("#jr-tasks [data-quest='last-reply']")!;
    expect(quest.textContent).toContain("The Last Reply");
    expect(quest.querySelector("[data-step='signed-t']")!.getAttribute("data-state")).toBe("current");
    expect(quest.querySelector("[data-step='bench']")!.getAttribute("data-state")).toBe("locked");
    expect(quest.querySelector("[data-step='signed-t']")!.textContent).toContain(`0 of ${toby.cards.length}`);
  });

  it("won't let a newcomer ask Toby to stay", async () => {
    const me = await register();
    const res = await fetch(url("/quests/last-reply/invite"), { method: "POST", redirect: "manual", headers: { cookie: me } });
    expect(res.status).toBe(409);
  });
});
