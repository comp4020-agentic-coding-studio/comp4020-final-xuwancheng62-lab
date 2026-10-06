import type { DatabaseSync } from "node:sqlite";
import { CHARACTER, GEAR, ITEM_KINDS, RECOVERY, SLOTS, type ItemKind, type Slot } from "./game/config.ts";
import { capacity, damageRange, armour, gainXp, rested, xpToNext, type Equipped } from "./game/character.ts";
import { tx } from "./db.ts";
import { loadForUpdate, log } from "./shelter.ts";

// The survivor and their gear, in the database. The rules are in
// src/game/character.ts; PLAN.md "Character, gear and the beast" has the why.

export interface Character {
  level: number;
  xp: number;
  toNext: number;
  unspent: number;
  strength: number;
  agility: number;
  maxHp: number;
  hp: number; // whole HP, as shown and as fought with
  mealAt: number;
  gear: Equipped;
  stored: ItemKind[];
  damage: [number, number];
  armour: number;
  capacity: number;
}

interface CharacterRow {
  level: number;
  xp: number;
  unspent: number;
  strength: number;
  agility: number;
  max_hp: number;
  hp: number;
  hp_at: number;
  meal_at: number;
}

export function createCharacter(db: DatabaseSync, shelterId: number, now: number): void {
  db.prepare("INSERT OR IGNORE INTO characters (shelter_id, hp_at, strength, agility, max_hp, hp) VALUES (?, ?, ?, ?, ?, ?)").run(
    shelterId, now, CHARACTER.strength, CHARACTER.agility, CHARACTER.maxHp, CHARACTER.maxHp,
  );
  grantItem(db, shelterId, "crowbar", now, true);
}

export function gearOf(db: DatabaseSync, shelterId: number): { gear: Equipped; stored: ItemKind[] } {
  const rows = db.prepare("SELECT kind, equipped FROM items WHERE shelter_id = ? ORDER BY id").all(shelterId) as { kind: ItemKind; equipped: number }[];
  const gear: Equipped = {};
  const stored: ItemKind[] = [];
  for (const r of rows) {
    if (!GEAR[r.kind]) continue;
    if (r.equipped) gear[GEAR[r.kind].slot] = r.kind;
    else stored.push(r.kind);
  }
  return { gear, stored };
}

const owns = (db: DatabaseSync, shelterId: number, kind: ItemKind): boolean =>
  Boolean(db.prepare("SELECT 1 FROM items WHERE shelter_id = ? AND kind = ?").get(shelterId, kind));

// A player owns at most one of each item; returns whether this one is new.
export function grantItem(db: DatabaseSync, shelterId: number, kind: ItemKind, now: number, equipped = false): boolean {
  return db.prepare("INSERT OR IGNORE INTO items (shelter_id, kind, equipped, created_at) VALUES (?, ?, ?, ?)").run(shelterId, kind, equipped ? 1 : 0, now).changes === 1;
}

export const firstMissing = (db: DatabaseSync, shelterId: number, kinds: ItemKind[]): ItemKind | undefined => kinds.find((k) => !owns(db, shelterId, k));
export const ownsWeapon = (db: DatabaseSync, shelterId: number): boolean =>
  ITEM_KINDS.some((k) => GEAR[k].slot === "weapon" && owns(db, shelterId, k));

// Adds experience; a level gained is a point to spend at the shelter.
export function awardXp(db: DatabaseSync, shelterId: number, gained: number): { levelsGained: number; level: number } {
  const row = db.prepare("SELECT level, xp FROM characters WHERE shelter_id = ?").get(shelterId) as { level: number; xp: number };
  const g = gainXp(row.level, row.xp, gained);
  db.prepare("UPDATE characters SET level = ?, xp = ?, unspent = unspent + ? WHERE shelter_id = ?").run(g.level, g.xp, g.levelsGained, shelterId);
  return { levelsGained: g.levelsGained, level: g.level };
}

export const levelNote = (r: { levelsGained: number; level: number }): string =>
  r.levelsGained > 0 ? ` You reached level ${r.level}: a point to spend at the shelter.` : "";

// Brings HP up to `now`: it recovers only while home, from the server's clock.
// Must run inside a transaction, after any journey has been resolved.
export function settleCharacter(db: DatabaseSync, shelterId: number, home: boolean, now: number): Character {
  let row = db.prepare("SELECT * FROM characters WHERE shelter_id = ?").get(shelterId) as CharacterRow | undefined;
  if (!row) {
    createCharacter(db, shelterId, now);
    row = db.prepare("SELECT * FROM characters WHERE shelter_id = ?").get(shelterId) as unknown as CharacterRow;
  }
  const hp = home ? rested(row.hp, row.max_hp, row.hp_at, now) : row.hp;
  if (hp !== row.hp || row.hp_at < now) db.prepare("UPDATE characters SET hp = ?, hp_at = ? WHERE shelter_id = ?").run(hp, Math.max(row.hp_at, now), shelterId);
  const { gear, stored } = gearOf(db, shelterId);
  return {
    level: row.level,
    xp: row.xp,
    toNext: xpToNext(row.level),
    unspent: row.unspent,
    strength: row.strength,
    agility: row.agility,
    maxHp: row.max_hp,
    hp: Math.floor(hp),
    mealAt: row.meal_at,
    gear,
    stored,
    damage: damageRange(row.strength, gear),
    armour: armour(gear),
    capacity: capacity(row.strength, gear),
  };
}

export type GearResult = { ok: true; message: string } | { ok: false; status: 400 | 404 | 409 | 429; reason: string };

