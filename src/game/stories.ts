// Records left in the wasteland (PLAN.md, "Records in the wasteland"): what
// each one is, where it lies, which leads it opens, and which record a trip
// turns up. Pure: the caller passes the records already found, oldest first.

export type FragmentId = "ration-sign" | "store-instruction" | "cart-dogs" | "locker-6" | "bus-2" | "our-loop" | "radio-log" | "day-140";
export type LeadId = "kerrys-locker" | "passenger-lists" | "station-office";
export type QuestionId = "dogs" | "gerald" | "hub-lorry" | "wrens" | "kell-bridge" | "who-is-h" | "four" | "nineteen";

export interface Fragment {
  id: FragmentId;
  place: string;
  title: string;
  // the order Look around finds it in; records behind a lead have none
  order?: number;
  lead?: LeadId;
  seen: string;
  says: string[];
  signed: string;
  people: string[];
  places: string[];
}

export interface Lead {
  id: LeadId;
  place: string;
  label: string;
  fragment: FragmentId;
  // what each record that opens it points at
  from: Partial<Record<FragmentId, string>>;
}

export interface Connection {
  a: FragmentId;
  b: FragmentId;
  text: string;
}

export interface Question {
  id: QuestionId;
  text: string;
  openedBy: FragmentId[];
  about: FragmentId[];
}

