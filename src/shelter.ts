import type { DatabaseSync } from "node:sqlite";
import { RAID, STARTING_STOCK } from "./game/config.ts";
import { settle, type Stock } from "./game/resources.ts";
import { destination, journeyPhase, planJourney, rollOutcome, type JourneyTimes, type Outcome, type Phase } from "./game/world.ts";
import { tx } from "./db.ts";

interface ShelterRow extends Stock {
  id: number;
  user_id: number;
  name: string;
  settled_at: number;
  owner: string;
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
}

export interface ActiveJourney {
  id: number;
  raid: boolean;
  destinationName: string;
  phase: Exclude<Phase, "done">;
  label: string;
  until: number;
  times: JourneyTimes;
}

export interface ShelterView {
  id: number;
  userId: number;
  owner: string;
  name: string;
  stock: Stock;
  journey: ActiveJourney | null;
  combatPower: number;
  shieldUntil: number;
  reinforces: number;
}

export interface LogEntry {
  at: number;
  kind: string;
  message: string;
}

const PHASE_LABEL = { traveling: "Traveling", exploring: "Exploring", returning: "Returning" } as const;

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
    .prepare("INSERT INTO shelters (user_id, name, food, water, power, scrap, settled_at, combat_power) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(userId, `${username}'s shelter`, s.food, s.water, s.power, s.scrap, now, RAID.startingCombat);
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
    .prepare(`SELECT shelters.*, users.username AS owner FROM shelters JOIN users ON users.id = shelters.user_id WHERE shelters.${column} = ?`)
    .get(value) as unknown as ShelterRow | undefined;
  if (!row) return null;
  let stock = stockOf(row);
  let settledAt = row.settled_at;
  let combat = row.combat_power;
  let j = db
    .prepare("SELECT * FROM journeys WHERE shelter_id = ? AND resolved_at IS NULL")
    .get(row.id) as unknown as JourneyRow | undefined;

  if (j && journeyPhase(times(j), now).phase === "done") {
    ({ stock, settledAt } = settle(stock, settledAt, j.return_at));
    if (j.target_kind === "shelter") {
      db.prepare("UPDATE journeys SET resolved_at = ? WHERE id = ?").run(j.return_at, j.id);
      log(db, row.id, j.return_at, "info", `Back home from ${shelterName(db, j.target_id)}.`);
    } else {
      const d = destination(j.target_id);
      const outcome: Outcome = d ? rollOutcome(d, j.id) : { result: "empty", loot: {} };
      for (const [k, n] of Object.entries(outcome.loot)) stock[k as keyof Stock] += n;
      let message = describe(outcome, d?.name ?? "the wasteland");
      // surviving the nest is what makes you harder to rob, and better at robbing
      if (d?.id === "nest" && outcome.result !== "empty" && combat < RAID.maxCombat) {
        combat += 1;
        message += ` You come back tougher: combat ${combat}.`;
      }
      db.prepare("UPDATE journeys SET resolved_at = ?, outcome_json = ? WHERE id = ?").run(j.return_at, JSON.stringify(outcome), j.id);
      log(db, row.id, j.return_at, outcome.result === "clean" ? "loot" : "danger", message);
    }
    j = undefined;
  }

  ({ stock, settledAt } = settle(stock, settledAt, now));
  db.prepare("UPDATE shelters SET food = ?, water = ?, power = ?, scrap = ?, settled_at = ?, combat_power = ? WHERE id = ?").run(
    stock.food, stock.water, stock.power, stock.scrap, settledAt, combat, row.id,
  );

  let journey: ActiveJourney | null = null;
  if (j) {
    const t = times(j);
    const p = journeyPhase(t, now);
    const raid = j.target_kind === "shelter";
    const phase = p.phase as ActiveJourney["phase"];
    journey = {
      id: j.id,
      raid,
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
  return {
    id: row.id,
    userId: row.user_id,
    owner: row.owner,
    name: row.name,
    stock,
    journey,
    combatPower: combat,
    shieldUntil: row.raid_shield_until,
    reinforces,
  };
}

export type DepartResult = { ok: true; shelterId: number } | { ok: false; status: 400 | 409; reason: string };

export function depart(db: DatabaseSync, userId: number, destinationId: string, now: number): DepartResult {
  const d = destination(destinationId);
  if (!d) return { ok: false, status: 400, reason: "That place isn't on any map." };
  const t = planJourney(d, now);
  try {
    return tx(db, (): DepartResult => {
      const shelter = loadForUpdate(db, "user_id", userId, now)!;
      if (shelter.journey) return { ok: false, status: 409, reason: "You're already out there." };
      db.prepare(
        `INSERT INTO journeys (shelter_id, target_kind, target_id, action, departed_at, arrive_at, explore_until, return_at)
         VALUES (?, 'location', ?, 'scavenge', ?, ?, ?, ?)`,
      ).run(shelter.id, d.id, t.departedAt, t.arriveAt, t.exploreUntil, t.returnAt);
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
