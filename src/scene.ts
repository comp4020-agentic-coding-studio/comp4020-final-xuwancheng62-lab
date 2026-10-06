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

// The rest of the equipment is painted too, placed in the same local boxes the
// drawings used. Anchor points are measured off the images.
const IMG = "/static/img/shelter";
const img = (name: string, x: number, y: number, w: number, h: number, extra = "", cls = "eq-art") =>
  `<image class="${cls}" href="${IMG}/${name}.webp" x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}"${extra}/>`;

// The shelf image is 320 × 480; its bottom three shelves are at these pixel rows.
const SHELF = { w: 146, h: 150, floors: [428, 340, 256], px: 480 };
// Stock comes in a few painted tins and jugs (pixel sizes), drawn at one width
// so a taller tin stands taller. Which one stands in which slot is fixed, so
// the shelf looks the same on every load and only changes when stock does.
const STOCK = {
  food: { w: 14, art: { "can-1": [80, 125], "can-2": [80, 109], "can-3": [80, 124] } as Record<string, [number, number]>, order: ["can-1", "can-2", "can-3", "can-3", "can-1", "can-2", "can-2", "can-3", "can-1"] },
  water: { w: 17, art: { "jug-1": [80, 122], "jug-2": [80, 124] } as Record<string, [number, number]>, order: ["jug-2", "jug-1", "jug-2", "jug-1", "jug-2", "jug-2", "jug-2", "jug-1", "jug-1"] },
};
// a little off the even spacing, as if put back by hand
const NUDGE = [-2, 1, 3, 2, -1, 0, 1, -3, -1];
function shelfArt(kind: "food" | "water", n: number): string {
  const s = STOCK[kind];
  const slots = [0.2, 0.5, 0.8].map((f) => SHELF.w * f);
  let items = "";
  for (let i = 0; i < n; i++) {
    // partway into the board's top face (the row is its back edge), so items stand on it
    const floor = -SHELF.h + (SHELF.floors[Math.floor(i / 3)] * SHELF.h) / SHELF.px + 3;
    const name = s.order[i];
    const [pw, ph] = s.art[name];
    const h = (s.w * ph) / pw;
    const cx = slots[i % 3] + NUDGE[i];
    items += `<ellipse class="contact" cx="${r1(cx + 1)}" cy="${r1(floor)}" rx="${r1(s.w * 0.62)}" ry="1.6"/>`;
    items += img(name, cx - s.w / 2, floor - h, s.w, h, "", "eq-art stock");
  }
  return `${img("shelf", 0, -SHELF.h, SHELF.w, SHELF.h, ` preserveAspectRatio="none"`)}${items}`;
}

// Scrap pokes out of the crate, one painted piece per unit.
const PIECES: [name: string, x: number, h: number, flip: boolean][] = [
  ["scrap-1", 10, 52, false],
  ["scrap-2", 46, 48, false],
  ["scrap-3", 80, 50, false],
  ["scrap-1", 98, 42, true],
  ["scrap-3", 28, 40, true],
  ["scrap-2", 64, 54, true],
];
const PIECE_PX: Record<string, [number, number]> = { "scrap-1": [100, 126], "scrap-2": [100, 117], "scrap-3": [100, 141] };
function scrapArt(n: number): string {
  const pieces = PIECES.slice(0, n)
    .map(([name, x, h, flip]) => {
      const [pw, ph] = PIECE_PX[name];
      const w = (h * pw) / ph;
      return flip
        ? `<g transform="translate(${r1(x * 2 + w)} 0) scale(-1 1)">${img(name, x, -h - 22, w, h)}</g>`
        : img(name, x, -h - 22, w, h);
    })
    .join("");
  return `${pieces}${img("crate", 0, -37, 130, 37)}`;
}

// The bed and nightstand; the bedside lamp glows while the lights are on.
function quartersArt(): string {
  return `<path class="tally" d="M40 -118v18M48 -118v18M56 -118v18M64 -118v18M36 -104l32 -10M84 -118v18M92 -118v18"/>
  ${img("bed", 10, -66, 214, 66)}
  <circle class="bedlamp" cx="39.4" cy="-49" r="16"/>`;
}

