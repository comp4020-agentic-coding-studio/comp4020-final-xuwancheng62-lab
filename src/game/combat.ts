import { CLUBBED, COMBAT, ENEMIES, GEAR, SUPPLIES, type Attack, type EnemyId, type SupplyKind, type Trait } from "./config.ts";
import { between, effective, type Body, type Loadout, type Rng, type Supplies } from "./items.ts";

// The combat resolver (PLAN.md, "Combat"): sides of any size, fought in
// rounds, every roll from a seeded generator, so the same party, enemies and
// seed always give the same fight. Party fights run on their own; the solo
// Nest fight uses the same numbers one blow at a time (src/game/character.ts).

export type Row = "front" | "back";

// Who goes, as they leave: their own numbers and what they carry.
export interface PartyMember {
  key: string;
  name: string;
  who: string;
  hp: number;
  body: Body;
  gear: Loadout;
  belt: Supplies;
  pack: Supplies;
  row: Row;
}

export interface Fighter {
  key: string;
  name: string;
  side: "party" | "enemy";
  row: Row;
  hp: number;
  maxHp: number;
  armour: number;
  speed: number;
  traits: Partial<Record<Trait, number>>;
  // attacking
  damage: [number, number];
  club: [number, number];
  range: "melee" | "reach" | "ranged";
  ammoKind?: SupplyKind;
  pierce: number;
  targets: number;
  vsArmour: number;
  stagger: number;
  noise: number;
  backblast: number;
  oncePerFight: boolean;
  used: boolean; // this fight's one shot, for a launcher
  // defending
  sealed: boolean;
  filter: boolean;
  lastSeal: boolean; // still to use
  // carried, and spent as the run goes
  belt: Supplies;
  pack: Supplies;
  shots: number;
  // enemies
  attack?: Attack;
  animal?: boolean;
  skip: number;
  hitYet: boolean;
}

export function memberFighter(m: PartyMember): Fighter {
  const e = effective(m.body, m.gear, m.pack);
  const w = m.gear.weapon ? GEAR[m.gear.weapon.kind] : undefined;
  return {
    key: m.key,
    name: m.name,
    side: "party",
    row: m.row,
    hp: Math.min(m.hp, e.maxHp),
    maxHp: e.maxHp,
    armour: e.armour,
    speed: e.agility + (w?.speed ?? 0) + (e.traits.quick ?? 0),
    traits: e.traits,
    // a ranged weapon's damage when it has ammo; otherwise it's a club
    damage: e.clubbing ? [CLUBBED[0] + e.strength, CLUBBED[1] + e.strength] : e.damage,
    club: [CLUBBED[0] + e.strength, CLUBBED[1] + e.strength],
    range: w?.range ?? "melee",
    ammoKind: e.ammo,
    pierce: (w?.pierce ?? 0) + (e.traits.piercing ?? 0),
    targets: (w?.targets ?? 1) + (e.traits.sweeping ?? 0),
    vsArmour: w?.vsArmour ?? 0,
    stagger: w?.stagger ?? 0,
    noise: Math.max(0, (w?.noise ?? 0) - (e.traits.hushed ?? 0)),
    backblast: w?.backblast ?? 0,
    oncePerFight: Boolean(w?.oncePerFight),
    used: false,
    sealed: Boolean(m.gear.armour && (GEAR[m.gear.armour.kind].sealed || m.gear.armour.traits.includes("sealed"))),
    filter: Boolean(m.gear.tool && GEAR[m.gear.tool.kind].filter),
    lastSeal: Boolean(e.traits.lastseal),
    belt: { ...m.belt },
    pack: { ...m.pack },
    shots: 0,
    skip: 0,
    hitYet: false,
  };
}

export function enemyFighter(id: EnemyId, n: number): Fighter {
  const d = ENEMIES[id];
  return {
    key: `${id}-${n}`,
    name: d.name,
    side: "enemy",
    row: "front",
    hp: d.hp,
    maxHp: d.hp,
    armour: d.armour,
    speed: d.speed,
    traits: {},
    damage: d.hit as [number, number],
    club: d.hit as [number, number],
    range: "melee",
    pierce: 0,
    targets: 1,
    vsArmour: 0,
    stagger: 0,
    noise: 0,
    backblast: 0,
    oncePerFight: false,
    used: false,
    sealed: false,
    filter: false,
    lastSeal: false,
    belt: {},
    pack: {},
    shots: 0,
    attack: d.attack,
    animal: d.kind === "animal",
    skip: 0,
    hitYet: false,
  };
}

