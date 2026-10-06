# Process overview

## From brief to plan

The brief asks for a multi-user, real-time website that's good. I picked a
shelter survival game and split it into two stages: Stage 1 (crit 8) is the
single-player loop with persistence, and Stage 2 (crit 9) adds other players and
real-time. Before any code, the agent inspected the template and wrote a plan
for each stage. I reviewed both, and the approved version went into `PLAN.md`
([`f53fa69`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/f53fa69)).

Two kinds of pushback in planning changed the design:

- **Deadline vs. scope.** Stage 1 as first written (crops, three facilities,
  four destinations) wasn't going to land before crit 8. The plan was cut to a
  crit 8 slice (accounts, shelter, journeys), with crops after.
- **"Good" before features.** A shelter-management game is close to the median
  answer the brief warns about. The plan made "while you're away, nobody is
  home" the thesis, because it's the one idea that needs other players.

## Stack decision

**Context.** `fly.toml` fixes one 256 MB machine that sleeps when idle, with
one volume at `/data` and no separate database server.

**Decision.** Node 24 running TypeScript directly, Hono, pages rendered on the
server, and SQLite (built-in `node:sqlite`) on the volume.

**Why.**
- A sleeping machine can't run a game loop, so every time-based value is
  worked out from timestamps on read. That needs a real database with
  transactions, not a JSON file.
- SQLite is the only database the setup allows. The built-in module needs no
  native build step in the Docker image.
- Forms rendered on the server mean every action is a POST the server checks,
  which is what "the server decides" (README claim 4) requires. It also keeps
  the app usable without JavaScript.
- `node:sqlite` is synchronous, so a transaction can't be interleaved inside
  one process. That makes the Stage 2 concurrent-steal rules simpler to get
  right.

**Cost.** No client framework, so live updates in Stage 2 are hand-written.
The plan changed from WebSockets to server-sent events for that reason: all
live traffic goes server → browser.

## The build

- The Stage 1 loop
  ([`8e7df83`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/8e7df83)):
  accounts, a shelter that settles its resources minute by minute since the
  last visit, and journeys whose phase comes from timestamps.
- Crit 8's "alive" spec line as a test
  ([`31c278c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/31c278c)):
  register, leave, log back in with a fresh session, and find the trip. On its
  first run it failed because the page HTML-escapes the apostrophe in
  "name's shelter". The fix was to compare page *text*, the way the course's
  README check does.
- Persistence was checked by hand as well: register, start a trip, restart the
  container on a real volume, and the session and trip were both still there.

## From a working system to a shelter

Looking at the deployed Stage 1, I was reading tables, not inhabiting a place
(the reflection in `reflections/crit-8.md` is about that gap). From here I
directed the agent with briefs that described the experience, not just the
feature: what the player should understand at a glance, what was out of
scope, and how to verify it.

- The Shelter page redesigned as a lit bunker cutaway
  ([`75c6608`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/75c6608)).
  My brief limited it to one page and required checking it at phone and
  desktop widths in three states (home, away, out of supplies). That check
  caught the storage room saying "Running low" when its stock was already 0.
- The shelter as a living scene, and looking into other shelters
  ([`5d5e818`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/5d5e818)).
  A survivor who walks, inspects and climbs needed one consistent floor plan,
  so the cutaway was redrawn with floors joined by a ladder. Checking it in a
  real browser caught three faults: a lamp glow that spilled over the sky, item
  labels overflowing a 360 px screen, and a scroll that the sticky panel
  silently ignored. Another player's shelter is built from one function that
  copies only public fields.
- Raiding, reinforcing and live updates
  ([`c44d17d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/c44d17d)).
  The server decides every outcome inside one transaction; a repeated request
  counts once; the 20-unit floor is enforced by the database update itself.
  Live updates use server-sent events rather than WebSockets, because all live
  traffic goes server → browser. One departure from the plan is logged in
  `PLAN.md`: the new-player shield was dropped, since it would have made every
  freshly registered test target impossible to raid.
- Every raid now gets in
  ([`4fa5425`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/4fa5425)).
  Playing it, a failed roll felt like nothing happened. I changed the rule so
  strength decides how much comes out, which can still be nothing, and the
  rule got its own tests.
- What good means, rewritten
  ([`e48c215...bf28bbf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/compare/e48c215...bf28bbf)):
  from one tension to a shelter, a world and neighbours worth knowing, with a
  section separating what this version supports from what it doesn't yet.

**Scope.** The agent pushed back twice: once to finish crit 8's evidence
first, and once against building, upgrades and cosmetic facility outfits,
because none of them served the thesis yet. I cut the outfits, deferred
building, and chose to do the scene and the multiplayer loop before the
evidence. The README's status section is where that restraint stays visible.

## Harness

`CLAUDE.md` turns README's claims into rules: the server decides outcomes, no
background timers, tunable numbers in one file, pages work without JS. It
also says `PLAN.md` is now frozen, with changes logged.
