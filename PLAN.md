# Plan

A post-apocalyptic shelter survival game. Each player owns one shelter, keeps
it alive (Food, Water, Power, Scrap), and leaves it to scavenge the wasteland —
and **when nobody's home, your shelter is undefended**. Who you send out and
who you leave behind is the tension; it's what makes other players matter.

- **Stage 1** (crit 8, due 2026-10-07): single-player loop + persistence.
- **Stage 2** (crit 9, due 2026-10-14): survivors, stealing, helping, real-time.

## Stack

Node 24 running TypeScript directly (type stripping), Hono for HTTP,
server-rendered HTML with forms (`hono/html` escapes by default), SQLite via
built-in `node:sqlite` at `/data/game.db` (the Fly volume), `marked` for
`/readme/`. Server-sent events for real-time (Stage 2). One Fly machine,
256 MB, sleeps when idle.

**Nothing ticks on the server.** The machine sleeps, so every time-based value
(resources, crops, journeys) is computed from stored timestamps on read.

## Layout

```
src/
  server.ts      routes, auth middleware
  db.ts          open DB, numbered migrations (PRAGMA user_version)
  auth.ts        scrypt passwords, session tokens
  views.ts       layout + pages
  game/
    config.ts    every tunable number
    resources.ts settle(shelter, now)
    world.ts     destinations, journeyPhase(), resolveJourney()
    rng.ts       seeded RNG
```

Game logic in `src/game/` is pure: it takes `now` and returns new state; no DB
or HTTP.

## Pages

Nav: **Shelter · World · Activity**, plus a header badge with the character's
state (At Shelter / Traveling / Exploring / Returning) and a countdown.

- `/` — guests: landing + login/register; players: their shelter.
- `/register`, `/login`, `POST /logout`
- `/world` — wasteland destinations + Survivors (other shelters).
- `/shelters/:id` — look into another shelter (read-only, instant).
- `/activity` — current journey + log.

### The shelter scene

The shelter page centres on an SVG cutaway drawn in two plans: two floors
wide, four floors tall on phones, joined by a ladder shaft. The survivor walks,
pauses, inspects equipment and climbs between floors (`static/scene.js`); with
reduced motion they jump instead. Seven items (hatch, generator, purifier,
food shelf, water jugs, scrap bin, quarters) are links that open an inspect
panel, by click or keys 1–7 (Esc closes); without JS the panels open via
`:target`. Selecting an item in your own shelter sends your survivor to it.
The visit page uses the same scene with public information only, showing the
owner's survivor when they're home; yours never appears there.
- `/readme/` — README.md rendered.

## Data model

| table | columns |
|---|---|
| `users` | id, username unique, password_hash, created_at |
| `sessions` | token_hash, user_id, expires_at |
| `shelters` | id, user_id unique, name, food, water, power, scrap, settled_at |
| `journeys` | id, shelter_id, target_kind, target_id, action, departed_at, arrive_at, explore_until, return_at, resolved_at, outcome_json |
| `activity_log` | id, shelter_id, at, kind, message |

One unresolved journey per shelter (partial unique index). Destinations live in
code; `target_kind`/`target_id` lets Stage 2 target a player shelter.

## Auth

Username + password, `crypto.scrypt` with per-user salt. Session = random
token in an `HttpOnly; SameSite=Lax` cookie (`Secure` behind HTTPS); only its
SHA-256 is stored. POST-only mutations + an Origin check. No email. **The
account is what counts as a person.**

## Resources

Rates per hour, settled in 1-minute steps since `settled_at`, capped at 72 h:

- Generator: Scrap → Power. Purifier: Power → Water. Shelter consumes Food and
  Water. If an input runs out, that facility stops. Nothing goes below 0.
- Stage 1 has no death; at zero the UI warns.

## Greenhouse

