import type { FragmentId } from "./stories.ts";

// Story collections (docs/narrative/toby-collection.md). A card is unlocked
// by finding any of its records, so progress is the journal's discoveries
// read another way: nothing to lose, nothing to keep in step. Pure.

export type SetId = "toby";
// A card is a thing the player found: an object or a trace, shown as found,
// with its words quoted and nothing explained. A card with more than one
// record shows whichever of them the player has (the first, if both).
export interface Evidence {
  record: FragmentId;
  // concrete: what it is, not what it means
  title: string;
  where: string;
  // what the picture shows; also its text alternative
  shows: string;
  // words on it, as written
  reads?: string;
  // null until painted
  art: string | null;
}
export interface Card {
  n: number;
  evidence: Evidence[];
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
  // found objects drawn into the scene, so a reader recognises their cards
  objects?: FragmentId[];
}

// pair: two side by side on wide screens, stacked on phones; tall: one panel
// for the turns that matter
export interface ComicPage {
  layout: "pair" | "tall";
  panels: Panel[];
}

export interface CollectionSet {
  id: SetId;
  // named for its person only once the set is complete
  title: string;
  // until then, a theme that doesn't announce whose story it is
  theme: string;
  // before any card is found, so the set's name gives nothing away
  untitled: string;
  cards: Card[];
  comic: { title: string; pages: ComicPage[] };
}

const card = (n: string) => `/static/img/cards/toby/${n}.webp`;
// panel 1 is the first painting, kept; the rest are revision 3's
const panel = (n: string) => `/static/img/comic/toby/${n === "01" ? n : `p${n}`}.webp`;
const N = (at: Corner, text: string): Line => ({ kind: "narration", at, text });
const S = (who: string, at: Corner, text: string): Line => ({ kind: "speech", who, at, text, tail: at.endsWith("r") ? "down-right" : "down-left" });

