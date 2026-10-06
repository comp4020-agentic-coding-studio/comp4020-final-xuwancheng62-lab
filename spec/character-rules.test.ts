import { describe, expect, it } from "vitest";
import { BEAST, CHARACTER, ESCAPE_CHANCE } from "../src/game/config.ts";
import { capacity, carry, damageRange, escapes, exchange, exploreMs, gainXp, halve, rested, xpToNext } from "../src/game/character.ts";
import { DESTINATIONS, journeyPhase, planJourney } from "../src/game/world.ts";

// The survivor's rules (PLAN.md, "Character, gear and the beast"), checked as
// pure functions on a fixed clock.

const nest = DESTINATIONS.find((d) => d.id === "nest")!;
const reservoir = DESTINATIONS.find((d) => d.id === "reservoir")!;

describe("agility", () => {
  it("shortens exploring by the formula, never below half", () => {
    expect(exploreMs(100_000, 0)).toBe(100_000);
    expect(exploreMs(100_000, 5)).toBe(100_000 / 1.25);
    expect(exploreMs(100_000, 20)).toBe(50_000); // 1 / (1 + 1) = exactly the floor
    expect(exploreMs(100_000, 60)).toBe(50_000); // capped
  });

  it("leaves travel each way unchanged", () => {
    const slow = planJourney(reservoir, 0, 0);
    const fast = planJourney(reservoir, 0, 30);
    expect(fast.arriveAt).toBe(slow.arriveAt);
    expect(fast.returnAt - fast.exploreUntil).toBe(slow.returnAt - slow.exploreUntil);
    expect(fast.exploreUntil - fast.arriveAt).toBeLessThan(slow.exploreUntil - slow.arriveAt);
  });

  it("puts the beast halfway through the Nest's exploring, and nowhere else", () => {
    const t = planJourney(nest, 0, CHARACTER.agility);
    expect(t.encounterAt).toBe(Math.round(t.arriveAt + (t.exploreUntil - t.arriveAt) * BEAST.at));
    expect(planJourney(reservoir, 0, 5).encounterAt).toBeNull();
  });
});

describe("journey phases", () => {
  const t = planJourney(nest, 0, 5);
  it("hold at the encounter while it's unresolved, however late it gets", () => {
    expect(journeyPhase(t, t.encounterAt! - 1, true).phase).toBe("exploring");
    expect(journeyPhase(t, t.encounterAt!, true).phase).toBe("encounter");
    expect(journeyPhase(t, t.returnAt + 10 * 3_600_000, true).phase).toBe("encounter");
  });
  it("run on the timestamps as before once it's resolved, or without one", () => {
    expect(journeyPhase(t, t.returnAt + 1, false).phase).toBe("done");
    const r = planJourney(reservoir, 0, 5);
    expect(journeyPhase(r, r.arriveAt + 1).phase).toBe("exploring");
  });
});

describe("combat", () => {
  it("adds Strength to the weapon's roll, and fights bare-handed without one", () => {
    expect(damageRange(5, { weapon: "crowbar" })).toEqual([11, 15]);
    expect(damageRange(5, { weapon: "spear" })).toEqual([15, 20]);
    expect(damageRange(5, {})).toEqual([7, 10]);
  });

  it("lets the beast bite back only if it survives, minus armour, at least 1", () => {
    expect(exchange(100, 55, 12, 10, {})).toMatchObject({ beastHp: 43, beastBite: 10, playerHp: 90, outcome: "fighting" });
    expect(exchange(100, 55, 12, 10, { armour: "jacket" })).toMatchObject({ beastBite: 6, playerHp: 94 });
    expect(exchange(100, 55, 12, 3, { armour: "jacket" }).beastBite).toBe(1);
    expect(exchange(100, 10, 12, 15, {})).toMatchObject({ beastHp: 0, beastBite: 0, playerHp: 100, outcome: "won" });
    expect(exchange(8, 55, 5, 15, {})).toMatchObject({ playerHp: 0, outcome: "defeated" });
  });

  it("escapes at the configured chance", () => {
    const pct = Math.round(ESCAPE_CHANCE * 100);
    expect(escapes(pct - 1)).toBe(true);
    expect(escapes(pct)).toBe(false);
  });
});

describe("carrying", () => {
  it("is 20 + 4 × Strength, +15 with the backpack", () => {
    expect(capacity(5, {})).toBe(40);
    expect(capacity(5, { tool: "backpack" })).toBe(55);
  });
  it("fills in a fixed order and says how much was left", () => {
    expect(carry({ food: 30, scrap: 20 }, 40)).toEqual({ carried: { food: 30, scrap: 10 }, left: 10 });
  });
  it("keeps exactly half of each, rounded down, on an escape", () => {
    expect(halve({ food: 15, scrap: 9, water: 1 })).toEqual({ food: 7, scrap: 4 });
  });
});

describe("experience", () => {
  it("needs 40 × the current level, and gives a point a level", () => {
    expect(xpToNext(1)).toBe(40);
    expect(gainXp(1, 30, 12)).toEqual({ level: 2, xp: 2, levelsGained: 1 });
    expect(gainXp(1, 0, 40 + 80)).toEqual({ level: 3, xp: 0, levelsGained: 2 });
    expect(gainXp(CHARACTER.maxLevel, 0, 10_000).level).toBe(CHARACTER.maxLevel);
  });
});

describe("recovery", () => {
  it("comes back at a steady rate from the clock, up to the maximum", () => {
    expect(rested(0, 100, 0, 20_000 * 20)).toBe(20);
    expect(rested(90, 100, 0, 3_600_000)).toBe(100);
    expect(rested(50, 100, 1000, 500)).toBe(50); // a clock behind the last change gives nothing
  });
});
