# Holdout narrative

The story bible for Holdout: the world after the war, the people who lived in
Calder Valley, the main story, the Ash Hounds, and every record, built or
proposed.

## Where things are

| File | What it holds |
|---|---|
| [world-bible.md](world-bible.md) | The war and the five years since, Calder Valley, Resilience Units, the Loop, radiation and creature rules, locations, and the lore this replaced |
| [characters.md](characters.md) | Ruth, Helen, Dev, Mags, Toby and the supporting cast: timelines, decisions, fates, and what evidence lets a player conclude |
| [main-story.md](main-story.md) | The player's arc in five stages, reveals and their conditions, choices, endings, and how solo and shared play fit together |
| [ash-hounds.md](ash-hounds.md) | The raider faction, Wade Mercer, Lena Voss, Jace Tully, and how they enter the story |
| [fragments.md](fragments.md) | The implemented records (catalogue only) and the full text of every proposed record |
| [toby-collection.md](toby-collection.md) | Toby's six collectible cards, what unlocks each, and the comic storyboard, with details awaiting review |

## Sources of truth

- **Runtime text of the implemented records** lives only in
  [`src/game/stories.ts`](../../src/game/stories.ts). These docs catalogue
  them; they don't copy their text, so there's one place to edit.
- **Approved canon in short** is PLAN.md, "Records in the wasteland" →
  "Canon". These docs expand it. If the two ever disagree, PLAN.md wins until
  this folder is corrected.
- **Rules for finding records** (leads, "What to look for", the journal) are
  in PLAN.md, "Records in the wasteland" → "Records, leads and the journal".
  [main-story.md](main-story.md) only proposes how later chapters use them.

## Status labels

Every section or claim that isn't obvious carries one of these:

- **[Implemented]**: in the game now.
- **[Canon]**: approved by the project owner. It may not be built yet.
- **[Proposed]**: written by the agent, not yet approved. It can change or
  be dropped. Most of the Ash Hounds detail and every character's later fate
  are proposals.
- **[Open]**: a decision still needed.
- **[Superseded]**: replaced; kept only so nobody reuses it by accident.

Proposals are never canon just because they're written down here.

## Open decisions

- **[Open]** Approve the Weighbridge and the Ridge Road as story locations.
  Neither is a destination.
- **[Open]** Choose a continuity model for the shared antagonist
  ([main-story.md](main-story.md), "Solo and shared play"); the recommended
  one needs a small amount of shared state the game doesn't have yet.
- **[Open]** Approve the first chapter after the slice, "The Old Works", and
  when to build it. Crit 9 (2026-10-14) comes first.
- **[Open]** Which creature concepts move forward
  ([world-bible.md](world-bible.md), "Creatures").
- **[Open]** The player's own Unit number (written `U-1xx` throughout).

## Revision log

- **2026-10-07** — First story proposal, built on a drought and the Loop's
  failure. **[Superseded]** on 2026-10-09; see
  [world-bible.md](world-bible.md), "Superseded lore".
- **2026-10-09** — Eight-record slice about Ruth and Toby implemented at the
  Supermarket and the Dry Reservoir (commit `c536ae4`). The same day the
  setting was corrected to a nuclear war and the eight records were
  rewritten with the same IDs (commit `a8dd711`). PLAN.md canon updated.
- **2026-10-09** — Ash Hounds and Wade Mercer approved as a direction;
  faction detail, the main story, character fates and twelve records
  proposed.
- **2026-10-10** — Toby's comic painted after the storyboard was approved.
- **2026-10-10** — Toby's collection built (stage 2): six cards, a comic with
  placeholder art, four of his records implemented. Final art waits for
  approval of the storyboard and his design.
- **2026-10-10** — The five fates approved (Ruth alive at Kell Bridge, Helen
  dead of illness, Dev killed by the Ash Hounds, Mags alive in U-112, Toby
  alive in Calder). PLAN.md's ages line updated to match. Toby's collection
  planned: [toby-collection.md](toby-collection.md).
- **2026-10-10** — This folder written to keep all of the above in the repo.
  One timeline conflict found and resolved here, see
  [characters.md](characters.md), "Helen Lane".
