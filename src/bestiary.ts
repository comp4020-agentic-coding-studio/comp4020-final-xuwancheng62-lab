import { log } from "./shelter.ts";
import type { DatabaseSync } from "node:sqlite";
import { bestiaryEntry, type BestiaryId } from "./game/bestiary.ts";

// Called within the shelter/party transaction. A card is permanent and unique.
export function discoverEnemy(db: DatabaseSync, shelterId: number, id: string, at: number, journeyId: number): void {
  if (!bestiaryEntry(id)) return;
  const added=db.prepare("INSERT OR IGNORE INTO enemy_discoveries (shelter_id, enemy_id, first_seen, journey_id) VALUES (?, ?, ?, ?)").run(shelterId, id, at, journeyId);
  if(added.changes===1) log(db,shelterId,at,"enemy-card",`Discovered enemy card: ${bestiaryEntry(id)!.name}. Added to your field guide.`);
}
export function knownEnemies(db: DatabaseSync, shelterId: number): BestiaryId[] {
  return (db.prepare("SELECT enemy_id FROM enemy_discoveries WHERE shelter_id = ? ORDER BY first_seen, enemy_id").all(shelterId) as { enemy_id: BestiaryId }[]).map(e => e.enemy_id);
}

// Backfill existing permanent discoveries without inventing encounters.
export function settleEnemyCardLog(db:DatabaseSync,shelterId:number):void{
 const rows=db.prepare('SELECT enemy_id,first_seen FROM enemy_discoveries WHERE shelter_id=?').all(shelterId) as {enemy_id:string;first_seen:number}[];
 for(const row of rows){
  const entry=bestiaryEntry(row.enemy_id);if(!entry)continue;
  const message=`Discovered enemy card: ${entry.name}. Added to your field guide.`;
  if(!db.prepare("SELECT 1 FROM activity_log WHERE shelter_id=? AND kind='enemy-card' AND message=?").get(shelterId,message))log(db,shelterId,row.first_seen,'enemy-card',message);
 }
}
