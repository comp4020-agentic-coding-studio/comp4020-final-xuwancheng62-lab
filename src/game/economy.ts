import { ECONOMY, GEAR, SUPPLIES, QUALITIES, type ItemKind, type SupplyKind, type Quality } from './config.ts';
import { rollGear, type Gear } from './items.ts';
import { seeded } from './rng.ts';
export const dayOf = (now:number) => Math.floor(now / ECONOMY.dayMs);
export const supplyPrice = (kind:string) => ECONOMY.supplyPrice[kind as keyof typeof ECONOMY.supplyPrice] ?? ECONOMY.defaultSupplyPrice;
export function gearPrice(g:Gear) {
  const def=GEAR[g.kind];
  const kindValue=(def.damage?.[1]??0)*ECONOMY.damagePrice+(def.armour??0)*ECONOMY.armourPrice+(def.slot==='tool'?ECONOMY.utilityPrice:0);
  return Math.ceil((kindValue+ECONOMY.gearBase + ECONOMY.gearPerLevel*g.level + Object.values(g.bonuses).reduce((a,b)=>a+(b??0),0)*ECONOMY.bonusPrice + g.traits.length*ECONOMY.traitPrice)*ECONOMY.qualityPrice[g.quality]);
}
export const sellPrice = (price:number) => Math.max(1,Math.floor(price*ECONOMY.sellRatio));
export interface Product { sku:string; kind:string; name:string; price:number; gear?:Gear; limit?:number; category:string }
export function products(level:number,now:number):Product[] {
  const day=dayOf(now);
  const kinds=(Object.keys(GEAR) as ItemKind[]).filter(k=>GEAR[k].minLevel<=level).sort((a,b)=>GEAR[a].minLevel-GEAR[b].minLevel || a.localeCompare(b));
  const make=(kind:ItemKind,quality:Quality):Product=>{
    const index=Object.keys(GEAR).indexOf(kind);
    const gear=rollGear(seeded(day*1009+index*31+QUALITIES.indexOf(quality)),kind,level,quality);
    const category=GEAR[kind].slot==='weapon'?(GEAR[kind].range==='ranged'?'Ranged':'Melee'):GEAR[kind].slot==='armour'?'Armour':'Tools';
    return {sku:`gear:${kind}:${quality}:${level}:${day}`,kind,name:GEAR[kind].name,gear,price:gearPrice(gear),category,limit:quality==='epic'?ECONOMY.epicStock:undefined};
  };
  const normal=kinds.flatMap(k=>(['common','uncommon','rare'] as Quality[]).map(q=>make(k,q)));
  const epic=kinds.length?Array.from({length:Math.min(ECONOMY.epicSlots,kinds.length)},(_,i)=>make(kinds[(day+i)%kinds.length],'epic')):[];
  return [...normal,...epic,...(Object.keys(SUPPLIES) as SupplyKind[]).map(k=>({sku:`supply:${k}`,kind:k,name:SUPPLIES[k].name,price:supplyPrice(k),category:SUPPLIES[k].type==='ammo'?'Ammo':'Supplies'})),...Object.entries(ECONOMY.resourcePrice).map(([k,price])=>({sku:`resource:${k}`,kind:k,name:k,price,category:'Resources'}))];
}
export type RequestItem={kind:string;qty:number;level:number;quality:Quality};
export const isGear = (k:string):k is ItemKind => Object.hasOwn(GEAR,k);
export const isSupply = (k:string):k is SupplyKind => Object.hasOwn(SUPPLIES,k);
export const matches = (g:{kind:string;level:number;quality:string},r:RequestItem) => g.kind===r.kind && (g.level===0 || (g.level>=r.level && QUALITIES.indexOf(g.quality as Quality)>=QUALITIES.indexOf(r.quality)));
