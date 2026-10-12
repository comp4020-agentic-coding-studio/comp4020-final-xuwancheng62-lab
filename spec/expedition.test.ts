import { describe, expect, it } from "vitest";
import { COMBAT, DUNGEON_DROPS, LEGENDARIES, LOWER_DECK, TRAITS, type ItemKind, type Quality, type Trait } from "../src/game/config.ts";
import { enemyFighter, escapeChance, fight, memberFighter, type PartyMember } from "../src/game/combat.ts";
import { readiness, runExpedition, type Expedition } from "../src/game/expedition.ts";
import { rollPiece, type Gear } from "../src/game/items.ts";
import { seeded } from "../src/game/rng.ts";

// Party combat and the Lower Deck (PLAN.md, "Combat", "The Lower Deck"), as
// pure functions: the same party and seed always give the same run, rows
// and gear decide who takes what, and the balance targets in the plan hold.

const g = (kind: ItemKind, level = 1, quality: Quality = "common", traits: Trait[] = []): Gear => ({ kind, level, quality, bonuses: {}, traits });
// `maxHp` asks for about that much: it's turned into Constitution
const conFor = (maxHp: number, str: number) => Math.max(1, Math.round((maxHp - 60 - 2 * str) / 5));
const mk = (name: string, o: Partial<PartyMember> & { level?: number; str?: number; agi?: number; maxHp?: number } = {}): PartyMember => ({
  key: name,
  name,
  who: o.who ?? "you",
  hp: o.hp ?? Number.MAX_SAFE_INTEGER, // full, whatever max HP they get
  row: o.row ?? "front",
  body: { level: o.level ?? 3, strength: o.str ?? 5, agility: o.agi ?? 5, constitution: conFor(o.maxHp ?? 100, o.str ?? 5) },
  gear: o.gear ?? { weapon: g("crowbar") },
  belt: o.belt ?? {},
  pack: o.pack ?? {},
});
const run = (members: PartyMember[], o: Partial<Expedition> = {}) =>
  runExpedition({ seed: 42, members, approach: "fight", retreat: "half", records: [], players: members.length, ...o });

// A player who's done a few Nest trips: level-4 gear, a light, bandages.
const tank = (name = "Tank", torch = true) =>
  mk(name, { level: 5, str: 7, gear: { weapon: g("machete", 4, "uncommon"), armour: g("jacket", 4), ...(torch ? { tool: g("headtorch") } : {}) }, belt: { bandage: 2 } });
const lancer = (name = "Lancer") => mk(name, { row: "back", agi: 7, gear: { weapon: g("spear", 4, "rare", ["piercing"]), armour: g("hazmat", 3) }, belt: { bandage: 2 } });
const fresh = (name: string) => mk(name);