const alive = (fs: readonly Fighter[]) => fs.filter((f) => f.hp > 0);
const pickOne = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
const has = (f: Fighter, k: SupplyKind) => (f.belt[k] ?? 0) > 0;
const spend = (f: Fighter, k: SupplyKind) => {
  f.belt[k] = (f.belt[k] ?? 0) - 1;
  if (!f.belt[k]) delete f.belt[k];
};

// The front row is whoever's standing in it; when it's all down, the back
// row is the front.
export const frontOf = (party: readonly Fighter[]): Fighter[] => {
  const up = alive(party);
  const front = up.filter((f) => f.row === "front");
  return front.length ? front : up;
};

// The party's chance to slip away or turn back: its slowest member, the
// noise it has made, smoke if anyone carries it, luck. Never certain.
export function escapeChance(party: readonly Fighter[], noise: number, smoke: boolean): number {
  const up = alive(party);
  if (!up.length) return 0;
  const c = COMBAT.escape;
  const slowest = Math.min(...up.map((f) => f.speed));
  const lucky = Math.max(0, ...up.map((f) => f.traits.lucky ?? 0));
  const pct = c.base + c.perAgility * (slowest - 5) - noise * COMBAT.noiseEscape + (smoke ? (SUPPLIES.smoke.escape ?? 0) : 0) + lucky;
  return Math.max(c.min, Math.min(c.max, Math.round(pct)));
}

// One escape roll; smoke on anyone's belt is lit for it.
export function tryEscape(rng: Rng, party: Fighter[], noise: number, log: string[], why: string): boolean {
  const smoker = alive(party).find((f) => has(f, "smoke"));
  if (smoker) {
    spend(smoker, "smoke");
    log.push(`${smoker.name} lit a smoke canister.`);
  }
  const pct = escapeChance(party, noise, Boolean(smoker));
  const ok = rng() * 100 < pct;
  log.push(ok ? `${why}: ${pct}%, and they made it.` : `${why}: ${pct}%, and it cut them off. No running now.`);
  return ok;
}

export type RetreatRule = "anyone" | "half" | "never";

// The blows of one round, told as one line; anything out of the ordinary
// (a fall, a heal, a flare, a wave) gets its own.
interface Tally {
  hits: Map<string, { dmg: number[]; down: number }>;
  bites: Map<string, Map<string, { n: number; total: number }>>;
  // said after the round's blows: who fell, or held on
  after: string[];
}
const newTally = (): Tally => ({ hits: new Map(), bites: new Map(), after: [] });
function hitTally(t: Tally, who: string, dmg: number, down: boolean) {
  const h = t.hits.get(who) ?? { dmg: [], down: 0 };
  h.dmg.push(dmg);
  if (down) h.down += 1;
  t.hits.set(who, h);
}
function biteTally(t: Tally, enemy: string, target: string, dmg: number, verb = "bit") {
  enemy = `${enemy}|${verb}`;
  const byEnemy = t.bites.get(enemy) ?? new Map();
  const b = byEnemy.get(target) ?? { n: 0, total: 0 };
  b.n += 1;
  b.total += dmg;
  byEnemy.set(target, b);
  t.bites.set(enemy, byEnemy);
}
function flush(t: Tally, round: number, log: string[]) {
  const parts: string[] = [];
  for (const [who, h] of t.hits) parts.push(`${who} ${h.dmg.join("+")}${h.down ? `, ${h.down} down` : ""}`);
  for (const [key, targets] of t.bites) {
    const [enemy, verb] = key.split("|");
    const many = [...targets.values()].reduce((a, b) => a + b.n, 0) > 1;
    // "The warden" is one machine; anything else is one of many
    const name = enemy.startsWith("The ") ? enemy : many && verb === "bit" ? `${enemy}s` : `A ${enemy.toLowerCase()}`;
    parts.push(`${name} ${verb} ${[...targets].map(([who, b]) => `${who}${b.n > 1 ? ` ${b.n}×` : ""} ${verb === "sprayed" ? "" : "for "}${b.total}`).join(", ")}`);
  }
  if (parts.length) log.push(`Round ${round} — ${parts.join(" · ")}.`);
  log.push(...t.after);
  t.hits.clear();
  t.bites.clear();
  t.after = [];
}
export interface FightResult {
  result: "won" | "wiped" | "escaped";
  rounds: number;
  noise: number;
  log: string[];
}

