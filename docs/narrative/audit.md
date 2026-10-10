# Narrative audit, 2026-10-10

Labels are explained in [README.md](README.md#status-labels). This audit
checks the whole story bible after Ruth's set was built and Mags's, Dev's and
Helen's packages were written. Sources:
- [world-bible.md](world-bible.md), [characters.md](characters.md),
  [main-story.md](main-story.md), [ash-hounds.md](ash-hounds.md),
  [fragments.md](fragments.md);
- the five people's pages: [toby-comic-script.md](toby-comic-script.md),
  [collections-next.md](collections-next.md) (Ruth), [mags.md](mags.md),
  [dev.md](dev.md), [helen.md](helen.md);
- the implemented text in `src/game/stories.ts` and `src/game/collections.ts`.

It checks dates, ages, travel, relationships, who owns which object, and what
each person knows. **Fixed** means a clear error was corrected in this pass.
**Recommended** means a choice for the project owner. Nothing recommended
here was made canon by the audit itself; the owner's decisions of
2026-10-10 are recorded in [Decisions applied](#decisions-applied-2026-10-10).

## Decisions applied, 2026-10-10

The project owner decided these after the audit. Each is now **[Canon]**
and every doc that touched it was brought into line.

| Decision | What changed, and where |
|---|---|
| **Ruth has heard rumours of Helen's death, with no reliable confirmation** | characters.md (Ruth's timeline and writer's truth); collections-next.md and the built comic, Ruth panel 10 ("they're saying she was sick, last winter" / "They say a lot of things. Take the note."); helen.md (timeline Y+4–Y+5, decision 1) |
| **Kerry replied to Kell Bridge; Ruth holds the replies and doesn't know Toby is in Calder** | characters.md (Toby, Ruth, Kerry); toby-comic-script.md ("Will Kerry answer?" answered); collections-next.md, Ruth panel 12 (three envelopes on her shelf); main-story.md ("Help Toby", first part, being built as records through the Workshop's tins); mags.md (her tins carry the post); world-bible.md (timeline Y+4–Y+5) |
| **Dev refused to show the bypass; the Ash Hounds killed him, then chained the main valve** | world-bible.md (new section [The bypass](world-bible.md#the-bypass): what it is and why it isn't an easy fix); ash-hounds.md (history, Wade's culpability and weakness, "what they don't know"); characters.md (Dev, Ruth, Toby); main-story.md ("Open the bypass" choice, ending 1, the reveals table); dev.md (timeline, writer's truth, comic panels 13–14, proposals); toby-comic-script.md, Toby panels 10–11 ("…wanted the water, and the way round the valve" / "Dev wouldn't show them the way round. So they chained the valve.") |
| **Ridge Road: Y+1 convoy kept distinct; the two Y+3 losses merged** | The merge checks out (below). ash-hounds.md, world-bible.md, characters.md (Nell, Nina), dev.md, helen.md (timeline, Nell, panels 13–14) |
| **The bore house is Dev's; Mags is an alternative entry** | dev.md (`bore-house` → `pump-log`, opened by `radio-log`, `day-140` or `mags-jobbook`; the run sheet now records "17 MAR · MOTOR BURNT OUT. M.H. REWOUND IT. ¼ LOAD TILL RUN IN." and "D.P. DRIVING · G. UNLOADING AT THE RAMP"); mags.md (`mags-bore-tag` by `bore-motor`, opened by `pump-log` or `mags-jobbook`) |
| **Mags's door tag reads "RE-PACKS"** | mags.md (`tagged-door` refined to "AH · ASSESSED · OLD WOMAN · RE-PACKS") |

**Why the Y+3 merge is coherent**:
- **Dates**: both losses are in Y+3 winter, after Toby left Northfield
  ("before winter") and after he reached Kell Bridge (Dev's panel 10 comes
  before Nina's loss in panel 11).
- **Participants**: Nell is walking Northfield → Kell Bridge by the Ridge
  Road. Nina is a Kell Bridge re-packer going home the same way. Nell's
  party is the safe way to travel, and the Ash Hounds kill witnesses but
  take people who can work water.
- **Letter chronology**: Helen writes from her sickbed; Nell takes the
  letter; the ambush; the letter goes to the loot store unopened; Helen dies
  three weeks later. Nothing in Toby's letters (Y+4–Y+5) or Kerry's replies
  depends on either event.

The Y+1 convoy (three drivers, Helen's trucks, Ruth's graves) stays a separate
event two years earlier.

## Fixed in this pass

| What | Where | Fix |
|---|---|---|
| Ruth's comic said "12:40, the siren". 12:40 was Helen's private call; the public siren was 13:45 ([world-bible.md](world-bible.md#dates-and-ages) timeline) | `src/game/collections.ts` Ruth panel 4; collections-next.md | "13:45, the siren. She was already counting them down into CS-4." That hints she was warned early without showing the call |
| Day 140 dated 27 July. Day 1 is the Ninth (9 March), so Day 140 is 26 July (and Day 15 is 23 March, which matches) | dev.md timeline | 26 July |
| Mags's comic drew Dev at 34 clean-shaven; the visual bible gives him a short beard throughout | mags.md panel 5 and art needs | Beard kept, not yet grey |
| Helen's timeline put the Patels' walk back under Y+2; Mags has it in Y+1 spring | helen.md | Y+1 spring |
| Helen's note asking for the siren fix | helen.md | Marked done |

## Dates and ages

Every age was checked against [world-bible.md](world-bible.md#dates-and-ages)
(the Ninth is Tuesday 9 March Y0; now is autumn Y+5; birthdays are assumed
to fall before March).

| Person | The Ninth | Ages used in the packages | Now | Result |
|---|---|---|---|---|
| Ruth | 61 | 61 (the Ninth), 64 (Toby arrives, Y+3), 66 (now) | 66 | consistent |
| Helen | 38 | 38; 41 at death (Y+3 winter) | dead | consistent |
| Dev | 34 | 33 (Y-1), 34, 36 (Y+2 card for Mags), 37 (Y+3), 38 (18 May Y+4) | dead | consistent |
| Mags | 72 | 71 (before), 72, 74 (Y+2 autumn in Dev's comic), 76 (Y+4), 77 | 77 | consistent |
| Toby | 11 | 10 (Y-1 ride-along), 11, 13, 14 (leaves Northfield, Y+3), 15 (Y+4), 16 | about 16 | consistent |
| Kerry | mid 30s | 35, 39 | about 40 | consistent |

Travel: Calder to Kell Bridge is 38 km by the highway or along the old works
main, with the checkpoint (the Weighbridge) 18 km north. Northfield is 110 km
north-east, Ridge Road a back road from Northfield to Kell Bridge. The
packages use these routes consistently: the nineteen walk the pipe; the
convoy takes the Ridge Road to avoid the checkpoint; walkers carry notes and
letters on both roads.

## Shared events, checked across stories

| Event | Toby | Ruth | Mags | Dev | Helen | Result |
|---|---|---|---|---|---|---|
| The Ninth, 03:40, Kerry wakes Toby | panel 3 | — | — | — | — | — |
| 07:12 ESD-31; 11 of 22 pallets | — | panel 2 | — | the radio log's "I do sort of know" | the pallets argument, Day ~30 | agree |
| 09:00 Bus 2; "one bag each"; Ruth's seat to the Patterson boy; Mags declines seat 31 | panel 4 | panels 3–4 (↺ p04) | panels 2–3 | — | — | agree |
| 12:40 forecast; Helen rings Ruth | — | not shown (held back) | — | Dev's pencil "12:40??" on the bulletin | panel 3 | agree after the siren fix |
| 13:45 siren; ~15:30 dust | — | panel 4 | 13:45 at the Coopers' | — | panel 4 | agree |
| 10 March radio: "Is Ruth Lane in CS-4?" | — | panel 6 | — | panel 3 | panel 6 | **one moment; draw it once** and reuse it in all three |
| Day 9 bore motor burns out; Mags rewinds it | — | — | panel 5 | not mentioned; his run sheet runs 9–23 March | — | compatible; see "bore house" below |
| Day 15 (23 March): diesel out, 23 walk up | — | — | — | `pump-log` | — | agrees with `day-140` |
| Day 140 (26 July): nineteen go north along the pipe | — | panels 7–8 | — | panel 6 | the book left "in case H. comes back" | agree |
| Day ~143 levy at the checkpoint, six cartridges, Gary beaten | — | hinted, panel 8 | — | hinted, panel 13 | — | agree; both hints are allowed ("partly" early in main-story.md) |
| Y+1 Patels walk back, find the stack gone | — | — | panels 6–7 | — | signs their pass | agree after the fix |
| Y+1 winter Ridge Road convoy; drivers killed; graves "R.L." | — | — | — | waiting for its cartridges; helps bury | panels 10–11 | agree |
| Y+2 tags and tribute begin; Mags's tools taken | — | — | panel 8 | — | — | agree with ash-hounds.md (Y+2) |
| Y+3 Toby reaches Kell Bridge; Ruth knows him; Dev takes him on | panels 7–8 | panel 9 (↺ p07) | — | panel 10 (↺ p08) | he leaves before her last winter | agree |
| Y+3 winter: the messenger ambush (Nell killed, Nina taken) | — | — | — | panel 11 | panels 13–14 | one event [Canon, 2026-10-10] |
| 18 May Y+4: Dev killed; Toby escapes by the pipe | panels 10–11 | panel 11 | Kell walkers tell her | panels 12–13 (↺ p09, p10) | — | agree |
| After Dev: the main valve chained within days; later Ruth refuses to pay | panel 11 | panel 11 | — | chain "within days" | — | agree; ash-hounds.md reconciled [Canon, 2026-10-10] |
| Y+4–Y+5: chalk warnings; soup for "the chalk kid"; the forwarding tin | panels 13–14 | — | panel 11 | — | — | agree |
| Autumn Y+5: Mags's door tagged; Ruth stamps chits | — | panel 12 | panel 12 | Kell still re-packs on his bench | — | agree |

## Objects: who owns what, where it is now

| Object | Chain of custody | Status |
|---|---|---|
| The U-118 sorbent stack | Patels' Unit → (the Ninth, Mags) Coopers' U-112 → (Y+2) wrapped spare in U-112 → (2 June Y+3, Mags) the Ferrises' Unit → the player's, by inheritance | Canon chain, Proposed dates. **The player did nothing wrong.** |
| U-112's own stack | Saturated in Y0 → re-packed by Mags for herself in Y+2 | Proposed |
| The LOOP CREW vest | Depot issue → Dev gives it to Toby (Y-1) → worn on the Ninth (`locker-6` photo, Bus 2) → cut down to fit at 16 | Proposed (dev.md); fits the implemented photo |
| Gerald (Cart 4) | Loop depot → on its side at the underpass, Toby's camp | Implemented (`chime-camp`) |
| Toby's school card | Northfield school (Helen's office laminated the cards) → Toby's pack → pinned in Gerald's bin | Implemented card; Helen's office Proposed |
| Dev's toolbag and logbook | Dev → left in the gallery on 18 May Y+4 | Implemented |
| The re-pack card | Dev writes it at Kell Bridge → a copy left for Mags in Y+2 → nailed above the Workshop bench, still ticked | Proposed |
| The forwarding tin and the payment tin | Mags's drop-off at the Workshop from Y+2 | Proposed; both seen in implemented records |
| Exchange chits | Stamped at Ruth's exchange → carried by walkers → paid into Mags's tin | Implemented (`exchange-chit`); the cause Proposed |
| Helen's letter | Helen → Nell Ashby → the Weighbridge loot store, unopened | Proposed |
| The Patels' keys | Anjali → Mags on the Ninth → still on the Workshop key board | Proposed (mags.md) |
| Kerry's replies | Kerry at Northfield → walkers → Kell Bridge exchange, "care of R. Lane — hold for him" → Ruth's shelf, sealed | [Canon, 2026-10-10] |

**Mismatch found**: the proposed `tagged-door` read "OLD WOMAN · 2 STACKS",
but by Y+5 Mags has only U-112's stack; the U-118 stack went to the
Ferrises in Y+3. **Resolved 2026-10-10**: it now reads "RE-PACKS".

## Who knows what (now, autumn Y+5)

| Fact | Ruth | Toby | Mags | Kerry | The player |
|---|---|---|---|---|---|
| Toby is alive in Calder | **no**; fears he died with Dev | — | feeds "the chalk kid", doesn't know who | **yes**, from his letters [Canon, 2026-10-10] | from Toby's records |
| Kerry answered | holds the replies, sealed | **no**; thinks she didn't | no | — | from the "Help Toby" task |
| Where the bypass is | no | **yes**, the way; part of the procedure | no | no | no, until the main story |
| Helen is dead | **rumour only**, unconfirmed [Canon, 2026-10-10] | no | no | no | only from `helen-letter` |
| Dev was killed | yes | yes | yes, from walkers | no | from `chained-valve` |
| Mags is alive | probably, from the chits | no | — | — | from `mags-dropboard` (only "M.H.") |
| The player's stack was the Patels' | no | no | yes | no | from `unit-plate`, `patels-keys` |

## Unresolved threads, with recommendations

None of these is decided. Each recommendation would need approval.

1. **The Patterson boy** (given Ruth's seat; possibly one of the two who got
   off at Kell Bridge).
   - **Recommended**: keep him open until there's a Kell Bridge chapter.
   - **Option**: he is the young re-packer reading Dev's card aloud in Dev's
     last panel. He'd be 14 now, the same age as Toby when he arrived. The
     seat Ruth gave away ends up at Dev's bench. No record states it yet.
2. **The Patels' purifier component.**
   - **Recommended**: keep canon as it is. The player's Unit runs on it; no
     restitution quest; never a penalty.
   - **Optional later choice**: since Helen signed the Patels' pass and they
     are at Northfield, the player could leave word for them in the
     forwarding tin. It stays optional and costs nothing.
   - The `patels-keys` note ("Empty is empty") lets players judge Mags, not
     themselves.
3. **Dev's final refusal.** **Resolved 2026-10-10** [Canon]: he refused to
   show the bypass; they killed him and chained the main valve; Ruth refused
   to pay later. ash-hounds.md is reconciled. The original recommendation
   was:
   - **Recommended**: adopt dev.md's writer's truth. He had paid the levy
     once; the Hounds had taken Nina; refusing bought Toby time; and they
     never learned how to run the valve.
   - **Timing**: the valve was chained within days of his death, and Ruth's
     refusal came after.
   - **Needs a fix in ash-hounds.md**: its history table and its "weakness"
     note disagree about when the chain went on. Reconcile them to "chained
     right after; Ruth refused later".
4. **The "2 STACKS" tag.** **Resolved 2026-10-10**: "RE-PACKS".
   - **Recommended**: change the proposed `tagged-door` text to "AH ·
     ASSESSED · OLD WOMAN · RE-PACKS". That fits what they want from her (a
     re-packer, like Nina) and the ledger's "WANT HER WHOLE".
5. **Nina Haas and Nell Ashby**, both lost on the Ridge Road in Y+3 winter.
   **Resolved 2026-10-10**: merged into one messenger ambush; the merge
   checks out (see "Decisions applied").
   - **Recommended**: make it one ambush. Nell's party is carrying Helen's
     letter and has Nina with it, on her way back from visiting Northfield.
     Nell is killed and Nina taken.
   - That ties Helen's letter, Dev's grief and the Hounds' captive re-packer
     to one event, and the main story needs one Ridge Road incident, not two.
6. **Toby's letter.** **Adopted 2026-10-10** [Canon], with the restore-contact
   task built through the Workshop's tins, so no Kell Bridge record is
   needed. The lid's three ticks show three letters were taken
   north. Kerry is in Northfield's kitchens; Helen died before the first
   letter could reach her office.
   - **Recommended**: the letters reached Kerry. She wrote back, but to Kell
     Bridge, because the last she knew he'd gone to Ruth. So **Ruth holds
     Kerry's replies to Toby**, unopened, at the exchange.
   - That answers "Will Kerry answer?" (yes, to the wrong place). It also
     joins "Does Ruth know Toby is in Calder?" and main story stage E ("Help
     Toby... reach Ruth"): one walk north settles both.
   - No record states this yet. It would be a later record at Kell Bridge,
     which isn't a destination.
7. **Does Ruth know Helen is dead?** **Resolved 2026-10-10** [Canon]: rumour,
   no reliable confirmation.
   - **Recommended**: no; rumour at most. Change characters.md's Proposed
     line "Hears of Helen's death from walkers" to match Ruth's and Helen's
     comics. Then carrying the letter is the only real news, as main story
     stage E intends.
8. **Who drove CS-4's water truck.** **Adopted 2026-10-10**: "D.P. DRIVING ·
   G. UNLOADING AT THE RAMP". Dev's run sheet had "G. DRIVING" on
   10 March, while Gary was sheltering in CS-4 with his kids.
   - **Recommended**: Dev drives; G. is written as unloading at the CS-4
     ramp. That keeps Gary sheltering in the two weeks the radio said to
     sit tight. It's a one-line change in dev.md's proposed `pump-log`.

## Record placement across the sets

Several packages put records in the same places. A combined plan, all
Proposed:

| Place | Look around, in order | Behind leads |
|---|---|---|
| Supermarket (7 now) | `ration-sign`, `store-instruction`, `cart-dogs`, `chalk-warning` [Implemented] | `locker-6`, `bus-2`, `cs4-board` [Implemented] |
| Dry Reservoir (5 now) | `our-loop`, `radio-log` [Implemented] | `day-140`, `dev-toolbag`, `chained-valve` [Implemented]; `pump-log` (lead `bore-house`); `mags-bore-tag` (lead `bore-motor`, opened by `pump-log` or `mags-jobbook`); `council-bulletin`, `siren-talk` (Helen's leads) |
| Ruined Workshop (2 now) | `toby-letter`, `exchange-chit` [Implemented]; then `tagged-door`, `mags-dropboard` | `mags-jobbook`, `patels-keys`, `dev-repack-card` |
| Creature Nest (1 now) | `chime-camp` [Implemented] | `dev-loop-roster` (lead `depot-office`) |

**The lead-ID clash** (**resolved 2026-10-10**): `bore-house` is Dev's and
leads to `pump-log`, opened by `radio-log`, `day-140` or Mags's
`mags-jobbook`. `bore-motor` leads to Mags's tag, opened by the run sheet or
her job book. dev.md and mags.md now agree.

**On the "¼" rule**: Mags says Dev's quarter-turn comes from her "¼ LOAD"
tag; Dev says it's because opening further stirs the silt. **Settled
2026-10-10**: the reason is Dev's (the silt, which is also why the bypass
opens a quarter turn at a time); the habit of saying it in quarters is a joke
between them. The bore tag stays as written.

## Cards and comics

- **Cards**: every card in all five sets is a found object, its words quoted.
  Shared objects keep one picture (the passenger list, the logbook and the
  valve already do; the radio log and the Day 140 book should).
- **Every set meets rule 2** (at least two records of its own):
  - Toby: `cart-dogs`, `our-loop`, `locker-6`, `chime-camp`, `chalk-warning`,
    `toby-letter`.
  - Ruth: `ration-sign`, `store-instruction`, `cs4-board`, `exchange-chit`.
  - Mags: six.
  - Dev: three.
  - Helen: four.
- **Comics tell the story; they don't keep saying the records can't.** The
  only "doesn't know" lines are characters' own ignorance (Ruth about Toby,
  Mags about the chalk kid), never the narrator's.
- **Held-back reveals** stay held back in Ruth's, Mags's and Dev's comics:
  Helen's death, the 12:40 call, the ledger and Wade's name. Helen's comic
  needs `helen-letter` to unlock, so it may show her death.

## Not checked

- The Ash Hounds' own internal timeline beyond the points above.
- Art: nothing new was drawn. Drift in published panels is listed in
  [visual-bible.md](visual-bible.md#drawn-so-far-and-what-to-match).