// Plants sit in the planter with their roots (or tuber, or the dirt they came
// up in) sunk behind its front board. Heights are what shows above the soil.
const PLANTS: Record<string, { px: [number, number]; sink: number }> = {
  sprout: { px: [160, 279], sink: 0.42 },
  "potatoes-growing": { px: [200, 283], sink: 0.3 },
  "potatoes-ready": { px: [200, 273], sink: 0.14 },
  "beans-growing": { px: [200, 504], sink: 0.03 },
  "beans-ready": { px: [200, 570], sink: 0.03 },
  "mushrooms-growing": { px: [200, 149], sink: 0.3 },
  "mushrooms-ready": { px: [200, 135], sink: 0.1 },
};
const SOIL = -73;
function plantArt(p: PlotLook, cx: number): string {
  if (p.stage === "empty" || !p.crop) return "";
  const mush = p.crop === "mushrooms";
  const name = p.stage === "sprout" ? (mush ? "mushrooms-growing" : "sprout") : `${p.crop}-${p.stage}`;
  const shows = mush ? { sprout: 9, growing: 18, ready: 30 }[p.stage] : { sprout: 16, growing: p.crop === "beans" ? 34 : 30, ready: p.crop === "beans" ? 54 : 44 }[p.stage];
  const { px, sink } = PLANTS[name];
  const h = shows / (1 - sink);
  const w = (h * px[0]) / px[1];
  return [-48, 0, 48]
    .map((dx, i) => {
      const s = i === 1 ? 1 : 0.88;
      return img(name, cx + dx - (w * s) / 2, SOIL - shows * s, w * s, h * s);
    })
    .join("");
}

// The grow lamps hang from a thin rail, itself hung from the ceiling on rods
// in the gaps between planters; `ceiling` is the room's top in local units.
const RAIL = { x: 20, w: 590, y: -161 };
function railArt(ceiling: number, lamps: number[]): string {
  const rods = [40, 215, 415, 590]
    .map((x) => `<path class="rail-rod" d="M${x} ${r1(ceiling)}V${RAIL.y}"/><rect class="rail-clamp" x="${x - 3}" y="${RAIL.y - 2.5}" width="6" height="6" rx="1"/><circle class="rail-bolt" cx="${x}" cy="${RAIL.y + 0.5}" r="0.9"/>`)
    .join("");
  const hooks = lamps
    .map((cx) => `<rect class="rail-clamp" x="${cx - 3.5}" y="${RAIL.y - 1}" width="7" height="4.5" rx="1"/><path class="rail-chain" d="M${cx} ${RAIL.y + 3.5}V-154"/>`)
    .join("");
  const rust = [72, 160, 268, 352, 471, 548].map((x, i) => `<rect class="rail-rust" x="${x}" y="${RAIL.y + (i % 2)}" width="${5 + (i % 3) * 3}" height="${2 - (i % 2)}"/>`).join("");
  return `<g class="rail">${rods}
    <rect class="rail-bar" x="${RAIL.x}" y="${RAIL.y}" width="${RAIL.w}" height="3"/>${rust}
    <path class="rail-hi" d="M${RAIL.x} ${RAIL.y + 0.4}h${RAIL.w}"/><path class="rail-lo" d="M${RAIL.x} ${RAIL.y + 2.8}h${RAIL.w}"/>
    <rect class="rail-clamp" x="${RAIL.x - 2}" y="${RAIL.y - 1.5}" width="4" height="6" rx="0.8"/><rect class="rail-clamp" x="${RAIL.x + RAIL.w - 2}" y="${RAIL.y - 1.5}" width="4" height="6" rx="0.8"/>
    ${hooks}</g>`;
}

function greenhouseArt(g: SceneModel["greenhouse"], ceiling: number): string {
  const planters = g.plots
    .map((p, i) => {
      const x = 30 + i * 200;
      const cx = x + 85;
      return `<g class="planter${p.stage === "ready" ? " is-ready" : ""}">
    <path class="lightcone" d="M${cx - 6} -121L${cx - 72} ${SOIL}H${cx + 72}L${cx + 6} -121z"/>
    ${img("growlamp", cx - 15, -155, 30, 36)}<circle class="growbulb" cx="${cx}" cy="-122" r="3"/>
    <g class="crop">${plantArt(p, cx)}</g>
    ${img("planter", x, -76.5, 170, 76.5)}
    <text class="plotno" x="${cx}" y="-14" text-anchor="middle">${i + 1}</text>
  </g>`;
    })
    .join("");
  return `${railArt(ceiling, g.plots.map((_, i) => 30 + i * 200 + 85))}
  ${planters}`;
}

