# Toby's collection

Labels are explained in [README.md](README.md#status-labels).

**[Canon]** (approved 2026-10-10): a story collection, starting with Toby
only. Finding a record permanently unlocks a card. Six cards: childhood,
evacuation, Northfield, apprenticeship with Dev, Dev's fate, present-day
warnings. Completing the set unlocks a replayable comic of 8–12 panels and a
one-time XP reward. Cards are not inventory and can't be lost.

**Status**: cards, progress and the reward are built (stage 2). The comic's
art is **placeholder** until the storyboard and Toby's character design below
are approved (stage 3).

## How cards unlock

A card is unlocked when **any** record listed for it is in the player's
journal. Progress is read from the same discoveries the journal uses (PLAN.md,
"Records in the wasteland"); there is no separate progress. So:

- **Backfill** is automatic: a player who found these records before the
  collection existed sees those cards unlocked.
- **Out of order** works: each card depends only on its own records.
- **Defeat and escape** can't remove a card, because they can't remove a
  record.

| # | Card | Period | Unlocked by any of | Where those are |
|---|---|---|---|---|
| 1 | Gerald sings | Childhood | `cart-dogs`, `our-loop` | Supermarket (look around); Dry Reservoir (look around) |
| 2 | One bag each | The Ninth | `locker-6`, `bus-2` | Supermarket, by lead |
| 3 | Showground school | Northfield | `chime-camp` | Creature Nest entrance (look around), recorded on arrival before the beast |
| 4 | Quicker than me | Apprenticeship | `dev-toolbag` | Dry Reservoir, the old works gallery, by lead |
| 5 | He didn't show them | Dev's fate | `chained-valve` | Dry Reservoir, the valve, by lead |
| 6 | Don't go single | Now | `chalk-warning` | Supermarket (look around, 4th) |

Cards 1–2 reuse records already in the game. Cards 3–6 need four records that
were only proposed ([fragments.md](fragments.md#proposed-records)); they are
built with this feature, at existing destinations, under the existing rules.

New leads, both at the Dry Reservoir:

- **The old works gallery** → `dev-toolbag`. Opened by `day-140` ("the old
  works main runs north…") or by `chime-camp` (a map in the cart's bin).
- **The valve** → `chained-valve`. Opened by `dev-toolbag` (the log stops at
  the intake; the valve is further along).

Hidden cards show only a card back with its number: no title, period, place
or hint, so nothing is given away.

## Card fronts

Each front says what the evidence shows and how sure it is. Art is a
labelled placeholder until stage 3.

1. **Gerald sings** · Childhood. "A Year 5 kid who loved the Loop's carts,
   called Cart 4 Gerald, and fed three dogs he said were his." *How sure*:
   his own drawing and worksheet.
2. **One bag each** · The Ninth. "Ticked onto Bus 2 with his mum, Kerry, and
   a carrier bag of dog food." *How sure*: a tick on a list shows he was
   checked on, not that he arrived.
3. **Showground school** · Northfield. "A school card: Tobias Wren, Year 8,
   Northfield showground. Someone has kept it for years." *How sure*: the
   card is real; who carries it now isn't certain.
4. **Quicker than me** · Apprenticeship. "D.P.'s last log: 'T doing the
   screens. Kid's quicker than me now, don't tell him.'" *How sure*: the log
   calls him T.
5. **He didn't show them** · Dev's fate. "Chalk beside a chained valve: Dev
   Pillai killed here, 18 May, by Mercer's lot. Signed T.W." *How sure*: an
   account, not something the player saw.
6. **Don't go single** · Now. "Chalk in the bus shelter, warning travellers
   about the Ridge Road. Signed T." *How sure*: recent; the signature fits.

## Reward

Completing the set gives **+50 XP once** (configurable in
`src/game/config.ts`) and unlocks the comic. The reward is stored once per
shelter and set, so reloading, retrying or finding records in any order can't
pay it twice. It's logged in the activity log.

## Comic storyboard (10 panels)

Cards and panels quote only the set's own records, so the comic never shows
a player something from a record they haven't found. Each panel is labelled
with what it rests on: **Record** (what the records
show), **Account** (someone's testimony) or **Unknown** (left open). It never
shows more than the records support.

| # | Scene | Caption | Basis |
|---|---|---|---|
| 1 | A white Loop cart with a painted face on a suburban footpath; a boy, about 11, crouched with three dogs; music notes from the cart | "They come when Gerald sings." | Record: `cart-dogs`, `our-loop` |
| 2 | Night, a supermarket staff room, a boy asleep on chairs under a jacket; a radio on the shelf | "The Ninth. His mum was on the night shift." | Record: `locker-6` (the shift note, the jumper left behind). That he was asleep there is the writer's, shown softly |
| 3 | The FreshWay car park at 09:00, a queue for a bus; a boy holding a carrier bag; a woman's hand on his shoulder | "Bus 2. One bag each. His was dog food." | Record: `bus-2` |
| 4 | A bus on an empty highway, seen far off | "Bus 2 left for Northfield. Whether he got there, the list can't say." | Record: `bus-2`. Unknown: whether he arrived |
| 5 | A school card on a tent's trestle table, showground pavilions behind | "Northfield showground school. Year 8." | Record: `chime-camp` (the card) |
| 6 | Blank road, a single set of footprints heading away | "How he got from Northfield to the old works, the records don't say." | Unknown |
| 7 | Inside the gallery: a man and a teenager clearing intake screens by torchlight; the man's back to us | "'Kid's quicker than me now. Don't tell him.'" | Record: `dev-toolbag` |
| 8 | The valve wheel wrapped in chain, a yellow tag, chalk letters beneath. No figures | "'He didn't show them where.' That's T.W.'s account." | Account: `chained-valve` |
| 9 | The Nest's mouth at dusk: a cart on its side, a solar panel, bowls, dogs at a distance | "Someone keeps the dogs close now." | Record: `chime-camp`. Unknown: who |
| 10 | A bus shelter wall, fresh chalk and a small dog drawn beside it | "AH on Ridge Rd Thurs. Don't go single." Then: "Still open: Who lives at the Nest? Who is Mercer? What happened to Bigsy, Lady and Chips?" | Record: `chalk-warning`; Unknown |

No panel shows a killing, a body, or Toby's face at 16 clearly.

## For review before final art (stage 3)

- **Toby's look.** At 11: gap-toothed, a LOOP CREW hi-vis down to his knees
  (from `locker-6`). At 16: not described anywhere; the storyboard avoids his
  face in panels 7–10. Approve, or give a design.
- **Art style.** Proposed: the painted style of the shelter scene and the
  sign-in painting, muted, dusk light.
- **The dogs in panel 1.** Ordinary dogs before the war; the fallout-born
  look only in panel 9, at a distance.
- **Panel 2.** Toby asleep in the staff room is the writer's detail, not
  evidence. Keep it, or show only the locker.
- **Panel 6.** Leaves the Northfield-to-Kell Bridge years blank, because no
  record covers them. Approve, or add a record later.
- **Panel 8.** The ambush is shown only through its aftermath.
- **The four new records' text** (`chime-camp`, `dev-toolbag`,
  `chained-valve`, `chalk-warning`): they follow
  [fragments.md](fragments.md#proposed-records), now in
  `src/game/stories.ts`. "Mercer's lot" and "AH" bring the Ash Hounds in by
  name only; no Weighbridge or raider encounter is added.
- **The XP amount**: 50 (a won fight is 25, a trip 8–12).
- **Card titles and fronts** above.
