import { raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";

// The shelter cutaway, drawn twice: a wide two-floor plan and a tall
// four-floor one for phones. Both share the same items, so the survivor
// script (static/scene.js) only needs each layout's floors, shaft and spots.

export type ItemKey = "hatch" | "generator" | "purifier" | "food" | "water" | "scrap" | "quarters";
export const ITEM_ORDER: readonly ItemKey[] = ["hatch", "generator", "purifier", "food", "water", "scrap", "quarters"];

export interface SceneModel {
  lit: boolean;
  generator: boolean;
  purifier: boolean;
  occupied: boolean;
  sealed: boolean;
  items: { food: number; water: number; scrap: number };
  tank: number;
}

export interface Hotspot {
  key: ItemKey;
  label: string;
}

interface Box { x: number; y: number; w: number; h: number }
interface Spot { floor: string; x: number; face: 1 | -1 }
interface Layout {
  id: "wide" | "tall";
  w: number;
  h: number;
  ground: number;
  shaftX: number;
  shaft: Box;
  shell: Box;
  floors: Record<string, number>;
  rooms: Box[];
  place: Record<Exclude<ItemKey, "hatch">, { x: number; floor: string; s: number }>;
  hot: Record<ItemKey, Box>;
  spot: Record<ItemKey, Spot>;
}

const WIDE: Layout = {
  id: "wide",
  w: 960,
  h: 540,
  ground: 120,
  shaftX: 70,
  shaft: { x: 52, y: 112, w: 36, h: 406 },
  shell: { x: 30, y: 136, w: 910, h: 394 },
  floors: { surface: 118, a: 318, b: 506 },
  rooms: [
    { x: 100, y: 150, w: 410, h: 168 },
    { x: 520, y: 150, w: 410, h: 168 },
    { x: 100, y: 340, w: 540, h: 166 },
    { x: 650, y: 340, w: 280, h: 166 },
  ],
  place: {
    generator: { x: 150, floor: "a", s: 1 },
    purifier: { x: 560, floor: "a", s: 1 },
    food: { x: 130, floor: "b", s: 1 },
    water: { x: 300, floor: "b", s: 1 },
    scrap: { x: 480, floor: "b", s: 1 },
    quarters: { x: 690, floor: "b", s: 1 },
  },
  hot: {
    hatch: { x: 28, y: 52, w: 84, h: 78 },
    generator: { x: 146, y: 164, w: 304, h: 154 },
    purifier: { x: 556, y: 174, w: 246, h: 144 },
    food: { x: 124, y: 362, w: 160, h: 144 },
    water: { x: 294, y: 362, w: 160, h: 144 },
    scrap: { x: 472, y: 398, w: 146, h: 108 },
    quarters: { x: 682, y: 392, w: 240, h: 114 },
  },
  spot: {
    hatch: { floor: "surface", x: 70, face: 1 },
    generator: { floor: "a", x: 124, face: 1 },
    purifier: { floor: "a", x: 830, face: -1 },
    food: { floor: "b", x: 205, face: 1 },
    water: { floor: "b", x: 375, face: 1 },
    scrap: { floor: "b", x: 545, face: 1 },
    quarters: { floor: "b", x: 668, face: 1 },
  },
};

const TALL: Layout = {
  id: "tall",
  w: 360,
  h: 1000,
  ground: 110,
  shaftX: 34,
  shaft: { x: 20, y: 102, w: 28, h: 876 },
  shell: { x: 8, y: 126, w: 344, h: 866 },
  floors: { surface: 108, a: 318, b: 520, c: 752, d: 966 },
  rooms: [
    { x: 62, y: 140, w: 282, h: 178 },
    { x: 62, y: 340, w: 282, h: 180 },
    { x: 62, y: 542, w: 282, h: 210 },
    { x: 62, y: 774, w: 282, h: 192 },
  ],
  place: {
    generator: { x: 96, floor: "a", s: 0.78 },
    purifier: { x: 120, floor: "b", s: 0.82 },
    food: { x: 74, floor: "c", s: 0.6 },
    water: { x: 170, floor: "c", s: 0.6 },
    scrap: { x: 268, floor: "c", s: 0.56 },
    quarters: { x: 110, floor: "d", s: 0.95 },
  },
  hot: {
    hatch: { x: 2, y: 44, w: 66, h: 72 },
    generator: { x: 92, y: 194, w: 236, h: 124 },
    purifier: { x: 116, y: 398, w: 198, h: 122 },
    food: { x: 70, y: 662, w: 96, h: 90 },
    water: { x: 166, y: 662, w: 96, h: 90 },
    scrap: { x: 264, y: 694, w: 80, h: 58 },
    quarters: { x: 106, y: 866, w: 228, h: 100 },
  },
  spot: {
    hatch: { floor: "surface", x: 34, face: 1 },
    generator: { floor: "a", x: 80, face: 1 },
    purifier: { floor: "b", x: 98, face: 1 },
    food: { floor: "c", x: 119, face: 1 },
    water: { floor: "c", x: 215, face: 1 },
    scrap: { floor: "c", x: 305, face: -1 },
    quarters: { floor: "d", x: 92, face: 1 },
  },
};

// ---- equipment art, in local coordinates: origin bottom-left, y up is negative

function generatorArt(): string {
  return `<path class="pipe" d="M200 -90V-148H262"/>
  <path class="metal" d="M40 -90l12 -25h48l12 25z"/>
  <rect class="metal" x="20" y="-90" width="190" height="90" rx="4"/>
  <path class="vent" d="M34 -72h104M34 -62h104M34 -52h104M34 -42h104"/>
  <rect class="panel" x="152" y="-78" width="44" height="54" rx="2"/>
  <circle class="lamp" cx="174" cy="-64" r="6"/>
  <rect class="gauge" x="160" y="-44" width="28" height="10" rx="1"/>
  <g class="flywheel"><circle class="metal-dark" cx="250" cy="-42" r="38"/><path class="spoke" d="M250 -80v76M212 -42h76M223 -69l54 54M277 -69l-54 54"/><circle class="hub" cx="250" cy="-42" r="8"/></g>
  <path class="cable" d="M20 -22c-16 0 -12 22 -30 22"/>`;
}

function purifierArt(tank: number): string {
  const h = Math.round(84 * tank);
  return `<path class="pipe" d="M-10 -112H40M130 -92H184V-48"/>
  <rect class="metal" x="40" y="-140" width="90" height="140" rx="36"/>
  <rect class="glass" x="62" y="-112" width="46" height="84" rx="8"/>
  <rect class="water" x="62" y="${-28 - h}" width="46" height="${h}" rx="${h > 12 ? 6 : 0}"/>
  <path class="glint" d="M70 -104v52"/>
  <circle class="lamp" cx="85" cy="-126" r="5"/>
  <rect class="metal-dark" x="166" y="-50" width="36" height="50" rx="3"/>
  <path class="vent" d="M173 -38h22M173 -28h22M173 -18h22"/>
  <path class="pipe" d="M202 -40H216V-32"/>
  <path class="drip" d="M216 -26c3 5 5 8 5 10a5 5 0 0 1 -10 0c0 -2 2 -5 5 -10z"/>`;
}

function shelfArt(kind: "food" | "water", n: number): string {
  const slots = [14, 56, 98];
  const rows = [-4, -50, -96];
  let items = "";
  for (let i = 0; i < n; i++) {
    const x = slots[i % 3];
    const y = rows[Math.floor(i / 3)];
    items +=
      kind === "food"
        ? `<rect class="can" x="${x}" y="${y - 30}" width="30" height="30" rx="2"/><rect class="label" x="${x}" y="${y - 21}" width="30" height="8"/>`
        : `<path class="jug" d="M${x + 9} ${y - 36}h12v6l7 7v23h-26v-23l7 -7z"/>`;
  }
  return `<rect class="rack" x="2" y="-140" width="5" height="140"/><rect class="rack" x="141" y="-140" width="5" height="140"/>
  ${items}
  <rect class="shelf" x="2" y="-4" width="144" height="4"/><rect class="shelf" x="2" y="-50" width="144" height="4"/><rect class="shelf" x="2" y="-96" width="144" height="4"/><rect class="shelf" x="2" y="-140" width="144" height="4"/>`;
}

function scrapArt(n: number): string {
  const shards = [
    "M14 -56l10 -26 12 6 4 20z",
    "M44 -56l4 -34 16 8 -2 26z",
    "M72 -56l14 -22 10 10 -4 12z",
    "M96 -56l6 -30 14 4 0 26z",
    "M28 -56l20 -14 12 14z",
    "M60 -56l18 -40 8 6 -6 34z",
  ];
  return `${shards.slice(0, n).map((d) => `<path class="scrapbit" d="${d}"/>`).join("")}
  <rect class="crate" x="0" y="-56" width="130" height="56" rx="2"/>
  <path class="slat" d="M0 -38H130M0 -20H130M32 -56V0M98 -56V0"/>`;
}

function quartersArt(): string {
  return `<path class="tally" d="M40 -118v18M48 -118v18M56 -118v18M64 -118v18M36 -104l32 -10M84 -118v18M92 -118v18"/>
  <rect class="bedframe" x="10" y="-30" width="170" height="10" rx="2"/>
  <rect class="bedframe" x="12" y="-20" width="8" height="20"/><rect class="bedframe" x="170" y="-20" width="8" height="20"/>
  <rect class="mattress" x="14" y="-44" width="162" height="16" rx="4"/>
  <rect class="pillow" x="18" y="-54" width="34" height="12" rx="5"/>
  <path class="blanket" d="M70 -46h106v18H64z"/>
  <rect class="stand" x="190" y="-40" width="34" height="40" rx="2"/>
  <path class="lampbase" d="M200 -40h14l-3 -16h-8z"/><path class="lampshade" d="M196 -56h22l-5 -12h-12z"/>`;
}

function hatchArt(sealed: boolean): string {
  return sealed
    ? `<rect class="collar" x="-28" y="-8" width="56" height="12" rx="2"/><rect class="lid" x="-31" y="-14" width="62" height="8" rx="2"/><rect class="bar" x="-22" y="-19" width="44" height="5" rx="1"/><circle class="lock" cx="0" cy="-17" r="4"/>`
    : `<path class="lid" d="M-24 -6L-40 -46L-31 -49L-14 -7z"/><rect class="collar" x="-28" y="-8" width="56" height="12" rx="2"/><rect class="opening" x="-18" y="-6" width="36" height="8"/>`;
}

const SURVIVOR = `<g class="sv-flip">
  <g class="sv-bob">
    <path class="sv-limb sv-leg sv-leg-b" d="M-3 -26L-4 -1"/>
    <path class="sv-limb sv-arm sv-arm-b" d="M-3 -45L-6 -29"/>
    <rect class="sv-pack" x="-15" y="-47" width="8" height="18" rx="2"/>
    <path class="sv-torso" d="M-9 -26Q-11 -45 0 -49Q11 -45 9 -26z"/>
    <path class="sv-limb sv-leg sv-leg-f" d="M3 -26L4 -1"/>
    <circle class="sv-head" cx="0" cy="-56" r="7.5"/>
    <path class="sv-goggles" d="M1 -59h7v4h-7z"/>
    <path class="sv-limb sv-arm sv-arm-f" d="M3 -45L6 -29"/>
  </g>
</g>
<g class="sv-bubble"><rect x="-11" y="-92" width="22" height="20" rx="5"/><path d="M-3 -72l3 5 3 -5z"/><text x="0" y="-77" text-anchor="middle">?</text></g>`;

const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;

function layoutSvg(L: Layout, m: SceneModel, idPrefix: string): string {
  const pieces = (Object.keys(L.place) as Exclude<ItemKey, "hatch">[]).map((k) => {
    const p = L.place[k];
    const art =
      k === "generator" ? generatorArt()
      : k === "purifier" ? purifierArt(m.tank)
      : k === "food" ? shelfArt("food", m.items.food)
      : k === "water" ? shelfArt("water", m.items.water)
      : k === "scrap" ? scrapArt(m.items.scrap)
      : quartersArt();
    const running = k === "generator" ? m.generator : k === "purifier" ? m.purifier : null;
    const cls = `eq eq-${k}${running === null ? "" : running ? " is-running" : " is-stopped"}`;
    return `<g class="${cls}" transform="translate(${p.x} ${L.floors[p.floor]}) scale(${p.s})">${art}</g>`;
  });
  const rungs = Array.from({ length: Math.floor(L.shaft.h / 14) }, (_, i) => L.shaft.y + 8 + i * 14)
    .map((y) => `M${L.shaft.x + 6} ${y}H${L.shaft.x + L.shaft.w - 6}`)
    .join("");
  const doorways = Object.entries(L.floors)
    .filter(([f]) => f !== "surface")
    .map(([, y]) => `<rect class="doorway" x="${L.shaft.x + L.shaft.w}" y="${y - 66}" width="${L.rooms[0].x - L.shaft.x - L.shaft.w}" height="66"/>`)
    .join("");
  const rooms = L.rooms
    .map(
      (r) => `<rect class="room" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>
  <rect class="glow" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="url(#${idPrefix}-glow)"/>
  <rect class="fixture" x="${r.x + r.w / 2 - 18}" y="${r.y}" width="36" height="5" rx="2"/>`,
    )
    .join("");
  const shades = L.rooms.map((r) => `<rect class="shade" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>`).join("");
  const start = L.spot.quarters;

  return `<svg class="sc-svg" viewBox="0 0 ${L.w} ${L.h}" role="img" aria-label="Cutaway of the shelter">
  <defs>
    <radialGradient id="${idPrefix}-glow" cx="50%" cy="0%" r="75%"><stop offset="0" stop-color="#f0a83a" stop-opacity="0.26"/><stop offset="1" stop-color="#f0a83a" stop-opacity="0"/></radialGradient>
    <linearGradient id="${idPrefix}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121316"/><stop offset="0.65" stop-color="#1f1c18"/><stop offset="1" stop-color="#4a3824"/></linearGradient>
    <pattern id="${idPrefix}-earth" width="34" height="29" patternUnits="userSpaceOnUse"><rect width="34" height="29" fill="#2e2921"/><circle cx="7" cy="9" r="2" fill="#26221b"/><circle cx="24" cy="20" r="1.5" fill="#3a342a"/></pattern>
  </defs>
  <rect class="sky" width="${L.w}" height="${L.ground}" fill="url(#${idPrefix}-sky)"/>
  <path class="ruins" d="M${L.w * 0.42} ${L.ground}v-34h18v-16h14v50zM${L.w * 0.62} ${L.ground}v-22h26v22zM${L.w * 0.8} ${L.ground}v-46h10v14h16v32z"/>
  <rect width="${L.w}" height="${L.h - L.ground}" y="${L.ground}" fill="url(#${idPrefix}-earth)"/>
  <rect class="shell" x="${L.shell.x}" y="${L.shell.y}" width="${L.shell.w}" height="${L.shell.h}" rx="6"/>
  <rect class="shaft" x="${L.shaft.x}" y="${L.shaft.y}" width="${L.shaft.w}" height="${L.shaft.h}"/>
  <path class="ladder" d="M${L.shaft.x + 6} ${L.shaft.y}V${L.shaft.y + L.shaft.h}M${L.shaft.x + L.shaft.w - 6} ${L.shaft.y}V${L.shaft.y + L.shaft.h}${rungs}"/>
  ${doorways}
  ${rooms}
  ${pieces.join("\n  ")}
  <g class="eq-hatch" transform="translate(${L.shaftX} ${L.ground})">${hatchArt(m.sealed)}</g>
  ${
    m.occupied
      ? `<g class="sv" data-x="${start.x}" data-y="${L.floors[start.floor]}" transform="translate(${start.x} ${L.floors[start.floor]})">${SURVIVOR}</g>`
      : ""
  }
  ${shades}
</svg>`;
}

function layoutData(L: Layout): string {
  const spots = Object.fromEntries(ITEM_ORDER.map((k) => [k, { y: L.floors[L.spot[k].floor], x: L.spot[k].x, face: L.spot[k].face }]));
  return JSON.stringify({ shaftX: L.shaftX, floors: Object.values(L.floors), spots });
}

export function renderScene(m: SceneModel, hotspots: Hotspot[], state: string): HtmlEscapedString {
  const variant = (L: Layout) => `<div class="sc sc-${L.id}" data-layout='${layoutData(L)}'>
  ${layoutSvg(L, m, `sc-${L.id}`)}
  ${hotspots
    .map((h, i) => {
      const b = L.hot[h.key];
      const end = b.x + b.w / 2 > L.w * 0.6 ? " sc-hot--end" : "";
      return `<a class="sc-hot${end}" href="#info-${h.key}" data-key="${h.key}" style="left:${pct(b.x, L.w)};top:${pct(b.y, L.h)};width:${pct(b.w, L.w)};height:${pct(b.h, L.h)}">
      <span class="sc-key" aria-hidden="true">${i + 1}</span><span class="sc-name">${escapeText(h.label)}</span></a>`;
    })
    .join("")}
</div>`;
  return raw(`<div class="sc-stage ${state}" id="scene">${variant(WIDE)}${variant(TALL)}</div>`) as HtmlEscapedString;
}

const escapeText = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
