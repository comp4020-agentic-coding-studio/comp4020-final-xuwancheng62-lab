import { describe, expect, it } from "vitest";
import { RAID } from "../src/game/config.ts";
import { raidHaul, raidStrength } from "../src/game/raid.ts";

// The haul rule on its own: every raid gets in, strength decides how much.
describe("raid haul", () => {
  const luck = [RAID.luckMin, 1, RAID.luckMax];

  it("carries out more the stronger the raid", () => {
    for (const l of luck) {
      const hauls = [0.1, 0.3, 0.5, 0.85].map((s) => raidHaul(40, s, l));
      expect([...hauls].sort((a, b) => a - b)).toEqual(hauls);
    }
    expect(raidHaul(40, 0.85, 1)).toBeGreaterThan(raidHaul(40, 0.1, 1));
  });

  it("can come back with nothing", () => {
    expect(raidHaul(40, RAID.strengthMin, RAID.luckMin)).toBe(1);
    expect(raidHaul(24, RAID.strengthMin, RAID.luckMin)).toBe(0);
    expect(raidHaul(RAID.protectedMin, RAID.strengthMax, RAID.luckMax)).toBe(0);
  });

  it("never takes the target below the minimum or more than the cap", () => {
    for (const stock of [0, 19, 20, 21, 25, 40, 80, 500]) {
      for (const s of [0.1, 0.5, 0.85]) {
        for (const l of luck) {
          const n = raidHaul(stock, s, l);
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThanOrEqual(RAID.maxSteal);
          if (n > 0) expect(stock - n).toBeGreaterThanOrEqual(RAID.protectedMin);
        }
      }
    }
  });

  it("is stronger against an empty shelter than a guarded one", () => {
    expect(raidStrength(10, 15)).toBeGreaterThan(raidStrength(10, 25));
    expect(raidStrength(1, 1000)).toBe(RAID.strengthMin);
    expect(raidStrength(1000, 1)).toBe(RAID.strengthMax);
  });
});
