# Holdout

A small survival game for a room full of people. Each of you keeps one shelter
alive — Food, Water, Power, Scrap — and goes out into the wasteland for what
you can't make. **While you're out there, nobody is home.**

Play it at <https://comp4020-final-xuwancheng62-lab.fly.dev/>.

## What good means here

Holdout is good if **every trip out of the shelter is a real decision.** You
leave because you need something; leaving costs you your defence. Everything
else serves that one tension.

That breaks down into claims, and each one says how it's held:

1. **Your shelter is still yours when you come back** — the stores, the trip
   and the log survive closing the tab, logging out and redeploys.
   *Enforced:* `spec/alive.test.ts`.
2. **Being away is visible and binding.** You can't be in two places: one trip
   at a time, and the header always says where you are. *Enforced* (one trip):
   `spec/alive.test.ts`. *Judged* (always visible): the crit.
3. **Time is short enough to play together.** A round trip is 3–7 minutes, not
   hours, so a crit pod or a showcase room sees the whole loop in one sitting.
   *Judged.*
4. **The game is honest.** The server decides every outcome; the browser can't
   ask for more loot. *Held by* `CLAUDE.md`; *enforced* for stealing in
   Stage 2.
5. **Your state reads at a glance**, on a phone as well as a laptop: what's
   running, what's running out, where you are. *Judged.*

Claim 2's tension only fully matters once other players can reach your shelter.
That's Stage 2: visiting other shelters, stealing, helping, and seeing it all
happen live.

## Who it's for

A dozen people in the same room for an afternoon: a crit pod, a showcase
crowd. Small enough that you know whose shelter you're raiding.

## What I looked at

<!-- TODO before the crit: replace this comment with what you actually read or
     played while deciding what good means (games, sites, the brief's notes on
     good), and what you took from each. -->

- *Fallout Shelter*, as the obvious median answer to "shelter management": the
  thing to avoid becoming. It's a solo resource sim with hours-long timers;
  Holdout keeps the resources but cuts the timers to minutes and makes the
  shelter matter to *other people*.

## What I chose not to build

- **No death or starvation penalty** yet. Running dry shows a warning; there's
  no reason to punish players until other players can push them there.
- **No trading.** It would make the game about deals, not about leaving home.
- **No email, profiles or avatars.** An account is a name and a password;
  that's what counts as a person here.
- **No hours-long timers.** They suit an idle game, not a room playing at once.

## How it's built

Node 24 + Hono, server-rendered pages, SQLite on the Fly volume. Nothing ticks
on the server: resources and journeys are worked out from timestamps whenever
you load a page, because the machine sleeps when nobody's playing. `PLAN.md`
has the design, and `PROCESS.md` has why.