// A party member's turn: heal if hurt, use what the belt is for, or fight.
function memberTurn(rng: Rng, f: Fighter, party: Fighter[], enemies: Fighter[], st: { round: number; flared: boolean; noise: number; tally: Tally }, log: string[]): void {
  const foes = alive(enemies);
  if (!foes.length) return;
  if (f.hp <= f.maxHp * COMBAT.healAt) {
    const kit: SupplyKind | null = has(f, "firstaid") && f.maxHp - f.hp >= 40 ? "firstaid" : has(f, "bandage") ? "bandage" : has(f, "firstaid") ? "firstaid" : null;
    if (kit) {
      spend(f, kit);
      const before = f.hp;
      f.hp = Math.min(f.maxHp, f.hp + (SUPPLIES[kit].heal ?? 0));
      log.push(`${f.name} used a ${SUPPLIES[kit].name.toLowerCase()}: +${f.hp - before} HP.`);
      return;
    }
  }
  if (!st.flared && st.round === 1 && foes.some((e) => e.animal) && has(f, "flare")) {
    spend(f, "flare");
    st.flared = true;
    for (const e of foes) if (e.animal) e.skip += 1;
    log.push(`${f.name} lit a flare. They shy from it.`);
    return;
  }
  if (foes.length >= 3 && has(f, "molotov")) {
    spend(f, "molotov");
    for (const e of foes) e.hp = Math.max(0, e.hp - COMBAT.molotov);
    const down = foes.filter((e) => e.hp === 0).length;
    log.push(`${f.name} threw a Molotov: ${COMBAT.molotov} to each of them${down ? `, ${down} down` : ""}.`);
    return;
  }
  // with ammo a ranged weapon fires from anywhere; without, it's a club
  const firing = f.range === "ranged" && f.ammoKind !== undefined && (f.pack[f.ammoKind] ?? 0) > 0 && !(f.oncePerFight && f.used);
  // melee reaches only from the front row (reach weapons from either)
  const melee = !firing && f.range !== "reach";
  if (melee && !frontOf(party).includes(f)) return;
  const dmg: [number, number] = f.range === "ranged" && !firing ? f.club : f.damage;
  const n = firing || f.range !== "ranged" ? f.targets : 1;
  const targets = [...foes].sort((a, b) => a.hp - b.hp).slice(0, n);
  const dealt: number[] = [];
  for (const t of targets) {
    let roll = between(rng, dmg);
    if (t.armour === 0) roll += f.traits.serrated ?? 0;
    if (!f.hitYet && f.traits.brutal) roll += Math.floor((roll * f.traits.brutal) / 100);
    if (rng() < COMBAT.crit) roll *= 2;
    const armour = Math.max(0, t.armour + f.vsArmour - f.pierce);
    const d = Math.max(1, roll - armour);
    t.hp = Math.max(0, t.hp - d);
    dealt.push(d);
    if (f.stagger && rng() * 100 < f.stagger && t.hp > 0) t.skip += 1;
  }
  f.hitYet = true;
  if (firing) {
    f.pack[f.ammoKind!] = (f.pack[f.ammoKind!] ?? 0) - 1;
    f.shots += 1;
    if (f.oncePerFight) f.used = true;
    if (f.noise >= COMBAT.carries) st.noise += f.noise;
    if (f.backblast) for (const a of alive(party)) if (a !== f && a.row === "back") a.hp = Math.max(1, a.hp - f.backblast);
  } else if (f.range !== "ranged" && f.noise >= COMBAT.carries) st.noise += f.noise;
  targets.forEach((t, i) => hitTally(st.tally, f.name, dealt[i], t.hp === 0));
}

// An enemy's blow, which now and then lands badly.
const roll = (rng: Rng, r: [number, number]) => between(rng, r) * (rng() < COMBAT.crit ? 2 : 1);