// The hatch sits over the top of the shaft, sealed or swung open, its concrete
// rim sunk a little into the ground. Both images are the rim's width across.
function hatchArt(sealed: boolean): string {
  const [name, ph] = sealed ? ["hatch-shut", 110] : ["hatch-up", 151];
  const w = 72, h = (w * ph) / 200;
  return `<ellipse class="contact" cx="1" cy="2" rx="38" ry="4"/>${img(name, -w / 2, 4 - h, w, h)}`;
}

// A caged lamp hangs at the middle of each room's ceiling; its bulb and the
// light it throws come on with the shelter's lights.
const ceilingLamp = (x: number, y: number) => `<g class="ceil-lamp" transform="translate(${x} ${y})">
    <ellipse class="lamp-halo" cx="0" cy="13" rx="30" ry="12"/>
    <path class="lamp-stem" d="M0 0v5"/><rect class="lamp-cap" x="-3" y="0" width="6" height="2"/>
    <ellipse class="lamp-bulb" cx="0" cy="11.5" rx="4" ry="2.6"/>
    <path class="lamp-shade" d="M-11 11.2Q-10 4.5 0 4.5Q10 4.5 11 11.2z"/><path class="lamp-rim" d="M-11.6 11.2h23.2"/>
  </g>`;

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
      : k === "greenhouse" ? greenhouseArt(m.greenhouse, -(L.floors[p.floor] - L.rooms[ROOM_ART.indexOf("greenhouse")].y) / p.s)
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
${ROOM_ART[i] === "greenhouse" ? "" : ceilingLamp(r.x + r.w / 2, r.y)}`,
    )
    .join("");
  const shades = L.rooms.map((r) => `<rect class="shade" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>`).join("");
  const start = L.spot.quarters;

  return `<svg class="sc-svg" viewBox="0 0 ${L.w} ${L.h}" role="img" aria-label="Cutaway of the shelter">
  <defs>
    <radialGradient id="${idPrefix}-glow" cx="50%" cy="0%" r="75%"><stop offset="0" stop-color="#f0a83a" stop-opacity="0.26"/><stop offset="1" stop-color="#f0a83a" stop-opacity="0"/></radialGradient>
    <linearGradient id="${idPrefix}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121316"/><stop offset="0.65" stop-color="#1f1c18"/><stop offset="1" stop-color="#4a3824"/></linearGradient>
    <pattern id="${idPrefix}-ladder" x="${L.shaft.x}" y="${L.shaft.y}" width="${L.shaft.w}" height="${rung}" patternUnits="userSpaceOnUse"><image href="/static/img/shelter/ladder.webp" width="${L.shaft.w}" height="${rung}" preserveAspectRatio="none"/></pattern>
    <pattern id="${idPrefix}-earth" width="128" height="128" patternUnits="userSpaceOnUse"><image href="${IMG}/earth.jpg" width="128" height="128"/></pattern>
    <pattern id="${idPrefix}-concrete" width="128" height="128" patternUnits="userSpaceOnUse"><image href="${IMG}/concrete.jpg" width="128" height="128"/></pattern>
  </defs>
  <rect class="sky" width="${L.w}" height="${L.ground}" fill="url(#${idPrefix}-sky)"/>
  <image class="backdrop backdrop-sky" href="/static/img/shelter/surface.jpg" width="${L.w}" height="${L.ground}" preserveAspectRatio="xMidYMid slice"/>
  <rect width="${L.w}" height="${L.h - L.ground}" y="${L.ground}" fill="url(#${idPrefix}-earth)"/>
  <rect class="shell" x="${L.shell.x}" y="${L.shell.y}" width="${L.shell.w}" height="${L.shell.h}" rx="6" fill="url(#${idPrefix}-concrete)"/>
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
