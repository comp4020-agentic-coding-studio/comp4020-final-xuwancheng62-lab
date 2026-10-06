import type { Resource } from "./game/config.ts";
import { defence, securityBand, type Security } from "./game/raid.ts";
import { currentRates } from "./game/resources.ts";
import type { PlotLook, PlotStage } from "./scene.ts";
import type { Plot, ShelterView } from "./shelter.ts";

// Everything another player may see about a shelter. Pages and live events
// about someone else's shelter are built from this and nothing else.
// The painted survivor portraits a player picks from when they register,
// static/img/survivors/1.jpg onwards, described for screen readers.
export const PORTRAITS = [
  "Woman with short dark hair, goggles and a scarf",
  "Old man with a grey beard and a knitted cap",
  "Young man with a shaved head and a dust mask",
  "Older woman with grey braids and a poncho",
  "Teenage girl in a military jacket, bandaged hand",
  "Man with curly hair and a respirator",
  "Young woman with a buzz cut and a hoodie",
  "Old man with taped glasses and a wool scarf",
  "Woman with red curls and a bandana",
  "Young man with locs and goggles",
  "Freckled boy in a beanie",
  "Older woman with white hair and a hooded raincoat",
];
export const isPortrait = (n: number) => Number.isInteger(n) && n >= 1 && n <= PORTRAITS.length;
export const portraitSrc = (n: number) => `/static/img/survivors/${n}.jpg`;

export type Band = "Plenty" | "Some" | "Scarce" | "Empty";
export const band = (v: number): Band => (v < 1 ? "Empty" : v < 10 ? "Scarce" : v < 30 ? "Some" : "Plenty");

export interface PublicShelter {
  id: number;
  owner: string;
  portrait: number;
  name: string;
  home: boolean;
  bands: Record<Resource, Band>;
  generator: boolean;
  purifier: boolean;
  security: Security;
  shieldedUntil: number | null;
  reinforces: number;
  plots: PlotLook[];
}

export function plotStage(p: Plot, now: number): PlotStage {
  if (!p.crop) return "empty";
  if (p.ready) return "ready";
  return (now - p.plantedAt) / (p.readyAt - p.plantedAt) < 0.35 ? "sprout" : "growing";
}

export function publicShelter(s: ShelterView, now: number): PublicShelter {
  const r = currentRates(s.stock, s.growing);
  const home = !s.journey;
  return {
    id: s.id,
    owner: s.owner,
    portrait: s.portrait,
    name: s.name,
    home,
    bands: { food: band(s.stock.food), water: band(s.stock.water), power: band(s.stock.power), scrap: band(s.stock.scrap) },
    generator: r.generator,
    purifier: r.purifier,
    security: securityBand(defence(home, s.combatPower, s.reinforces)),
    shieldedUntil: s.shieldUntil > now ? s.shieldUntil : null,
    reinforces: s.reinforces,
    plots: s.plots.map((p) => ({ stage: plotStage(p, now), crop: p.crop })),
  };
}
