import { html } from "hono/html";
import type { ItemKind, SupplyKind } from "./game/config.ts";

// Painted cutouts match the shelter art. Quantity and rarity remain live UI.
export function itemIcon(kind: ItemKind | SupplyKind) {
  return html`<img class="st-icon" src="/static/img/items/${kind}.webp" alt="" aria-hidden="true" width="512" height="512" loading="lazy" decoding="async">`;
}