describe("a run", () => {
  it("is the same for the same party and seed, in time order, and takes at least the walk both ways", () => {
    const a = run([tank(), lancer()]);
    expect(run([tank(), lancer()])).toEqual(a);
    const times = a.events.map((e) => e.at);
    expect(times).toEqual([...times].sort((x, y) => x - y));
    const rooms = LOWER_DECK.rooms.reduce((t, r) => t + r.ms, 0);
    if (a.outcome === "cleared") expect(a.endsAt).toBeGreaterThanOrEqual(2 * LOWER_DECK.travelMs + rooms);
  });

  it("needs two to work the crank", () => {
    const r = run([tank()]);
    expect(r).toMatchObject({ outcome: "turned-back", cleared: [] });
  });

  it("lets nobody sneak past a required room, and a sneaking party sometimes skips the plant room", () => {
    const outcomes = Array.from({ length: 40 }, (_, i) => run([tank(), lancer()], { approach: "sneak", seed: i + 1 }));
    for (const r of outcomes) expect(r.events.some((e) => e.room === "dust" && e.text.includes("slip past"))).toBe(false);
    expect(outcomes.some((r) => !r.cleared.includes("plant") && r.cleared.includes("dust"))).toBe(true);
    expect(run([tank(), lancer()], { approach: "fight" }).events.some((e) => e.text.includes("slip past"))).toBe(false);
  });

  it("makes the warden stand down for a party that holds the all-clear word", () => {
    const r = run([tank(), lancer()], { records: ["all-clear"] });
    expect(r.events.some((e) => e.room === "dust" && e.text.includes("stood down"))).toBe(true);
    expect(r.events.some((e) => e.text.includes("sprayed"))).toBe(false);
  });

  it("opens the police locker only with a crowbar or bolt cutters", () => {
    const noOpener = [mk("A", { level: 5, str: 7, gear: { weapon: g("machete", 5, "rare"), armour: g("jacket", 5), tool: g("headtorch") }, belt: { bandage: 2 } }), lancer()];
    const r = run(noOpener, { records: ["all-clear"] });
    if (r.cleared.includes("locker")) throw new Error("the locker shouldn't count as cleared without an opener");
    expect(r.events.some((e) => e.text.includes("Nobody had anything to open it"))).toBe(true);
    const opened = run([...noOpener.slice(0, 1), mk("C", { gear: { weapon: g("crowbar"), armour: g("hazmat", 3) }, row: "back" }), lancer()], { records: ["all-clear"] });
    expect(opened.events.some((e) => e.text.includes("got it open"))).toBe(true);
  });

  it("lets Toby restart the plant room's purifier for more water", () => {
    const toby = mk("Toby", { who: "toby", str: 4, agi: 7, maxHp: 80, row: "back", gear: { weapon: g("slingshot"), armour: g("jacket") }, pack: { shot: 30 } });
    const r = run([tank(), lancer(), toby], { records: ["all-clear"] });
    expect(r.cleared).toContain("plant");
    expect(r.events.some((e) => e.text.includes("purifier stack"))).toBe(true);
  });

  it("brings nothing out of a wipe and nobody dies of it", () => {
    const r = run([fresh("A"), fresh("B")], { retreat: "never" });
    expect(r.outcome).toBe("wiped");
    expect(r.loot).toEqual({ resources: { food: 0, water: 0, scrap: 0 }, supplies: {}, gear: [] });
    expect(r.members.every((m) => m.down && m.hp === 0)).toBe(true);
  });
});

describe("what a fight does to a hoard", () => {
  it("burns some of the stores' food when someone throws a Molotov in there", () => {
    const firebug = (name: string) => ({ ...tank(name), belt: { molotov: 4, bandage: 2 } });
    const runs = Array.from({ length: 30 }, (_, i) => run([firebug("A"), firebug("B"), lancer()], { records: ["all-clear"], seed: i + 1 }));
    const burned = runs.filter((r) => r.events.some((e) => e.room === "stores" && e.text.startsWith("The fire took")));
    expect(burned.length).toBeGreaterThan(0);
    for (const r of burned) expect(r.loot.resources.food).toBeLessThanOrEqual(Math.floor(LOWER_DECK.hoard.food[1] * (1 - COMBAT.molotovBurns)));
  });
});

describe("a stalemate", () => {
  it("forces an escape roll when neither side can finish it, which can fail into a wipe", () => {
    const sealed = () => memberFighter(mk("Sealed", { gear: { armour: g("hazmat") } }));
    let escaped = 0;
    let wiped = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const r = fight(seeded(seed), [sealed(), sealed()], [enemyFighter("warden", 1)], { retreat: "never" });
      expect(r.rounds).toBe(COMBAT.maxRounds);
      if (r.result === "escaped") escaped++;
      else if (r.result === "wiped") wiped++;
      else throw new Error(`unexpected outcome ${r.result}`);
    }
    // neither outcome is guaranteed: the forced retreat is a real roll, not a free pass
    expect(escaped).toBeGreaterThan(0);
    expect(wiped).toBeGreaterThan(0);
  });
});

