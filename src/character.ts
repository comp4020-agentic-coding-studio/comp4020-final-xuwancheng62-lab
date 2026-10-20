import type { DatabaseSync } from "node:sqlite";
import { CHARACTER, GEAR, RAID, RECOVERY, RESIDENTS, SLOTS, SUPPLIES, type ItemKind, type Quality, type ResidentId, type Slot, type SupplyKind, type Who } from "./game/config.ts";
import { gainXp, maxHpOf, recruitLevel, rested, xpToNext } from "./game/character.ts";
import { cannotUse, effective, nameOfGear, packLoad, rollGear, type Body, type Gear, type Loadout, type Supplies } from "./game/items.ts";
import { seeded } from "./game/rng.ts";
import { tx } from "./db.ts";
import { loadForUpdate, log, type Member, type ShelterView } from "./shelter.ts";
import { musteringSeat } from "./parties.ts";

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
  constitution: number;
  maxHp: number;
  hp: number; // whole HP, as shown and as fought with
  mealAt: number;
  // their own numbers, before what they wear: what training raises and
  // what an item's requirements are checked against
  base: Body;
  gear: Loadout;
  belt: Supplies;
  pack: Supplies;
  damage: [number, number];
  // a ranged weapon's ammunition, and whether they're out of it
  ammo?: SupplyKind;
  clubbing: boolean;
  armour: number;
  // room left for what a trip finds, after the pack
  capacity: number;
  belt_size: number;
  escape: number;
  traits: Partial<Record<import("./game/config.ts").Trait, number>>;
  guard: number;
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
  max_hp: number; // from before Constitution, unread
  constitution: number;
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
  const full = maxHpOf(CHARACTER.strength, CHARACTER.constitution);
  db.prepare("INSERT OR IGNORE INTO characters (shelter_id, who, combat, hp_at, strength, agility, constitution, max_hp, hp) VALUES (?, 'you', ?, ?, ?, ?, ?, ?, ?)").run(
    shelterId, RAID.startingCombat, now, CHARACTER.strength, CHARACTER.agility, CHARACTER.constitution, full, full,
  );
  const id = characterId(db, shelterId, "you")!;
  grantGear(db, shelterId, starter("crowbar"), now, id);
  return id;
}

