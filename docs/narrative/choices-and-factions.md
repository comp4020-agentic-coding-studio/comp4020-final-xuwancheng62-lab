# Choices, factions and encounters

Implemented 2026-10-22. This is the first playable branching chapter and six finite encounters, not the whole campaign or an endlessly repeating event generator.

## Entry and presentation

Journal provides a button linking to `/story`; the Shelter homepage has no story banner. Illustrated pages use short prose and large choice cards. Main chapter scenes turn one page at a time. Players see immediate resource costs and known relationship changes before choosing; outcome prose appears only afterward. Decisions can wait indefinitely, are saved per shelter and are listed in history and Activity. No offline expiry or countdown.

Twelve opaque scene illustrations (built-in imagegen, one image per scene) and three hand-authored SVG emblems live in `static/img/story-events/`. The prompt/provenance manifest is `choice-art.json`. Existing Ruth reference artwork guided her corrected appearance; no new named character portraits were added. This workflow supports image references, unlike the older course service discussed in the visual bible. Raster illustrations are compressed WebP; text is HTML.

## The Old Works

Existing evidence gates remain: own serial plate, Dev's toolbag and chained valve, Wade's ledger, Mags's reply. The inherited purifier does not make the player responsible for its prior owners' actions. Existing warning/relief decisions are respected; no previous spend or XP is repeated.

- Warning alone: households evacuate before the Hounds arrive. Kell +1, Hounds −1 after hearing the report. Unlocks a safe-path supply visit: 8 food + 8 water, once.
- Warning plus relief (20 water, 10 scrap): households repair a small communal pump and remain together. Kell +2, Repairers +1 after the report. Unlocks the repair-yard visit: 12 scrap + 8 water, once.

These follow-up visits are lightweight story actions from the chapter page; they do not add new combat destinations to the world map. Neither frees the chained main intake or resolves the bypass conflict. Both preserve the established named characters' fates. Receiving the report is explicit, rather than a real-time delivery timer.

## Factions

Kell Bridge, Independent Repairers, Ash Hounds. Independent by default. Helping someone changes trust without joining them. At +2 trust, the player can explicitly join one faction. Leaving is possible; past choices remain. Trust is bounded from −10 to +10. Rejoining never repeats a first-join relationship penalty or grants repeated supply rewards.

- Kell: mutual aid. Joining costs 2 Hounds trust. First assignment exchanges 6 scrap for 12 water + 6 food.
- Repairers: civilian workshop network associated with Mags's work, not an army under her command. First assignment exchanges 8 water for 12 scrap.
- Hounds: predatory checkpoint organisation; joining costs 3 Kell and 2 Repairer trust. First assignment provisions a checkpoint with 8 water and receives 10 confiscated food + 8 scrap. The source is explicit, not softened into neutral trading.

Each first assignment requires membership and +2 current trust, awards +1 trust once, and is optional. More faction quests can use the same server-owned definition pattern later. There are no hidden combat buffs or new NPC deaths.

## Six encounters

Two empty flasks; A pump on its last breath; The price of passage; Someone's reserve; One more household; A yellow freight tag. Four reusable scene paintings. Each appears at most once per shelter in this release, randomly selected from unvisited encounters. First after one completed solo trip, then another becomes eligible for each additional two completed trips. Only one unresolved encounter may exist; reloads do not reroll it. Opening Shelter, Journal or Story checks eligibility after journey settlement. All decisions are made at home, with no penalty for postponing.

## Persistence and validation

Migration 25 adds narrative state and event rows. Each choice is resolved atomically against the authenticated user's shelter. Costs, rewards and relationships come from server definitions. Insufficient resources and unavailable encounters make no changes. A unique shelter/event key prevents duplicate costs or rewards. Loot can exceed production storage caps, matching existing exploration rewards.

Tests cover both main branches, legacy decision continuity, resource rollback, duplicate submission, allegiance and rejoining, every event choice, pending-event stability, away restrictions, authentication and unavailable-event posts. Migration fixtures are updated to reconstruct their historical schema before upgrading.
