import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const MIGRATIONS = [
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
  `
  CREATE TABLE crop_plots (
    shelter_id INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    slot INTEGER NOT NULL CHECK (slot >= 0),
    crop TEXT NOT NULL,
    planted_at INTEGER NOT NULL,
    ready_at INTEGER NOT NULL,
    PRIMARY KEY (shelter_id, slot)
  );
  `,
  `
  CREATE TABLE talk (
    id INTEGER PRIMARY KEY,
    shelter_id INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    at INTEGER NOT NULL,
    request_id TEXT NOT NULL,
    UNIQUE (author_id, request_id)
  );
  CREATE INDEX talk_by_shelter ON talk(shelter_id, at DESC);
  CREATE INDEX talk_by_author ON talk(author_id, at DESC);
  `,
  // 5: the portrait each player picks; earlier players keep the one they were given
  `
  ALTER TABLE users ADD COLUMN portrait INTEGER NOT NULL DEFAULT 1;
  UPDATE users SET portrait = ((id - 1) % 6) + 1;
  `,
  // 6: the survivor, their gear, and the beast. Every existing shelter gets a
  // rested survivor with a crowbar; journeys already under way have no
  // encounter_at, so they finish the old way.
  `
  CREATE TABLE characters (
    shelter_id INTEGER PRIMARY KEY REFERENCES shelters(id) ON DELETE CASCADE,
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    unspent INTEGER NOT NULL DEFAULT 0 CHECK (unspent >= 0),
    strength INTEGER NOT NULL DEFAULT 5,
    agility INTEGER NOT NULL DEFAULT 5,
    max_hp INTEGER NOT NULL DEFAULT 100,
    hp REAL NOT NULL DEFAULT 100 CHECK (hp >= 0),
    hp_at INTEGER NOT NULL,
    meal_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE items (
    id INTEGER PRIMARY KEY,
    shelter_id INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    equipped INTEGER NOT NULL DEFAULT 0 CHECK (equipped IN (0, 1)),
    created_at INTEGER NOT NULL,
    UNIQUE (shelter_id, kind)
  );
  ALTER TABLE journeys ADD COLUMN encounter_at INTEGER;
  CREATE TABLE encounters (
    id INTEGER PRIMARY KEY,
    journey_id INTEGER NOT NULL UNIQUE REFERENCES journeys(id) ON DELETE CASCADE,
    shelter_id INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    state TEXT NOT NULL DEFAULT 'awaiting' CHECK (state IN ('awaiting', 'combat', 'won', 'escaped', 'defeated')),
    beast_hp INTEGER NOT NULL,
    escape_used INTEGER NOT NULL DEFAULT 0 CHECK (escape_used IN (0, 1)),
    escape_roll INTEGER,
    turns INTEGER NOT NULL DEFAULT 0,
    carried_json TEXT NOT NULL,
    announced INTEGER NOT NULL DEFAULT 0,
    resolved_at INTEGER
  );
  CREATE TABLE encounter_turns (
    id INTEGER PRIMARY KEY,
    encounter_id INTEGER NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    n INTEGER NOT NULL,
    request_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('attack', 'escape')),
    hit_roll INTEGER,
    bite_roll INTEGER,
    escape_roll INTEGER,
    player_hit INTEGER NOT NULL DEFAULT 0,
    beast_bite INTEGER NOT NULL DEFAULT 0,
    player_hp INTEGER NOT NULL,
    beast_hp INTEGER NOT NULL,
    outcome TEXT NOT NULL,
    at INTEGER NOT NULL,
    UNIQUE (encounter_id, n),
    UNIQUE (encounter_id, request_id)
  );
  INSERT INTO characters (shelter_id, hp_at) SELECT id, CAST(strftime('%s', 'now') AS INTEGER) * 1000 FROM shelters;
  INSERT INTO items (shelter_id, kind, equipped, created_at) SELECT id, 'crowbar', 1, CAST(strftime('%s', 'now') AS INTEGER) * 1000 FROM shelters;
  `,
  // 7: records found in the wasteland. A trip's record is picked when it
  // leaves; journeys already under way have none.
  `
  ALTER TABLE journeys ADD COLUMN fragment_id TEXT;
  ALTER TABLE journeys ADD COLUMN focus TEXT;
  CREATE TABLE discoveries (
    id INTEGER PRIMARY KEY,
    shelter_id INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    fragment_id TEXT NOT NULL,
    journey_id INTEGER REFERENCES journeys(id) ON DELETE SET NULL,
    found_at INTEGER NOT NULL,
    UNIQUE (shelter_id, fragment_id)
  );
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
