import type { DatabaseSync } from "node:sqlite";
import { CHARACTER, GEAR, GREENHOUSE, RAID, SALVAGE, STARTING_STOCK, XP, type Crop } from "./game/config.ts";
import { carry, type Haul } from "./game/character.ts";
import { settle, type GrowingPlot, type Stock } from "./game/resources.ts";
import { destination, journeyPhase, planJourney, rollFound, rollOutcome, type JourneyTimes, type Outcome, type Phase } from "./game/world.ts";
import { awardXp, capacityOf, createCharacter, firstMissing, grantItem, levelNote, ownsWeapon, settleCharacter, type Character } from "./character.ts";
import { encounterRow, encounterView, isOpen, type EncounterView } from "./encounter.ts";
import { BEAST } from "./game/config.ts";
import { tx } from "./db.ts";

interface ShelterRow extends Stock {
  id: number;
  user_id: number;
  name: string;
  settled_at: number;
  owner: string;
  portrait: number;
  combat_power: number;
  raid_shield_until: number;
}

interface JourneyRow {
  id: number;
  target_kind: string;
  target_id: string;
  action: string;
  departed_at: number;
  arrive_at: number;
  explore_until: number;
  return_at: number;
  encounter_at: number | null;
}

export interface ActiveJourney {
  id: number;
  raid: boolean;
  targetId: string;
  destinationName: string;
  phase: Exclude<Phase, "done">;
  label: string;
  until: number;
  times: JourneyTimes;
  // the beast, on a trip to the Nest: met at times.encounterAt
  encounter: EncounterView | null;
}

export interface Plot {
  slot: number;
  crop: Crop | null;
  plantedAt: number;
  readyAt: number;
  ready: boolean;
}

export interface ShelterView {
  id: number;
  userId: number;
  owner: string;
  portrait: number;
  name: string;
  stock: Stock;
  journey: ActiveJourney | null;
  combatPower: number;
  shieldUntil: number;
  reinforces: number;
  plots: Plot[];
  growing: number;
  character: Character;
}

export interface LogEntry {
  at: number;
  kind: string;
  message: string;
}

const PHASE_LABEL = { traveling: "Traveling", exploring: "Exploring", encounter: "In a fight", returning: "Returning" } as const;

const times = (j: JourneyRow): JourneyTimes => ({
  departedAt: j.departed_at,
  arriveAt: j.arrive_at,
  exploreUntil: j.explore_until,
  returnAt: j.return_at,
  encounterAt: j.encounter_at,
});

const stockOf = (r: ShelterRow): Stock => ({ food: r.food, water: r.water, power: r.power, scrap: r.scrap });

