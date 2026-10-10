import { NOT_YET_REACHABLE, fragment, type FragmentId } from "./stories.ts";

// Story collections (docs/narrative/toby-collection.md). A card is unlocked
// by finding any of its records, so progress is the journal's discoveries
// read another way: nothing to lose, nothing to keep in step. Pure.

export type SetId = "toby" | "ruth" | "mags" | "dev" | "helen";
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
            N("tl", "18 May. The Ash Hounds wanted the water, and the way round the valve."),
            S("Dev", "br", "Pipe. Go. Don't stop."),
          ] },
          { n: 11, art: { src: panel("11") }, objects: ["chained-valve"], scene: "A dark tunnel by the chained valve. Toby kneels with his back to us, chalk in hand, at the wall.", lines: [
            N("tl", "Dev wouldn't show them the way round. So they chained the valve."),
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
        { record: "ration-sign", title: "Cardboard limits sign", where: "FreshWay, taped inside the perspex at till 1", art: `/static/img/cards/ruth/limits-sign.webp`,
          shows: "A cardboard sign taped inside a perspex screen at a checkout, seen from behind, the shop dark beyond.",
          reads: "2 tins + 1 dry per CUSTOMER. … R. Lane, Manager" },
      ] },
      { n: 2, evidence: [
        { record: "store-instruction", title: "Fax with biro notes", where: "FreshWay manager's office, a lever-arch file", art: `/static/img/cards/ruth/fax.webp`,
          shows: "A curled sheet on a clipboard, lines of blue biro handwriting across it.",
          reads: "22 pallets. 11 on the truck. 11 down to the cold store for CS-4. R.L." },
      ] },
      { n: 3, evidence: [
        { record: "bus-2", title: "Bus 2 passenger list", where: "FreshWay cash office, a binder of carbon copies", art: card("passenger-list"),
          shows: "A carbon-copy passenger list on a clipboard, rows of handwriting, a column of blue ticks.",
          reads: "47. LANE, Ruth: seat to the Patterson boy ✓" },
      ] },
      { n: 4, evidence: [
        { record: "cs4-board", title: "Headcount board", where: "FreshWay basement car park, on a pillar", art: `/static/img/cards/ruth/cs4-board.webp`,
          shows: "A whiteboard on a concrete pillar in a dark car park, ruled into columns of numbers.",
          reads: "DAY 12 · 140 IN · SAME FOR EVERYONE · R.L. / except Sundays? G." },
      ] },
      { n: 5, evidence: [
        { record: "radio-log", title: "Radio log", where: "Pumping station radio room, desk drawer", art: `/static/img/cards/ruth/radio-log.webp`,
          shows: "A notebook open on a radio-room desk, pages of handwriting, an old radio set behind it.",
          reads: "LIAISON H. LANE ASKS IS RUTH LANE IN CS-4. TOLD HER YES, RUTH'S RUNNING IT." },
      ] },
      { n: 6, evidence: [
        { record: "day-140", title: "Exercise book in a biscuit tin", where: "Pumping station office, up the stairs on the dam side", art: `/static/img/cards/ruth/day-140.webp`,
          shows: "A blue exercise book in an open biscuit tin on a desk by a window.",
          reads: "Helen, we went NORTH. Follow the pipe." },
      ] },
      { n: 7, evidence: [
        { record: "exchange-chit", title: "Exchange chit", where: "Ruined Workshop, inside a payment tin", art: `/static/img/cards/ruth/chit.webp`,
          shows: "A worn tin token on a loop of wire among old coins, inside a battered cash tin.",
          reads: "KELL BRIDGE EXCHANGE · 1 CARTRIDGE RE-PACK · R.L. · AUT Y5" },
      ] },
    ],
    comic: {
      title: "Eleven Pallets",
      pages: [
        { layout: "pair", panels: [
          { n: 1, art: { src: "/static/img/comic/ruth/p01.webp" }, objects: ["ration-sign"], scene: "FreshWay at night, weeks before the war. Ruth, sixty-one, arms folded by the door; behind her a big man at the checkout, signs taped up, Kerry at the next till.", lines: [
            N("tl", "Calder, the last weeks before. Ruth Lane had run FreshWay's nights for twenty years."),
            S("Gary", "bl", "It's one more tin, Ruth."),
            S("Ruth", "br", "It's one more tin for everyone, Gary."),
          ] },
          { n: 2, art: { src: "/static/img/comic/ruth/p02.webp" }, objects: ["store-instruction"], scene: "The manager's office on the morning of the Ninth. Ruth at the desk writing on a curling sheet; through the window, trucks in the yard.", lines: [
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
          { n: 4, art: { src: "/static/img/comic/ruth/p04.webp" }, scene: "The bus pulling out, boys at its windows; Ruth left on the tarmac holding the clipboard of lists. Behind her, a tall pole.", lines: [
            S("Ruth", "tl", "Forty-seven's yours. Sit down and don't argue."),
            N("br", "13:45, the siren. She was already counting them down into CS-4."),
          ] },
        ] },
        { layout: "tall", panels: [
          { n: 5, art: { src: "/static/img/comic/ruth/p05.webp" }, objects: ["cs4-board"], scene: "CS-4 by lamplight: the basement car park, people on camp beds. Ruth writes on a board at a pillar; a big man leans in beside her.", lines: [
            N("tl", "Same for everyone. That was the rule."),
            A("Gary", "tr", "Except Sundays."),
            N("bl", "On Sundays her own share went to Gary's kids. She never put that on the board."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 6, art: { src: "/static/img/comic/ruth/p06.webp" }, objects: ["radio-log"], scene: "The pumping station radio room, the morning after. Dev at the radio set, headphones on, writing in a log by lamplight.", lines: [
            N("tl", "10 March. Her daughter asked after her from Northfield."),
            S("Helen, on the radio", "tr", "Is Ruth Lane in CS-4?"),
            S("Dev", "bl", "Yes. Ruth's running it."),
          ] },
          { n: 7, art: { src: "/static/img/comic/ruth/p07.webp" }, objects: ["day-140"], scene: "The station office, Day 140. Ruth writes in an exercise book beside a biscuit tin; through the window, people with packs waiting.", lines: [
            N("tl", "Day 140. Nineteen were left."),
            S("Ruth", "bl", "“Helen, we went NORTH. Follow the pipe.”"),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 8, art: { src: "/static/img/comic/ruth/p08.webp" }, scene: "A line of people with packs walking a dry road beside a long row of old pipe sections, a tall bearded man in front with a stick.", lines: [
            N("tl", "They followed the pipe thirty-eight kilometres to Kell Bridge."),
            N("br", "Getting past the checkpoint cost them. She doesn't talk about it."),
          ] },
          { n: 9, art: { src: "/static/img/comic/toby/p07.webp" }, scene: "A trading shed by a weir, shelves of supplies. Ruth, older, in glasses and a checked shirt, leans on the counter looking at Toby, fourteen, a pack on his back.", lines: [
            S("Ruth", "tl", "Kerry Wren's boy."),
            N("bl", "At Kell Bridge she ran the exchange, and took in whoever walked up."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 10, art: { src: "/static/img/comic/ruth/p10.webp" }, scene: "The exchange by the weir. Ruth, in glasses and a checked shirt, holds a folded note; a walker in a wide hat and a pack stands half turned away.", lines: [
            S("Ruth", "tl", "For Helen Lane. Allocation office, Northfield."),
            S("Walker", "tr", "Ruth… they're saying she was sick. Last winter."),
            S("Ruth", "bl", "They say a lot of things. Take the note."),
            N("br", "No answer came back. She kept sending them."),
          ] },
          { n: 11, art: { src: "/static/img/comic/ruth/p11.webp" }, scene: "After Dev's death. A hooded figure in a grey coat and respirator, faceless, lays yellow tags on the counter; Ruth, beside him, keeps her gloved hands on them.", lines: [
            N("tl", "After Dev, they chained the valve and wanted paying for the water."),
            S("Raider", "tr", "Kell pays, or Kell dries."),
            S("Ruth", "bl", "Then we'll be thirsty."),
          ] },
        ] },
        { layout: "tall", panels: [
          { n: 12, art: { src: "/static/img/comic/ruth/p12.webp" }, objects: ["exchange-chit"], scene: "The Kell Bridge exchange at dusk, a bulb lit. Ruth, sixty-six, presses something into the hands of an old bearded walker; the river runs behind them.", lines: [
            N("tl", "Ruth Lane is sixty-six. Kell Bridge still trades, and still rations its water."),
            S("Ruth", "bl", "Same for everyone."),
            N("br", "Behind her, three letters from Kerry Wren, for Toby. She doesn't know if he's alive. She keeps them anyway."),
          ] },
        ] },
      ],
    },
  },
  // Mags's set (docs/narrative/mags.md). The passenger list is the same
  // object as in the other sets. Card 5 is the one stack, found either on
  // the workshop's docket spike or on the purifier in your own shelter.
  {
    id: "mags",
    title: "Margit Halloran",
    theme: "Empty Is Empty",
    untitled: "Another hand in the records",
    cards: [
      { n: 1, evidence: [
        { record: "mags-jobbook", title: "Job book in an ice-cream tub", where: "Ruined Workshop, under the bench", art: "/static/img/cards/mags/jobbook.webp",
          shows: "An oil-soft exercise book standing in a battered plastic tub, its pages crowded with pencil.",
          reads: "9 MAR. Keys: Patel 118. 118 stack OUT → 112 COOPER. Baby. Seal won't hold." },
      ] },
      { n: 2, evidence: [
        { record: "bus-2", title: "Bus 2 passenger list", where: "FreshWay cash office, a binder of carbon copies", art: card("passenger-list"),
          shows: "A carbon-copy passenger list on a clipboard, rows of handwriting, a column of blue ticks.",
          reads: "31. HALLORAN, Margit: declined (language). Has a Unit, she says." },
      ] },
      { n: 3, evidence: [
        { record: "mags-bore-tag", title: "Tag on the bore motor", where: "Dry Reservoir, the bore house", art: "/static/img/cards/mags/bore-tag.webp",
          shows: "A scuffed aluminium tag on a wire loop, hanging against an old pump motor's housing, letters punched into it.",
          reads: "REWOUND M.H. DAY 9 · ¼ LOAD TILL RUN IN · TELL PUMP BOY IT'S NOT A TOY" },
      ] },
      { n: 4, evidence: [
        { record: "patels-keys", title: "Keys and a note on a nail", where: "Ruined Workshop, the key board by the roller door", art: "/static/img/cards/mags/keys.webp",
          shows: "Keys on a ring hanging from a nail by the roller door, a cardboard tag and a folded sheet of paper pushed on behind them.",
          reads: "You had our keys to keep it ticking over. / Empty is empty. The Cooper baby needed it. M.H." },
      ] },
      { n: 5, evidence: [
        { record: "ferris-docket", title: "Fitting docket", where: "Ruined Workshop, on the spike by the bench", art: "/static/img/cards/mags/docket.webp",
          shows: "A stack of carbon fitting dockets on a steel spike on a workbench, the top one curling.",
          reads: "FERRIS · RC-40 STACK FITTED 2 JUN Y3 · SN 118-0447 · EX U-112" },
        { record: "unit-plate", title: "Serial plate", where: "Your shelter, behind the purifier's side panel", art: "/static/img/cards/mags/unit-plate.webp",
          shows: "A stamped steel plate riveted to a purifier stack among pipes and fittings.",
          reads: "RC-40 SORBENT STACK · SN 118-0447 · SVC M.H. · EX U-112 · FITTED M.H. 2 JUN Y3" },
      ] },
      { n: 6, evidence: [
        { record: "mags-dropboard", title: "Drop-off board", where: "Ruined Workshop, inside the office door", art: "/static/img/cards/mags/dropboard.webp",
          shows: "A corkboard of pencil notes inside a workshop door, a padlocked green tin under it, and a soup tin with a bowl upside down on top.",
          reads: "Chalk kid: soup in the green tin. Bring the bowl back." },
      ] },
      { n: 7, evidence: [
        { record: "tagged-door", title: "Yellow tag on the door", where: "Ruined Workshop, the outside door", art: "/static/img/cards/mags/door-tag.webp",
          shows: "A yellow plastic tag wired to a weathered door handle, marker on it.",
          reads: "AH · ASSESSED · OLD WOMAN · RE-PACKS" },
      ] },
    ],
    comic: {
      title: "Forty Households",
      pages: [
        { layout: "pair", panels: [
          { n: 1, art: { src: "/static/img/comic/mags/p01.webp" }, scene: "Before the war. A Unit's hatch room, summer light down the ladder. Mags, seventy-one, lies on her back on a drop sheet, looking up; a householder on the ladder reaches down a carton of eggs.", lines: [
            N("tl", "Calder, before. Margit Halloran fixed whatever the inspectors failed."),
            S("Householder", "tr", "What do I owe you?"),
            S("Mags", "bl", "Six eggs. And you never saw me."),
          ] },
          { n: 2, art: { src: "/static/img/comic/mags/p02.webp" }, objects: ["bus-2"], scene: "The Ninth, the FreshWay car park, at the door of Bus 2. Ruth, in glasses, a clipboard of yellow lists in her hand; facing her, Mags in a beanie and scarf, not getting on.", lines: [
            S("Ruth", "tl", "Margit. There's a seat."),
            S("Mags", "tr", "Give it to someone who'll fit. I've a cat and forty Units."),
            A("Ruth", "bl", "…declined."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 3, art: { src: "/static/img/comic/mags/p03.webp" }, scene: "The same queue. A woman with a long dark plait, her children beside her, presses a ring of keys into Mags's hand.", lines: [
            S("Anjali", "tl", "Keep it ticking over till we're back?"),
            S("Mags", "br", "Go on. Bus won't wait."),
          ] },
          { n: 4, art: { src: "/static/img/comic/mags/p04.webp" }, objects: ["mags-jobbook"], scene: "The afternoon of the Ninth, the Coopers' Unit. Mags comes down the hatch ladder with a heavy cylindrical stack on her shoulder, her job book in her apron pocket; below her, a newborn in a basket.", lines: [
            N("tl", "13:45, the siren. The Coopers had a baby and a seal that wouldn't hold. The Patels' Unit was empty."),
            S("Mr Cooper", "bl", "Whose is that?"),
            S("Mags", "br", "Nobody's using it."),
          ] },
        ] },
        { layout: "tall", panels: [
          { n: 5, art: { src: "/static/img/comic/mags/p05.webp" }, objects: ["mags-bore-tag"], scene: "Day 9. The bore house at the pumping station, brick walls, one light. Mags at the bench rewinding the motor, a coil of copper wire in front of her. Dev, thirty-four, bearded, leans in to see.", lines: [
            N("tl", "Day 9. The bore that kept CS-4 alive had burnt its motor out."),
            S("Mags", "tr", "Who wound this, a possum?"),
            S("Dev", "bl", "Can you fix it?"),
            S("Mags", "br", "Pump Boy, I can fix anything. Quarter load till it's run in. Never more."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 6, art: { src: "/static/img/comic/mags/p06.webp" }, objects: ["patels-keys"], scene: "A year on, spring. The workshop's roller door. Mags in the doorway reading a sheet of paper, a pencil stub in her other hand.", lines: [
            N("tl", "A year on, the Patels walked back from Northfield. The stack was gone."),
            S("Mags", "br", "“Empty is empty. The Cooper baby needed it.”"),
          ] },
          { n: 7, art: { src: "/static/img/comic/mags/p07.webp" }, objects: ["patels-keys"], scene: "From the workshop's window: a family walking away up the road north, not looking back. In the foreground, an old hand holds up a key.", lines: [
            N("tl", "They didn't come and shout at her. They went back north."),
            A("Mags", "br", "Should've shouted."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 8, art: { src: "/static/img/comic/mags/p08.webp" }, scene: "The workshop stripped: a bare board where the tools hung, a yellow tag pinned up beside the door. Mags by the bench, an old ginger cat sitting on it.", lines: [
            N("tl", "The next year she told the men in grey she didn't pay for weather. They took her tools."),
            S("Mags", "br", "Right, Biscuit. We're moving."),
          ] },
          { n: 9, art: { src: "/static/img/comic/mags/p09.webp" }, scene: "Night in the Coopers' old Unit. Mags, in gloves, re-packs a cartridge at a small table. Against the wall, a second stack.", lines: [
            N("tl", "The Coopers had gone north. She moved into their Unit, and kept the other stack for whoever needed it next."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 10, art: { src: "/static/img/comic/mags/p10.webp" }, objects: ["ferris-docket", "unit-plate"], scene: "Winter, snow in the hatchway of the Unit that will be yours. Mags wires a punched tag onto the tall purifier stack, a docket pad on her knee.", lines: [
            N("tl", "The Ferrises' stack failed in June. She had a spare."),
            S("Mrs Ferris", "bl", "Where's it from?"),
            S("Mags", "br", "Someone who wasn't using it."),
          ] },
          { n: 11, art: { src: "/static/img/comic/mags/p11.webp" }, objects: ["mags-dropboard"], scene: "Inside the workshop office door: Mags beside the drop-off board of pencil notes, a pot and bowl on the shelf. Through the door, far off, a sign by the road where the bus shelter is.", lines: [
            N("tl", "In May, Kell walkers told her Pump Boy was dead."),
            // her face is top right in the painting, so the words keep clear of it
            N("bl", "Someone started chalking warnings on the bus shelter. She left soup and didn't ask who."),
            S("Mags", "br", "“Chalk kid: soup in the green tin. Bring the bowl back.”"),
          ] },
        ] },
        { layout: "tall", panels: [
          { n: 12, art: { src: "/static/img/comic/mags/p12.webp" }, objects: ["tagged-door", "mags-dropboard"], scene: "Autumn, dusk. A yellow tag wired to the workshop's door handle. Mags, seventy-seven, in a heavy coat, stands beside it without touching it.", lines: [
            N("tl", "Margit Halloran is seventy-seven. They've marked her door."),
            S("Mags", "bl", "“Ferris place: whoever's in there now. Your stack's due a re-pack before winter. First one's free.”"),
            N("br", "She still doesn't do people. She does forty Units. Now forty-one."),
          ] },
        ] },
      ],
    },
  },
  // Dev's set (docs/narrative/dev.md). Cards 2, 5 and 6 share their records,
  // and their pictures, with Ruth's and Toby's sets; the rest were painted
  // from docs/narrative/art-requests.md.
  {
    id: "dev",
    title: "Dev Pillai",
    theme: "Quarter Turn",
    untitled: "Two initials in the records",
    cards: [
      { n: 1, evidence: [
        { record: "dev-loop-roster", title: "Loop ride-along roster", where: "Creature Nest, the depot's dispatch window", art: "/static/img/cards/dev/roster.webp",
          shows: "A sun-faded laminated roster behind cracked perspex in a steel hatch, held on with cable ties.",
          reads: "SCHOOL RIDE-ALONG · CART 4 · THURS · D. PILLAI + 1 (WREN, 5W) · VEST ISSUED: LOOP CREW ADULT S (all we had)" },
      ] },
      { n: 2, evidence: [
        { record: "radio-log", title: "Radio log", where: "Pumping station radio room, desk drawer", art: `/static/img/cards/ruth/radio-log.webp`,
          shows: "A notebook open on a radio-room desk, pages of handwriting, an old radio set behind it.",
          reads: "07:15 OWN READINGS: RESERVOIR INTAKE ABOVE THE LINE. BORE UNDER IT. ONE METER, NO SPARE BATTERIES. TAKING IT ON TRUST." },
      ] },
      { n: 3, evidence: [
        { record: "pump-log", title: "Pump run sheet", where: "Dry Reservoir, the bore house, on a nail by the pump starter", art: "/static/img/cards/dev/run-sheet.webp",
          shows: "A clipboard of carbon run sheets on a nail beside an old pump starter in a brick hut, the top sheet creased.",
          reads: "BORE: ALL TO CS-4 (FRESHWAY). 140 THERE, NO UNIT, NO STACK. EAST SIDE STAYS ON THE MAIN. THEY HAVE UNITS." },
      ] },
      { n: 4, evidence: [
        { record: "dev-repack-card", title: "Re-pack card", where: "Ruined Workshop, nailed above the cartridge bench", art: "/static/img/cards/dev/repack-card.webp",
          shows: "A scratched aluminium card nailed above a workbench, lines of scored letters filled with marker, pencil ticks beside them.",
          reads: "6. HOUSING: ¼ TURN. NEVER MORE. · For Mags, who knows all this. It's for whoever comes after you. D.P." },
      ] },
      { n: 5, evidence: [
        { record: "chained-valve", title: "Painted note by the valve", where: "The outflow valve, the old works gallery", art: card("valve-chalk"),
          shows: "An iron valve wheel on a tunnel wall, wrapped in chain and padlocked, writing on the concrete beside it.",
          reads: "OLD WORKS OUTFLOW. ¼ TURN ONLY. DP" },
      ] },
      { n: 6, evidence: [
        { record: "dev-toolbag", title: "Intake logbook", where: "A tin in a toolbag stencilled D.P., the old works gallery", art: card("logbook"),
          shows: "A water-stained logbook lying open in a dark tunnel, pages of handwriting, a canvas bag behind it.",
          reads: "TODAY: SCREENS 3 AND 4, THEN THE" },
      ] },
    ],
    comic: {
      title: "On Trust",
      pages: [
        { layout: "pair", panels: [
          { n: 1, art: { src: "/static/img/comic/dev/p01.webp" }, objects: ["dev-loop-roster"], scene: "The Loop depot yard, a bright Thursday the year before the war. Dev, thirty-three, holds out an adult orange LOOP CREW vest to a ten-year-old boy already lost inside it. Behind them, Cart 4 with a face painted on; in the dispatch window, the roster.", lines: [
            // Dev's head is top left in the painting; the boy stands right
            N("tr", "Calder, the year before. Dev Pillai kept the town's water clean, and drove Cart 4 on Thursdays because nobody else would."),
            S("Toby", "tr", "It's huge."),
            S("Dev", "bl", "It's the smallest we've got. You'll grow into it."),
          ] },
          { n: 2, art: { src: "/static/img/comic/dev/p02.webp" }, scene: "The pumping station's education room: a dozen Year 5s on the floor, laminated worksheets on the wall. Dev holds up a meter; a sandy-haired boy at the front has his hand up.", lines: [
            S("Dev", "tl", "Water's honest. It tells you what's in it, if you measure."),
            S("Toby", "tr", "What if you can't measure?"),
            S("Dev", "bl", "Then you're guessing. Don't guess."),
          ] },
        ] },
        { layout: "tall", panels: [
          { n: 3, art: { src: "/static/img/comic/dev/p03.webp" }, objects: ["radio-log"], scene: "The radio room before dawn on 10 March, one lamp. Dev alone at the desk, headphones round his neck, a meter with a flickering battery light, writing capitals in a hardback log.", lines: [
            N("tl", "After the Ninth there was one meter, and no spare batteries."),
            N("tr", "The bore read under the line. The reservoir didn't."),
            A("Dev", "bl", "Taking it on trust."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 4, art: { src: "/static/img/comic/dev/p04.webp" }, objects: ["pump-log"], scene: "The bore house at dawn. Dev at the pump starter with a clipboard of run sheets; through the door a water truck backing up, a big man leaning out of the cab.", lines: [
            N("tl", "One bore. Enough for one place."),
            S("Gary", "tr", "And the east side?"),
            S("Dev", "bl", "They've got Units. CS-4's got a car park."),
            N("br", "He sent it all to the hundred and forty. The sheet never mentions that Ruth was one of them."),
          ] },
          { n: 5, art: { src: "/static/img/comic/dev/p05.webp" }, objects: ["pump-log"], scene: "The pumping station gate at dusk, days later. Two neighbours with jerrycans; Dev filling them from the truck's tap, the clipboard under his arm.", lines: [
            S("Neighbour", "tl", "Is it clean?"),
            S("Dev", "tr", "It's under the line. As far as I can tell."),
            N("bl", "Their cartridges ran out first. He gave what he could off the truck, and wrote that down too."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 6, art: { src: "/static/img/comic/dev/p06.webp" }, scene: "The station office, Day 140. Dev bent over a council map of the old works main; Ruth beside him; through the window, a line of people with packs.", lines: [
            // Ruth on the left, Dev on the right with his head high
            N("tl", "Day 140. He walked nineteen people north along the pipe."),
            S("Ruth", "bl", "There's nineteen of us left, Dev."),
            S("Dev", "br", "The old main runs north under the dam road. Clean all the way."),
          ] },
          { n: 7, art: { src: "/static/img/comic/dev/p07.webp" }, objects: ["dev-repack-card"], scene: "Kell Bridge weir plant, a year later. A long bench of salvaged steel, cartridges in rows; Dev teaching three locals to pack sorbent, a young woman in a rubber apron watching his hands. An aluminium card is nailed above the bench.", lines: [
            N("tl", "At Kell Bridge he built a re-packing line from salvage and patience."),
            S("Dev", "tr", "Gloves. All of it. Every time."),
            S("Trainee", "bl", "You've said that six times."),
            S("Dev", "br", "Then you'll remember it when I'm not here."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 8, art: { src: "/static/img/comic/dev/p08.webp" }, objects: ["chained-valve"], scene: "The old works gallery, the first autumn back. By torchlight Dev paints white letters on the concrete beside the outflow valve wheel: no chain, no tag, the wheel clean.", lines: [
            N("tl", "Every autumn he walked back to Calder to clear the intake, so Kell Bridge would have water."),
            N("br", "Open it wider and the silt comes down with the water. He made sure nobody would."),
          ] },
          { n: 9, art: { src: "/static/img/comic/dev/p09.webp" }, objects: ["dev-repack-card"], scene: "Mags's workshop in Calder, autumn. Dev holds out a scratched aluminium card. Mags, white hair under a navy beanie, oil to the elbows, doesn't take it.", lines: [
            // Dev left, Mags right; both heads high
            S("Mags", "tr", "I know all this, Pump Boy."),
            S("Dev", "bl", "It's not for you. It's for whoever comes after you."),
            A("Mags", "br", "…Nail it up, then."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 10, art: { src: panel("08") }, scene: "A workbench in the weir plant. Dev packs a cartridge with careful hands while Toby, fourteen, sleeves pushed up, leans in watching.", lines: [
            N("tl", "Y+3. Ruth sent him a kid off the road. He knew the vest."),
            S("Dev", "tr", "Quarter turn. Never more."),
            S("Toby", "bl", "What happens if you do more?"),
            S("Dev", "br", "You find out. So does everyone downstream."),
          ] },
          { n: 11, art: { src: "/static/img/comic/dev/p11.webp" }, scene: "Winter, the weir plant at night. One place at the bench empty, a rubber apron on its hook. A yellow freight tag lies on the bench; Dev and Ruth stand over it.", lines: [
            // Dev left, Ruth right, both heads at the top of the painting
            N("bl", "That winter the Ash Hounds took one of his re-packers off the Ridge Road."),
            S("Dev", "bl", "I'm still going in the autumn. Kell drinks what comes down that pipe."),
            S("Ruth", "br", "Then don't go alone."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 12, art: { src: panel("09") }, objects: ["dev-toolbag"], scene: "A concrete water-works tunnel by torchlight. Dev on a raised ledge writing in a small notebook, his tool bag beside him; far down the tunnel, a boy in an orange vest working at a grate.", lines: [
            S("Toby", "tr", "Three and four, done. What's next?"),
            S("Dev", "bl", "Already? …The valve."),
            N("br", "He wrote it in the log: the kid's quicker than me. He never said it to his face."),
          ] },
          { n: 13, art: { src: panel("10") }, scene: "Hooded figures in grey respirators at the far end of the tunnel. Dev, from behind, arms spread across it; a boy scrambles into a drain pipe low in the wall.", lines: [
            N("tl", "18 May. They wanted the water, and the way round the valve."),
            S("Hound", "tr", "Show us where, and you both walk."),
            N("bl", "Show them, and everyone who drank from that main would pay, or go dry."),
            S("Dev", "br", "Pipe. Go. Don't stop."),
          ] },
        ] },
        { layout: "tall", panels: [
          { n: 14, art: { src: "/static/img/comic/dev/p14.webp" }, objects: ["dev-repack-card"], scene: "Kell Bridge weir plant, autumn, now. Morning light through high windows. Five people at a long bench re-packing cartridges; above them a scratched aluminium card, worn bright where fingers touch it. Through the window the river runs low.", lines: [
            N("tl", "Dev Pillai was killed at the intake. He was thirty-eight. He didn't show them where."),
            N("tr", "They chained the valve and sell its water. Kell Bridge won't pay, and is short. It still re-packs every cartridge on the bench he built."),
            S("Re-packer", "bl", "Six. Housing, quarter turn. Never more."),
            N("br", "He wanted someone to do it after him. There are five at the bench, and a boy in Calder who signs his warnings T."),
          ] },
        ] },
      ],
    },
  },
  // Helen's set (docs/narrative/helen.md). Cards 6 and 7 lie at the Ridge
  // Road and the Weighbridge, which no trip reaches yet, so the set can't be
  // finished and her comic, which tells of her death, stays shut until then.
  {
    id: "helen",
    title: "Helen Lane",
    theme: "Procedure",
    untitled: "One initial in the records",
    cards: [
      { n: 1, evidence: [
        { record: "siren-talk", title: "Council handout", where: "Pumping station education room, the end of the school display", art: "/static/img/cards/helen/siren-handout.webp",
          shows: "A laminated council handout with a clip-art siren, pinned at the end of a school display, felt-pen writing on its back.",
          reads: "Everyone is on a list. Ms H. Lane, Council Emergency Liaison · what if the list is wrong" },
      ] },
      { n: 2, evidence: [
        { record: "council-bulletin", title: "Bulletins on a corkboard", where: "Pumping station radio room, above the set", art: "/static/img/cards/helen/bulletins.webp",
          shows: "A corkboard above an old radio set, typed bulletin sheets pinned to it, two empty pins and a torn corner.",
          reads: "08:00 · Tap water remains safe to drink… READ: H. LANE · 13:45 · SIREN. Shelter now. · 12:40?? DP" },
      ] },
      { n: 3, evidence: [
        { record: "bus-2", title: "Bus 2 passenger list", where: "FreshWay cash office, a binder of carbon copies", art: card("passenger-list"),
          shows: "A carbon-copy passenger list on a clipboard, rows of handwriting, a column of blue ticks.",
          reads: "Bus 3: 13:00 (H. says). No bus by 2: everyone DOWN to CS-4, and I mean down." },
      ] },
      { n: 4, evidence: [
        { record: "radio-log", title: "Radio log", where: "Pumping station radio room, desk drawer", art: `/static/img/cards/ruth/radio-log.webp`,
          shows: "A notebook open on a radio-room desk, pages of handwriting, an old radio set behind it.",
          reads: "07:09 LIAISON H. LANE ASKS IS RUTH LANE IN CS-4. TOLD HER YES, RUTH'S RUNNING IT." },
      ] },
      { n: 5, evidence: [
        { record: "day-140", title: "Exercise book in a biscuit tin", where: "Pumping station office, up the stairs on the dam side", art: `/static/img/cards/ruth/day-140.webp`,
          shows: "A blue exercise book in an open biscuit tin on a desk by a window.",
          reads: "Leaving this here in case H. comes back. Helen, we went NORTH. Follow the pipe." },
      ] },
      { n: 6, evidence: [
        { record: "convoy-manifest", title: "Convoy manifest", where: "The Ridge Road cutting, a burnt truck's glovebox", art: "/static/img/cards/helen/manifest.webp",
          shows: "A manifest on a clipboard in a steel tin, in the scorched glovebox of a burnt-out truck.",
          reads: "NORTHFIELD → KELL BRIDGE RELIEF · Route: Ridge Road (avoid checkpoint) · Authorised H. Lane" },
      ] },
      { n: 7, evidence: [
        { record: "helen-letter", title: "Unopened envelope", where: "The Weighbridge, a trader's pack in the loot store", art: "/static/img/cards/helen/envelope.webp",
          shows: "A sealed envelope soft with handling, lying in a spilled trader's pack beside a tear-off calendar.",
          reads: "Ruth Lane, Kell Bridge exchange · By hand: N. Ashby. H." },
      ] },
    ],
    comic: {
      title: "Twelve Forty",
      pages: [
        { layout: "pair", panels: [
          { n: 1, art: { src: "/static/img/comic/helen/p01.webp" }, objects: ["siren-talk"], scene: "A primary-school hall before the war, morning light. Helen, thirty-eight, in a council blazer, holds up a laminated siren handout; rows of Year 5 children on the floor, one hand up. At the back, a small sandy-haired boy in a hi-vis vest too big for him.", lines: [
            N("tl", "Calder, before. Helen Lane wrote the lists that said where everyone would go."),
            S("Child", "bl", "What if you're not on a list?"),
            S("Helen", "br", "Everyone's on a list."),
          ] },
          { n: 2, art: { src: "/static/img/comic/helen/p02.webp" }, scene: "Evening, Ruth's kitchen. Ruth, sixty-one, in her FreshWay manager's polo, feet up; Helen at the table with folders, her watch beside them.", lines: [
            // Ruth left, Helen right; their faces are high, so the words sit low
            S("Ruth", "bl", "Don't save me a seat. Give it to someone who needs it."),
            S("Helen", "br", "You always say that. Bus 3, Mum. Thirteen hundred. It's arranged."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 3, art: { src: "/static/img/comic/helen/p03.webp" }, objects: ["council-bulletin"], scene: "The council emergency centre on the morning of the Ninth: a cramped room of phones and maps. Helen at a desk microphone reading from a bulletin sheet; the wall clock at eight.", lines: [
            N("tl", "The Ninth, eight in the morning."),
            S("Helen", "tr", "Tap water remains safe to drink. Units seal at the siren."),
            N("br", "It was true when she said it."),
          ] },
          { n: 4, art: { src: "/static/img/comic/helen/p04.webp" }, objects: ["council-bulletin"], scene: "The same room at 12:40. A forecaster leans in and puts a slip of paper in front of Helen; she looks at her watch. Behind her, a corkboard of pinned sheets.", lines: [
            N("tl", "Twelve forty. The dust would come by half past three."),
            S("Forecaster", "bl", "If we sound it now, they'll all run for the road and wait for Bus 3."),
            S("Helen", "br", "Then we sound it at quarter to two. Not before."),
          ] },
        ] },
        { layout: "tall", panels: [
          { n: 5, art: { src: "/static/img/comic/helen/p05.webp" }, objects: ["bus-2"], scene: "A council stairwell. Helen alone, phone to her ear, eyes shut, her watch hand pressed to her mouth. Inset, lower right: Ruth in the FreshWay car park writing on a clipboard list.", lines: [
            S("Helen", "tl", "Mum. Get them down by two. Don't ask how I know."),
            A("Ruth, on the phone", "tr", "Helen—"),
            N("bl", "She rang one person first. The east side heard the siren at a quarter to two."),
            N("br", "At two she drove north to Northfield, to run the lists for Calder's evacuees."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 6, art: { src: "/static/img/comic/ruth/p06.webp" }, objects: ["radio-log"], scene: "The pumping station radio room, the morning after. Dev at the radio set, headphones on, writing in a log by lamplight.", lines: [
            N("tl", "10 March."),
            S("Helen, on the radio", "tr", "Is Ruth Lane in CS-4?"),
            S("Dev", "bl", "Yes. Ruth's running it."),
            A("Helen, on the radio", "br", "Thank you."),
          ] },
          { n: 7, art: { src: "/static/img/comic/helen/p07.webp" }, scene: "The allocation office in an old produce pavilion: a long queue of evacuees, trestle tables of ledgers, a laminator. Helen hands a laminated card across the table; in the queue, a woman with a boy of eleven.", lines: [
            N("tl", "Northfield. Two thousand three hundred people, one meal a day. She made the lists fair, and kept them that way."),
            S("Helen", "bl", "Same ration, same queue. Everyone."),
            S("Helen", "bl", "Kerry. The kitchens need someone who can count."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 8, art: { src: "/static/img/comic/helen/p08.webp" }, scene: "Night, a radio tent. Helen hunched at the set, a ration sheet in her hand. Through the tent flap, a meal queue in lamplight.", lines: [
            S("Helen", "tl", "Eleven of twenty-two, Mum. We're feeding children on half."),
            S("Ruth, on the radio", "tr", "They had a truck. We had nothing coming."),
            N("br", "They didn't call each other again."),
          ] },
          { n: 9, art: { src: "/static/img/comic/helen/p09.webp" }, objects: ["day-140"], scene: "Split. Left: Helen in the allocation office a year later, reading a folded note beside an open cash tin full of notes, a walker waiting. Right, faint: a dusty station office in Calder, a biscuit tin on the desk, its lid taped.", lines: [
            N("tl", "Her mother had gone north. The notes came with every walker from Kell Bridge."),
            S("Walker", "tr", "Any answer for Ruth?"),
            S("Helen", "bl", "…Not yet."),
            N("br", "In Calder, a book in a biscuit tin waited in case she came back. She never went back."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 10, art: { src: "/static/img/comic/helen/p10.webp" }, objects: ["convoy-manifest"], scene: "Winter, Y+1. A council room at Northfield, a long table, cold breath. Councillors on one side; Helen standing, signing a manifest on a clipboard. On the table, a jerrycan.", lines: [
            S("Councillor", "tl", "That's the town's last fuel, Helen."),
            S("Helen", "tr", "And Kell Bridge is out of cartridges and insulin."),
            N("bl", "She signed for three trucks, and sent them by the Ridge Road to keep them clear of the old checkpoint."),
          ] },
          { n: 11, art: { src: "/static/img/comic/helen/p11.webp" }, objects: ["convoy-manifest"], scene: "The Ridge Road cutting weeks later, grey winter light. A burnt-out truck; three graves marked with crosses cut from road signs. No people. Behind the cracked windscreen, a child's drawing on the sun visor.", lines: [
            N("tl", "The convoy never reached Kell Bridge."),
            N("br", "Its three drivers surrendered on the Ridge Road and were killed anyway. Bluey Rake. M. Okoro. J. Fenn."),
          ] },
        ] },
        { layout: "pair", panels: [
          { n: 12, art: { src: "/static/img/comic/helen/p12.webp" }, objects: ["helen-letter"], scene: "Y+3, winter. A camp bed at the end of the pavilion, a lantern, a hot-water bottle. Helen, forty-one, thin and grey at the temples, propped up, writing on a clipboard; the cash tin of notes open on the blanket.", lines: [
            N("tl", "Three winters on, she was the one who couldn't get warm."),
            N("br", "She'd kept every one of her mother's notes. Now she answered them all at once."),
          ] },
          { n: 13, art: { src: "/static/img/comic/helen/p13.webp" }, objects: ["helen-letter"], scene: "Dawn at Northfield's gate. A wiry trader in an oilskin coat and wide hat tucks an envelope into her pack beside a tear-off calendar; a bay pack horse; behind her, a young woman with a rubber apron rolled on her pack. Helen in a blanket at the gate, coughing.", lines: [
            S("Nell", "tl", "Kell Bridge exchange. Into her hand, I promise."),
            S("Helen", "tr", "Tell her I'm all right."),
            S("Nell", "bl", "Joke of the day says I shouldn't lie for people. I'll tell her you're stubborn."),
          ] },
        ] },
        { layout: "tall", panels: [
          { n: 14, art: { src: "/static/img/comic/helen/p14.webp" }, objects: ["helen-letter"], scene: "Dark. A shipping container used as a store, light through a bullet-holed door: crates with yellow freight tags, a trader's pack spilled open, a joke-a-day calendar stopped on a winter date, and an envelope, unopened.", lines: [
            N("tl", "Nell Ashby never reached Kell Bridge. The woman travelling with her was taken alive."),
            N("tr", "Helen Lane died three weeks later, aged forty-one, believing her mother had her letter."),
            N("br", "It's still here. At Kell Bridge, Ruth still sends a note north with every walker."),
          ] },
        ] },
      ],
    },
  },
];

export const collectionSet = (id: string): CollectionSet | undefined => SETS.find((s) => s.id === id);

export const panels = (set: CollectionSet): Panel[] => set.comic.pages.flatMap((p) => p.panels);

export const recordsOf = (card: Card): FragmentId[] => card.evidence.map((e) => e.record);

// Can any trip turn this card up yet? Not if all its records lie in places
// the game hasn't built.
export const findableYet = (card: Card): boolean => card.evidence.some((e) => !NOT_YET_REACHABLE.includes(fragment(e.record)!.place));

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
