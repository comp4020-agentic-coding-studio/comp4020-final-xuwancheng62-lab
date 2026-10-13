import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, inject, it } from "vitest";
import { JSDOM } from "jsdom";
import { openDb, tx } from "../src/db.ts";
import { createShelter, depart, loadShelter } from "../src/shelter.ts";
import { createParty, joinParty, partyRow } from "../src/parties.ts";
import { knownEnemies } from "../src/bestiary.ts";
import { DUNGEONS, FREIGHT_YARD, PUMP_STATION, ROAD_CHECKPOINT } from "../src/game/dungeons.ts";
import { runExpedition } from "../src/game/expedition.ts";
import { TIME_SCALE } from "../src/game/config.ts";
import { seeded } from "../src/game/rng.ts";
import { starter } from "../src/character.ts";
import { enemyFighter, fight, memberFighter, type PartyMember } from "../src/game/combat.ts";

const basic = (key: string): PartyMember => ({ key, name: key, who: "you", hp: 100, row: "front", body: { level: 1, strength: 5, agility: 5, constitution: 6 }, gear: { weapon: starter("crowbar") }, belt: {}, pack: {} });
it("keeps the freight yard demo accessible to fresh two-player parties", () => {
  for (let seed=0; seed<200; seed++) {
    const r=runExpedition({dungeon:FREIGHT_YARD,seed,members:[basic("a"),basic("b")],approach:"fight",retreat:"half",records:[],players:2});
    expect(r.outcome).toBe("cleared"); expect(r.loot.gear).toHaveLength(2);
    expect(r.loot.supplies.bandage).toBeGreaterThan(0); expect(r.events[0].at).toBe(0);
  }
});
it("lets human raiders shoot the back row and ignores animal-scaring flares", () => {
  let backHit = 0;
  for (let seed = 0; seed < 20; seed++) {
    const front = memberFighter({ ...basic("front"), gear: { weapon: starter("stick") }, belt: { flare: 1 } });
    const back = memberFighter({ ...basic("back"), row: "back", gear: { weapon: starter("spear") } });
    const raider = enemyFighter("raider", 0);
    expect(raider.animal).toBe(false);
    fight(seeded(seed), [front, back], [raider], { retreat: "never" });
    expect(front.belt.flare).toBe(1);
    if (back.hp < 100) backHit++;
  }
  expect(backHit).toBeGreaterThan(0);
});
it("does not reflect bullets with spiked armour", () => {
  const defender = memberFighter(basic("defender"));
  defender.damage = [0, 0];
  defender.traits.spiked = 100;
  expect(fight(seeded(42), [defender], [enemyFighter("raider", 0)], { retreat: "never" }).result).toBe("wiped");
});
it("unlocks a single enemy card at the actual encounter time, persists it and separates shelters", () => {
  const dir = mkdtempSync(join(tmpdir(), "holdout-fieldguide-")); let db = openDb(dir);
  const now = 1800000000000;
  const ids = tx(db, () => ["a", "b", "observer"].map(name => {
    const id = Number(db.prepare("INSERT INTO users(username,password_hash,created_at) VALUES (?, 'x', ?)").run(name, now).lastInsertRowid);
    createShelter(db, id, name, now); return id;
  }));
  const sids = ids.map(id => loadShelter(db, id, now).id);
  const made = createParty(db, ids[0], { dungeon: FREIGHT_YARD.id, size: "2", approach: "fight", retreat: "half" }, now);
  expect(made.ok).toBe(true); if (!made.ok) throw Error(made.reason);
  expect(joinParty(db, ids[1], made.partyId!, { who: "you", row: "front" }, now).ok).toBe(true);
  const p = partyRow(db, made.partyId!)!;
  const run = JSON.parse(p.result_json!) as ReturnType<typeof runExpedition>;
  const dogAt = now + run.sightings!.find(s => s.id === "feral-dog")!.at / TIME_SCALE;
  loadShelter(db, ids[0], now);
  expect(knownEnemies(db, sids[0])).toEqual(["rat"]);
  loadShelter(db, ids[0], dogAt - 1);
  expect(knownEnemies(db, sids[0])).toEqual(["rat"]);
  loadShelter(db, ids[0], dogAt);
  expect(knownEnemies(db, sids[0])).toEqual(["rat", "feral-dog"]);
  loadShelter(db, ids[0], p.ends_at! + 1);
  loadShelter(db, ids[0], p.ends_at! + 2);
  expect(knownEnemies(db, sids[0])).toHaveLength(2);
  expect(knownEnemies(db, sids[2])).toEqual([]);
  db.close(); db = openDb(dir);
  expect(knownEnemies(db, sids[0])).toHaveLength(2); db.close();
});
it("keeps a discovered enemy card after a party wipe without revealing later rooms", () => {
  const db = openDb(mkdtempSync(join(tmpdir(), "holdout-wipe-card-"))); const now = 1800000000000;
  const users = tx(db, () => ["wipe-a", "wipe-b"].map(name => {
    const id = Number(db.prepare("INSERT INTO users(username,password_hash,created_at) VALUES (?, 'x', ?)").run(name, now).lastInsertRowid);
    createShelter(db, id, name, now); return id;
  }));
  db.prepare("UPDATE characters SET level = 6, hp = 20, hp_at = ?").run(now);
  const made = createParty(db, users[0], { dungeon: "lower-deck", size: "2", approach: "fight", retreat: "never" }, now);
  if (!made.ok) throw Error(made.reason);
  expect(joinParty(db, users[1], made.partyId!, {}, now).ok).toBe(true);
  const party = partyRow(db, made.partyId!)!;
  const run = JSON.parse(party.result_json!) as ReturnType<typeof runExpedition>;
  expect(run.outcome).toBe("wiped");
  expect(run.sightings!.map(s => s.id)).toEqual(["rustshell"]);
  const home = loadShelter(db, users[0], party.ends_at! + 1);
  expect(home.journey).toBeNull();
  expect(knownEnemies(db, home.id)).toEqual(["rustshell"]);
  loadShelter(db, users[0], party.ends_at! + 2);
  expect(knownEnemies(db, home.id)).toEqual(["rustshell"]); db.close();
});
it("records the solo beast only once it is encountered", () => {
  const db = openDb(mkdtempSync(join(tmpdir(), "holdout-beast-card-"))); const now = 1800000000000;
  const user = tx(db, () => {
    const id = Number(db.prepare("INSERT INTO users(username,password_hash,created_at) VALUES ('solo','x',?)").run(now).lastInsertRowid);
    createShelter(db, id, "solo", now); return id;
  });
  expect(depart(db, user, "nest", now).ok).toBe(true);
  const s = loadShelter(db, user, now);
  expect(knownEnemies(db, s.id)).toEqual([]);
  loadShelter(db, user, s.journey!.times.encounterAt!);
  expect(knownEnemies(db, s.id)).toEqual(["scavenger"]); db.close();
});

