import { html } from "hono/html";
import { LEGENDARIES, STORY_LEGENDARIES, type ItemKind, type SupplyKind } from "./game/config.ts";

const painted = new Set(["geralds-chime", "eleven-pallets", "big-spanner", "dp-overalls", "liaison-webbing", "levy-stick", "rake-pump", "ashby-oilskin", "kestrel-lamp"]);
// Named equipment keeps its own silhouette wherever inventory icons are shown.
export function itemIcon(item: ItemKind | SupplyKind | { kind: ItemKind; name?: string | null }) {
  const kind = typeof item === "string" ? item : item.kind;
  const named = typeof item === "string" ? undefined : [...LEGENDARIES, ...Object.values(STORY_LEGENDARIES)].find(l => l.name === item.name && l.kind === kind);
  const asset = named && painted.has(named.id) ? named.id : kind === "powerhammer" ? "powerhammer-v2" : kind;
  return html`<img class="st-icon" src="/static/img/items/${asset}.webp" alt="" aria-hidden="true" width="512" height="512" loading="lazy" decoding="async">`;
}
