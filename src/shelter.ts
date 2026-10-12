import { BASE } from "./game/config.ts";
import { gateDefence, gateMax, type BaseState } from "./game/base.ts";
import { readBase, saveBase } from "./base.ts";
import { discoverEnemy } from "./bestiary.ts";
import { dungeon } from "./game/dungeons.ts";
import type { DatabaseSync } from "node:sqlite";
import { CHARACTER, TIME_SCALE, GREENHOUSE, RAID, RESIDENTS, STARTING_STOCK, USES, XP, type Crop, type ResidentId, type Who } from "./game/config.ts";
import { carry, keener, type Haul } from "./game/character.ts";
import { settle, type GrowingPlot, type Hand, type Stock } from "./game/resources.ts";
import { destination, journeyPhase, planJourney, rollFound, rollOutcome, type JourneyTimes, type Outcome, type Phase } from "./game/world.ts";
import { addSupply, awardXp, capacityOf, createCharacter, crewRows, levelNote, nameOf, stashOf, traitsOf, settleCharacter, toughen, wordsFor, type Character, type CharacterRow, type Task } from "./character.ts";
import { encounterRow, encounterView, isOpen, type EncounterView } from "./encounter.ts";
import { BEAST } from "./game/config.ts";
import { defaultFocus, fragment, LOOK_AROUND, openLeads, pickFragment, type FragmentId } from "./game/stories.ts";
import { foundIds } from "./stories.ts";
import { settleCollections } from "./collections.ts";
import { defence, type Guard } from "./game/raid.ts";
import { findOnTrip } from "./items.ts";
import { partyRow, expireParties, musteringSeat, partyOfMember, settleSeat } from "./parties.ts";
import type { Gear, Supplies } from "./game/items.ts";
import { tx } from "./db.ts";

interface ShelterRow extends Stock {
  id: number;
  user_id: number;
  name: string;
  settled_at: number;
  owner: string;
  portrait: number;
  combat_power: number;
  raid_shield_until: number;
  gate_hp: number;
  siege_at: number;
}

interface JourneyRow {
  id: number;
  character_id: number;
  target_kind: string;
  target_id: string;
  action: string;
  departed_at: number;
  arrive_at: number;
  explore_until: number;
  return_at: number;
  encounter_at: number | null;
  fragment_id: string | null;
  party_id: number | null;
}

export interface ActiveJourney {
  id: number;
  raid: boolean;
  targetId: string;
  destinationName: string;
  phase: Exclude<Phase, "done">;
  label: string;
  until: number;
  times: JourneyTimes;
  // the beast, on a trip to the Nest: met at times.encounterAt
  encounter: EncounterView | null;
  // the record this trip turned up, once you've got there
  found: { id: FragmentId; title: string } | null;
  // an expedition: its party, revealed as the clock passes
  partyId: number | null;
}

export interface Plot {
  slot: number;
  crop: Crop | null;
  plantedAt: number;
  readyAt: number;
  ready: boolean;
}

// Who's home to defend the shelter, and how (src/game/raid.ts).
export const guardsOf = (s: Pick<ShelterView, "crew">): Guard[] =>
  s.crew.filter((m) => !m.journey).map((m) => ({ combat: m.character.combat, weapon: m.character.gear.weapon, working: m.who !== "you" && m.task === "work" }));

// How hard the shelter is to rob right now: who's home, neighbours'
// reinforcements, and a taped seal.
export const defenceOf = (s: Pick<ShelterView, "crew" | "reinforces" | "taped"> & Partial<Pick<ShelterView,"base"|"gateHp">>): number =>
  defence(guardsOf(s), s.reinforces, (s.taped ? USES.tape.defence : 0) + (s.base ? gateDefence(s.base,s.gateHp??0):0));

// Someone in the shelter: you, or someone who's joined you.
export interface Member {
  id: number;
  who: Who;
  name: string;
  task: Task;
  character: Character;
  journey: ActiveJourney | null;
  // a party they're packed for or out with, and who sent them if it wasn't you
  party: { mustering: boolean; sentBy: string | null } | null;
}

export interface ShelterView {
  base: BaseState;
  gateHp: number;
  siegeAt: number;
  id: number;
  userId: number;
  owner: string;
  portrait: number;
  name: string;
  stock: Stock;
  // your trip, and your survivor; everyone, you first, is in `crew`
  journey: ActiveJourney | null;
  combatPower: number;
  shieldUntil: number;
  reinforces: number;
  // the hatch seal taped with duct tape (PLAN.md, "Items")
  taped: boolean;
  // what's at home that nobody is holding
  stash: { gear: Gear[]; supplies: Supplies };
  plots: Plot[];
  growing: number;
  character: Character;
  crew: Member[];
  // is anyone home to keep watch?
  anyoneHome: boolean;
  // who lives here besides you, and whether they're home on work now
  residents: Hand[];
}