A floor of its own with three planters. Planting needs you home and power on,
and costs water up front (Mushrooms 2 → +6 Food in 3 min, Potatoes 4 → +14 in
8 min, Beans 6 → +30 in 20 min). Each growing plot draws 4 Water + 2 Power an
hour (power only while there's power), folded into `settle()` so it's exact
across absences. Growth doesn't pause if supplies run out. Harvest needs you
home; deleting only a ripe plot makes a double harvest impossible. `crop_plots`
(shelter_id, slot, crop, planted_at, ready_at), primary key (shelter_id, slot).

## Journeys

A destination has distance and bearing for the map, exploration time, danger and loot. For demo pacing, travel takes zero time: `arrive_at = departed_at` and `return_at = explore_until`. Only exploration and encounters take time; resolving an encounter returns the character immediately. Agility still shortens exploration. Team expeditions likewise start their first room immediately and return at the end of the run. Raids retain their action duration, with no separate travel legs. Existing journeys retain their stored timestamps.


Stage 1 destinations: Abandoned Supermarket (food), Ruined Workshop (scrap),
Dry Reservoir (water), Creature Nest (rich, dangerous). Action: Scavenge.

## Stage 2

### Model changes (migration 2)

- `shelters` + `combat_power` (starts 10; +1 per Creature Nest trip survived,
  cap 30) + `raid_shield_until`.
- `interactions`: id, request_id, actor_user_id, actor_shelter_id,
  target_shelter_id, kind (steal/help), resource, amount, success, chance,
  roll, created_at. `UNIQUE(actor_user_id, request_id)`.
- `buffs`: shelter_id, kind (`reinforced`), from_user_id, expires_at.
- `activity_log` + related_shelter_id, interaction_id; one row per player,
  written from their side.

### Flow

World gains a **Survivors** list. Opening a shelter (`/shelters/:id`) is
instant and does nothing to your character. **Attempt Steal** (choose Food,
Water, Scrap or a ready crop) is resolved by the server and puts the attacker
into a ~60 s **Raiding** journey (`target_kind='shelter'`), so their own shelter
is defended meanwhile only by whoever else is home. **Reinforce** (help) is instant and doesn't take you
away (allowed even while you're out): +5 defence for 30 min, max 3 stacked.
Stealing crops waits until crops exist.

### Visibility

Public: username, shelter level, owner At Shelter / Away, security band
(Low/Medium/High), resource bands (Plenty/Some/Scarce/Empty; until stealing
exists they're measured from zero), generator/purifier running, crops ready
yes/no, shielded/reinforced. Private: exact numbers,
rates, journey details, log. One whitelisting serializer builds every public
view.

### Raid and Reinforce

Raid dispatches one available owned character with their current equipment,
HP, ammunition and belt supplies. Mustering characters cannot raid or defend;
characters on journeys cannot be dispatched again. The door is attacked first,
using the shared combat equipment rules, with a three-round breach window and
2 armour per door tier. If it holds, the raid ends. If breached, all available
residents and the visiting reinforcement fight automatically with their real
loadouts. Workers also fight; their half-value security estimate is not a
combat damage penalty. Attackers attempt withdrawal below 30% HP after healing,
with one escape attempt. A round-limit stalemate repels the raid.

Victory takes min(15, stock above the protected floor of 20, free carrying
capacity) of the chosen food/water/scrap resource. Defeat takes nothing. Both
sides keep all equipment, retain actual ammunition/consumable expenditure and
recover from being downed at 1 HP. Raiding takes the attacker away for a minute.
Every attempt, including a door holding, grants five minutes of target protection.
No XP is farmed from PvP. Door damage is actual combat damage, not fixed wear.

Reinforce posts one available character at another shelter until the owner
recalls or the host dismisses them. One visiting defender per target, enforced
by a database constraint. A persistent shelter journey locks equipment,
production, exploration and party dispatch while posted; there is no background
timer or automatic expiry. The sender still pays normal resident upkeep.
Returning settles both shelters first, so no production or healing is backdated.
The character's home loses their defence. A sender cannot raid a shelter where
their own reinforcement is posted. Legacy timed reinforcement buffs are retired.

Both sides and the reinforcing owner receive activity notifications. Detailed
raid reports persist and are visible only to participating owners, linked from
Activity. They show the door phase, defenders, combat rounds, HP, shots and haul.
Character gear and supplies remain privately owned throughout a posting.

### Concurrency and validation

Each interaction runs in one synchronous `BEGIN IMMEDIATE` transaction:
settle both shelters → checks → conditional update → interaction row → two log
rows → commit → publish events.

- Simultaneous steals: `UPDATE … WHERE stock - :n >= 20` must change exactly 1
  row, and the raid shield blocks the second raider.
- Over-asking: the client never sends an amount.
- Repeats: form `request_id` + unique index returns the stored result.
- Cooldowns: 2 min per attacker, 10 min per attacker→target. Reinforcements
  occupy the target slot until returned rather than using a help cooldown.
- Self-steal → 400. Selected character away or preparing a party → 409.
- Allowed-list for inputs, Origin check, server-side randomness with stored
  seed and detailed report.

### Real-time

`GET /events` (SSE, session required) subscribes to `user:<id>`, `world`, and
`shelter:<id>:public` while visiting. In-memory pub/sub (one machine).
Publish after commit only. Event types: `resources`, `activity`, `alert`,
`status`. The browser interpolates resources from rates between events; on
reconnect it refetches `/api/state`. Heartbeat every 25 s.

Crit 9 decision record: `docs/decisions/0001-concurrent-raids.md` (first raid
wins and a guard goes up, vs queueing, sharing one haul, or no guard).

## Character, gear and the beast

Approved 2026-10-07 as a gameplay expansion (see Revision history). Status:
**being implemented**; the README's "Where this version stands" says what is
live.

Loop: prepare at the shelter → equip → depart → explore → meet the beast →
fight or try to escape → return → rewards, losses and experience settle →
rest. Since 2026-10-11 every person in the shelter is a character (see
"Your people" below); `combat_power` became each character's `combat`.

### Character

One row per person, in `characters` (migration 6, re-keyed in migration 10):
id, shelter_id, who (`you`, `toby`), combat, task, level, xp, unspent
points, strength, agility, max_hp, hp (REAL), hp_at, meal_at;
`UNIQUE(shelter_id, who)`. Everything below applies to each person.

- **Max HP comes from attributes only** (since 2026-10-12): 60 + 5 ×
  Constitution + 2 × Strength, plus what's worn. Levels add none of their
  own. A new survivor has Strength 5, Agility 5, Constitution 6: 100 HP.
  Gear and training raise the maximum, never current HP; resting fills it.
- **Constitution** (starts 6): +5 max HP a point. Its second role, for when
  poison or bleeding exist (none do yet): it shortens them by a tick per 4
  points, never below one tick, and never softens a direct hit, so it
  doesn't stack with armour. All starting values to test.
- Zero HP is defeat and a wounded return, never death.
- **Strength** (starts 5): damage = weapon roll + Strength; carrying capacity
  = 20 + 4 × Strength (+15 with the backpack); +2 max HP a point.
- **Agility** (starts 5) shortens only the exploring leg:
  `explore = max(base × 0.5, base / (1 + 0.05 × agility))`, then the usual
  `TIME_SCALE`. Travel each way is unchanged. All of a journey's timestamps
  are written at departure; later changes to gear or attributes never move an
  active journey. Agility doesn't touch escape or combat in this version.
- **Experience**, awarded once, inside the transaction that resolves the trip
  or the fight: a trip home from Supermarket or Reservoir 8, Workshop 10, Nest
  12; beating the beast +25; escaping it +8; defeat 0. The next level needs
  40 × current level (L2 at 40, L3 at 120, L4 at 240 …), up to level 20. Each
  level gives one point, spent at the shelter on +1 Strength, +1 Agility or
  +1 Constitution. Safe trips alone level you, so fighting is never the only way up.

### Gear

`items` (character_id, kind, equipped, created_at), `UNIQUE(character_id, kind)`:
each person owns at most one of each kind, so an item is in exactly one place,
equipped (carried) or stored (at the shelter). Supplies found on a trip are a
third place, `encounters.carried_json`, until they're deposited at home.

| Item | Slot | Effect |
|---|---|---|
| Crowbar | weapon | 6–10 damage (unarmed 2–5) |
| Spear | weapon | 10–15 damage |
| Reinforced jacket | armour | −4 damage from each bite (never below 1) |
| Backpack | tool | +15 carrying capacity |

Everyone starts with a Crowbar equipped (existing players get one in the
migration). Equip and unequip only while home, with no journey. Equipping
into a filled slot sends the old item to storage. Where gear comes from:

- the **Ruined Workshop** (no fighting) salvages the Crowbar if you own no
  weapon, otherwise the Backpack if you don't own one: the way back to basic
  gear after a defeat, without any risk;
- **beating the beast** gives the Spear if you don't own one, otherwise the
  Jacket if you don't.

Carrying capacity caps what any trip brings home; anything over it is left
behind (food first, then water, scrap, power), and the log says so.

### Your people

Everyone who lives in the shelter is managed like your survivor: their own
HP, stats, XP, level, gear and trips (`journeys.character_id`, one open trip
per person, so everyone can be out at once). Records found go to the
shelter's shared journal; supplies to its shared stock; quest and collection
XP to you.

- **At home** each resident is on **guard** (counts fully toward defence) or
  **work** (their speciality, counting half toward defence). You always
  guard while home. When nobody's home, nobody defends.
- **Gear** moves between people with "Give": both home, the item in storage,
  the receiver not already owning one.
- **Toby** (`RESIDENTS.toby`): Strength 4, Agility 7, 80 max HP, combat 6, a
  Crowbar. On work he re-packs the purifier, +4 water/h while it runs. He
  eats 1 food/h either way. At the Nest the dogs know him: 80% to escape.
- Each person's trip and fight has its own card on the Activity page
  (`#fight-<who>` for residents); every form carries a hidden `who`.

### The scavenger beast

One creature, at the Creature Nest: 55 HP, bite 8–15. It's met halfway
through exploring (`encounter_at`, written at departure). Before that, the
World card and the trip page warn of it, and the Nest card says, before you
leave: "Defeat means losing all equipped gear and supplies collected on this
trip." Travelling anywhere needs 20 HP.

By the time it appears you've collected the Nest's supplies (rolled from its
loot table, seeded by the journey, capped by capacity). The beast's hoard is
food 6–12 and scrap 4–8, on top, if you win. New trips use the automatic combat outcome instead of the abstract danger roll. Older pending trips retain their original rules.

### Legacy journey and encounter states

The following manual-turn rules apply only to journeys already pending before
the automatic-solo update. All new solo trips use **Automatic solo exploration**
below, with default retreat under 30% HP and no action buttons.

```
outbound ─arrive_at→ exploring ─encounter_at→ awaiting decision
awaiting ─attack→ combat ─attack…→ won | defeated
awaiting ─escape→ escaped | combat (escape failed; locked)
won | escaped | defeated → returning ─return_at→ home (deposit, xp)
```

- Phase is still read from timestamps, but while the encounter is unresolved
  and `now ≥ encounter_at`, the phase is **encounter** and nothing advances:
  no timer finishes it, the beast never acts without a player action, the
  person stays away (and doesn't guard), and resources settle as
  usual. A page load, a logout or a restart shows the same state.
- Resolving rewrites the journey's remaining timestamps: exploring ends now,
  `return_at = now + travel`. Winning ends the search too, since the hoard was
  the prize.
- A turn: the player's attack (weapon roll + Strength) lands; if the beast
  survives it bites back (roll − armour, at least 1). HP ≤ 0 on either side
  ends the fight.
- **Escape**: once per encounter, before or during a fight, 50% (Toby 80%),
  shown as a percentage. Before trying, the page says: "Escape success preserves your gear and
  half your collected supplies. Failure locks you into combat." Failure costs
  no HP, locks escape for good, and is logged.

| Outcome | Gear | Supplies collected | Hoard | XP |
|---|---|---|---|---|
| Won | kept | kept | added, + Spear/Jacket | 12 + 25 |
| Escaped | kept | half of each, rounded down | none | 12 + 8 |
| Defeated | **all equipped items lost** | all lost | none | 0 |

Stored items and shelter stock are never touched. Supplies reach the shelter
only when the return journey arrives. A defeat sets HP to 0 and the journey
is a wounded return: no fighting or exploring until home.

### Recovery

At home (no journey), HP recovers 1 per 20 s (÷ `TIME_SCALE`), from server
timestamps, so 0 → 20 takes about 7 minutes and full health about 33. A meal
(4 Food + 4 Water) restores 25 HP, at most once every 5 minutes, enforced by a
conditional update on `meal_at`. Nothing else heals.

### Authority and idempotency

New solo combat uses the existing seeded resolver. Its departure snapshot is
stored privately in `journeys.outcome_json`; the return transaction applies HP,
spent supplies and rewards once and marks the journey resolved. It needs no
schema migration. Legacy manual fights retain the checks below.

Every action is one `BEGIN IMMEDIATE` transaction. Rolls use
`crypto.randomInt` and are stored in `encounter_turns` (encounter_id, n,
request_id, action, rolls, damage both ways, HP after, outcome) with
`UNIQUE(encounter_id, n)` and `UNIQUE(encounter_id, request_id)`. Each
combat form carries the turn number it was drawn at: a replayed request id
returns the stored result, and a stale turn number is refused (409), so
double clicks and two tabs can't land two blows. Escape sets `escape_used`
with a conditional update, so it can't be rolled twice. Level-up points are
spent with `WHERE unspent > 0`. The client never sends damage, loot, odds or
experience.

### Testing

The fight is reached minutes into a trip, which CI can't wait for over HTTP.
So: the rules are pure functions in `src/game/` tested directly
(`spec/character-rules.test.ts`); the timed flow is driven through the same
transaction functions the routes use, against a throwaway database at chosen
times with forced rolls (`spec/encounter.test.ts`); gear, recovery and the
warnings are tested over HTTP (`spec/gear.test.ts`).

## Records in the wasteland (narrative slice)

Approved 2026-10-09 (see Revision history). Scope: **eight records about two
people, Ruth Lane and Toby Wren, at the Abandoned Supermarket and the Dry
Reservoir**. Not in scope: the other three people's stories, records at the
Workshop, the Nest or the player's own shelter, new destinations, new art,
restitution or any other new system. Crit 9's multiplayer requirements and
its decision record come first; this slice is optional polish after them.

### Canon (for the writer)

Full story bible, with proposals kept apart from canon:
[docs/narrative/README.md](docs/narrative/README.md).

Revised 2026-10-09: the collapse is a **nuclear war**, not a drought or the
Loop. Calder Valley wasn't struck; it lay downwind of nearby strikes.

- **Setting.** Fictional Calder Valley, inland south-eastern Australia. The
  war day is Tuesday 9 March, Y0 (early autumn), "the Ninth". It is now
  autumn, Y+5. Ages then → now: Ruth 61 → 66, Mags 72 → 77, Toby 11 →
  about 16. Helen (38 on the Ninth) died of pneumonia at Northfield in Y+3;
  Dev (34) was killed by the Ash Hounds on 18 May, Y+4. Their fates and the
  others' are in docs/narrative/characters.md. The warring powers are never named.
- **The strikes (writer's knowledge).** About 04:10 on the Ninth: Kestrel
  Range, a communications station 90 km north-west, and Port Sallow, a port
  and refinery 190 km west. A fallout plume crossed Calder about 15:30.
  **What survivors could confirm** was less: alert tones at 03:40, a glow to
  the north-west, the power failing, conflicting broadcasts, dust that
  afternoon. Names of targets reach them only as rumour; neither place is a
  destination.
- **Before.** The federal Civil Resilience Scheme (from Y-6) subsidised
  household **Resilience Units** for owners with a suitable block; renters,
  flats and the caravan park were allocated Community Shelter Points
  (CS-1 to CS-6, about a quarter of the town; CS-4 is FreshWay's basement car
  park). Two years of standoff made war background noise: school siren
  drills, then purchase limits weeks before.
- **The Ninth.** State and federal instructions conflicted; the council
  sealed Units, sent others to shelter points or buses to the Northfield
  Reception Centre. Supply Direction ESD-31 sent store stock to Northfield;
  Ruth sent 11 of 22 pallets and kept 11 for CS-4. Bus 2 left at 09:00; Bus 3
  (13:00) never came: the Kell Bridge checkpoint closed and the plume
  forecast moved earlier.
- **After.** CS-4 sat tight two weeks on water Dev trucked from the deep
  bore. The refinery was gone, so fuel ran out regionally; coordination
  broke into towns guarding their water (Northfield's showground, Kell
  Bridge's weir). Trade moves on foot along roads and the old works main;
  nothing moves in bulk, and a fuel-less valley isn't worth a convoy.
- **Radiation (narrative only, no mechanics).** Exposure (being near it)
  differs from contamination (carried on dust, clothes, water, food,
  objects). The worst passed in weeks; five years on, danger gathers where
  dust and water collect: silt, drains, sumps, spent cartridges, the depot's
  heaps. Boiling or an ordinary filter does not remove it. A Unit purifier
  settles, prefilters, then binds contaminants in a sorbent stack of RC-40
  cartridges (fictional), which saturate and must be re-packed. Sealed
  pre-war food is clean inside; planters work with bagged mix, treated
  water and lamps. Meters are rare; records say "above the line", not
  numbers.
- **The Loop** was the council's waste-cart, compost and Unit-servicing
  programme. Background only: it caused nothing. Its depot under the bypass
  is the Creature Nest.
- **Player shelters are former Resilience Units**, inherited or claimed.
  Later evidence may show the purifier's sorbent stack came from the
  Patels' Unit (U-118) by way of Mags: the serial is provenance; consent,
  abandonment and necessity stay claims. The player did nothing wrong. Not
  in this slice; no restitution quest.
- **Creatures.** The beasts are a **feral dog pack descended from the depot
  dogs**, some of them "fallout-born": an openly fictional change that
  appears only over generations of feeding at hot places (larger, patchy
  hide, heavy jaw, fiercely territorial). They den and hoard in the
  underpass and answer the old cart chime. One animal meets you per trip.
  No record says any one animal is Toby's. Art should move toward a
  recognisable dog; the current picture doesn't set lore.
- **Records survive** because they were stored indoors or made to last
  (cardboard behind a till screen, a fax in a lever-arch file, a cupboard
  door, a steel locker, a carbon-copy binder, laminated school work in a
  windowless room, a desk drawer, a taped biscuit tin). Recent traces must
  have a known cause in these notes.

### Records, leads and the journal

Each destination has records. A record is either **open** (found by looking
around, in a fixed order per place) or **behind a lead**. A record can unlock
leads; a lead points to exactly one record and can be unlocked by more than
one record.

| Place | Open, in order | Behind a lead |
|---|---|---|
| Abandoned Supermarket | ration sign, store instruction, cart dogs drawing | Kerry's locker (from the ration sign); the passenger lists (from the locker or the radio log) |
| Dry Reservoir | school worksheet, radio log | the station office (from the passenger list or the radio log) |

- **What to look for** is an optional choice on each destination card: one
  of your unfollowed leads there, or *Look around*. It changes only which
  record you find, never supplies, danger, timing or the beast. The default
  is the newest unfollowed lead there, else *Look around*; a form without
  the field (the map popups) gets the same default.
- *Look around* finds the next open record; with none left, the oldest
  unfollowed lead there; with neither, nothing.
- The record is picked at departure, stored on the journey and never
  re-rolled. It's recorded when exploring begins, so the danger roll, the
  beast, defeat and escape can't take it away. One copy per shelter, private.
- Each destination card says one of: *Leads here: …*, *Corners you haven't
  searched.*, *Nothing more you know to look for here.*, *You've read
  everything here.* None names a record you haven't found.
- The journal (`/journal`) keeps, separately: what you see, what the record
  says and who signed it; leads; people and places exactly as written;
  connections, shown only when both records are found and worded as
  matching facts; and open questions, which list related records and are
  never marked answered. It never states an interpretation.

Data: migration 7 adds `journeys.fragment_id`, `journeys.focus` and
`discoveries (shelter_id, fragment_id, journey_id, found_at)`, unique per
shelter and record. Rules are pure functions in `src/game/stories.ts`.
Tests: pure rules (orders, defaults, leads, statuses, reachability) and the
timed flow on a throwaway database (`spec/stories.test.ts`), and the form,
journal and privacy over HTTP.

## Story collections

Approved 2026-10-10, starting with Toby only. Design, card texts and the comic
storyboard: docs/narrative/toby-collection.md.

- A set of cards, each unlocked by finding **any** of its records. Cards are
  read from the journal's `discoveries`; there is no second progress store,
  so old players are backfilled, order doesn't matter, and defeat or escape
  can't take a card. Cards aren't inventory.
- Toby's set has six cards (childhood, the Ninth, Northfield, apprentice,
  Dev's fate, now). Cards 1–2 use existing records; four Toby records are
  added at existing destinations under the existing rules: `chalk-warning`
  (Supermarket, look around 4th), `chime-camp` (Nest entrance, recorded on
  arrival before the beast), `dev-toolbag` and `chained-valve` (Dry
  Reservoir, by two new leads: the old works gallery, from `day-140` or
  `chime-camp`; the valve, from `dev-toolbag`).
- `/collection` shows progress, found cards and numbered backs; a back shows
  no title, place or hint. A found card is the **object or trace the player
  found** (revision 3, proposed): a concrete title, where it was, its words as
  written, and its own picture (never a comic panel), with no interpretation.
  The set is "Someone in the records" before its first card, "Signed T."
  until it's complete, and "Toby Wren" after; every card's object appears in
  a comic scene.
- Completing a set unlocks its comic (`/collection/:set/comic`, 403 until
  then) and pays `COLLECTION_XP` once. Migration 8's `collection_rewards`
  (primary key shelter and set) is the claim, so it can't pay twice.
- Completing a set also earns **that story's own Legendary** (approved
  2026-10-21; per-story pieces 2026-10-21). Each set has one in
  `STORY_LEGENDARIES`, with a fixed kind, two existing traits and a line of
  history, never dropped anywhere else, and stronger than a dropped
  Legendary: three traits instead of two, three rolled bonuses instead of
  two (`STORY_LEGENDARY`): Toby, Gerald's Chime (head torch,
  Lucky + Keen-eyed + Deep pockets); Ruth, the Eleven-Pallet Pack (hiking pack, Deep
  pockets + Keen-eyed + Lucky); Mags, Mags's Big Spanner (crowbar, Brutal + Hushed + Serrated);
  Dev, D.P. Overalls (reinforced jacket, Sturdy + Sealed + Padded); Helen, Liaison's
  Webbing (webbing, Deep pockets + Lucky + Bright). Its bonuses are rolled from a seed
  of the shelter and the set, at your player level when the set completes
  (stored as `gear_level` on the claim, so waiting to level up doesn't
  improve it). No new art: each uses its kind's existing icon.
- **It is claimed at the end of the comic** (approved 2026-10-21). Finishing
  the set pays the XP and Credits as before and leaves the Legendary waiting;
  the comic's last page shows it glowing gold with an **Accept** button, a
  plain form (`POST /collection/:set/claim`). Accepting puts it in the stash
  in one `tx()`: the claim row's `gear_item_id` is set only while empty, so a
  repeated or forged post gives nothing more, and an unfinished set is
  refused. With JavaScript the reward opens as an overlay; without it, it is
  a section of the last page. The collection page says when one is waiting.
  Sets that already gave their Legendary are untouched; a set claimed before
  that never got one waits at the end of its comic too, at the player's level
  when migration 23 runs.
- **After accepting, the next page is a lead** (`/collection/:set/next`):
  one line about that person and a button to where to go. For a person with
  a quest it points at that quest's current step (Toby: The Last Reply; Mags:
  Empty Is Empty; Helen: Undelivered). Ruth and Dev have none yet, so theirs
  point at the Workshop and the Reservoir. It only reads your own progress.
- The comic is read a page at a time at `/collection/:set/comic?page=N`:
  each page is a plain URL with Previous and Next links, so it reads without
  JavaScript; `static/comic.js` adds arrow keys, swipes and a per-browser
  bookmark ("Carry on from page N"). **Each page is one picture**, with its
  words as HTML, not painted in. Each speech balloon is placed by eye for
  its picture (`Panel.balloons`): near its speaker, clear of every face and
  must-see detail (`Panel.faces`), standing out past the picture's edge when
  that keeps it close, with a tail to the speaker's head (`Panel.heads`) or
  to where the voice comes from (a radio). Narration is a caption box above
  or below the picture; a caption between two speeches is placed like a
  balloon so the page reads in script order. `spec/collection.test.ts`
  checks that no balloon covers a marked face or another balloon, and that
  balloons read left to right, top to bottom. Wide screens size everything
  in container units, so the layout is computed on the server
  (`src/comicLayout.ts`); phones stack the same boxes above and below the
  picture, each lined up over its speaker.
  Speakers are also named for screen readers. The script still groups panels into
  beats (pair, tall), but the reader doesn't. Revision 2 tells Toby's
  approved story in 14 panels (docs/narrative/toby-comic-script.md), all
  painted; each card's object appears in one of them.
- **Ruth's set** (2026-10-10): seven cards, "Same for Everyone" until
  complete, comic "Eleven Pallets" (12 panels, 7 pages, +50 XP once). Five
  of its records already existed; two are new: `cs4-board` (Supermarket
  basement, by a new lead "The basement" from `store-instruction` or
  `day-140`) and `exchange-chit` (Workshop, look around 2nd). A record can
  fill a card in more than one set (`bus-2` is in both); every set needs at
  least two records of its own. Art: the passenger-list card and Toby's
  panels 4 and 7 are reused; the rest is painted.
- **Mags's set** (2026-10-10): seven cards, "Empty Is Empty" until
  complete, comic "Forty Households" (12 panels, 7 pages, all painted).
  Seven new records: `tagged-door`, `mags-dropboard`, `ferris-docket`
  (Workshop, look around 3rd to 5th), `mags-jobbook` (lead "Under the
  bench"), `patels-keys` (lead "The key board"), `mags-bore-tag`
  (Reservoir, lead "The bore motor"), and `unit-plate`, the serial plate on
  the player's own purifier. Dev's run sheet `pump-log` is built as the bore
  house's record (lead "The bore house", from `radio-log`, `day-140` or
  Mags's job book).
- **Records found at home**: a record whose place is `home` is found by an
  action in the shelter, not on a trip. The only one is `unit-plate`, from
  **Inspect purifier** in the purifier's panel (POST `/purifier/inspect`, a
  plain form, refused while you're out). It shows where the stack came
  from, not whether anyone agreed. It and `ferris-docket` are either-or
  evidence on the same card, so either fills it. The discovery's unique key
  and `collection_rewards` mean a second inspection, or the docket later,
  adds nothing and pays nothing.
- **Dev's set** (2026-10-10): six cards, "Quarter Turn" until complete,
  comic "On Trust" (14 panels, 8 pages). Two new records: `dev-loop-roster`
  (Nest, lead "The depot office") and `dev-repack-card` (Workshop, lead
  "The re-pack bench"); the rest are shared with Toby's and Ruth's sets.
- **Helen's set** (2026-10-10): seven cards, "Procedure" until complete,
  comic "Twelve Forty". `council-bulletin` and `siren-talk` are at the Dry
  Reservoir by leads. `convoy-manifest` and `helen-letter` lie at the Ridge
  Road and the Weighbridge, listed in `NOT_YET_REACHABLE`: no trip goes
  there, their cards' backs say "Somewhere you can't reach yet", and the set
  and its comic (which tells of her death) can't open until those places are
  built.
- **Art for Dev and Helen**: 31 images painted by the owner from
  docs/narrative/art-requests.md (prompts in
  `scripts/generate-dev-helen-art.ts`), in `static/img/cards/{dev,helen}/`
  and `static/img/comic/{dev,helen}/`.
- **Restoring contact** (2026-10-10): Toby's story task, four records in a
  chain of leads at the Workshop's tins, now the start of The Last Reply
  (below).
- Toby's letter (`toby-letter`, Workshop, look around 1st) is a seventh card.
  A player who finished the six-card set keeps the comic open and isn't paid
  again: the reward row is the record that they finished.
- Characters' looks for every comic: docs/narrative/visual-bible.md. The
  course image service drops reference images, so consistency comes from
  one sheet per person, fixed descriptions (`scripts/visual-bible.ts`),
  compositing cut-out figures, and checking every panel.

## Quests

A quest is a named run of steps (`src/game/quests.ts`). Most steps are done
by records found; a step that isn't (asking someone to stay) is a **mark**
in `quest_marks`, whose insert also claims the quest's one-time XP. Progress
is a pure function of `{found, marks}`, so it's the same on every load and
nothing about it is stored twice. The Journal opens with **Tasks**: each
step done, to do (with where to go), or waiting on the steps before it.

**Room for shared quests.** A quest has a `scope`, only `"shelter"` for now,
and a mark's owner is `shelter:<id>`. A party quest later is the same rules
over a merged state (the members' records, the party's marks, owner
`party:<id>`); no party code exists yet.

**The Last Reply** (Toby joins your shelter; docs/narrative/toby-collection.md):

| # | Step | Done when |
|---|---|---|
| 1 | Signed T. | every card of Toby's set (counted, 7) |
| 2 | Word for T | `toby-answer` (the Workshop's forwarding tin) |
| 3 | Hold for him | `ruth-parcel`: Kerry's three letters, which you now keep |
| 4 | The underpass | `last-reply`, at the Nest; its lead opens only with steps 1 and 3 done. That trip has **no beast**: Toby calls the dogs off |
| 5 | Dev's autumn job | `intake-screens`, at the Reservoir; following the lead **takes 10 scrap** when you leave (409 if short; looking around skips it) |
| 6 | A bench here | "Ask Toby to stay", at home: he joins, +40 XP once |

- **Toby as a resident**: a full character (see "Your people"), drawn as a
  second figure in his cut-down vest while he's home. He keeps away from the
  hatch and isn't shown to visitors (he's hiding from the Ash Hounds); the
  public view only says whether someone's keeping watch.
- He stays **until the road north is safe**; his promise to go to his mum
  stands, for the main story to keep.
- `toby-thanks` (the bus shelter chalk) now follows the meeting: his thanks
  to Ruth, for the Kell walkers to carry.

**Empty Is Empty** (Mags joins your shelter; approved 2026-10-21, story
revised the same day to carry the ledger; docs/narrative/mags.md):

| # | Step | Done when |
|---|---|---|
| 1 | Household forty-one | every card of Mags's set (counted, 7) |
| 2 | Week 17 | `wade-ledger`, in the Weighbridge scale-house office: the destination `scale-house`, opened by the lead "The scale-house office" from `helen-letter`. Found only after winning against the gate watch (two raiders and a sentry) and coming home, like Undelivered's records. One completed investigation, never repeatable, no gear |
| 3 | A note on the board | `mags-reply`, at the Workshop, by the lead "Warn M.H." (opens from `mags-dropboard` once her set and the ledger are both found); her pencilled answer under yours |
| 4 | A key here | "Ask Mags to stay", at home: she joins, +40 XP and the quest Credits once |

- Reading the ledger doesn't defeat anyone: the east-side run stays planned.

- **Mags as a resident** (`RESIDENTS.mags`): Strength 6, Agility 3,
  Constitution 4 (92 max HP), combat 5, a Crowbar. A lifetime of motors and
  spanners, 77, slow on her feet, and the cough. She fights and travels like
  anyone; low Agility means a longer exploring leg and a worse chance to act
  first. She eats 1 food/h.
- **Her work: cheaper building.** While she's home on **work**, upgrades and
  door repairs cost `MAGS.buildDiscount` (25%) less scrap, rounded down
  per cost, never below 1. Water and materials are unchanged. The discount is
  read inside the same `tx()` as the charge, so it can't be claimed by a form.
- Each resident's work is data on `RESIDENTS` (`work.purifierWater`,
  `work.buildDiscount`), so a third resident needs no new branches in the
  shelter view or the rates.
- **Recruits join near your level** (approved 2026-10-21): someone who moves
  in starts at your player level minus `RECRUIT.levelGap` (2), never below 1,
  with no XP toward the next. Each level above 1 is one unspent point for you
  to train, so their starting stats keep their character and you choose the
  rest. After that they earn their own XP; they don't follow your level.
  Residents who joined earlier are raised once, on the next load, to the
  same rule from the level you are then (migration 22 marks the shelter).
- She's drawn as her own figure in the shelter while home, and like Toby
  isn't shown to visitors.

## Expeditions, parties and items

Approved 2026-10-12 (see Revision history). Status: **implemented on `main`**. The README says what it supports.

### The loop

1. **Prepare at home.** Equip people from the shelter's stash, fill each
   belt with consumables and each pack with ammunition. Solo trips are where
   items, levels and dungeon leads come from.
2. **Recruit in world chat.** A recruit card shows the dungeon, the size
   (2–4 players), the seats filled, requirements and a readiness band
   (Likely / Risky / Grim, from about 200 simulated runs; never a number).
3. **Join with one character each**: your survivor or any resident (Toby
   included, like anyone). Friends can add each other's **designated
   character** while its owner is offline.
4. **Full parties depart automatically.**
5. **The run is automatic**: exploration, sneaking, fights, item and ammo
   use. It is simulated at departure from a stored seed and revealed by
   timestamps; the first participant to load after it ends settles everyone,
   once, in one `tx()`. No background timer.
6. **Success:** equipment is dealt at random but evenly between players
   (round-robin from a random start); other loot is split equally between
   players, remainders at random; every participant gets the team quest
   reward. **Wipe:** everyone loses the equipment and supplies they carried
   and all expedition loot, and comes home wounded at 0 HP. Nobody dies;
   stashes at home are never touched.

### Parties, friends and dispatch

- One character per player. Joining locks that character with an active `party_seats` row, preventing
  another activity (a solo trip, another party, or a dispatch). While
  mustering they still count as home and can guard, but can't leave or
  change gear. No Food or Water is charged. A party that does not fill before its
  configured expiry releases its characters.
- **Friends** are mutual (request, accept). Each player has dispatch
  settings: the designated character (default: your survivor; any resident,
  or off), a **risk limit** (the worst readiness band they may be sent into)
  and a preferred row. A friend sends an invitation with an eight-second
  server deadline (`SOCIAL.inviteMs`): accept immediately, decline before the deadline, or
  automatically accept after it, including offline. Acceptance rechecks
  friendship, current dispatch settings, availability, capacity and risk.
  Pending invites do not occupy seats. Only recipients may answer, and
  repeated requests cannot duplicate invitations or seats. One pending
  invitation per recipient; same sender/recipient has a ten-second cooldown.
  Expired deadlines resolve using the stored deadline on the next authenticated
  request (including elapsed travel); open pages count down locally and ask
  the server again when a deadline passes. There is no server background timer. The Shelter page
  says who dispatched whom.

**As built (step 3):**
- The run and every seat's share are decided at departure, from the
  party's seed. Each seat is then a `journeys` row (`target_kind 'party'`)
  that its own shelter settles the next time it loads: health, what's left
  on belt and pack, a wipe's losses, the share, experience, the quest mark
  and CS-4's last log. Nothing writes to another player's shelter when the
  party comes home.
- Expeditions require no Food or Water. Migration 16 refunds existing
  mustering reservations once, zeroes their seat amounts, and preserves
  already-departed expeditions. Legacy dispatch reserve fields are ignored.
- The band is recomputed whenever a seat changes. A dispatched seat whose
  owner's risk limit the final band breaks is released at departure, and the
  party keeps gathering.
- Calling and joining the Lower Deck need no prior clue. A leader who
  leaves calls the party off. Each round of a fight is told as one line,
  with falls, heals and flares on their own.
- Expedition times follow `TIME_SCALE` like every other trip.

### Combat (one resolver for solo and party)

- Today's numbers: damage = weapon roll + Strength (melee) or + full
  Agility (ranged), minus armour (at least 1). Solo exploration and party fights both resolve automatically.
- **Rows**, per character: melee hits only from the Front (reach weapons
  from either); ranged from either. Enemies bite the Front; sprays hit the
  whole Front; swarms hit anyone.
- **Initiative** = Agility − armour penalties + weapon speed.
- **Ammo** is used one per shot and carried in the pack, using capacity
  loot would fill. A gun out of ammo is swung as a club (2–5).
- **Noise** from loud weapons builds up in a room: past a threshold another
  wave joins, and escape gets harder.
- **Escape can fail**, as solo. The party's approach is *Sneak past optional
  encounters* or *Fight everything*. Required encounters can't be sneaked
  past, but the party may still try to **escape** them under the same rule:
  success means turning back (gear kept, loot halved, no quest reward);
  failure forces the fight, the enemy strikes first, and escape is locked
  for that encounter. The leader's "turn back if…" rule is the same roll.
  Chance: 50% + 5% per point of the party's lowest Agility above 5 − armour
  penalties − noise + smoke + traits.
- **A stalemate is a retreat too, not a free pass.** A fight capped at 40
  rounds (neither side wins) forces the same escape roll as a voluntary
  retreat; failing it is a wipe, the same as any other failed escape.
- Automatic item use: bandage or first-aid at 35% HP or below, flare
  against animals, smoke when escaping, Molotov against three or more.
- A character at 0 HP is carried and comes home wounded.
- The fight log says why: who took the bites, what was used, why something
  stood down.
- Any blow, either side, has a 10% chance to land double, so a run is never
  a foregone conclusion. Only noisy weapons (noise 2+) carry: each point of
  room noise takes half a point off an escape.
- In the stores, each Molotov burns a quarter of the hoard's food, and each
  launcher round wrecks half of everything and a piece of equipment.
- **Balance target** (checked by `spec/expedition.test.ts`): parties of
  fresh characters with crowbars are Grim for the level 11–13 Lower Deck; prepared level-11 survivors with level-10 gear and healing can clear it. A third survivor improves readiness. The all-clear word still bypasses the warden.

### The Lower Deck (CS-4, under FreshWay Calder)

A sealed second basement under CS-4's car-park shelter, shut on Day 15
behind a Council contamination door that still runs its last order, "hold
seal until all-clear". The door is a two-person crank, so it needs a party;
the Day 15 notice at the Supermarket provides optional story context. It stays
clear of the bypass, the chained valve, the Ash Hounds and the Nest's dogs.

| # | Room | Encounter | Preparation |
|---|---|---|---|
| 1 | B1 ramp, the crank door | — | 2+ players. No light: enemies strike first in room 2 |
| 2 | Plant room | Rustshell brood ×5 (18 HP, armour 5, bites 5–8; noise brings 2 more), optional | Piercing and fire; blunt improvised weapons barely scratch them. A resident with purifier skill restarts the stack: + water |
| 3 | Dust room | The warden, a Council decontamination machine (300 HP, armour 8; its spray, 10–15, hits the whole Front each round), required | Sealed armour ignores the spray, a respirator halves it; reach and ranged fight from the Back. Ruth's all-clear word (held by anyone in the party) makes it stand down |
| 4 | Police locker | locked | Bolt cutters or a crowbar: police gear, flares, first aid |
| 5 | The stores | Rat swarm, required: 8 rats (8 HP, bites 4–7) that bite anyone, 4 more on noise | Spread and fire weapons; armour for everyone. A Molotov burns part of the food |

Team quest **Day Fifteen** (`party` scope): clear the Lower Deck. The Day 15
notice is optional story context. Each participant +40 XP; each player's shelter
gets CS-4's last log.

### Items

**Types.** *Equipment* (weapon, armour, tool) is one instance per item with
a level and a quality. *Supplies* (consumables, ammunition, materials) are
stacks of a kind, each kind with a fixed quality. Duplicates are kept, for
trading later. Everything lives in the shelter's **stash**; people equip
from it. The stash displays painted raster cutout item icons with quantities and
quality-coloured frames (grey, green, blue, purple, orange), plus written
quality labels. Clicking a slot expands its description, comparisons and
existing equip/use/pack actions. Equipment instances stay separate; supplies
show their stack count. Native disclosures work with keyboard and without JS.

**Slots per character:** weapon, armour, tool; a **belt** for consumables
(2 units, 4 with webbing); a **pack** for ammunition, which counts against
carrying capacity.

**Level** (1–20) is baseline power and progression. It scales the main
stat (damage +8% per level, armour +6%, capacity +5%) and comes from where
an item is found: Supermarket and Reservoir 1–3, Workshop 2–4, Nest 3–6,
Lower Deck 4–8, later places higher. To equip, a character's level must be
at least the item's level − 2; some heavy kinds also need Strength or
Agility. Characters now level to 20.

**Quality** is rarity, stronger attributes and increasingly distinctive
effects, always written out as well as coloured:

| Quality | Colour | Main stat | Bonuses | Traits |
|---|---|---|---|---|
| Common | grey | ×1.00 | — | — |
| Uncommon | green | ×1.08 | 1 | — |
| Rare | blue | ×1.16 | 1 | 1 |
| Epic | purple | ×1.26 | 2 | 1, at 1.5× strength |
| Legendary | orange | ×1.38 | 2 | a named signature effect + 1 |

*Bonuses* are plain numbers (+Strength, +Agility, +max HP, +damage,
+armour, +capacity), bigger at higher levels. *Traits* change how an item
plays: Serrated, Piercing, Quick, Brutal, Hushed, Lucky (weapons); Padded,
Sealed, Light, Spiked, Sturdy (armour); Deep pockets, Bright, Keen-eyed,
Lucky (tools). Legendaries are named uniques with a fixed signature.
The dropped ones (`LEGENDARIES`, approved 2026-10-21 to grow from two to
six): Gary's Bin Hook (spear, Sweeping), the CS-4 Seal-Suit (hazmat, Last
seal), the Weighbridge Levy Stick (riot baton, **Toll**: +30% stagger at
Legendary strength), Bluey Rake's Pump (shotgun, **Last shell**: the first
shot of each fight costs no ammunition), Nell Ashby's Oilskin (reinforced
jacket, **Second wind**: once a fight, dropping below 30% HP brings back 24%
of max HP), and the Kestrel Range Lamp (head torch, **Dazzle**: animals lose
their first turn of every fight). Each has one ordinary trait besides.

