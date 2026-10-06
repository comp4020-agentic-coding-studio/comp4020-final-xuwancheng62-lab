# Holdout

A small survival game for a room full of people. Each of you keeps one shelter
alive — Food, Water, Power, Scrap — and goes out into the wasteland for what
you can't make. **While you're out there, nobody is home.**

Play it at <https://comp4020-final-xuwancheng62-lab.fly.dev/>.

## What good means in Holdout

Holdout is good when survival is more than keeping numbers above zero. Players should build a home they care about, uncover what happened to the world, and shape their relationships with other shelters through meaningful choices. Its success depends on whether these activities give each other purpose: building creates reasons to explore, exploration creates opportunities for exchange, and relationships change what players choose to do next.

### A shelter worth returning to

The shelter should feel like a place the player inhabits and gradually changes. A character moving through rooms, machinery operating, and construction taking shape make that change visible. These details should also communicate useful information: a stopped generator explains a power shortage, an unfinished room shows an investment in progress, and an absent character makes being away noticeable.

Building should involve priorities. Spending scrap on a new device might improve future production, but leave less available to keep existing equipment running. A good decision has understandable consequences and more than one reasonable answer.

### A world worth exploring

Players should leave home because they are curious as well as because they need supplies. Abandoned shelters, damaged infrastructure, and scattered records can reveal fragments of what happened. Each discovery should contribute to a larger picture while providing a reason to investigate further.

Information should sometimes change what a player can do. A maintenance record might identify another location; a warning might reveal a dangerous route; conflicting accounts might make an earlier discovery uncertain. The world’s history should emerge through exploration, with enough connections for players to develop and revise their own understanding.

### Other shelters worth knowing

Other players should matter as people whose actions can be remembered. Helping a struggling shelter, requesting supplies, or stealing from a neighbour should influence how players understand and respond to one another.

These choices become interesting when circumstances create competing needs. A player facing a food shortage might ask for help, offer something in exchange, take another expedition, or attempt a robbery. The game should make those alternatives understandable without assigning a simple moral score. Generosity can be costly, cooperation can be practical, and an aggressive choice can damage a relationship the player later needs.

Consequences must remain proportionate. A raid can create a setback or a reason to respond, but should not casually erase the shelter another person has spent a session building. Players need room to recover and choose again.

### Trade as negotiation

Trading should let players express what they need and what they are willing to give up. Different supplies, discoveries, and construction plans create different valuations. Players should be able to propose an exchange, reject it, or make a counteroffer.

A successful trade does not require both sides to value the goods equally; it requires both sides to willingly accept the terms. The interface must make those terms clear, and the system must honour the agreed exchange. Trust should arise from players’ decisions and experiences, supported by reliable game rules.

### How I will judge it

These are design goals, and each version should distinguish what it already supports from what remains to be built. I will judge progress through short play sessions: can players explain their next goal, recall a discovery that changed their plans, and describe a decision involving another shelter? Do they have something they want to return to?

Holdout succeeds when players leave with a story about a place they built, something they discovered, and someone they chose to trust—or chose not to.

## Where this version stands

What the deployed game supports today, against each goal above. *Enforced*
means a check in `spec/` holds it on every deploy; *judged* means only playing
it can tell.

**A shelter worth returning to**

- Supported: your survivor walks, inspects and climbs through the rooms; the
  generator and purifier visibly run or stop, and their panels say why; the
  shelter goes dark without power; your survivor is gone while you're out.
  *Judged.*
- Supported: your shelter, trips and log persist across sessions and
  redeploys. *Enforced:* `spec/alive.test.ts`.
- Not yet: building, unfinished rooms, and spending scrap on priorities.
  Scavenging currently only keeps upkeep going.

**A world worth exploring**

- Supported: four destinations with timed trips, danger and loot.
- Not yet: discoveries, records, or information that opens new places.

**Other shelters worth knowing**

- Supported: looking into another shelter shows only rough levels and never
  moves your survivor. *Enforced:* `spec/visit.test.ts`.
- Supported: raiding and reinforcing, decided by the server; the other player
  sees it within a second. *Enforced:* `spec/raid.test.ts`.
- Supported: proportionate consequences. Every raid gets in, but takes at most
  15 and never leaves a shelter below 20, and a robbed shelter is shielded for
  5 minutes. *Enforced:* `spec/raid-rules.test.ts`, `spec/raid.test.ts`.
- Partly: actions are remembered only as lines in each player's log.
- Not yet: requesting supplies.

**Trade as negotiation**

- Not yet.

**How I will judge it**

- Short play sessions with my crit pod, asking the questions above. *Judged.*

## Who it's for

A dozen people in the same room for an afternoon: a crit pod, a showcase
crowd. Small enough that you know whose shelter you're raiding.

## What I looked at

- *This War of Mine* (11 bit studios, 2014), for survival as a question about
  human nature. Scavenging there means deciding what you're willing to do to
  other people to get through the night, and the game lets those choices
  weigh on you without scoring them as good or evil. That's where Holdout's
  "without assigning a simple moral score" comes from: helping, asking and
  raiding are all reasonable answers to the same shortage, and the
  consequences, not a meter, show what they cost.
- *Fallout Shelter*, as the obvious median answer to "shelter management": the
  thing to avoid becoming. It's a solo resource sim with hours-long timers;
  Holdout keeps the resources but cuts the timers to minutes and makes the
  shelter matter to *other people*.

## What I chose not to build

- **No death or starvation penalty** yet. Running dry shows a warning; there's
  no reason to punish players until other players can push them there.
- **No email, profiles or avatars.** An account is a name and a password;
  that's what counts as a person here.
- **No hours-long timers.** They suit an idle game, not a room playing at once.

## How it's built

Node 24 + Hono, server-rendered pages, SQLite on the Fly volume. Nothing ticks
on the server: resources and journeys are worked out from timestamps whenever
you load a page, because the machine sleeps when nobody's playing. `PLAN.md`
has the design, and `PROCESS.md` has why.
