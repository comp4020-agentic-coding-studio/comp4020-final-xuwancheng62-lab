# Plan

A post-apocalyptic shelter survival game. Each player owns one shelter, keeps
it alive (Food, Water, Power, Scrap), and leaves it to scavenge the wasteland —
and **while you're away, your shelter is undefended**. That tension is the
thesis: it's what makes other players matter.

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

A destination has a distance and bearing from home, explore time, danger (0–1), and a loot table. Travel time is the distance at `TRAVEL_SEC_PER_KM` (30 s a km), so the World map and the clock always agree.
Phase comes from timestamps: before `arrive_at` Traveling, before
`explore_until` Exploring, before `return_at` Returning, after that the next
read resolves it (loot in, log line) → At Shelter. Loot is rolled at
resolution with an RNG seeded by the journey id, so it's deterministic. Danger
is the chance of coming back with half, or nothing. Round trips are 2–10
minutes; `TIME_SCALE` speeds them up for local testing.

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
is undefended meanwhile. **Reinforce** (help) is instant and doesn't take you
away (allowed even while you're out): +5 defence for 30 min, max 3 stacked.
Stealing crops waits until crops exist.

### Visibility

Public: username, shelter level, owner At Shelter / Away, security band
(Low/Medium/High), resource bands (Plenty/Some/Scarce/Empty; until stealing
exists they're measured from zero), generator/purifier running, crops ready
yes/no, shielded/reinforced. Private: exact numbers,
rates, journey details, log. One whitelisting serializer builds every public
view.

### Steal

Every raid gets in; how much comes out depends on raid strength.

```
ownerHome = no active journey
defence   = 15 + (ownerHome ? owner.combat_power : 0) + 5·reinforces
strength  = clamp(attack / (attack + defence), 0.10, 0.85)
luck      = 0.5 + crypto.randomInt(1001) / 1000          (0.5–1.5)
spare     = floor(stock) − 20
haul      = min(15, spare, floor(spare · strength · luck))
```

A strong raid carries out a lot; a weak one, or a raid on a shelter near the
minimum, can come back with nothing. A haul above zero sets the target's raid
shield (5 min). Every raid writes an activity row and a live event for both
players and costs the cooldown.

### Concurrency and validation

Each interaction runs in one synchronous `BEGIN IMMEDIATE` transaction:
settle both shelters → checks → conditional update → interaction row → two log
rows → commit → publish events.

- Simultaneous steals: `UPDATE … WHERE stock - :n >= 20` must change exactly 1
  row, and the raid shield blocks the second raider.
- Over-asking: the client never sends an amount.
- Repeats: form `request_id` + unique index returns the stored result.
- Cooldowns: 2 min per attacker, 10 min per attacker→target, 1 h per
  helper→target.
- Self-steal → 400. Attacker away → 409. Crop double-steal: conditional
  update on the plot.
- Allowed-list for inputs, Origin check, server-side randomness with stored
  chance/roll.

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
rest. PvP (raids, reinforce, `combat_power`) is unchanged.

### Character

One survivor per shelter, in `characters` (migration 6): level, xp, unspent
points, strength, agility, max_hp, hp (REAL), hp_at, meal_at.

- HP starts at 100 of 100. Zero is defeat and a wounded return, never death.
- **Strength** (starts 5): damage = weapon roll + Strength; carrying capacity
  = 20 + 4 × Strength (+15 with the backpack).
- **Agility** (starts 5) shortens only the exploring leg:
  `explore = max(base × 0.5, base / (1 + 0.05 × agility))`, then the usual
  `TIME_SCALE`. Travel each way is unchanged. All of a journey's timestamps
  are written at departure; later changes to gear or attributes never move an
  active journey. Agility doesn't touch escape or combat in this version.
- **Experience**, awarded once, inside the transaction that resolves the trip
  or the fight: a trip home from Supermarket or Reservoir 8, Workshop 10, Nest
  12; beating the beast +25; escaping it +8; defeat 0. The next level needs
  40 × current level (L2 at 40, L3 at 120, L4 at 240 …), up to level 10. Each
  level gives one point, spent at the shelter on +1 Strength, +1 Agility or
  +10 max HP. Safe trips alone level you, so fighting is never the only way up.

### Gear

`items` (shelter_id, kind, equipped, created_at), `UNIQUE(shelter_id, kind)`:
a player owns at most one of each kind, so an item is in exactly one place,
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

### The scavenger beast

One creature, at the Creature Nest: 55 HP, bite 8–15. It's met halfway
through exploring (`encounter_at`, written at departure). Before that, the
World card and the trip page warn of it, and the Nest card says, before you
leave: "Defeat means losing all equipped gear and supplies collected on this
trip." Travelling anywhere needs 20 HP.

By the time it appears you've collected the Nest's supplies (rolled from its
loot table, seeded by the journey, capped by capacity). The beast's hoard is
food 6–12 and scrap 4–8, on top, if you win. The old danger roll doesn't apply
to a journey with an encounter; journeys without one are exactly as before.

### Journey and encounter states

```
outbound ─arrive_at→ exploring ─encounter_at→ awaiting decision
awaiting ─attack→ combat ─attack…→ won | defeated
awaiting ─escape→ escaped | combat (escape failed; locked)
won | escaped | defeated → returning ─return_at→ home (deposit, xp)
```

- Phase is still read from timestamps, but while the encounter is unresolved
  and `now ≥ encounter_at`, the phase is **encounter** and nothing advances:
  no timer finishes it, the beast never acts without a player action, the
  survivor stays away and the shelter unguarded, and resources settle as
  usual. A page load, a logout or a restart shows the same state.
- Resolving rewrites the journey's remaining timestamps: exploring ends now,
  `return_at = now + travel`. Winning ends the search too, since the hoard was
  the prize.
- A turn: the player's attack (weapon roll + Strength) lands; if the beast
  survives it bites back (roll − armour, at least 1). HP ≤ 0 on either side
  ends the fight.
- **Escape**: once per encounter, before or during a fight, 50%, shown as
  "50%". Before trying, the page says: "Escape success preserves your gear and
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

Revised 2026-10-09: the collapse is a **nuclear war**, not a drought or the
Loop. Calder Valley wasn't struck; it lay downwind of nearby strikes.

- **Setting.** Fictional Calder Valley, inland south-eastern Australia. The
  war day is Tuesday 9 March, Y0 (early autumn), "the Ninth". It is now
  autumn, Y+5. Ages then → now: Ruth 61 → 66, Helen 38 → 43, Dev 34 → 39,
  Mags 72 → 77, Toby 11 → about 16. The warring powers are never named.
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

Trading, alliances, revenge raids, crafting, item durability or affixes,
character classes, PvP combat changes,
off-app notifications, leaderboards, multi-machine, starvation penalties.

## Revision history

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
