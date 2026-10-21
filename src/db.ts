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
  // 8: story collections. Cards come from discoveries; only the one-time
  // reward for completing a set needs storing.
  `
  CREATE TABLE collection_rewards (
    shelter_id INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    set_id TEXT NOT NULL,
    xp INTEGER NOT NULL,
    rewarded_at INTEGER NOT NULL,
    PRIMARY KEY (shelter_id, set_id)
  );
  `,
  // 9: quests and the people who join a shelter. Most quest steps are
  // records already in discoveries; a mark is a step that isn't, and doubles
  // as the claim on a quest's one-time reward. The owner is "shelter:<id>",
  // leaving room for "party:<id>" when expeditions are shared.
  `
  CREATE TABLE quest_marks (
    owner TEXT NOT NULL,
    quest_id TEXT NOT NULL,
    mark TEXT NOT NULL,
    at INTEGER NOT NULL,
    PRIMARY KEY (owner, quest_id, mark)
  );
  CREATE TABLE residents (
    shelter_id INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    who TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (shelter_id, who)
  );
  `,
  // 10: everyone in a shelter is a character (PLAN.md, "Character, gear and
  // the beast"). Characters get their own id, so a shelter can have several;
  // gear belongs to a character; each character, not each shelter, has at
  // most one trip under way. The survivor you play is who = 'you'; your
  // combat moves here from the shelter. Toby's starting numbers are written
  // out because a migration is a snapshot (src/game/config.ts has the same).
  // shelters.combat_power and residents stay, unread.
  `
  CREATE TABLE characters_new (
    id INTEGER PRIMARY KEY,
    shelter_id INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    who TEXT NOT NULL,
    combat INTEGER NOT NULL,
    task TEXT NOT NULL DEFAULT 'guard' CHECK (task IN ('guard', 'work')),
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    unspent INTEGER NOT NULL DEFAULT 0 CHECK (unspent >= 0),
    strength INTEGER NOT NULL DEFAULT 5,
    agility INTEGER NOT NULL DEFAULT 5,
    max_hp INTEGER NOT NULL DEFAULT 100,
    hp REAL NOT NULL DEFAULT 100 CHECK (hp >= 0),
    hp_at INTEGER NOT NULL,
    meal_at INTEGER NOT NULL DEFAULT 0,
    UNIQUE (shelter_id, who)
  );
  INSERT INTO characters_new (shelter_id, who, combat, level, xp, unspent, strength, agility, max_hp, hp, hp_at, meal_at)
    SELECT c.shelter_id, 'you', s.combat_power, c.level, c.xp, c.unspent, c.strength, c.agility, c.max_hp, c.hp, c.hp_at, c.meal_at
    FROM characters c JOIN shelters s ON s.id = c.shelter_id;
  -- Toby was already re-packing the purifier, so he starts on work
  INSERT INTO characters_new (shelter_id, who, combat, task, strength, agility, max_hp, hp, hp_at)
    SELECT shelter_id, 'toby', 6, 'work', 4, 7, 80, 80, joined_at FROM residents WHERE who = 'toby';
  DROP TABLE characters;
  ALTER TABLE characters_new RENAME TO characters;

  CREATE TABLE items_new (
    id INTEGER PRIMARY KEY,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    equipped INTEGER NOT NULL DEFAULT 0 CHECK (equipped IN (0, 1)),
    created_at INTEGER NOT NULL,
    UNIQUE (character_id, kind)
  );
  INSERT INTO items_new (character_id, kind, equipped, created_at)
    SELECT c.id, i.kind, i.equipped, i.created_at FROM items i JOIN characters c ON c.shelter_id = i.shelter_id AND c.who = 'you';
  INSERT INTO items_new (character_id, kind, equipped, created_at) SELECT id, 'crowbar', 1, hp_at FROM characters WHERE who = 'toby';
  DROP TABLE items;
  ALTER TABLE items_new RENAME TO items;

  ALTER TABLE journeys ADD COLUMN character_id INTEGER REFERENCES characters(id);
  UPDATE journeys SET character_id = (SELECT id FROM characters c WHERE c.shelter_id = journeys.shelter_id AND c.who = 'you');
  DROP INDEX one_active_journey;
  CREATE UNIQUE INDEX one_trip_each ON journeys(character_id) WHERE resolved_at IS NULL;
  ALTER TABLE encounters ADD COLUMN character_id INTEGER REFERENCES characters(id);
  UPDATE encounters SET character_id = (SELECT character_id FROM journeys j WHERE j.id = encounters.journey_id);
  `,
  // 11: items (PLAN.md, "Items"). Everything a shelter owns is in its stash;
  // a person holds what they've equipped (weapon, armour, tool), their belt
  // and their pack. Equipment is one row per item, with a level, a quality,
  // rolled bonuses and traits; supplies (level 0) are stacks of a kind.
  // Duplicates are allowed now. Existing gear becomes level 1, Common.
  `
  CREATE TABLE items_new (
    id INTEGER PRIMARY KEY,
    shelter_id INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 0 CHECK (level >= 0),
    quality TEXT NOT NULL DEFAULT 'common' CHECK (quality IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    bonuses_json TEXT NOT NULL DEFAULT '{}',
    traits_json TEXT NOT NULL DEFAULT '[]',
    name TEXT,
    qty INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
    held_by INTEGER REFERENCES characters(id) ON DELETE SET NULL,
    slot TEXT CHECK (slot IN ('weapon', 'armour', 'tool', 'belt', 'pack')),
    created_at INTEGER NOT NULL,
    CHECK ((held_by IS NULL) = (slot IS NULL))
  );
  INSERT INTO items_new (shelter_id, kind, level, quality, qty, held_by, slot, created_at)
    SELECT c.shelter_id, i.kind, 1, 'common', 1,
      CASE WHEN i.equipped = 1 THEN c.id END,
      CASE WHEN i.equipped = 1 THEN CASE i.kind WHEN 'jacket' THEN 'armour' WHEN 'backpack' THEN 'tool' ELSE 'weapon' END END,
      i.created_at
    FROM items i JOIN characters c ON c.id = i.character_id;
  DROP TABLE items;
  ALTER TABLE items_new RENAME TO items;
  CREATE INDEX items_by_shelter ON items(shelter_id);
  CREATE UNIQUE INDEX one_per_slot ON items(held_by, slot) WHERE slot IN ('weapon', 'armour', 'tool');
  CREATE UNIQUE INDEX one_stack ON items(shelter_id, kind, IFNULL(held_by, 0), IFNULL(slot, '')) WHERE level = 0;
  -- a fight can use what's on the belt: smoke helps the escape, a flare costs
  -- the beast its next bite, and shots fired are counted for picking up after
  ALTER TABLE encounters ADD COLUMN ammo_used INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE encounters ADD COLUMN escape_bonus INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE encounters ADD COLUMN beast_skips INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE encounters ADD COLUMN first_hit INTEGER NOT NULL DEFAULT 1;
  CREATE TABLE encounter_turns_new (
    id INTEGER PRIMARY KEY,
    encounter_id INTEGER NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    n INTEGER NOT NULL,
    request_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('attack', 'escape', 'use')),
    item TEXT,
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
  INSERT INTO encounter_turns_new (id, encounter_id, n, request_id, action, hit_roll, bite_roll, escape_roll, player_hit, beast_bite, player_hp, beast_hp, outcome, at)
    SELECT id, encounter_id, n, request_id, action, hit_roll, bite_roll, escape_roll, player_hit, beast_bite, player_hp, beast_hp, outcome, at FROM encounter_turns;
  DROP TABLE encounter_turns;
  ALTER TABLE encounter_turns_new RENAME TO encounter_turns;
  `,
  // 12: parties (PLAN.md, "Expeditions, parties and items"). A party musters
  // seats, one character per player; a seat holds its character (one active
  // seat each) and the rations taken for it. When the party fills, the run
  // is decided from its seed, each seat's share is written, and each seat
  // becomes a journey (target_kind 'party'), which its own shelter settles.
  // Friends are one row per pair (a < b); dispatch is each player's say in
  // what friends may do with their designated character.
  `
  CREATE TABLE parties (
    id INTEGER PRIMARY KEY,
    dungeon TEXT NOT NULL,
    leader_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    size INTEGER NOT NULL CHECK (size BETWEEN 2 AND 4),
    approach TEXT NOT NULL CHECK (approach IN ('sneak', 'fight')),
    retreat TEXT NOT NULL CHECK (retreat IN ('anyone', 'half', 'never')),
    min_level INTEGER NOT NULL DEFAULT 1,
    state TEXT NOT NULL DEFAULT 'mustering' CHECK (state IN ('mustering', 'out', 'expired')),
    readiness TEXT,
    seed INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    departed_at INTEGER,
    ends_at INTEGER,
    result_json TEXT
  );
  CREATE TABLE party_seats (
    id INTEGER PRIMARY KEY,
    party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shelter_id INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    row TEXT NOT NULL CHECK (row IN ('front', 'back')),
    dispatched_by INTEGER REFERENCES users(id),
    food INTEGER NOT NULL DEFAULT 0,
    water INTEGER NOT NULL DEFAULT 0,
    -- 1 while mustering; the journey takes over once it leaves
    active INTEGER NOT NULL DEFAULT 1,
    share_json TEXT,
    joined_at INTEGER NOT NULL,
    UNIQUE (party_id, user_id)
  );
  CREATE UNIQUE INDEX one_seat_each ON party_seats(character_id) WHERE active = 1;
  CREATE INDEX seats_by_shelter ON party_seats(shelter_id);
  ALTER TABLE journeys ADD COLUMN party_id INTEGER REFERENCES parties(id);
  CREATE TABLE friends (
    a INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    b INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_by INTEGER NOT NULL,
    accepted_at INTEGER,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (a, b),
    CHECK (a < b)
  );
  CREATE TABLE dispatch (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    who TEXT NOT NULL DEFAULT 'you',
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    risk TEXT NOT NULL DEFAULT 'risky' CHECK (risk IN ('likely', 'risky', 'grim')),
    row TEXT NOT NULL DEFAULT 'front' CHECK (row IN ('front', 'back')),
    keep_food INTEGER NOT NULL DEFAULT 20,
    keep_water INTEGER NOT NULL DEFAULT 20
  );
  `,
  // 13: world chat (PLAN.md, "World chat"): one channel for everyone, kept
  // for a day. A line with a party_id is that party's recruit card.
  `
  CREATE TABLE world_chat (
    id INTEGER PRIMARY KEY,
    author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    at INTEGER NOT NULL,
    request_id TEXT NOT NULL,
    party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL,
    UNIQUE (author_id, request_id)
  );
  CREATE INDEX world_chat_by_time ON world_chat(at DESC);
  `,
  // 14: a Last-seal Legendary keeps its wearer up once a fight, alone too.
  `
  ALTER TABLE encounters ADD COLUMN seal_used INTEGER NOT NULL DEFAULT 0;
  `,
  // 15: Constitution (PLAN.md, "Character"). Max HP is now 60 + 5 per point of
  // Constitution + 2 per point of Strength, so each character gets the least
  // Constitution that keeps their max HP where it was or above it: a "+10 max
  // HP" point already spent becomes 2 Constitution, and trained Strength now
  // adds its own. Current HP is left alone, never raised. max_hp stays,
  // unread. An item's "+max HP" bonus becomes the same HP in Constitution.
  // The numbers are written out because a migration is a snapshot.
  `
  ALTER TABLE characters ADD COLUMN constitution INTEGER NOT NULL DEFAULT 6;
  UPDATE characters SET constitution = MAX(1, (max_hp - 60 - 2 * strength + 4) / 5);
  UPDATE items SET bonuses_json = json_remove(json_set(bonuses_json, '$.constitution', CAST(json_extract(bonuses_json, '$.maxHp') / 5 AS INTEGER)), '$.maxHp')
    WHERE json_extract(bonuses_json, '$.maxHp') IS NOT NULL;
  `,
  // 16: configurable expedition snapshots and private social conversations.
  `
  ALTER TABLE parties ADD COLUMN definition_json TEXT;
  UPDATE shelters SET
    food = food + COALESCE((SELECT SUM(s.food) FROM party_seats s JOIN parties p ON p.id = s.party_id WHERE s.shelter_id = shelters.id AND s.active = 1 AND p.state = 'mustering'), 0),
    water = water + COALESCE((SELECT SUM(s.water) FROM party_seats s JOIN parties p ON p.id = s.party_id WHERE s.shelter_id = shelters.id AND s.active = 1 AND p.state = 'mustering'), 0);
  UPDATE party_seats SET food = 0, water = 0 WHERE active = 1 AND party_id IN (SELECT id FROM parties WHERE state = 'mustering');
  CREATE TABLE party_invites (
    id INTEGER PRIMARY KEY,
    party_id INTEGER NOT NULL REFERENCES parties(id),
    sender_id INTEGER NOT NULL REFERENCES users(id),
    recipient_id INTEGER NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    deadline INTEGER NOT NULL,
    state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','accepted','declined','failed')),
    reason TEXT NOT NULL DEFAULT ''
  );
  CREATE UNIQUE INDEX one_pending_invite ON party_invites(recipient_id) WHERE state = 'pending';
  CREATE INDEX invites_due ON party_invites(state, deadline);
  CREATE TABLE social_messages (
    id INTEGER PRIMARY KEY,
    author_id INTEGER NOT NULL REFERENCES users(id),
    recipient_id INTEGER REFERENCES users(id),
    party_id INTEGER REFERENCES parties(id),
    body TEXT NOT NULL,
    at INTEGER NOT NULL,
    request_id TEXT NOT NULL,
    UNIQUE(author_id, request_id),
    CHECK ((recipient_id IS NULL) != (party_id IS NULL))
  );
  CREATE INDEX messages_private ON social_messages(recipient_id, author_id, id);
  CREATE INDEX messages_party ON social_messages(party_id, id);
  CREATE TABLE social_reads (
    user_id INTEGER NOT NULL REFERENCES users(id),
    channel TEXT NOT NULL,
    last_id INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(user_id, channel)
  );
  `,
  // 17: one permanent bestiary card per enemy, first encountered by a shelter.
  `CREATE TABLE enemy_discoveries (
    shelter_id INTEGER NOT NULL REFERENCES shelters(id),
    enemy_id TEXT NOT NULL,
    first_seen INTEGER NOT NULL,
    journey_id INTEGER NOT NULL REFERENCES journeys(id),
    PRIMARY KEY (shelter_id, enemy_id)
  );`,
  // 18: persistent facilities; legacy rooms start at their original output.
  `CREATE TABLE facilities (
    shelter_id INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    tier INTEGER NOT NULL CHECK(tier BETWEEN 0 AND 3),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
    progress REAL NOT NULL DEFAULT 0,
    PRIMARY KEY(shelter_id, kind)
  );
  ALTER TABLE shelters ADD COLUMN gate_hp REAL NOT NULL DEFAULT 80;
  ALTER TABLE shelters ADD COLUMN siege_at INTEGER NOT NULL DEFAULT 0;
  `,
  // 19: one actual visiting defender per shelter, locked by their journey.
  `CREATE TABLE reinforcements (
    target_shelter_id INTEGER PRIMARY KEY REFERENCES shelters(id),
    character_id INTEGER NOT NULL UNIQUE REFERENCES characters(id),
    journey_id INTEGER NOT NULL UNIQUE REFERENCES journeys(id),
    sent_at INTEGER NOT NULL
  );
  DELETE FROM buffs WHERE kind = 'reinforced';
  ALTER TABLE interactions ADD COLUMN report_json TEXT;
  `,
  // 20: wallet ledger, merchant receipts and escrowed bilateral offers.
  `CREATE TABLE wallets (
    shelter_id INTEGER PRIMARY KEY REFERENCES shelters(id),
    credits INTEGER NOT NULL CHECK(credits >= 0)
  );
  CREATE TABLE credit_ledger (
    id INTEGER PRIMARY KEY, shelter_id INTEGER NOT NULL REFERENCES shelters(id),
    delta INTEGER NOT NULL, reason TEXT NOT NULL, event_key TEXT NOT NULL,
    at INTEGER NOT NULL, UNIQUE(shelter_id,event_key)
  );
  CREATE TABLE commerce_receipts (
    user_id INTEGER NOT NULL REFERENCES users(id), request_id TEXT NOT NULL,
    message TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(user_id,request_id)
  );
  CREATE TABLE shop_purchases (
    shelter_id INTEGER NOT NULL REFERENCES shelters(id), day INTEGER NOT NULL,
    sku TEXT NOT NULL, qty INTEGER NOT NULL, PRIMARY KEY(shelter_id,day,sku)
  );
  CREATE TABLE trade_offers (
    id INTEGER PRIMARY KEY, sender INTEGER NOT NULL REFERENCES users(id),
    recipient INTEGER NOT NULL REFERENCES users(id),
    state TEXT NOT NULL CHECK(state IN ('open','accepted','declined','cancelled','expired','countered')),
    give_json TEXT NOT NULL, want_json TEXT NOT NULL, payment_json TEXT,
    created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
    parent_id INTEGER REFERENCES trade_offers(id)
  );
  CREATE INDEX trade_participants ON trade_offers(recipient,state);
  `,
  // 21: the Legendary a completed collection gave, so it's given once; null
  // on a claim made before the reward existed, until the next load grants it.
  `ALTER TABLE collection_rewards ADD COLUMN gear_item_id INTEGER;
  `,
  // 22: residents now join near the player's level; existing shelters are
  // caught up once, on their next load, and this marks that it's done.
  `ALTER TABLE shelters ADD COLUMN residents_levelled INTEGER NOT NULL DEFAULT 0;
  `,
  // 23: a completed set's Legendary waits to be accepted at the end of its
  // comic; its level is fixed when the set completes. Rows that already gave
  // one keep gear_item_id; a claim that never got one waits too, at the
  // player's level now.
  `ALTER TABLE collection_rewards ADD COLUMN gear_level INTEGER;
  UPDATE collection_rewards SET gear_level = (SELECT level FROM characters c WHERE c.shelter_id = collection_rewards.shelter_id AND c.who = 'you')
    WHERE gear_item_id IS NULL;
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