export const SETS: readonly CollectionSet[] = [
  {
    id: "toby",
    title: "Toby Wren",
    theme: "Signed T.",
    untitled: "Someone in the records",
    cards: [
      { n: 1, evidence: [
        { record: "cart-dogs", title: "Crayon drawing", where: "FreshWay staff room, taped inside a cupboard door", art: card("crayon-drawing"),
          shows: "A child's crayon drawing taped inside a cupboard door: a white cart with a smiling face, music notes above it, and three dogs.",
          reads: "They come when Gerald sings. · Toby W." },
        { record: "our-loop", title: "Laminated worksheet", where: "Pumping station education room", art: card("worksheet"),
          shows: "A curled laminated school worksheet pinned to a display board, a child's handwriting under the glare, gold and red stars.",
          reads: "OUR LOOP by Toby Wren 5W" },
      ] },
      { n: 2, evidence: [
        { record: "bus-2", title: "Bus 2 passenger list", where: "FreshWay cash office, a binder of carbon copies", art: card("passenger-list"),
          shows: "A carbon-copy passenger list on a clipboard, rows of handwriting, a column of blue ticks.",
          reads: "15. WREN, Tobias (11) ✓ (carrier bag of dog food?? let him)" },
        { record: "locker-6", title: "School photo in Locker 6", where: "FreshWay staff room, locker labelled K. WREN", art: card("locker-6"),
          shows: "Inside an open staff locker: a school photo of a boy in an orange hi-vis vest taped to the back, a child's navy jumper on the hook.",
          reads: "Kerry, I'll take your Sat so you can get T to the dentist. R." },
      ] },
      { n: 3, evidence: [
        { record: "chime-camp", title: "Laminated school card", where: "Pinned inside a cart's bin, the underpass", art: card("school-card"),
          shows: "A worn laminated school ID card with a boy's photo, on a lanyard, lying on a folded map in a cart's bin.",
          reads: "NORTHFIELD SHOWGROUND SCHOOL · Tobias Wren · Yr 8" },
      ] },
      { n: 4, evidence: [
        { record: "dev-toolbag", title: "Intake logbook", where: "A tin in a toolbag stencilled D.P., the old works gallery", art: card("logbook"),
          shows: "A water-stained logbook lying open in a dark tunnel, pages of handwriting, a canvas bag behind it.",
          reads: "T DOING THE SCREENS. KID'S QUICKER THAN ME NOW, DON'T TELL HIM." },
      ] },
      { n: 5, evidence: [
        { record: "chained-valve", title: "Chalk by the valve", where: "The outflow valve, the old works gallery", art: card("valve-chalk"),
          shows: "An iron valve wheel on a tunnel wall, wrapped in chain and padlocked, chalk marks on the concrete beside it.",
          reads: "DEV PILLAI KILLED HERE 18 MAY BY MERCER'S LOT. HE DIDN'T SHOW THEM WHERE. T.W." },
      ] },
      { n: 6, evidence: [
        { record: "chalk-warning", title: "Chalk in the bus shelter", where: "Bus shelter, FreshWay car park", art: card("shelter-chalk"),
          shows: "Chalk on the inside wall of a bus shelter, gone over more than once, a small dog drawn beside it.",
          reads: "AH ON RIDGE RD THURS. DON'T GO SINGLE. T" },
      ] },
      { n: 7, evidence: [
        { record: "toby-letter", title: "Letter in the forwarding tin", where: "Ruined Workshop, inside the office door", art: card("letter"),
          shows: "A dented biscuit tin on a shelf inside a doorway, its lid beside it, a folded note pinned to the letter inside.",
          reads: "Mum, This is the fourth one. … Toby" },
      ] },
    ],
    comic: {
      title: "The Cart Kid",
      pages: [
        { layout: "pair", panels: [
          { n: 1, art: { src: panel("01") }, scene: "A sunny suburban footpath, gum trees and brick houses. A small white cart with a painted smiling face stands parked; beside it an eleven-year-old boy kneels, holding out scraps to three dogs.", lines: [
            N("tl", "Calder, before. Toby Wren was eleven, and Cart 4 was his best friend."),
            S("Toby", "br", "Gerald's late again. Sorry, guys."),
          ] },
          { n: 2, art: { src: panel("02") }, objects: ["our-loop"], scene: "A supermarket in the evening. Toby, eleven, in his hi-vis vest, sits on a crate filling in a school worksheet on a clipboard; behind him Kerry looks back from the till.", lines: [
            S("Kerry", "tl", "Dog food is not a school lunch, Tobes."),
            S("Toby", "br", "It's not for me."),
            { kind: "aside", who: "Kerry", at: "tr", text: "I know who it's for." },
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 3, art: { src: panel("03") }, objects: ["locker-6", "cart-dogs"], scene: "Night in the staff room by a green emergency light. Kerry, in her teal polo, wakes Toby asleep across the chairs. Behind her a locker with a school photo taped to it, and a child's drawing on the cupboard door.", lines: [
            N("tl", "The Ninth. Twenty to four in the morning."),
            S("Kerry", "br", "Shoes on. Now. Don't ask, just shoes."),
          ] },
          { n: 4, art: { src: panel("04") }, objects: ["bus-2"], scene: "The car park in the morning, a crowd queueing for the bus. Toby, in an orange hi-vis vest, holds a carrier bag; Ruth, in glasses, writes on a clipboard of yellow forms.", lines: [
            S("Ruth", "tr", "One bag each."),
            S("Toby", "bl", "It's for the dogs."),
            S("Ruth", "br", "…Let him."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 5, art: { src: panel("05") }, objects: ["chime-camp"], scene: "A tent school at the showground: Toby, thirteen, at a trestle table beside a radio he's taking apart, a school card on a lanyard round his neck; tents and a crowd outside.", lines: [
            N("tl", "Northfield showground. Two thousand people, one meal a day, three years."),
            N("br", "He learned to fix anything anyone would let him open."),
          ] },
          { n: 6, art: { src: panel("06") }, scene: "Inside a tent at night by lamplight: Toby, fourteen, and Kerry face each other, both with their arms folded.", lines: [
            S("Kerry", "tl", "There's nothing in Calder."),
            S("Toby", "tr", "There's everything in Calder."),
            N("bl", "He left with walkers heading for Kell Bridge before she woke. He didn't say goodbye properly."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 7, art: { src: panel("07") }, scene: "A trading shed by a weir, shelves of supplies. Ruth, older, in glasses and a checked shirt, leans on the counter looking at Toby, fourteen, a pack on his back.", lines: [
            S("Ruth", "tl", "Kerry Wren's boy. You've grown into the vest."),
            S("Ruth", "bl", "Dev needs hands. Go on."),
          ] },
          { n: 8, art: { src: panel("08") }, scene: "A workbench in a water plant. Dev, bearded, a head torch on, packs a purifier cartridge while Toby watches closely.", lines: [
            S("Dev", "tl", "Quarter turn. Never more."),
            S("Toby", "tr", "What happens if you do more?"),
            S("Dev", "bl", "You find out. So does everyone downstream."),
          ] },
        ] },
        { layout: "tall", panels: [
          { n: 9, art: { src: panel("09") }, objects: ["dev-toolbag"], scene: "A water-works tunnel by torchlight. Dev sits writing in a small notebook, his bag beside him; far down the tunnel a small figure works in the water.", lines: [
            N("tl", "Every autumn they walked back to Calder to clear the intake, so Kell Bridge would have water."),
            S("Toby", "tr", "Three and four, done. What's next?"),
            S("Dev", "bl", "Already? …The valve."),
            N("br", "Dev never said it out loud. He wrote it down."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 10, art: { src: panel("10") }, scene: "The tunnel: hooded figures in respirators at the far end. Dev, seen from behind, spreads his arms to block them, beside a dark side pipe.", lines: [
            N("tl", "18 May. The Ash Hounds wanted the valve."),
            S("Dev", "br", "Pipe. Go. Don't stop."),
          ] },
          { n: 11, art: { src: panel("11") }, objects: ["chained-valve"], scene: "A dark tunnel by the chained valve. Toby kneels with his back to us, chalk in hand, at the wall.", lines: [
            N("tl", "Dev wouldn't give it to them."),
            N("br", "Toby came back when they'd gone. He wrote down what happened, so someone would know."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 12, art: { src: panel("12") }, objects: ["chime-camp"], scene: "The underpass at dusk: the cart with the painted face, a solar panel on top, steel bowls. Toby crouches among a pack of big feral dogs.", lines: [
            N("tl", "Calder. The dogs still came to Gerald's song. Not Bigsy. Maybe his grandchildren."),
            S("Toby", "br", "Easy. It's only me."),
          ] },
          { n: 13, art: { src: panel("13") }, objects: ["chalk-warning"], scene: "A bus shelter at dusk. Toby, his back to us, chalks beside a small chalk dog; a mended radio on the bench.", lines: [
            N("tl", "He fixes what people bring him. They pay in food."),
            N("br", "And he tells travellers where not to be."),
          ] },
        ] },
        { layout: "tall", panels: [
          { n: 14, art: { src: panel("14") }, objects: ["toby-letter"], scene: "Dawn in the workshop. Toby, sixteen, his face in the light, bends over a dented tin by the door with a letter in his hand.", lines: [
            N("tl", "Toby Wren is sixteen. He's alive, and he's staying until the valve is open."),
            S("Toby", "tl", "“Mum. This is the fourth one…”"),
            N("br", "Then he's going to Northfield. He promised."),
          ] },
        ] },
      ],
    },
  },
];

export const collectionSet = (id: string): CollectionSet | undefined => SETS.find((s) => s.id === id);

export const panels = (set: CollectionSet): Panel[] => set.comic.pages.flatMap((p) => p.panels);

export const recordsOf = (card: Card): FragmentId[] => card.evidence.map((e) => e.record);

export const isUnlocked = (card: Card, found: readonly FragmentId[]): boolean => card.evidence.some((e) => found.includes(e.record));

// What a found card shows: the first of its evidence the player has.
export const shownEvidence = (card: Card, found: readonly FragmentId[]): Evidence | undefined => card.evidence.find((e) => found.includes(e.record));

// Is the set complete enough to say whose story it is?
export const setTitle = (set: CollectionSet, found: readonly FragmentId[], rewarded: boolean): string =>
  canRead(set, found, rewarded) ? set.title : unlockedCount(set, found) ? set.theme : set.untitled;

export const unlockedCount = (set: CollectionSet, found: readonly FragmentId[]): number => set.cards.filter((c) => isUnlocked(c, found)).length;

export const isComplete = (set: CollectionSet, found: readonly FragmentId[]): boolean => unlockedCount(set, found) === set.cards.length;

// The comic opens for a complete set, and stays open for anyone who completed
// it before a card was added: their reward is the record that they did.
export const canRead = (set: CollectionSet, found: readonly FragmentId[], rewarded: boolean): boolean => rewarded || isComplete(set, found);
