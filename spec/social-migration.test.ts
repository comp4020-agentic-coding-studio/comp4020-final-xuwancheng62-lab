import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { openDb, tx } from '../src/db.ts';
import { createShelter, loadShelter } from '../src/shelter.ts';
import { createParty, leaveSeat } from '../src/parties.ts';
it('upgrades an old gathering party, refunds reserved rations once and preserves its members', () => {
  const dir = mkdtempSync(join(tmpdir(), 'holdout-upgrade-'));
  let db = openDb(dir);
  const now = 1800000000000;
  const id = tx(db, () => {
    const id = Number(db.prepare("INSERT INTO users(username,password_hash,created_at) VALUES ('upgrade','x',?)").run(now).lastInsertRowid);
    createShelter(db, id, 'upgrade', now); return id;
  });
  const before = loadShelter(db, id, now).stock;
  const p = createParty(db, id, { dungeon: 'freight-yard', size: '3', approach: 'sneak', retreat: 'half' }, now) as { partyId: number };
  // Reconstruct the precise previous schema and its outstanding reservation.
  db.exec(`DROP TABLE facilities; ALTER TABLE shelters DROP COLUMN gate_hp; ALTER TABLE shelters DROP COLUMN siege_at; DROP TABLE enemy_discoveries; DROP TABLE social_reads; DROP TABLE social_messages; DROP TABLE party_invites;
    ALTER TABLE parties DROP COLUMN definition_json; PRAGMA user_version = 15;
    UPDATE party_seats SET food = 5, water = 5;
    UPDATE shelters SET food = food - 5, water = water - 5;`);
  db.close(); db = openDb(dir);
  expect(loadShelter(db, id, now).stock).toEqual(before);
  expect(db.prepare('SELECT food,water FROM party_seats').get()).toEqual({ food: 0, water: 0 });
  expect(leaveSeat(db, id, p.partyId, null, now).ok).toBe(true);
  db.close(); db = openDb(dir);
  expect(loadShelter(db, id, now).stock).toEqual(before);
  db.close();
});
