// Local testing only: adds two neighbour shelters to the database in DATA_DIR,
// one with its owner home and well stocked, one out on a trip and running low.
// Log in as either with password "neighbour".
import { hashPassword } from "../src/auth.ts";
import { openDb, tx } from "../src/db.ts";
import { createShelter } from "../src/shelter.ts";
import { planJourney, destination } from "../src/game/world.ts";

const dir = process.env.DATA_DIR;
if (!dir || dir === "/data") {
  console.error("Set DATA_DIR to a local folder (e.g. DATA_DIR=./data). This never touches the live volume.");
  process.exit(1);
}

const db = openDb(dir);
const now = Date.now();
const neighbours = [
  { name: "marta", stock: { food: 64, water: 52, power: 30, scrap: 41 }, away: null },
  { name: "kofi", stock: { food: 6, water: 18, power: 9, scrap: 3 }, away: "workshop" },
];

for (const n of neighbours) {
  if (db.prepare("SELECT 1 FROM users WHERE username = ?").get(n.name)) {
    console.log(`${n.name} already exists`);
    continue;
  }
  tx(db, () => {
    const { lastInsertRowid } = db
      .prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)")
      .run(n.name, hashPassword("neighbour"), now);
    const userId = Number(lastInsertRowid);
    createShelter(db, userId, n.name, now);
    const { food, water, power, scrap } = n.stock;
    db.prepare("UPDATE shelters SET food = ?, water = ?, power = ?, scrap = ? WHERE user_id = ?").run(food, water, power, scrap, userId);
    if (n.away) {
      const t = planJourney(destination(n.away)!, now - 30_000);
      db.prepare(
        `INSERT INTO journeys (shelter_id, target_kind, target_id, action, departed_at, arrive_at, explore_until, return_at)
         SELECT id, 'location', ?, 'scavenge', ?, ?, ?, ? FROM shelters WHERE user_id = ?`,
      ).run(n.away, t.departedAt, t.arriveAt, t.exploreUntil, t.returnAt, userId);
    }
  });
  console.log(`added ${n.name}${n.away ? ` (out at the ${n.away})` : " (home)"}`);
}