const base = inject("baseUrl");
it("offers team entrances on Expeditions with a demo and locked higher dungeons, away from the map, and keeps locked cards anonymous", async () => {
  const name = `spec_early${Date.now().toString(36)}`;
  const res = await fetch(new URL("/register", base), { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ username: name, password: "correct horse battery" }) });
  expect(res.status).toBe(303); const cookie = res.headers.getSetCookie().find(c => c.startsWith("sid="))!.split(";")[0];
  const page = async (path: string) => new JSDOM(await (await fetch(new URL(path, base), { headers: { cookie } })).text()).window.document;
  const world = await page("/world"); const hub = await page("/expeditions");
  expect(world.querySelector(".wm-legend")!.textContent).not.toContain("Team expedition");
  expect(world.querySelectorAll(".wm-team-pin")).toHaveLength(0);
  for (const d of DUNGEONS) {
    expect(world.querySelector(".tm-map")).toBeNull();
    expect(hub.querySelector(`#entrance-${d.id} .dg-vortex`)).not.toBeNull();
    expect(hub.querySelector(`#entrance-${d.id}`)?.classList.contains("is-locked")).toBe(d.id !== "freight-yard");
    expect(hub.querySelector(`.dg-card[data-dungeon='${d.id}'] img`)).not.toBeNull();
    expect((await fetch(new URL(d.art!, base))).status).toBe(200);
  }
  const bestiary = await page("/collection/enemies");
  expect(bestiary.querySelectorAll(".be-card")).toHaveLength(8);
  expect(bestiary.querySelector("[data-enemy]")).toBeNull();
  expect(bestiary.body.textContent).not.toContain("Mudback crab");
  expect((await page("/collection")).querySelector("a[href='/collection/enemies']")).not.toBeNull();
});