export const FRAGMENTS: readonly Fragment[] = [
  {
    id: "ration-sign",
    place: "supermarket",
    order: 1,
    title: "A sign behind the tills",
    seen: "A cereal box, flattened and taped inside the perspex screen at till 1. The marker has gone brown, but you can read all of it.",
    says: [
      "FROM TODAY",
      "1 tin + 1 dry per HOUSEHOLD. Not per person.",
      "Baby formula: ask me.",
      "Bread: none. Stop asking.",
      "Water from the pump station, not the tap. Tuesdays and Fridays.",
      "Kerry on till 2. Me on the door.",
      "If you took two yesterday you know who you are.",
    ],
    signed: "R. Lane, Manager",
    people: ["R. Lane", "Kerry"],
    places: ["the pump station"],
  },
  {
    id: "store-instruction",
    place: "supermarket",
    order: 2,
    title: "Store Instruction 0714",
    seen: "In the manager's office, a lever-arch file labelled STORE INSTRUCTIONS. Someone has written on the last sheet.",
    says: [
      "STORE INSTRUCTION 0714, ALL STORES, CALDER & ENDER AREA. Under Emergency Allocation Order EA-31, all ambient and chilled stock is to be palletised for collection by the regional hub vehicle on Tuesday. Stores must not distribute stock outside normal sale. Store managers are personally responsible for stock integrity.",
      "(in biro) 22 pallets. 11 to the hub. 11 in the cold room, logged as damaged. Head office can come and count them. R.L.",
      "(another pen) Hub lorry took 11, Tues. Driver didn't ask.",
    ],
    signed: "R.L., on a printed company instruction",
    people: ["R.L."],
    places: [],
  },
  {
    id: "cart-dogs",
    place: "supermarket",
    order: 3,
    title: "The cart dogs",
    seen: "In the staff room, taped inside a cupboard door where the light never reached: a crayon drawing. Three dogs, a white cart with a face, music notes coming out of it.",
    says: ["THE CART DOGS", "BIGSY LADY CHIPS", "They come when Gerald sings.", "They are NOT strays they are MINE", "DONT TELL MUM"],
    signed: "Toby W.",
    people: ["Toby W.", "Gerald", "Bigsy", "Lady", "Chips"],
    places: [],
  },
  {
    id: "locker-6",
    place: "supermarket",
    lead: "kerrys-locker",
    title: "Locker 6",
    seen: "Locker 6 is labelled K. WREN. It isn't locked. There's nothing in it but a hanger on the floor and what's taped inside the door: a school photo of a boy, maybe eleven, gap in his teeth, in a hi-vis vest down to his knees with LOOP CREW ironed on; a shift note; a council slip.",
    says: [
      "Kerry, Sat swapped with me for T's dentist. You owe me a Twix. R.",
      "BUS 2 · FreshWay car park · Thursday 9 a.m. · One bag each. Passenger lists held in the cash office.",
    ],
    signed: "The note: R. The slip: unsigned.",
    people: ["K. Wren", "Kerry", "T.", "R."],
    places: ["FreshWay"],
  },
  {
    id: "bus-2",
    place: "supermarket",
    lead: "passenger-lists",
    title: "Bus 2",
    seen: "The cash office door was levered open long ago and the safe is empty. Nobody took the binders. One is labelled EVAC LISTS: CARBON COPIES.",
    says: [
      "BUS 2 · FRESHWAY CAR PARK · 48 SEATS · to Northfield Relief Centre",
      "Priority: children, medical, over 75.",
      "9–12. PATEL ×4 ✓",
      "14. WREN, Kerry ✓",
      "15. WREN, Tobias (11) ✓ (carrier bag of dog food. Let him.)",
      "31. HALLORAN, Margit: declined (language)",
      "47. LANE, Ruth: seat to the Patterson boy ✓",
      "Bus 3: Thursday week (H. says). Anyone left, be here 9 a.m. If not: pump station. Dev has water.",
    ],
    signed: "R.L.",
    people: ["Kerry Wren", "Tobias Wren", "the Patels", "Margit Halloran", "Ruth Lane", "the Patterson boy", "H.", "Dev"],
    places: ["FreshWay", "Northfield Relief Centre", "the pump station"],
  },
  {
    id: "our-loop",
    place: "reservoir",
    order: 1,
    title: "Our Loop",
    seen: "The visitor centre at the pumping station still has its school display. The worksheets were laminated. Most have curled; one hasn't.",
    says: [
      "OUR LOOP by Toby Wren 5W",
      "1. Food waste goes in the cart.",
      "2. The cart goes to the depot under the bypass and the germs eat it (they are GOOD germs).",
      "3. It makes gas and compost.",
      "4. The gas makes power and the compost grows potatoes.",
      "5. Then you eat the potatoes and it goes round again!!!",
      "Fact: the carts play a song so you bring your bin out. Gerald plays it wrong.",
      "(teacher, in red) Lovely, Toby! “Microbes,” not germs. ★",
    ],
    signed: "Toby Wren 5W",
    people: ["Toby Wren", "Gerald"],
    places: ["the depot under the bypass"],
  },
  {
    id: "radio-log",
    place: "reservoir",
    order: 2,
    title: "The radio log",
    seen: "In the radio room, a hardback notebook in the desk drawer. Neat capitals, the same hand all the way through, times down the margin.",
    says: [
      "14 AUG 10:02 NORTHFIELD RELIEF TO CALDER PS. BUS 2 (FRESHWAY) ARRIVED 21:40 YESTERDAY. 46 OF 48. 2 GOT OFF AT KELL BRIDGE PER DRIVER. NAMES NOT GIVEN.",
      "10:05 NORTHFIELD ASKS RE EA-31 CALDER ALLOCATION. 22 PALLETS EXPECTED. 11 RECEIVED. WAS ALL FRESHWAY STOCK SENT. TOLD THEM I DON'T KNOW. I DO SORT OF KNOW.",
      "10:07 NORTHFIELD: RATIONS TO ONE MEAL A DAY FROM TOMORROW. 900 IN THE HALLS.",
      "10:09 LIAISON H. LANE ASKS IS RUTH LANE AT THE PUMP STATION. TOLD HER NOT YET.",
    ],
    signed: "D.P.",
    people: ["D.P.", "H. Lane", "Ruth Lane"],
    places: ["Northfield Relief Centre", "Kell Bridge", "the pump station"],
  },
  {
    id: "day-140",
    place: "reservoir",
    lead: "station-office",
    title: "Day 140",
    seen: "Up the stairs on the dam side, the station office. On the desk, a biscuit tin with the lid taped down. Inside, an exercise book, dry.",
    says: [
      "Day 1. 23 of us. Dev says the tap's good. Cold room stock up from FreshWay in Gary's ute, 3 trips. 11 pallets.",
      "Day 9. Same for everyone. Gary's kids get mine on Sundays. Not up for discussion.",
      "Day 30. Radio: Northfield still on one meal. Dev looked at me. I know what he means. They had a lorry. We had nothing coming.",
      "Day 61. 9 crates left. Bus 3 not Thursday.",
      "Day 88. Bus 3 not any Thursday. Stop writing it in.",
      "Day 140. 19 of us. Dev says the old outflow runs north under the dam road to Kell Bridge, water the whole way. We go tomorrow. Leaving this here in case H. comes back. Helen, we went NORTH. Follow the pipe.",
    ],
    signed: "Unsigned",
    people: ["Dev", "Gary", "H.", "Helen"],
    places: ["FreshWay", "Northfield Relief Centre", "Kell Bridge"],
  },
];