**Origin labels** are separate from quality: Improvised, Civilian, Council,
Police, Military, Experimental. A Common military rifle and a Legendary
improvised spear can both exist.

**Kinds, with their tradeoffs** (numbers at level 1, Common):

| Weapon | Origin | Damage | Character |
|---|---|---|---|
| Wooden stick | Improvised | 3–6 | quick, silent; the fallback |
| Crowbar | Civilian | 6–10 | opens locks |
| Nail bat | Improvised | 7–12 | poor against armour |
| Machete | Civilian | 8–13 | quick; serrated |
| Spear | Improvised | 10–15 | reach |
| Riot baton | Police | 7–11 | may stagger (the enemy loses its next attack) |
| Fire axe | Council | 13–19 | slow; needs Strength 6 |
| Slingshot | Improvised | 4–7 ranged | silent; shot is cheap, half recovered |
| Compound bow | Civilian | 10–16 ranged | silent; half the arrows recovered; needs Agility 6 |
| .22 farm rifle | Civilian | 14–20 ranged | noisy |
| Pump shotgun | Civilian | 8–12 ranged, up to 3 enemies | very loud |
| Service rifle | Military | 20–28 ranged | ignores 5 armour; very loud |
| 84 mm recoilless launcher | Military | 60–90 to every enemy | one round a fight; deafening (no escape after); backblast hurts your own Back row; destroys hoard in the stores |

