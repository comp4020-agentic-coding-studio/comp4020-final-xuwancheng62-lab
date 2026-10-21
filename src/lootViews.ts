import { html } from 'hono/html';
import { itemIcon } from './itemIcons.ts';
import { itemCard } from './itemViews.ts';
import { nameOfGear, type Gear, type Supplies } from './game/items.ts';
import { SUPPLIES, type SupplyKind } from './game/config.ts';
import type { Haul } from './game/character.ts';
export function lootChip(g: Gear) {
 return html`<details class="loot-chip q-${g.quality}"><summary>${itemIcon(g)}<span>${nameOfGear(g)}</span></summary><div class="loot-tooltip">${itemCard(g)}</div></details>`;
}
export function lootStrip(resources: Haul = {}, supplies: Supplies = {}, gear: Gear[] = []) {
 return html`<div class="loot-strip">${Object.entries(resources).filter(([,n])=>n!>0).map(([k,n])=>html`<span class="loot-resource" title="${k}"><span aria-hidden="true">${({food:'◉',water:'◆',scrap:'⚙',power:'ϟ'} as Record<string,string>)[k]}</span>${k} ×${n}</span>`)}${(Object.entries(supplies) as [SupplyKind,number][]).filter(([,n])=>n>0).map(([k,n])=>html`<span class="loot-supply" title="${SUPPLIES[k].name}">${itemIcon(k)}${SUPPLIES[k].name} ×${n}</span>`)}${gear.map(lootChip)}</div>`;
}
