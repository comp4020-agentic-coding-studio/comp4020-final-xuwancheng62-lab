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
    title: "Limits until further notice",
    seen: "A cereal box, flattened and taped inside the perspex screen at till 1. The marker has gone brown, but you can read all of it.",
    says: [
      "LIMITS UNTIL FURTHER NOTICE",
      "2 tins + 1 dry per CUSTOMER. Yes, per customer. No, your mum isn't a second customer.",
      "Bottled water: 1 case.",
      "Batteries: none. Candles: none. Stop asking.",
      "Kerry on till 2 for limits. Me on the door.",
    ],
    signed: "R. Lane, Manager",
    people: ["R. Lane", "Kerry"],
    places: [],
  },
  {
    id: "store-instruction",
    place: "supermarket",
    order: 2,
    title: "Supply Direction 31",
    seen: "In the manager's office, a lever-arch file labelled STORE INSTRUCTIONS. The last sheet is a fax, curled but legible, and someone has written on it.",
    says: [
      "STATE EMERGENCY SUPPLY DIRECTION ESD-31 · issued 07:12 · All ambient stock in listed stores is to be released to the Regional Reception Centre, Northfield, for evacuee feeding. Collection vehicle ETA 11:00. Stores are not to distribute stock locally. State Emergency Coordination, via FreshWay Regional.",
      "(in biro) 22 pallets. 11 on the truck. 11 down to the cold store for CS-4. 140 on the list down there and the truck isn't feeding them. R.L.",
      "(another pen) Truck 11:40. Driver didn't count. Said Northfield's already full.",
    ],
    signed: "R.L., on a printed state direction",
    people: ["R.L."],
    places: ["Northfield Reception Centre", "CS-4"],
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
    seen: "Locker 6 is labelled K. WREN. It isn't locked, and it's been cleared out except for a child's school jumper, size 10, on the hook. Taped inside the door: a school photo of a boy, maybe eleven, gap in his teeth, in a hi-vis vest down to his knees with LOOP CREW ironed on; a shift note; a council notice.",
    says: [
      "Kerry, I'll take your Sat so you can get T to the dentist. You owe me a Twix. R.",
      "COUNCIL TRANSPORT NOTICE · BUS 2 · FreshWay car park · 09:00 · ONE bag each · bring medicines · passenger lists held in the cash office",
    ],
    signed: "The note: R. The notice: Calder Council.",
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
      "BUS 2 · FRESHWAY CAR PARK · 09:00 · 48 SEATS · to Northfield Reception Centre via Kell Bridge",
      "Priority: children, medical, over 75, no Unit at home.",
      "9–12. PATEL ×4 ✓ (U-118 failed inspection. Keys to Mags.)",
      "14. WREN, Kerry ✓",
      "15. WREN, Tobias (11) ✓ (carrier bag of dog food?? let him)",
      "31. HALLORAN, Margit: declined (language). Has a Unit, she says.",
      "47. LANE, Ruth: seat to the Patterson boy ✓",
      "Bus 3: 13:00 (H. says). No bus by 2: everyone DOWN to CS-4, and I mean down. Dev's bringing water up from the pump station.",
    ],
    signed: "R.L.",
    people: ["Kerry Wren", "Tobias Wren", "the Patels", "Mags", "Margit Halloran", "Ruth Lane", "the Patterson boy", "H.", "Dev"],
    places: ["FreshWay", "Northfield Reception Centre", "Kell Bridge", "CS-4", "the pump station"],
  },
  {
    id: "our-loop",
    place: "reservoir",
    order: 1,
    title: "Our Loop",
    seen: "The pumping station's education room has no windows, and it still has its school display. The worksheets were laminated. Most have curled; one hasn't.",
    says: [
      "OUR LOOP by Toby Wren 5W",
      "1. Scraps go in the cart.",
      "2. The cart goes to the depot under the bypass.",
      "3. Worms and microbes make it into compost.",
      "4. The compost goes in bags for people's Units and grows potatoes.",
      "5. Then you eat the potatoes and it goes round again!!!",
      "Fact: the carts play a song so you bring your bin out. Gerald plays it wrong.",
      "(teacher, in red) Lovely work, Toby. Neater writing next time! ★",
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
      "10 MAR 07:02 NORTHFIELD RECEPTION TO CALDER PS. BUS 2 (FRESHWAY) ARRIVED 15:10 YESTERDAY. 46 OF 48. 2 GOT OFF AT KELL BRIDGE CHECKPOINT PER DRIVER. NAMES NOT GIVEN.",
      "07:05 NORTHFIELD ASKS RE ESD-31 CALDER. 22 PALLETS EXPECTED. 11 RECEIVED. WAS ALL FRESHWAY STOCK SENT. TOLD THEM I DON'T KNOW. I DO SORT OF KNOW.",
      "07:07 NORTHFIELD: ONE MEAL A DAY FROM TODAY. 2,300 AT THE SHOWGROUND.",
      "07:09 LIAISON H. LANE ASKS IS RUTH LANE IN CS-4. TOLD HER YES, RUTH'S RUNNING IT.",
      "07:15 OWN READINGS: RESERVOIR INTAKE ABOVE THE LINE. BORE UNDER IT. ONE METER, NO SPARE BATTERIES. TAKING IT ON TRUST.",
    ],
    signed: "D.P.",
    people: ["D.P.", "H. Lane", "Ruth Lane"],
    places: ["Northfield Reception Centre", "Kell Bridge", "CS-4"],
  },
  {
    id: "day-140",
    place: "reservoir",
    lead: "station-office",
    title: "Day 140",
    seen: "Up the stairs on the dam side, the station office. On the desk, a biscuit tin with the lid taped down. Inside, an exercise book, dry.",
    says: [
      "Day 1. 140 in CS-4. Radio says sit tight two weeks. Gary's in charge of the bins. God help us.",
      "Day 9. Same for everyone. Gary's kids get mine on Sundays. Not up for discussion.",
      "Day 15. Up to the pump station, 23 of us. The rest went to their Units or family. Dev has bore water and a meter that might work. Cold store stock up in Gary's ute, 3 trips: what's left of the 11 pallets.",
      "Day 30. Radio: Northfield still on one meal. Dev looked at me. I know what he means. They had a truck. We had nothing coming.",
      "Day 88. Bus 3 not coming. Not this week, not any week. Stop writing it in.",
      "Day 140. 19 of us. Dev says the old works main runs north under the dam road to Kell Bridge, clean all the way, and Kell can re-pack cartridges. We go tomorrow. Leaving this here in case H. comes back. Helen, we went NORTH. Follow the pipe.",
    ],
    signed: "Unsigned",
    people: ["Gary", "Dev", "H.", "Helen"],
    places: ["CS-4", "the pump station", "Northfield Reception Centre", "Kell Bridge"],
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
      "locker-6": "The council notice says the lists were kept in the cash office.",
      "radio-log": "Bus 2 left from FreshWay. The store may have kept the list.",
    },
  },
  {
    id: "station-office",
    place: "reservoir",
    label: "The station office",
    fragment: "day-140",
    from: {
      "bus-2": "The list says CS-4's water came from Dev at the pump station. Its office is up the stairs on the dam side.",
      "radio-log": "The radio room is at the pump station. Its office is up the stairs on the dam side.",
    },
  },
];