// Gear and training change only at home, with no trip or fight under way.
function atHome(db: DatabaseSync, userId: number, now: number) {
  const s = loadForUpdate(db, "user_id", userId, now)!;
  return s.journey ? { s, why: "You can only change gear or train at the shelter, between trips." } : { s, why: null };
}

export function equip(db: DatabaseSync, userId: number, kind: string, now: number): GearResult {
  if (!ITEM_KINDS.includes(kind as ItemKind)) return { ok: false, status: 400, reason: "There's no such item." };
  const k = kind as ItemKind;
  return tx(db, (): GearResult => {
    const { s, why } = atHome(db, userId, now);
    if (why) return { ok: false, status: 409, reason: why };
    const item = db.prepare("SELECT equipped FROM items WHERE shelter_id = ? AND kind = ?").get(s.id, k) as { equipped: number } | undefined;
    if (!item) return { ok: false, status: 404, reason: `You don't have a ${GEAR[k].name.toLowerCase()}.` };
    if (item.equipped) return { ok: true, message: `${GEAR[k].name} is already equipped.` };
    const slot = GEAR[k].slot;
    // whatever was in that slot goes back to storage
    const others = ITEM_KINDS.filter((x) => GEAR[x].slot === slot && x !== k);
    for (const o of others) db.prepare("UPDATE items SET equipped = 0 WHERE shelter_id = ? AND kind = ?").run(s.id, o);
    db.prepare("UPDATE items SET equipped = 1 WHERE shelter_id = ? AND kind = ?").run(s.id, k);
    return { ok: true, message: `Equipped the ${GEAR[k].name.toLowerCase()}.` };
  });
}

export function unequip(db: DatabaseSync, userId: number, slot: string, now: number): GearResult {
  if (!SLOTS.includes(slot as Slot)) return { ok: false, status: 400, reason: "There's no such slot." };
  return tx(db, (): GearResult => {
    const { s, why } = atHome(db, userId, now);
    if (why) return { ok: false, status: 409, reason: why };
    const kinds = ITEM_KINDS.filter((x) => GEAR[x].slot === slot);
    let changed = 0;
    for (const k of kinds) changed += db.prepare("UPDATE items SET equipped = 0 WHERE shelter_id = ? AND kind = ? AND equipped = 1").run(s.id, k).changes as number;
    return changed ? { ok: true, message: `Put the ${slot} away.` } : { ok: true, message: `Nothing in the ${slot} slot.` };
  });
}

const TRAIN = {
  strength: { col: "strength", by: CHARACTER.train.strength, label: "Strength" },
  agility: { col: "agility", by: CHARACTER.train.agility, label: "Agility" },
  maxHp: { col: "max_hp", by: CHARACTER.train.maxHp, label: "max HP" },
} as const;

export function train(db: DatabaseSync, userId: number, stat: string, now: number): GearResult {
  const t = TRAIN[stat as keyof typeof TRAIN];
  if (!t || !Object.hasOwn(TRAIN, stat)) return { ok: false, status: 400, reason: "You can't train that." };
  return tx(db, (): GearResult => {
    const { s, why } = atHome(db, userId, now);
    if (why) return { ok: false, status: 409, reason: why };
    // the point is spent by the same update that checks it's there
    const spent = db.prepare(`UPDATE characters SET unspent = unspent - 1, ${t.col} = ${t.col} + ? WHERE shelter_id = ? AND unspent > 0`).run(t.by, s.id);
    if (spent.changes !== 1) return { ok: false, status: 409, reason: "You have no points to spend. Each level gives one." };
    const message = `+${t.by} ${t.label}.`;
    log(db, s.id, now, "info", `You trained: ${message}`);
    return { ok: true, message };
  });
}

// A meal speeds up recovery: it costs food and water, and works once per cooldown.
export function meal(db: DatabaseSync, userId: number, now: number): GearResult {
  const m = RECOVERY.meal;
  return tx(db, (): GearResult => {
    const s = loadForUpdate(db, "user_id", userId, now)!;
    if (s.journey) return { ok: false, status: 409, reason: "You can only eat a proper meal at the shelter." };
    const c = s.character;
    if (c.hp >= c.maxHp) return { ok: false, status: 409, reason: "You're already at full health." };
    if (s.stock.food < m.food || s.stock.water < m.water) return { ok: false, status: 409, reason: `A meal takes ${m.food} Food and ${m.water} Water.` };
    const ate = db
      .prepare("UPDATE characters SET hp = MIN(max_hp, hp + ?), meal_at = ? WHERE shelter_id = ? AND meal_at <= ?")
      .run(m.hp, now, s.id, now - m.cooldownMs);
    if (ate.changes !== 1) return { ok: false, status: 429, reason: "You ate not long ago. Rest instead, or wait a few minutes." };
    db.prepare("UPDATE shelters SET food = food - ?, water = water - ? WHERE id = ?").run(m.food, m.water, s.id);
    log(db, s.id, now, "info", `You ate a proper meal: +${m.hp} HP for ${m.food} Food and ${m.water} Water.`);
    return { ok: true, message: `+${m.hp} HP.` };
  });
}

// How much a trip can bring home, from what's equipped now.
export function capacityOf(db: DatabaseSync, shelterId: number): number {
  const row = db.prepare("SELECT strength FROM characters WHERE shelter_id = ?").get(shelterId) as { strength: number } | undefined;
  return capacity(row?.strength ?? CHARACTER.strength, gearOf(db, shelterId).gear);
}
