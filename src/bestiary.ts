import type { DatabaseSync } from "node:sqlite";
import { bestiaryEntry, type BestiaryId } from "./game/bestiary.ts";

// Called within the shelter/party transaction. A card is permanent and unique.
export function discoverEnemy(db: DatabaseSync, shelterId: number, id: string, at: number, journeyId: number): void {
  if (!bestiaryEntry(id)) return;
  db.prepare("INSERT OR IGNORE INTO enemy_discoveries (shelter_id, enemy_id, first_seen, journey_id) VALUES (?, ?, ?, ?)").run(shelterId, id, at, journeyId);
}
export function knownEnemies(db: DatabaseSync, shelterId: number): BestiaryId[] {
  return (db.prepare("SELECT enemy_id FROM enemy_discoveries WHERE shelter_id = ? ORDER BY first_seen, enemy_id").all(shelterId) as { enemy_id: BestiaryId }[]).map(e => e.enemy_id);
}
