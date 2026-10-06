import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const MIGRATIONS = [
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE shelters (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    food REAL NOT NULL,
    water REAL NOT NULL,
    power REAL NOT NULL,
    scrap REAL NOT NULL,
    settled_at INTEGER NOT NULL
  );
  CREATE TABLE journeys (
    id INTEGER PRIMARY KEY,
    shelter_id INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    target_kind TEXT NOT NULL,
    target_id TEXT NOT NULL,
    action TEXT NOT NULL,
    departed_at INTEGER NOT NULL,
    arrive_at INTEGER NOT NULL,
    explore_until INTEGER NOT NULL,
    return_at INTEGER NOT NULL,
    resolved_at INTEGER,
    outcome_json TEXT
  );
  CREATE UNIQUE INDEX one_active_journey ON journeys(shelter_id) WHERE resolved_at IS NULL;
  CREATE TABLE activity_log (
    id INTEGER PRIMARY KEY,
    shelter_id INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    at INTEGER NOT NULL,
    kind TEXT NOT NULL,
    message TEXT NOT NULL
  );
  CREATE INDEX activity_by_shelter ON activity_log(shelter_id, at DESC);
  `,
  `
  ALTER TABLE shelters ADD COLUMN combat_power INTEGER NOT NULL DEFAULT 10;
  ALTER TABLE shelters ADD COLUMN raid_shield_until INTEGER NOT NULL DEFAULT 0;
  CREATE TABLE interactions (
    id INTEGER PRIMARY KEY,
    request_id TEXT NOT NULL,
    actor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_shelter_id INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    target_shelter_id INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('steal', 'help')),
    resource TEXT,
    amount INTEGER NOT NULL DEFAULT 0,
    success INTEGER NOT NULL,
    chance REAL,
    roll INTEGER,
    target_home INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (actor_user_id, request_id)
  );
  CREATE INDEX interactions_by_pair ON interactions(actor_shelter_id, target_shelter_id, kind, created_at DESC);
  CREATE TABLE buffs (
    id INTEGER PRIMARY KEY,
    shelter_id INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX buffs_by_shelter ON buffs(shelter_id, expires_at);
  ALTER TABLE activity_log ADD COLUMN related_shelter_id INTEGER;
  ALTER TABLE activity_log ADD COLUMN interaction_id INTEGER;
  `,
];

export function openDb(dir = process.env.DATA_DIR ?? "/data"): DatabaseSync {
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(join(dir, "game.db"));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  const { user_version } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  for (let v = user_version; v < MIGRATIONS.length; v++) {
    db.exec("BEGIN");
    db.exec(MIGRATIONS[v]);
    db.exec(`PRAGMA user_version = ${v + 1}`);
    db.exec("COMMIT");
  }
  return db;
}

export function tx<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
