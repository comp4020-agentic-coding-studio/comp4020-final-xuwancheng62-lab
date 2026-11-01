# Holdout

Holdout is a browser survival game set five years after a nuclear war. You run a shelter, send survivors out for supplies, and piece together the lives of people who were here before you. Other players can become trading partners, expedition teammates, defenders or raiders.

## Start playing

[Open Holdout](https://comp4020-final-xuwancheng62-lab.fly.dev/) and register with a name and password. The opening comic introduces the setting. You can replay it from Collection.

Start at Shelter, check your survivor’s health and equipment, then open World and explore a nearby location. Activity shows what happened and what you brought home. Journal keeps your clues and next tasks. Collection turns completed sets of clues into readable comics.

To try the multiplayer side, ask a friend to register too. Open Chat & friends to find each other, arrange an expedition or offer a trade. The game is intended for a small group playing together, such as friends or a class showcase.

## What good means

I want players to have a reason to return beyond watching resource numbers rise. The shelter should feel like their home: people move through it, equipment runs or stops, and upgrades visibly change the rooms. Exploring should support that home while giving players questions they want answered.

A clue is a physical trace, such as a letter or writing on a wall. Finding several traces reveals a person’s story. Some stories lead to recruitment, so learning about someone can change who lives in your shelter.

Other players should change your decisions. You might trade spare equipment, send help to a neighbour, or risk a raid. Cooperation needs a practical benefit, and conflict needs limits. Raids can take resources, but protections limit the loss. Trades require agreement and transfer both sides together.

## Influences and choices

*Fallout Shelter* (Bethesda, 2015) influenced the visible rooms and moving residents. *This War of Mine* (11 bit studios, 2014) influenced my interest in ordinary people facing difficult survival choices. Holdout combines shelter management with stories found through exploration and relationships between real players.

I chose automatic combat so preparation matters without asking players to control every turn. Players can also send their own recruited characters together; this makes expeditions accessible alone, although it reduces the need to find another player. A public auction house and the wider main-story campaign remain outside this version.

## What is checked, and what still needs judgment

Automated tests cover rules such as persistent progress, private messages, trade transfers, combat outcomes and rewards paid only once. Node, Hono and SQLite handle these on the server. Tests cannot tell me whether a story is moving or a screen is pleasant to use.

Friends have tried raids and messages. My own playtesting led to clearer battle reports, fewer visible controls and changes to equipment progression. Broader testing is still needed: can a new player find their next goal, understand a defeat and explain why they chose to help someone?

The current playtest mode makes exploration and combat immediate and multiplies equipment drops by five. Normal pacing and the economy still need validation.

See the [game guide](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/blob/main/docs/game-guide.md) for detailed mechanics and [PROCESS.md](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/blob/main/PROCESS.md) for development decisions and evidence.
