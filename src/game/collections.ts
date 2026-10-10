import type { FragmentId } from "./stories.ts";

// Story collections (docs/narrative/toby-collection.md). A card is unlocked
// by finding any of its records, so progress is the journal's discoveries
// read another way: nothing to lose, nothing to keep in step. Pure.

export type SetId = "toby";
export interface Card {
  n: number;
  title: string;
  period: string;
  unlockedBy: FragmentId[];
  front: string;
  sure: string;
  // which comic panel's picture the card shows
  art: number;
}

// Words over a panel: narration boxes, speech balloons, asides. Kept as text,
// apart from the picture, so they can be edited and read by anyone.
export type Corner = "tl" | "tr" | "bl" | "br";
export interface Line {
  kind: "narration" | "speech" | "aside";
  who?: string;
  text: string;
  at: Corner;
  // which way a balloon's tail points, toward its speaker
  tail?: "down-left" | "down-right";
}

export interface Panel {
  n: number;
  // what the picture shows; also its text alternative
  scene: string;
  // null until painted; interim art is earlier art standing in
  art: { src: string; interim?: boolean } | null;
  lines: Line[];
}

// pair: two side by side on wide screens, stacked on phones; tall: one panel
// for the turns that matter
export interface ComicPage {
  layout: "pair" | "tall";
  panels: Panel[];
}

export interface CollectionSet {
  id: SetId;
  title: string;
  // shown before any card is found, so the set's name gives nothing away
  untitled: string;
  cards: Card[];
  comic: { title: string; pages: ComicPage[] };
}

const interim = (n: string) => ({ src: `/static/img/comic/toby/${n}.webp`, interim: true });
const N = (at: Corner, text: string): Line => ({ kind: "narration", at, text });
const S = (who: string, at: Corner, text: string): Line => ({ kind: "speech", who, at, text, tail: at.endsWith("r") ? "down-right" : "down-left" });