// An enemy's turn: bite the front, spray the whole front, or swarm anyone.
function enemyTurn(rng: Rng, e: Fighter, party: Fighter[], log: string[], tally: Tally): void {
  if (e.skip > 0) {
    e.skip -= 1;
    return;
  }
  const up = alive(party);
  if (!up.length) return;
  const hurt = (t: Fighter, d: number) => {
    if (t.hp - d <= 0 && t.lastSeal) {
      t.lastSeal = false;
      t.hp = 1;
      tally.after.push(`${t.name} should have gone down. The seal held: 1 HP.`);
      return;
    }
    t.hp = Math.max(0, t.hp - d);
    if (t.hp === 0) tally.after.push(`${t.name} went down; the others will carry them out.`);
  };
  if (e.attack === "spray") {
    for (const t of frontOf(party)) {
      if (t.sealed) {
        biteTally(tally, e.name, `${t.name} (sealed)`, 0, "sprayed");
        continue;
      }
      let d = Math.max(1, roll(rng, e.damage) - Math.floor(t.armour * COMBAT.sprayArmour));
      if (t.filter) d = Math.max(1, Math.floor(d / 2));
      biteTally(tally, e.name, t.name, d, "sprayed");
      hurt(t, d);
    }
    return;
  }
  const t = pickOne(rng, e.attack === "swarm" ? up : frontOf(party));
  const armour = t.armour + (e.attack === "swarm" ? (t.traits.padded ?? 0) : 0);
  const d = Math.max(1, roll(rng, e.damage) - armour);
  biteTally(tally, e.name, t.name, d);
  hurt(t, d);
  if (t.traits.spiked) e.hp = Math.max(0, e.hp - t.traits.spiked);
}

// A whole fight. `ambush` is who gets a free first round: the side that can
// see in the dark. `retreat` decides when the party tries to turn back; a
// failed try locks them in, as alone.
export function fight(
  rng: Rng,
  party: Fighter[],
  enemies: Fighter[],
  o: { ambush?: "party" | "enemy" | null; wave?: Fighter[]; retreat?: RetreatRule; canRetreat?: boolean } = {},
): FightResult {
  const log: string[] = [];
  const st = { round: 0, flared: false, noise: 0, tally: newTally() };
  let waved = false;
  let retreatTried = false;
  const startUp = alive(party).length;
  const over = () => !alive(enemies).length || !alive(party).length;
  const act = (f: Fighter) => {
    if (f.hp <= 0 || over()) return;
    if (f.side === "party") memberTurn(rng, f, party, enemies, st, log);
    else enemyTurn(rng, f, party, log, st.tally);
  };
  if (o.ambush) {
    log.push(o.ambush === "party" ? "They saw them first." : "In the dark, they were on them before anyone saw.");
    st.round = 1;
    for (const f of o.ambush === "party" ? party : enemies) act(f);
    flush(st.tally, 1, log);
  }
  while (!over() && st.round < COMBAT.maxRounds) {
    st.round += 1;
    const order = alive([...party, ...enemies])
      .map((f) => ({ f, k: f.speed + rng() }))
      .sort((a, b) => b.k - a.k)
      .map((x) => x.f);
    for (const f of order) act(f);
    flush(st.tally, st.round, log);
    if (!waved && o.wave?.length && st.noise >= COMBAT.noiseWave && alive(enemies).length) {
      waved = true;
      enemies.push(...o.wave);
      log.push(`The noise brought ${o.wave.length} more.`);
    }
    const down = startUp - alive(party).length;
    const rule = o.retreat ?? "never";
    if (!over() && o.canRetreat !== false && !retreatTried && ((rule === "anyone" && down >= 1) || (rule === "half" && down * 2 >= startUp))) {
      retreatTried = true;
      if (tryEscape(rng, party, st.noise, log, "They tried to turn back")) return { result: "escaped", rounds: st.round, noise: st.noise, log };
    }
  }
  if (!alive(party).length) return { result: "wiped", rounds: st.round, noise: st.noise, log };
  if (!alive(enemies).length) return { result: "won", rounds: st.round, noise: st.noise, log };
  log.push("Nobody could finish it. They backed out the way they came.");
  return { result: "escaped", rounds: st.round, noise: st.noise, log };
}
