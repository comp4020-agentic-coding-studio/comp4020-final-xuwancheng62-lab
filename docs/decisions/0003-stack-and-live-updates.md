# 3. One server, a local database and live updates over SSE

- **Status:** Implemented; retrospective record
- **Recorded:** 2026-11-03
- **Scope:** The existing architecture, not a new implementation proposal

## Context

Holdout is a game for a small group playing together. Accounts, equipment and
discoveries must survive people leaving and returning. Players also need to see
each other's actions without refreshing the page.

The course deployment provides one Fly machine with 256 MB of memory and one
persistent volume at `/data`. The machine can stop when idle. These constraints
are recorded in [fly.toml](../../fly.toml).

This document brings together decisions already visible in the plan, code and
commit history. The alternatives below explain their trade-offs now; they are
not a claim that every option was prototyped or formally compared at the time.

## Decision

Use Node 24 and Hono to serve HTML and handle actions. Store durable game state
in SQLite on the persistent volume. Send normal actions through HTTP and push
live changes to connected browsers through server-sent events (SSE).

Calculate production and journey progress from saved timestamps when state is
accessed. Do not depend on a continuously running game loop. Authentication and
game outcomes stay on the server. Related database changes happen in a
transaction, and live events are published after it commits.

## Alternatives and trade-offs

### SQLite or a separate database service

SQLite keeps the game and its data within the supplied deployment. It avoids
another service to configure and lets related changes commit together. The
current implementation uses WAL and `BEGIN IMMEDIATE` transactions.

A separate database could support several application servers, but would add
infrastructure outside the supplied one-machine setup. SQLite is a good fit for
this game's current size, not a claim that it is the best choice at every scale.
Writes are serialised, so long transactions can delay other players. Volume
storage also does not replace backups or careful migration checks.

### Server-rendered pages or a client-rendered application

Hono renders pages and handles forms in the same application as the game rules.
The initial account, resource and exploration loop did not need a separate
client application and API representation of every screen.

A client-rendered application could make complex screen transitions easier to
coordinate. The cost of our choice became clearer as the game grew: browser
scripts now handle animations, live updates and navigation behaviour. Keeping
those updates consistent with server-rendered HTML needs care. Server rendering
does not remove the need for browser testing.

### SSE or WebSockets and polling

Players already submit actions through HTTP. SSE provides the other direction:
the server tells open browsers what changed. WebSockets could carry both
directions, but this game does not need continuous movement input from players.
Frequent polling is another option, at the cost of repeated requests even when
nothing changes.

The SSE channel registry lives in memory in one server process. This matches
the current deployment, but would not distribute events across several servers.
Events are not a durable history or a replay log. The database remains the source
of truth; reconnecting and restoring the correct screen need testing as well as
delivery while connected.

### Saved timestamps or a continuous game loop

A loop cannot advance the game while the machine is stopped. Saved timestamps
let the server calculate elapsed production or resolve a due journey when the
state is next accessed. Passing time into game rules also makes them testable.

The trade-off is that an event due while nobody is connected may only be settled
on a later request. Each settlement must avoid paying the same reward twice.
SSE heartbeats and temporary visitor-presence timers still exist; the decision
is about durable game progress, not a ban on every server timer.

## Evidence and checks

- [Initial plan, `f53fa69`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/f53fa69)
  records the initial direction. [Stage 1, `8e7df83`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/8e7df83)
  adds the account, database, resource and journey implementation.
- [Multiplayer, `c44d17d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/c44d17d)
  adds raids, reinforcement and live updates.
- [CLAUDE.md](../../CLAUDE.md) requires server-owned outcomes, timestamp-based
  progress, transactions and publication after commit.
- [alive.test.ts](../../spec/alive.test.ts) checks that a journey survives logout
  and login. That is not, on its own, a restart or redeployment test.
- [raid.test.ts](../../spec/raid.test.ts) checks concurrent raids, repeated
  requests and live delivery. [presence.test.ts](../../spec/presence.test.ts)
  checks visitor arrival through the event stream.

These tests support individual claims. They do not establish performance under
arbitrary load or prove the deployed interface updates within a second on a slow
connection. Final acceptance still needs two independent browser sessions and
checks across restarts and redeploys.

## Related decisions

- [0001: Concurrent raids](0001-concurrent-raids.md) explains what simultaneous
  actions should mean for players, beyond preventing database corruption.
- [0002: Visibility and permissions](0002-who-sees-and-changes-what.md) explains
  which state each account may see and change.
