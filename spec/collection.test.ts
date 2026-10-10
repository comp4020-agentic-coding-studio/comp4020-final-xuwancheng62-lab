import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, inject, it } from "vitest";
import { MIGRATIONS, openDb, tx } from "../src/db.ts";
import { COLLECTION_XP, XP } from "../src/game/config.ts";
import { gainXp } from "../src/game/character.ts";
import { SETS, canRead, isComplete, isUnlocked, panels, recordsOf, setTitle, shownEvidence, unlockedCount } from "../src/game/collections.ts";
import { comicPage } from "../src/collectionViews.ts";
import { existsSync } from "node:fs";
import { FRAGMENTS, type FragmentId } from "../src/game/stories.ts";
import { attack, escape } from "../src/encounter.ts";
import { settleCollections } from "../src/collections.ts";
import { createShelter, depart, loadShelter, recentLog } from "../src/shelter.ts";
import { foundIds } from "../src/stories.ts";

// Story collections (docs/narrative/toby-collection.md): cards read from the
// journal's discoveries, and a one-time reward for finishing a set. Timed
// play runs on a throwaway database, as in spec/stories.test.ts; the pages
// are checked over HTTP.

const toby = SETS.find((s) => s.id === "toby")!;

describe("the Toby set", () => {
  it("has seven cards, each unlocked by records that exist, and a comic told across pages", () => {
    expect(toby.cards).toHaveLength(7);
    for (const c of toby.cards) for (const f of recordsOf(c)) expect(FRAGMENTS.some((x) => x.id === f)).toBe(true);
    const all = panels(toby);
    expect(all.length).toBeGreaterThanOrEqual(12);
    expect(all.length).toBeLessThanOrEqual(16);
    expect(all.map((p) => p.n)).toEqual(all.map((_, i) => i + 1));
    for (const page of toby.comic.pages) expect(page.panels).toHaveLength(page.layout === "pair" ? 2 : 1);
    // every panel says something, and its words are text, not part of the art
    for (const p of all) expect(p.lines.length).toBeGreaterThan(0);
    // and it ends where the approved story does: alive, fixing things, writing home
    const last = all.at(-1)!.lines.map((l) => l.text).join(" ");
    expect(last).toContain("alive");
    expect(last).toContain("Northfield");
  });

  it("has a finished picture on disk for every panel and card", () => {
    for (const p of panels(toby)) {
      expect(p.art?.interim).toBeFalsy();
      expect(existsSync(`.${p.art!.src}`)).toBe(true);
    }
    for (const c of toby.cards) for (const e of c.evidence) expect(existsSync(`.${e.art!}`)).toBe(true);
  });

  it("makes each card a found object, and shows every one of them somewhere in the comic", () => {
    const panelArt = new Set(panels(toby).flatMap((p) => (p.art ? [p.art.src] : [])));
    const inScenes = new Set(panels(toby).flatMap((p) => p.objects ?? []));
    for (const c of toby.cards) for (const e of c.evidence) {
      // its own picture, never a comic panel
      if (e.art) expect(panelArt.has(e.art)).toBe(false);
      expect(inScenes.has(e.record)).toBe(true);
    }
  });

  it("keeps the story open for someone who finished it before the letter was a card", () => {
    const six: FragmentId[] = ["cart-dogs", "bus-2", "chime-camp", "dev-toolbag", "chained-valve", "chalk-warning"];
    expect(isComplete(toby, six)).toBe(false);
    expect(canRead(toby, six, false)).toBe(false);
    expect(canRead(toby, six, true)).toBe(true);
    expect(canRead(toby, [...six, "toby-letter"], false)).toBe(true);
  });

  it("doesn't say whose story it is until the set is done, and shows only the evidence found", () => {
    expect(setTitle(toby, [], false)).toBe(toby.untitled);
    expect(setTitle(toby, ["bus-2"], false)).toBe(toby.theme);
    expect(setTitle(toby, ["bus-2"], false)).not.toContain("Toby");
    expect(setTitle(toby, ["cart-dogs", "bus-2", "chime-camp", "dev-toolbag", "chained-valve", "chalk-warning"], true)).toBe(toby.title);
    // a card with two records shows the one you found
    expect(shownEvidence(toby.cards[0], ["our-loop"])!.record).toBe("our-loop");
    expect(shownEvidence(toby.cards[1], ["locker-6"])!.record).toBe("locker-6");
  });

  it("turns pages with plain links, so it reads without JavaScript", () => {
    const n = toby.comic.pages.length;
    const first = String(comicPage(toby, 1));
    expect(first).toContain(`Page 1 of ${n}`);
    expect(first).toContain('rel="next" href="/collection/toby/comic?page=2"');
    expect(first).not.toContain('rel="prev"');
    const last = String(comicPage(toby, n));
    expect(last).toContain(`rel="prev" href="/collection/toby/comic?page=${n - 1}"`);
    expect(last).toContain("Read again");
    // the words are in the page as text
    for (const l of toby.comic.pages[0].panels[0].lines) expect(first).toContain(l.text.replace(/'/g, "&#39;"));
  });

  it("unlocks each card from its own records, in any order", () => {
    expect(toby.cards.filter((c) => isUnlocked(c, ["chalk-warning"])).map((c) => c.n)).toEqual([6]);
    expect(toby.cards.filter((c) => isUnlocked(c, ["our-loop", "chained-valve"])).map((c) => c.n)).toEqual([1, 5]);
    expect(unlockedCount(toby, ["cart-dogs", "our-loop"])).toBe(1);
    expect(isComplete(toby, ["cart-dogs", "bus-2", "chime-camp", "dev-toolbag", "chained-valve", "chalk-warning", "toby-letter"])).toBe(true);
    expect(isComplete(toby, ["cart-dogs", "bus-2", "chime-camp", "dev-toolbag", "chained-valve", "chalk-warning"])).toBe(false);
  });
});

const ruth = SETS.find((s) => s.id === "ruth")!;

describe("every set", () => {
  it("is made of records that exist, with each object shown somewhere in its comic", () => {
    for (const set of SETS) {
      const all = panels(set);
      expect(all.map((p) => p.n)).toEqual(all.map((_, i) => i + 1));
      for (const page of set.comic.pages) expect(page.panels).toHaveLength(page.layout === "pair" ? 2 : 1);
      const inScenes = new Set(all.flatMap((p) => p.objects ?? []));
      for (const c of set.cards) for (const e of c.evidence) {
        expect(FRAGMENTS.some((f) => f.id === e.record)).toBe(true);
        expect(inScenes.has(e.record)).toBe(true);
        if (e.art) expect(existsSync(`.${e.art}`)).toBe(true);
      }
      for (const p of all) if (p.art) expect(existsSync(`.${p.art.src}`)).toBe(true);
      expect(COLLECTION_XP[set.id]).toBeGreaterThan(0);
    }
  });

  it("can't be finished from other sets' records alone", () => {
    for (const set of SETS) {
      const others = new Set(SETS.filter((o) => o !== set).flatMap((o) => o.cards.flatMap(recordsOf)));
      const own = set.cards.flatMap(recordsOf).filter((r) => !others.has(r));
      expect(own.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("names its person only once it's complete", () => {
    for (const set of SETS) {
      expect(set.theme).not.toContain(set.title.split(" ")[0]);
      expect(set.untitled).not.toContain(set.title.split(" ")[0]);
    }
  });
});

describe("the Ruth set", () => {
  it("has seven cards and ends in the present, alive and not yet told about Toby", () => {
    expect(ruth.cards).toHaveLength(7);
    const last = panels(ruth).at(-1)!.lines.map((l) => l.text).join(" ");
    expect(last).toContain("sixty-six");
    expect(last).toContain("Toby");
  });

  it("shares the Bus 2 list with Toby's set, and only completes with its own records", () => {
    expect(isUnlocked(ruth.cards[2], ["bus-2"])).toBe(true);
    const shared: FragmentId[] = ["bus-2", "radio-log", "day-140"];
    expect(unlockedCount(ruth, shared)).toBe(3);
    expect(isComplete(ruth, [...shared, "ration-sign", "store-instruction", "cs4-board", "exchange-chit"])).toBe(true);
  });
});

// ---- on a throwaway database

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
const xpOf = () => db.prepare("SELECT level, xp FROM characters WHERE shelter_id = ?").get(shelterId()) as { level: number; xp: number };
const rewards = () => db.prepare("SELECT set_id, xp FROM collection_rewards WHERE shelter_id = ?").all(shelterId());
const rewardLogs = () => recentLog(db, shelterId(), 200).filter((e) => e.message.includes("every card"));

// One whole trip; at the Nest, slip past the beast so the trip can finish.
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

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "holdout-col-"));
  db = openDb(dir);
  userId = player();
  t = T0;
});

describe("collecting on a throwaway database", () => {
  it("fills cards for records found before collections existed, without paying anything yet", () => {
    const old = mkdtempSync(join(tmpdir(), "holdout-v7-"));
    const raw = new DatabaseSync(join(old, "game.db"));
    for (const m of MIGRATIONS.slice(0, 7)) raw.exec(m);
    raw.exec("PRAGMA user_version = 7");
    raw.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (1, 'old', 'x', ?)").run(T0);
    raw.prepare("INSERT INTO shelters (id, user_id, name, food, water, power, scrap, settled_at) VALUES (1, 1, 'old', 10, 10, 10, 10, ?)").run(T0);
    raw.prepare("INSERT INTO characters (shelter_id, hp_at) VALUES (1, ?)").run(T0);
    for (const f of ["ration-sign", "locker-6", "cart-dogs"]) raw.prepare("INSERT INTO discoveries (shelter_id, fragment_id, found_at) VALUES (1, ?, ?)").run(f, T0);
    raw.close();

    const migrated = openDb(old);
    loadShelter(migrated, 1, T0 + 1000);
    const found = foundIds(migrated, 1);
    expect(toby.cards.filter((c) => isUnlocked(c, found)).map((c) => c.n)).toEqual([1, 2]);
    expect(migrated.prepare("SELECT COUNT(*) AS n FROM collection_rewards").get()).toEqual({ n: 0 });
  });

  it("pays a set someone had already finished, once, on their next visit", () => {
    for (const f of ["our-loop", "bus-2", "chime-camp", "dev-toolbag", "chained-valve", "chalk-warning", "toby-letter"]) {
      db.prepare("INSERT INTO discoveries (shelter_id, fragment_id, found_at) VALUES (?, ?, ?)").run(shelterId(), f, T0);
    }
    const before = xpOf();
    for (let i = 0; i < 4; i++) loadShelter(db, userId, T0 + 1000 + i);
    expect(rewards()).toEqual([{ set_id: "toby", xp: COLLECTION_XP.toby }]);
    const expected = gainXp(before.level, before.xp, COLLECTION_XP.toby);
    expect(xpOf()).toEqual({ level: expected.level, xp: expected.xp });
    expect(rewardLogs()).toHaveLength(1);
  });

  it("doesn't pay again, or shut the story, for someone who finished six cards before the seventh existed", () => {
    for (const f of ["our-loop", "bus-2", "chime-camp", "dev-toolbag", "chained-valve", "chalk-warning"]) {
      db.prepare("INSERT INTO discoveries (shelter_id, fragment_id, found_at) VALUES (?, ?, ?)").run(shelterId(), f, T0);
    }
    db.prepare("INSERT INTO collection_rewards (shelter_id, set_id, xp, rewarded_at) VALUES (?, 'toby', ?, ?)").run(shelterId(), COLLECTION_XP.toby, T0);
    const before = xpOf();
    loadShelter(db, userId, T0 + 1000);
    expect(unlockedCount(toby, foundIds(db, shelterId()))).toBe(6);
    // the letter completes the seven without a second reward (the Bus 2 list
    // also points under the bench, so look around for it)
    expect(trip("workshop", "look")).toBe("toby-letter");
    expect(isComplete(toby, foundIds(db, shelterId()))).toBe(true);
    expect(rewards()).toHaveLength(1);
    // only the trip's own experience, nothing for the set
    const expected = gainXp(before.level, before.xp, XP.trip.workshop);
    expect(xpOf()).toEqual({ level: expected.level, xp: expected.xp });
    expect(rewardLogs()).toHaveLength(0);
  });

  it("finds Ruth's two new records where the design puts them, and pays her set once", () => {
    // the Supermarket's open records; the fax opens the basement
    for (let i = 0; i < 4; i++) trip("supermarket", "look");
    expect(trip("supermarket", "the-basement")).toBe("cs4-board");
    // the Workshop: Toby's letter first, then the chit
    expect(trip("workshop")).toBe("toby-letter");
    expect(trip("workshop")).toBe("exchange-chit");
    expect(trip("supermarket", "kerrys-locker")).toBe("locker-6");
    expect(trip("supermarket", "passenger-lists")).toBe("bus-2");
    expect(trip("reservoir", "look")).toBe("our-loop");
    expect(trip("reservoir", "look")).toBe("radio-log");
    expect(rewards()).toEqual([]);
    expect(trip("reservoir", "station-office")).toBe("day-140");
    expect(isComplete(ruth, foundIds(db, shelterId()))).toBe(true);
    expect(rewards()).toEqual([{ set_id: "ruth", xp: COLLECTION_XP.ruth }]);
    // settling again pays nothing more
    tx(db, () => settleCollections(db, shelterId(), foundIds(db, shelterId()), t));
    expect(rewards()).toHaveLength(1);
    expect(rewardLogs().filter((e) => e.message.includes("Ruth Lane"))).toHaveLength(1);
  });

  it("restores contact one step per trip: word to T, his answer, word north, Kerry's letters, his thanks", () => {
    // the letter and the chit come first, by looking around the Workshop
    expect(trip("workshop", "look")).toBe("toby-letter");
    expect(trip("workshop", "look")).toBe("exchange-chit");
    // each step opens the next; the default focus follows it
    expect(trip("workshop")).toBe("left-word");
    expect(trip("workshop")).toBe("toby-answer");
    expect(trip("workshop")).toBe("word-north");
    expect(trip("workshop")).toBe("ruth-parcel");
    expect(trip("supermarket", "bus-shelter-chalk")).toBe("toby-thanks");
    const found = foundIds(db, shelterId());
    // it settles nothing and pays nothing: no set is made of these
    expect(rewards()).toEqual([]);
    expect(found).toEqual(expect.arrayContaining(["left-word", "toby-answer", "word-north", "ruth-parcel", "toby-thanks"]));
  });

  it("can't skip a step of contact: the parcel needs the note north first", () => {
    trip("workshop", "look");
    trip("workshop", "look");
    // following a later lead you don't have yet counts as looking around
    expect(trip("workshop", "kell-reply")).not.toBe("ruth-parcel");
  });

  it("completes Mags's set at the Workshop and the bore house, and pays once", () => {
    // the Workshop's corners: Toby's letter, Ruth's chit, then the tag, the board, the docket
    for (const r of ["toby-letter", "exchange-chit", "tagged-door", "mags-dropboard", "ferris-docket"]) expect(trip("workshop", "look")).toBe(r);
    // the board points under the bench; the job book to the key board and the bore
    expect(trip("workshop", "under-the-bench")).toBe("mags-jobbook");
    expect(trip("workshop", "key-board")).toBe("patels-keys");
    expect(trip("reservoir", "bore-motor")).toBe("mags-bore-tag");
    expect(rewards()).toEqual([]);
    expect(trip("supermarket", "look")).toBe("ration-sign");
    trip("supermarket", "kerrys-locker");
    expect(trip("supermarket", "passenger-lists")).toBe("bus-2");
    const mags = SETS.find((x) => x.id === "mags")!;
    expect(isComplete(mags, foundIds(db, shelterId()))).toBe(true);
    expect(rewards()).toEqual([{ set_id: "mags", xp: COLLECTION_XP.mags }]);
    tx(db, () => settleCollections(db, shelterId(), foundIds(db, shelterId()), t));
    expect(rewards()).toHaveLength(1);
  });

  it("gives Dev's run sheet at the bore house, from the radio log or Mags's job book", () => {
    trip("reservoir", "look");
    expect(trip("reservoir", "look")).toBe("radio-log");
    expect(trip("reservoir", "bore-house")).toBe("pump-log");
    expect(trip("reservoir", "bore-motor")).toBe("mags-bore-tag");
  });

  it("gives the Northfield card first to someone who goes straight to the Nest, and keeps it", () => {
    expect(trip("nest")).toBe("chime-camp");
    expect(toby.cards.filter((c) => isUnlocked(c, foundIds(db, shelterId()))).map((c) => c.n)).toEqual([3]);
  });

  it("keeps a card after a defeat that takes the gear", () => {
    expect(depart(db, userId, "nest", t).ok).toBe(true);
    const j = journeyRow();
    loadShelter(db, userId, Number(j.arrive_at));
    db.prepare("UPDATE characters SET hp = 1 WHERE shelter_id = ?").run(shelterId());
    // a defeat: the beast bites harder than 1 HP
    expect(attack(db, userId, randomUUID(), 0, Number(j.encounter_at), { hit: 1, bite: 15 }).ok).toBe(true);
    loadShelter(db, userId, Number(journeyRow().return_at) + 1);
    expect(db.prepare("SELECT COUNT(*) AS n FROM items WHERE shelter_id = ?").get(shelterId())).toEqual({ n: 0 });
    expect(isUnlocked(toby.cards[2], foundIds(db, shelterId()))).toBe(true);
  });

  it("completes the set by playing, and pays the reward exactly once", () => {
    // the Supermarket's open records, then the Nest, the gallery, the valve, the locker
    for (let i = 0; i < 4; i++) trip("supermarket", "look");
    expect(trip("nest")).toBe("chime-camp");
    expect(trip("reservoir")).toBe("dev-toolbag");
    expect(trip("reservoir")).toBe("chained-valve");
    expect(trip("workshop")).toBe("toby-letter");
    expect(rewards()).toEqual([]);
    expect(depart(db, userId, "supermarket", t, "kerrys-locker").ok).toBe(true);
    const j = journeyRow();
    expect(j.fragment_id).toBe("locker-6");
    const before = xpOf();
    // the card lands on arrival; the reward with it
    loadShelter(db, userId, Number(j.arrive_at));
    expect(isComplete(toby, foundIds(db, shelterId()))).toBe(true);
    const expected = gainXp(before.level, before.xp, COLLECTION_XP.toby);
    expect(xpOf()).toEqual({ level: expected.level, xp: expected.xp });
    // reloading, finishing the trip and settling again pay nothing more
    for (let i = 0; i < 3; i++) loadShelter(db, userId, Number(j.arrive_at) + i);
    tx(db, () => settleCollections(db, shelterId(), foundIds(db, shelterId()), Number(j.arrive_at)));
    loadShelter(db, userId, Number(j.return_at) + 1);
    expect(rewards()).toHaveLength(1);
    expect(rewardLogs()).toHaveLength(1);
  });
});

// ---- the pages, over HTTP

const baseUrl = inject("baseUrl");
const url = (path: string) => new URL(path, baseUrl);
const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
async function register(name: string): Promise<string> {
  const res = await fetch(url("/register"), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: name, password: "correct horse battery" }),
  });
  expect(res.status).toBe(303);
  return res.headers.getSetCookie().find((c) => c.startsWith("sid="))!.split(";")[0];
}

