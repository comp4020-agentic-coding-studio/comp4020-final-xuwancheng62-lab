import type { DatabaseSync } from "node:sqlite";
import { STARTING_STOCK } from "./game/config.ts";
import { settle, type Stock } from "./game/resources.ts";
import { destination, journeyPhase, planJourney, rollOutcome, type JourneyTimes, type Outcome, type Phase } from "./game/world.ts";
import { tx } from "./db.ts";

interface ShelterRow extends Stock {
  id: number;
  user_id: number;
  name: string;
  settled_at: number;
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
}

export interface ActiveJourney {
  id: number;
  destinationName: string;
  phase: Exclude<Phase, "done">;
  until: number;
  times: JourneyTimes;
}

export interface ShelterView {
  id: number;
  name: string;
  stock: Stock;
  journey: ActiveJourney | null;
}

export interface LogEntry {
  at: number;
  kind: string;
  message: string;
}

const times = (j: JourneyRow): JourneyTimes => ({
  departedAt: j.departed_at,
  arriveAt: j.arrive_at,
  exploreUntil: j.explore_until,
  returnAt: j.return_at,
});

const stockOf = (r: ShelterRow): Stock => ({ food: r.food, water: r.water, power: r.power, scrap: r.scrap });

export function createShelter(db: DatabaseSync, userId: number, username: string, now: number): void {
  const s = STARTING_STOCK;
  const { lastInsertRowid } = db
    .prepare("INSERT INTO shelters (user_id, name, food, water, power, scrap, settled_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(userId, `${username}'s shelter`, s.food, s.water, s.power, s.scrap, now);
  log(db, Number(lastInsertRowid), now, "info", "You seal the hatch behind you. This is home now.");
}

export function log(db: DatabaseSync, shelterId: number, at: number, kind: string, message: string): void {
  db.prepare("INSERT INTO activity_log (shelter_id, at, kind, message) VALUES (?, ?, ?, ?)").run(shelterId, at, kind, message);
}

function describe(o: Outcome, place: string): string {
  const got = Object.entries(o.loot).map(([k, n]) => `+${n} ${k[0].toUpperCase()}${k.slice(1)}`);
  if (o.result === "empty") return `Returned from ${place} empty-handed. Something drove you off.`;
  const haul = got.length ? got.join(", ") : "nothing worth carrying";
  return o.result === "hurt"
    ? `Returned from ${place} bruised, dropping half the haul: ${haul}.`
    : `Returned from ${place}: ${haul}.`;
}

// Brings the shelter up to `now`: resolves a finished journey (at its return
// time), then settles resources, and writes the result back.
export function loadShelter(db: DatabaseSync, userId: number, now: number): ShelterView {
  return tx(db, () => {
    const row = db.prepare("SELECT * FROM shelters WHERE user_id = ?").get(userId) as unknown as ShelterRow;
    let stock = stockOf(row);
    let settledAt = row.settled_at;
    let j = db
      .prepare("SELECT * FROM journeys WHERE shelter_id = ? AND resolved_at IS NULL")
      .get(row.id) as unknown as JourneyRow | undefined;

    if (j && journeyPhase(times(j), now).phase === "done") {
      ({ stock, settledAt } = settle(stock, settledAt, j.return_at));
      const d = destination(j.target_id);
      const outcome: Outcome = d ? rollOutcome(d, j.id) : { result: "empty", loot: {} };
      for (const [k, n] of Object.entries(outcome.loot)) stock[k as keyof Stock] += n;
      db.prepare("UPDATE journeys SET resolved_at = ?, outcome_json = ? WHERE id = ?").run(j.return_at, JSON.stringify(outcome), j.id);
      log(db, row.id, j.return_at, outcome.result === "clean" ? "loot" : "danger", describe(outcome, d?.name ?? "the wasteland"));
      j = undefined;
    }

    ({ stock, settledAt } = settle(stock, settledAt, now));
    db.prepare("UPDATE shelters SET food = ?, water = ?, power = ?, scrap = ?, settled_at = ? WHERE id = ?").run(
      stock.food, stock.water, stock.power, stock.scrap, settledAt, row.id,
    );

    let journey: ActiveJourney | null = null;
    if (j) {
      const t = times(j);
      const p = journeyPhase(t, now);
      journey = {
        id: j.id,
        destinationName: destination(j.target_id)?.name ?? j.target_id,
        phase: p.phase as ActiveJourney["phase"],
        until: p.until,
        times: t,
      };
    }
    return { id: row.id, name: row.name, stock, journey };
  });
}

export type DepartResult = { ok: true } | { ok: false; status: 400 | 409; reason: string };

export function depart(db: DatabaseSync, userId: number, destinationId: string, now: number): DepartResult {
  const d = destination(destinationId);
  if (!d) return { ok: false, status: 400, reason: "That place isn't on any map." };
  const shelter = loadShelter(db, userId, now);
  if (shelter.journey) return { ok: false, status: 409, reason: "You're already out there." };
  const t = planJourney(d, now);
  try {
    tx(db, () => {
      db.prepare(
        `INSERT INTO journeys (shelter_id, target_kind, target_id, action, departed_at, arrive_at, explore_until, return_at)
         VALUES (?, 'location', ?, 'scavenge', ?, ?, ?, ?)`,
      ).run(shelter.id, d.id, t.departedAt, t.arriveAt, t.exploreUntil, t.returnAt);
      log(db, shelter.id, now, "depart", `You left the shelter for the ${d.name}. Nobody is home to guard it.`);
    });
  } catch {
    // the partial unique index caught a second concurrent departure
    return { ok: false, status: 409, reason: "You're already out there." };
  }
  return { ok: true };
}

export function recentLog(db: DatabaseSync, shelterId: number, limit = 30): LogEntry[] {
  return db
    .prepare("SELECT at, kind, message FROM activity_log WHERE shelter_id = ? ORDER BY at DESC, id DESC LIMIT ?")
    .all(shelterId, limit) as unknown as LogEntry[];
}