export const LEADS: readonly Lead[] = [
  {
    id: "kerrys-locker",
    place: "supermarket",
    label: "Kerry's locker",
    fragment: "locker-6",
    from: { "ration-sign": "The sign puts Kerry on till 2. The staff room has lockers." },
  },
  {
    id: "passenger-lists",
    place: "supermarket",
    label: "The passenger lists",
    fragment: "bus-2",
    from: {
      "locker-6": "The bus slip says the lists were kept in the cash office.",
      "radio-log": "Bus 2 left from FreshWay. The store may have kept the list.",
    },
  },
  {
    id: "station-office",
    place: "reservoir",
    label: "The station office",
    fragment: "day-140",
    from: {
      "bus-2": "Anyone left was to go to the pump station. Its office is up the stairs on the dam side.",
      "radio-log": "Ruth Lane was expected at the pump station.",
    },
  },
];

export const CONNECTIONS: readonly Connection[] = [
  { a: "ration-sign", b: "locker-6", text: "The ration sign puts Kerry on till 2. Locker 6 belongs to K. Wren; the note inside is addressed to Kerry." },
  { a: "locker-6", b: "bus-2", text: "The Wrens are ticked on the Bus 2 list. Locker 6 was emptied." },
  { a: "cart-dogs", b: "locker-6", text: "The drawing is signed Toby W. The note in K. Wren's locker mentions T.'s dentist." },
  { a: "ration-sign", b: "bus-2", text: "Both are signed R. Lane or R.L." },
  { a: "cart-dogs", b: "our-loop", text: "Both mention Gerald and a song." },
  { a: "bus-2", b: "our-loop", text: "Tobias Wren, 11, is on the Bus 2 list. Toby Wren of class 5W wrote the worksheet." },
  { a: "store-instruction", b: "radio-log", text: "Both cite allocation EA-31. The store sent 11 of 22 pallets. Northfield reports receiving 11 of 22." },
  { a: "store-instruction", b: "day-140", text: "Both count 11 pallets in the cold room." },
  { a: "radio-log", b: "day-140", text: "The radio log records Northfield cutting to one meal a day. The exercise book mentions it on Day 30." },
  { a: "radio-log", b: "bus-2", text: "The Bus 2 list has 48 seats. The radio log records 46 arriving." },
  { a: "bus-2", b: "day-140", text: "The list expects Bus 3 “Thursday week”. The exercise book stops expecting it." },
  { a: "radio-log", b: "ration-sign", text: "H. Lane asks after Ruth Lane. The ration sign is signed R. Lane." },
];

