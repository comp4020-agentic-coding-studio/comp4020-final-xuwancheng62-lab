import type { DatabaseSync } from "node:sqlite";
import { COLLECTION_XP } from "./game/config.ts";
import { SETS, isComplete } from "./game/collections.ts";
import type { FragmentId } from "./game/stories.ts";
import { awardXp, levelNote } from "./character.ts";
import { log } from "./shelter.ts";

// The one thing a collection stores: that its completion reward was paid.
// The insert is what claims it, so a reward can't be paid twice.

export function settleCollections(db: DatabaseSync, shelterId: number, found: readonly FragmentId[], at: number): void {
  for (const set of SETS) {
    if (!isComplete(set, found)) continue;
    const xp = COLLECTION_XP[set.id] ?? 0;
    const claimed = db.prepare("INSERT OR IGNORE INTO collection_rewards (shelter_id, set_id, xp, rewarded_at) VALUES (?, ?, ?, ?)").run(shelterId, set.id, xp, at);
    if (claimed.changes !== 1) continue;
    const note = xp > 0 ? levelNote(awardXp(db, shelterId, xp)) : "";
    log(db, shelterId, at, "record", `You've found every card in ${set.title}'s collection.${xp > 0 ? ` +${xp} XP.` : ""}${note} The story is in your collection.`);
  }
}

export const rewarded = (db: DatabaseSync, shelterId: number, setId: string): { xp: number; at: number } | null => {
  const r = db.prepare("SELECT xp, rewarded_at FROM collection_rewards WHERE shelter_id = ? AND set_id = ?").get(shelterId, setId) as { xp: number; rewarded_at: number } | undefined;
  return r ? { xp: r.xp, at: r.rewarded_at } : null;
};
