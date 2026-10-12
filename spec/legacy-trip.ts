import { depart as currentDepart, loadShelter } from '../src/shelter.ts';
import { carry, keener } from '../src/game/character.ts';
import { destination, rollFound } from '../src/game/world.ts';
import { BEAST } from '../src/game/config.ts';
// These fixtures simulate pending journeys created by the previous release.
// New trips are covered in solo.test.ts; legacy fights must remain finishable.
export const legacyDepart: typeof currentDepart = (db, ...args) => {
  const result = currentDepart(db, ...args);
  if (result.ok) {
    const j=db.prepare('SELECT id, target_id, encounter_at, character_id FROM journeys ORDER BY id DESC LIMIT 1').get() as {id:number;target_id:string;encounter_at:number|null;character_id:number};
    db.prepare("UPDATE journeys SET outcome_json = NULL, encounter_at = CASE WHEN target_id='nest' THEN encounter_at ELSE NULL END WHERE id = ?").run(j.id);
    if(j.target_id==='nest' && j.encounter_at!==null){
      const s=loadShelter(db,args[0],args[2]);
      const c=s.crew.find(m=>m.id===j.character_id)!.character;
      const haul=carry(keener(rollFound(destination('nest')!,j.id),c.traits.keen),c.capacity).carried;
      db.prepare('INSERT INTO encounters(journey_id,shelter_id,character_id,beast_hp,carried_json) VALUES (?,?,?,?,?)').run(j.id,s.id,c.id,BEAST.hp,JSON.stringify(haul));
    }
  }
  return result;
};
