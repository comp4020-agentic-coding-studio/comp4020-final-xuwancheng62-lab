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

A destination has travel and explore times, danger (0–1), and a loot table.
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

Crit 9 decision record: `docs/decisions/0002-concurrent-raids.md` (shield vs
queue vs first-to-commit).

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

Trading, alliances, revenge raids, gear/upgrades,
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
