import type { DatabaseSync } from "node:sqlite";
import { DROPS, GEAR, QUALITY, SUPPLIES, USES, type ItemKind, type SupplyKind } from "./game/config.ts";
import { nameOfGear, rollDrop, type Gear, type Supplies } from "./game/items.ts";
import { seeded } from "./game/rng.ts";
import { addSupply, grantGear, memberOf, shelterHasWeapon, stashOf, starter, takeSupply, type GearResult } from "./character.ts";
import { tx } from "./db.ts";
import { loadForUpdate, log } from "./shelter.ts";

// Items in the database (PLAN.md, "Items"): what a trip turns up, and the
// fixed uses of supplies and materials at home. The rules are in
// src/game/items.ts; the stash and who holds what are in src/character.ts.

// "a Rare machete (level 3)", for logs and messages.
export const gearLabel = (g: Gear): string => `${g.quality === "common" ? "" : `${QUALITY[g.quality].name} `}${nameOfGear(g)} (level ${g.level})`;
export const suppliesText = (s: Supplies): string =>
  (Object.entries(s) as [SupplyKind, number][]).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${SUPPLIES[k].name.toLowerCase()}`).join(", ");

// Rolls a place's table for one trip, puts what it finds in the stash, and
// says what that was. Seeded by the journey, so it never rolls twice.
// `salt` keeps two tables on the same trip (the place, the beast) apart.
export function findOnTrip(db: DatabaseSync, shelterId: number, table: keyof typeof DROPS, journeyId: number, now: number, salt = 0): string {
  const t = DROPS[table];
  if (!t) return "";
  const { supplies, gear } = rollDrop(seeded(journeyId * 2_862_933_555 + salt), t);
  const parts: string[] = [];
  for (const [k, n] of Object.entries(supplies) as [SupplyKind, number][]) addSupply(db, shelterId, k, n, now);
  if (Object.keys(supplies).length) parts.push(suppliesText(supplies));
  if (gear) {
    grantGear(db, shelterId, gear, now);
    parts.push(`a ${gearLabel(gear).replace(/^(\w)/, (c) => c.toLowerCase())}`);
  }
  // the Workshop is the safe way back to a weapon after losing everything
  if (table === "workshop" && !shelterHasWeapon(db, shelterId)) {
    grantGear(db, shelterId, starter("crowbar"), now);
    parts.push("a crowbar from the bench");
  }
  return parts.length ? ` Found ${parts.join(", ")}; it's in the stash.` : "";
}

export type UseId = keyof typeof USES;

