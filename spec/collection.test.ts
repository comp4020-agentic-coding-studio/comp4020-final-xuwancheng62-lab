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

  it("has a picture on disk for every panel and card that has art", () => {
    for (const p of panels(toby)) if (p.art) expect(existsSync(`.${p.art.src}`)).toBe(true);
    for (const c of toby.cards) for (const e of c.evidence) if (e.art) expect(existsSync(`.${e.art}`)).toBe(true);
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
    // the letter completes the seven without a second reward
    expect(trip("workshop")).toBe("toby-letter");
    expect(isComplete(toby, foundIds(db, shelterId()))).toBe(true);
    expect(rewards()).toHaveLength(1);
    // only the trip's own experience, nothing for the set
    const expected = gainXp(before.level, before.xp, XP.trip.workshop);
    expect(xpOf()).toEqual({ level: expected.level, xp: expected.xp });
    expect(rewardLogs()).toHaveLength(0);
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
    expect(depart(db, userId, "supermarket", t).ok).toBe(true);
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
  it("shows seven card backs to a new player and gives nothing away", async () => {
    const me = await register(`spec_c${tag}`);
    const res = await fetch(url("/collection"), { headers: { cookie: me } });
    expect(res.status).toBe(200);
    const page = new JSDOM(await res.text()).window.document;
    expect(page.querySelectorAll(".cl-card")).toHaveLength(7);
    expect(page.querySelectorAll(".cl-card.is-back")).toHaveLength(7);
    const text = page.querySelector("main")!.textContent!;
    expect(text).toContain("0 of 7 cards");
    expect(text).not.toContain("Toby");
    expect(text).not.toContain(toby.theme);
    for (const c of toby.cards) for (const e of c.evidence) expect(text).not.toContain(e.title);
    expect(page.querySelector('nav a[href="/collection"]')).not.toBeNull();
  });

  it("keeps the comic shut until the set is complete, and only for a set that exists", async () => {
    const me = await register(`spec_d${tag}`);
    const res = await fetch(url("/collection/toby/comic"), { headers: { cookie: me } });
    expect(res.status).toBe(403);
    const body = await res.text();
    for (const p of panels(toby)) for (const l of p.lines) expect(body).not.toContain(l.text);
    expect((await fetch(url("/collection/nobody/comic"), { headers: { cookie: me } })).status).toBe(404);
    expect((await fetch(url("/collection"), { redirect: "manual" })).status).toBe(302);
  });
});
