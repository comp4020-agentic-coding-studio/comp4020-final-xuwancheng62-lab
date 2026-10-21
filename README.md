# Holdout

A small survival game for a room full of people. Each of you keeps one shelter
alive — Food, Water, Power, Scrap — and goes out into the wasteland for what
you can't make. **When everyone's out there, nobody is home.** Who you send
and who you leave on watch is the choice.

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
- Supported: someone living with you, as a full character. Once Toby joins
  he has his own health, stats, level, gear and trips, managed from "Your
  people" on the Shelter page. At home he keeps guard, or works the purifier
  (+4 water an hour) and counts half; he eats 1 food an hour either way, and
  you can give him gear from storage. He goes out on his own trips, even
  while you're out on yours, and fights the Nest's beast with his own
  numbers (the dogs know him: 80% to get away). The shelter is unguarded
  only when nobody's home; he still hides from visitors.
  *Enforced:* `spec/crew.test.ts`, `spec/quests.test.ts`.
- Supported: a greenhouse. Planting costs water, growing crops keep drawing
  water and power, and the harvest is food, so every planter is a choice
  between eating later and drinking now. *Enforced:* `spec/greenhouse.test.ts`.
- Supported: your survivor says what they notice about each thing they
  inspect, from its real state ("Scrap's nearly gone."). *Judged.*
- Not yet: building, unfinished rooms, and spending scrap on priorities.

**A world worth exploring**

- Supported: twelve destinations with timed trips, automatic encounters and loot.
- Supported: a map of the world. Each place is pinned at its real distance
  from home. Travel is immediate for demos; exploration still takes time.
  Hovering a place shows its photo and what you may find. Solo locations use
  amber circles; team destinations have a separate illustrated team map with spiral entrance markers.
  *Enforced:* `spec/world-map.test.ts`.
- Supported: a survivor with health, Strength, Agility, Constitution and
  levels (to 20), changed only at home. Agility shortens exploring, not
  travel; Strength sets melee damage and how much you carry; max HP comes
  from Constitution (+5 a point) and Strength (+2), never from levels, and
  no gear swap can heal anyone. Health comes back with rest, or faster
  with a meal. *Enforced:* `spec/character-rules.test.ts`, `spec/gear.test.ts`,
  `spec/constitution.test.ts`.
- Supported: items worth finding. Twenty-four kinds of weapon, armour and
  tool, from a wooden stick to a recoilless launcher, each with a level
  (baseline power) and a quality, Common to Legendary, written out and
  coloured, that adds rolled bonuses and traits. Origin (Improvised, Police,
  Military…) is a separate label. Kinds differ in how they play: reach,
  ammunition and noise, Agility penalties, sealed suits, light. Every trip
  turns something up for the shelter's shared stash, which keeps duplicates.
  Each card compares the item with what each person has on, and says what's
  needed to use it. Belts carry bandages, smoke and flares into a fight;
  packs carry ammunition, at the cost of carrying room. Materials have uses:
  cloth into bandages, nails into a nail bat, duct tape on the hatch seal,
  sorbent into the purifier. A defeat loses everything carried, never the
  stash. *Enforced:* `spec/items.test.ts`, `spec/encounter.test.ts`.
- Supported: one scavenger beast at the Creature Nest, warned of before you
  leave. Mid-trip the journey stops until you fight it turn by turn or take
  your one chance to run. Defeat costs your equipped gear and the trip's
  supplies; a clean escape keeps half. Every roll is the server's and a turn
  can't be replayed. *Enforced:* `spec/encounter.test.ts`.
- Supported: records left behind by the people who lived here. Thirty-two
  you can find, about Ruth, Toby, Mags, Dev and Helen, at all four
  destinations and one at home: one turns up per trip, some point to where to
  look next, and a private journal keeps what each says and what two have in
  common, through any defeat. *Enforced:* `spec/stories.test.ts`,
  `spec/journal.test.ts`.
- Supported: five collections of story cards, one per person. Each card
  unlocks from records you've found, a set shows progress without spoilers
  (and which cards no trip reaches yet), and finishing it opens that
  person's story as a painted comic, read a picture at a time with each
  balloon placed beside its speaker, and pays experience once. At the end
  of the story a named Legendary at your level waits, glowing, to be
  accepted, and the next page points you at where that person's story goes.
  *Enforced:* `spec/collection.test.ts`.
