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
import { log } from "./shelter.ts";
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
    if (!isComplete(set, found)) {
      // a set finished before the Legendary reward still gets one, once
      if (db.prepare("SELECT 1 FROM collection_rewards WHERE shelter_id = ? AND set_id = ? AND gear_item_id IS NULL").get(shelterId, set.id))
        grantSetLegendary(db, shelterId, set.id, set.title, at, true);
      continue;
    }
    const xp = COLLECTION_XP[set.id] ?? 0;
    const claimed = db.prepare("INSERT OR IGNORE INTO collection_rewards (shelter_id, set_id, xp, rewarded_at) VALUES (?, ?, ?, ?)").run(shelterId, set.id, xp, at);
    if (claimed.changes !== 1) {
      grantSetLegendary(db, shelterId, set.id, set.title, at, true);
      continue;
    }
    money(db,shelterId,ECONOMY.collectionCredits,"Collection completed",`collection:${set.id}`,at);
    // the reward is yours: you're the one reading the records
    const note = xp > 0 ? levelNote(awardXp(db, characterId(db, shelterId, "you")!, xp)) : "";
    const gear = grantSetLegendary(db, shelterId, set.id, set.title, at, false);
    log(db, shelterId, at, "record", `You've found every card in ${set.title}'s collection. +${ECONOMY.collectionCredits} Credits.${xp > 0 ? ` +${xp} XP.` : ""}${gear ? ` ${gearLabel(gear)} is in your stash.` : ""}${note} The story is in your collection.`);
  }
}

// The claim row holds which piece was given; the update only succeeds while
// it's still empty, so a set's Legendary is given at most once.
function grantSetLegendary(db: DatabaseSync, shelterId: number, setId: string, title: string, at: number, late: boolean): Gear | null {
  if (!db.prepare("SELECT 1 FROM collection_rewards WHERE shelter_id = ? AND set_id = ? AND gear_item_id IS NULL").get(shelterId, setId)) return null;
  const you = db.prepare("SELECT level FROM characters WHERE shelter_id = ? AND who = 'you'").get(shelterId) as { level: number };
  const gear = rollLegendary(seeded(legendarySeed(shelterId, setId)), you.level + COLLECTION_LEGENDARY.levelOffset);
  const id = grantGear(db, shelterId, gear, at);
  const set = db.prepare("UPDATE collection_rewards SET gear_item_id = ? WHERE shelter_id = ? AND set_id = ? AND gear_item_id IS NULL").run(id, shelterId, setId);
  if (set.changes !== 1) {
    db.prepare("DELETE FROM items WHERE id = ?").run(id);
    return null;
  }
  if (late) log(db, shelterId, at, "loot", `For completing ${title}'s collection: ${gearLabel(gear)}, in your stash.`);
  return gear;
}

// The same shelter and set always roll the same piece.
const legendarySeed = (shelterId: number, setId: string): number =>
  [...setId].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, shelterId * 2654435761 >>> 0) || 1;

export const rewarded = (db: DatabaseSync, shelterId: number, setId: string): { xp: number; at: number } | null => {
  const r = db.prepare("SELECT xp, rewarded_at FROM collection_rewards WHERE shelter_id = ? AND set_id = ?").get(shelterId, setId) as { xp: number; rewarded_at: number } | undefined;
  return r ? { xp: r.xp, at: r.rewarded_at } : null;
};
