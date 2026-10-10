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
// Speech goes in the whitespace above the picture, over its speaker, with a
// tail ending just above their head, so a balloon never covers a face.
// Earlier lines sit higher; a later line shares a row only if it's to the
// right of the one before. Narration is a caption box, top left or right, or
// under the picture once nobody speaks after it. Phones stack the same boxes
// above and below the picture at a readable size, each lined up over its
// speaker (collection.css).

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
  // room between the lowest balloon and the picture, for the tails
  tailRoom: 3,
} as const;

export interface Box {
  line: Line;
  band: "top" | "bottom";
  x: number;
  y: number;
  w: number;
  h: number;
  // a speech tail: from its base on the balloon to just above the head
  tail?: { bx: number; by: number; tx: number; ty: number };
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

// A speaker's head in stage units, if they're drawn in the panel.
const headOf = (p: Panel, l: Line): [number, number] | undefined => {
  const h = l.who ? p.heads?.[l.who] : undefined;
  return h ? [STAGE.imgX + h[0] * STAGE.imgW, h[1] * STAGE.imgH] : undefined;
};

export function layoutPanel(p: Panel): Layout {
  const S = STAGE;
  // narration goes under the picture only if nobody speaks after it, so the
  // order on the page is the order of the script
  const lastSpeech = p.lines.map((l) => l.kind !== "narration").lastIndexOf(true);
  const band = (l: Line, i: number): "top" | "bottom" =>
    l.kind === "narration" && l.at.startsWith("b") && i > lastSpeech ? "bottom" : "top";

  const place = (lines: { l: Line; i: number }[]) => {
    const rows: { y: number; h: number; right: number }[] = [];
    const out: Omit<Box, "band">[] = [];
    // the stretch of x each earlier tail runs down through, by row
    const tails: { row: number; who?: string; lo: number; hi: number }[] = [];
    // move a box sideways, as little as possible, so no other speaker's tail
    // from a row above runs through it. The same speaker's tail may: it then
    // links their two balloons (below), the way comics join one speaker's lines.
    const clear = (want: number, w: number, who: string | undefined, above: typeof tails) => {
      const others = above.filter((t) => t.who !== who);
      const free = (x: number) => !others.some((t) => x < t.hi + 1.5 && t.lo - 1.5 < x + w);
      const tries = [want, ...others.flatMap((t) => [t.hi + 1.5, t.lo - 1.5 - w])];
      const ok = tries.filter((x) => x >= 0.5 && x <= 99.5 - w && free(x));
      return ok.length ? ok.reduce((a, x) => (Math.abs(x - want) < Math.abs(a - want) ? x : a)) : want;
    };
    for (const { l } of lines) {
      const speech = l.kind !== "narration";
      const { w, h } = boxSize(l.text, speech ? S.speechW : S.narrationW);
      const head = speech ? headOf(p, l) : undefined;
      const left = l.at.endsWith("l");
      const want = clamp(head ? head[0] - w / 2 : left ? (speech ? S.imgX : 0.5) : 100 - (speech ? S.imgX : 0.5) - w, 0.5, 99.5 - w);
      let row = rows.at(-1);
      // join the current row if it fits to the right; tails from that row
      // start below it, so only the rows above matter
      let x = row ? clear(want, w, l.who, tails.filter((t) => t.row < rows.length - 1)) : want;
      if (!row || x < row.right + S.gap) {
        x = clear(want, w, l.who, tails);
        row = { y: row ? row.y + row.h + S.gap : 0, h: 0, right: 0 };
        rows.push(row);
      }
      row.h = Math.max(row.h, h);
      row.right = x + w;
      if (head) {
        const bx = clamp(head[0], x + 2, x + w - 2);
        tails.push({ row: rows.length - 1, who: l.who, lo: Math.min(bx, head[0]) - 1.1, hi: Math.max(bx, head[0]) + 1.1 });
      }
      out.push({ line: l, x, y: row.y, w, h, across: head ? ((head[0] - S.imgX) / S.imgW) * 100 : left ? 0 : 100 });
    }
    return { out, height: rows.length ? rows.at(-1)!.y + rows.at(-1)!.h : 0 };
  };

  const indexed = p.lines.map((l, i) => ({ l, i }));
  const top = place(indexed.filter(({ l, i }) => band(l, i) === "top"));
  const bottom = place(indexed.filter(({ l, i }) => band(l, i) === "bottom"));
  const imgY = top.height ? top.height + S.tailRoom : 0;
  const bottomY = imgY + S.imgH + (bottom.height ? S.gap : 0);

  const boxes: Box[] = [
    ...top.out.map((b, i) => {
      const head = b.line.kind !== "narration" ? headOf(p, b.line) : undefined;
      if (!head) return { ...b, band: "top" as const };
      // the tail leaves the balloon's bottom over the head, and stops short of it
      const bx = clamp(head[0], b.x + 2, b.x + b.w - 2);
      const by = b.y + b.h - 0.3;
      const tail = { bx, by, tx: head[0], ty: imgY + head[1] - 1 };
      // unless it runs into the same speaker's next balloon: then it ends there,
      // and that balloon's tail carries on to the head
      const at = (y: number) => bx + ((tail.tx - bx) * (y - by)) / (tail.ty - by);
      const next = top.out.slice(i + 1).find((c) => c.y > b.y && c.line.who === b.line.who && at(c.y) > c.x + 1 && at(c.y) < c.x + c.w - 1);
      if (next) Object.assign(tail, { tx: at(next.y), ty: next.y + 0.6 });
      return { ...b, band: "top" as const, tail };
    }),
    ...bottom.out.map((b) => ({ ...b, band: "bottom" as const, y: bottomY + b.y })),
  ];
  return { height: bottomY + bottom.height + (bottom.height ? 0.5 : 0), imgY, boxes };
}
