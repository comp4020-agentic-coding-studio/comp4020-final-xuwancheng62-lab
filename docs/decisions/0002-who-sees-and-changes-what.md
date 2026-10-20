# 2. Who may see and change what is decided by the server, from the session

- **Status:** Accepted, and implemented
- **Date:** 2026-10-21
- **Crit:** 10, "Fly by instruments"

## Context

Holdout is played by a room of people at once, each in their own browser, all
acting on one database. Crit 10 asks that what each person may see and change
is checked on the server and written down with why. `README.md` sets the
terms:

- the game is about other shelters you can *see* and *act on*, so some of
  another player's state has to be visible;
- but a raid should be "a setback or a reason to respond", not a wipe, and
  players read each other as people, not as spreadsheets. Exact stock, rates
  and plans would turn every visit into arithmetic.

## Decision

**A person is an account.** Registering makes a user and a shelter; the
`sid` cookie is a random token whose hash is in `sessions`. Every request
looks the user up from that cookie (`src/server.ts`, the session middleware).
No form field ever says who you are or which shelter is yours: a handler
takes the user id from the session and finds the shelter from it.

**What you may see of someone else** is built by one function,
`publicShelter` in `src/public.ts`, and every page and live event about
another shelter goes through it. It shows owner name and portrait, home or
away, whether anyone is keeping watch, resource *bands* (Plenty / Some /
Scarce / Empty), whether the generator and purifier run, a security band,
shield and reinforcement, crop stages, facility tiers and door condition.
It never shows exact stock, rates, journeys, crew, items or the activity log.
Your journal, collection, stash and log are read only by your own id.

**What you may change of someone else** is a short list, each checked inside
the action's `tx()`:

| Action | Who may | Server check |
|---|---|---|
| Raid a shelter | anyone but its owner | `steal` refuses your own shelter (400); the amount is rolled on the server and never leaves less than `RAID.protectedMin` |
| Reinforce a shelter | anyone but its owner | `help` refuses your own shelter (400); the gain is computed on the server |
| Talk at a shelter | anyone | `say`; text is stored as text |
| Private message | friends only | `canConverse` (403 otherwise) |
| Party chat | seated members only | `canConverse` (403 otherwise) |
| Send a friend's character on an expedition | a party member who is that person's friend, only if the friend switched dispatch on, only their chosen character, no riskier than they allowed | `dispatchInTransaction` (403 / 409) |
| Answer a party invitation | its recipient only | `answerInvite` (403) |
| Remove someone's character from a party | its owner, or the party's leader | `leaveSeat` |

Everything else (building, crafting, gear, crops, training, crew tasks) acts
only on the session's own shelter, because the shelter is looked up from the
user id and never from the form.

## Why

- **Bands, not numbers.** A visitor can tell a rich target from a poor one,
  which is what makes "while you're away, nobody is home" a real choice. But
  they can't plan a raid to the unit, and the owner keeps something private.
- **One whitelist function.** Adding a column to a shelter can't leak it by
  accident: it shows up for others only if `publicShelter` is changed.
- **Ownership from the session, never the form.** A handcrafted POST can name
  any shelter or party, but the server still acts as the logged-in user, so
  the worst a forged form does is ask for something that gets refused.
- **Dispatch is consent given in advance.** Letting friends send your character
  while you're offline is what makes cooperation about trust, not about being
  online together. The owner sets the character, the risk ceiling and the
  supplies kept, and can recall the character before departure.

## How it's held

- `spec/visit.test.ts` and `spec/raid.test.ts`: another shelter's page has
  no exact numbers; raids refuse your own shelter and leave the protected
  minimum.
- `spec/social.test.ts`: private and party conversations refuse outsiders.
  The recipient-only rule for invitations is held in `answerInvite` but has
  no HTTP check yet.
- `spec/logging.test.ts`: the server log names who acted and on whom, and
  records refused attempts with their status. So a refused attempt to change
  something of someone else's shows up in `flyctl logs` (see `PLAN.md`,
  "Logging").
