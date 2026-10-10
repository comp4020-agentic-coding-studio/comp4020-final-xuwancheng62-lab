# Records

Labels are explained in [README.md](README.md#status-labels). A record is one
piece of evidence a player can find; the code calls it a fragment.

## Implemented records

**[Implemented]** Twelve records: the first eight (2026-10-09) and four for Toby's collection (2026-10-10, see [toby-collection.md](toby-collection.md)). The runtime text (title, what you see, what it says, who
signed it, people and places named), the leads, the journal connections and
the open questions all live in
[`src/game/stories.ts`](../../src/game/stories.ts). Edit them there, not here.
Finding rules: PLAN.md, "Records in the wasteland" → "Records, leads and the
journal".

| ID | Title | Place | How it's found | Opens lead | Made | Why it's legible | Kind |
|---|---|---|---|---|---|---|---|
| `ration-sign` | Limits until further notice | Supermarket, inside the perspex screen at till 1 | Look around, 1st | `kerrys-locker` | weeks before the Ninth | marker on cardboard, indoors behind perspex | historical |
| `store-instruction` | Supply Direction 31 | Supermarket, lever-arch file in the manager's office | Look around, 2nd | — | the Ninth, 07:12 onward | fax in a closed file, interior room | historical |
| `cart-dogs` | The cart dogs | Supermarket staff room, inside a cupboard door | Look around, 3rd | — | months before the war | crayon, out of the light | historical |
| `locker-6` | Locker 6 | Supermarket staff room, steel locker | lead `kerrys-locker` | `passenger-lists` | before the war (photo, note); the Ninth (notice) | steel locker | historical |
| `bus-2` | Bus 2 | Supermarket cash office, carbon-copy binder | lead `passenger-lists` | `station-office` | the Ninth | binder; office broken into for the safe, paper ignored | historical |
| `our-loop` | Our Loop | Dry Reservoir, the pumping station's windowless education room | Look around, 1st | — | the term before the war | laminated | historical |
| `radio-log` | The radio log | Dry Reservoir radio room, desk drawer | Look around, 2nd | `passenger-lists`, `station-office` | 10 March, Y0 | hardback notebook, closed drawer | historical |
| `day-140` | Day 140 | Dry Reservoir station office, up the stairs on the dam side | lead `station-office` | `old-works-gallery` | Day 1 to Day 140, Y0 | exercise book in a biscuit tin, lid taped | historical |
| `chalk-warning` | Don't go single | Supermarket, inside wall of the bus shelter | Look around, 4th | — | this season | chalk under a roof, renewed | recent (Toby) |
| `chime-camp` | Somebody feeds them | Creature Nest, the underpass mouth, before the den | Look around, 1st | `old-works-gallery` | this year; the card from Y+1 to Y+3 | steel, laminate, sheltered mouth | recent (Toby) |
| `dev-toolbag` | Intake log | Dry Reservoir, the old works gallery | lead `old-works-gallery` | `the-valve` | May, Y+4 | sealed tin, dry gallery | historical |
| `chained-valve` | Flow by arrangement | Dry Reservoir, the valve along the gallery | lead `the-valve` | — | chain and tag 18 May, Y+4; chalk renewed | metal, plastic, chalk in a dry gallery | recent |

Characters each one touches:

| ID | People |
|---|---|
| `ration-sign` | Ruth (signed R. Lane), Kerry |
| `store-instruction` | Ruth (R.L.) |
| `cart-dogs` | Toby (Toby W.), Gerald, Bigsy, Lady, Chips |
| `locker-6` | Kerry (K. Wren), Toby (T.), Ruth (R.) |
| `bus-2` | Ruth, Kerry, Toby, the Patels, Mags, the Patterson boy, H., Dev |
| `our-loop` | Toby, Gerald |
| `radio-log` | Dev (D.P.), Helen (H. Lane), Ruth |
| `day-140` | Ruth (unsigned), Gary, Dev, Helen |
| `chalk-warning` | Toby (signed T), the Ash Hounds (AH) |
| `chime-camp` | Toby (the school card), the dogs, Gerald |
| `dev-toolbag` | Dev (D.P.), Toby (T) |
| `chained-valve` | Dev, Toby (T.W.), Wade (Mercer) |

The journal's connections and open questions are in the same source file. As of commit `a8dd711` they were checked against the
nuclear-war text: each connection states only facts both records show, and
one question was reworded because its record now answers it (PLAN.md
revision log, 2026-10-09).

## Proposed records

**[Proposed]** Records from the Ash Hounds design (2026-10-09; four of them now built), plus
one drafted on 2026-10-10 (`dispatch-id`) because the design names Wade's
staff ID as evidence but never wrote it. None is in the game. Proposed IDs may
change before they're built.

