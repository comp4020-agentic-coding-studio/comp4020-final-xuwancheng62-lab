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

## Harness

`CLAUDE.md` turns README's claims into rules: the server decides outcomes, no
background timers, tunable numbers in one file, pages work without JS. It
also says `PLAN.md` is now frozen, with changes logged.
