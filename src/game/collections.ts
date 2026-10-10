import type { FragmentId } from "./stories.ts";

// Story collections (docs/narrative/toby-collection.md). A card is unlocked
// by finding any of its records, so progress is the journal's discoveries
// read another way: nothing to lose, nothing to keep in step. Pure.

export type SetId = "toby";
export type Basis = "record" | "account" | "unknown";

export interface Card {
  n: number;
  title: string;
  period: string;
  unlockedBy: FragmentId[];
  front: string;
  sure: string;
}

export interface Panel {
  n: number;
  // what the artwork will show; also its text alternative
  scene: string;
  caption: string;
  basis: Basis[];
  sources: FragmentId[];
}

export interface CollectionSet {
  id: SetId;
  title: string;
  // shown before any card is found, so the set's name gives nothing away
  untitled: string;
  cards: Card[];
  comic: { title: string; panels: Panel[] };
}

export const SETS: readonly CollectionSet[] = [
  {
    id: "toby",
    title: "Toby Wren",
    untitled: "Someone in the records",
    cards: [
      {
        n: 1,
        title: "Gerald sings",
        period: "Childhood",
        unlockedBy: ["cart-dogs", "our-loop"],
        front: "A Year 5 kid who loved the Loop's carts, called one of them Gerald, and fed three dogs he said were his.",
        sure: "His own drawing and worksheet.",
      },
      {
        n: 2,
        title: "One bag each",
        period: "The Ninth",
        unlockedBy: ["locker-6", "bus-2"],
        front: "Ticked onto Bus 2 with his mum, Kerry, and a carrier bag of dog food.",
        sure: "A tick shows he was checked on, not that he arrived.",
      },
      {
        n: 3,
        title: "Showground school",
        period: "Northfield",
        unlockedBy: ["chime-camp"],
        front: "A school card: Tobias Wren, Year 8, Northfield showground. Someone has kept it for years.",
        sure: "The card is real. Who carries it now isn't certain.",
      },
      {
        n: 4,
        title: "Quicker than me",
        period: "Apprentice",
        unlockedBy: ["dev-toolbag"],
        front: "D.P.'s last log: “T doing the screens. Kid's quicker than me now, don't tell him.”",
        sure: "The log calls him T.",
      },
      {
        n: 5,
        title: "He didn't show them",
        period: "Dev's fate",
        unlockedBy: ["chained-valve"],
        front: "Chalk beside a chained valve: Dev Pillai killed here, 18 May, by Mercer's lot. Signed T.W.",
        sure: "An account, not something you saw.",
      },
      {
        n: 6,
        title: "Don't go single",
        period: "Now",
        unlockedBy: ["chalk-warning"],
        front: "Chalk in the bus shelter, warning travellers off the Ridge Road on Thursdays. Signed T.",
        sure: "Recent. The signature fits.",
      },
    ],
    comic: {
      title: "The cart kid",
      panels: [
        { n: 1, scene: "A white Loop cart with a painted face on a suburban footpath. A boy of about eleven crouches with three dogs. Music notes rise from the cart.", caption: "They come when Gerald sings.", basis: ["record"], sources: ["cart-dogs", "our-loop"] },
        { n: 2, scene: "Night in a supermarket staff room. A boy asleep across two chairs under a jacket; a radio on the shelf.", caption: "The Ninth. His mum was on the night shift.", basis: ["record"], sources: ["locker-6"] },
        { n: 3, scene: "The FreshWay car park in the morning, a queue for a bus. A boy holds a carrier bag; a woman's hand rests on his shoulder.", caption: "Bus 2. One bag each. His was dog food.", basis: ["record"], sources: ["bus-2"] },
        { n: 4, scene: "A bus far off on an empty highway under a grey sky.", caption: "Bus 2 left for Northfield. Whether he got there, the list can't say.", basis: ["record", "unknown"], sources: ["bus-2"] },
        { n: 5, scene: "A laminated school card on a trestle table in a tent; showground pavilions behind.", caption: "Northfield showground school. Year 8.", basis: ["record"], sources: ["chime-camp"] },
        { n: 6, scene: "An empty road, one set of footprints leading away.", caption: "How he got from Northfield to the old works, the records don't say.", basis: ["unknown"], sources: [] },
        { n: 7, scene: "Inside a concrete gallery by torchlight: a man and a teenager clearing intake screens. The man's back is to us; the teenager's face is in shadow.", caption: "“Kid's quicker than me now. Don't tell him.”", basis: ["record"], sources: ["dev-toolbag"] },
        { n: 8, scene: "A valve wheel wrapped in chain, a yellow tag wired on, chalk letters beneath. No one in the frame.", caption: "“He didn't show them where.” That's T.W.'s account.", basis: ["account"], sources: ["chained-valve"] },
        { n: 9, scene: "The mouth of the underpass at dusk: a cart on its side, a small solar panel, steel bowls, dogs watching from a distance.", caption: "Someone keeps the dogs close now.", basis: ["record", "unknown"], sources: ["chime-camp"] },
        { n: 10, scene: "A bus shelter wall with fresh chalk and a small dog drawn beside it.", caption: "“AH on Ridge Rd Thurs. Don't go single.” Still open: who lives at the Nest, who Mercer is, and what happened to Bigsy, Lady and Chips.", basis: ["record", "unknown"], sources: ["chalk-warning"] },
      ],
    },
  },
];

export const collectionSet = (id: string): CollectionSet | undefined => SETS.find((s) => s.id === id);

export const isUnlocked = (card: Card, found: readonly FragmentId[]): boolean => card.unlockedBy.some((f) => found.includes(f));

export const unlockedCount = (set: CollectionSet, found: readonly FragmentId[]): number => set.cards.filter((c) => isUnlocked(c, found)).length;

export const isComplete = (set: CollectionSet, found: readonly FragmentId[]): boolean => unlockedCount(set, found) === set.cards.length;