"Kind" separates **historical** evidence (made at the time and left) from
**recent** traces, which always have a present-day cause noted for the
writer.

Places marked *(proposed)* aren't destinations: the old works gallery is
proposed as a lead at the Dry Reservoir; the Weighbridge and the Ridge Road
would need a decision before any record there could be built.

### `unit-plate`: Serial plate

- **Where**: your shelter, the purifier *(proposed: an inspect action at
  home)*.
- **Kind**: historical (the plate from manufacture; the tags from Y+3).
- **What you see**: stamped metal on the sorbent stack, and two service tags
  wired on.
- **What it says**: "RC-40 SORBENT STACK · SN 118-0447". Tags: "SVC M.H. ·
  EX U-112" and "FITTED M.H. · 2 JUN".
- **Why legible**: stamped metal, indoors.
- **Observed**: a serial number containing 118; two tags signed M.H.
- **Claimed**: the tags say the stack came from U-112 and was fitted by M.H.
- **Possible reading**: the stack started in U-118, the Patels' Unit.
- **Unknown**: how it left U-118, and whether anyone agreed to it.
- **Prerequisite**: none. Means most after `bus-2` ("U-118… keys to Mags").
- **People**: Mags, the Patels, (the Coopers).
- **Answers**: where did my purifier come from? (Partly.)
- **Creates**: who is M.H.? Never a judgement on the player.

### `mags-dropboard`: Repairs left here

- **Where**: Ruined Workshop, inside the office door.
- **Kind**: recent. Writer's cause: Mags visits monthly.
- **What it says**: "U-131 genny brushes done, under bench. Eggs in tin, ta.
  M.H. 9 APR". Below: "Chalk kid: soup in the green tin. Bring the bowl
  back." A padlocked payment tin beside it.
- **Why legible**: indoors, renewed monthly.
- **Observed**: fresh pencil; a working repair under the bench.
- **Claimed**: M.H. did the repair; someone called "chalk kid" is being fed.
- **Possible reading**: Mags is alive. (It only shows someone signs M.H.)
- **Unknown**: who M.H. is now; who the chalk kid is.
- **Prerequisite**: none.
- **People**: Mags; Toby (unnamed).
- **Answers**: does anyone still fix Units?
- **Creates**: choice to leave payment for a repair; lead toward the chalk
  kid.

### `tagged-door`: Assessed

- **Where**: Ruined Workshop, the outside door.
- **Kind**: recent (weeks). Writer's cause: an Ash Hound assessment run.
- **What it says**: a yellow plastic freight tag: "CONSIGNMENT · FRESHWAY
  REGIONAL", and in marker: "AH · ASSESSED · OLD WOMAN · 2 STACKS".
- **Why legible**: plastic, new.
- **Observed**: the tag and its writing.
- **Claimed**: nothing explicit; "assessed" isn't explained.
- **Possible reading**: someone is sizing up Mags and her stacks.
- **Unknown**: who AH are; what follows.
- **Prerequisite**: none. Visible from the first visit; its meaning comes
  later.
- **People**: Mags; Wade (unnamed).
- **Answers**: none yet.
- **Creates**: where do these tags come from?

### `dev-toolbag`: now implemented

Built on 2026-10-10 for Toby's collection; text in `src/game/stories.ts`, listed above.

### `chained-valve`: now implemented

Built on 2026-10-10 for Toby's collection; text in `src/game/stories.ts`, listed above.

### `chime-camp`: now implemented

Built on 2026-10-10 for Toby's collection; text in `src/game/stories.ts`, listed above.

### `chalk-warning`: now implemented

Built on 2026-10-10 for Toby's collection; text in `src/game/stories.ts`, listed above.

### `convoy-graves`: Unarmed

- **Where**: Ridge Road cutting *(proposed location)*.
- **Kind**: historical (Y+1).
- **What you see**: a burnt-out truck; three graves with crosses cut from road
  signs, names scratched: "M. OKORO · J. FENN · 'BLUEY' RAKE". Carved below:
  "KILLED HERE, UNARMED. R.L."
- **Why legible**: scratched metal signs; carved.
- **Observed**: three graves, a truck.
- **Claimed**: R.L. says they were killed unarmed.
- **Possible reading**: deliberate murder; Ruth was here after.
- **Unknown**: by whom, as far as the graves say.
- **People**: Ruth; the drivers.
- **Answers**: were these deaths deliberate?
- **Creates**: what was the convoy? (`convoy-manifest`, same place.)

### `convoy-manifest`: Authorised H. Lane

- **Where**: the same truck cab, a steel tin in the glovebox.
- **Kind**: historical (Y+1).
- **What it says**: "NORTHFIELD → KELL BRIDGE RELIEF · 3 vehicles · 40
  cartridges · 900 kg flour · insulin (cold box) · Authorised H. Lane".
  Behind the sun visor, a child's drawing: "DAD'S TRUCK."
