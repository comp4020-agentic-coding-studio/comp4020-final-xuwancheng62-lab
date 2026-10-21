import { money } from "./currency.ts";
import { ECONOMY } from "./game/config.ts";
import type { DatabaseSync } from "node:sqlite";
import { COLLECTION_LEGENDARY, COLLECTION_XP } from "./game/config.ts";
import { SETS, isComplete } from "./game/collections.ts";
import type { FragmentId } from "./game/stories.ts";
import { rollLegendary, type Gear } from "./game/items.ts";
import { seeded } from "./game/rng.ts";
import { awardXp, characterId, grantGear, levelNote } from "./character.ts";
import { gearLabel } from "./items.ts";
import { tx } from "./db.ts";
import { loadForUpdate, log } from "./shelter.ts";
import { foundRecords } from "./stories.ts";

// The one thing a collection stores: that its completion reward was paid.
// The insert is what claims it, so a reward can't be paid twice.

export function settleCollections(db: DatabaseSync, shelterId: number, found: readonly FragmentId[], at: number): void {
  const records=foundRecords(db,shelterId);
  for (const set of SETS) {
    for(const card of set.cards){
      const first=records.find(r=>card.evidence.some(e=>e.record===r.id));
      if(!first)continue;
      const evidence=card.evidence.find(e=>e.record===first.id)!;
      // A stable set/card prefix deduplicates alternate evidence and reloads.
      const prefix=`${set.theme} · Card ${card.n}: `;
      const exists=db.prepare("SELECT 1 FROM activity_log WHERE shelter_id=? AND kind='card' AND substr(message,1,?)=?").get(shelterId,prefix.length,prefix);
      if(!exists)log(db,shelterId,first.at,'card',`${prefix}${evidence.title}. Added to your collection.`);
    }
    if (!isComplete(set, found)) continue;
    const xp = COLLECTION_XP[set.id] ?? 0;
    const you = db.prepare("SELECT level FROM characters WHERE shelter_id = ? AND who = 'you'").get(shelterId) as { level: number };
    const claimed = db.prepare("INSERT OR IGNORE INTO collection_rewards (shelter_id, set_id, xp, rewarded_at, gear_level) VALUES (?, ?, ?, ?, ?)").run(shelterId, set.id, xp, at, you.level + COLLECTION_LEGENDARY.levelOffset);
    if (claimed.changes !== 1) continue;
    money(db,shelterId,ECONOMY.collectionCredits,"Collection completed",`collection:${set.id}`,at);
    // the reward is yours: you're the one reading the records
    const note = xp > 0 ? levelNote(awardXp(db, characterId(db, shelterId, "you")!, xp)) : "";
    log(db, shelterId, at, "record", `You've found every card in ${set.title}'s collection. +${ECONOMY.collectionCredits} Credits.${xp > 0 ? ` +${xp} XP.` : ""}${note} Read the story to the end for a Legendary.`);
  }
}

// The Legendary a completed set is still holding for you, if any.
export function pendingLegendary(db: DatabaseSync, shelterId: number, setId: string): Gear | null {
  const r = db.prepare("SELECT gear_level FROM collection_rewards WHERE shelter_id = ? AND set_id = ? AND gear_item_id IS NULL AND gear_level IS NOT NULL").get(shelterId, setId) as { gear_level: number } | undefined;
  return r ? rollLegendary(seeded(legendarySeed(shelterId, setId)), r.gear_level) : null;
}

export type ClaimResult = { ok: true; gear: Gear | null } | { ok: false; status: 403 | 404; reason: string };

// Accepting a set's Legendary. The claim row's gear_item_id is set only while
// it's empty, so a second or forged post gives nothing more.
export function claimLegendary(db: DatabaseSync, userId: number, setId: string, now: number): ClaimResult {
  const set = SETS.find((x) => x.id === setId);
  if (!set) return { ok: false, status: 404, reason: "No such collection." };
  return tx(db, (): ClaimResult => {
    const s = loadForUpdate(db, "user_id", userId, now)!;
    const claim = db.prepare("SELECT gear_item_id FROM collection_rewards WHERE shelter_id = ? AND set_id = ?").get(s.id, setId) as { gear_item_id: number | null } | undefined;
    if (!claim) return { ok: false, status: 403, reason: "Find every card in this collection first." };
    const gear = pendingLegendary(db, s.id, setId);
    if (!gear) return { ok: true, gear: null };
    const id = grantGear(db, s.id, gear, now);
    if (db.prepare("UPDATE collection_rewards SET gear_item_id = ? WHERE shelter_id = ? AND set_id = ? AND gear_item_id IS NULL").run(id, s.id, setId).changes !== 1) {
      db.prepare("DELETE FROM items WHERE id = ?").run(id);
      return { ok: true, gear: null };
    }
    log(db, s.id, now, "loot", `For ${set.title}'s story: ${gearLabel(gear)}, in your stash.`);
    return { ok: true, gear: { ...gear, id } };
  });
}

// The same shelter and set always roll the same piece.
const legendarySeed = (shelterId: number, setId: string): number =>
  [...setId].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, shelterId * 2654435761 >>> 0) || 1;

export const rewarded = (db: DatabaseSync, shelterId: number, setId: string): { xp: number; at: number } | null => {
  const r = db.prepare("SELECT xp, rewarded_at FROM collection_rewards WHERE shelter_id = ? AND set_id = ?").get(shelterId, setId) as { xp: number; rewarded_at: number } | undefined;
  return r ? { xp: r.xp, at: r.rewarded_at } : null;
};
