import type { DatabaseSync } from "node:sqlite";
import { tx } from "./db.ts";
import { loadForUpdate, log } from "./shelter.ts";
import { foundIds } from "./stories.ts";
import type { TendResult } from "./greenhouse.ts";

// Explicit consent, not an automatic consequence of reading a clue.
// The discovery is a permanent receipt; the journal keeps its evidence copy.
export function sendHelenLetter(db: DatabaseSync, userId: number, now: number): TendResult {
  return tx(db, (): TendResult => {
    const s = loadForUpdate(db, "user_id", userId, now)!;
    const found = foundIds(db, s.id);
    if (found.includes("helen-forwarded")) return { ok: true };
    if (!found.includes("helen-letter") || !found.includes("convoy-manifest"))
      return { ok: false, status: 409, reason: "Recover the convoy manifest and Helen's envelope first." };
    if (s.journey) return { ok: false, status: 409, reason: "Return home to hand the envelope to the Kell walkers." };
    const added = db.prepare("INSERT OR IGNORE INTO discoveries (shelter_id, fragment_id, journey_id, found_at) VALUES (?, 'helen-forwarded', NULL, ?)").run(s.id, now);
    if (added.changes) log(db, s.id, now, "record", "You entrusted Helen's sealed letter to the Kell walkers for Ruth. Check the Workshop forwarding tin for her answer. Your journal keeps a record of the envelope.");
    return { ok: true };
  });
}