export const SETS: readonly CollectionSet[] = [
  {
    id: "toby",
    title: "Toby Wren",
    untitled: "Someone in the records",
    cards: [
      { n: 1, title: "Gerald sings", period: "Childhood", unlockedBy: ["cart-dogs", "our-loop"], art: 1, front: "A Year 5 kid who loved the Loop's carts, called one of them Gerald, and fed three dogs he said were his.", sure: "His own drawing and worksheet." },
      { n: 2, title: "One bag each", period: "The Ninth", unlockedBy: ["locker-6", "bus-2"], art: 4, front: "Ticked onto Bus 2 with his mum, Kerry, and a carrier bag of dog food.", sure: "A tick shows he was checked on, not that he arrived." },
      { n: 3, title: "Showground school", period: "Northfield", unlockedBy: ["chime-camp"], art: 5, front: "A school card: Tobias Wren, Year 8, Northfield showground. Someone has kept it for years.", sure: "The card is real. Who carries it now isn't certain." },
      { n: 4, title: "Quicker than me", period: "Apprentice", unlockedBy: ["dev-toolbag"], art: 9, front: "D.P.'s last log: “T doing the screens. Kid's quicker than me now, don't tell him.”", sure: "The log calls him T." },
      { n: 5, title: "He didn't show them", period: "Dev's fate", unlockedBy: ["chained-valve"], art: 11, front: "Chalk beside a chained valve: Dev Pillai killed here, 18 May, by Mercer's lot. Signed T.W.", sure: "An account, not something you saw." },
      { n: 6, title: "Don't go single", period: "Now", unlockedBy: ["chalk-warning"], art: 13, front: "Chalk in the bus shelter, warning travellers off the Ridge Road on Thursdays. Signed T.", sure: "Recent. The signature fits." },
      { n: 7, title: "Fourth letter", period: "Still writing", unlockedBy: ["toby-letter"], art: 14, front: "A letter waiting in the workshop's forwarding tin: “Mum, this is the fourth one.” Signed Toby.", sure: "His own words. Whether any reached her isn't known." },
    ],
    comic: {
      title: "The Cart Kid",
      pages: [
        { layout: "pair", panels: [
          { n: 1, art: interim("01"), scene: "A sunny suburban footpath, gum trees and brick houses. A small white cart with a painted smiling face stands parked; beside it an eleven-year-old boy kneels, holding out scraps to three dogs.", lines: [
            N("tl", "Calder, before. Toby Wren was eleven, and Cart 4 was his best friend."),
            S("Toby", "br", "Gerald's late again. Sorry, guys."),
          ] },
          { n: 2, art: null, scene: "A supermarket in the evening. Kerry at the till in her teal polo; behind her Toby does homework on an upturned crate, a tin of dog food poking out of his school bag.", lines: [
            S("Kerry", "tl", "Dog food is not a school lunch, Tobes."),
            S("Toby", "br", "It's not for me."),
            { kind: "aside", who: "Kerry", at: "tr", text: "I know who it's for." },
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 3, art: interim("02"), scene: "A staff room at night, lit only by an emergency light. A boy asleep across two plastic chairs under a jacket; lockers along the wall; a radio on the shelf.", lines: [
            N("tl", "The Ninth. Twenty to four in the morning."),
            S("Kerry", "br", "Shoes on. Now. Don't ask, just shoes."),
          ] },
          { n: 4, art: interim("03"), scene: "The supermarket car park in the morning. A long queue for a white coach. In front, Toby in an adult-size orange hi-vis vest clutches a plastic carrier bag.", lines: [
            S("Ruth", "tr", "One bag each."),
            S("Toby", "bl", "It's for the dogs."),
            S("Ruth", "br", "…Let him."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 5, art: interim("05"), scene: "A showground seen from inside a tent: old pavilions, a dusty arena, a trestle table in the foreground.", lines: [
            N("tl", "Northfield showground. Two thousand people, one meal a day, three years."),
            N("br", "He learned to fix anything anyone would let him open."),
          ] },
          { n: 6, art: null, scene: "Inside a tent at night by lamplight. Toby, fourteen, a pack on his shoulder. Kerry stands between him and the flap, arms folded, tired.", lines: [
            S("Kerry", "tl", "There's nothing in Calder."),
            S("Toby", "tr", "There's everything in Calder."),
            N("bl", "He left with walkers heading for Kell Bridge before she woke. He didn't say goodbye properly."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 7, art: null, scene: "A trading shed by a weir, stacked with crates and purifier cartridges. Ruth, older, behind the counter with reading glasses down her nose, looks up at a road-dirty fourteen-year-old.", lines: [
            S("Ruth", "tl", "Kerry Wren's boy. You've grown into the vest."),
            S("Ruth", "bl", "Dev needs hands. Go on."),
          ] },
          { n: 8, art: null, scene: "A workbench in a weir plant. Dev, tall and bearded in navy overalls, packs a purifier cartridge while Toby watches closely, sleeves pushed up.", lines: [
            S("Dev", "tl", "Quarter turn. Never more."),
            S("Toby", "tr", "What happens if you do more?"),
            S("Dev", "bl", "You find out. So does everyone downstream."),
          ] },
        ] },
        { layout: "tall", panels: [
          { n: 9, art: interim("07"), scene: "Inside a concrete water-works tunnel by torchlight: a man kneels clearing intake screens in shallow water; further down the tunnel a teenager works beside the next screen.", lines: [
            N("tl", "Every autumn they walked back to Calder to clear the intake, so Kell Bridge would have water."),
            S("Dev", "bl", "You're quicker than me now."),
            S("Toby", "tr", "I know."),
            S("Dev", "br", "Don't tell anyone I said that."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 10, art: null, scene: "The tunnel, torchlight from the far end: grey-coated figures in respirators, shapes only. Dev stands between them and Toby, one arm back, pushing Toby toward a side pipe.", lines: [
            N("tl", "18 May. The Ash Hounds wanted the valve."),
            S("Dev", "br", "Pipe. Go. Don't stop."),
          ] },
          { n: 11, art: interim("08"), scene: "An iron valve wheel wrapped in chain, a padlock and a yellow tag, chalk marks on the wall below.", lines: [
            N("tl", "Dev wouldn't give it to them."),
            N("br", "Toby came back when they'd gone. He wrote down what happened, so someone would know."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 12, art: interim("09"), scene: "The mouth of an underpass at dusk: the cart with the painted face lies on its side, steel bowls beside it, dogs close by and more watching from the open ground.", lines: [
            N("tl", "Calder. The dogs still came to Gerald's song. Not Bigsy. Maybe his grandchildren."),
            S("Toby", "br", "Easy. It's only me."),
          ] },
          { n: 13, art: interim("10"), scene: "The inside wall of a bus shelter at dusk: a chalk drawing of a sitting dog. An empty highway outside.", lines: [
            N("tl", "He fixes what people bring him. They pay in food."),
            N("br", "And he tells travellers where not to be."),
          ] },
        ] },
        { layout: "tall", panels: [
          { n: 14, art: null, scene: "The old workshop at dawn. Toby, sixteen, slips a folded letter into a dented tin by the office door. His face, finally, in the light.", lines: [
            N("tl", "Toby Wren is sixteen. He's alive, and he's staying until the valve is open."),
            S("Toby", "bl", "“Mum. This is the fourth one. If you got the others, skip the first bit…”"),
            N("br", "Then he's going to Northfield. He promised."),
          ] },
        ] },
      ],
    },
  },
];

export const collectionSet = (id: string): CollectionSet | undefined => SETS.find((s) => s.id === id);

export const panels = (set: CollectionSet): Panel[] => set.comic.pages.flatMap((p) => p.panels);

export const isUnlocked = (card: Card, found: readonly FragmentId[]): boolean => card.unlockedBy.some((f) => found.includes(f));

export const unlockedCount = (set: CollectionSet, found: readonly FragmentId[]): number => set.cards.filter((c) => isUnlocked(c, found)).length;

export const isComplete = (set: CollectionSet, found: readonly FragmentId[]): boolean => unlockedCount(set, found) === set.cards.length;

// The comic opens for a complete set, and stays open for anyone who completed
// it before a card was added: their reward is the record that they did.
export const canRead = (set: CollectionSet, found: readonly FragmentId[], rewarded: boolean): boolean => rewarded || isComplete(set, found);
