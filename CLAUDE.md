# Holdout — rules for the agent

`README.md` says what good means for this game; `PLAN.md` is the approved
design. These rules follow from them.

## The game must never

- let the client decide an outcome. Loot, steal results and amounts are
  computed on the server; a form sends *what* the player wants to do, never
  *how much* they get.
- run a background timer to advance the world. The Fly machine sleeps when
  idle, so anything time-based (resources, journeys, crops) is computed from
  stored timestamps when it's read.
- show another player's exact stock, rates, journey or log. Public views are
  built by one whitelisting function (Stage 2).
- let resources go below zero, or below the protected minimum when stolen. This is how raids keep losses limited
  ([raid checks](spec/raid-rules.test.ts)).

## Every change must

- put tunable numbers in `src/game/config.ts`, not inline.
- keep game rules in `src/game/` as pure functions that take `now`.
- change state only in POST handlers, inside one `tx()`; publish real-time
  events only after the commit.
- work without JavaScript. `static/app.js` only animates between loads.
- hold at 360 px wide with visible keyboard focus and 44 px tap targets.
- escape all user text (`hono/html` does this; never wrap user input in `raw`).

## Process

- `pnpm check` (typecheck + `spec/` against the running app) is green before
  every commit. Never delete or weaken `spec/invariants.test.ts`.
- HTTP specs reach the app through the runner’s configured `baseUrl` (via
  `inject('baseUrl')` or a shared helper). A hard-coded host can test the wrong app.
- A new promise the app makes gets a check in `spec/` that asserts behaviour
  over HTTP, not implementation.
- Commit after each working step, with a message that says why.
- Implementation has started: any departure from `PLAN.md` is proposed and
  approved first, then the section is updated in place and a dated entry is
  added under "Revision history" at the bottom.
- Never commit `mise.local.toml` or any token.
- When adding a runtime file read, include the file in Dockerfile and verify
  the production image starts. In-process tests cannot detect missing image files.
- Run locally with `pnpm dev` (database in `./data`); set `TIME_SCALE=30` to
  speed journeys up.
