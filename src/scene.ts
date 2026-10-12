import { raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";

// The shelter cutaway, drawn twice: a wide two-floor plan and a tall
// four-floor one for phones. Both share the same items, so the survivor
// script (static/scene.js) only needs each layout's floors, shaft and spots.

export type CoreItemKey = "hatch" | "generator" | "purifier" | "greenhouse" | "food" | "water" | "scrap" | "quarters";
export type ItemKey = CoreItemKey | "workshop" | "farm" | "recycler";
export const ITEM_ORDER: readonly CoreItemKey[] = ["hatch", "generator", "purifier", "greenhouse", "food", "water", "scrap", "quarters"];

export type PlotStage = "empty" | "sprout" | "growing" | "ready";
export interface PlotLook {
  stage: PlotStage;
  crop: string | null;
}

export interface SceneModel {
  tiers?: Record<string,number>;
  production?: Record<string,boolean>;
  doorCondition?: number;
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
  // On your own shelter: who lives here besides you. They stay home when you
  // go out, and keep out of sight of visitors.
  residents?: string[];
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
  rooms: (Box & { art?: string; facility?: ItemKey })[];
  place: Partial<Record<Exclude<ItemKey, "hatch">, { x: number; floor: string; s: number }>>;
  hot: Partial<Record<ItemKey, Box>>;
  spot: Partial<Record<ItemKey, Spot>>;
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

function baseLayout(original:Layout,m:SceneModel):Layout {
  const L=structuredClone(original);
  const extensions=["workshop","farm","recycler"].filter(k=>(m.tiers?.[k]??0)>0) as ("workshop"|"farm"|"recycler")[];
  const art={workshop:"workshop",farm:"cultivation",recycler:"recycling"};
  for(const [i,k] of extensions.entries()) {
    const floor=L.id==="wide"?"extension":`extension-${k}`;
    const y=L.id==="wide"?894:1118+194*(i+1);
    const x=L.id==="wide"?100+i*280:62;
    L.floors[floor]=y;
    L.rooms.push({x,y:y-166,w:L.id==="wide"?270:282,h:166,facility:k,art:`/static/img/base/${art[k]}.webp`});
    L.place[k]={x:x+8,floor,s:L.id==="wide"?.88:.9};
    L.hot[k]={x:x+8,y:y-136,w:254,h:136};
    L.spot[k]={floor,x:x+24,face:1};
  }
  const extra=L.id==="wide"?(extensions.length?190:0):extensions.length*194;
  L.h+=extra;L.shell.h+=extra;L.shaft.h+=extra;
  const dx=0,dy=20;
  L.h+=dy;L.ground+=dy;

  L.shell.y+=dy;L.shaft.y+=dy;
  for(const k of Object.keys(L.floors))L.floors[k]+=dy;
  for(const r of L.rooms){r.x+=dx;r.y+=dy;}
  for(const p of Object.values(L.place))p.x+=dx;
  for(const b of Object.values(L.hot)){b.x+=dx;b.y+=dy;}
  for(const p of Object.values(L.spot))p.x+=dx;
  L.spot.hatch={floor:"surface",x:230,face:-1};
  L.hot.hatch={x:161,y:L.floors.surface-93,w:132,h:93};
  L.gate={x:320,step:16,max:L.id==="wide"?3:2};
  return L;
}

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
function hatchArt(sealed: boolean, tier=1, condition=1): string {
  return `<image href="/static/img/base/entrance.webp" x="-28" y="-91" width="137" height="91"/>
  ${tier>=2?'<rect class="sc-door-brace" x="9" y="-43" width="62" height="5" rx="1"/>':""}
  ${tier>=3?'<rect class="sc-door-brace" x="9" y="-62" width="62" height="5" rx="1"/><path class="sc-tier-pipe" d="M0 -80H85V-15"/>':""}
  ${condition<.5?'<path class="sc-door-damage" d="M30 -72l9 14-8 8 13 18"/>':""}
  <circle cx="88" cy="-55" r="3" fill="${sealed?"#bf8945":"#91b682"}"/>
  <text class="sc-tier-label" transform="translate(80 0) scale(-1 1)" x="40" y="-8" text-anchor="middle">VAULT · ${tier}</text>`;
}

// A caged lamp hangs at the middle of each room's ceiling; its bulb and the
// light it throws come on with the shelter's lights.
const ceilingLamp = (x: number, y: number) => `<g class="ceil-lamp" transform="translate(${x} ${y})">
    <ellipse class="lamp-halo" cx="0" cy="13" rx="30" ry="12"/>
    <path class="lamp-stem" d="M0 0v5"/><rect class="lamp-cap" x="-3" y="0" width="6" height="2"/>
    <ellipse class="lamp-bulb" cx="0" cy="11.5" rx="4" ry="2.6"/>
    <path class="lamp-shade" d="M-11 11.2Q-10 4.5 0 4.5Q10 4.5 11 11.2z"/><path class="lamp-rim" d="M-11.6 11.2h23.2"/>
  </g>`;

// Drawn facing right, lit from above and behind: the far limbs are darker,
// and the front of the coat and under the chin fall into shade. Each limb is
// a group so it swings with its boot or hand.
const SURVIVOR = `<g class="sv-flip">
  <ellipse class="sv-shadow" cx="0" cy="0" rx="11" ry="2.2"/>
  <g class="sv-bob">
    <g class="sv-limb sv-leg sv-leg-b"><path class="sv-trouser" d="M-3 -26V-5"/><path class="sv-boot" d="M-6.5 -5.5h5.5q3.5 0 4 4V0h-9.5z"/></g>
    <g class="sv-limb sv-arm sv-arm-b"><path class="sv-sleeve" d="M-3 -45L-4.5 -31"/><circle class="sv-hand" cx="-4.6" cy="-29.4" r="2"/></g>
    <rect class="sv-roll" x="-17.5" y="-51.5" width="11" height="5" rx="2.5"/>
    <rect class="sv-pack" x="-16" y="-47" width="9" height="19" rx="2.5"/>
    <path class="sv-pack-shade" d="M-16 -36h9v5.5q0 2.5 -2.5 2.5h-4q-2.5 0 -2.5 -2.5z"/>
    <path class="sv-pack-line" d="M-16 -42.5h9"/>
    <path class="sv-torso" d="M-9 -26Q-11 -45 0 -49Q11 -45 9 -26z"/>
    <path class="sv-shade" d="M9 -26Q10.3 -38 5.5 -46Q4.5 -36 1.5 -26zM-9 -26Q-9.4 -29 -9.3 -30H9.3Q9.4 -29 9 -26z"/>
    <path class="sv-strap" d="M-7.8 -44Q-3 -46.5 1 -43.5L0.6 -27.5"/>
    <path class="sv-collar" d="M-4.5 -47.6Q0 -44 5 -47.6L3.4 -50Q0 -48.2 -2.8 -50z"/>
    <path class="sv-belt" d="M-9.3 -30H9.3"/><rect class="sv-buckle" x="4" y="-31.3" width="2.6" height="2.6"/>
    <g class="sv-limb sv-leg sv-leg-f"><path class="sv-trouser" d="M3 -26V-5"/><path class="sv-boot" d="M0 -5.5h5.5q3.5 0 4 4V0H0z"/></g>
    <circle class="sv-head" cx="0" cy="-56" r="7.5"/>
    <path class="sv-face-shade" d="M-6.2 -51.8A7.5 7.5 0 0 0 7.2 -53.6Q2 -51 -6.2 -51.8z"/>
    <path class="sv-hair" d="M-7.7 -54.5Q-8.8 -64 0 -64Q6.4 -64 7.6 -58.5Q2.5 -61.2 -2.5 -59.5Q-3.2 -56 -7.7 -54.5z"/>
    <path class="sv-goggle-strap" d="M-7.4 -59.2Q0 -61 7.4 -59.4"/>
    <rect class="sv-goggles" x="1.6" y="-62" width="6.6" height="4" rx="1.6"/><circle class="sv-lens" cx="5.4" cy="-60" r="1.2"/>
    <circle class="sv-eye" cx="4.8" cy="-55.6" r="0.85"/>
    <g class="sv-limb sv-arm sv-arm-f"><path class="sv-sleeve" d="M3 -45L6 -31"/><circle class="sv-hand" cx="6.2" cy="-29.4" r="2"/></g>
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
    const p = L.place[k]!;
    const art =
      k === "generator" ? generatorArt()
      : k === "purifier" ? purifierArt(m.tank)
      : k === "food" ? shelfArt("food", m.items.food)
      : k === "water" ? shelfArt("water", m.items.water)
      : k === "scrap" ? scrapArt(m.items.scrap)
      : k === "greenhouse" ? greenhouseArt(m.greenhouse, -(L.floors[p.floor] - L.rooms[4].y) / p.s)
      : k === "quarters" ? quartersArt()
      : k === "workshop" ? `<image href="/static/img/base/workbench.webp" x="5" y="-120" width="180" height="120"/>${(m.tiers?.workshop??1)>=2?'<image href="/static/img/base/workbench.webp" x="145" y="-70" width="105" height="70"/>':""}`
      : k === "farm" ? ((m.tiers?.farm??1)>=2?img("planter",110,-60,130,60):"")
      : ((m.tiers?.recycler??1)>=2?img("crate",150,-38,110,38):"");
    const tier=m.tiers?.[k]??1;
    const kit=tier>=2 && ["generator","purifier"].includes(k)?`<g class="sc-upgrade">
      <image href="${IMG}/${k}.webp" x="${k==="generator"?225:110}" y="${k==="generator"?-60:-122}" width="${k==="generator"?90:64}" height="${k==="generator"?60:122}"/>
      <path class="sc-tier-pipe" d="M${k==="generator"?225:110} -40h-14v-30"/>
      ${tier===3?`<image href="${IMG}/${k}.webp" x="${k==="generator"?180:175}" y="${k==="generator"?-60:-110}" width="${k==="generator"?65:54}" height="${k==="generator"?60:110}"/>`:""}
      </g>`:"";
    const running = k === "generator" ? m.generator : k === "purifier" ? m.purifier : k === "greenhouse" ? m.greenhouse.lit : m.production?.[k] ?? null;
    const cls = `eq eq-${k}${running === null ? "" : running ? " is-running" : " is-stopped"}`;
    return `<g class="${cls}" transform="translate(${p.x} ${L.floors[p.floor]}) scale(${p.s})">${art}${kit}</g>`;
  });
  const rung = (L.shaft.w * LADDER.h) / LADDER.w;
  const roomLeft=L.rooms[0].x,roomRight=roomLeft+L.rooms[0].w;
  const shaftRight=L.shaft.x+L.shaft.w;
  const doorwayX=L.shaftX>roomRight?roomRight:shaftRight;
  const doorwayWidth=L.shaftX>roomRight?L.shaft.x-roomRight:roomLeft-shaftRight;
  const doorways = Object.entries(L.floors)
    .filter(([f]) => f !== "surface")
    .map(([, y]) => `<rect class="doorway" x="${doorwayX}" y="${y - 66}" width="${doorwayWidth}" height="66"/>`)
    .join("");
  const rooms = L.rooms
    .map(
      (r, i) => `<rect class="room" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>
  <image class="backdrop" href="${r.art??`/static/img/shelter/${ROOM_ART[i]}.jpg`}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" preserveAspectRatio="xMidYMid slice"/>
  <rect class="glow" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="url(#${idPrefix}-glow)"/>
${ROOM_ART[i] === "greenhouse" ? "" : ceilingLamp(r.x + r.w / 2, r.y)}
${(m.tiers?.[r.facility??ROOM_ART[i]]??1)>=3?`<rect class="sc-room-reinforce" x="${r.x+4}" y="${r.y+4}" width="${r.w-8}" height="${r.h-8}"/>`:""}
${r.facility?`<g class="sc-room-label"><rect x="${r.x+6}" y="${r.y+6}" width="116" height="18" rx="2"/><text x="${r.x+12}" y="${r.y+19}">${({workshop:"WORKSHOP",farm:"CULTIVATION",recycler:"RECYCLING"} as Record<string,string>)[r.facility]} · ${["","I","II","III"][m.tiers?.[r.facility]??1]}</text></g>`:""}`,
    )
    .join("");
  const shades = L.rooms.map((r) => `<rect class="shade" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>`).join("");
  const start = L.spot.quarters!;

  return `<svg class="sc-svg" viewBox="0 0 ${L.w} ${L.h}" role="img" aria-label="Cutaway of the shelter">
  <defs>
    <radialGradient id="${idPrefix}-glow" cx="50%" cy="0%" r="75%"><stop offset="0" stop-color="#f0a83a" stop-opacity="0.26"/><stop offset="1" stop-color="#f0a83a" stop-opacity="0"/></radialGradient>
    <linearGradient id="${idPrefix}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121316"/><stop offset="0.65" stop-color="#1f1c18"/><stop offset="1" stop-color="#4a3824"/></linearGradient>
    <pattern id="${idPrefix}-ladder" x="${L.shaft.x}" y="${L.shaft.y}" width="${L.shaft.w}" height="${rung}" patternUnits="userSpaceOnUse"><image href="/static/img/shelter/ladder.webp" width="${L.shaft.w}" height="${rung}" preserveAspectRatio="none"/></pattern>
    <pattern id="${idPrefix}-earth" width="128" height="128" patternUnits="userSpaceOnUse"><image href="${IMG}/earth.jpg" width="128" height="128"/></pattern>
    <pattern id="${idPrefix}-concrete" width="128" height="128" patternUnits="userSpaceOnUse"><image href="${IMG}/concrete.jpg" width="128" height="128"/></pattern>
  </defs>
  <rect class="sky" width="${L.w}" height="${L.ground}" fill="url(#${idPrefix}-sky)"/>
  <path class="sc-mountain" d="M0 12Q95 -8 150 48L${L.spot.hatch!.x+60} ${L.floors.surface}H${L.w}V${L.h}H0Z" fill="url(#${idPrefix}-earth)"/>
  <path class="sc-ridge" d="M0 12Q95 -8 150 48L${L.spot.hatch!.x+60} ${L.floors.surface}H${L.w}"/>
  <g class="sc-entry-corridor" aria-label="Entrance tunnel leading from the vault door to the internal ladder">
    <rect x="${L.shaft.x}" y="${L.floors.surface-76}" width="${L.spot.hatch!.x-L.shaft.x}" height="76" fill="url(#${idPrefix}-concrete)"/>
    <path class="sc-tunnel-wall" d="M${L.shaft.x} ${L.floors.surface-76}H${L.spot.hatch!.x}M${L.shaft.x} ${L.floors.surface}H${L.spot.hatch!.x}"/>
    <path class="sc-tunnel-pipe" d="M${L.spot.hatch!.x-12} ${L.floors.surface-57}H${L.shaftX}"/>
    ${ceilingLamp((L.spot.hatch!.x+L.shaftX)/2,L.floors.surface-72)}
    <text class="sc-tunnel-sign" x="${(L.spot.hatch!.x+L.shaftX)/2}" y="${L.floors.surface-24}" text-anchor="middle">← ACCESS</text>
  </g>
  <rect class="shell" x="${L.shell.x}" y="${L.shell.y}" width="${L.shell.w}" height="${L.shell.h}" rx="6" fill="url(#${idPrefix}-concrete)"/>
  <rect class="shaft" x="${L.shaft.x}" y="${L.shaft.y}" width="${L.shaft.w}" height="${L.shaft.h}"/>
  <rect class="ladder" x="${L.shaft.x}" y="${L.shaft.y}" width="${L.shaft.w}" height="${L.shaft.h}" fill="url(#${idPrefix}-ladder)"/>
  ${doorways}
  ${rooms}
  ${pieces.join("\n  ")}
  <g class="eq-hatch" transform="translate(${L.spot.hatch!.x+40} ${L.floors.surface}) scale(-1 1)">${hatchArt(m.sealed,m.tiers?.gate??1,m.doorCondition??1)}</g>
  <g class="sc-visitors" aria-hidden="true"></g>
  ${
    m.occupied ? survivor("sv", start.x, L.floors[start.floor], m.people?.owner) : ""
  }
  ${m.occupied && m.people?.guest ? survivor("sv sv--guest", L.spot.hatch!.x, L.floors.surface, "You") : ""}
  ${m.residents?.includes("toby") ? survivor("sv sv--toby", L.spot.purifier!.x, L.floors[L.spot.purifier!.floor], "Toby") : ""}
  ${shades}
</svg>`;
}

function layoutData(L: Layout): string {
  const spots = Object.fromEntries(Object.entries(L.spot).map(([k,p]) => [k, { y: L.floors[p.floor], x:p.x, face:p.face }]));
  return JSON.stringify({ shaftX: L.shaftX, floors: Object.values(L.floors), spots, gate: { ...L.gate, y: L.floors.surface } });
}

// What the survivor says when they inspect each item, chosen by scene.js.
export type Sayings = Record<CoreItemKey, string[]> & Partial<Record<ItemKey,string[]>>;
// And what anyone else living here says, by who they are.
export type ResidentSayings = Record<string, Partial<Sayings>>;

export function renderScene(
  m: SceneModel,
  hotspots: Hotspot[],
  state: string,
  sayings: Sayings,
  visitors: { id: number; name: string }[] = [],
  residents: ResidentSayings = {},
): HtmlEscapedString {
  const variant = (L: Layout) => `<div class="sc sc-${L.id}" data-layout='${layoutData(L)}'>
  ${layoutSvg(L, m, `sc-${L.id}`)}
  ${hotspots
    .map((h, i) => {
      const b = L.hot[h.key];
      if(!b) return "";
      const end = b.x + b.w / 2 > L.w * 0.6 ? " sc-hot--end" : "";
      return `<a class="sc-hot${end}" href="#info-${h.key}" data-key="${h.key}" style="left:${pct(b.x, L.w)};top:${pct(b.y, L.h)};width:${pct(b.w, L.w)};height:${pct(b.h, L.h)}">
      <span class="sc-name">${escapeText(h.label)}</span></a>`;
    })
    .join("")}
</div>`;
  const json = JSON.stringify({ sayings, visitors, residents }).replace(/</g, "\\u003c");
  return raw(
    `<div class="sc-stage ${state}" id="scene">${variant(baseLayout(WIDE,m))}${variant(baseLayout(TALL,m))}<script type="application/json" class="sc-sayings">${json}</script></div>`,
  ) as HtmlEscapedString;
}

const escapeText = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
