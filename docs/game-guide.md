# Holdout game guide

Detailed mechanics and feature references. Start with the [project README](../README.md) for the game’s purpose and first steps. Numerical rules may change during balancing; the game configuration and tests are the implementation reference.

## Feature reference

Features documented in this version, grouped by design goal. *Enforced*
means a check in `spec/` holds it on every deploy; *judged* means only playing
it can tell.

**A shelter worth returning to**

- Supported: your survivor walks, inspects and climbs through the rooms; the
  generator and purifier visibly run or stop, and their panels say why; the
  shelter goes dark without power; your survivor is gone while you're out.
  *Judged.*
- Supported: your shelter, trips and log persist across sessions and
  redeploys. `spec/alive.test.ts` checks progress across logout/login, and
  everything is stored in SQLite on the Fly volume, which survives restarts
  and redeploys. Progress has survived every redeploy during development.
- Supported: recruited residents with their own health, attributes, XP, gear and
  exploration. Toby and Mags have distinct portraits and benefits. Residents at
  home work and guard together; away characters cannot defend the shelter.
  One shelter can send several characters on an expedition, with independent
  equipment and front/back positions. Healing is available beside each health bar.
  *Enforced:* `spec/crew.test.ts`, `spec/parties.test.ts`, `spec/polish.test.ts`.
- Supported: a greenhouse. Planting costs water, growing crops keep drawing
  water and power, and the harvest is food, so every planter is a choice
  between eating later and drinking now. *Enforced:* `spec/greenhouse.test.ts`.
- Supported: your survivor says what they notice about each thing they
  inspect, from its real state ("Scrap's nearly gone."). *Judged.*
- Supported: room expansion, facility upgrades and production controls, an upgradeable vault door, repairs, crafting and salvage. Facilities are managed by clicking them in the scene.

**A world worth exploring**

- Supported: solo destinations with automatic trips, automatic encounters and loot.
- Supported: a map of the world. Each place is pinned at its real distance
  from home. Travel is immediate. The current playtest configuration uses three-second exploration steps and team combat rounds; equipment drops are doubled. This is a testing configuration, not the normal pacing target.
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
- Supported: items worth finding. Multiple kinds of weapon, armour and
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
- Supported: automatic solo combat, including the Creature Nest. Low health
  triggers healing and a retreat attempt according to the combat rules; failed
  retreat forces combat to continue. Defeat loses carried equipment and supplies,
  while the stash and discovered records remain safe. Activity groups the result,
  coloured loot previews and chronological battle details in one report.
  *Enforced:* `spec/encounter.test.ts`, `spec/battle-reports.test.ts`.
- Supported: records left behind by the people who lived here. Records
  you can find, about Ruth, Toby, Mags, Dev and Helen, across exploration
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
  Supermarket. Parties count character seats, including multiple characters owned by one player and recruited residents. Anyone can call or join a party, with no Food or Water
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
- Supported: **The Old Works** links the home serial plate, Reservoir evidence,
  the Week 17 ledger and Mags’s reply. At home, send the east-side warning alone
  or with 20 Water and 10 Scrap. The choice persists in the Journal and Activity;
  completion pays 40 XP once. This dispatch does not liberate the water works.
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
- Supported: world chat. Everyone hears it, live, in Chat & friends; a
  party called for an expedition posts a recruit card there, and anyone can
  join from it. Cards keep up with their party as it fills and leaves, and
  the people in it hear when someone joins and when it goes.
  *Enforced:* `spec/world-chat.test.ts`.
- Supported: friends and private messages. Any name in chat, at a shelter or
  in a party opens that player's card, built from what anyone may see of them,
  with what you can do together: befriend, message, offer a trade, invite to a
  party. Private and party conversations are for friends and members only,
  checked on the server. *Enforced:* `spec/players.test.ts`, `spec/social.test.ts`.
- Supported: Activity combines completed solo, expedition and raid reports. Results and loot are visible; combat details are folded. Timeline keeps other activities without repeating those reports.
- Supported: requesting supplies through a friend trade offer; there is no separate public request board.

**Trade as negotiation**

- Supported: offers between friends. Each side's goods are held in escrow
  until the other accepts, declines or the offer expires, and a counteroffer
  replaces the terms. Acceptance is always explicit and moves both sides
  together. *Enforced:* `spec/commerce.test.ts`.
- Not yet: a public auction house and trade fees.

**How I will judge it**

- Ask players whether they can identify their next goal, explain a discovery, and describe a decision involving another shelter. These are evaluation questions, not claims that the experience has passed a user study. *Judged.*

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

Current playtest pacing: travel and return are immediate, exploration takes three seconds (per room in team runs), team combat rounds take three seconds, and equipment drops are doubled. This speeds up manual testing; it does not represent the intended final balance. Timed exploration can be enabled through configuration.

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

### Current interface (2026-11-03)

World shows six neighbours and folds the remainder, up to 24 total. Cards show
avatar, name, faction, selected achievements, Home/Away, Visit and Message or
Add friend. Resource bands and security stay on the visit page. Click a player's
avatar to open their profile. Journal can launch known investigations
with the selected character. Stash shows two rows per category, with a plus button
for more. Bulk sale accepts stash equipment at least two levels below the player,
selects only Common by default and allows Uncommon/Rare opt-in. Epic/Legendary are
excluded. Confirmation and the daily buyback budget are checked before selling.

Story choices are available through the **Story & factions** button in
Journal. The Old Works has two consequence branches; three factions offer
optional allegiance and a first supply assignment. Six one-time encounters
appear as you complete solo explorations. Decisions wait until you return
home, and can be postponed without an offline penalty. See
[the narrative rules](narrative/choices-and-factions.md).


### Reports and account controls

Activity combines completed solo explorations, team expeditions and raids in
newest-first order. Three reports are visible before the archive. Equipment
appears as icons and names coloured by quality; hover or open an item for its
stats. Expand The whole run for combat events and, for solo trips, health loss.
Raid cards distinguish loot taken by you from supplies taken at the target.
Expeditions keeps its team history using the same cards, including individual
shares. Timeline shows 15 events before Show more, retaining discoveries,
recruitment, trades and shelter events without repeating settled battles.

Settings in the top corner contains music, My profile, dispatch preferences,
the opening comic, this guide and logout. Profiles show earned achievements;
up to three selected badges appear below player names on social views and
shelter headers. Achievements cover stories, recruitment, expeditions,
cooperation and trade. They describe recorded progress, not combat power.

### Daily food and water

Each person uses 3 food and 3 water per hour, even while away: 72 of each per
day. Cultivation beds produce 2 / 5 / 8 food per hour and use 1 / 2 / 3 water;
purifiers produce 3 / 7 / 11 water per hour. With beds built and enough power,
tiers 1 / 2 / 3 leave a daily shortfall of 24 food and 24 water for 1 / 2 / 3
people. Toby's work can add water; greenhouse harvests add food. Healing meals
cost extra. Pausing facilities stops their production, not people's upkeep.