export function createShelter(db: DatabaseSync, userId: number, username: string, now: number): void {
  const s = STARTING_STOCK;
  const { lastInsertRowid } = db
    .prepare("INSERT INTO shelters (user_id, name, food, water, power, scrap, settled_at, combat_power) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(userId, `${username}'s shelter`, s.food, s.water, s.power, s.scrap, now, RAID.startingCombat);
  createCharacter(db, Number(lastInsertRowid), now);
  log(db, Number(lastInsertRowid), now, "info", "You seal the hatch behind you. This is home now.");
}

export function log(
  db: DatabaseSync,
  shelterId: number,
  at: number,
  kind: string,
  message: string,
  related: { shelterId?: number; interactionId?: number } = {},
): LogEntry {
  db.prepare("INSERT INTO activity_log (shelter_id, at, kind, message, related_shelter_id, interaction_id) VALUES (?, ?, ?, ?, ?, ?)").run(
    shelterId, at, kind, message, related.shelterId ?? null, related.interactionId ?? null,
  );
  return { at, kind, message };
}

function describe(o: Outcome, place: string): string {
  const got = Object.entries(o.loot).map(([k, n]) => `+${n} ${k[0].toUpperCase()}${k.slice(1)}`);
  if (o.result === "empty") return `Returned from ${place} empty-handed. Something drove you off.`;
  const haul = got.length ? got.join(", ") : "nothing worth carrying";
  return o.result === "hurt"
    ? `Returned from ${place} bruised, dropping half the haul: ${haul}.`
    : `Returned from ${place}: ${haul}.`;
}

const shelterName = (db: DatabaseSync, id: string): string =>
  (db.prepare("SELECT name FROM shelters WHERE id = ?").get(Number(id)) as { name: string } | undefined)?.name ?? "another shelter";

export function loadShelter(db: DatabaseSync, userId: number, now: number): ShelterView {
  return tx(db, () => loadForUpdate(db, "user_id", userId, now)!);
}

export function loadShelterById(db: DatabaseSync, shelterId: number, now: number): ShelterView | null {
  return tx(db, () => loadForUpdate(db, "id", shelterId, now));
}

// Other players' shelters, newest first. Accounts made by the spec run against
// the live app are left out so they don't crowd real players.
export function listSurvivors(db: DatabaseSync, exceptUserId: number, now: number, limit = 12): ShelterView[] {
  const rows = db
    .prepare(
      `SELECT shelters.id FROM shelters JOIN users ON users.id = shelters.user_id
       WHERE users.id != ? AND users.username NOT LIKE 'spec\\_%' ESCAPE '\\'
       ORDER BY users.created_at DESC LIMIT ?`,
    )
    .all(exceptUserId, limit) as { id: number }[];
  return rows.map((r) => loadShelterById(db, r.id, now)!);
}

// Brings a shelter up to `now` — resolves a finished journey at its return
// time, then settles resources — and writes the result back. Must run inside
// a transaction; callers that change two shelters at once use it directly.
export function loadForUpdate(db: DatabaseSync, column: "user_id" | "id", value: number, now: number): ShelterView | null {
  const row = db
    .prepare(`SELECT shelters.*, users.username AS owner, users.portrait FROM shelters JOIN users ON users.id = shelters.user_id WHERE shelters.${column} = ?`)
    .get(value) as unknown as ShelterRow | undefined;
  if (!row) return null;
  let stock = stockOf(row);
  let settledAt = row.settled_at;
  let combat = row.combat_power;
  const planted = db
    .prepare("SELECT slot, crop, planted_at, ready_at FROM crop_plots WHERE shelter_id = ?")
    .all(row.id) as { slot: number; crop: Crop; planted_at: number; ready_at: number }[];
  const growing: GrowingPlot[] = planted.map((p) => ({ plantedAt: p.planted_at, readyAt: p.ready_at }));
  let j = db
    .prepare("SELECT * FROM journeys WHERE shelter_id = ? AND resolved_at IS NULL")
    .get(row.id) as unknown as JourneyRow | undefined;

  // the beast, if this trip has one: announced once, when it appears
  let enc = j && j.encounter_at != null ? encounterRow(db, j.id) : undefined;
  const open = Boolean(enc && isOpen(enc.state));
  if (j && enc && open && !enc.announced && now >= j.encounter_at!) {
    log(db, row.id, j.encounter_at!, "danger", `A ${BEAST.name.toLowerCase()} rose out of the junk at the ${destination(j.target_id)?.name ?? "nest"}, guarding its hoard. Fight it, or try to slip away.`);
    db.prepare("UPDATE encounters SET announced = 1 WHERE id = ?").run(enc.id);
    enc = { ...enc, announced: 1 };
  }

  if (j && journeyPhase(times(j), now, open).phase === "done") {
    ({ stock, settledAt } = settle(stock, settledAt, j.return_at, growing));
    // recovery starts the moment you're back
    db.prepare("UPDATE characters SET hp_at = MAX(hp_at, ?) WHERE shelter_id = ?").run(j.return_at, row.id);
    if (j.target_kind === "shelter") {
      db.prepare("UPDATE journeys SET resolved_at = ? WHERE id = ?").run(j.return_at, j.id);
      log(db, row.id, j.return_at, "info", `Back home from ${shelterName(db, j.target_id)}.`);
    } else if (enc) {
      // the fight already settled what's carried; it's deposited only now
      const d = destination(j.target_id);
      const carried: Haul = JSON.parse(enc.carried_json);
      for (const [k, n] of Object.entries(carried)) stock[k as keyof Stock] += n ?? 0;
      const got = Object.entries(carried).map(([k, n]) => `+${n} ${k[0].toUpperCase()}${k.slice(1)}`);
      let message: string;
      if (enc.state === "defeated") message = `Limped home from the ${d?.name ?? "wasteland"} with nothing. Rest up before you go out again.`;
      else {
        const xp = awardXp(db, row.id, XP.trip[j.target_id] ?? 0);
        message = `Back from the ${d?.name ?? "wasteland"}: ${got.length ? got.join(", ") : "nothing worth carrying"}. +${XP.trip[j.target_id] ?? 0} XP.${levelNote(xp)}`;
      }
      db.prepare("UPDATE journeys SET resolved_at = ?, outcome_json = ? WHERE id = ?").run(j.return_at, JSON.stringify({ result: enc.state, loot: carried }), j.id);
      log(db, row.id, j.return_at, enc.state === "defeated" ? "danger" : "loot", message);
    } else {
      const d = destination(j.target_id);
      const rolled: Outcome = d ? rollOutcome(d, j.id) : { result: "empty", loot: {} };
      // a trip brings home only what you can carry
      const { carried, left } = carry(rolled.loot, capacityOf(db, row.id));
      const outcome: Outcome = { result: rolled.result, loot: carried };
      for (const [k, n] of Object.entries(outcome.loot)) stock[k as keyof Stock] += n;
      let message = describe(outcome, d?.name ?? "the wasteland");
      if (left > 0) message += ` You had to leave ${left} behind: your pack was full.`;
      // surviving the nest is what makes you harder to rob, and better at robbing
      if (d?.id === "nest" && outcome.result !== "empty" && combat < RAID.maxCombat) {
        combat += 1;
        message += ` You come back tougher: combat ${combat}.`;
      }
      // the Workshop is the safe way back to basic gear
      if (d?.id === "workshop" && outcome.result !== "empty") {
        const find = !ownsWeapon(db, row.id) ? "crowbar" : firstMissing(db, row.id, SALVAGE.filter((k) => k !== "crowbar"));
        if (find && grantItem(db, row.id, find, j.return_at)) message += ` You salvaged a ${GEAR[find].name.toLowerCase()}; it's in storage.`;
      }
      if (d) {
        const xp = awardXp(db, row.id, XP.trip[d.id] ?? 0);
        message += ` +${XP.trip[d.id] ?? 0} XP.${levelNote(xp)}`;
      }
      db.prepare("UPDATE journeys SET resolved_at = ?, outcome_json = ? WHERE id = ?").run(j.return_at, JSON.stringify(outcome), j.id);
      log(db, row.id, j.return_at, outcome.result === "clean" ? "loot" : "danger", message);
    }
    j = undefined;
    enc = undefined;
  }

  ({ stock, settledAt } = settle(stock, settledAt, now, growing));
  db.prepare("UPDATE shelters SET food = ?, water = ?, power = ?, scrap = ?, settled_at = ?, combat_power = ? WHERE id = ?").run(
    stock.food, stock.water, stock.power, stock.scrap, settledAt, combat, row.id,
  );

  let journey: ActiveJourney | null = null;
  if (j) {
    const t = times(j);
    const p = journeyPhase(t, now, open);
    const raid = j.target_kind === "shelter";
    const phase = p.phase as ActiveJourney["phase"];
    journey = {
      id: j.id,
      raid,
      targetId: j.target_id,
      encounter: enc ? encounterView(db, enc) : null,
      destinationName: raid ? shelterName(db, j.target_id) : (destination(j.target_id)?.name ?? j.target_id),
      phase,
      label: raid ? "Raiding" : PHASE_LABEL[phase],
      until: p.until,
      times: t,
    };
  }
  const { n: reinforces } = db
    .prepare("SELECT COUNT(*) AS n FROM buffs WHERE shelter_id = ? AND kind = 'reinforced' AND expires_at > ?")
    .get(row.id, now) as { n: number };
  const character = settleCharacter(db, row.id, !journey, now);
  return {
    character,
    id: row.id,
    userId: row.user_id,
    owner: row.owner,
    portrait: row.portrait,
    name: row.name,
    stock,
    journey,
    combatPower: combat,
    shieldUntil: row.raid_shield_until,
    reinforces,
    growing: growing.filter((g) => g.plantedAt <= now && now < g.readyAt).length,
    plots: Array.from({ length: GREENHOUSE.plots }, (_, slot) => {
      const p = planted.find((x) => x.slot === slot);
      return p
        ? { slot, crop: p.crop, plantedAt: p.planted_at, readyAt: p.ready_at, ready: now >= p.ready_at }
        : { slot, crop: null, plantedAt: 0, readyAt: 0, ready: false };
    }),
  };
}

export type DepartResult = { ok: true; shelterId: number } | { ok: false; status: 400 | 409; reason: string };

export function depart(db: DatabaseSync, userId: number, destinationId: string, now: number): DepartResult {
  const d = destination(destinationId);
  if (!d) return { ok: false, status: 400, reason: "That place isn't on any map." };
  try {
    return tx(db, (): DepartResult => {
      const shelter = loadForUpdate(db, "user_id", userId, now)!;
      if (shelter.journey) return { ok: false, status: 409, reason: "You're already out there." };
      const c = shelter.character;
      if (c.hp < CHARACTER.travelMinHp) {
        return { ok: false, status: 409, reason: `You're too hurt to travel (${c.hp} HP). Rest at the shelter until you have ${CHARACTER.travelMinHp}.` };
      }
      // every timestamp is fixed now, from the Agility you leave with
      const t = planJourney(d, now, c.agility);
      const { lastInsertRowid } = db.prepare(
        `INSERT INTO journeys (shelter_id, target_kind, target_id, action, departed_at, arrive_at, explore_until, return_at, encounter_at)
         VALUES (?, 'location', ?, 'scavenge', ?, ?, ?, ?, ?)`,
      ).run(shelter.id, d.id, t.departedAt, t.arriveAt, t.exploreUntil, t.returnAt, t.encounterAt ?? null);
      if (d.beast) {
        // what you'll have found by the time the beast appears, as much as you can carry
        const found = carry(rollFound(d, Number(lastInsertRowid)), c.capacity).carried;
        db.prepare("INSERT INTO encounters (journey_id, shelter_id, beast_hp, carried_json) VALUES (?, ?, ?, ?)").run(Number(lastInsertRowid), shelter.id, BEAST.hp, JSON.stringify(found));
      }
      log(db, shelter.id, now, "depart", `You left the shelter for the ${d.name}. Nobody is home to guard it.`);
      return { ok: true, shelterId: shelter.id };
    });
  } catch {
    // the partial unique index caught a second concurrent departure
    return { ok: false, status: 409, reason: "You're already out there." };
  }
}

export function recentLog(db: DatabaseSync, shelterId: number, limit = 30): LogEntry[] {
  return db
    .prepare("SELECT at, kind, message FROM activity_log WHERE shelter_id = ? ORDER BY at DESC, id DESC LIMIT ?")
    .all(shelterId, limit) as unknown as LogEntry[];
}