- Supported: quests. The first, The Last Reply, takes you from Toby's
  cards to Kerry's letters, to meeting him at the Nest (the dogs called off,
  no fight), to clearing the intake screens with him for 10 scrap, and to
  asking him to stay. The Journal shows each step, what it's waiting on and
  where to go, and he joins once, paying experience once.
  *Enforced:* `spec/quests.test.ts`.
- Supported: a second recruit. Empty Is Empty takes you from Mags's cards
  to the Ash Hounds' ledger in the Weighbridge scale house, which names her
  and your Unit, to warning her on her drop-off board. She moves in, and
  while she works at home building and door repairs cost a quarter less
  scrap. Anyone who moves in starts two levels below you, with the skipped
  levels as points to spend. *Enforced:* `spec/mags.test.ts`.
- Supported: expeditions. The Freight Yard, Old Pump Station and Road
  Checkpoint offer early runs before the harder Lower Deck under the
  Supermarket. Each takes two to four players, one character each
  (residents included). Anyone can call or join a party, with no Food or Water
  entry cost. A full party leaves on its own, and the run plays itself
  out room by room from what everyone brought and where they stand: rows,
  light, ammunition, sealed suits, bandages, flares. A readiness band
  (Likely, Risky, Grim) says how a party's odds look before it goes. Friends
  can invite each other's chosen character, even offline: accept now or decline
  within eight seconds, otherwise auto-accept within the owner's risk limit, and the Shelter page says who sent them. What's
  found is shared equally; a wipe loses what everyone carried, never the
  stash. Ruth's all-clear word, found at the Reservoir, quiets the warden.
  *Enforced:* `spec/parties.test.ts`, `spec/expedition.test.ts`,
  `spec/expeditions-http.test.ts`.
- Supported: an enemy field guide with one permanent card per enemy type,
  unlocked when actually encountered. Cards cover behaviour, counters and
  background. *Enforced:* `spec/early-expeditions.test.ts`.
- Supported: **Undelivered**, a northern investigation from the Reservoir to
  Ridge Road and the Weighbridge outskirts. Win each recovery encounter to find
  Helen's missing cards, choose to forward her sealed letter at home, then collect
  Ruth's reply at the Workshop. Existing discoveries count; the seven-card comic
  can now be completed. These are story trips, not equipment farms.
- Not yet: the wider bypass/confrontation campaign and shared-world endings.
  A public auction house remains out of scope.

**Other shelters worth knowing**

- Supported: looking into another shelter shows only rough levels and never
  takes you away from your own. Its security reflects whoever is home
  guarding, and the gate says when someone's keeping watch. While the owner is home they let you in
  and you see both of you inside; while they're out you wait at the sealed
  gate. *Enforced:* `spec/visit.test.ts`.
- Supported: character-based raids and reinforcement postings. Attack the vault
  door, then fight its defenders using equipped weapons, ammunition and healing.
  Send a character to guard a neighbour until recalled or dismissed; they cannot
  work or explore at the same time. Both sides receive live notifications and
  private battle reports. *Enforced:* `spec/raid.test.ts`, `spec/raid-combat.test.ts`.
- Supported: proportionate consequences. A raid must breach the door and defeat
  its defenders to take at most 15, never leaving a shelter below 20. Every
  attempt grants 5 minutes of protection. Injuries and used supplies persist;
  neither side loses equipped gear. *Enforced:* `spec/raid-rules.test.ts`, `spec/raid.test.ts`.
- Supported: you can see who is looking at your shelter. Anyone on its visit
  page stands at your gate with their name, and you're told when they arrive.
  *Enforced:* `spec/presence.test.ts`.
- Supported: faces. Every player picks one of twelve painted portraits when
  they register, and it's the same on their Survivors card, their shelter and
  beside what they say.
  *Enforced:* `spec/art.test.ts`.
- Supported: talking. Whoever is at a shelter, owner or visitor, can say
  something; it appears over their head and in the shelter's talk, live, and
  stays for a day, so a note at a sealed gate is still there when the owner
  gets home. *Enforced:* `spec/talk.test.ts`.
- Supported: world chat. Everyone hears it, live, on the World page; a
  party called for an expedition posts a recruit card there, and anyone can
  join from it. Cards keep up with their party as it fills and leaves, and
  the people in it hear when someone joins and when it goes.
  *Enforced:* `spec/world-chat.test.ts`.
