import type { DatabaseSync } from "node:sqlite";
import { fragment, type FragmentId } from "./game/stories.ts";

// The records a shelter has found, oldest first. Private to that shelter.

export interface Found {
  id: FragmentId;
  at: number;
  journeyId: number | null;
}

export function foundRecords(db: DatabaseSync, shelterId: number): Found[] {
  const rows = db
    .prepare("SELECT fragment_id, found_at, journey_id FROM discoveries WHERE shelter_id = ? ORDER BY found_at, id")
    .all(shelterId) as { fragment_id: string; found_at: number; journey_id: number | null }[];
  // a record dropped from the game later is skipped, not an error
  return rows.filter((r) => fragment(r.fragment_id)).map((r) => ({ id: r.fragment_id as FragmentId, at: r.found_at, journeyId: r.journey_id }));
}

export const foundIds = (db: DatabaseSync, shelterId: number): FragmentId[] => foundRecords(db, shelterId).map((f) => f.id);