describe("the Collection page", () => {
  it("shows only card backs to a new player and gives nothing away", async () => {
    const me = await register(`spec_c${tag}`);
    const res = await fetch(url("/collection"), { headers: { cookie: me } });
    expect(res.status).toBe(200);
    const page = new JSDOM(await res.text()).window.document;
    for (const set of SETS) {
      const section = page.querySelector(`[aria-labelledby="cl-${set.id}"]`)!;
      expect(section.querySelectorAll(".cl-card.is-back")).toHaveLength(set.cards.length);
      expect(section.textContent).toContain(`0 of ${set.cards.length} cards`);
    }
    expect(page.querySelectorAll(".cl-card.is-front")).toHaveLength(0);
    const text = page.querySelector("main")!.textContent!;
    for (const name of ["Toby", "Ruth", "Wren", "Lane", "Margit", "Halloran", "Mags"]) expect(text).not.toContain(name);
    for (const set of SETS) {
      expect(text).not.toContain(set.theme);
      for (const c of set.cards) for (const e of c.evidence) expect(text).not.toContain(e.title);
    }
    expect(page.querySelector('nav a[href="/collection"]')).not.toBeNull();
  });

  it("keeps the comic shut until the set is complete, and only for a set that exists", async () => {
    const me = await register(`spec_d${tag}`);
    const res = await fetch(url("/collection/toby/comic"), { headers: { cookie: me } });
    expect(res.status).toBe(403);
    const body = await res.text();
    for (const p of panels(toby)) for (const l of p.lines) expect(body).not.toContain(l.text);
    expect((await fetch(url("/collection/nobody/comic"), { headers: { cookie: me } })).status).toBe(404);
    expect((await fetch(url("/collection/ruth/comic"), { headers: { cookie: me } })).status).toBe(403);
    expect((await fetch(url("/collection"), { redirect: "manual" })).status).toBe(302);
  });
});
