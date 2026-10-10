import type { DatabaseSync } from "node:sqlite";
import { tx } from "./db.ts";
import { PURIFIER_PLATE, fragment } from "./game/stories.ts";
import { settleCollections } from "./collections.ts";
import type { TendResult } from "./greenhouse.ts";
import { loadForUpdate, log } from "./shelter.ts";
import { foundIds } from "./stories.ts";

// Taking the purifier's side panel off finds the serial plate on its stack:
// a record found at home, not on a trip. The discovery's unique key makes a
// second look a no-op, so nothing is logged or paid twice.
export function inspectPurifier(db: DatabaseSync, userId: number, now: number): TendResult {
  return tx(db, (): TendResult => {
    const s = loadForUpdate(db, "user_id", userId, now)!;
    if (s.journey) return { ok: false, status: 409, reason: "You're not home to look at the purifier." };
    const added = db
      .prepare("INSERT OR IGNORE INTO discoveries (shelter_id, fragment_id, journey_id, found_at) VALUES (?, ?, NULL, ?)")
      .run(s.id, PURIFIER_PLATE, now);
    if (added.changes !== 1) return { ok: true };
    log(db, s.id, now, "record", `You took the purifier's side panel off and found: ${fragment(PURIFIER_PLATE)!.title}. It's in your journal.`);
    settleCollections(db, s.id, foundIds(db, s.id), now);
    return { ok: true };
  });
}
