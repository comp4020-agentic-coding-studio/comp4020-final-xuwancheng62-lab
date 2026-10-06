import { raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";

// The shelter cutaway, drawn twice: a wide two-floor plan and a tall
// four-floor one for phones. Both share the same items, so the survivor
// script (static/scene.js) only needs each layout's floors, shaft and spots.

export type ItemKey = "hatch" | "generator" | "purifier" | "greenhouse" | "food" | "water" | "scrap" | "quarters";
export const ITEM_ORDER: readonly ItemKey[] = ["hatch", "generator", "purifier", "greenhouse", "food", "water", "scrap", "quarters"];

export type PlotStage = "empty" | "sprout" | "growing" | "ready";
export interface PlotLook {
  stage: PlotStage;
  crop: string | null;
}

export interface SceneModel {
  lit: boolean;
  generator: boolean;
  purifier: boolean;
  occupied: boolean;
  sealed: boolean;
  items: { food: number; water: number; scrap: number };
  tank: number;
  greenhouse: { lit: boolean; plots: PlotLook[] };
  // On a visit: the owner's name over their survivor, and you, let in
  // through the hatch while they're home.
  people?: { owner: string; guest: boolean };
}

export interface Hotspot {
  key: ItemKey;
  label: string;
}

interface Box { x: number; y: number; w: number; h: number }
interface Spot { floor: string; x: number; face: 1 | -1 }
interface Layout {
  id: "wide" | "tall";
  gate: { x: number; step: number; max: number };
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
  gate: { x: 118, step: 52, max: 6 },
  w: 960,
  h: 740,
  ground: 120,
  shaftX: 70,
  shaft: { x: 52, y: 112, w: 36, h: 604 },
  shell: { x: 30, y: 136, w: 910, h: 594 },
  floors: { surface: 118, a: 318, b: 506, c: 704 },
  rooms: [
    { x: 100, y: 150, w: 410, h: 168 },
    { x: 520, y: 150, w: 410, h: 168 },
    { x: 100, y: 340, w: 540, h: 166 },
    { x: 650, y: 340, w: 280, h: 166 },
    { x: 100, y: 528, w: 830, h: 176 },
  ],
  place: {
    generator: { x: 150, floor: "a", s: 1 },
    purifier: { x: 560, floor: "a", s: 1 },
    food: { x: 130, floor: "b", s: 1 },
    water: { x: 300, floor: "b", s: 1 },
    scrap: { x: 480, floor: "b", s: 1 },
    quarters: { x: 690, floor: "b", s: 1 },
    greenhouse: { x: 150, floor: "c", s: 1 },
  },
  hot: {
    hatch: { x: 28, y: 52, w: 84, h: 78 },
    greenhouse: { x: 146, y: 546, w: 628, h: 158 },
    generator: { x: 146, y: 164, w: 304, h: 154 },
    purifier: { x: 580, y: 152, w: 120, h: 166 },
    food: { x: 124, y: 362, w: 160, h: 144 },
    water: { x: 294, y: 362, w: 160, h: 144 },
    scrap: { x: 472, y: 398, w: 146, h: 108 },
    quarters: { x: 682, y: 392, w: 240, h: 114 },
  },
  spot: {
    hatch: { floor: "surface", x: 70, face: 1 },
    generator: { floor: "a", x: 124, face: 1 },
    purifier: { floor: "a", x: 712, face: -1 },
    food: { floor: "b", x: 205, face: 1 },
    water: { floor: "b", x: 375, face: 1 },
    scrap: { floor: "b", x: 545, face: 1 },
    quarters: { floor: "b", x: 668, face: 1 },
    greenhouse: { floor: "c", x: 126, face: 1 },
  },
};

const TALL: Layout = {
  id: "tall",
  gate: { x: 76, step: 50, max: 5 },
  w: 360,
  h: 1160,
  ground: 110,
  shaftX: 34,
  shaft: { x: 20, y: 102, w: 28, h: 1026 },
  shell: { x: 8, y: 126, w: 344, h: 1016 },
  floors: { surface: 108, a: 318, b: 520, c: 752, d: 966, e: 1118 },
  rooms: [
    { x: 62, y: 140, w: 282, h: 178 },
    { x: 62, y: 340, w: 282, h: 180 },
    { x: 62, y: 542, w: 282, h: 210 },
    { x: 62, y: 774, w: 282, h: 192 },
    { x: 62, y: 988, w: 282, h: 130 },
  ],
  place: {
    generator: { x: 96, floor: "a", s: 0.78 },
    purifier: { x: 120, floor: "b", s: 0.82 },
    food: { x: 74, floor: "c", s: 0.6 },
    water: { x: 170, floor: "c", s: 0.6 },
    scrap: { x: 268, floor: "c", s: 0.56 },
    quarters: { x: 110, floor: "d", s: 0.95 },
    greenhouse: { x: 70, floor: "e", s: 0.43 },
  },
  hot: {
    hatch: { x: 2, y: 44, w: 66, h: 72 },
    greenhouse: { x: 66, y: 1046, w: 276, h: 72 },
    generator: { x: 92, y: 194, w: 236, h: 124 },
    purifier: { x: 136, y: 384, w: 98, h: 136 },
    food: { x: 70, y: 662, w: 96, h: 90 },
    water: { x: 166, y: 662, w: 96, h: 90 },
    scrap: { x: 264, y: 694, w: 80, h: 58 },
    quarters: { x: 106, y: 866, w: 228, h: 100 },
  },
  spot: {
    hatch: { floor: "surface", x: 34, face: 1 },
    generator: { floor: "a", x: 80, face: 1 },
    purifier: { floor: "b", x: 126, face: 1 },
    food: { floor: "c", x: 119, face: 1 },
    water: { floor: "c", x: 215, face: 1 },
    scrap: { floor: "c", x: 305, face: -1 },
    quarters: { floor: "d", x: 92, face: 1 },
    greenhouse: { floor: "e", x: 82, face: 1 },
  },
};

// ---- equipment art, in local coordinates: origin bottom-left, y up is negative

// The generator and purifier are painted (static/img/shelter/), with what
// changes drawn over them: the lamp, the exhaust, the water in the glass.
// Positions are measured off the images.
function generatorArt(): string {
  return `<g class="hum"><image class="eq-art" href="/static/img/shelter/generator.webp" x="0" y="-129" width="300" height="129"/>
  <circle class="lamp" cx="146.6" cy="-73.7" r="3.2"/></g>
  <g class="exhaust"><circle cx="240" cy="-134" r="5"/><circle cx="243" cy="-134" r="7"/><circle cx="238" cy="-134" r="6"/></g>`;
}

// The purifier image is 310 × 520; its glass window and pump lamp in those pixels.
const PUR = { x: 30, h: 162, w: (162 * 310) / 520 };
const px = (x: number, y: number) => ({ x: PUR.x + (x * PUR.w) / 310, y: -PUR.h + (y * PUR.h) / 520 });
const G0 = px(176, 101), G1 = px(216, 361), PLAMP = px(275, 308);
const GLASS = { x: G0.x, y: G0.y, w: G1.x - G0.x, h: G1.y - G0.y };
const r1 = (n: number) => Math.round(n * 10) / 10;
function purifierArt(tank: number): string {
  const empty = r1(GLASS.h * (1 - Math.max(0, Math.min(1, tank))));
  return `<image class="eq-art" href="/static/img/shelter/purifier.webp" x="${PUR.x}" y="${-PUR.h}" width="${r1(PUR.w)}" height="${PUR.h}"/>
  <rect class="glass-empty" x="${r1(GLASS.x)}" y="${r1(GLASS.y)}" width="${r1(GLASS.w)}" height="${empty}"/>
  ${empty < GLASS.h ? `<path class="waterline" d="M${r1(GLASS.x)} ${r1(GLASS.y + empty)}h${r1(GLASS.w)}"/>` : ""}
  <g class="bubbles">${[0.25, 0.55, 0.8].map((f, i) => `<circle cx="${r1(GLASS.x + GLASS.w * f)}" cy="${r1(GLASS.y + GLASS.h - 4)}" r="${1.3 + (i % 2) * 0.5}" style="--rise:${r1(-(GLASS.h - empty - 8))}px;animation-delay:${i * 0.7}s"/>`).join("")}</g>
  <circle class="lamp" cx="${r1(PLAMP.x)}" cy="${r1(PLAMP.y)}" r="2.8"/>`;
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

function plantArt(p: PlotLook, cx: number): string {
  if (p.stage === "empty") return `<path class="soilmark" d="M${cx - 40} -48h18M${cx - 6} -48h14M${cx + 26} -48h16"/>`;
  const h = p.stage === "sprout" ? 14 : p.stage === "growing" ? 40 : 58;
  if (p.crop === "mushrooms") {
    const caps = p.stage === "sprout" ? [[-14, 6], [10, 5]] : [[-30, 11], [-6, 14], [20, 10], [38, 8]];
    return caps
      .map(([dx, r]) => {
        const stem = p.stage === "ready" ? r * 1.6 : r * 1.1;
        return `<path class="stalk" d="M${cx + dx} -46v${-stem}"/><path class="cap${p.stage === "ready" ? " is-ripe" : ""}" d="M${cx + dx - r} ${-46 - stem}a${r} ${r * 0.8} 0 0 1 ${r * 2} 0z"/>`;
      })
      .join("");
  }
  const stems = [-36, -12, 12, 36];
  const produce = p.stage === "ready" ? (p.crop === "beans" ? "pod" : "tuber") : "";
  return stems
    .map((dx, i) => {
      const x = cx + dx;
      const top = -46 - h + (i % 2) * 6;
      const leaves = p.stage === "sprout" ? `<path class="leaf" d="M${x} ${top}c-6 -2 -9 2 -9 6c4 0 8 -2 9 -6zM${x} ${top}c6 -2 9 2 9 6c-4 0 -8 -2 -9 -6z"/>`
        : `<path class="leaf" d="M${x} ${top + 8}c-12 -4 -18 4 -18 10c8 0 15 -4 18 -10zM${x} ${top + 20}c12 -4 18 4 18 10c-8 0 -15 -4 -18 -10zM${x} ${top}c-7 -6 -2 -14 0 -14c2 0 7 8 0 14z"/>`;
      const fruit = produce === "pod" ? `<path class="pod" d="M${x + 3} ${top + 14}q6 10 2 20q-6 -10 -2 -20z"/>`
        : produce === "tuber" ? `<ellipse class="tuber" cx="${x - 7}" cy="-44" rx="7" ry="5"/>` : "";
      return `<path class="stalk" d="M${x} -46V${top}"/>${leaves}${fruit}`;
    })
    .join("");
}

function greenhouseArt(g: SceneModel["greenhouse"]): string {
  const planters = g.plots
    .map((p, i) => {
      const x = 30 + i * 200;
      const cx = x + 85;
      return `<g class="planter${p.stage === "ready" ? " is-ready" : ""}">
    <path class="lightcone" d="M${cx - 14} -132L${cx - 70} -50H${cx + 70}L${cx + 14} -132z"/>
    <path class="growlamp" d="M${cx - 16} -140h32l-6 10h-20z"/><path class="hanger" d="M${cx} -156v16"/>
    ${plantArt(p, cx)}
    <rect class="soil" x="${x}" y="-50" width="170" height="8" rx="2"/>
    <rect class="box" x="${x}" y="-42" width="170" height="42" rx="3"/>
    <text class="plotno" x="${cx}" y="-16" text-anchor="middle">${i + 1}</text>
  </g>`;
    })
    .join("");
  return `<rect class="rig" x="20" y="-160" width="590" height="6" rx="2"/>
  <path class="pipe thin" d="M-20 -120H600"/>
  ${planters}`;
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
<g class="sv-bubble"><rect class="sv-bubble-box" x="-11" y="-94" width="22" height="22" rx="6"/><path d="M-4 -72l4 6 4 -6z"/><text class="sv-say" x="0" y="-78" text-anchor="middle">?</text></g>`;

// A survivor, optionally with a name tag that hides while they speak. The
// tag is sized roughly here and exactly by scene.js.
function survivor(cls: string, x: number, y: number, name?: string): string {
  const tag = name
    ? `<g class="sv-tag"><rect x="${-(name.length * 3.6 + 7)}" y="-86" width="${name.length * 7.2 + 14}" height="17" rx="4"/><text x="0" y="-74" text-anchor="middle">${escapeText(name)}</text></g>`
    : "";
  return `<g class="${cls}" data-x="${x}" data-y="${y}" transform="translate(${x} ${y})">${SURVIVOR}${tag}</g>`;
}

// The painted ladder tile holds three rungs; stretched a little so they're a
// step apart rather than packed tight.
const LADDER = { w: 96, h: 120 };

// Painted backdrops behind each room, in the order of Layout.rooms.
const ROOM_ART = ["generator", "purifier", "storage", "quarters", "greenhouse"];

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
      : k === "greenhouse" ? greenhouseArt(m.greenhouse)
      : quartersArt();
    const running = k === "generator" ? m.generator : k === "purifier" ? m.purifier : k === "greenhouse" ? m.greenhouse.lit : null;
    const cls = `eq eq-${k}${running === null ? "" : running ? " is-running" : " is-stopped"}`;
    return `<g class="${cls}" transform="translate(${p.x} ${L.floors[p.floor]}) scale(${p.s})">${art}</g>`;
  });
  const rung = (L.shaft.w * LADDER.h) / LADDER.w;
  const doorways = Object.entries(L.floors)
    .filter(([f]) => f !== "surface")
    .map(([, y]) => `<rect class="doorway" x="${L.shaft.x + L.shaft.w}" y="${y - 66}" width="${L.rooms[0].x - L.shaft.x - L.shaft.w}" height="66"/>`)
    .join("");
  const rooms = L.rooms
    .map(
      (r, i) => `<rect class="room" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>
  <image class="backdrop" href="/static/img/shelter/${ROOM_ART[i]}.jpg" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" preserveAspectRatio="xMidYMid slice"/>
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
    <pattern id="${idPrefix}-ladder" x="${L.shaft.x}" y="${L.shaft.y}" width="${L.shaft.w}" height="${rung}" patternUnits="userSpaceOnUse"><image href="/static/img/shelter/ladder.webp" width="${L.shaft.w}" height="${rung}" preserveAspectRatio="none"/></pattern>
    <pattern id="${idPrefix}-earth" width="34" height="29" patternUnits="userSpaceOnUse"><rect width="34" height="29" fill="#2e2921"/><circle cx="7" cy="9" r="2" fill="#26221b"/><circle cx="24" cy="20" r="1.5" fill="#3a342a"/></pattern>
  </defs>
  <rect class="sky" width="${L.w}" height="${L.ground}" fill="url(#${idPrefix}-sky)"/>
  <image class="backdrop backdrop-sky" href="/static/img/shelter/surface.jpg" width="${L.w}" height="${L.ground}" preserveAspectRatio="xMidYMid slice"/>
  <rect width="${L.w}" height="${L.h - L.ground}" y="${L.ground}" fill="url(#${idPrefix}-earth)"/>
  <rect class="shell" x="${L.shell.x}" y="${L.shell.y}" width="${L.shell.w}" height="${L.shell.h}" rx="6"/>
  <rect class="shaft" x="${L.shaft.x}" y="${L.shaft.y}" width="${L.shaft.w}" height="${L.shaft.h}"/>
  <rect class="ladder" x="${L.shaft.x}" y="${L.shaft.y}" width="${L.shaft.w}" height="${L.shaft.h}" fill="url(#${idPrefix}-ladder)"/>
  ${doorways}
  ${rooms}
  ${pieces.join("\n  ")}
  <g class="eq-hatch" transform="translate(${L.shaftX} ${L.ground})">${hatchArt(m.sealed)}</g>
  <g class="sc-visitors" aria-hidden="true"></g>
  ${
    m.occupied ? survivor("sv", start.x, L.floors[start.floor], m.people?.owner) : ""
  }
  ${m.occupied && m.people?.guest ? survivor("sv sv--guest", L.spot.hatch.x, L.floors.surface, "You") : ""}
  ${shades}
</svg>`;
}

function layoutData(L: Layout): string {
  const spots = Object.fromEntries(ITEM_ORDER.map((k) => [k, { y: L.floors[L.spot[k].floor], x: L.spot[k].x, face: L.spot[k].face }]));
  return JSON.stringify({ shaftX: L.shaftX, floors: Object.values(L.floors), spots, gate: { ...L.gate, y: L.floors.surface } });
}

// What the survivor says when they inspect each item, chosen by scene.js.
export type Sayings = Record<ItemKey, string[]>;

export function renderScene(
  m: SceneModel,
  hotspots: Hotspot[],
  state: string,
  sayings: Sayings,
  visitors: { id: number; name: string }[] = [],
): HtmlEscapedString {
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
  const json = JSON.stringify({ sayings, visitors }).replace(/</g, "\\u003c");
  return raw(
    `<div class="sc-stage ${state}" id="scene">${variant(WIDE)}${variant(TALL)}<script type="application/json" class="sc-sayings">${json}</script></div>`,
  ) as HtmlEscapedString;
}

const escapeText = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