// Healing at home from what's in the stash: a bandage, or tinned peaches.
export function useAtHome(db: DatabaseSync, userId: number, kind: string, now: number, who?: unknown): GearResult {
  const k = kind as SupplyKind;
  const def = SUPPLIES[k];
  if (!def || !Object.hasOwn(SUPPLIES, kind) || !def.heal) return { ok: false, status: 400, reason: "That can't be used at home." };
  return tx(db, (): GearResult => {
    const s = loadForUpdate(db, "user_id", userId, now)!;
    const m = memberOf(s, who);
    if (!m) return { ok: false, status: 404, reason: "Nobody by that name lives here." };
    if (m.journey) return { ok: false, status: 409, reason: `${m.name === "You" ? "You're" : `${m.name}'s`} not home.` };
    if (m.character.hp >= m.character.maxHp) return { ok: false, status: 409, reason: `${m.who === "you" ? "You're" : `${m.name}'s`} already at full health.` };
    if (!takeSupply(db, s.id, k, 1)) return { ok: false, status: 409, reason: `There's no ${def.name.toLowerCase()} in the stash.` };
    db.prepare("UPDATE characters SET hp = MIN(?, hp + ?) WHERE id = ?").run(m.character.maxHp, def.heal!, m.id);
    const message = `${m.who === "you" ? "You" : m.name} used ${def.name.toLowerCase()}: +${def.heal} HP.`;
    log(db, s.id, now, "info", message);
    return { ok: true, message };
  });
}

// A material's fixed use. `itemId` is the stick, for a nail bat.
export function useMaterial(db: DatabaseSync, userId: number, use: string, now: number, itemId?: unknown): GearResult {
  if (!Object.hasOwn(USES, use)) return { ok: false, status: 400, reason: "There's no such use." };
  const u = use as UseId;
  return tx(db, (): GearResult => {
    const s = loadForUpdate(db, "user_id", userId, now)!;
    if (s.journey) return { ok: false, status: 409, reason: "You can only work on things at home." };
    const take = (kind: SupplyKind, n: number) => takeSupply(db, s.id, kind, n);
    const short = (kind: SupplyKind, n: number): GearResult => ({ ok: false, status: 409, reason: `That takes ${n} ${SUPPLIES[kind].name.toLowerCase()}.` });
    let message: string;
    switch (u) {
      case "bandage": {
        if (!take("cloth", USES.bandage.takes.cloth)) return short("cloth", USES.bandage.takes.cloth);
        addSupply(db, s.id, "bandage", 1, now);
        message = "You tore cloth into a bandage.";
        break;
      }
      case "nailbat": {
        const id = Number(itemId);
        const row = db.prepare("SELECT id, level, quality, bonuses_json, traits_json FROM items WHERE id = ? AND shelter_id = ? AND kind = 'stick' AND held_by IS NULL").get(Number.isInteger(id) ? id : -1, s.id) as
          | { id: number; level: number; quality: string; bonuses_json: string; traits_json: string }
          | undefined;
        if (!row) return { ok: false, status: 409, reason: "That takes a wooden stick from the stash." };
        if (!take("nails", USES.nailbat.takes.nails)) return short("nails", USES.nailbat.takes.nails);
        // the stick becomes the bat: same level, quality and rolls
        db.prepare("UPDATE items SET kind = 'nailbat' WHERE id = ?").run(row.id);
        message = `You hammered nails into the stick: a ${GEAR.nailbat.name.toLowerCase()} (level ${row.level}).`;
        break;
      }
      case "shot": {
        if (s.stock.scrap < USES.shot.scrap) return { ok: false, status: 409, reason: `That takes ${USES.shot.scrap} Scrap.` };
        db.prepare("UPDATE shelters SET scrap = scrap - ? WHERE id = ?").run(USES.shot.scrap, s.id);
        addSupply(db, s.id, "shot", USES.shot.makes, now);
        message = `You cut ${USES.shot.scrap} Scrap into ${USES.shot.makes} shot.`;
        break;
      }
      case "tape": {
        if (db.prepare("SELECT 1 FROM buffs WHERE shelter_id = ? AND kind = 'taped' AND expires_at > ?").get(s.id, now))
          return { ok: false, status: 409, reason: "The seal is already taped." };
        if (!take("ducttape", USES.tape.takes.ducttape)) return short("ducttape", 1);
        db.prepare("INSERT INTO buffs (shelter_id, kind, from_user_id, expires_at) VALUES (?, 'taped', ?, ?)").run(s.id, userId, now + USES.tape.ms);
        message = `You taped the hatch seal: +${USES.tape.defence} defence for ${USES.tape.ms / 60_000} min.`;
        break;
      }
      case "circuit": {
        if (!take("circuit", 1)) return short("circuit", 1);
        db.prepare("UPDATE shelters SET power = power + ? WHERE id = ?").run(USES.circuit.power, s.id);
        message = `You fixed the generator's regulator: +${USES.circuit.power} Power.`;
        break;
      }
      case "sorbent": {
        // the purifier needs power to push water through a fresh stack
        if (s.stock.power <= 0) return { ok: false, status: 409, reason: "The purifier needs power to run a fresh stack." };
        if (!take("sorbent", 1)) return short("sorbent", 1);
        db.prepare("UPDATE shelters SET water = water + ? WHERE id = ?").run(USES.sorbent.water, s.id);
        message = `You re-packed the purifier with fresh RC-40 media: +${USES.sorbent.water} Water.`;
        break;
      }
    }
    log(db, s.id, now, "info", message);
    return { ok: true, message };
  });
}

// For tests and the stash view: everything a shelter has, by kind.
export const stashKinds = (db: DatabaseSync, shelterId: number): ItemKind[] => stashOf(db, shelterId).gear.map((g) => g.kind);
