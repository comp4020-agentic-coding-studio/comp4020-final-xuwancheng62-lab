import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it,expect } from 'vitest';
import { MIGRATIONS,openDb } from '../src/db.ts';
import { createShelter } from '../src/shelter.ts';
import { addResident } from '../src/character.ts';
import { joinParty } from '../src/parties.ts';
it('preserves existing seats on migration and allows another character from the same owner',()=>{
 const dir=mkdtempSync(join(tmpdir(),'holdout-multi-migration-')),old=new DatabaseSync(join(dir,'game.db')),now=1800000000000;
 for(const sql of MIGRATIONS.slice(0,-1))old.exec(sql);
 old.exec(`PRAGMA user_version=${MIGRATIONS.length-1}`);
 old.prepare("INSERT INTO users(id,username,password_hash,created_at) VALUES(1,'migration-player','x',?)").run(now);
 createShelter(old,1,'migration-player',now);const sid=(old.prepare('SELECT id FROM shelters WHERE user_id=1').get() as {id:number}).id;
 addResident(old,sid,'toby',now);
 // Seed the old schema directly: current application code expects all migrations.
 old.prepare("INSERT INTO parties(id,dungeon,leader_user_id,size,approach,retreat,seed,created_at,expires_at) VALUES(1,'freight-yard',1,2,'fight','half',1,?,?)").run(now,now+600000);
 old.prepare("INSERT INTO party_seats(party_id,user_id,shelter_id,character_id,row,joined_at) SELECT 1,1,?,id,'front',? FROM characters WHERE shelter_id=? AND who='you'").run(sid,now,sid);
 const before=old.prepare('SELECT * FROM party_seats').all();old.close();
 const db=openDb(dir);expect(db.prepare('SELECT * FROM party_seats').all()).toEqual(before);
 expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
 expect(joinParty(db,1,1,{who:'toby'},now).ok).toBe(true);
 expect(db.prepare('SELECT id FROM party_seats').all()).toHaveLength(2);db.close();
});
