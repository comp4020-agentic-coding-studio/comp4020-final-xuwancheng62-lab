import type { Resource } from "./game/config.ts";
import { defence, securityBand, type Security } from "./game/raid.ts";
import { currentRates } from "./game/resources.ts";
import type { ShelterView } from "./shelter.ts";

// Everything another player may see about a shelter. Pages and live events
// about someone else's shelter are built from this and nothing else.
export type Band = "Plenty" | "Some" | "Scarce" | "Empty";
export const band = (v: number): Band => (v < 1 ? "Empty" : v < 10 ? "Scarce" : v < 30 ? "Some" : "Plenty");

export interface PublicShelter {
  id: number;
  owner: string;
  name: string;
  home: boolean;
  bands: Record<Resource, Band>;
  generator: boolean;
  purifier: boolean;
  security: Security;
  shieldedUntil: number | null;
  reinforces: number;
}

export function publicShelter(s: ShelterView, now: number): PublicShelter {
  const r = currentRates(s.stock);
  const home = !s.journey;
  return {
    id: s.id,
    owner: s.owner,
    name: s.name,
    home,
    bands: { food: band(s.stock.food), water: band(s.stock.water), power: band(s.stock.power), scrap: band(s.stock.scrap) },
    generator: r.generator,
    purifier: r.purifier,
    security: securityBand(defence(home, s.combatPower, s.reinforces)),
    shieldedUntil: s.shieldUntil > now ? s.shieldUntil : null,
    reinforces: s.reinforces,
  };
}
