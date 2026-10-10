import type { FragmentId } from "./stories.ts";

// Story collections (docs/narrative/toby-collection.md). A card is unlocked
// by finding any of its records, so progress is the journal's discoveries
// read another way: nothing to lose, nothing to keep in step. Pure.

export type SetId = "toby" | "ruth";
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
const A = (who: string, at: Corner, text: string): Line => ({ kind: "aside", who, at, text });
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
  // Ruth's set (docs/narrative/collections-next.md). Two moments she shares
  // with Toby reuse his panels; the rest wait for art.
  {
    id: "ruth",
    title: "Ruth Lane",
    theme: "Same for Everyone",
    untitled: "Another name in the records",
    cards: [
      { n: 1, evidence: [
        { record: "ration-sign", title: "Cardboard limits sign", where: "FreshWay, taped inside the perspex at till 1", art: null,
          shows: "A flattened cereal box taped inside a perspex screen, lettered in marker gone brown.",
          reads: "2 tins + 1 dry per CUSTOMER. … R. Lane, Manager" },
      ] },
      { n: 2, evidence: [
        { record: "store-instruction", title: "Fax with biro notes", where: "FreshWay manager's office, a lever-arch file", art: null,
          shows: "A curled fax in a lever-arch file, a printed state direction with lines of blue biro across the bottom.",
          reads: "22 pallets. 11 on the truck. 11 down to the cold store for CS-4. R.L." },
      ] },
      { n: 3, evidence: [
        { record: "bus-2", title: "Bus 2 passenger list", where: "FreshWay cash office, a binder of carbon copies", art: card("passenger-list"),
          shows: "A carbon-copy passenger list on a clipboard, rows of handwriting, a column of blue ticks.",
          reads: "47. LANE, Ruth: seat to the Patterson boy ✓" },
      ] },
      { n: 4, evidence: [
        { record: "cs4-board", title: "Headcount board", where: "FreshWay basement car park, on a pillar", art: null,
          shows: "A whiteboard screwed to a concrete pillar, ruled into days, a tally crossed through and redone, one line squeezed in at the bottom.",
          reads: "DAY 12 · 140 IN · SAME FOR EVERYONE · R.L. / except Sundays? G." },
      ] },
      { n: 5, evidence: [
        { record: "radio-log", title: "Radio log", where: "Pumping station radio room, desk drawer", art: null,
          shows: "A hardback notebook open on a desk, neat capitals with times down the margin.",
          reads: "LIAISON H. LANE ASKS IS RUTH LANE IN CS-4. TOLD HER YES, RUTH'S RUNNING IT." },
      ] },
      { n: 6, evidence: [
        { record: "day-140", title: "Exercise book in a biscuit tin", where: "Pumping station office, up the stairs on the dam side", art: null,
          shows: "A school exercise book in a biscuit tin with its lid taped, the last page in a hurried hand.",
          reads: "Helen, we went NORTH. Follow the pipe." },
      ] },
      { n: 7, evidence: [
        { record: "exchange-chit", title: "Exchange chit", where: "Ruined Workshop, inside a payment tin", art: null,
          shows: "A stamped tin token on a loop of wire, punched twice, seen through the split lid of a padlocked tin.",
          reads: "KELL BRIDGE EXCHANGE · 1 CARTRIDGE RE-PACK · R.L. · AUT Y5" },
      ] },
    ],
    comic: {
      title: "Eleven Pallets",
      pages: [
        { layout: "pair", panels: [
          { n: 1, art: null, objects: ["ration-sign"], scene: "FreshWay at night, weeks before the war. Ruth, sixty-one, on the door; a big man argues at the perspex screen where a cardboard limits sign is taped; Kerry at till 2.", lines: [
            N("tl", "Calder, the last weeks before. Ruth Lane had run FreshWay's nights for twenty years."),
            S("Gary", "bl", "It's one more tin, Ruth."),
            S("Ruth", "br", "It's one more tin for everyone, Gary."),
          ] },
          { n: 2, art: null, objects: ["store-instruction"], scene: "The manager's office on the morning of the Ninth. Ruth at the desk writing in biro across a curling fax; through the window, a truck backing in.", lines: [
            N("tl", "The Ninth, 07:12. A state direction: send all of it to Northfield."),
            S("Ruth", "tr", "Twenty-two pallets. Eleven on the truck."),
            N("br", "The other eleven went down to the cold store. She wrote it down anyway."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 3, art: { src: "/static/img/comic/toby/p04.webp" }, objects: ["bus-2"], scene: "The car park in the morning, a crowd queueing for the bus. Toby, in an orange hi-vis vest, holds a carrier bag; Ruth, in glasses, writes on a clipboard of yellow forms.", lines: [
            S("Ruth", "tr", "One bag each."),
            N("bl", "She let a boy keep his dog food. Then she gave her own seat away."),
          ] },
          { n: 4, art: null, scene: "The bus pulling out, a boy of about nine at a window; Ruth left on the tarmac with the clipboard. Behind her, the siren pole.", lines: [
            S("Ruth", "tl", "Forty-seven's yours. Sit down and don't argue."),
            N("br", "13:45, the siren. She was already counting them down into CS-4."),
          ] },
        ] },
        { layout: "tall", panels: [
          { n: 5, art: null, objects: ["cs4-board"], scene: "CS-4 by lamplight: the basement car park, rows of people on cardboard and camp beds. Ruth writes on a whiteboard on a pillar; a big man watches, his two kids asleep behind him.", lines: [
            N("tl", "Same for everyone. That was the rule."),
            A("Gary", "tr", "Except Sundays."),
            N("bl", "On Sundays her own share went to Gary's kids. She never put that on the board."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 6, art: null, objects: ["radio-log"], scene: "The pumping station radio room, the morning after. Dev at the set, headphones half on, writing in a hardback log.", lines: [
            N("tl", "10 March. Her daughter asked after her from Northfield."),
            S("Helen, on the radio", "tr", "Is Ruth Lane in CS-4?"),
            S("Dev", "bl", "Yes. Ruth's running it."),
          ] },
          { n: 7, art: null, objects: ["day-140"], scene: "The station office, Day 140. Ruth writes the last entry in an exercise book beside a biscuit tin; through the window, people with packs waiting.", lines: [
            N("tl", "Day 140. Nineteen were left."),
            S("Ruth", "bl", "“Helen, we went NORTH. Follow the pipe.”"),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 8, art: null, scene: "Nineteen people with packs walking a dry road beside a line of old pipe markers; Dev ahead with a map, Ruth at the back.", lines: [
            N("tl", "They followed the pipe thirty-eight kilometres to Kell Bridge."),
            N("br", "Getting past the checkpoint cost them. She doesn't talk about it."),
          ] },
          { n: 9, art: { src: "/static/img/comic/toby/p07.webp" }, scene: "A trading shed by a weir, shelves of supplies. Ruth, older, in glasses and a checked shirt, leans on the counter looking at Toby, fourteen, a pack on his back.", lines: [
            S("Ruth", "tl", "Kerry Wren's boy."),
            N("bl", "At Kell Bridge she ran the exchange, and took in whoever walked up."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 10, art: null, scene: "The exchange counter. Ruth holds out a folded note to a walker shouldering a pack for the road north.", lines: [
            S("Ruth", "tl", "For Helen Lane. Allocation office, Northfield."),
            S("Walker", "tr", "Every time, Ruth."),
            N("br", "She sent a note north with every walker. No answer came back."),
          ] },
          { n: 11, art: null, scene: "After Dev's death. A hooded figure in a grey coat and respirator, faceless, lays a yellow plastic tag on the counter; Ruth's hand pushes it back.", lines: [
            N("tl", "After Dev, they wanted paying for the water."),
            S("Raider", "tr", "Kell pays, or Kell dries."),
            S("Ruth", "bl", "Then we'll be thirsty."),
          ] },
        ] },
        { layout: "tall", panels: [
          { n: 12, art: null, objects: ["exchange-chit"], scene: "The Kell Bridge exchange at dusk. Ruth, sixty-six, stamps tin chits by lamplight and presses one into a walker's hand.", lines: [
            N("tl", "Ruth Lane is sixty-six. Kell Bridge still trades, and still rations its water."),
            S("Ruth", "bl", "Same for everyone."),
            N("br", "She doesn't know Toby is back in Calder. Nobody has told her yet."),
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