export interface LogEntry {
  at: number;
  kind: string;
  message: string;
}

const PHASE_LABEL = { traveling: "Traveling", exploring: "Exploring", encounter: "In a fight", returning: "Returning" } as const;

const times = (j: JourneyRow): JourneyTimes => ({
  departedAt: j.departed_at,
  arriveAt: j.arrive_at,
  exploreUntil: j.explore_until,
  returnAt: j.return_at,
  encounterAt: j.encounter_at,
});

const stockOf = (r: ShelterRow): Stock => ({ food: r.food, water: r.water, power: r.power, scrap: r.scrap });

export function createShelter(db: DatabaseSync, userId: number, username: string, now: number): void {
  const s = STARTING_STOCK;
  const { lastInsertRowid } = db
    .prepare("INSERT INTO shelters (user_id, name, food, water, power, scrap, settled_at, combat_power) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(userId, `${username}'s shelter`, s.food, s.water, s.power, s.scrap, now, RAID.startingCombat);
  createCharacter(db, Number(lastInsertRowid), now);
  log(db, Number(lastInsertRowid), now, "info", "You seal the hatch behind you. This is home now.");
}

export function log(
  db: DatabaseSync,
  shelterId: number,
  at: number,
  kind: string,
  message: string,
  related: { shelterId?: number; interactionId?: number } = {},
): LogEntry {
  db.prepare("INSERT INTO activity_log (shelter_id, at, kind, message, related_shelter_id, interaction_id) VALUES (?, ?, ?, ?, ?, ?)").run(
    shelterId, at, kind, message, related.shelterId ?? null, related.interactionId ?? null,
  );
  return { at, kind, message };
}

function describe(o: Outcome, place: string): string {
  const got = Object.entries(o.loot).map(([k, n]) => `+${n} ${k[0].toUpperCase()}${k.slice(1)}`);
  if (o.result === "empty") return `Returned from ${place} empty-handed. Something drove you off.`;
  const haul = got.length ? got.join(", ") : "nothing worth carrying";
  return o.result === "hurt"
    ? `Returned from ${place} bruised, dropping half the haul: ${haul}.`
    : `Returned from ${place}: ${haul}.`;
}

const shelterName = (db: DatabaseSync, id: string): string =>
  (db.prepare("SELECT name FROM shelters WHERE id = ?").get(Number(id)) as { name: string } | undefined)?.name ?? "another shelter";

export function loadShelter(db: DatabaseSync, userId: number, now: number): ShelterView {
  return tx(db, () => loadForUpdate(db, "user_id", userId, now)!);
}

export function loadShelterById(db: DatabaseSync, shelterId: number, now: number): ShelterView | null {
  return tx(db, () => loadForUpdate(db, "id", shelterId, now));
}

// Other players' shelters, newest first. Accounts made by the spec run against
// the live app are left out so they don't crowd real players.
export function listSurvivors(db: DatabaseSync, exceptUserId: number, now: number, limit = 12): ShelterView[] {
  const rows = db
    .prepare(
      `SELECT shelters.id FROM shelters JOIN users ON users.id = shelters.user_id
       WHERE users.id != ? AND users.username NOT LIKE 'spec\\_%' ESCAPE '\\'
       ORDER BY users.created_at DESC LIMIT ?`,
    )
    .all(exceptUserId, limit) as { id: number }[];
  return rows.map((r) => loadShelterById(db, r.id, now)!);
}

// Who's at home doing their work over a stretch of time: residents on work
// who aren't on a trip that's still open.
const handsOf = (rows: CharacterRow[], away: ReadonlySet<number>): Hand[] =>
  rows.filter((c) => c.who !== "you" && c.who in RESIDENTS).map((c) => ({ who: c.who as ResidentId, working: c.task === "work" && !away.has(c.id) }));

const subject = (c: CharacterRow): string => (c.who === "you" ? "" : `${RESIDENTS[c.who as ResidentId]?.name ?? c.who}: `);

// Brings a shelter up to `now` — resolves each finished trip at its return
// time, in order, then settles resources — and writes the result back. Must
// run inside a transaction; callers that change two shelters at once use it
// directly.
export function loadForUpdate(db: DatabaseSync, column: "user_id" | "id", value: number, now: number): ShelterView | null {
  // parties that never filled give their rations back first, before this
  // shelter's stock is read
  expireParties(db, now);
  const row = db
    .prepare(`SELECT shelters.*, users.username AS owner, users.portrait FROM shelters JOIN users ON users.id = shelters.user_id WHERE shelters.${column} = ?`)
    .get(value) as unknown as ShelterRow | undefined;
  if (!row) return null;
  const base=readBase(db,row.id);
  let arrowStock=stashOf(db,row.id).supplies.arrow??0;
  let stock = stockOf(row);
  let settledAt = row.settled_at;
  const planted = db
    .prepare("SELECT slot, crop, planted_at, ready_at FROM crop_plots WHERE shelter_id = ?")
    .all(row.id) as { slot: number; crop: Crop; planted_at: number; ready_at: number }[];
  const growing: GrowingPlot[] = planted.map((p) => ({ plantedAt: p.planted_at, readyAt: p.ready_at }));
  let crew = crewRows(db, row.id);
  if (!crew.some((c) => c.who === "you")) {
    createCharacter(db, row.id, now);
    crew = crewRows(db, row.id);
  }
  const open = db.prepare("SELECT * FROM journeys WHERE shelter_id = ? AND resolved_at IS NULL ORDER BY return_at, id").all(row.id) as unknown as JourneyRow[];

  // what happens on each trip as it's reached: the beast appearing, and the
  // record, which is yours the moment you arrive, before anything can go
  // wrong out there, so no roll, beast or defeat can take it back
  let firstArrival = now;
  for (const j of open) {
    const c = crew.find((x) => x.id === j.character_id);
    const enc = j.encounter_at != null ? encounterRow(db, j.id) : undefined;
    if (enc && isOpen(enc.state) && !enc.announced && now >= j.encounter_at!) {
      log(db, row.id, j.encounter_at!, "danger", `${c ? subject(c) : ""}A ${BEAST.name.toLowerCase()} rose out of the junk at the ${destination(j.target_id)?.name ?? "nest"}, guarding its hoard. Fight it, or try to slip away.`);
      db.prepare("UPDATE encounters SET announced = 1 WHERE id = ?").run(enc.id);
    }
    if (enc && now >= j.encounter_at!) discoverEnemy(db, row.id, "scavenger", j.encounter_at!, j.id);
    if (j.party_id) {
      const p = partyRow(db, j.party_id);
      const sightings = p?.result_json ? (JSON.parse(p.result_json).sightings ?? []) as { id: string; at: number }[] : [];
      for (const sighting of sightings) {
        const at = j.departed_at + sighting.at / TIME_SCALE;
        if (now >= at) discoverEnemy(db, row.id, sighting.id, at, j.id);
      }
    }
    if (j.fragment_id && now >= j.arrive_at) {
      const f = fragment(j.fragment_id);
      const added = db
        .prepare("INSERT OR IGNORE INTO discoveries (shelter_id, fragment_id, journey_id, found_at) VALUES (?, ?, ?, ?)")
        .run(row.id, j.fragment_id, j.id, j.arrive_at);
      if (f && added.changes === 1) {
        log(db, row.id, j.arrive_at, "record", `${c ? subject(c) : ""}At the ${destination(j.target_id)?.name ?? "wasteland"} ${c ? wordsFor(c.who).they : "you"} found: ${f.title}. It's in your journal.`);
        firstArrival = Math.min(firstArrival, j.arrive_at);
      }
    }
  }
  // a collection completed by any record, now or before collections existed,
  // pays its reward once
  settleCollections(db, row.id, foundIds(db, row.id), firstArrival);

  // trips that are over come home in the order they end; between those
  // moments, stock settles with whoever was home working
  const advance = (until:number, hands:Hand[]) => {
    const result=settle(stock,settledAt,until,growing,hands,base,arrowStock);
    stock=result.stock;settledAt=result.settledAt;
    if(result.base) Object.assign(base,result.base);
    if(result.arrows) {addSupply(db,row.id,"arrow",result.arrows,until);arrowStock+=result.arrows;}
  };
  const away = new Set(open.map((j) => j.character_id));
  const still: JourneyRow[] = [];
  for (const j of open) {
    const enc = j.encounter_at != null ? encounterRow(db, j.id) : undefined;
    if (journeyPhase(times(j), now, Boolean(enc && isOpen(enc.state))).phase !== "done") {
      still.push(j);
      continue;
    }
    const c = crew.find((x) => x.id === j.character_id);
    advance(j.return_at,handsOf(crew,away));
    away.delete(j.character_id);
    if (c) stock = resolveTrip(db, row.id, c, j, enc, stock);
    else db.prepare("UPDATE journeys SET resolved_at = ? WHERE id = ?").run(j.return_at, j.id);
  }

  advance(now,handsOf(crew,away));
  saveBase(db,row.id,base);
  db.prepare("UPDATE shelters SET food = ?, water = ?, power = ?, scrap = ?, settled_at = ? WHERE id = ?").run(
    stock.food, stock.water, stock.power, stock.scrap, settledAt, row.id,
  );

  crew = crewRows(db, row.id);
  const members: Member[] = crew.map((c) => {
    const j = still.find((x) => x.character_id === c.id);
    const journey = j ? activeJourney(db, j, now) : null;
    const character = settleCharacter(db, c, !journey, now);
    return { id: c.id, who: character.who, name: character.name, task: c.task, character, journey, party: partyOfMember(db, c.id, journey?.partyId ?? null) };
  });
  const you = members.find((m) => m.who === "you")!;
  const { n: reinforces } = db
    .prepare("SELECT COUNT(*) AS n FROM buffs WHERE shelter_id = ? AND kind = 'reinforced' AND expires_at > ?")
    .get(row.id, now) as { n: number };
  // Upgraded doors attract periodic scavengers. Timestamp settlement, no timer;
  // at most one siege per read after an absence, so offline losses cannot stack.
  let gateHp=row.gate_hp, siegeAt=row.siege_at;
  if(base.gate.tier>1 && siegeAt>0 && now-siegeAt>=BASE.siegeIntervalMs) {
    const defended=members.some(m=>!m.journey);
    const damage=defended?BASE.siegeDamage/2:BASE.siegeDamage;
    const held=gateHp>=damage;
    gateHp=Math.max(0,gateHp-damage);siegeAt=now;
    if(!held) for(const k of ["food","water","scrap"] as const) stock[k]=Math.max(Math.min(stock[k],RAID.protectedMin),stock[k]-BASE.siegeLoss);
    db.prepare("UPDATE shelters SET gate_hp=?,siege_at=?,food=?,water=?,scrap=? WHERE id=?").run(gateHp,siegeAt,stock.food,stock.water,stock.scrap,row.id);
    log(db,row.id,now,"danger",held?`Wasteland creatures tested the vault door. It held; ${damage} door damage.`:"Wasteland creatures breached the damaged door and took some supplies. Repair it at home.");
  }
  return {
    base,gateHp,siegeAt,
    character: you.character,
    crew: members,
    anyoneHome: members.some((m) => !m.journey),
    residents: handsOf(crew, new Set(still.map((j) => j.character_id))),
    id: row.id,
    userId: row.user_id,
    owner: row.owner,
    portrait: row.portrait,
    name: row.name,
    stock,
    journey: you.journey,
    combatPower: you.character.combat,
    shieldUntil: row.raid_shield_until,
    reinforces,
    stash: stashOf(db, row.id),
    taped: Boolean(db.prepare("SELECT 1 FROM buffs WHERE shelter_id = ? AND kind = 'taped' AND expires_at > ?").get(row.id, now)),
    growing: growing.filter((g) => g.plantedAt <= now && now < g.readyAt).length,
    plots: Array.from({ length: GREENHOUSE.plots }, (_, slot) => {
      const p = planted.find((x) => x.slot === slot);
      return p
        ? { slot, crop: p.crop, plantedAt: p.planted_at, readyAt: p.ready_at, ready: now >= p.ready_at }
        : { slot, crop: null, plantedAt: 0, readyAt: 0, ready: false };
    }),
  };
}

function activeJourney(db: DatabaseSync, j: JourneyRow, now: number): ActiveJourney {
  const enc = j.encounter_at != null ? encounterRow(db, j.id) : undefined;
  const t = times(j);
  const p = journeyPhase(t, now, Boolean(enc && isOpen(enc.state)));
  const raid = j.target_kind === "shelter";
  const phase = p.phase as ActiveJourney["phase"];
  return {
    id: j.id,
    raid,
    targetId: j.target_id,
    encounter: enc ? encounterView(db, enc) : null,
    found: j.fragment_id && now >= j.arrive_at && fragment(j.fragment_id) ? { id: j.fragment_id as FragmentId, title: fragment(j.fragment_id)!.title } : null,
    destinationName: raid ? shelterName(db, j.target_id) : j.target_kind === "party" ? (dungeon(j.target_id)?.name ?? j.target_id) : (destination(j.target_id)?.name ?? j.target_id),
    partyId: j.party_id ?? null,
    phase,
    label: raid ? "Raiding" : PHASE_LABEL[phase],
    until: p.until,
    times: t,
  };
}

// One trip home: supplies into the shelter's stock; experience, gear and
// toughness to whoever went.
function resolveTrip(db: DatabaseSync, shelterId: number, c: CharacterRow, j: JourneyRow, enc: ReturnType<typeof encounterRow>, stock: Stock): Stock {
  const who = subject(c);
  // recovery starts the moment they're back
  db.prepare("UPDATE characters SET hp_at = MAX(hp_at, ?) WHERE id = ?").run(j.return_at, c.id);
  if (j.target_kind === "party") return settleSeat(db, shelterId, c, j, stock);
  if (j.target_kind === "shelter") {
    db.prepare("UPDATE journeys SET resolved_at = ? WHERE id = ?").run(j.return_at, j.id);
    log(db, shelterId, j.return_at, "info", `${who}Back home from ${shelterName(db, j.target_id)}.`);
    return stock;
  }
  const d = destination(j.target_id);
  if (enc) {
    // the fight already settled what's carried; it's deposited only now
    const carried: Haul = JSON.parse(enc.carried_json);
    for (const [k, n] of Object.entries(carried)) stock[k as keyof Stock] += n ?? 0;
    const got = Object.entries(carried).map(([k, n]) => `+${n} ${k[0].toUpperCase()}${k.slice(1)}`);
    let message: string;
    if (enc.state === "defeated") message = `${who}Limped home from the ${d?.name ?? "wasteland"} with nothing. Rest up before going out again.`;
    else {
      const xp = awardXp(db, c.id, XP.trip[j.target_id] ?? 0);
      message = `${who}Back from the ${d?.name ?? "wasteland"}: ${got.length ? got.join(", ") : "nothing worth carrying"}.${findOnTrip(db, shelterId, j.target_id, j.id, j.return_at)} +${XP.trip[j.target_id] ?? 0} XP.${levelNote(xp)}`;
    }
    db.prepare("UPDATE journeys SET resolved_at = ?, outcome_json = ? WHERE id = ?").run(j.return_at, JSON.stringify({ result: enc.state, loot: carried }), j.id);
    log(db, shelterId, j.return_at, enc.state === "defeated" ? "danger" : "loot", message);
    return stock;
  }
  const rolled: Outcome = d ? rollOutcome(d, j.id) : { result: "empty", loot: {} };
  // a trip brings home only what its traveller can carry
  // a keen eye adds to what was there to find; the pack still limits it
  const { carried, left } = carry(keener(rolled.loot, traitsOf(db, c.id).keen), capacityOf(db, c.id));
  const outcome: Outcome = { result: rolled.result, loot: carried };
  for (const [k, n] of Object.entries(outcome.loot)) stock[k as keyof Stock] += n;
  let message = who + describe(outcome, d?.name ?? "the wasteland");
  if (left > 0) message += ` ${c.who === "you" ? "You" : nameOf(c.who)} had to leave ${left} behind: the pack was full.`;
  // surviving the nest is what makes you harder to rob, and better at robbing
  if (d?.id === "nest" && outcome.result !== "empty" && c.combat < RAID.maxCombat) {
    message += ` ${c.who === "you" ? "You come" : `${nameOf(c.who)} comes`} back tougher: combat ${toughen(db, c.id)}.`;
  }
  // supplies and the odd piece of equipment, by place (the Workshop
  // always has a crowbar for a shelter with no weapon left)
  if (d && outcome.result !== "empty") message += findOnTrip(db, shelterId, d.id, j.id, j.return_at);
  if (d) {
    const xp = awardXp(db, c.id, XP.trip[d.id] ?? 0);
    message += ` +${XP.trip[d.id] ?? 0} XP.${levelNote(xp)}`;
  }
  db.prepare("UPDATE journeys SET resolved_at = ?, outcome_json = ? WHERE id = ?").run(j.return_at, JSON.stringify(outcome), j.id);
  log(db, shelterId, j.return_at, outcome.result === "clean" ? "loot" : "danger", message);
  return stock;
}

export type DepartResult = { ok: true; shelterId: number } | { ok: false; status: 400 | 404 | 409; reason: string };

// `focus` is what to look for there: a lead you've opened, "look" to look
// around, or undefined for the default. It only steers which record is
// found. `who` is who goes: you, or someone who lives here.
export function depart(db: DatabaseSync, userId: number, destinationId: string, now: number, focus?: string, who: string = "you"): DepartResult {
  const d = destination(destinationId);
  if (!d) return { ok: false, status: 400, reason: "That place isn't on any map." };
  try {
    return tx(db, (): DepartResult => {
      const shelter = loadForUpdate(db, "user_id", userId, now)!;
      const m = shelter.crew.find((x) => x.who === (who || "you"));
      if (!m) return { ok: false, status: 404, reason: "Nobody by that name lives here." };
      const you = m.who === "you";
      if (m.journey) return { ok: false, status: 409, reason: you ? "You're already out there." : `${m.name}'s already out there.` };
      if (musteringSeat(db, m.id)) return { ok: false, status: 409, reason: `${you ? "You're" : `${m.name}'s`} waiting on an expedition party. Leave it first.` };
      const c = m.character;
      if (c.hp < CHARACTER.travelMinHp) {
        return { ok: false, status: 409, reason: `${you ? "You're" : `${m.name}'s`} too hurt to travel (${c.hp} HP). Rest at the shelter until ${you ? "you have" : `${wordsFor(m.who).they} has`} ${CHARACTER.travelMinHp}.` };
      }
      // every timestamp is fixed now, from the Agility they leave with
      const t = planJourney(d, now, c.agility);
      // the record is picked now, once, like everything else about the trip
      const found = foundIds(db, shelter.id);
      const aim = focus === LOOK_AROUND || openLeads(found, d.id).some((l) => l.lead.id === focus) ? focus! : defaultFocus(found, d.id);
      let record = pickFragment(found, d.id, aim);
      // some leads take something with you; one you can't pay for turns up nothing
      const costly = openLeads(found, d.id).find((l) => l.lead.fragment === record && l.lead.cost)?.lead;
      if (costly) {
        const paid = db.prepare("UPDATE shelters SET scrap = scrap - ? WHERE id = ? AND scrap >= ?").run(costly.cost!.scrap, shelter.id, costly.cost!.scrap);
        if (paid.changes !== 1) {
          if (aim === costly.id) return { ok: false, status: 409, reason: `${costly.costWhy ?? "You can't afford that."} You have ${Math.floor(shelter.stock.scrap)}.` };
          record = null;
        }
      }
      // someone there calls the dogs off: no beast on the trip that finds it
      const beast = d.beast && !(record && fragment(record)?.calm);
      const { lastInsertRowid } = db.prepare(
        `INSERT INTO journeys (shelter_id, character_id, target_kind, target_id, action, departed_at, arrive_at, explore_until, return_at, encounter_at, fragment_id, focus)
         VALUES (?, ?, 'location', ?, 'scavenge', ?, ?, ?, ?, ?, ?, ?)`,
      ).run(shelter.id, m.id, d.id, t.departedAt, t.arriveAt, t.exploreUntil, t.returnAt, beast ? (t.encounterAt ?? null) : null, record, record ? aim : null);
      if (beast) {
        // what they'll have found by the time the beast appears, as much as they can carry
        const haul = carry(keener(rollFound(d, Number(lastInsertRowid)), c.traits.keen), c.capacity).carried;
        db.prepare("INSERT INTO encounters (journey_id, shelter_id, character_id, beast_hp, carried_json) VALUES (?, ?, ?, ?, ?)").run(Number(lastInsertRowid), shelter.id, m.id, BEAST.hp, JSON.stringify(haul));
      }
      const left = shelter.crew.filter((x) => x.id !== m.id && !x.journey);
      const guard = left.length ? `${left.map((x) => (x.who === "you" ? "You're" : `${x.name}'s`)).join(" and ")} keeping watch.` : "Nobody is home to guard it.";
      log(db, shelter.id, now, "depart", `${you ? "You" : m.name} left the shelter for the ${d.name}. ${guard}`);
      return { ok: true, shelterId: shelter.id };
    });
  } catch {
    // the partial unique index caught a second concurrent departure
    return { ok: false, status: 409, reason: "Already out there." };
  }
}

export function recentLog(db: DatabaseSync, shelterId: number, limit = 30): LogEntry[] {
  return db
    .prepare("SELECT at, kind, message FROM activity_log WHERE shelter_id = ? ORDER BY at DESC, id DESC LIMIT ?")
    .all(shelterId, limit) as unknown as LogEntry[];
}
