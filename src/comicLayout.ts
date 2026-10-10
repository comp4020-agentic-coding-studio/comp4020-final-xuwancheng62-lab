import type { Line, Panel } from "./game/collections.ts";

// Where a panel's words go. Pure, so the layout is the same on every load and
// can be checked without a browser.
//
// On wide screens a panel is a "stage": the picture in the middle, with
// whitespace above, below and to the sides. Every size here is in percent of
// the stage's width, and the text is sized the same way (CSS cqw units), so
// a line wraps at the same word on any wide screen and the boxes can be laid
// out here rather than measured in the browser.
//
// Each balloon sits where its panel says (Panel.balloons), chosen by eye for
// that picture: near its speaker, clear of faces, standing out past the
// picture's edge when that keeps it closer. Its tail points at the speaker's
// head, or wherever the panel says the voice comes from. The stage grows
// above and below to fit any balloon that stands out past the picture.
// Narration is a caption box above the picture, or under it once nobody
// speaks after it, or placed like a balloon if it falls between two speeches. Phones stack the same boxes above and below the picture
// at a readable size, each lined up over its speaker (collection.css).

export const STAGE = {
  // the picture spans x 10–90; the sides are whitespace balloons can use
  imgX: 10,
  imgW: 80,
  imgH: 80 * (800 / 1280),
  // text size, as in collection.css (--cm-f)
  font: 1.65,
  // a bold sans character is about this many ems wide, on average
  charEm: 0.56,
  lineEm: 1.28,
  padEm: 0.5,
  speechW: 30,
  narrationW: 38,
  gap: 1.4,
  // half the width of a tail where it leaves its balloon
  tailHalf: 1.1,
} as const;

export interface Box {
  line: Line;
  // captions above the picture, balloons, captions below it
  band: "top" | "balloon" | "bottom";
  x: number;
  y: number;
  w: number;
  h: number;
  // a tail: the two corners of its base, inside the balloon, and its tip
  tail?: { b1: [number, number]; b2: [number, number]; tip: [number, number] };
  // phones: where the speaker is across the picture, 0–100
  across?: number;
}

export interface Layout {
  height: number;
  imgY: number;
  boxes: Box[];
}

// How tall a box of text is, from how many lines it wraps to.
export function boxSize(text: string, maxW: number): { w: number; h: number } {
  const S = STAGE;
  const charW = S.charEm * S.font;
  const pad = 2 * S.padEm * S.font + 0.6;
  const perLine = Math.max(8, Math.floor((maxW - pad) / charW));
  const words = text.split(/\s+/);
  let lines = 1;
  let len = 0;
  let longest = 0;
  for (const word of words) {
    const add = len ? len + 1 + word.length : word.length;
    if (add > perLine && len) {
      longest = Math.max(longest, len);
      lines++;
      len = word.length;
    } else len = add;
  }
  longest = Math.max(longest, len);
  return { w: Math.min(maxW, longest * charW + pad), h: lines * S.lineEm * S.font + pad };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// A point on the picture, from fractions of it to stage units (y from the
// picture's top).
const onImage = (fx: number, fy: number): [number, number] => [STAGE.imgX + fx * STAGE.imgW, fy * STAGE.imgH];

// Captions in rows, left or right as their corner says; a later one shares a
// row only if it fits to the right of the one before.
function captions(lines: Line[]): { boxes: Omit<Box, "band">[]; height: number } {
  const S = STAGE;
  const rows: { y: number; h: number; right: number }[] = [];
  const boxes = lines.map((line) => {
    const { w, h } = boxSize(line.text, S.narrationW);
    const x = line.at.endsWith("l") ? 0.5 : 99.5 - w;
    let row = rows.at(-1);
    if (!row || x < row.right + S.gap) {
      row = { y: row ? row.y + row.h + S.gap : 0, h: 0, right: 0 };
      rows.push(row);
    }
    row.h = Math.max(row.h, h);
    row.right = x + w;
    return { line, x, y: row.y, w, h };
  });
  return { boxes, height: rows.length ? rows.at(-1)!.y + rows.at(-1)!.h : 0 };
}

export function layoutPanel(p: Panel): Layout {
  const S = STAGE;
  // a caption before anyone speaks goes above the picture, one after the last
  // speech under it if it's a bottom corner; one between two speeches is
  // placed by hand, like a balloon, so the page reads in the script's order
  const said = p.lines.map((l) => l.kind !== "narration");
  const first = said.indexOf(true);
  const last = said.lastIndexOf(true);
  const placed = p.lines.filter((l, i) => l.kind !== "narration" || (first < i && i < last));
  const bottomLines = p.lines.filter((l, i) => l.kind === "narration" && l.at.startsWith("b") && i > last);
  const top = captions(p.lines.filter((l) => !placed.includes(l) && !bottomLines.includes(l)));
  const bottom = captions(bottomLines);

  // balloons, relative to the picture's top-left for now
  const balloons = placed.map((line, k) => {
    const { w, h } = boxSize(line.text, line.kind === "narration" ? S.narrationW : S.speechW);
    const at = p.balloons?.[k] ?? [0.5, -0.12];
    const [cx, cy] = onImage(at[0], at[1]);
    const head = line.kind !== "narration" && line.who ? p.heads?.[line.who] : undefined;
    const to = line.kind === "narration" ? undefined : at.length === 4 ? [at[2], at[3]] : head;
    return { line, x: clamp(cx - w / 2, 0.5, 99.5 - w), y: cy - h / 2, w, h, to: to && onImage(to[0], to[1]), head };
  });
  const above = Math.max(0, ...balloons.map((b) => -b.y + 0.5));
  const below = Math.max(0, ...balloons.map((b) => b.y + b.h - S.imgH + 0.5));
  const imgY = (top.height ? top.height + S.gap : 0) + above;
  const bottomY = imgY + S.imgH + below + (bottom.height ? S.gap : 0);

  const boxes: Box[] = [
    ...top.boxes.map((b) => ({ ...b, band: "top" as const })),
    ...balloons.map(({ to, head, ...b }) => {
      const box: Box = { ...b, y: imgY + b.y, band: "balloon", across: ((head ? head[0] : (b.x + b.w / 2 - S.imgX) / S.imgW) * 100) };
      if (!to) return box;
      const tip: [number, number] = [to[0], imgY + to[1]];
      // the base sits inside the balloon, on the side facing the tip, so the
      // balloon covers it and the tail seems to grow out of its edge
      const inset = (lo: number, size: number, v: number) => clamp(v, lo + Math.min(2, size / 2), lo + size - Math.min(2, size / 2));
      const base: [number, number] = [inset(box.x, box.w, tip[0]), inset(box.y, box.h, tip[1])];
      const dx = tip[0] - base[0];
      const dy = tip[1] - base[1];
      const len = Math.hypot(dx, dy) || 1;
      const [ux, uy] = [dx / len, dy / len];
      // stop short of the face, and spread the base across the tail's line
      const end: [number, number] = [tip[0] - ux * 1.5, tip[1] - uy * 1.5];
      const [px, py] = [-uy * S.tailHalf, ux * S.tailHalf];
      box.tail = { b1: [base[0] + px, base[1] + py], b2: [base[0] - px, base[1] - py], tip: end };
      return box;
    }),
    ...bottom.boxes.map((b) => ({ ...b, band: "bottom" as const, y: bottomY + b.y })),
  ];
  return { height: bottomY + bottom.height + 0.5, imgY, boxes };
}