describe("the fight", () => {
  it("keeps melee in the back row out of it while the front stands, and lets reach hit from there", () => {
    const party = [memberFighter(mk("Front", { maxHp: 999 })), memberFighter(mk("Back", { row: "back" })), memberFighter(mk("Reach", { row: "back", gear: { weapon: g("spear") } }))];
    const r = fight(seeded(3), party, [enemyFighter("rustshell", 1), enemyFighter("rustshell", 2)]);
    // each round is one line: "Round 2 — Reach 12 · Rustshells bit Front 2× for 10."
    expect(r.log.some((l) => /[—·] Back \d/.test(l))).toBe(false);
    expect(r.log.some((l) => /[—·] Reach \d/.test(l))).toBe(true);
    // the bites go to the front
    expect(party[1].hp).toBe(party[1].maxHp);
    expect(party[2].hp).toBe(party[2].maxHp);
  });

  it("spends one round a shot, and stops firing when the pack is empty", () => {
    const archer = memberFighter(mk("Archer", { row: "back", agi: 6, level: 4, gear: { weapon: g("bow", 4) }, pack: { arrow: 3 } }));
    const wall = memberFighter(mk("Wall", { maxHp: 999 }));
    fight(seeded(5), [wall, archer], [enemyFighter("warden", 1)]);
    expect(archer.shots).toBe(3);
    expect(archer.pack.arrow).toBe(0);
  });

  it("can't reach a sealed suit with a spray, and halves it through a respirator", () => {
    const sealed = memberFighter(mk("Sealed", { maxHp: 999, gear: { weapon: g("crowbar"), armour: g("hazmat", 3) } }));
    const masked = memberFighter(mk("Masked", { maxHp: 999, gear: { weapon: g("crowbar"), tool: g("respirator", 3) } }));
    const bare = memberFighter(mk("Bare", { maxHp: 999 }));
    const r = fight(seeded(9), [sealed, masked, bare], [enemyFighter("warden", 1)], { retreat: "never" });
    expect(sealed.hp).toBe(sealed.maxHp);
    expect(masked.maxHp - masked.hp).toBeLessThan(bare.maxHp - bare.hp);
    expect(r.log.some((l) => l.includes("The warden sprayed") && l.includes("Sealed (sealed) 0"))).toBe(true);
  });

  it("keeps a Last-seal wearer up once at 1 HP", () => {
    const f = memberFighter(mk("Seal", { hp: 5, gear: { weapon: g("crowbar"), armour: g("hazmat", 3, "legendary", ["lastseal"]) } }));
    fight(seeded(1), [f], [enemyFighter("rat", 1), enemyFighter("rat", 2), enemyFighter("rat", 3)], { retreat: "never" });
    expect(f.lastSeal).toBe(false);
  });

  it("never makes escape certain or hopeless, and lets the slowest set it", () => {
    const slow = memberFighter(mk("Slow", { agi: 1 }));
    const quick = memberFighter(mk("Quick", { agi: 9 }));
    expect(escapeChance([quick], 0, false)).toBeGreaterThan(escapeChance([quick, slow], 0, false));
    expect(escapeChance([memberFighter(mk("X", { agi: 99 }))], 0, true)).toBe(COMBAT.escape.max);
    expect(escapeChance([memberFighter(mk("Y", { agi: 0 }))], 99, false)).toBe(COMBAT.escape.min);
  });
});

describe("its Legendaries", () => {
  it("are named, with their signature traits, and only where a table allows them", () => {
    let found: Gear | undefined;
    for (let s = 1; s < 2000 && !found; s++) {
      const p = rollPiece(seeded(s), DUNGEON_DROPS.stores);
      if (p.quality === "legendary") found = p;
    }
    expect(found).toBeDefined();
    const l = LEGENDARIES.find((x) => x.name === found!.name)!;
    expect(found!.kind).toBe(l.kind);
    expect(found!.traits).toEqual(l.traits);
    expect(l.traits.some((t) => TRAITS[t].signature)).toBe(true);
  });
});

describe("balance (PLAN.md, the targets)", () => {
  const band = (members: PartyMember[], records: string[] = []) => readiness({ members, approach: "fight", retreat: "half", records, players: members.length });

  it("is Grim for fresh crowbar parties, whatever their size", () => {
    for (const n of [2, 3, 4]) expect(band(Array.from({ length: n }, (_, i) => fresh(`F${i}`))).band).toBe("grim");
  });

  it("is Likely for two prepared players, Risky without the light, and Likely for three", () => {
    expect(band([tank(), lancer()]).band).toBe("likely");
    expect(band([tank("Tank", false), lancer()]).band).toBe("risky");
    expect(band([tank(), lancer(), tank("Tank2")]).band).toBe("likely");
  });

  it("is better with the all-clear word", () => {
    expect(band([tank("Tank", false), lancer()], ["all-clear"]).share).toBeGreaterThan(band([tank("Tank", false), lancer()]).share);
  });
});
