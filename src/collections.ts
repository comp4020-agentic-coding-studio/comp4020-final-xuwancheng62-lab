import type { DatabaseSync } from "node:sqlite";
import { COLLECTION_XP } from "./game/config.ts";
import { SETS, isComplete } from "./game/collections.ts";
import type { FragmentId } from "./game/stories.ts";
import { awardXp, characterId, levelNote } from "./character.ts";
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
    if (!isComplete(set, found)) continue;
    const xp = COLLECTION_XP[set.id] ?? 0;
    const claimed = db.prepare("INSERT OR IGNORE INTO collection_rewards (shelter_id, set_id, xp, rewarded_at) VALUES (?, ?, ?, ?)").run(shelterId, set.id, xp, at);
    if (claimed.changes !== 1) continue;
    // the reward is yours: you're the one reading the records
    const note = xp > 0 ? levelNote(awardXp(db, characterId(db, shelterId, "you")!, xp)) : "";
    log(db, shelterId, at, "record", `You've found every card in ${set.title}'s collection.${xp > 0 ? ` +${xp} XP.` : ""}${note} The story is in your collection.`);
  }
}

export const rewarded = (db: DatabaseSync, shelterId: number, setId: string): { xp: number; at: number } | null => {
  const r = db.prepare("SELECT xp, rewarded_at FROM collection_rewards WHERE shelter_id = ? AND set_id = ?").get(shelterId, setId) as { xp: number; rewarded_at: number } | undefined;
  return r ? { xp: r.xp, at: r.rewarded_at } : null;
};