- **Why legible**: steel tin; the visor shaded the drawing.
- **Observed**: a manifest and a drawing.
- **Claimed**: H. Lane authorised the convoy.
- **Possible reading**: Helen kept working at Northfield and tried to help
  Kell Bridge.
- **People**: Helen; a driver and his child.
- **Answers**: what did Helen do after the war?
- **Creates**: none new.

### `levy-receipt`: Party of 19

- **Where**: the Weighbridge *(proposed)*, a carbon book in the scale house.
- **Kind**: historical (Y0, Day ~143).
- **What it says**: "TRANSIT LEVY · KELL BRIDGE CHECKPOINT · Party of 19
  (Lane) · 6 cartridges, 2 crates tins · Sgt C. Bell". In the margin: "one
  argued, sorted."
- **Why legible**: carbon book in an office.
- **Observed**: a receipt.
- **Claimed**: the Lane party paid; one argued.
- **Possible reading**: Ruth's 19 passed the checkpoint, at a price.
- **Unknown**: what "sorted" means.
- **People**: Ruth, Gary (unnamed), Sgt Bell.
- **Answers**: did the 19 get past the checkpoint?

### `wade-ledger`: Runs, week 17

- **Where**: the Weighbridge, the scale-house office *(proposed: reachable
  while the Hounds are out on a run)*.
- **Kind**: recent.
- **What it says**: on the whiteboard and in a hardback ledger in the desk
  drawer: "RIDGE RD: Kell walkers, Thu." "EAST SIDE: U-112 (old woman, WANT HER
  WHOLE), U-131, U-1xx (new occupant, assess)." "INTAKE: hold. Kell pays or
  dries." "Tully hesitated again. Last warning." Signed: "Nobody walks away to
  tell it. W.M." In the back, in another hand, a column of numbers headed
  "dead".
- **Why legible**: indoors, in use.
- **Observed**: plans, names, a count.
- **Claimed**: their plans; the count of dead is Lena's own.
- **Possible reading**: an attack is coming on the east side, the player's
  Unit included.
- **Unknown**: when; how many ride.
- **People**: Wade, Lena, Jace, Mags, the player (as an unnamed Unit).
- **Answers**: what do the Ash Hounds want now?
- **Creates**: the main choice ([main-story.md](main-story.md#choices)).

### `helen-letter`: Mum

- **Where**: the Weighbridge loot store, in a trader's pack.
- **Kind**: historical (Y+3).
- **What you see**: an unopened envelope addressed "Ruth Lane, Kell Bridge
  exchange", among Nell Ashby's trade book and a joke-a-day calendar.
- **What it says** (only if the player opens it): "Mum. I should have rung
  everyone at twelve forty, not just you. I've told myself why for three years
  and it still isn't true. I'm not well. I'm sorry about the pallets argument.
  You were both right. H."
- **Why legible**: sealed envelope inside a pack inside a container.
- **Observed**: the envelope and the trader's things.
- **Claimed**: Helen's own account of 12:40 and her illness.
- **Unknown**: whether Ruth knows any of it.
- **People**: Helen, Ruth, Nell Ashby.
- **Answers**: what happened to Helen? Why did she phone only Ruth?
- **Creates**: choice to carry it to Ruth, or not; to open it, or not.

### `dispatch-id`: Dispatch lead

- **Where**: the Weighbridge, on Wade's desk.
- **Kind**: historical (before the war, and the Ninth).
- **What it says**: a FreshWay staff pass: "W. MERCER · DISPATCH LEAD ·
  FRESHWAY REGIONAL DC, ENDER". Clipped behind it, a printout of the ESD-31
  dispatch list with one line underlined in pen: "CALDER 11/22 SHORT. Follow
  up."
- **Why legible**: laminated pass; paper kept in a desk.
- **Observed**: who he was; that he noticed Calder's shortfall.
- **Claimed**: nothing beyond the list.
- **Possible reading**: Wade knew about Ruth's pallets from the start.
- **Unknown**: whether that had anything to do with what he did later. The
  writer's answer is no; don't let it become a motive.
- **People**: Wade; Ruth (indirectly).
- **Answers**: who is W.M.?

## Not written yet

These were discussed but never written as records under the nuclear-war
setting. Don't treat earlier drafts as their text; those were set in the
superseded drought story.

- Helen's 12:40 phone call from the council side (only her letter covers it).
- The Patels' note to Mags, with "keys to keep it ticking over" and Mags's
  reply "empty is empty, the baby needed it".
- Dev's record of choosing CS-4's water over the east side.
- Mags's job list under the new setting.
- Any record about the Coopers or the Ferrises.
- Jace Tully's or Lena Voss's own evidence beyond the ledger.