| Armour | Origin | Armour | Character |
|---|---|---|---|
| Reinforced jacket | Improvised | 4 | — |
| Tyre-rubber plates | Improvised | 5 | −1 Agility |
| Hazmat coverall | Council | 2 | sealed: ignores sprays |
| Riot armour | Police | 7 | −2 Agility; needs Strength 6 |
| Military body armour | Military | 9 | −1 Agility; heavy |

| Tool | Origin | Effect |
|---|---|---|
| Backpack | Civilian | +15 capacity |
| Hiking pack | Civilian | +30 capacity, −1 Agility |
| Head torch | Civilian | light: first strike in the dark, finds caches |
| Bolt cutters | Civilian | opens cages and lockers |
| Respirator | Council | halves spray and dust damage |
| Webbing | Police | +2 belt |

**Supplies.** Consumables: bandage (+20 HP), first-aid kit (+50), tinned
peaches (+10, between rooms or at home), smoke canister (+30% escape), flare
(scatters animals: they lose their first attack), Molotov (15 to every
enemy). Ammunition: shot, arrows, .22, shells, 5.56, 84 mm rounds.
Materials, each with a use from the day it's introduced (fixed uses, not a
crafting system): cloth (2 → a bandage), nails (4 + a wooden stick → a nail
bat of the same level and quality), duct tape (tape the hatch seal: +5
defence for 30 min), circuit board (fix the generator's regulator: +20
Power), RC-40 sorbent media (re-pack the purifier: +24 Water while it has
power); scrap (3 → 10 shot).

**Where items come from.** Each trip home rolls the destination's table
(seeded by the journey, so a reload never re-rolls): mostly supplies, some
equipment. Every consumable and material has a source, and every ranged
weapon a solo trip turns up has ammunition a solo trip turns up: Molotovs
and .22 rounds at the Workshop, smoke canisters at the Reservoir. The Workshop still guarantees a crowbar when the shelter has no
weapon at all, the safe way back after a defeat. Beating the beast gives one
piece of Nest equipment. Military kit comes from the Research Station, Armoury and higher team expeditions. Solo has low Epic chances in the Research Station and later locations; Legendary remains team-only. The Kestrel arsenal can now drop the rare portable nuclear launcher, with separately weighted availability and its own ammunition.

**Losing items.** A solo defeat or a party wipe loses what the person
carried: equipped items, belt and pack. The stash is never touched.

### Unified chat and friends

A global drawer opens `/social` from every authenticated game page. World,
public shelter messages, party chat and friend DMs share this hub. It is a
list of conversations beside the open one: Public (World, your shelter),
Parties (folded unless one is open or has unread messages) and Friends, each
row with its own unread count and last line. On a phone the list and the
conversation are two screens. Parties are named "leader's party · place",
never by row id. Actions in chat are buttons, not inline links. The current
channel and open state survive page changes; chat drafts are stored per account
and channel for the browser session. Inside the drawer the hub drops its page
header (`?embed=1`, kept in a cookie scoped to `/social`). Without JavaScript,
the same entry opens a standalone page with normal forms. Shelter pages link to
their public channel; the World page no longer duplicates the chat form.
Friends (with each friend's public status and whether their chosen character
can be sent), incoming and outgoing requests, private conversations and
dispatch settings are managed here.

