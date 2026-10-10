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

const interim = (n: string) => ({ src: `/static/img/comic/toby/${n}.webp`, interim: true });
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
        { record: "cart-dogs", title: "Crayon drawing", where: "FreshWay staff room, taped inside a cupboard door", art: null,
          shows: "A child's crayon drawing taped inside a cupboard door: three dogs, a white cart with a face, music notes coming out of it.",
          reads: "They come when Gerald sings. · Toby W." },
        { record: "our-loop", title: "Laminated worksheet", where: "Pumping station education room", art: null,
          shows: "A curled laminated school worksheet with a numbered list in a child's handwriting and a red teacher's star.",
          reads: "OUR LOOP by Toby Wren 5W" },
      ] },
      { n: 2, evidence: [
        { record: "bus-2", title: "Bus 2 passenger list", where: "FreshWay cash office, a binder of carbon copies", art: null,
          shows: "A carbon-copy passenger list on a clipboard, ticks down the margin, one line with a pencilled note beside it.",
          reads: "15. WREN, Tobias (11) ✓ (carrier bag of dog food?? let him)" },
        { record: "locker-6", title: "School photo in Locker 6", where: "FreshWay staff room, locker labelled K. WREN", art: null,
          shows: "Inside an open staff locker: a school photo of a gap-toothed boy in a hi-vis vest down to his knees, a shift note, and a child's jumper on the hook.",
          reads: "Kerry, I'll take your Sat so you can get T to the dentist. R." },
      ] },
      { n: 3, evidence: [
        { record: "chime-camp", title: "Laminated school card", where: "Pinned inside a cart's bin, the underpass", art: null,
          shows: "A worn laminated school ID card pinned inside a cart's bin, beside a hand-drawn map.",
          reads: "NORTHFIELD SHOWGROUND SCHOOL · Tobias Wren · Yr 8" },
      ] },
      { n: 4, evidence: [
        { record: "dev-toolbag", title: "Intake logbook", where: "A tin in a toolbag stencilled D.P., the old works gallery", art: null,
          shows: "A water-stained logbook open in a tin, beside a canvas toolbag; the last line stops mid-sentence.",
          reads: "T DOING THE SCREENS. KID'S QUICKER THAN ME NOW, DON'T TELL HIM." },
      ] },
      { n: 5, evidence: [
        { record: "chained-valve", title: "Chalk by the valve", where: "The outflow valve, the old works gallery", art: null,
          shows: "Chalk capitals on a concrete wall under an old painted note, below an iron valve wheel wrapped in chain with a yellow tag.",
          reads: "DEV PILLAI KILLED HERE 18 MAY BY MERCER'S LOT. HE DIDN'T SHOW THEM WHERE. T.W." },
      ] },
      { n: 6, evidence: [
        { record: "chalk-warning", title: "Chalk in the bus shelter", where: "Bus shelter, FreshWay car park", art: null,
          shows: "Chalk on the inside wall of a bus shelter, gone over more than once, a small dog drawn beside it.",
          reads: "AH ON RIDGE RD THURS. DON'T GO SINGLE. T" },
      ] },
      { n: 7, evidence: [
        { record: "toby-letter", title: "Letter in the forwarding tin", where: "Ruined Workshop, inside the office door", art: null,
          shows: "A folded letter with a note pinned to it, in a dented biscuit tin; names ticked in pencil on the lid.",
          reads: "Mum, This is the fourth one. … Toby" },
      ] },
    ],
    comic: {
      title: "The Cart Kid",
      pages: [
        { layout: "pair", panels: [
          { n: 1, art: interim("01"), scene: "A sunny suburban footpath, gum trees and brick houses. A small white cart with a painted smiling face stands parked; beside it an eleven-year-old boy kneels, holding out scraps to three dogs.", lines: [
            N("tl", "Calder, before. Toby Wren was eleven, and Cart 4 was his best friend."),
            S("Toby", "br", "Gerald's late again. Sorry, guys."),
          ] },
          { n: 2, art: null, objects: ["our-loop"], scene: "A supermarket in the evening. Kerry at the till in her teal polo; behind her Toby fills in a school worksheet about the Loop on an upturned crate, a tin of dog food poking out of his school bag.", lines: [
            S("Kerry", "tl", "Dog food is not a school lunch, Tobes."),
            S("Toby", "br", "It's not for me."),
            { kind: "aside", who: "Kerry", at: "tr", text: "I know who it's for." },
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 3, art: interim("02"), objects: ["locker-6", "cart-dogs"], scene: "A staff room at night, lit only by an emergency light. Kerry crouches by a boy asleep across two plastic chairs under her jacket. Behind them locker 6 stands open, a school photo taped inside its door; on a cupboard door, a child's crayon drawing of three dogs and a cart.", lines: [
            N("tl", "The Ninth. Twenty to four in the morning."),
            S("Kerry", "br", "Shoes on. Now. Don't ask, just shoes."),
          ] },
          { n: 4, art: interim("03"), objects: ["bus-2"], scene: "The supermarket car park in the morning. A long queue for a white coach. Toby, in an adult-size orange hi-vis vest, clutches a plastic carrier bag; Ruth, holding a clipboard of carbon-copy lists, pencils a note beside his name.", lines: [
            S("Ruth", "tr", "One bag each."),
            S("Toby", "bl", "It's for the dogs."),
            S("Ruth", "br", "…Let him."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 5, art: interim("05"), objects: ["chime-camp"], scene: "A tent school at the showground: Toby, thirteen, at a trestle table taking a radio apart, a laminated school card on a lanyard round his neck. Old pavilions and a dusty arena through the open flap.", lines: [
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
          { n: 9, art: interim("07"), objects: ["dev-toolbag"], scene: "Inside a concrete water-works tunnel by torchlight: further down, a teenager clears an intake screen in shallow water. In front, Dev sits on a step writing in a logbook, his canvas toolbag open beside him, watching the boy work.", lines: [
            N("tl", "Every autumn they walked back to Calder to clear the intake, so Kell Bridge would have water."),
            S("Toby", "tr", "Three and four, done. What's next?"),
            S("Dev", "bl", "Already? …The valve."),
            N("br", "Dev never said it out loud. He wrote it down."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 10, art: null, scene: "The tunnel, torchlight from the far end: grey-coated figures in respirators, shapes only. Dev stands between them and Toby, one arm back, pushing Toby toward a side pipe.", lines: [
            N("tl", "18 May. The Ash Hounds wanted the valve."),
            S("Dev", "br", "Pipe. Go. Don't stop."),
          ] },
          { n: 11, art: interim("08"), objects: ["chained-valve"], scene: "An iron valve wheel wrapped in chain, a padlock and a yellow tag, chalk marks on the wall below.", lines: [
            N("tl", "Dev wouldn't give it to them."),
            N("br", "Toby came back when they'd gone. He wrote down what happened, so someone would know."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 12, art: interim("09"), objects: ["chime-camp"], scene: "The mouth of an underpass at dusk: the cart with the painted face lies on its side, steel bowls beside it, dogs close by and more watching from the open ground.", lines: [
            N("tl", "Calder. The dogs still came to Gerald's song. Not Bigsy. Maybe his grandchildren."),
            S("Toby", "br", "Easy. It's only me."),
          ] },
          { n: 13, art: interim("10"), objects: ["chalk-warning"], scene: "A bus shelter at dusk. Toby, sixteen, chalks a warning on the inside wall and draws a small dog beside it; his tool roll and a mended radio wait on the bench. An empty highway outside.", lines: [
            N("tl", "He fixes what people bring him. They pay in food."),
            N("br", "And he tells travellers where not to be."),
          ] },
        ] },
        { layout: "tall", panels: [
          { n: 14, art: null, objects: ["toby-letter"], scene: "The old workshop at dawn. Toby, sixteen, slips a folded letter with a note pinned to it into a dented biscuit tin by the office door; names ticked in pencil on the lid. His face, finally, in the light.", lines: [
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