- Supported: friends and private messages. Any name in chat, at a shelter or
  in a party opens that player's card, built from what anyone may see of them,
  with what you can do together: befriend, message, offer a trade, invite to a
  party. Private and party conversations are for friends and members only,
  checked on the server. *Enforced:* `spec/players.test.ts`, `spec/social.test.ts`.
- Partly: actions are remembered only as lines in each player's log.
- Not yet: requesting supplies.

**Trade as negotiation**

- Supported: offers between friends. Each side's goods are held in escrow
  until the other accepts, declines or the offer expires, and a counteroffer
  replaces the terms. Acceptance is always explicit and moves both sides
  together. *Enforced:* `spec/commerce.test.ts`.
- Not yet: a public auction house and trade fees.

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

Expedition content is registered in `src/game/dungeons.ts`; existing parties
keep a snapshot of their definition. Chat & friends opens from every game page,
combining world chat, shelter messages, party chat and private friend messages.
Private conversations enforce membership on the server. Invitation deadlines
are stored and resolved on requests, including the client's one-second refresh,
so they survive restarts without a background game timer.

Demo pacing: outward and return travel are immediate. Exploration and combat still take time, and Agility still shortens exploration.

Team expeditions now include **Abandoned Freight Yard** (beginner),
**Old Pump Station** and **Road Checkpoint**, followed by **The Lower Deck**.
Find them below Solo exploration on World. The geographic map shows only solo locations. Expeditions keeps compact illustrated destination cards and collapsed preparation options. **Collection → Enemies** keeps one
card per encountered enemy, with its behaviour, counters and background.
The encounter must actually have happened; future enemies in a running
expedition stay hidden.


### Base construction

Build a workshop, cultivation room or salvage processor with the construction
buttons below the shelter cutaway. Select equipment in its room for controls. Upgrade existing rooms through three visual tiers,
pause production to save inputs, and repair the vault entrance after raids.
Workshops craft from the stash and automatically replenish arrows. Cultivation
produces food; recycling consumes power to recover a renewable scrap supply from salvage.
Building uses facility-specific materials; unused gear can be dismantled. Automatic output
stops at storage limits without deleting loot. Tier-2 entrances also withstand
periodic scavenger probes; check door condition and the activity log.

Solo gathering now includes small wildlife encounters: rats at the Supermarket,
a dog at the Workshop and a mudback at the Reservoir. All new solo fights,
including the Nest, run automatically with carried equipment and supplies.
Below 30% HP, healing is used first and retreat is attempted once; failed escape
forces continued combat. Results and actual health loss appear in Activity.

### Midgame exploration

World now offers Raider Camp (Lv 5–7), Contaminated Research Station (Lv 8–10) and Abandoned Armoury (Lv 11–13), with automatic consecutive fights and gun/ammunition rewards. Entry is allowed when the recommended lower bound is no more than five levels above the player character; dispatched NPC level does not control access. Team dungeons use animated spiral markers over a separate illustrated team overview beneath solo exploration. Original dungeon card art remains on Expeditions.

### Credits and trading

Open **Trade** to buy supplies, sell spare stash equipment or negotiate with a
friend. Each shelter starts with 200 Credits; new collection and recruitment
completions and cleared team expeditions also earn Credits. Money remains at
home when a character loses a fight.

Common, Uncommon and Rare gear is sold directly at your player level. Epic
listings rotate daily at 00:00 UTC and are limited to one each per shelter;
Legendary equipment stays outside the merchant. Inspect the stats before buying.
Shop buyback pays 25% of valuation, with a daily budget displayed on Sell.
Equipped or packed items cannot be sold or traded. Rare-or-better sales need
confirmation. Boosted playtest loot is still enabled; income caps keep it from
creating unlimited merchant money.

From **Chat & friends → Offer trade**, choose up to three item lines, resources
and/or Credits to offer and request. Equipment requests can specify minimum
level and quality. Offered goods are reserved until the other player accepts,
declines, or you cancel. Counteroffers replace the previous terms and refund its
reserved goods. After 48 hours the offer expires; either participant can return
its escrow. Acceptance is always explicit, and transfers both sides together.
Activity and wallet history record the outcome. These systems do not yet include
a public auction house, fees or offline automatic acceptance.
