// Records left in the wasteland (PLAN.md, "Records in the wasteland"): what
// each one is, where it lies, which leads it opens, and which record a trip
// turns up. Pure: the caller passes the records already found, oldest first.

export type FragmentId =
  | "ration-sign" | "store-instruction" | "cart-dogs" | "locker-6" | "bus-2" | "our-loop" | "radio-log" | "day-140"
  | "chalk-warning" | "chime-camp" | "dev-toolbag" | "chained-valve" | "toby-letter"
  | "cs4-board" | "exchange-chit"
  | "left-word" | "toby-answer" | "word-north" | "ruth-parcel" | "toby-thanks"
  | "pump-log" | "mags-jobbook" | "mags-bore-tag" | "patels-keys" | "ferris-docket" | "mags-dropboard" | "tagged-door"
  | "unit-plate"
  | "dev-loop-roster" | "dev-repack-card"
  | "siren-talk" | "council-bulletin" | "convoy-manifest" | "helen-letter";
export type LeadId = "kerrys-locker" | "passenger-lists" | "station-office" | "old-works-gallery" | "the-valve" | "the-basement"
  | "leave-word" | "tin-answer" | "kell-walkers" | "kell-reply" | "bus-shelter-chalk"
  | "bore-house" | "bore-motor" | "under-the-bench" | "key-board"
  | "depot-office" | "repack-bench" | "liaison-bulletins" | "school-display";
export type QuestionId = "dogs" | "gerald" | "hub-lorry" | "wrens" | "kell-bridge" | "who-is-h" | "four" | "nineteen" | "camp" | "mercer" | "intake" | "answer" | "tell-ruth" | "toby-north" | "who-is-mh" | "patels" | "assessed" | "east-side" | "twelve-forty";