// Someone joining you, with their own numbers and kit.
export function addResident(db: DatabaseSync, shelterId: number, who: ResidentId, now: number, task: Task = "work"): number | null {
  const r = RESIDENTS[who];
  const added = db
    .prepare("INSERT OR IGNORE INTO characters (shelter_id, who, combat, task, hp_at, strength, agility, constitution, max_hp, hp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(shelterId, who, r.combat, task, now, r.strength, r.agility, r.constitution, maxHpOf(r.strength, r.constitution), maxHpOf(r.strength, r.constitution));
  if (added.changes !== 1) return null;
  const id = characterId(db, shelterId, who)!;
  for (const k of r.gear) grantGear(db, shelterId, starter(k), now, id);
  return id;
}

// Brings a resident up to a level they haven't reached: no XP toward the
// next, and each level gained is a point for the player to spend. Never lowers.
export function raiseTo(db: DatabaseSync, characterId: number, level: number): number {
  const r = db.prepare("UPDATE characters SET unspent = unspent + (? - level), xp = 0, level = ? WHERE id = ? AND who != 'you' AND level < ?").run(level, level, characterId, level);
  return Number(r.changes);
}

// Residents who joined before recruits started near your level: raised once,
// to the same rule, from the level you are when this first runs.
export function catchUpResidents(db: DatabaseSync, shelterId: number): void {
  const marked = db.prepare("UPDATE shelters SET residents_levelled = 1 WHERE id = ? AND residents_levelled = 0").run(shelterId);
  if (marked.changes !== 1) return;
  const you = db.prepare("SELECT level FROM characters WHERE shelter_id = ? AND who = 'you'").get(shelterId) as { level: number } | undefined;
  if (!you) return;
  const to = recruitLevel(you.level);
  for (const c of db.prepare("SELECT id FROM characters WHERE shelter_id = ? AND who != 'you'").all(shelterId) as { id: number }[]) raiseTo(db, c.id, to);
}

export const characterId = (db: DatabaseSync, shelterId: number, who: string): number | undefined =>
  (db.prepare("SELECT id FROM characters WHERE shelter_id = ? AND who = ?").get(shelterId, who) as { id: number } | undefined)?.id;

// ---- items: the shelter's stash, and what each person holds

interface ItemRow {
  id: number;
  kind: string;
  level: number;
  quality: Quality;
  bonuses_json: string;
  traits_json: string;
  name: string | null;
  qty: number;
  held_by: number | null;
  slot: string | null;
}
const toGear = (r: ItemRow): Gear => ({
  id: r.id,
  kind: r.kind as ItemKind,
  level: r.level,
  quality: r.quality,
  bonuses: JSON.parse(r.bonuses_json),
  traits: JSON.parse(r.traits_json),
  name: r.name,
});

// A plain level-1, Common piece: what people start with.
export const starter = (kind: ItemKind): Gear => ({ kind, level: 1, quality: "common", bonuses: {}, traits: [] });

export function gearOf(db: DatabaseSync, characterId: number): { gear: Loadout; belt: Supplies; pack: Supplies } {
  const rows = db.prepare("SELECT * FROM items WHERE held_by = ? ORDER BY id").all(characterId) as unknown as ItemRow[];
  const gear: Loadout = {};
  const belt: Supplies = {};
  const pack: Supplies = {};
  for (const r of rows) {
    if (r.level > 0 && GEAR[r.kind as ItemKind]) gear[r.slot as Slot] = toGear(r);
    else if (r.slot === "belt") belt[r.kind as SupplyKind] = r.qty;
    else if (r.slot === "pack") pack[r.kind as SupplyKind] = r.qty;
  }
  return { gear, belt, pack };
}

// Everything at home that nobody is holding.
export function stashOf(db: DatabaseSync, shelterId: number): { gear: Gear[]; supplies: Supplies } {
  const rows = db.prepare("SELECT * FROM items WHERE shelter_id = ? AND held_by IS NULL ORDER BY id").all(shelterId) as unknown as ItemRow[];
  const gear: Gear[] = [];
  const supplies: Supplies = {};
  for (const r of rows) {
    if (r.level > 0) {
      if (GEAR[r.kind as ItemKind]) gear.push(toGear(r));
    } else if (SUPPLIES[r.kind as SupplyKind]) supplies[r.kind as SupplyKind] = r.qty;
  }
  return { gear, supplies };
}

// A new piece of equipment into the stash, or straight into someone's hands.
export function grantGear(db: DatabaseSync, shelterId: number, g: Gear, now: number, holder?: number): number {
  const r = db
    .prepare("INSERT INTO items (shelter_id, kind, level, quality, bonuses_json, traits_json, name, qty, held_by, slot, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)")
    .run(shelterId, g.kind, g.level, g.quality, JSON.stringify(g.bonuses), JSON.stringify(g.traits), g.name ?? null, holder ?? null, holder ? GEAR[g.kind].slot : null, now);
  return Number(r.lastInsertRowid);
}

// Supplies add to a stack: the stash's, or someone's belt or pack.
export function addSupply(db: DatabaseSync, shelterId: number, kind: SupplyKind, qty: number, now: number, holder?: { id: number; slot: "belt" | "pack" }): void {
  if (qty <= 0) return;
  const where = holder ? "held_by = ? AND slot = ?" : "held_by IS NULL";
  const args = holder ? [holder.id, holder.slot] : [];
  const up = db.prepare(`UPDATE items SET qty = qty + ? WHERE shelter_id = ? AND kind = ? AND level = 0 AND ${where}`).run(qty, shelterId, kind, ...args);
  if (up.changes === 0)
    db.prepare("INSERT INTO items (shelter_id, kind, level, qty, held_by, slot, created_at) VALUES (?, ?, 0, ?, ?, ?, ?)").run(shelterId, kind, qty, holder?.id ?? null, holder?.slot ?? null, now);
}

// Takes from a stack; false (and nothing taken) if there isn't that much.
export function takeSupply(db: DatabaseSync, shelterId: number, kind: SupplyKind, qty: number, holder?: { id: number; slot: "belt" | "pack" }): boolean {
  if (qty <= 0) return true;
  const where = holder ? "held_by = ? AND slot = ?" : "held_by IS NULL";
  const args = holder ? [holder.id, holder.slot] : [];
  if (db.prepare(`DELETE FROM items WHERE shelter_id = ? AND kind = ? AND level = 0 AND qty = ? AND ${where}`).run(shelterId, kind, qty, ...args).changes === 1) return true;
  return db.prepare(`UPDATE items SET qty = qty - ? WHERE shelter_id = ? AND kind = ? AND level = 0 AND qty > ? AND ${where}`).run(qty, shelterId, kind, qty, ...args).changes === 1;
}

// Is there a weapon anywhere in the shelter, held or stored?
export const shelterHasWeapon = (db: DatabaseSync, shelterId: number): boolean =>
  (db.prepare("SELECT kind FROM items WHERE shelter_id = ? AND level > 0").all(shelterId) as { kind: ItemKind }[]).some((r) => GEAR[r.kind]?.slot === "weapon");

// What someone carried out of the door, lost: equipment, belt and pack.
// Returns its names for the log.
export function loseCarried(db: DatabaseSync, characterId: number): string[] {
  const rows = db.prepare("SELECT * FROM items WHERE held_by = ?").all(characterId) as unknown as ItemRow[];
  db.prepare("DELETE FROM items WHERE held_by = ?").run(characterId);
  return rows.map((r) => (r.level > 0 ? nameOfGear(toGear(r)).toLowerCase() : `${r.qty} ${SUPPLIES[r.kind as SupplyKind].name.toLowerCase()}`));
}

// A seeded roll for a new item, so a retried request makes the same thing.
export const rollFor = (seed: number, kind: ItemKind, level: number, quality: Quality): Gear => rollGear(seeded(seed), kind, level, quality);

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
  const { gear, belt, pack } = gearOf(db, row.id);
  const base: Body = { level: row.level, strength: row.strength, agility: row.agility, constitution: row.constitution };
  const e = effective(base, gear, pack);
  // taking off something that added max HP can leave them above it
  const hp = Math.min(e.maxHp, home ? rested(row.hp, e.maxHp, row.hp_at, now) : row.hp);
  if (hp !== row.hp || row.hp_at < now) db.prepare("UPDATE characters SET hp = ?, hp_at = ? WHERE id = ?").run(hp, Math.max(row.hp_at, now), row.id);
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
    strength: e.strength,
    agility: e.agility,
    constitution: e.constitution,
    maxHp: e.maxHp,
    hp: Math.floor(hp),
    mealAt: row.meal_at,
    base,
    gear,
    belt,
    pack,
    damage: e.damage,
    ammo: e.ammo,
    clubbing: e.clubbing,
    armour: e.armour,
    capacity: Math.max(0, e.capacity - packLoad(pack)),
    belt_size: e.belt,
    escape: e.escape,
    traits: e.traits,
    guard: e.guard,
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
  // a party's preparation is locked in once you join it
  if (musteringSeat(db, m.id)) return { s, m, why: `${m.who === "you" ? "You're" : `${m.name}'s`} packed for a party. Leave it to change anything.`, status: 409 };
  return { s, m, why: null, status: 409 };
}

// Equipping takes a piece from the stash; whatever was in that slot goes back.
export function equip(db: DatabaseSync, userId: number, itemId: unknown, now: number, who?: unknown): GearResult {
  const id = Number(itemId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, status: 400, reason: "There's no such item." };
  return tx(db, (): GearResult => {
    const { s, m, why, status } = atHome(db, userId, who, now);
    if (why || !m) return { ok: false, status, reason: why! };
    const row = db.prepare("SELECT * FROM items WHERE id = ? AND shelter_id = ? AND level > 0").get(id, s.id) as ItemRow | undefined;
    if (!row || !GEAR[row.kind as ItemKind]) return { ok: false, status: 404, reason: "That isn't in your stash." };
    const g = toGear(row);
    const name = nameOfGear(g);
    if (row.held_by === m.id) return { ok: true, message: `${name} is already equipped.` };
    if (row.held_by !== null) return { ok: false, status: 409, reason: `Someone else is using the ${name.toLowerCase()}. Put it away first.` };
    const no = cannotUse(g, m.character.base);
    if (no) return { ok: false, status: 409, reason: `${m.who === "you" ? "You" : m.name} can't use the ${name.toLowerCase()} yet: ${no.toLowerCase()}.` };
    const slot = GEAR[g.kind].slot;
    db.prepare("UPDATE items SET held_by = NULL, slot = NULL WHERE held_by = ? AND slot = ?").run(m.id, slot);
    db.prepare("UPDATE items SET held_by = ?, slot = ? WHERE id = ?").run(m.id, slot, id);
    return { ok: true, message: `${m.who === "you" ? "You equipped" : `${m.name} equipped`} the ${name.toLowerCase()}.` };
  });
}

export function unequip(db: DatabaseSync, userId: number, slot: string, now: number, who?: unknown): GearResult {
  if (!SLOTS.includes(slot as Slot)) return { ok: false, status: 400, reason: "There's no such slot." };
  return tx(db, (): GearResult => {
    const { m, why, status } = atHome(db, userId, who, now);
    if (why || !m) return { ok: false, status, reason: why! };
    const changed = db.prepare("UPDATE items SET held_by = NULL, slot = NULL WHERE held_by = ? AND slot = ?").run(m.id, slot).changes;
    return changed ? { ok: true, message: `Put the ${slot} back in the stash.` } : { ok: true, message: `Nothing in the ${slot} slot.` };
  });
}

// Moving supplies between the stash and someone's belt (consumables) or
// pack (ammunition). `n` > 0 takes from the stash; < 0 puts back.
export function carrySupply(db: DatabaseSync, userId: number, kind: string, n: unknown, now: number, who?: unknown): GearResult {
  const k = kind as SupplyKind;
  const count = Number(n);
  if (!SUPPLIES[k] || !Object.hasOwn(SUPPLIES, kind) || !Number.isInteger(count) || count === 0 || Math.abs(count) > 999) return { ok: false, status: 400, reason: "There's no such thing to carry." };
  const type = SUPPLIES[k].type;
  if (type === "material") return { ok: false, status: 400, reason: "Materials stay at home; use them from the stash." };
  const slot = type === "ammo" ? "pack" : "belt";
  return tx(db, (): GearResult => {
    const { s, m, why, status } = atHome(db, userId, who, now);
    if (why || !m) return { ok: false, status, reason: why! };
    const name = SUPPLIES[k].name.toLowerCase();
    const holder = { id: m.id, slot } as const;
    if (count > 0) {
      if (slot === "belt") {
        const on = Object.values(m.character.belt).reduce((a, x) => a + (x ?? 0), 0);
        if (on + count > m.character.belt_size) return { ok: false, status: 409, reason: `The belt holds ${m.character.belt_size}. Webbing holds more.` };
      }
      if (!takeSupply(db, s.id, k, count)) return { ok: false, status: 409, reason: `There isn't that much ${name} in the stash.` };
      addSupply(db, s.id, k, count, now, holder);
      const now_ = ((slot === "belt" ? m.character.belt : m.character.pack)[k] ?? 0) + count;
      return { ok: true, message: `${m.who === "you" ? "You're" : `${m.name}'s`} carrying ${now_} ${name}.` };
    }
    if (!takeSupply(db, s.id, k, -count, holder)) return { ok: false, status: 409, reason: `${m.who === "you" ? "You aren't" : `${m.name} isn't`} carrying that much ${name}.` };
    addSupply(db, s.id, k, -count, now);
    return { ok: true, message: `Put ${-count} ${name} back in the stash.` };
  });
}

// What someone who lives here does while home: keep guard, or their work.
export function setTask(db: DatabaseSync, userId: number, who: unknown, task: string, now: number): GearResult {
  if (task !== "guard" && task !== "work") return { ok: false, status: 400, reason: "They can guard or work." };
  return tx(db, (): GearResult => {
    const s = loadForUpdate(db, "user_id", userId, now)!;
    const m = memberOf(s, who);
    if (!m || m.who === "you") return { ok: false, status: 404, reason: "Nobody by that name lives here." };
    if (m.journey || m.party?.mustering) return {ok:false,status:409,reason:"Return home and leave your party before changing assignment."};
    db.prepare("UPDATE characters SET task = ? WHERE id = ?").run(task, m.id);
    const message = task === "work" ? `${m.name} is on work: ${RESIDENTS[m.who as ResidentId].work.toLowerCase()}.` : `${m.name} is keeping guard.`;
    log(db, s.id, now, "info", message);
    return { ok: true, message };
  });
}

const TRAIN = {
  strength: { col: "strength", by: CHARACTER.train.strength, label: "Strength" },
  agility: { col: "agility", by: CHARACTER.train.agility, label: "Agility" },
  constitution: { col: "constitution", by: CHARACTER.train.constitution, label: "Constitution" },
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
      .prepare("UPDATE characters SET hp = MIN(?, hp + ?), meal_at = ? WHERE id = ? AND meal_at <= ?")
      .run(c.maxHp, m.hp, now, p.id, now - m.cooldownMs);
    if (ate.changes !== 1) return { ok: false, status: 429, reason: `${you ? "You" : p.name} ate not long ago. Rest instead, or wait a few minutes.` };
    db.prepare("UPDATE shelters SET food = food - ?, water = water - ? WHERE id = ?").run(m.food, m.water, s.id);
    log(db, s.id, now, "info", `${you ? "You" : p.name} ate a proper meal: +${m.hp} HP for ${m.food} Food and ${m.water} Water.`);
    return { ok: true, message: `+${m.hp} HP.` };
  });
}

// The traits someone's equipment gives them right now.
export function traitsOf(db: DatabaseSync, characterId: number) {
  const row = db.prepare("SELECT level, strength, agility, constitution FROM characters WHERE id = ?").get(characterId) as unknown as Body;
  const { gear, pack } = gearOf(db, characterId);
  return effective(row, gear, pack).traits;
}

// How much a trip can bring home, from what's equipped and packed now.
export function capacityOf(db: DatabaseSync, characterId: number): number {
  const row = db.prepare("SELECT level, strength, agility, constitution FROM characters WHERE id = ?").get(characterId) as unknown as Body;
  const { gear, pack } = gearOf(db, characterId);
  return Math.max(0, effective(row, gear, pack).capacity - packLoad(pack));
}
