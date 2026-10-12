import { BASE } from "./config.ts";
export const FACILITIES = {
  gate: { name: "Vault entrance", room: "Surface entrance", initial: 1, art: "entrance", description: "Reinforced doors protect the shelter even when everyone is out." },
  generator: { name: "Generator", room: "Power room", initial: 1, art: "generator", description: "Burn scrap to power the base." },
  purifier: { name: "Purifier", room: "Water room", initial: 1, art: "purifier", description: "Clean water from the underground supply." },
  storage: { name: "Storage", room: "Storeroom", initial: 1, art: "storage", description: "More room for automatic production. Loot is never thrown away." },
  workshop: { name: "Workshop", room: "Workshop expansion", initial: 0, art: "workshop", description: "Craft gear and supplies; automatically replenish arrows using scrap and power." },
  farm: { name: "Cultivation beds", room: "Cultivation expansion", initial: 0, art: "cultivation", description: "Produce food automatically, using water and power. Manual greenhouse plots remain separate." },
  recycler: { name: "Salvage processor", room: "Recycling expansion", initial: 0, art: "recycling", description: "Slowly recover scrap from buried rubble; consumes more power than that scrap can generate." },
} as const;
export type FacilityId = keyof typeof FACILITIES;
export type Facility = { tier: number; enabled: boolean; progress: number };
export type BaseState = Record<FacilityId, Facility>;
export const baseDefaults = (): BaseState => Object.fromEntries(Object.entries(FACILITIES).map(([k,d]) => [k,{tier:d.initial,enabled:true,progress:0}])) as BaseState;
export const tierIndex = (b: BaseState, k: FacilityId) => Math.max(0, b[k].tier - 1);
export const runs = (b: BaseState, k: FacilityId) => b[k].tier > 0 && b[k].enabled;
export const capacity = (b: BaseState) => BASE.storage[tierIndex(b,"storage")];
export const gateMax = (b: BaseState) => BASE.gateHp[tierIndex(b,"gate")];
export const gateCondition = (b: BaseState, hp: number) => Math.max(0, Math.min(1, hp / gateMax(b)));
export const gateDefence = (b: BaseState, hp: number) => Math.floor(BASE.gateDefence[tierIndex(b,"gate")] * gateCondition(b,hp));
export const gateReduction = (b: BaseState, hp: number) => BASE.gateReduction[tierIndex(b,"gate")] * gateCondition(b,hp);
