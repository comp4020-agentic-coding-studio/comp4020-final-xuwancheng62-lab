import type { DatabaseSync } from "node:sqlite";
import { CHARACTER, GEAR, ITEM_KINDS, RAID, RECOVERY, RESIDENTS, SLOTS, type ItemKind, type ResidentId, type Slot, type Who } from "./game/config.ts";
import { capacity, damageRange, armour, gainXp, rested, xpToNext, type Equipped } from "./game/character.ts";
import { tx } from "./db.ts";
import { loadForUpdate, log, type Member, type ShelterView } from "./shelter.ts";

// Everyone in a shelter and their gear, in the database: you, and anyone
// who's joined you. The rules are in src/game/character.ts; PLAN.md
// "Character, gear and the beast" has the why.

export type Task = "guard" | "work";

export interface Character {
  id: number;
  who: Who;
  name: string;
  combat: number;
  task: Task;
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

export interface CharacterRow {
  id: number;
  who: string;
  combat: number;
  task: Task;
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

export const nameOf = (who: string): string => (who === "you" ? "You" : RESIDENTS[who as ResidentId]?.name ?? who);

// The words for someone in a sentence: "you do" for you, "he does" for Toby.
export function wordsFor(who: string) {
  if (who === "you") return { they: "you", them: "you", their: "your", does: "you do", gets: "you get", had: "you'd" };
  const p: { they: string; them: string; their: string } = RESIDENTS[who as ResidentId]?.pronouns ?? { they: "they", them: "them", their: "their" };
  const plural = p.they === "they";
  return { ...p, does: `${p.they} ${plural ? "do" : "does"}`, gets: `${p.they} ${plural ? "get" : "gets"}`, had: `${p.they}'d` };
}

// You, made with the shelter; returns the new character's id.
export function createCharacter(db: DatabaseSync, shelterId: number, now: number): number {
  db.prepare("INSERT OR IGNORE INTO characters (shelter_id, who, combat, hp_at, strength, agility, max_hp, hp) VALUES (?, 'you', ?, ?, ?, ?, ?, ?)").run(
    shelterId, RAID.startingCombat, now, CHARACTER.strength, CHARACTER.agility, CHARACTER.maxHp, CHARACTER.maxHp,
  );
  const id = characterId(db, shelterId, "you")!;
  grantItem(db, id, "crowbar", now, true);
  return id;
}

// Someone joining you, with their own numbers and kit.
export function addResident(db: DatabaseSync, shelterId: number, who: ResidentId, now: number, task: Task = "work"): number | null {
  const r = RESIDENTS[who];
  const added = db
    .prepare("INSERT OR IGNORE INTO characters (shelter_id, who, combat, task, hp_at, strength, agility, max_hp, hp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(shelterId, who, r.combat, task, now, r.strength, r.agility, r.maxHp, r.maxHp);
  if (added.changes !== 1) return null;
  const id = characterId(db, shelterId, who)!;
  for (const k of r.gear) grantItem(db, id, k, now, true);
  return id;
}

export const characterId = (db: DatabaseSync, shelterId: number, who: string): number | undefined =>
  (db.prepare("SELECT id FROM characters WHERE shelter_id = ? AND who = ?").get(shelterId, who) as { id: number } | undefined)?.id;

export function gearOf(db: DatabaseSync, characterId: number): { gear: Equipped; stored: ItemKind[] } {
  const rows = db.prepare("SELECT kind, equipped FROM items WHERE character_id = ? ORDER BY id").all(characterId) as { kind: ItemKind; equipped: number }[];
  const gear: Equipped = {};
  const stored: ItemKind[] = [];
  for (const r of rows) {
    if (!GEAR[r.kind]) continue;
    if (r.equipped) gear[GEAR[r.kind].slot] = r.kind;
    else stored.push(r.kind);
  }
  return { gear, stored };
}

const owns = (db: DatabaseSync, characterId: number, kind: ItemKind): boolean =>
  Boolean(db.prepare("SELECT 1 FROM items WHERE character_id = ? AND kind = ?").get(characterId, kind));

// Each person owns at most one of each item; returns whether this one is new.
export function grantItem(db: DatabaseSync, characterId: number, kind: ItemKind, now: number, equipped = false): boolean {
  return db.prepare("INSERT OR IGNORE INTO items (character_id, kind, equipped, created_at) VALUES (?, ?, ?, ?)").run(characterId, kind, equipped ? 1 : 0, now).changes === 1;
}

export const firstMissing = (db: DatabaseSync, characterId: number, kinds: ItemKind[]): ItemKind | undefined => kinds.find((k) => !owns(db, characterId, k));
export const ownsWeapon = (db: DatabaseSync, characterId: number): boolean =>
  ITEM_KINDS.some((k) => GEAR[k].slot === "weapon" && owns(db, characterId, k));

// Adds experience; a level gained is a point to spend at the shelter.
export function awardXp(db: DatabaseSync, characterId: number, gained: number): { levelsGained: number; level: number; who: string } {
  const row = db.prepare("SELECT who, level, xp FROM characters WHERE id = ?").get(characterId) as { who: string; level: number; xp: number };
  const g = gainXp(row.level, row.xp, gained);
  db.prepare("UPDATE characters SET level = ?, xp = ?, unspent = unspent + ? WHERE id = ?").run(g.level, g.xp, g.levelsGained, characterId);
  return { levelsGained: g.levelsGained, level: g.level, who: row.who };
}

export const levelNote = (r: { levelsGained: number; level: number; who?: string }): string =>
  r.levelsGained <= 0 ? "" : !r.who || r.who === "you" ? ` You reached level ${r.level}: a point to spend at the shelter.` : ` ${nameOf(r.who)} reached level ${r.level}: a point to spend at the shelter.`;

// A won fight or a Nest trip someone survives makes them tougher.
export const toughen = (db: DatabaseSync, characterId: number): number => {
  db.prepare("UPDATE characters SET combat = MIN(?, combat + 1) WHERE id = ?").run(RAID.maxCombat, characterId);
  return (db.prepare("SELECT combat FROM characters WHERE id = ?").get(characterId) as { combat: number }).combat;
};

export const crewRows = (db: DatabaseSync, shelterId: number): CharacterRow[] =>
  db.prepare("SELECT * FROM characters WHERE shelter_id = ? ORDER BY who != 'you', id").all(shelterId) as unknown as CharacterRow[];

// Brings HP up to `now`: it recovers only while home, from the server's clock.
// Must run inside a transaction, after any journey has been resolved.
export function settleCharacter(db: DatabaseSync, row: CharacterRow, home: boolean, now: number): Character {
  const hp = home ? rested(row.hp, row.max_hp, row.hp_at, now) : row.hp;
  if (hp !== row.hp || row.hp_at < now) db.prepare("UPDATE characters SET hp = ?, hp_at = ? WHERE id = ?").run(hp, Math.max(row.hp_at, now), row.id);
  const { gear, stored } = gearOf(db, row.id);
  return {
    id: row.id,
    who: row.who as Who,
    name: nameOf(row.who),
    combat: row.combat,
    task: row.task,
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

// The person a form names, if they're in this shelter; you by default.
export const memberOf = (s: ShelterView, who: unknown): Member | undefined => s.crew.find((m) => m.who === (who === undefined || who === "" ? "you" : who));

// Gear and training change only at home, with no trip or fight under way.
function atHome(db: DatabaseSync, userId: number, who: unknown, now: number): { s: ShelterView; m?: Member; why: string | null; status: 404 | 409 } {
  const s = loadForUpdate(db, "user_id", userId, now)!;
  const m = memberOf(s, who);
  if (!m) return { s, why: "Nobody by that name lives here.", status: 404 };
  if (m.journey) return { s, m, why: `${m.who === "you" ? "You can" : `${m.name} can`} only change gear or train at the shelter, between trips.`, status: 409 };
  return { s, m, why: null, status: 409 };
}

export function equip(db: DatabaseSync, userId: number, kind: string, now: number, who?: unknown): GearResult {
  if (!ITEM_KINDS.includes(kind as ItemKind)) return { ok: false, status: 400, reason: "There's no such item." };
  const k = kind as ItemKind;
  return tx(db, (): GearResult => {
    const { m, why, status } = atHome(db, userId, who, now);
    if (why || !m) return { ok: false, status, reason: why! };
    const item = db.prepare("SELECT equipped FROM items WHERE character_id = ? AND kind = ?").get(m.id, k) as { equipped: number } | undefined;
    if (!item) return { ok: false, status: 404, reason: `${m.who === "you" ? "You don't" : `${m.name} doesn't`} have a ${GEAR[k].name.toLowerCase()}.` };
    if (item.equipped) return { ok: true, message: `${GEAR[k].name} is already equipped.` };
    const slot = GEAR[k].slot;
    // whatever was in that slot goes back to storage
    const others = ITEM_KINDS.filter((x) => GEAR[x].slot === slot && x !== k);
    for (const o of others) db.prepare("UPDATE items SET equipped = 0 WHERE character_id = ? AND kind = ?").run(m.id, o);
    db.prepare("UPDATE items SET equipped = 1 WHERE character_id = ? AND kind = ?").run(m.id, k);
    return { ok: true, message: `Equipped the ${GEAR[k].name.toLowerCase()}.` };
  });
}

export function unequip(db: DatabaseSync, userId: number, slot: string, now: number, who?: unknown): GearResult {
  if (!SLOTS.includes(slot as Slot)) return { ok: false, status: 400, reason: "There's no such slot." };
  return tx(db, (): GearResult => {
    const { m, why, status } = atHome(db, userId, who, now);
    if (why || !m) return { ok: false, status, reason: why! };
    const kinds = ITEM_KINDS.filter((x) => GEAR[x].slot === slot);
    let changed = 0;
    for (const k of kinds) changed += db.prepare("UPDATE items SET equipped = 0 WHERE character_id = ? AND kind = ? AND equipped = 1").run(m.id, k).changes as number;
    return changed ? { ok: true, message: `Put the ${slot} away.` } : { ok: true, message: `Nothing in the ${slot} slot.` };
  });
}

// Handing a stored item to someone else at home. Both have to be here, it
// can't be in use, and nobody carries two of the same thing.
export function give(db: DatabaseSync, userId: number, from: unknown, to: unknown, kind: string, now: number): GearResult {
  if (!ITEM_KINDS.includes(kind as ItemKind)) return { ok: false, status: 400, reason: "There's no such item." };
  const k = kind as ItemKind;
  return tx(db, (): GearResult => {
    const { s, m: giver, why, status } = atHome(db, userId, from, now);
    if (why || !giver) return { ok: false, status, reason: why! };
    const taker = memberOf(s, to);
    if (!taker || taker.id === giver.id) return { ok: false, status: 400, reason: "Give it to someone else who lives here." };
    if (taker.journey) return { ok: false, status: 409, reason: `${taker.name} is out. Hand things over when you're both home.` };
    const item = db.prepare("SELECT id, equipped FROM items WHERE character_id = ? AND kind = ?").get(giver.id, k) as { id: number; equipped: number } | undefined;
    if (!item) return { ok: false, status: 404, reason: `There's no ${GEAR[k].name.toLowerCase()} to give.` };
    if (item.equipped) return { ok: false, status: 409, reason: `Put the ${GEAR[k].name.toLowerCase()} away first.` };
    if (owns(db, taker.id, k)) return { ok: false, status: 409, reason: `${taker.who === "you" ? "You already have" : `${taker.name} already has`} a ${GEAR[k].name.toLowerCase()}.` };
    db.prepare("UPDATE items SET character_id = ? WHERE id = ?").run(taker.id, item.id);
    const message = `${giver.who === "you" ? "You gave" : `${giver.name} gave`} the ${GEAR[k].name.toLowerCase()} to ${taker.who === "you" ? "you" : taker.name}.`;
    log(db, s.id, now, "info", message);
    return { ok: true, message };
  });
}

// What someone who lives here does while home: keep guard, or their work.
export function setTask(db: DatabaseSync, userId: number, who: unknown, task: string, now: number): GearResult {
  if (task !== "guard" && task !== "work") return { ok: false, status: 400, reason: "They can guard or work." };
  return tx(db, (): GearResult => {
    const s = loadForUpdate(db, "user_id", userId, now)!;
    const m = memberOf(s, who);
    if (!m || m.who === "you") return { ok: false, status: 404, reason: "Nobody by that name lives here." };
    db.prepare("UPDATE characters SET task = ? WHERE id = ?").run(task, m.id);
    const message = task === "work" ? `${m.name} is on work: ${RESIDENTS[m.who as ResidentId].work.toLowerCase()}.` : `${m.name} is keeping guard.`;
    log(db, s.id, now, "info", message);
    return { ok: true, message };
  });
}

const TRAIN = {
  strength: { col: "strength", by: CHARACTER.train.strength, label: "Strength" },
  agility: { col: "agility", by: CHARACTER.train.agility, label: "Agility" },
  maxHp: { col: "max_hp", by: CHARACTER.train.maxHp, label: "max HP" },
} as const;

export function train(db: DatabaseSync, userId: number, stat: string, now: number, who?: unknown): GearResult {
  const t = TRAIN[stat as keyof typeof TRAIN];
  if (!t || !Object.hasOwn(TRAIN, stat)) return { ok: false, status: 400, reason: "You can't train that." };
  return tx(db, (): GearResult => {
    const { s, m, why, status } = atHome(db, userId, who, now);
    if (why || !m) return { ok: false, status, reason: why! };
    // the point is spent by the same update that checks it's there
    const spent = db.prepare(`UPDATE characters SET unspent = unspent - 1, ${t.col} = ${t.col} + ? WHERE id = ? AND unspent > 0`).run(t.by, m.id);
    if (spent.changes !== 1) return { ok: false, status: 409, reason: `${m.who === "you" ? "You have" : `${m.name} has`} no points to spend. Each level gives one.` };
    const message = `+${t.by} ${t.label}.`;
    log(db, s.id, now, "info", `${m.who === "you" ? "You" : m.name} trained: ${message}`);
    return { ok: true, message };
  });
}

// A meal speeds up recovery: it costs food and water, and works once per cooldown.
export function meal(db: DatabaseSync, userId: number, now: number, who?: unknown): GearResult {
  const m = RECOVERY.meal;
  return tx(db, (): GearResult => {
    const s = loadForUpdate(db, "user_id", userId, now)!;
    const p = memberOf(s, who);
    if (!p) return { ok: false, status: 404, reason: "Nobody by that name lives here." };
    const you = p.who === "you";
    if (p.journey) return { ok: false, status: 409, reason: `${you ? "You" : p.name} can only eat a proper meal at the shelter.` };
    const c = p.character;
    if (c.hp >= c.maxHp) return { ok: false, status: 409, reason: `${you ? "You're" : `${p.name}'s`} already at full health.` };
    if (s.stock.food < m.food || s.stock.water < m.water) return { ok: false, status: 409, reason: `A meal takes ${m.food} Food and ${m.water} Water.` };
    const ate = db
      .prepare("UPDATE characters SET hp = MIN(max_hp, hp + ?), meal_at = ? WHERE id = ? AND meal_at <= ?")
      .run(m.hp, now, p.id, now - m.cooldownMs);
    if (ate.changes !== 1) return { ok: false, status: 429, reason: `${you ? "You" : p.name} ate not long ago. Rest instead, or wait a few minutes.` };
    db.prepare("UPDATE shelters SET food = food - ?, water = water - ? WHERE id = ?").run(m.food, m.water, s.id);
    log(db, s.id, now, "info", `${you ? "You" : p.name} ate a proper meal: +${m.hp} HP for ${m.food} Food and ${m.water} Water.`);
    return { ok: true, message: `+${m.hp} HP.` };
  });
}

// How much a trip can bring home, from what's equipped now.
export function capacityOf(db: DatabaseSync, characterId: number): number {
  const row = db.prepare("SELECT strength FROM characters WHERE id = ?").get(characterId) as { strength: number } | undefined;
  return capacity(row?.strength ?? CHARACTER.strength, gearOf(db, characterId).gear);
}