export const QUESTIONS: readonly Question[] = [
  { id: "dogs", text: "What happened to Bigsy, Lady and Chips?", openedBy: ["cart-dogs"], about: ["cart-dogs", "our-loop", "bus-2"] },
  { id: "gerald", text: "Who is Gerald?", openedBy: ["cart-dogs", "our-loop"], about: ["cart-dogs", "our-loop"] },
  { id: "hub-lorry", text: "Where was the hub lorry taking the stock?", openedBy: ["store-instruction"], about: ["store-instruction", "radio-log"] },
  { id: "wrens", text: "Did the Wrens reach Northfield?", openedBy: ["bus-2"], about: ["bus-2", "radio-log"] },
  { id: "kell-bridge", text: "Who got off at Kell Bridge?", openedBy: ["radio-log"], about: ["radio-log", "bus-2"] },
  { id: "who-is-h", text: "Who is H.?", openedBy: ["bus-2", "day-140"], about: ["bus-2", "radio-log", "day-140"] },
  { id: "four", text: "What happened to the four people the book stops counting?", openedBy: ["day-140"], about: ["day-140"] },
  { id: "nineteen", text: "Did the nineteen reach Kell Bridge?", openedBy: ["day-140"], about: ["day-140", "radio-log"] },
];

export const fragment = (id: string): Fragment | undefined => FRAGMENTS.find((f) => f.id === id);
export const lead = (id: string): Lead | undefined => LEADS.find((l) => l.id === id);
export const hasRecords = (place: string): boolean => FRAGMENTS.some((f) => f.place === place);

export const LOOK_AROUND = "look";
export type Focus = LeadId | typeof LOOK_AROUND;

export interface OpenLead {
  lead: Lead;
  // the record that opened it first, and how many records in that happened
  by: FragmentId;
  at: number;
}

// Leads you've opened and not yet followed, oldest first; ties go to the
// order they're written in.
export function openLeads(found: readonly FragmentId[], place?: string): OpenLead[] {
  const out: OpenLead[] = [];
  LEADS.forEach((l) => {
    if (found.includes(l.fragment) || (place && l.place !== place)) return;
    const at = found.findIndex((f) => f in l.from);
    if (at >= 0) out.push({ lead: l, by: found[at], at });
  });
  return out.sort((x, y) => x.at - y.at || LEADS.indexOf(x.lead) - LEADS.indexOf(y.lead));
}

// What the form starts on: the newest lead here, else looking around.
export function defaultFocus(found: readonly FragmentId[], place: string): Focus {
  const leads = openLeads(found, place);
  if (!leads.length) return LOOK_AROUND;
  const newest = Math.max(...leads.map((l) => l.at));
  return leads.find((l) => l.at === newest)!.lead.id;
}

// The record a trip turns up. A lead you can follow gives its record; looking
// around gives the next open record, then the oldest lead; else nothing. A
// lead that's stale or not yours counts as looking around.
export function pickFragment(found: readonly FragmentId[], place: string, focus: string): FragmentId | null {
  const leads = openLeads(found, place);
  const chosen = leads.find((l) => l.lead.id === focus);
  if (chosen) return chosen.lead.fragment;
  const next = FRAGMENTS.filter((f) => f.place === place && f.order && !found.includes(f.id)).sort((a, b) => a.order! - b.order!)[0];
  if (next) return next.id;
  return leads[0]?.lead.fragment ?? null;
}

export type PlaceStatus = "leads" | "corners" | "unknown" | "done";

export function placeStatus(found: readonly FragmentId[], place: string): PlaceStatus | null {
  const here = FRAGMENTS.filter((f) => f.place === place);
  if (!here.length) return null;
  if (openLeads(found, place).length) return "leads";
  if (here.some((f) => f.order && !found.includes(f.id))) return "corners";
  return here.every((f) => found.includes(f.id)) ? "done" : "unknown";
}

export const STATUS_TEXT: Record<Exclude<PlaceStatus, "leads">, string> = {
  corners: "Corners you haven't searched.",
  unknown: "Nothing more you know to look for here.",
  done: "You've read everything here.",
};

// Leads a newly found record opened, with what it points at.
export const leadsOpenedBy = (id: FragmentId): { lead: Lead; why: string }[] =>
  LEADS.filter((l) => l.from[id]).map((l) => ({ lead: l, why: l.from[id]! }));

export const connectionsFor = (found: readonly FragmentId[]): Connection[] =>
  CONNECTIONS.filter((c) => found.includes(c.a) && found.includes(c.b));

export const openQuestions = (found: readonly FragmentId[]): Question[] =>
  QUESTIONS.filter((q) => q.openedBy.some((f) => found.includes(f)));