export const CONNECTIONS: readonly Connection[] = [
  { a: "ration-sign", b: "locker-6", text: "The limits sign puts Kerry on till 2. Locker 6 belongs to K. Wren; the note inside is addressed to Kerry." },
  { a: "locker-6", b: "bus-2", text: "The Wrens are ticked on the Bus 2 list. Locker 6 was cleared out, except for a child's jumper." },
  { a: "cart-dogs", b: "locker-6", text: "The drawing is signed Toby W. The note in K. Wren's locker mentions T." },
  { a: "ration-sign", b: "bus-2", text: "Both are signed R. Lane or R.L." },
  { a: "cart-dogs", b: "our-loop", text: "Both mention Gerald and a song." },
  { a: "bus-2", b: "our-loop", text: "Tobias Wren, 11, is on the Bus 2 list. Toby Wren of class 5W wrote the worksheet." },
  { a: "store-instruction", b: "radio-log", text: "Both cite ESD-31. The store sent 11 of 22 pallets. Northfield reports receiving 11 of 22." },
  { a: "store-instruction", b: "day-140", text: "Both mention 11 pallets in the cold store, and CS-4." },
  { a: "radio-log", b: "day-140", text: "The radio log records Northfield going to one meal a day. The exercise book mentions it on Day 30." },
  { a: "radio-log", b: "bus-2", text: "The Bus 2 list has 48 seats. The radio log records 46 arriving." },
  { a: "bus-2", b: "day-140", text: "The list expects a Bus 3 at 13:00. On Day 88 the exercise book stops expecting one." },
  { a: "radio-log", b: "ration-sign", text: "H. Lane asks after Ruth Lane. The limits sign is signed R. Lane." },
];

export const QUESTIONS: readonly Question[] = [
  { id: "dogs", text: "What happened to Bigsy, Lady and Chips?", openedBy: ["cart-dogs"], about: ["cart-dogs", "our-loop", "bus-2"] },
  { id: "gerald", text: "Who is Gerald?", openedBy: ["cart-dogs", "our-loop"], about: ["cart-dogs", "our-loop"] },
  { id: "hub-lorry", text: "Who did the eleven pallets kept back end up feeding?", openedBy: ["store-instruction"], about: ["store-instruction", "radio-log", "day-140"] },
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
