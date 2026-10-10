# The next collections

Labels are explained in [README.md](README.md#status-labels).

**Ruth's set: [Implemented] (2026-10-10)** as designed below, and
painted: six card still lifes in `static/img/cards/ruth/`, ten panels in
`static/img/comic/ruth/` (`scripts/generate-ruth-art.ts`), plus the reused
passenger list and two of Toby's panels (her panels 3 and 9). 20 images
($2.00). **Mags's set: [Implemented] (2026-10-10)** from [mags.md](mags.md),
with `ferris-docket` in place of `unit-plate` and placeholder art. Approved as part of the 2026-10-10 batch; the rest of
this page is **[Proposed]**. Full packages for the others:
[mags.md](mags.md), [dev.md](dev.md), [helen.md](helen.md).

Originally design only. Toby's set ([toby-collection.md](toby-collection.md)) is the model.
This page compares the other four people, designs one of them in full (Ruth),
and outlines the rest.

## What carries over from Toby's set

- **A card is a thing the player found**: a concrete title, where it was, its
  words as written, a picture of the object. No period labels, no
  interpretation. The comic is where the clues become a life.
- **Cards unlock from the journal's discoveries**, so nothing is stored but
  the one-time reward. Old players are backfilled; order doesn't matter;
  defeat can't take a card.
- **The set has a thematic title until it's complete**, then the person's
  name.
- **Every card's object appears in a comic scene.**
- **The comic tells the writer's truth, but never spoils a reveal** that
  [main-story.md](main-story.md#reveals) holds back for later evidence.

New rules, because the people share records:

1. **One record can fill a card in more than one set.** The Bus 2 list is
   Toby's card and could be Ruth's and Mags's too. Each set's card quotes
   *its* person's line, and the same object keeps the same picture, so the
   card art is reused.
2. **No set can be completed from other sets' records alone.** Each set
   needs at least two records that belong only to it, so every set sends the
   player somewhere new.
3. **A moment two comics share can be drawn once.** The panel is reused and
   lettered from the other person's side. That saves art budget and shows
   the lives crossing.

## Who has enough evidence

Only existing destinations count: the Supermarket, Dry Reservoir, Ruined
Workshop and Creature Nest, plus the player's own shelter if an inspect
action is approved. The Weighbridge and the Ridge Road aren't destinations.

| Person | Records already in the game | New records needed | Blocked by | Overlap with Toby | Verdict |
|---|---|---|---|---|---|
| **Ruth Lane** | `ration-sign`, `store-instruction`, `bus-2`, `radio-log`, `day-140` (5) | 2, at the Supermarket and the Workshop | nothing | two moments (the bus, the exchange) | **Next.** Most evidence exists; her 11-pallet choice is the game's moral centre |
| **Mags Halloran** | `bus-2`, `toby-letter` (her tin) (2) | 4: `unit-plate`, `mags-dropboard`, `tagged-door`, a Patels' note | an inspect action at home, for `unit-plate` | small | **After Ruth.** It's main-story stage A ("a home"); worth building with that chapter |
| **Dev Pillai** | `radio-log`, `day-140`, `bus-2`, `dev-toolbag`, `chained-valve` (5) | 1: his pump log | nothing | heavy: his comic would retell Toby's pages 4–6 | **Later, or not at all.** Cheapest to build, least new |
| **Helen Lane** | `radio-log`, `day-140`, `bus-2` (3, mentions only) | `convoy-manifest`, `helen-letter` | both are at the Ridge Road and the Weighbridge | none | **Wait** until those places are approved. Her death is a held-back reveal |

## Ruth Lane: full design

- **Theme title until complete**: "Same for Everyone" (her rule, and the
  thing she broke).
- **Complete**: "Ruth Lane".
- **Comic**: "Eleven Pallets", 12 panels on 7 pages.
- **Reward**: +50 XP once, as for Toby.

### Cards (7)

| # | Card (the object) | Record | Where | Words on it | In the comic |
|---|---|---|---|---|---|
| 1 | **Cardboard limits sign** | `ration-sign` | Supermarket, taped inside the perspex at till 1 | "2 tins + 1 dry per CUSTOMER… R. Lane, Manager" | Panel 1 |
| 2 | **Fax with biro notes** | `store-instruction` | Supermarket, manager's office file | "22 pallets. 11 on the truck. 11 down to the cold store for CS-4. R.L." | Panel 2 |
| 3 | **Bus 2 passenger list** (Toby's card art reused) | `bus-2` | Supermarket cash office | "47. LANE, Ruth: seat to the Patterson boy ✓" | Panel 3 |
| 4 | **Headcount board** | `cs4-board` **(new)** | Supermarket, the basement car park that was CS-4 | "DAY 12 · 140 IN · SAME FOR EVERYONE · 1 tin + 2 L each · R.L." and below, another hand: "except Sundays? G." | Panel 5 |
| 5 | **Radio log** | `radio-log` | Dry Reservoir radio room | "LIAISON H. LANE ASKS IS RUTH LANE IN CS-4. TOLD HER YES, RUTH'S RUNNING IT." | Panel 6 |
| 6 | **Exercise book in a biscuit tin** | `day-140` | Dry Reservoir station office | "Helen, we went NORTH. Follow the pipe." | Panel 7 |
| 7 | **Exchange chit** | `exchange-chit` **(new)** | Ruined Workshop, the payment tin by the drop-off | "KELL BRIDGE EXCHANGE · 1 CARTRIDGE RE-PACK · R.L." | Panel 12 |

Unique to Ruth: cards 1, 2, 4 and 7. Cards 3, 5 and 6 share records with
other sets.

### The two new records

**`cs4-board`: Same for everyone**
- **Where**: Supermarket, the basement car park (CS-4), on a pillar. Reached
  by a new lead, **"the basement"**, opened by `store-instruction` ("down to
  the cold store for CS-4") or `day-140` ("140 in CS-4").
- **Kind**: historical (Y0, the first weeks).
- **What you see**: a whiteboard screwed to a concrete pillar, ruled into
  days; a tally of 140 crossed through day by day; marker gone brown.
- **What it says**: "DAY 12 · 140 IN · SAME FOR EVERYONE · 1 tin + 2 L each ·
  water truck from Dev Tue/Fri · NO trading rations. R.L." Squeezed under it
  in another hand: "except Sundays? G."
- **Why legible**: whiteboard marker underground, out of light and rain.
- **Observed**: the rule and the ration, and someone's objection.
- **Claimed**: equal shares for 140.
- **Possible reading**: read with `day-140` ("Gary's kids get mine on
  Sundays"), the exception was Ruth's own share, given away.
- **People**: Ruth, Gary (G.), Dev.
- **Connections**: `store-instruction` (CS-4, the 11 pallets); `day-140`
  (Gary, Sundays); `bus-2` (Dev's water).
- **Answers**: what was CS-4 like? **Creates**: nothing new.

**`exchange-chit`: Kell Bridge exchange**
- **Where**: Ruined Workshop, in the padlocked payment tin by Mags's
  drop-off, visible through a split in the lid. Look around, 2nd (after
  `toby-letter`).
- **Kind**: recent. Writer's cause: walkers from Kell Bridge pay for Mags's
  repairs with exchange chits, which Kell Bridge honours.
- **What you see**: a stamped tin token on a loop of wire, punched twice.
- **What it says**: "KELL BRIDGE EXCHANGE · 1 CARTRIDGE RE-PACK · R.L." and a
  season scratched on the back: "AUT Y5".
- **Why legible**: stamped metal, new.
- **Observed**: a token from an exchange at Kell Bridge, signed R.L., from
  this autumn.
- **Possible reading**: R.L. is alive and running an exchange 38 km north.
  It only shows someone stamps "R.L.".
- **People**: Ruth; Mags (unnamed).
- **Connections**: `day-140` (north to Kell Bridge); `ration-sign`
  (R. Lane); `toby-letter` (the same tin).
- **Answers**: did Ruth make it? (Probably.) **Creates**: "Does Ruth know
  Toby is in Calder?"

Neither needs a new destination, a new mechanic or new gameplay. The
Supermarket would have 7 records, the Workshop 2.

### Comic: "Eleven Pallets"

As built, the lines are in `src/game/collections.ts`; small wording
changes from the table below are in the code (panel 12 adds that Kell
Bridge still rations its water).

Twelve panels, ten new and two reused from Toby's comic (marked ↺). Each card's
object is marked **Object**.

| Page | Panel | Scene | Words |
|---|---|---|---|
| 1 · pair | 1 | FreshWay at night, weeks before the war. Ruth (61) on the door; Gary arguing at the perspex; Kerry at till 2. **Object**: the limits sign. | N: Calder, the last weeks before. Ruth Lane had run FreshWay's nights for twenty years. · S Gary: It's one more tin, Ruth. · S Ruth: It's one more tin for everyone, Gary. |
| | 2 | The manager's office, the Ninth, morning. Ruth at the desk writing in biro on a curling fax; through the window a truck backing in. **Object**: the fax. | N: 07:12. A state direction: send all of it to Northfield. · S Ruth: Twenty-two pallets. Eleven on the truck. · N: The other eleven went down to the cold store. She wrote it down anyway. |
| 2 · pair | 3 ↺ | Toby's panel 4: the bus queue, Ruth with the clipboard. **Object**: the list. | S Ruth: One bag each. · N: She let a boy keep his dog food. Then she gave her own seat away. |
| | 4 | The bus pulling out, the Patterson boy at a window; Ruth on the tarmac with the clipboard, not on it. | S Ruth: Forty-seven's yours. Sit down and don't argue. · N: 13:45, the siren. She was already counting them down into CS-4. (Hints she was warned early, without showing the call.) |
| 3 · tall | 5 | CS-4 by lamplight: the basement car park, 140 people on cardboard and camp beds, Ruth writing on the headcount board on a pillar; Gary watching, his kids asleep behind him. **Object**: the board. | N: Same for everyone. That was the rule. · W Gary: Except Sundays. · N: On Sundays her share went to Gary's kids. She never put that on the board. |
| 4 · pair | 6 | The pumping station radio room, the day after. Dev at the set, headphones half on. **Object**: the radio log. | N: 10 March. Her daughter asked after her from Northfield. · S Radio (Helen): Is Ruth Lane in CS-4? · S Dev: Yes. Ruth's running it. |
| | 7 | The station office, Day 140. Ruth writing the last entry in an exercise book, a biscuit tin open; through the window, nineteen people with packs. **Object**: the book. | N: Day 140. Nineteen were left. · S Ruth (writing): Helen, we went NORTH. Follow the pipe. |
| 5 · pair | 8 | Walking north along the line of the old main: nineteen figures with packs on a dry road; Dev ahead with a map; Ruth at the back. | N: They followed the pipe 38 kilometres to Kell Bridge. · N: Not everyone was let through cheaply. (The levy stays for `levy-receipt`; this only hints.) |
| | 9 ↺ | Toby's panel 7: the exchange counter, Ruth recognising Toby. | S Ruth: Kerry Wren's boy. · N: At Kell Bridge she ran an exchange, and took in whoever walked up. |
| 6 · pair | 10 | Ruth at the counter with a Northfield walker; she is writing a note and holding it out. | S Ruth: For Helen Lane. Allocation office. · S Walker: Ruth… they're saying she was sick, last winter. · S Ruth: They say a lot of things. Take the note. · N: She sent a note north with every walker. None came back. [Canon, 2026-10-10: Ruth has heard the rumour; no confirmation] |
| | 11 | After Dev. A faceless Ash Hound lays a yellow tag on the counter; Ruth's hand pushes it back. | N: After Dev, they wanted paying for the water. · S Hound: Kell pays, or Kell dries. · S Ruth: Then we'll be thirsty. |
| 7 · tall | 12 | Kell Bridge exchange at dusk. Ruth (66) stamping tin chits by lamplight; one passed into a walker's hand. On the shelf behind her, three envelopes tied with string, addressed in Kerry Wren's hand. **Object**: the chit. | N: Ruth Lane is sixty-six. Kell Bridge still trades, and still rations its water. · S Ruth: Same for everyone. · N: Three letters from Kerry Wren wait on her shelf, for Toby. She doesn't know if he's alive. She keeps them anyway. [Canon, 2026-10-10] |

**What it deliberately leaves out**:
- **Helen's death as fact**: it's a held-back reveal, needing
  `helen-letter`. Panel 10 has only the rumour, which Ruth won't believe
  [Canon, 2026-10-10], and notes going north unanswered.
- **Helen's 12:40 call to her mother**: that's what her letter confesses.
  Panel 4 has the siren and Ruth counting people in, not the call.
- **The levy's details**, Gary being beaten, and the convoy graves: they wait
  for `levy-receipt` and `convoy-graves`.
- **Wade Mercer and the Weighbridge**: the Hound in panel 11 is unnamed and
  faceless.

**Ending**: alive, still working, keeping her own rule, and cut off from
the two people the player knows she'd want news of. She is holding Kerry's
three replies to Toby [Canon, 2026-10-10]. The open question that sends the
player back to the main story, answered by the "Help Toby" task: who tells
Ruth that Toby is in Calder, and gets his mother's letters to him?

### Art and cost

- **Cards**: 6 new still lifes (the list is reused).
- **Comic**: 10 new panels, 2 reused.
- **Visual bible additions**: Gary (a big man in his fifties, a faded
  footy jumper), the Patterson boy (about 9), the Kell Bridge exchange set,
  Ruth at 66 with a stamp and chits. All go in `scripts/visual-bible.ts`
  before drawing.
- **Cost**: Toby's set took about 2.5 tries per final image. 16 images at
  that rate is about 40 images, **about $4 of the $6.30 left**. That would
  leave almost nothing for the rest of the final project. To cut it: 8
  panels instead of 12, or lean on the reused cards.

## Mags Halloran (outline)

- **Theme**: "Empty Is Empty". **Comic**: "Forty Households".
- **Cards (6)**:
  - `bus-2` (her line: "declined (language). Has a Unit, she says.");
  - `unit-plate` (the serial plate on *your* purifier);
  - `mags-dropboard`;
  - `tagged-door`;
  - the Patels' note and her reply (new, not written);
  - `toby-letter`'s tin lid ("WREN ✓ ✓ ✓", her forwarding service).
- **Comic**: the Ninth (declining the bus, taking the Patels' keys); moving
  the U-118 stack to the Coopers' newborn; the Patels walking back to an
  empty Unit; the workshop abandoned for U-112; fitting the stack into the
  Ferrises' Unit (the player's home); soup left for "the chalk kid"; the
  yellow tag on her door. It ends with her alive and assessed.
- **Why after Ruth**: it needs an inspect action at home and four new
  records. It is main-story stage A, so it belongs with that chapter ("The
  Old Works"), where it also gives the player's own home a history. Never a
  judgement on the player.

## Dev Pillai (outline)

- **Theme**: "Quarter Turn". **Comic**: "On Trust".
- **Cards (6)**: `radio-log`, `day-140` ("Dev says the old works main…"),
  `bus-2` ("Dev's bringing water"), a new `pump-log` (the truck to CS-4, the
  east main shut off: "THEY HAVE UNITS"), `dev-toolbag`, `chained-valve`.
- **Problem**: half his life is already pages 4–6 of Toby's comic, and two
  of his six cards are Toby's. Unique records: only `pump-log` and
  `radio-log`, which barely meets rule 2.
- **Recommendation**: don't make a separate set yet. If one is wanted, its
  comic is the pump station years (the bore, the meter "on trust", the water
  choice), and it ends where Toby's comic takes over.

## Helen Lane (outline)

- **Theme**: "Procedure". **Comic**: "Twelve Forty".
- **Cards**: `radio-log`, `day-140`, `bus-2` ("Bus 3: 13:00 (H. says)"),
  `convoy-manifest`, `helen-letter`, plus a council broadcast transcript
  (not written).
- **Blocked**: two of its records are at the Ridge Road and the
  Weighbridge, which aren't destinations, and her death is a held-back
  reveal. Her set is the natural final chapter of the Ash Hounds story.
  Design it then.

## For your review

1. **Ruth next**, then Mags with the "Old Works" chapter, with Dev and Helen
   deferred.
2. **Shared records across sets** (rules 1–3 above), including reusing two
   of Toby's panels in Ruth's comic.
3. **Ruth's two new records**, `cs4-board` (by a new "basement" lead) and
   `exchange-chit` (Workshop, look around 2nd), with their text.
4. **What Ruth's comic leaves out** (Helen's death, the 12:40 call, the
   levy), to protect later reveals.
5. **Budget**: about $4 of the remaining $6.30, against the rest of the
   final project's needs and crit 9 on 2026-10-14.
