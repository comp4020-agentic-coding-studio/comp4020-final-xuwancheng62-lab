# 1. When several people raid the same shelter at once, the first raid wins

- **Status:** Accepted, and implemented
- **Date:** 2026-10-07
- **Crit:** 9, "All at once"

## Context

Holdout is played by about a dozen people in one room, at the same time. A
shelter whose owner has just left shows up on everyone's Survivors list as
*Owner away* within a second, and is easier to rob, so several people can see
the same chance and press **Raid** within the same second. That is the moment
the game is built around ("while you're out there, nobody is home"), so it
happens often.

The server already prevents the worst outcome mechanically. Every raid runs in
one `BEGIN IMMEDIATE` transaction, the client never sends an amount, and the
update that takes stock refuses to leave less than 20. So the question isn't
whether simultaneous raids corrupt anything. It is **what the game should do
with the second, third and fourth raider**, and what the target comes home to.

`README.md` decides what matters here:

- *"Consequences must remain proportionate. A raid can create a setback or a
  reason to respond, but should not casually erase the shelter another person
  has spent a session building. Players need room to recover and choose
  again."*
- *"Other players should matter as people whose actions can be remembered."*
  A target should be able to say who robbed them.

## Options considered

1. **First to commit wins, then a guard goes up.** The first raid is resolved
   normally. If it carried anything out, the target's guard is up for 5
   minutes, and every later raid is refused with the reason ("They were just
   raided and their guard is up for …"). A refused raid costs the raider
   nothing: no trip, no cooldown, no log line.
2. **Queue them.** Every raid lands, in commit order, each against whatever
   the previous one left, still never below 20.
3. **Share one haul.** Raids that arrive within a short window are combined:
   the target loses one raid's worth, split between the raiders.
4. **Each raid stands alone.** No guard. Every raid takes its own haul, and
   only the floor of 20 limits the total.

## Decision

**Option 1: the first raid to commit wins, and the target's guard goes up for
5 minutes after any raid that took something.**

Measured against the README:

- **Proportionate.** At most one haul (15 at most) per 5 minutes, however many
  people pile in. Options 2 and 4 let four people take 60 in one second,
  leaving a shelter at its floor before the owner has walked anywhere. That is
  the "casually erase" the README rules out, done by the timing of clicks
  rather than by anyone's choice.
- **Remembered.** The target's log names one person. Under option 3 a share
  of 4 from each of three people is hard to hold against anyone, and the
  relationships the game is about blur.
- **Room to recover.** The guard gives the owner 5 minutes to get home, ask a
  neighbour to reinforce, or simply see what happened before the next raid.
- **Fair to the losers.** A raider who arrives second loses only a click. They
  keep their cooldown and stay home, so they can choose again at once, which
  the README asks for on both sides.

## Consequences

- **A race decided by milliseconds.** Who gets the haul depends on who clicked
  first, not who planned better. In a room of people that reads as luck, and
  is visible as luck ("Sam got there first").
- **The second raider finds out only when they click.** The guard shows only
  on the shelter's own page (*Guard up*, with a countdown), not on the
  Survivors cards, and only once that page is loaded. The raid itself updates
  the target's stock levels live for anyone looking in, but an open visit page
  keeps its Raid button and gains no *Guard up* chip until a reload. The
  status event already carries `shieldedUntil`, and `static/live.js` ignores
  it. Showing the guard live is a small follow-up, not part of this decision.
- **A raid that takes nothing raises no guard.** If the first raid comes back
  empty (a weak raid, or a shelter already at 20), the next raider may try.
  That is deliberate: nothing was lost, so there is nothing to recover from.
- **Friends can't coordinate a heist.** Two players who agree to hit the same
  shelter together get one haul, not two. Group raids, if they're wanted, would
  need to be their own action rather than an accident of timing.
- **The guard is the only rule holding this.** If the 5-minute guard is ever
  shortened for pacing, the pile-on comes back. Change it in
  `src/game/config.ts` (`RAID.shieldAfterRaidMs`) knowing that.

## How it's held

- `spec/raid.test.ts`, "from several raiders at once never take the target
  below the floor or more than one haul": four raiders hit one shelter in
  parallel. Every response is a success or a 409, the target stays at or above
  20, what the raiders gained equals what the target lost, and the target's log
  records at most one raid.
- `PLAN.md`, "Concurrency and validation" and "Steal", for the transaction and
  the haul formula.