Every player name in chat, shelter talk, party seats and visits opens
`/players/:name`: a card built from `publicShelter` alone, with the actions
that fit the relationship (add, accept, message, offer trade, invite to a
party you're gathering).

World and shelter messages retain their existing rate limits, retention and
post-commit SSE events. Private/party messages are plain text, 300 characters,
rate limited to one per second and deduplicated by author/request ID. Both reads
and writes check mutual friendship or party membership on the server. Private
message notifications are addressed only to the participants; unauthorized
conversation URLs return 403. The drawer shows private unread, friend requests
and pending invitation counts as a badge; an invitation lights the badge and a
toast but never opens the drawer by itself. Open pages refresh when a live
event arrives, with a ten-second fallback (`SOCIAL.pollMs`). Reading the
rendered private messages records a bounded message ID through POST; a hidden
drawer does not mark messages read. Eight-second invitation cards appear in the
conversation they belong to (and at the top while they're yours to answer), and
can be sent from friend DMs, player cards or an existing party. No second
immediate-dispatch web endpoint bypasses them.

### Adding expedition content

`src/game/dungeons.ts` contains typed room and dungeon definitions plus the
registry. Add a new definition and register it to populate the destination picker.
Travel, player limits, room sequence, enemies, loot tables, story conditions,
resident bonuses, narrative text, XP and optional completion record/quest are
read from that definition by the shared runner, party lifecycle and views.
Each new party snapshots its definition so editing content cannot change rewards
or encounters halfway through that party. Existing Lower Deck parties continue
using the compatible default. Combat math, random loot sharing and loss rules
are unchanged. New mechanics may still require extending the shared engine.

### Early expeditions and enemy collection

Approved 2026-10-12. Three new 2–4-player runs precede the difficult Lower Deck:
Abandoned Freight Yard (recommended levels 1–3, demo), Old Pump Station (5–7), Road Checkpoint (8–10), then Lower Deck (11–13). Formal expeditions require player level 5 or higher, as well as the existing maximum five-level recommendation gap. The demo remains open to new players.
All start and return immediately; room exploration and combat take time.
The definitions, map locations, art and reward summaries live together in
`src/game/dungeons.ts`. World links to the Expeditions selection map. On the
map solo exploration is an amber circle. Team destinations use a separate illustrated map above formation and party listings on Expeditions. Mobile maps scroll horizontally to keep all map targets at least 44 px.

The new threats are ordinary feral dogs, fallout-born mudback crabs, armed
road raiders and small pre-war inspection sentries. Raiders shoot either
row and are human, so animal-scaring flares do not stop them. The sentry
sprays the front row: sealed suits stop the spray and respirators halve it.
Dungeon-specific health, damage and armour tuning raises formal expedition difficulty without changing solo enemy stats. Story rewards are unchanged.

Expeditions defaults to the freight yard and two players. Cards show art,
recommended level, group size, exploration time and reward types. Character,
row, tactics and level requirements can be changed in disclosures. Party
cards emphasise seats and risk; logs and long rules are collapsed.

`/collection/enemies` is separate from the story collections: one enemy,
one permanent card, unlocked at its first actual encounter. No clue sets,
comic completion or kill grind. Cards show habitat, behaviour, genuine
combat counters and background. Undiscovered cards reveal neither name nor
art. Single-player dog encounters and timed party encounters both count;
retreating or wiping does not erase a card already seen. Party results store
sighting timestamps, revealed only as the run's clock reaches them. The
`shelter_id, enemy_id` key prevents duplicates. Migration 17 adds only the
new discovery table. Existing story cards and rewards are unaffected.

Verification can run without a localhost listener using
`pnpm exec vitest run --config vitest.in-process.config.ts`: it invokes the
same authenticated HTTP handlers through Hono, on isolated temporary SQLite
databases. The standard deployed HTTP harness remains the CI check.

## Logging

Approved 2026-10-21 (see Revision history), for crit 10. Status: **implemented on `main`**.

The server prints one line per event to stdout, which `flyctl logs -a
comp4020-final-xuwancheng62-lab` reads, so that whoever watches the log can say
who did what to whom without touching the app:

```
2026-10-21T03:12:05.120Z POST /shelters/7/steal 303 user=alice#3 target=bob#7 resource=food ms=12
2026-10-21T03:12:11.402Z POST /shelters/3/steal 400 user=bob#7 target=alice#3 resource=food ms=3
2026-10-21T03:12:20.031Z POST /login 401 user=- name=carol ms=40
```

- One line is written by the session middleware after the handler returns,
  so after its `tx()` has committed, for every POST except `/social/pulse`,
  and for `GET /shelters/:id` (looking into someone else's shelter). Static
  files and polling aren't logged.
- `user` is the session's account as `name#id`; a successful register or
  login names the account it opened. Ids in the path are named: `target` is
  the shelter's owner or the friend, and `party` / `invite` are ids.
- The status is always there, so refusals (400/403/409) show as attempts that
  failed.
- Never logged: passwords, session tokens, message text (only `chars=`), or
  any stock, rate or amount.
- Logs go to stdout only, not the database: Fly keeps them, and nothing in
  the game reads them back.

`src/accessLog.ts` holds the format; `spec/logging.test.ts` starts its own
server and checks the lines it prints. Who may see and change what is
recorded in `docs/decisions/0002-who-sees-and-changes-what.md`.

## Order

1. Hono server, `/readme/`, Node Dockerfile, deploy (invariants stay green).
2. SQLite, migrations, auth.
3. Shelter page with lazy settle.
4. World + Activity with the journey loop.
5. README "good" v1, PROCESS.md, crit-8 reflection, CLAUDE.md.
6. `spec/` alive test: register, act, log in fresh, state still there.
   — crit 8 —
7. Crops, all destinations, unit tests for settle / phases / loot.
8. Stage 2 in the order: migration 2 → survivors + visit view → `/events` →
   steal → reinforce → live world status → decision record + tests.

## Tests

- Unit (fixed clock): settle, journey phases, loot determinism, defence,
  chance clamps, steal amount floor, cooldowns, bands.
- HTTP (against the running app): alive/persistence; self-steal 400; bad
  resource 400; steal while away 409; same request_id ×5 → 1 interaction;
  5 parallel steals → ≤1 success, floor held, total conserved; both logs get
  the event; public view has no exact numbers; SSE event reaches the target
  within 1 s.

## Out of scope

A public auction house, alliances, revenge raids, a crafting
system (materials have fixed uses only), item durability, character
classes, PvP combat changes,
off-app notifications, leaderboards, multi-machine, starvation penalties.

## Base rooms, production and the vault entrance

Approved 2026-10-12, revised after hands-on visual review. Existing power,
water and storage rooms remain at tier 1. New workshops, cultivation rooms and
recycling rooms occupy new floors in the shelter cutaway. All facilities have
three tiers with added machinery. Someone must be home to build or upgrade.
Costs are defined per facility in BASE_BUILD_COSTS: construction metal plus
appropriate nails, cloth, water, sorbent or circuit boards. Stale forms cannot
charge twice; all required materials are checked before any deduction.

Generator scrap upkeep is 0.25 / 0.3 / 0.4 per hour. Cultivation makes 4 / 7 / 10
food per hour for water and power. Recycling continuously processes reclaimed
rubble into a renewable 2 / 3 / 4 scrap per hour for 2 / 3 / 4 power per hour.
This slow passive supply is intentional and bounded by storage; active
exploration still gives faster salvage and rare materials. Spare, unequipped
gear can be dismantled once for scrap, without touching a character's kit.
Manual greenhouse crops and exploration loot tables remain unchanged.

Workshops replenish five arrows per batch (20 / 15 / 10 minutes), costing
0.25 scrap per batch and power, up to 100 arrows in the stash. Manual recipes
use actual stash materials and unlock by workshop tier. Bandages and first-aid
kits use cloth without an extra scrap cost. Crafted gear uses the existing
character/equipment system.

Production can be explicitly paused and resumed. Settle old rates before any
change; production advances from timestamps, with no background worker, and
cannot pay twice. Production stops at missing inputs or at resource limits of
200 / 350 / 600. Existing stock and exploration loot above a limit are preserved.
Crew food and water upkeep continue while facilities are paused.

The shelter is buried beneath a left-hand mountain, with a right-facing door and a compact cutaway. Its painted hillside vault door leads
through a horizontal access tunnel to the internal ladder, with characters
walking along the tunnel before climbing. Doors have 80 / 160 / 280 HP. Tiers 1 / 2 / 3 add up to
5 / 12 / 25 to the public security estimate, scaled by condition. PvP uses
the actual HP and tier armour described above; a door must be breached before
any loot is taken. Repairs cost six
scrap and restore forty HP, capped at the door maximum. Friendly visitors do
not damage the door. Existing protected-stock rules still apply.

From a tier-2 door, roaming scavengers test it every six hours. Someone home
halves 16 door damage. An intact door stops theft; a breached door loses up to
five food, water and scrap, respecting protected reserves. At most one overdue
siege settles on a read; long offline periods cannot stack sieges. Activity logs
record the result. This is a lightweight base-pressure event, not a new combat
or wave-defense mode.

Clicking scene equipment opens its upgrade, production and repair controls.
Only a compact construction-button row sits below the cutaway; there is no
second gallery of room cards. Workshop recipes are inside its inspection panel.
Controls are plain forms; number shortcuts and number badges are removed. Scene inspection still works by click, touch, Tab
and Enter; Esc closes it. Changes work without JavaScript.

## Automatic solo exploration

Every new location trip stores a private, seeded combat snapshot at departure
using the existing character/equipment combat rules. It resolves without clicks
or an online player; health, ammunition, belt items and rewards settle once when
the character returns. The regular exploration duration remains unchanged.
Enemy cards unlock at the encounter time; the result is shown in Activity at
return. Existing trips from older versions retain their previous rules.

Supermarket: one rat. Workshop: one feral dog. Reservoir: one mudback crab.
These small encounters have an opening attack and are balanced for a healthy
starting character with their starting crowbar to win while losing HP. Better
armour and equipment mitigate losses; badly injured characters can still fail.
Nest: the existing 55-HP scavenger beast, now automatic. Calm story encounters
still avoid combat. No abstract empty/half-haul roll applies to new solo trips.

Carry healing to use automatically. When health remains below 30% and no
carried combat healing remains, attempt retreat once, using carried smoke.
The existing agility/weapon speed, luck, noise and smoke escape calculation is
reused, with Toby's dog familiarity at the Nest. Escape keeps equipment and
half the collected resources; failed escape forces continued combat with no
second roll. Defeat loses only that traveller's carried equipment and supplies.
There is no new departure setting. Team expedition retreat rules are unchanged.


## Shelter overview UI

The own-shelter screen leads with name, security, health and the live resource
strip, then compact Explore / People / Stash links and the interactive cutaway.
Only actionable shortages show alerts; healthy full-stock explanation blocks
and repeated facility/guarding instructions are omitted. Construction remains
one row below the scene.

People are compact cards showing portrait, name, level, current activity,
health and equipped item previews. Guard/work and needed recovery remain
visible. Each person's native disclosure contains detailed attributes, XP,
training, speciality and equipment/packing controls. It starts closed, works
without JavaScript and opens on character action feedback. Expanded desktop
cards use the available width; phones use one column. Existing forms, costs,
state rules and inventory actions stay intact.

## World overview UI

World keeps the illustrated map and amber solo pins; team destinations use separate illustrated team map with spiral entrance markers. Short
map popovers link to the destination's preparation card rather than duplicating
departure forms. Section links jump to Solo, Team and Neighbours.

Solo cards show exploration time, risk, resource yields, enemies and Explore.
A native character selector defaults to a healthy available person. Native
Details & search disclosures preserve descriptions, geographic distance,
combat rules and all existing story-focus radios. A default story lead's cost
or peaceful encounter is visible in the disclosure summary; the defeat-loss warning is inside each location's optional exploration details. There are no new required options.
Team cards keep existing entrances and rewards; nearby shelters become compact
rows with Visit/Add friend actions and optional public supply bands. Existing
server validation, timings, drops, privacy and dispatch rules are unchanged.

## Midgame solo exploration and team entrances

Approved 2026-10-13. Raider Camp (recommended 5–7), Contaminated Research Station (8–10) and Abandoned Armoury (11–13) add continuous, configurable encounters. A departure snapshot fixes each run; health, ammunition and healing carry between stages, and the existing below-30% retreat is attempted at most once per trip. Only encountered enemies unlock field-guide cards. Existing beginner locations remain unchanged. New routes award equipment and ammunition only on successful completion; successful runs grant route XP, while retreat retains the existing escape XP rules; escape keeps equipment and half the resource haul, defeat loses carried items.

Admission uses the shelter owner's player character level, regardless of which character is dispatched. A recommended lower bound more than five levels above the player locks the entrance. Equality is allowed. This applies to solo departure and all team seating paths, including offline friend dispatch; formal team runs additionally require player level 5. A recruited Toby can therefore be sent into unlocked content with his own equipment and attributes. Party leaders' optional minimum-character-level settings remain separate.

The geographic map now contains solo locations only. Team destinations appear as animated dark spiral markers over one large illustrated team map at the top of Expeditions; World retains a link. The original dungeon card art remains on Expeditions. Expeditions retains formation and active-party lists. Locked entrances are grey, and the server enforces admission even for direct requests. Reduced-motion settings stop the entrance animation. The spirals are a UI treatment, not fictional teleportation.

## Exploration battle reports

Activity groups settled automatic solo exploration into native, collapsed report cards. The summary shows traveller, destination, outcome, remaining HP, HP lost and resource/equipment rewards or losses. Expanded reports follow encounter order and ascending round order, explicitly labelling damage rather than leaving bare numbers. New settled journeys retain their private combat snapshot inside outcome JSON. Existing journeys are reconstructed from their original chronological activity-log rows where available; original rows are preserved. Grouped report rows are excluded from the general activity feed, which retains other shelter events. Pending outcomes remain private, and only the owner's shelter reports are read. No combat or settlement rules change.

## Activity milestones

Activity logs each newly unlocked clue card and enemy field-guide card once, with a card label and Collection link. Alternate evidence for the same clue card and repeat enemy sightings do not duplicate events. Existing discoveries are backfilled at their original discovery time during shelter settlement. NPC recruitment and collection completion retain their existing one-time logs, now labelled and linked to People or Collection. Other shelter events remain in the general activity feed, separate from battle reports. The defeat-loss explanation is inside exploration details rather than filling the visible Nest card; the underlying loss rule is unchanged.

## Learning from failed exploration

A completed failed solo trip reveals defensive advice only when its actual combat log contains damaging spray attacks. The advice appears in the battle report and persists in that destination's optional details, derived from all completed journey history. First-time trips and unencountered enemies do not provide these lessons. Existing failed trips can use their retained activity log; new trips use the saved report. Owned hazmat coveralls and respirators explicitly describe their effects in item details. Combat, drops, damage and admission are unchanged.

## Solo and team equipment progression

Approved 2026-10-13. Ranged attacks add full effective Agility, matching full Strength for melee/reach. Empty guns retain Strength-based club damage. Weapon speed, ammunition consumption and defeat losses remain unchanged. Spears and axes provide the melee progression alongside firearms; the baton remains an optional control weapon rather than the main midgame reward.

Solo quality weights (Common / Uncommon / Rare / Epic): supermarket/workshop/reservoir 70/25/5/0; Nest beast 60/32/8/0; Raider Camp 50/40/10/0; Research Station 37/45/15/3; Armoury and later locations 25/50/20/5. Solo never rolls Legendary. Existing equipment is not downgraded. Solo level bands and equipment drop chances remain unchanged. Supermarket can also supply starter jackets. Reservoir's diluted stick entry is removed; Camp additionally supplies spears, axes, jackets, hazmat coveralls and respirators; Research and Armoury also supply spears and axes. Thus protection and level-appropriate melee weapons can be acquired before the next solo challenge. These remain random drops, with no new pity or trading system.

| Expedition | Equipment levels | Common / Uncommon / Rare / Epic / Legendary | Enemy HP × / damage × / extra armour |
|---|---|---|---|
| Freight Yard demo | 1–3 | 72 / 24 / 4 / 0 / 0 | unchanged |
| Pump Station | 5–7 | 0 / 20 / 65 / 15 / 0 | 2.2 / 1.5 / 1 |
| Road Checkpoint | 8–10 | 0 / 0 / 65 / 33 / 2 | 2.5 / 1.8 / 2 |
| Lower Deck | 11–13 | 0 / 0 / 35 / 60 / 5 | 1.6 / 1.6 / 2 |

Every room's equipment rolls use its expedition's band and quality weights, including named legendary rolls. Enemy tuning applies to initial enemies and reinforcement waves and is stored in the existing party-definition snapshot. Formal-run XP is 45/70/100. Existing parties retain their stored definition. Weapon and armour pools include both Strength and Agility loadouts; random loot allocation remains unchanged. Equipment requests, gifts and swaps are deferred.

Progression verification uses actual one-point-per-level full Strength and full Agility builds, random Uncommon bonuses without selected traits, two first-aid kits, and ammunition where needed. At recommended entry levels 5/8/11, level 4/6/9 equipment from preceding locations must yield at least 90% wins across 500 seeded solo runs per build. The check also covers the early Nest. Prepared mixed two-player parties are tested across 300 seeds per formal expedition, alongside admission and HTTP rendering checks. These tests establish prepared progression, not a guarantee for unhealed or unequipped characters.

## Late exploration and equipment presentation

Approved 2026-10-13. Stash separates melee (including reach) and ranged weapons, sorting each section by descending item level, descending quality, then kind. Report and Activity equipment names use the existing rarity palette while level text remains neutral. Historical labels remain readable and all surrounding text is escaped.

Three solo locations extend progression: Steelworks (14–16): fire axe/chainsaw and service/heavy hunting rifle; Rail Terminal (17–19): chainsaw/war pick and heavy hunting rifle/carbine; Command Bunker (20): chainsaw/powered demolition hammer and carbine/anti-materiel rifle. Each has two melee and two ranged types, protective equipment and reliable ammunition supplies. Spears stay in the earlier pools. New enemies (slag beetle, Ash Hounds gunner, armoured hound and military guardian) each unlock one field-guide card on encounter. No old enemy stats are changed.

Two new team expeditions: Ash Hounds Armoured Convoy (15–17) drops lightsaber, breaching hammer, heavy hunting rifle, light machine gun, body armour and webbing; Kestrel Underground Arsenal (20) drops lightsaber, powered hammer, light machine gun, portable nuclear launcher, heavy power armour and powered load harness. Both use Rare 35% / Epic 55% / Legendary 10%, with no Common or Uncommon. Nuclear launcher has weight 0.12 against 1 for every other equipment kind. These new tables keep Legendary rolls inside their own pools, except that half of their Legendaries (`LATE_TEAM.namedLegendary`, approved 2026-10-21) are one of the named dropped ones instead. Existing dungeon snapshots remain intact.

All melee scales with Strength, all ranged with Agility. Light machine-gun bursts hit up to three targets and consume three 5.56 rounds; insufficient ammunition falls back to club damage. The nuclear launcher uses a miniature warhead, hits all enemies once per fight and has backblast/hoard damage. Each room resets per-fight weapon effects. Power armour supplies high armour with a speed penalty; its sealed internal power module and the powered melee equipment do not introduce a separate fuel workflow in this release. Powered harness adds carrying space and belt slots. No team trade system is added.

At levels 14/17/20, random Uncommon equipment of level 12/15/18 from the preceding solo tier, with two first aid kits and ammunition, is tested over 500 seeds for each full-Strength/full-Agility route (minimum 90% wins). New formal parties are tested over 300 seeds with prepared two-player teams. Admission still uses the account's player level and maximum five-level gap. Instant exploration and bulk equipment playtesting remain enabled.

## Temporary manual playtest

Approved 2026-10-13. `PLAYTEST.enabled` temporarily makes battle rounds and solo/team exploration add zero elapsed time, so new departures settle on the next page read. Solo reward tables with equipment now give five independently rolled pieces per successful reward, even when the normal equipment-chance roll misses. Nest uses its beast reward, not its empty normal gear table. Expedition equipment rewards likewise produce five pieces per normal equipment slot and are still shared across the party. Supplies, quality weights, level bands, combat outcomes and defeat losses stay unchanged. Turn `PLAYTEST.enabled` off to restore ordinary equipment chances/counts and normal exploration/five-second combat rounds. Already-resolved party snapshots keep their timing and loot. `PLAYTEST_INSTANT_EXPLORATION=0` opts into normal waits for the existing timing regressions; a separate HTTP test exercises immediate solo and party settlement with the switch enabled.

## Undelivered: northern story journeys

Approved and implemented on 2026-10-21 on `codex/helen-story-plan`.
Ridge Road and the Weighbridge outskirts are solo evidence-recovery journeys,
recommended level 5–7, with two feral dogs and two raiders respectively. Their
16/18 km northern routes appear below the local map (not falsely positioned on
its short-distance scale). They reuse existing Helen card artwork and do not
add an equipment tier, currency source or repeatable loot farm.

Reservoir evidence (`day-140` or `council-bulletin`) opens the convoy lead;
recovering `convoy-manifest` opens the outlying goods store and `helen-letter`.
Both new guarded records require victory and return; arrival, escape and defeat
do not grant them. Existing records retain their arrival discovery semantics.
Completed investigations cannot be repeated; old discoveries count immediately.
The seven-card Helen collection and its existing reward can now complete normally.

The Journal task **Undelivered** links each current objective to its location.
After recovering both northern records, an explicit at-home POST hands the sealed
letter to the Kell walkers. Reading the comic never sends it automatically.
An idempotent `helen-forwarded` discovery opens a Workshop reply lead; finding
`ruth-received` completes the quest. The reply acknowledges receipt, without
inventing proof of Helen's death or making Ruth's grief a public announcement.
No extra repeatable reward is paid. The historical envelope remains in the
journal as evidence, while the receipt records that the original was delivered.

This does not implement Mags recruitment, the bypass, the fall of the Weighbridge,
new named-character deaths or shared-world endings. Mags work remains on its own
branch and must be reconciled before merging both branches.

## Credits, merchant and player trades

Approved 2026-10-21. The Trade page has Shop, Sell and Player trades tabs,
with a link from friend conversations. No public auction house in this release.

- A shelter wallet starts with 200 Credits. Credits are never carried on a
  character or stolen in raids. Scrap remains a construction resource.
- Merchant equipment is offered at the player's level, once its kind's minimum
  level is reached. Common, Uncommon and Rare equipment, ammunition, special
  supplies and food/water/scrap are sold directly. Three Epic equipment listings
  rotate at 00:00 UTC, each limited to one per shelter per day. Levelling cannot
  reset that allowance. Legendary equipment is not sold; special ammunition
  remains purchasable. Listings show exact rolled stats before purchase, and
  stale equipment listings are rejected after the daily rotation.
- Equipment prices use kind, level, quality, bonuses and traits; supplies have
  configured prices. Shop buyback is 25% of valuation (minimum 1 Credit),
  only for unequipped stash items. Rare and higher sales require confirmation.
  Daily buyback budget is 600 + 150 per player level. This also limits currency
  created by the existing boosted playtest loot; playtest settings are unchanged.
- New completed collections pay 50 Credits, Toby's recruitment pays 100, and
  cleared team expeditions pay 25 + 5 per recommended level, capped at 400 per
  shelter per UTC day. Existing completion records are not retroactively paid.
  Wallet ledger entries and existing reward keys prevent repeat claims.
- Accepted friends can propose up to three item lines on each side, plus Credits,
  food, water and scrap. Offers can be gifts. Requested equipment specifies a
  kind, minimum level and minimum quality; the recipient explicitly selects
  the exact eligible piece and can inspect its traits before accepting.
- Offered goods and Credits are removed from the stash into an escrow snapshot.
  They cannot be equipped, consumed or sold. Acceptance atomically validates and
  transfers both sides, preserving all equipment stats. Insufficient payment
  rolls the entire exchange back. Duplicate request IDs do not repeat spending.
- The sender can cancel; the recipient can decline or counter. A valid new
  counteroffer closes and refunds the old offer in the same transaction. An
  unsuccessful counteroffer leaves the old offer intact. Offers expire after
  48 hours and cannot then be accepted; either participant can use Return escrow
  to reclaim reserved goods. No timer or automatic acceptance is involved.
- Only participants can see an offer. Activity records and private alerts notify
  both participants of changes. Monetary history stays with the owning shelter.
  All balance/stock checks and exchanges run inside a database transaction.
- Schema 20 adds wallet, ledger, receipt, merchant-stock and offer tables without
  changing existing equipment, characters or resources. Tunables are in ECONOMY.

## Revision history

- 2026-10-13: Added three late solo locations, two team expeditions, local Legendary pools, chainsaw/light-saber progression, four enemy cards and painted assets. Split stash weapons, coloured report loot and enabled low Solo Epic rates.

- 2026-10-13: Enabled temporary instant battle timing and bulk equipment rewards for manual playtesting; retained existing rarity/level rules. A follow-up request also removed exploration waits.

- 2026-10-13: Rebalanced Solo rarity and melee progression, full Agility ranged damage, and formal expedition difficulty and rewards. Moved team map to Expeditions; Freight Yard remains the starter demo. Added seeded build-progression and admission regression coverage.

- 2026-10-12: User requested a mountain-buried shelter, door-to-ladder tunnel, equipment-level controls, a single construction row, and relief from scrap scarcity. Added renewable recycling, mixed construction costs, lower generator/arrow upkeep, and spare-gear salvage.

- 2026-10-12: Approved and implemented base expansion, three-tier facility visuals, pauseable timestamp production, crafting, and repairable vault-door defence with bounded scavenger sieges. Existing crop and exploration rules preserved.


- **2026-10-06** — At the user's request, ahead of crit 8's remaining
  evidence: the Shelter page became an animated, inspectable scene (Pages →
  "The shelter scene"), and Stage 2's read-only visit view and Survivors list
  were built early. Public visibility gained machine running state, and bands
  are measured from zero until stealing adds a protected minimum. Test
  accounts (`spec_…`) are left out of the Survivors list.
- **2026-10-06** — Stealing, reinforcing and live updates built. Changes from
  the plan: base defence is a flat 15 (facility levels don't exist yet); the
  30-minute new-player shield was dropped, because the protected minimum (20)
  and 5-minute post-raid shield already cap a newcomer's loss at 2 per raid and
  a shield would make every fresh test target unraidable; crops can't be stolen
  until crops exist; reinforcing is allowed while you're out. A visit page
  reloads itself when the owner leaves or gets home, since the scene depends
  on it.
- **2026-10-06** — At the user's request, raids no longer fail on a roll:
  every raid gets in, and strength × luck decides the haul, which can be 0.
  `interactions.chance` now stores strength and `roll` the luck draw (0–1000).
- **2026-10-06** — Greenhouse built (section "Greenhouse"), replacing the
  earlier crops sketch: growing plots now also draw water and power per hour,
  at the user's request. The survivor's "?" bubble became a line chosen from
  the inspected item's real state. Crops still can't be stolen.
- **2026-10-06** — At the user's request, "who's viewing" came into scope as
  presence at the gate: anyone with a shelter's visit page open stands by its
  hatch with their name, seen by the owner and other visitors, and the owner
  gets a toast on arrival. Presence is in memory only (an open `/events`
  stream with `?watch=`), with a 4-second grace so a reload doesn't flicker;
  nothing is stored. *Enforced:* `spec/presence.test.ts`.
- **2026-10-06** — At the user's request, a visit now shows you inside the
  other shelter while its owner is home (they let you in through the hatch),
  so two people are there, each with a name tag; you direct yourself with
  clicks and keys, the owner wanders. While the owner is out the hatch is
  sealed and you wait at the gate. This is only how the visit page draws it:
  visiting still costs no time and never leaves your own shelter unguarded.
- **2026-10-06** — At the user's request, chat came into scope as talking at
  a shelter (abilities were proposed and set aside). Anyone can speak on a
  shelter's page: the owner from their own page, a visitor from the visit
  page, or a note at a sealed gate. Everyone on that page hears it live and
  sees it over the speaker's head; the owner hears it anywhere as a toast.
  Lines are plain text, at most 200 characters, one per 1.5 s per person,
  idempotent by `request_id`, and kept for a day (table `talk`, migration 4).
  No moderation beyond that; it's for a crit pod in one room.
  *Enforced:* `spec/talk.test.ts`.
- **2026-10-06** — At the user's request, the World page opens with a map: a
  realistic aerial picture (generated through the course image proxy, five
  images, about $0.60) with every destination pinned where it lies, rings at
  each kilometre and a dashed route from home. Hovering or focusing a pin shows
  a photo of the place, its distance, walk time, search time, total time away,
  danger and what you may find, with the depart button. Distance is now the
  source of travel time (30 s a km, `TRAVEL_SEC_PER_KM`); the places were put at
  2, 3, 4 and 4 km so every existing trip keeps its length. Under 760 px the
  pins jump to the destination card instead of opening a popover.
  *Enforced:* `spec/world-map.test.ts`.
- **2026-10-06** — At the user's request, the shelter got painted art (style
  chosen by the user: painted rather than photographic). Each room has a
  painted backdrop and the surface a ruined skyline; shelves, tank, crops,
  hatch and survivors stay drawn so they still show state and can move. Every
  player has one of six painted portraits, fixed by account
  (`portraitOf` in `src/public.ts`, added to the public view as `portrait`),
  shown at the top of their shelter, on their Survivors card (which now also
  names the owner) and beside each line they say. Twelve images through the
  course proxy, about $1.20. The drawn figures keep their colours (yours green,
  the owner's tan) because that tells you which one is you.
  *Enforced:* `spec/art.test.ts`.
- **2026-10-06** — At the user's request, the generator, water purifier and
  ladder are painted to match the rooms (three more images, about $0.40; the
  first ladder came out in perspective and was redone). The machines are cut
  out of a green background (`scripts/cut-shelter-art.py`) and what changes is
  drawn over them: the generator's lamp, a hum and exhaust while it runs; the
  water level, bubbles and a lamp on the purifier. Stopped machines go dim with
  a red lamp. The generator's spinning flywheel is gone, since the painted one
  has none. The ladder is a painted three-rung tile repeated up the shaft.
  *Enforced:* `spec/art.test.ts`.
- **2026-10-06** — At the user's request, the rest of the shelter is painted:
  food and water shelves, the scrap crate, the bed, the greenhouse, the hatch,
  and the earth and concrete around the rooms (26 images including retries,
  about $2.60). Everything that shows state still does: one painted can or jug
  per unit on the shelves, one scrap piece per unit in the crate, three
  painted plants per planter sized by stage (sprout, growing, ready, for each
  crop) with ripe ones glowing, the hatch open or sealed, lamps lit or dark.
  Plants were painted on magenta so keying out the background didn't eat them.
  The drawn tally marks and the survivors stay as they were.
  *Enforced:* `spec/art.test.ts`.
- **2026-10-06** — At the user's request, players choose their portrait when
  they register, from twelve (six more generated, about $0.60; one prompt was
  reworded after a false NSFW refusal, not charged). The choice is stored as
  `users.portrait` (migration 5); players from before keep the face they had.
  The picker is a set of radio buttons, so it works without JavaScript and by
  keyboard; one is chosen at random to start, a registration that sends none
  gets one at random, and an unknown choice is refused.
  *Enforced:* `spec/art.test.ts`.
- **2026-10-06** — CI failed on `spec/art.test.ts` for three pushes: its
  Survivors-card check assumed other players exist, but CI starts from an
  empty database and the list hides spec accounts. The card check now runs
  only when cards are listed; the portrait is still checked on the shelter
  page and in talk. Before pushing, the spec is now also run against a fresh
  database, as CI does.
- **2026-10-06** — Shelter polish, scoped to the stock, the greenhouse rail,
  the room lights and the hatch. Food and water now stand on the shelves as
  three painted tins and two painted jugs (seven images, $0.70), in a fixed
  order per slot so a shelf only changes when stock does. Each rests on the
  board with a contact shadow and takes the room's warm light. The count
  still follows stock exactly as before. The grey bar over the planters is
  now a thin weathered rail, hung from the ceiling on rods, with a clamp and
  chain for each grow lamp. The pale strip at each room's top is replaced by
  a small hanging lamp whose bulb and halo come on with the shelter's lights
  (the greenhouse has its grow lamps instead). The hatch is repainted as a
  round lid in a concrete rim, sunk into the ground. No gameplay changed.
  *Enforced:* `spec/art.test.ts` (stock drawn as separate items, 1–9 per shelf).
- **2026-10-06** — Redesign items 6 and 9; item 8 (repainting the World map)
  is cancelled, so the map stays a photo. The survivors are still drawn, so
  every animation keeps working. They are now shaded: boots, trousers, coat
  with a shadow side, collar, belt, pack with a bedroll, hair, goggles, a
  contact shadow and a thin outline. The guest keeps a green coat, and the
  people at the gate get a matching hooded traveller. The landing, login and
  register pages open on a painted scene of a bunker entrance at dusk, with
  the form standing over its sky on wide screens. On the World page the
  four place pictures are repainted in the shelter's style, replacing
  photos. Each survivor card now opens on that player's portrait, the way a
  place card opens on its picture. Five images, $0.50. No gameplay changed.
- **2026-10-06** — The four place pictures on the World page are back to the
  original photos at the player's preference; the painted versions are
  dropped. The sign-in painting and survivor-card portraits stay.
- **2026-10-07** — Wrote the crit 9 decision record,
  `docs/decisions/0001-concurrent-raids.md`. It records the existing rule for
  simultaneous raids (first to commit wins, then a 5-minute guard) against
  three alternatives, and why. It is numbered 0001 rather than the 0002 this
  plan named, since there is no earlier record. No behaviour changed.
- **2026-10-07** — Approved gameplay expansion: one character per shelter
  (HP, Strength, Agility, level, experience), three gear slots with four
  items, one creature (the scavenger beast at the Creature Nest) with
  turn-based fights and one escape attempt, and recovery at home. New section
  "Character, gear and the beast"; "gear/upgrades" leaves Out of scope. Two
  side effects on existing rules, both documented there: Agility 5 makes
  every exploring leg 20% shorter than before, and a trip's haul is now
  capped by carrying capacity (40 to start, above any old loot table's
  maximum). Surviving the Nest still raises `combat_power` for raids, now on
  a win only.
- **2026-10-09** — Approved narrative slice: eight records about Ruth Lane
  and Toby Wren at the Supermarket and the Dry Reservoir, found one per
  trip, with leads, an optional "What to look for" choice and a private
  journal. New section "Records in the wasteland". Decisions recorded there:
  five years since the collapse, a fictional Australian setting, player
  shelters as former Resilience Units, and the beasts as a feral dog pack.
  The rest of the story design, new places, art and restitution stay out of
  scope.
- **2026-10-09** — Setting corrected to a nuclear war (see "Canon"):
  Calder wasn't struck but lay downwind of Kestrel Range and Port Sallow,
  neither of which is a destination. The Loop is background, not a cause;
  radiation is narrative only. The eight records were rewritten to match
  with the same IDs, order, leads and rules, so records already found carry
  over. One open question changed wording, because its record now answers
  it: "Where was the hub lorry taking the stock?" became "Who did the eleven
  pallets kept back end up feeding?".
- **2026-10-10** — The five characters' fates approved; the canon ages line
  now records Helen's and Dev's deaths. Story collections approved and
  built for Toby (new section "Story collections"): six cards, a ten-panel
  comic with placeholder art, +50 XP once. Four Toby records and two leads
  were added at existing destinations, so the Supermarket now has six
  records and the Nest one; the existing eight are unchanged.
- **2026-10-10** — Toby's storyboard approved and the comic painted: ten
  panels, 14 images generated in all ($1.40 of the course image budget),
  cards reuse the panels. No gameplay changed.
- **2026-10-10** — Toby's comic, revision 2 (proposed story and art; reader
  built): a paged reader, a script that tells the approved story, his letter
  as a seventh card at the Workshop (so the Workshop now has a record), a
  character visual bible. Finishers of the six-card set keep the comic and
  aren't paid twice. No other gameplay changed.
- **2026-10-10** — Toby's collection, revision 3 (proposed; built with
  placeholder art): cards show the evidence found, not summaries of his life
  or comic panels; the set is titled by theme ("Signed T.") until complete;
  comic panels 2–5, 9, 13 and 14 show the objects, and panel 9's dialogue
  changed so Dev writes the line he never says. Unlocks, discoveries and the
  one-time reward unchanged; no gameplay changed.
- **2026-10-10** — Toby's collection revision 3 approved and painted: nine
  object pictures for the cards and thirteen new comic panels (panel 1
  kept), 61 images in all ($6.10 of the course image budget; $6.30 left). The interim
  panels from revision 1 were removed. No gameplay changed.
- **2026-10-10** — Ruth's collection built (approved in the autonomous
  batch): two new records and a lead, a second set and comic, placeholder
  art (no images generated). The Supermarket now has seven records and the
  Workshop two; a player following default leads meets the basement before
  the lists. Existing discoveries and rewards are unchanged.
- **2026-10-10** — Owner's decisions applied (canon in docs/narrative):
  - Ruth has only rumours of Helen's death.
  - Kerry's replies wait sealed with Ruth at Kell Bridge.
  - Dev refused to reveal the bypass; the main valve was chained after his
    death, and Ruth refused to pay later.
  - Nina's capture and Nell's death are one Y+3 ambush; the Y+1 convoy
    stays separate.
  - The bore house is Dev's.
  - Mags's tag reads "RE-PACKS".

  Built:
  - Ruth's art: 20 images, $2.00.
  - The restoring-contact task.
  - Mags's collection.
  - Dev's run sheet.

  Toby's comic panels 10–11 and Ruth's panels 10–12 were re-lettered to
  match. Players who already hold the Bus 2 list are now pointed under the
  Workshop bench first. Existing discoveries and rewards are unchanged.
- **2026-10-10** — Owner's second batch:
  - Mags's art approved at up to $4 more. It took 24 images ($2.40), and
    no placeholders remain.
  - "Inspect purifier" approved: a new kind of record, found at home (see
    "Story collections"). `unit-plate` joins `ferris-docket` on Mags's
    card 5, and existing docket holders keep the card.
  - Dev's motive set: the bypass was the last independent water access,
    and showing it would let the Ash Hounds coerce everyone relying on it.
    The bypass's physical form is worked out in
    docs/narrative/world-bible.md, as Proposed details.
  - Nina Haas is explained in docs/narrative/characters.md and stays
    Proposed until reviewed.
- **2026-10-10** — Dev's and Helen's collections built on request, ahead of
  the crit-day plan that had held them. Helen's set is visible with its last
  two cards marked out of reach (owner's choice over hiding the set, moving
  the cards, or adding the two destinations). Helen's handout opens only from
  her bulletins, not Toby's worksheet, so a first Reservoir visit is
  unchanged. Art isn't generated here; the owner will make it.
- **2026-10-11** — Comic reader changed at the owner's request: one picture
  per page, words under it instead of balloons over it, because balloons
  kept covering faces. Pages per comic went from 7–8 to 12–14; the
  per-browser bookmark key changed so old bookmarks don't land on the wrong
  picture. No story text changed.
- **2026-10-11** (later) — The owner asked to keep balloons after all, but
  beside the picture rather than over it: near the speaker's head with a
  tail, allowed into the whitespace around the art, in reading order, with
  narration as captions, and adapted for phones. Words-below was replaced by
  the layout described under Collections. Off-panel voices (radio, phone,
  someone out of frame) get a balloon with no tail.
- **2026-10-11** (evening) — Balloons placed above the picture ended up far
  from their speakers with long tails, so at the owner's request each
  balloon is now placed by hand for its scene, on the picture where there's
  room, kept off faces, which are marked per panel and checked in `spec/`.
  An off-panel voice may still have a tail, to its radio or phone.
- **2026-10-11** — Approved: quests, and Toby's recruitment as the first
  (new section "Quests"). Changes to what was here: Kerry's letters are no
  longer left in the forwarding tin but carried to Toby by hand; his chalked
  thanks moves after the meeting and now speaks to Ruth; the Reservoir and
  the Nest each have one more record; one Nest trip has no beast; one lead
  takes scrap; and toby-collection.md's "no NPC in the shelter" is retired.
  Toby joins until the road is safe, and the chained valve and the scour
  line stay with the main story. Out of scope is unchanged; party quests
  are not built.
- **2026-10-11** — Approved: recruited people are full characters, starting
  with Toby (new section "Your people"). Each has their own HP, stats, XP,
  gear and trips, and everyone can be out at once. **The thesis changes, at
  the owner's request:** the shelter is unguarded only when *nobody's* home;
  whoever is home defends it by their combat and weapon, half for anyone on
  work (the "Steal" formula). This reverses "he doesn't defend the shelter"
  under Quests. Migration 10 re-keys characters, items, journeys and
  encounters by character and copies all data; `shelters.combat_power` and
  `residents` stay but are no longer read.
- **2026-10-12** — Approved: world chat, cooperative expeditions, a combat
  resolver shared by solo and party fights, and a richer item system (new
  section "Expeditions, parties and items"), built on the `expeditions`
  branch so `main` keeps the crit 9 version. Older assumptions updated at
  the owner's request rather than kept as limits: items are now instances
  with level, quality, bonuses and traits (affixes were out of scope), and
  duplicates are allowed (one of each kind per person is retired, and with
  it "Give", since everyone equips from the shelter's stash); characters
  level to 20 (was 10); materials get fixed uses, still without a crafting
  system; the beast's Spear/Jacket rule and the Workshop's salvage become
  drop tables, keeping the guaranteed crowbar. Toby joins parties like
  anyone. A wipe loses carried items, never the character. The portable
  nuclear launcher is a future endgame item; a conventional launcher comes
  first.
- **2026-10-12** — Expeditions finished on the `expeditions` branch. Beyond
  the steps above: a run that's over leaves the list of parties and goes
  into each member's "Your expeditions", with their share and the whole run;
  Legendary cards show their line of history; a Last-seal Legendary keeps
  its wearer up once in a solo Nest fight too (migration 14); the narrative
  docs record the Lower Deck, its records, its creatures and Gary's hook.
- **2026-10-12** — Approved: Constitution, a third attribute for you and
  residents (section "Character"). Max HP is now 60 + 5 × Constitution + 2 ×
  Strength; the "+10 max HP" level-up choice becomes "+1 Constitution", and
  an item's "+max HP" bonus becomes "+Constitution". Migration 15 gives each
  character the least Constitution that keeps their max HP or more (a "+10
  max HP" point becomes 2 Constitution; trained Strength now adds its own),
  leaving current HP alone. Toby has Constitution 3: 83 HP, as no whole
  number gives his old 80. Constitution's rule against poison and bleeding
  is written and tested, to be wired up when those exist.
- **2026-10-12** — Item data gaps closed: Keen-eyed now adds one of each
  supply a solo trip finds (before the pack's limit); a Molotov thrown in the
  stores burns food and a launcher round wrecks the hoard, as written; the
  Workshop turns up Molotovs and .22 rounds and the Reservoir smoke
  canisters, so nothing civilian is left without a source.
- **2026-10-12** — Closed the last enemy gap: a fight that ran out of rounds
  with neither side beaten used to end in a free "escaped", against "escape
  can fail". It now rolls the same forced retreat as any other stalemate,
  and failing it is a wipe.
- **2026-10-12** — The `expeditions` branch (all five steps, Constitution,
  and the item and enemy gap fixes) merged into `main`, a fast-forward-free
  merge with no conflicts; `pnpm check` green on fresh databases both sides.
  Held back from `origin/main`: the crit 9 cutoff hasn't passed, and
  migrations 11–15 haven't been tried against a copy of production's data.

- **2026-10-12** — Approved simplification of first expedition access: everyone
  can call the Lower Deck without finding a clue. The first available character
  and existing tactics are preselected; character/row and tactics controls are
  collapsed, with a visible summary. Both call and join forms explain rations,
  show exact shortages with scavenging links, and disable submission when no
  character or rations are available. Server checks remain authoritative.
  High danger, carried-gear loss and automatic departure remain explicit;
  narrative records and the existing all-clear advantage are unchanged.

- **2026-10-12** — Approved configurable expeditions, unified chat/friends/DMs,
  five-second auto-accept invitations (online or offline), and removal of all
  expedition Food/Water admission costs. Implemented migration 16, per-party
  definition snapshots, recipient-only invitation answers, server-side private
  conversation authorization and no-JavaScript fallback forms.

- 2026-10-12: Approved immediate outbound and return travel for demonstrations. Single-character trips and team expeditions now wait only for exploration/combat; map labels and journey steps no longer advertise walking delays.

- 2026-10-12: Approved compact stash icons, quantity labels and rarity colours; click an item to inspect its details and equip or use it.

- 2026-10-12: Replaced simplified stash symbols with painted, weathered object cutouts matching the shelter art; validated real alpha before preparing WebP assets.

- 2026-10-12: Approved and implemented three early team expeditions, four new enemy types, a one-card-per-enemy field guide, shared map/card metadata and a compact Expeditions UI. Team map markers use teal diamonds to distinguish them from solo exploration.

- 2026-10-12: Moved the mountain to the left and turned the vault entrance toward the right; removed the extra scene width and reduced the empty space above the rooms.

- 2026-10-12: Approved automatic combat for every new solo exploration, with a default one-time retreat below 30% HP after available carried healing. Added one rat to the Supermarket, one feral dog to the Workshop and one mudback crab to the Reservoir. Replaced abstract reduced-haul risk on new trips with real HP and combat outcomes; preserved existing pending trips and calm story visits.

- 2026-10-12: Approved a simpler shelter overview with less explanatory text and collapsible People details. Kept resource warnings, healing, crew assignments and equipment actions accessible.

- 2026-10-12: Approved continued World-page simplification: compact solo cards, native character selector, optional story details, concise map popovers and neighbour rows.

- 2026-10-13: Added three multi-stage midgame solo routes and their painted scenes, connected rifle/shotgun/military equipment and ammunition drops, enforced player-level admission, and moved team entrances off the solo geographic map into a separate painted team overview with dark spiral entrance markers.

- 2026-10-13: Increased .22 farm rifle base damage from 9–14 to 14–20 and service rifle from 14–20 to 20–28 so ammunition consumption offers better single-target damage. Existing scaling, ammunition use, military penetration and initiative rules remain unchanged.

- 2026-10-13: Improved Activity readability with collapsed chronological solo battle reports, explicit damage text, retained outcome snapshots and reconstruction of existing logs. Preserved original logs and server combat rules.

- 2026-10-13: Moved defeat-loss text into exploration details and added deduplicated clue/enemy-card acquisition events plus labelled recruitment, collection completion and journal links in Activity.

- 2026-10-13: Added spray-defence lessons after actual failed encounters, retained them in later destination details, and clarified protective equipment descriptions without revealing solutions on first departure.

- 2026-10-20: Correction to the 2026-10-12 merge entry: the `expeditions` merge (`8248034`) and the later playtest and balance commits are now on `origin/main`, so they are no longer held back. Still unconfirmed: whether migrations 11–15 were tried against a copy of production data.

- 2026-10-21: Approved and implemented server-side logging for crit 10 ("Logging"): one line per POST and per visit to another shelter, naming the acting account, who it was aimed at and the status, without passwords, message text or amounts. Logs stay on stdout, not in the database. Added `docs/decisions/0002-who-sees-and-changes-what.md` to record who may see and change what, and why.

- **2026-10-21** — User approved replacing guaranteed-entry raids and timed
  +5 defence help with character PvP and persistent reinforcement postings.
  Reuse combat equipment, healing and ammunition; retain equipment on defeat,
  cap theft, shield every raid, and protect recall/dismiss/report permissions.
  Tests cover door blocking, defender loadouts, restart persistence, migration,
  duplicate raids, concurrent aid slots and HTTP access control.

- **2026-10-21** — Approved Credits, NPC merchant and negotiated friend trades. Rare equipment and special supplies sell directly; Epic equipment is limited daily rotation. Implemented escrow, explicit acceptance/counteroffers, wallet ledger and capped earnings; no auction house.

- **2026-10-21** — Approved Journal and Trade presentation refresh. Journal separates active tasks from recovered clues, prioritises current objectives, and folds completed steps and supporting notes. Existing clue art becomes expandable evidence cards. Trade uses compact inspect-to-buy/sell item cards, a separate daily Epic counter, and clearer two-sided offers. All actions remain server-rendered forms with keyboard and no-JavaScript support; economy and quest rules unchanged.

- **2026-10-21** — Approved extending the card/button/disclosure presentation to Shelter, World, Expeditions, Activity and Collection, excluding Chat. Keep scene/map controls and gameplay rules; make secondary navigation explicit, fold collection evidence and older reports, and separate party creation from open parties. Shared presentation is scoped to game-page content so chat styles and controls remain unchanged.

- **2026-10-21** — Implemented Undelivered: two gated northern investigations, victory-only recovery of Helen’s missing cards, explicit forwarding and Ruth’s reply. Mags recruitment remains separate.

- 2026-10-21: Approved and implemented the chat, friends and party-invitation redesign ("Unified chat and friends", "Parties, friends and dispatch"): a conversation list with per-conversation unread counts, invitations shown in their conversation, player cards at `/players/:name` built from `publicShelter`, live-event refresh with a ten-second fallback instead of one-second polling, and buttons instead of inline links in chat. Invitation auto-accept lengthened from five to eight seconds. Party cards with built-in chat were part of the plan and are not built yet.

- 2026-10-21: Approved Mags as the second recruitable resident ("Empty Is Empty", under Quests): Strength 6 / Agility 3 / Constitution 4, a Crowbar; while working at home she cuts upgrade and repair scrap by 25%. Recruitment is her set, one new Workshop record (`mags-reply`), then asking her to stay. Residents' work becomes data on `RESIDENTS` so Toby and Mags share one code path.

- 2026-10-21: Revised Empty Is Empty to fit the main story: before warning Mags the player must read the Ash Hounds' ledger (`wade-ledger`) in the Weighbridge scale-house office, a new guarded story trip that opens after Undelivered's stolen post. The warning on her board is the main story's "Protect Mags" choice. Stats and work unchanged.

- 2026-10-21: Approved one existing Legendary as a collection-completion reward, on top of the XP and Credits, paid once per set by the same claim; earlier completions are granted once on the next load. Per-person Legendaries were offered and deferred.

- 2026-10-21: Approved recruits joining at the player's level minus two, the skipped levels as unspent points, and a one-time raise for residents who joined earlier.

### 2026-10-21 — Registration prologue

New registrations enter a replayable eleven-page prologue: three illustrated war
frames, seven illustrated aftermath pages, then a five-years-later introduction to Calder and four first-step links.
The war images are an evocative unnamed town, not documentary depictions of
Calder's strike timeline. Calder remains unstruck in canon. English captions,
optional reading pace, skip and Collection replay work without JavaScript; gentle
image movement respects reduced motion. No audio is bundled. The first-step
cards are a reference guide, not a tracked tutorial or new quest.

2026-10-21: Prologue replay moved into Collection as an always-available card,
with an illustrated door-and-book badge. The arrival page now has a dedicated
Calder shelter illustration. These are presentation assets, not new story clues.

2026-10-21: Added seven aftermath pages between the war and arrival: sheltering,
waiting, lost broadcasts, scavenging, new dangers, cooperation versus raiding,
and rebuilding. Anonymous survivors illustrate the wider world, without
revealing collection characters. Page count and skip target derive from content.

### 2026-10-21 — Background music

User-provided video.mp4 supplies music only. Its audio is approximately 157.4s;
energy rises around 75s. Ambient uses 0–73s, combat uses 76–154s, with faded
edges. Exported MP3 files are served locally; the original video is not needed
at runtime. This is a provisional musical cut based on signal analysis, not
an assertion of an exact compositional boundary.

Music is opt-in with volume and per-track position remembered in local storage.
Ordinary pages and comics use ambient; active fights, the player's current
team expedition, and opened battle/run reports use combat. Closing reports
restores ambient. Hidden tabs pause, social iframes do not create players,
and blocked autoplay leaves an explicit tap-to-play control. This changes
presentation only. No audio is generated or sent to an external service.

2026-10-21: Prologue and character-comic page turns now replace only the reader
content using normal server-rendered HTML. Music and its audio element remain
alive. Keyboard/swipe turns use the same links; reader handlers are cleaned up
between pages, history navigation works, and fetch failure falls back to normal
navigation. Navigation outside a reader still reloads the page; this does not
attempt to retrofit shelter animations or live game actions into an SPA.

- 2026-10-21: Approved claiming a collection's Legendary at the end of its comic: a gold reward panel with Accept (a form, an overlay with JavaScript), then a lead page pointing at that person's next quest step. The item's level is fixed when the set completes; earlier grants are unchanged.
- 2026-10-21: Approved one Legendary per story instead of a pick from the two existing ones: five named pieces built from existing kinds and traits, no new art, each with three traits and three bonuses so it beats a dropped Legendary. A piece already accepted keeps its name; one still waiting becomes the story's own.
- 2026-10-21: Approved four more named dropped Legendaries (Levy Stick, Rake's Pump, Ashby's Oilskin, Kestrel Lamp) with new signatures Toll, Last shell, Second wind and Dazzle, and let the two late team expeditions drop the named ones for half of their Legendaries.
- 2026-10-21: Approved at the user's request: everyone in the shelter scene has their name overhead (your own survivor too); clicking a person makes them say a line; people who are both there walk over and have short exchanges on their own, a guest seeking out their host on arrival. Players with the same portrait remark on it, and talk about records waits until they're found. Text is fixed and picked in the browser; it changes nothing in the game. Three painted figures drawn facing left were mirrored so everyone faces the way they walk.