export interface Fragment {
  id: FragmentId;
  // a destination; HOME for a record found by inspecting your own shelter;
  // or one of NOT_YET_REACHABLE, a place the story needs but the game lacks
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
  // Toby's later years (docs/narrative/toby-collection.md). Recent traces
  // have a cause in the writer's notes: Toby lives at the Nest and chalks
  // warnings; the chain and tag are from 18 May last year.
  {
    id: "chalk-warning",
    place: "supermarket",
    order: 4,
    title: "Don't go single",
    seen: "At the far end of the car park, the bus shelter. On its inside wall, out of the rain, chalk that's been gone over more than once, and a small dog drawn beside it.",
    says: ["AH ON RIDGE RD THURS.", "DON'T GO SINGLE.", "T"],
    signed: "T",
    people: ["T", "AH"],
    places: ["Ridge Road"],
  },
  {
    id: "chime-camp",
    place: "nest",
    order: 1,
    title: "Somebody feeds them",
    seen: "At the mouth of the underpass, before the dark: a cart on its side with GERALD painted on it in a child's letters, a sleeping roll packed into its bin. A cart chime speaker wired to a battery and a small solar panel. Steel bowls in a row, the names scratched into them old and dull, and two newer ones. Chalk tally marks counting days. Pinned inside the bin, a hand-drawn map and a laminated card.",
    says: [
      "Bowls: BIGSY · LADY · CHIPS · (newer) RUST · NO-NAME",
      "Map: the depot culvert, an arrow under the dam, “OLD WORKS GALLERY — DON'T”",
      "Card: NORTHFIELD SHOWGROUND SCHOOL · Tobias Wren · Yr 8",
    ],
    signed: "The card: Northfield Showground School. The rest: unsigned.",
    people: ["Bigsy", "Lady", "Chips", "Gerald", "Tobias Wren"],
    places: ["Northfield Reception Centre", "the old works gallery"],
  },
  {
    id: "dev-toolbag",
    place: "reservoir",
    lead: "old-works-gallery",
    title: "Intake log",
    seen: "Down the steps under the dam, the old works gallery: dry concrete, the sound of water somewhere further in. Against the wall, a canvas toolbag stencilled D.P. In a tin inside it, a logbook.",
    says: [
      "AUTUMN. INTAKE CLEAR BY THURS.",
      "T DOING THE SCREENS. KID'S QUICKER THAN ME NOW, DON'T TELL HIM.",
      "TWO BIKES ON THE RIDGE YESTERDAY. THEY STAYED BACK.",
      "TODAY: SCREENS 3 AND 4, THEN THE",
    ],
    signed: "D.P.",
    people: ["D.P.", "T"],
    places: ["the old works gallery"],
  },
  {
    id: "chained-valve",
    place: "reservoir",
    lead: "the-valve",
    title: "Flow by arrangement",
    seen: "Further along the gallery, the outflow valve. The wheel is wrapped in chain and padlocked, with a yellow plastic freight tag wired on. Under Dev's old painted note, newer chalk in a teenager's capitals.",
    says: [
      "(painted, old) OLD WORKS OUTFLOW. ¼ TURN ONLY. DP",
      "(tag) PROPERTY OF THE WEIGHBRIDGE · FLOW BY ARRANGEMENT",
      "(chalk) DEV PILLAI KILLED HERE 18 MAY BY MERCER'S LOT. HE DIDN'T SHOW THEM WHERE. T.W.",
    ],
    signed: "The paint: DP. The chalk: T.W. The tag: unsigned.",
    people: ["Dev Pillai", "Mercer", "T.W."],
    places: ["the Weighbridge", "the old works gallery"],
  },
  // Writer's chain of custody: Toby leaves it in the workshop's forwarding
  // tin, which walkers bound for Northfield empty and tick. Reading it
  // doesn't take it; it stays for the next walker.
  {
    id: "toby-letter",
    place: "workshop",
    order: 1,
    title: "Fourth letter",
    seen: "Inside the office door, a dented biscuit tin painted FORWARDING. On the lid, in pencil: NORTHFIELD: WREN ✓ WREN ✓ WREN ✓. Inside, one folded letter with a note pinned to it. You read it and put it back for the next walker.",
    says: [
      "(note) TO KERRY WREN, SHOWGROUND KITCHENS, NORTHFIELD. NOT SEALED, NOTHING TO STEAL. T",
      "Mum,",
      "This is the fourth one. If you got the others you can skip the first bit.",
      "I'm OK. I'm back in Calder, I know you said not to. Dev died. The people with the yellow tags did it. I got out through the pipe and I'm not hurt anymore.",
      "I fix things for people, generators, pumps, a lady's heater, and they give me food. Dev said I was quicker than him.",
      "The dogs are still here. Not Bigsy, maybe his kids. They keep the tag people off me.",
      "I'm sorry about what I said when I left. You weren't keeping me in a tent for nothing. I just couldn't stay.",
      "If you write back, leave it in this tin. I'm staying till the valve's open. Then I'll come and see you. Promise.",
      "Toby",
    ],
    signed: "Toby",
    people: ["Kerry Wren", "Toby", "Dev", "Bigsy"],
    places: ["Northfield Reception Centre"],
  },
  // Ruth's collection (docs/narrative/collections-next.md).
  {
    id: "cs4-board",
    place: "supermarket",
    lead: "the-basement",
    title: "Same for everyone",
    seen: "Down the ramp, the basement car park that was CS-4. Cardboard and camp beds are still laid out in rows. On a concrete pillar, a whiteboard ruled into days, a tally of 140 crossed through and redone. The marker has gone brown.",
    says: [
      "DAY 12 · 140 IN",
      "SAME FOR EVERYONE",
      "1 tin + 2 L each. Water truck from Dev: Tue, Fri.",
      "NO trading rations. R.L.",
      "(squeezed underneath, another hand) except Sundays? G.",
    ],
    signed: "R.L.; the question: G.",
    people: ["R.L.", "Dev", "G."],
    places: ["CS-4"],
  },
  // Writer's cause: walkers from Kell Bridge pay for Mags's repairs with
  // exchange chits, which Kell Bridge honours. Seen through the payment
  // tin's split lid; nothing is taken.
  {
    id: "exchange-chit",
    place: "workshop",
    order: 2,
    title: "Kell Bridge exchange",
    seen: "Beside the forwarding tin, a padlocked payment tin with a split in its lid. Through the split, on a loop of wire: a stamped tin token, punched twice. Something scratched on its back catches the light.",
    says: ["KELL BRIDGE EXCHANGE", "1 CARTRIDGE RE-PACK", "R.L.", "(scratched on the back) AUT Y5"],
    signed: "R.L., stamped",
    people: ["R.L."],
    places: ["Kell Bridge"],
  },
  // Toby's story task (docs/narrative/toby-collection.md, "Restoring contact").
  // Two of these are the player's own notes; the rest are answers. Each
  // opens the lead to the next, so it's done one trip at a time.
  {
    id: "left-word",
    place: "workshop",
    lead: "leave-word",
    title: "Word for T",
    seen: "You tear a page from the back of your journal and write in capitals, so it reads like the others. You fold it into the forwarding tin, on top of the letter to Kerry Wren.",
    says: [
      "T —",
      "R.L. IS ALIVE. KELL BRIDGE EXCHANGE, STAMPING CHITS THIS AUTUMN. ONE'S IN THE PAYMENT TIN.",
      "IF YOU WANT WORD CARRIED, SAY HOW.",
      "— EAST SIDE",
    ],
    signed: "You, as “east side”",
    people: ["T", "R.L."],
    places: ["Kell Bridge"],
  },
  {
    id: "toby-answer",
    place: "workshop",
    lead: "tin-answer",
    title: "Ask R.L. for my post",
    seen: "Your page is gone from the forwarding tin. In its place, a scrap of cardboard torn from a box, written on in pencil pressed hard, chalk dust in the folds.",
    says: [
      "EAST SIDE —",
      "WHO ARE YOU. HOW DO YOU KNOW R.L.",
      "IF SHE'S ALIVE TELL HER I'M OK. DON'T TELL HER WHERE. NOT TILL THE VALVE.",
      "NOBODY WALKS TO CALDER. IF MUM WROTE BACK IT WENT TO KELL. ASK R.L. FOR MY POST.",
      "KELL WALKERS PAY THE OLD LADY IN CHITS. THEY GO BACK NORTH.",
      "T",
    ],
    signed: "T",
    people: ["T", "R.L.", "Mum"],
    places: ["Kell Bridge", "Calder"],
  },
  {
    id: "word-north",
    place: "workshop",
    lead: "kell-walkers",
    title: "For R. Lane, by hand",
    seen: "You fold a second page round a corner of T's cardboard, so she'll know the hand, and push it through the split in the payment tin, where the next Kell Bridge walker will find it with the chits.",
    says: [
      "FOR R. LANE, KELL BRIDGE EXCHANGE. BY HAND.",
      "T IS ALIVE AND WELL. HE ASKS FOR HIS POST.",
      "HE ASKS YOU NOT TO COME LOOKING. NOT YET.",
      "SEND IT TO THE WORKSHOP TIN IN CALDER. — EAST SIDE",
    ],
    signed: "You, as “east side”",
    people: ["R. Lane", "T"],
    places: ["Kell Bridge", "Calder"],
  },
  {
    id: "ruth-parcel",
    place: "workshop",
    lead: "kell-reply",
    title: "Hold for him",
    seen: "In the payment tin, wrapped in oilcloth and tied with string: three envelopes, sealed, in the same round hand, and a chit folded inside a note. You move the parcel to the forwarding tin, where T will look.",
    says: [
      "(each envelope) Toby Wren, c/o R. Lane, Kell Bridge exchange. Please hold for him.",
      "(on the back) K. Wren, Showground Kitchens, Northfield",
      "(the note) Sat on these since winter. Thought he'd gone with Dev. I won't ask where.",
      "Tell him the bench is his when he wants it. Tell him to eat. R.",
      "(the chit) KELL BRIDGE EXCHANGE · ONE MEAL · R.L.",
    ],
    signed: "R.; the envelopes: K. Wren",
    people: ["Toby Wren", "K. Wren", "R. Lane", "Dev"],
    places: ["Kell Bridge", "Northfield Reception Centre"],
  },
  {
    id: "toby-thanks",
    place: "supermarket",
    lead: "bus-shelter-chalk",
    title: "Got Mum's",
    seen: "On the bus shelter's inside wall, beside the old warning and the little dog, new chalk, fresh enough to smudge.",
    says: [
      "EAST SIDE. GOT MUM'S. 3. SHE'S OK.",
      "TELL R.L. THANKS. I'LL COME FOR THE BENCH.",
      "IF THE TAG PEOPLE COME EAST I'LL CHALK YOUR HATCH FIRST.",
      "T",
    ],
    signed: "T",
    people: ["T", "R.L.", "Mum"],
    places: [],
  },
  // Dev's run sheet (docs/narrative/dev.md): the bore house is his.
  {
    id: "pump-log",
    place: "reservoir",
    lead: "bore-house",
    title: "All to CS-4",
    seen: "Behind the pumping station, a brick hut over the deep bore. On a nail by the pump starter, a clipboard of run sheets, the top one creased where a thumb held it, carbon underneath. A dead torch on the shelf.",
    says: [
      "9 MAR · MAINS OFF 04:12 · BORE ON GENNY 05:30",
      "BORE: ALL TO CS-4 (FRESHWAY). 140 THERE, NO UNIT, NO STACK. EAST SIDE STAYS ON THE MAIN. THEY HAVE UNITS. RES INTAKE ABOVE THE LINE: RUN YOUR STACKS. TOLD COUNCIL. NO REPLY.",
      "10 MAR · TRUCK 1 4,000 L · TRUCK 2 4,000 L · D.P. DRIVING · G. UNLOADING AT THE RAMP",
      "14 MAR · 2 FROM ARDEN ST AT THE GATE, CARTRIDGES GONE. GAVE 20 L EACH OFF THE TRUCK. SAME TOMORROW IF THEY COME.",
      "15 MAR · 6 AT THE GATE.",
      "17 MAR · MOTOR BURNT OUT. M.H. REWOUND IT. ¼ LOAD TILL RUN IN.",
      "23 MAR · NO DIESEL. TRUCK STOPPED. THEY'LL HAVE TO WALK UP.",
    ],
    signed: "Unsigned, in D.P.'s capitals",
    people: ["D.P.", "G.", "M.H."],
    places: ["CS-4"],
  },
  // Mags's collection (docs/narrative/mags.md).
  {
    id: "tagged-door",
    place: "workshop",
    order: 3,
    title: "Assessed",
    seen: "On the workshop's outside door, wired to the handle: a yellow plastic freight tag, new, with marker on it.",
    says: ["CONSIGNMENT · FRESHWAY REGIONAL", "(in marker) AH · ASSESSED · OLD WOMAN · RE-PACKS"],
    signed: "Unsigned",
    people: ["AH", "an old woman"],
    places: [],
  },
  {
    id: "mags-dropboard",
    place: "workshop",
    order: 4,
    title: "Repairs left here",
    seen: "Inside the office door, beside the forwarding tin: a corkboard of pencil notes on cardboard, the padlocked payment tin under it, and a green soup tin with a bowl upside down on top.",
    says: [
      "U-131 genny brushes done, under bench. Eggs in tin, ta. M.H. 9 APR",
      "Chalk kid: soup in the green tin. Bring the bowl back.",
      "FERRIS PLACE: whoever's in there now. Your stack's due a re-pack before winter. Bring the top cartridge. First one's free. M.H.",
    ],
    signed: "M.H.",
    people: ["M.H.", "the chalk kid"],
    places: [],
  },
  {
    id: "ferris-docket",
    place: "workshop",
    order: 5,
    title: "Fitted",
    seen: "On a spike by the bench, a stack of carbon fitting dockets, the newest on top. One names the Unit you live in.",
    says: [
      "FERRIS · RC-40 STACK FITTED 2 JUN Y3",
      "SN 118-0447 · EX U-112",
      "PAID: QUINCE PASTE ×2. M.H.",
    ],
    signed: "M.H.",
    people: ["M.H.", "the Ferrises"],
    places: [],
  },
  // Not on any trip: it's on your own purifier, found by inspecting it at home.
  // It says where the stack came from, not whether anyone agreed to it.
  {
    id: "unit-plate",
    place: "home",
    title: "Serial plate",
    seen: "Behind the purifier's side panel, riveted to the sorbent stack: a stamped steel serial plate, and beside it two small aluminium tags wired on, letters punched in with a nail set.",
    says: ["RC-40 SORBENT STACK · SN 118-0447", "(tag) SVC M.H. · EX U-112", "(tag) FITTED M.H. · 2 JUN Y3"],
    signed: "M.H., punched",
    people: ["M.H."],
    places: [],
  },
  {
    id: "mags-jobbook",
    place: "workshop",
    lead: "under-the-bench",
    title: "Jobs",
    seen: "Under the bench, in a lidded ice-cream tub with a rubber band round it: a school exercise book, its cover soft with oil, each page ruled into Unit, name, job and payment. The last pages are in a shakier hand.",
    says: [
      "U-104 FENWICK · seal kit · eggs ×6",
      "U-112 COOPER · new baby · hatch seal perishing · ORDER KIT (council says 6 wks!!)",
      "U-118 PATEL · air filter FAIL insp 2 MAR · part on order",
      "9 MAR. Keys: Patel 118. 118 stack OUT → 112 COOPER. Baby. Seal won't hold.",
      "DAY 9. Pump stn bore motor. Rewound. Pump Boy owes me.",
      "WINTER Y2. Men in grey took the tools. Moving. Board stays.",
    ],
    signed: "Unsigned; the same hand as M.H.",
    people: ["the Patels", "the Coopers", "Pump Boy", "the Fenwicks"],
    places: ["the pump station"],
  },
  {
    id: "mags-bore-tag",
    place: "reservoir",
    lead: "bore-motor",
    title: "Rewound",
    seen: "In the bore house, an aluminium tag wired to the pump motor's housing, letters punched in with a nail set. Fresh copper on the windings shows through a cut in the cover.",
    says: ["REWOUND M.H. DAY 9", "¼ LOAD TILL RUN IN", "TELL PUMP BOY IT'S NOT A TOY"],
    signed: "M.H., punched",
    people: ["M.H.", "Pump Boy"],
    places: [],
  },
  {
    id: "patels-keys",
    place: "workshop",
    lead: "key-board",
    title: "Keep it ticking over",
    seen: "By the roller door, a key board: rows of nails, most of them empty. On one, a ring of house keys on a cardboard tag marked 118 PATEL, and a sheet of lined paper folded and pushed onto the same nail.",
    says: [
      "(in pen) Mrs Halloran. We walked back. The stack is gone from 118. You had our keys to keep it ticking over. Where is it? We are at Northfield showground, block C. Anjali Patel.",
      "(underneath, in pencil) Empty is empty. The Cooper baby needed it. Your filter failed and the part never came; you'd not have sealed it. Come and shout at me if you like. Keys are here. M.H.",
    ],
    signed: "Anjali Patel; the reply: M.H.",
    people: ["Anjali Patel", "M.H.", "the Coopers"],
    places: ["Northfield Reception Centre"],
  },
  // Dev's collection (docs/narrative/dev.md).
  {
    id: "dev-loop-roster",
    place: "nest",
    lead: "depot-office",
    title: "Ride-along",
    seen: "Behind cracked perspex in the depot's dispatch window, a steel-framed hatch at the underpass mouth: a laminated weekly roster, sun-faded on one side, held on with cable ties.",
    says: [
      "LOOP CART ROUTES · TERM 1",
      "CART 4 · THURS · EAST LOOP · D. PILLAI",
      "SCHOOL RIDE-ALONG · CART 4 · THURS · D. PILLAI + 1 (WREN, 5W) · VEST ISSUED: LOOP CREW ADULT S (all we had)",
      "(in marker, under Cart 4) Chime runs half a beat late. DON'T fix it. The kid likes it. D.",
    ],
    signed: "D. Pillai; the marker note D.",
    people: ["D. Pillai", "Wren, 5W", "Gerald"],
    places: ["the Loop depot"],
  },
  {
    id: "dev-repack-card",
    place: "workshop",
    lead: "repack-bench",
    title: "Re-pack card",
    seen: "Nailed above the cartridge bench at the back: a sheet of thin aluminium cut from a sign, the steps scratched in with a scriber and filled with marker. Newer pencil ticks beside each line.",
    says: [
      "RC-40 RE-PACK · AS AT KELL BRIDGE WEIR PLANT",
      "1. GLOVES. ALL OF IT. EVERY TIME.",
      "2. SPENT SORBENT TO THE PIT. NEVER THE RIVER. NEVER THE GARDEN.",
      "3. NEW SORBENT DRY. IF IT CLUMPS IT'S NOT DRY.",
      "4. PACK TO THE LINE. TAP 3 TIMES. PACK TO THE LINE.",
      "5. SEAL, THEN CHECK THE SEAL, THEN GET SOMEONE ELSE TO CHECK THE SEAL.",
      "6. HOUSING: ¼ TURN. NEVER MORE.",
      "For Mags, who knows all this. It's for whoever comes after you. D.P.",
    ],
    signed: "D.P., scratched",
    people: ["D.P.", "Mags"],
    places: ["Kell Bridge weir plant"],
  },
  // Helen's collection (docs/narrative/helen.md).
  {
    id: "siren-talk",
    place: "reservoir",
    lead: "school-display",
    title: "Everyone is on a list",
    seen: "At the end of the education room's school display, laminated like the worksheets around it: a council handout with a clip-art siren. On the back, children's questions in felt pen, with replies in a neat adult hand.",
    says: [
      "CALDER COUNCIL · WHEN THE SIREN SOUNDS",
      "1. Go inside. 2. Shut doors and windows. 3. Turn on the radio. 4. Go where your list says: your Unit, or your Shelter Point.",
      "Everyone is on a list. Ms H. Lane, Council Emergency Liaison",
      "(on the back, a child's writing) what if your not on a list",
      "(an adult hand) Everyone is on a list. H.L.",
      "(the child's writing) what if the list is wrong",
    ],
    signed: "Ms H. Lane; the answer H.L.",
    people: ["H. Lane"],
    places: [],
  },
  {
    id: "council-bulletin",
    place: "reservoir",
    lead: "liaison-bulletins",
    title: "Read by H. Lane",
    seen: "Above the radio set, a corkboard of council bulletins the station relayed, each stamped in capitals with the time it came in. Two pins with nothing on them, and a torn corner under one.",
    says: [
      "CALDER COUNCIL BULLETIN 2 · 08:00 · Tap water remains safe to drink. Units seal at the siren. Shelter Points open at the siren. Buses to Northfield: 09:00 and 13:00 from FreshWay. READ: H. LANE (stamped RCVD 07:58 DP)",
      "CALDER COUNCIL BULLETIN 3 · 13:45 · SIREN. Shelter now. Units seal. Shelter Points close at 15:00. Bus service suspended. Sit tight two weeks. READ: COUNCIL DUTY OFFICER (stamped RCVD 13:44 DP)",
      "(pencil, under the empty pins) 12:40?? DP",
    ],
    signed: "Council bulletins; the stamps and the pencil DP",
    people: ["H. Lane", "DP"],
    places: ["Northfield"],
  },
  // Helen's last two records lie where no trip goes yet (NOT_YET_REACHABLE).
  {
    id: "convoy-manifest",
    place: "ridge-road",
    title: "Authorised H. Lane",
    seen: "In a steel tin in the burnt-out lead truck's glovebox: a convoy manifest. Behind the sun visor, a child's drawing.",
    says: [
      "NORTHFIELD → KELL BRIDGE RELIEF · 3 vehicles · 40 cartridges · 900 kg flour · insulin (cold box)",
      "Route: Ridge Road (avoid checkpoint) · Fuel: town reserve, 3 × 200 L, released under liaison authority",
      "Drivers: RAKE · OKORO · FENN",
      "Authorised H. Lane",
      "(the drawing) DAD'S TRUCK.",
    ],
    signed: "H. Lane",
    people: ["H. Lane", "Bluey Rake", "M. Okoro", "J. Fenn"],
    places: ["Northfield", "Kell Bridge", "the Ridge Road"],
  },
  {
    id: "helen-letter",
    place: "weighbridge",
    title: "Unopened",
    seen: "In the loot store, a trader's pack spilled open: a trade book, a joke-a-day calendar stopped on a winter date, and an envelope, soft with handling, still sealed.",
    says: ["Ruth Lane, Kell Bridge exchange", "(on the back flap) By hand: N. Ashby. H."],
    signed: "H.",
    people: ["Ruth Lane", "N. Ashby", "H."],
    places: ["Kell Bridge"],
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
  {
    id: "old-works-gallery",
    place: "reservoir",
    label: "The old works gallery",
    fragment: "dev-toolbag",
    from: {
      "day-140": "The exercise book says the old works main runs north from here. Its gallery is under the dam.",
      "chime-camp": "A map at the camp marks the old works gallery, under the dam: “DON'T”.",
    },
  },
  {
    id: "the-basement",
    place: "supermarket",
    label: "The basement",
    fragment: "cs4-board",
    from: {
      "store-instruction": "The fax sends eleven pallets down to the cold store for CS-4. CS-4 was the basement car park.",
      "day-140": "The exercise book starts with 140 people in CS-4, under the supermarket.",
    },
  },
  {
    id: "the-valve",
    place: "reservoir",
    label: "The valve",
    fragment: "chained-valve",
    from: { "dev-toolbag": "The log stops at the intake screens. The outflow valve is further along the gallery." },
  },
  {
    id: "leave-word",
    place: "workshop",
    label: "Leave word for T",
    fragment: "left-word",
    from: { "exchange-chit": "The chit puts R.L. at Kell Bridge this autumn. The letter in the forwarding tin is waiting on an answer. You could leave word in the tin." },
  },
  {
    id: "tin-answer",
    place: "workshop",
    label: "Check the forwarding tin",
    fragment: "toby-answer",
    from: { "left-word": "You left word in the forwarding tin. Someone may have answered." },
  },
  {
    id: "kell-walkers",
    place: "workshop",
    label: "Send word north",
    fragment: "word-north",
    from: { "toby-answer": "T says Kell Bridge walkers pay into the payment tin, then go back north." },
  },
  {
    id: "kell-reply",
    place: "workshop",
    label: "Check the payment tin",
    fragment: "ruth-parcel",
    from: { "word-north": "Your note went north with the Kell walkers. Something may come back the same way." },
  },
  {
    id: "bus-shelter-chalk",
    place: "supermarket",
    label: "The bus shelter wall",
    fragment: "toby-thanks",
    from: { "ruth-parcel": "T chalks in the bus shelter. If the parcel reached him, he may say so there." },
  },
  {
    id: "bore-house",
    place: "reservoir",
    label: "The bore house",
    fragment: "pump-log",
    from: {
      "radio-log": "The radio log runs a bore “on trust”. The bore house is the brick hut behind the pumping station.",
      "day-140": "The exercise book says Dev had bore water. The bore house is the brick hut behind the pumping station.",
      "mags-jobbook": "The job book says the pump station's bore motor was rewound on Day 9.",
    },
  },
  {
    id: "bore-motor",
    place: "reservoir",
    label: "The bore motor",
    fragment: "mags-bore-tag",
    from: {
      "pump-log": "The run sheet says M.H. rewound the motor on 17 March. There's a tag on its housing.",
      "mags-jobbook": "The job book says the bore motor was rewound on Day 9. The bore house is behind the pumping station.",
    },
  },
  {
    id: "under-the-bench",
    place: "workshop",
    label: "Under the bench",
    fragment: "mags-jobbook",
    from: {
      "mags-dropboard": "The board says the genny brushes are under the bench.",
      "bus-2": "The list says the Patels' keys went to Mags. The workshop was hers.",
    },
  },
  {
    id: "key-board",
    place: "workshop",
    label: "The key board",
    fragment: "patels-keys",
    from: {
      "mags-jobbook": "The job book holds keys for 118. There's a key board by the roller door.",
      "ferris-docket": "The docket's stack came from 118. The workshop keeps keys by the roller door.",
      "unit-plate": "Your stack's serial starts 118. The workshop keeps keys by the roller door.",
    },
  },
  {
    id: "depot-office",
    place: "nest",
    label: "The depot office",
    fragment: "dev-loop-roster",
    from: {
      "our-loop": "The worksheet says the carts went to the depot. Its dispatch window is at the underpass mouth.",
      "chime-camp": "Gerald's at the Nest. Before the den, the depot's dispatch window still has its roster up.",
    },
  },
  {
    id: "repack-bench",
    place: "workshop",
    label: "The re-pack bench",
    fragment: "dev-repack-card",
    from: {
      "day-140": "The book says Kell can re-pack cartridges. Someone in Calder still does: the workshop has a bench for it.",
      "dev-toolbag": "D.P. cleared the intake every autumn. The workshop's back bench has his capitals on it.",
    },
  },
  {
    id: "liaison-bulletins",
    place: "reservoir",
    label: "The bulletin board",
    fragment: "council-bulletin",
    from: {
      "radio-log": "The radio log names Liaison H. Lane. Above the set there's a corkboard of council bulletins you haven't read.",
      "bus-2": "“H. says” Bus 3 at 13:00. The pumping station relayed the council's bulletins; they're pinned above the radio.",
    },
  },
  {
    id: "school-display",
    place: "reservoir",
    label: "The end of the display",
    fragment: "siren-talk",
    // not from the worksheet, so a first visit still finds the radio log second
    from: {
      "council-bulletin": "Both bulletins mention the siren. The education room's school display runs on past the worksheets, to the council's handout about it.",
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
  { a: "cart-dogs", b: "chime-camp", text: "The drawing names Bigsy, Lady and Chips. Bowls at the Nest carry the same three names." },
  { a: "our-loop", b: "chime-camp", text: "The worksheet calls a cart Gerald. GERALD is painted on the cart at the Nest." },
  { a: "bus-2", b: "chime-camp", text: "Tobias Wren, 11, is on the Bus 2 list to Northfield. The card at the Nest names Tobias Wren, Year 8, Northfield showground school." },
  { a: "radio-log", b: "dev-toolbag", text: "Both are signed D.P." },
  { a: "day-140", b: "dev-toolbag", text: "The exercise book has Dev talking about the old works main. The toolbag in its gallery is stencilled D.P." },
  { a: "dev-toolbag", b: "chained-valve", text: "The log stops at the intake. The chalk at the valve says Dev Pillai was killed here." },
  { a: "chained-valve", b: "chalk-warning", text: "Both are chalked in capitals, signed T or T.W." },
  { a: "cart-dogs", b: "chalk-warning", text: "Both have a small dog drawn beside the writing." },
  { a: "locker-6", b: "toby-letter", text: "Locker 6 belongs to K. Wren. The letter in the forwarding tin is addressed to Kerry Wren, from Toby." },
  { a: "chained-valve", b: "toby-letter", text: "The chalk at the valve says Dev Pillai was killed there. The letter says Dev died, and its writer got out through the pipe." },
  { a: "chime-camp", b: "toby-letter", text: "Bowls at the Nest carry Bigsy's name. The letter says the dogs are still there: not Bigsy, maybe his kids." },
  { a: "chalk-warning", b: "toby-letter", text: "The bus-shelter warning is signed T. The note on the letter is signed T too." },
  { a: "store-instruction", b: "cs4-board", text: "The fax sends 11 pallets down for CS-4's 140. The board in CS-4 counts 140 in, and is signed R.L." },
  { a: "day-140", b: "cs4-board", text: "The board says no trading rations and asks “except Sundays?”. The exercise book says Gary's kids get mine on Sundays." },
  { a: "bus-2", b: "cs4-board", text: "The list says Dev was bringing water up from the pump station. The board has Dev's water truck on Tuesdays and Fridays." },
  { a: "day-140", b: "exchange-chit", text: "The exercise book says the nineteen were going to Kell Bridge. The chit is from a Kell Bridge exchange, stamped R.L." },
  { a: "ration-sign", b: "exchange-chit", text: "The limits sign is signed R. Lane. The chit is stamped R.L., and dated this autumn." },
  { a: "toby-letter", b: "exchange-chit", text: "The chit is in the payment tin beside the forwarding tin that holds Toby's letter." },
  { a: "exchange-chit", b: "left-word", text: "Your note passes on what the chit shows: R.L., Kell Bridge, this autumn." },
  { a: "toby-letter", b: "toby-answer", text: "The answer is in the same pressed pencil capitals as the note on the letter, signed T." },
  { a: "chalk-warning", b: "toby-answer", text: "Both are signed T, and the answer has chalk dust in its folds." },
  { a: "toby-letter", b: "ruth-parcel", text: "Toby's letter asks his mum to write back. The envelopes are addressed to Toby Wren from K. Wren, Northfield, sent to Kell Bridge." },
  { a: "locker-6", b: "ruth-parcel", text: "Locker 6 belonged to K. Wren. The envelopes come from K. Wren, Showground Kitchens." },
  { a: "exchange-chit", b: "ruth-parcel", text: "Both chits are stamped R.L. at the Kell Bridge exchange." },
  { a: "chalk-warning", b: "toby-thanks", text: "New chalk beside the old warning, in the same hand, signed T." },
  { a: "radio-log", b: "pump-log", text: "The radio log reads the bore under the line and the reservoir above it. The run sheet sends the bore to CS-4 and leaves the east side on the reservoir main." },
  { a: "bus-2", b: "pump-log", text: "Bus 2's list says Dev's bringing water up from the pump station. The run sheet trucks it to CS-4 twice a day." },
  { a: "day-140", b: "pump-log", text: "The run sheet's truck stops on 23 March. On Day 15, 23 people walk up to the pump station." },
  { a: "store-instruction", b: "pump-log", text: "Both split one supply in two, and both write the reason in the margin." },
  { a: "pump-log", b: "mags-bore-tag", text: "The run sheet says M.H. rewound the motor on 17 March. The tag on it says REWOUND M.H. DAY 9." },
  { a: "bus-2", b: "mags-jobbook", text: "The list says the Patels' keys went to Mags. The job book has “Keys: Patel 118” on 9 March." },
  { a: "mags-jobbook", b: "patels-keys", text: "The job book moves the 118 stack to the Coopers. The Patels' note says the stack is gone from 118." },
  { a: "mags-jobbook", b: "ferris-docket", text: "The job book moves a stack out of 118. The Ferris docket fits SN 118-0447, ex U-112." },
  { a: "patels-keys", b: "ferris-docket", text: "The Patels ask where 118's stack went. The docket fits a stack with 118 in its serial, in the Ferris place, signed M.H." },
  { a: "mags-jobbook", b: "mags-bore-tag", text: "The job book says “Day 9. Pump stn bore motor. Rewound.” The tag on the motor says the same." },
  { a: "mags-bore-tag", b: "chained-valve", text: "“¼ LOAD” on the bore tag; “¼ TURN ONLY. DP” painted at the valve." },
  { a: "bus-2", b: "patels-keys", text: "The list says Halloran, Margit, declined her seat, and the Patels' keys went to Mags. The note is addressed to Mrs Halloran." },
  { a: "mags-dropboard", b: "chalk-warning", text: "The board leaves soup for a “chalk kid”. The bus-shelter warning is in chalk." },
  { a: "mags-dropboard", b: "toby-letter", text: "The drop-off board and the forwarding tin hang inside the same office door." },
  { a: "mags-dropboard", b: "ferris-docket", text: "The board has a note for the Ferris place. The docket fitted its stack." },
  { a: "unit-plate", b: "ferris-docket", text: "Your purifier's plate and the docket carry the same serial, SN 118-0447, ex U-112, fitted 2 June Y3 by M.H." },
  { a: "unit-plate", b: "mags-jobbook", text: "The job book moves the 118 stack to 112, the Coopers'. Your stack's serial starts 118, and its tag says ex U-112." },
  { a: "unit-plate", b: "patels-keys", text: "The Patels ask where 118's stack went. The one in your purifier has 118 in its serial." },
  { a: "unit-plate", b: "mags-bore-tag", text: "Both are aluminium tags with letters punched in, signed M.H." },
  { a: "tagged-door", b: "chained-valve", text: "Both carry a yellow plastic freight tag." },
  { a: "tagged-door", b: "chalk-warning", text: "The tag is marked AH. The bus-shelter chalk warns of AH." },
  { a: "tagged-door", b: "mags-dropboard", text: "The tag says the old woman re-packs. The board is signed M.H. and offers a re-pack." },
  { a: "dev-loop-roster", b: "locker-6", text: "The roster issued an adult LOOP CREW vest to a Year 5 student. The photo in Locker 6 shows a boy in one down to his knees." },
  { a: "dev-loop-roster", b: "our-loop", text: "The worksheet says Gerald plays the song wrong. The roster says Cart 4's chime runs late, and not to fix it." },
  { a: "dev-loop-roster", b: "chime-camp", text: "The roster puts D. Pillai on Cart 4. GERALD is painted on the cart at the Nest." },
  { a: "dev-loop-roster", b: "radio-log", text: "D. Pillai on the roster; D.P. on the radio log, in the same capitals." },
  { a: "dev-repack-card", b: "chained-valve", text: "The card and the painted note by the valve both say a quarter turn, never more, signed D.P." },
  { a: "dev-repack-card", b: "day-140", text: "Day 140 says Kell can re-pack cartridges. The card is how Kell Bridge re-packs them." },
  { a: "dev-repack-card", b: "dev-toolbag", text: "Both are in D.P.'s capitals." },
  { a: "dev-repack-card", b: "mags-dropboard", text: "The drop-off board is signed M.H. The card is left for Mags." },
  { a: "council-bulletin", b: "bus-2", text: "The Bus 2 list says no bus by 2, everyone down to CS-4. The siren bulletin on the board came in at 13:44." },
  { a: "council-bulletin", b: "radio-log", text: "Both are from the radio room; both name Liaison H. Lane." },
  { a: "council-bulletin", b: "day-140", text: "The 13:45 bulletin says to sit tight two weeks. Day 1 of the exercise book says the radio said the same." },
  { a: "siren-talk", b: "our-loop", text: "Both were on the education room's school display." },
  { a: "siren-talk", b: "bus-2", text: "The handout says everyone is on a list. The Bus 2 list gives seats by priority." },
  { a: "siren-talk", b: "council-bulletin", text: "Both are signed H. Lane." },
  { a: "convoy-manifest", b: "radio-log", text: "H. Lane spoke from Northfield. The manifest is authorised by H. Lane, from Northfield." },
  { a: "convoy-manifest", b: "day-140", text: "The exercise book's nineteen went north to Kell Bridge. The convoy was bound for Kell Bridge." },
  { a: "helen-letter", b: "day-140", text: "The exercise book was left for Helen. The envelope is addressed to Ruth Lane and signed H." },
  { a: "helen-letter", b: "exchange-chit", text: "The envelope is addressed to the Kell Bridge exchange. The chit is stamped by it." },
];

export const QUESTIONS: readonly Question[] = [
  { id: "dogs", text: "What happened to Bigsy, Lady and Chips?", openedBy: ["cart-dogs", "chime-camp"], about: ["cart-dogs", "our-loop", "bus-2", "chime-camp"] },
  { id: "gerald", text: "Who is Gerald?", openedBy: ["cart-dogs", "our-loop"], about: ["cart-dogs", "our-loop"] },
  { id: "hub-lorry", text: "Who did the eleven pallets kept back end up feeding?", openedBy: ["store-instruction"], about: ["store-instruction", "radio-log", "day-140", "cs4-board"] },
  { id: "wrens", text: "Did the Wrens reach Northfield?", openedBy: ["bus-2"], about: ["bus-2", "radio-log", "chime-camp"] },
  { id: "kell-bridge", text: "Who got off at Kell Bridge?", openedBy: ["radio-log"], about: ["radio-log", "bus-2"] },
  { id: "who-is-h", text: "Who is H.?", openedBy: ["bus-2", "day-140"], about: ["bus-2", "radio-log", "day-140", "siren-talk", "council-bulletin", "convoy-manifest", "helen-letter"] },
  { id: "four", text: "What happened to the four people the book stops counting?", openedBy: ["day-140"], about: ["day-140"] },
  { id: "nineteen", text: "Did the nineteen reach Kell Bridge?", openedBy: ["day-140"], about: ["day-140", "radio-log", "exchange-chit"] },
  { id: "camp", text: "Who lives at the camp by the Nest?", openedBy: ["chime-camp"], about: ["chime-camp", "chalk-warning", "chained-valve"] },
  { id: "mercer", text: "Who is Mercer, and who are AH?", openedBy: ["chained-valve", "chalk-warning"], about: ["chained-valve", "chalk-warning"] },
  { id: "intake", text: "What happened at the intake?", openedBy: ["dev-toolbag"], about: ["dev-toolbag", "chained-valve", "toby-letter"] },
  { id: "answer", text: "Will Kerry answer?", openedBy: ["toby-letter"], about: ["toby-letter", "locker-6", "ruth-parcel"] },
  { id: "tell-ruth", text: "Does Ruth know Toby is back in Calder?", openedBy: ["exchange-chit"], about: ["exchange-chit", "toby-letter", "day-140", "word-north", "ruth-parcel"] },
  { id: "toby-north", text: "Will Toby go north to Ruth?", openedBy: ["toby-thanks"], about: ["toby-thanks", "ruth-parcel", "toby-letter"] },
  { id: "who-is-mh", text: "Who is M.H.?", openedBy: ["mags-dropboard", "ferris-docket", "mags-bore-tag", "unit-plate"], about: ["mags-dropboard", "ferris-docket", "mags-bore-tag", "unit-plate", "mags-jobbook", "bus-2"] },
  { id: "patels", text: "Did the Patels ever see the reply?", openedBy: ["patels-keys"], about: ["patels-keys", "mags-jobbook", "unit-plate"] },
  { id: "east-side", text: "Who was left on the main?", openedBy: ["pump-log"], about: ["pump-log", "radio-log"] },
  { id: "twelve-forty", text: "What happened at twelve forty?", openedBy: ["council-bulletin"], about: ["council-bulletin", "bus-2", "helen-letter"] },
  { id: "assessed", text: "What does “assessed” mean?", openedBy: ["tagged-door"], about: ["tagged-door", "chained-valve", "chalk-warning"] },
];

export const fragment = (id: string): Fragment | undefined => FRAGMENTS.find((f) => f.id === id);
export const lead = (id: string): Lead | undefined => LEADS.find((l) => l.id === id);
export const hasRecords = (place: string): boolean => FRAGMENTS.some((f) => f.place === place);

export const LOOK_AROUND = "look";
// Records found at home rather than on a trip.
export const HOME = "home";
export const PURIFIER_PLATE: FragmentId = "unit-plate";
// Places the story uses that no trip reaches yet: their records exist so a
// card can name them, and turn up once the place is built.
export const NOT_YET_REACHABLE: readonly string[] = ["ridge-road", "weighbridge"];
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
