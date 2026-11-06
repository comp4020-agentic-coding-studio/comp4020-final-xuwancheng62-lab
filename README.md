# Holdout

Holdout is a browser survival game set five years after a nuclear war. You run a shelter, send survivors out for supplies, and piece together the lives of people who were here before you. Other players can become trading partners, expedition teammates, defenders or raiders.

## Start playing

[Open Holdout](https://comp4020-final-xuwancheng62-lab.fly.dev/) and register with a name and password. The opening film introduces Calder Valley. You can replay it from Collection.

Check your survivor’s equipment at Shelter, then open World and explore a nearby location. When you return, Activity shows what happened and Journal tells you where a clue might lead. Complete a set of clues to read its comic in Collection.

Playing with a friend? Register separately, then open Chat & friends to find each other, arrange an expedition or offer a trade.

## What good means

I want players to have a reason to return beyond watching resource numbers rise. The shelter should feel like their home: people move through it, equipment runs or stops, and upgrades visibly change the rooms. Exploring should support that home while giving players questions they want answered.

A clue is a physical trace, such as a letter or writing on a wall. Finding several traces reveals a person’s story. Some stories lead to recruitment, so learning about someone can change who lives in your shelter.

Other players should change your decisions. You might trade spare equipment, send help to a neighbour, or risk a raid. Cooperation needs a practical benefit, and conflict needs limits. Raids can take resources, but protections limit the loss. Trades require agreement and transfer both sides together.

## Influences and choices

*Fallout Shelter* (Bethesda, 2015) influenced the visible rooms and moving residents. *This War of Mine* (11 bit studios, 2014) influenced my interest in ordinary people facing difficult survival choices. Holdout combines shelter management with stories found through exploration and relationships between real players.

Robin Sloan built a messaging app for four people in his family. Direct trade in Holdout makes sense at that scale. If a friend needs the rifle you found, you can offer it to them and agree on a price. A public auction house would let you sell it without ever speaking to the buyer. See [An app can be a home-cooked meal](https://www.robinsloan.com/notes/home-cooked-app/).

Automatic combat lets players focus on what to pack and whom to send. Sending two of your own survivors makes an expedition possible when friends are offline, though it gives you one fewer reason to ask someone along.

## What is checked, and what still needs judgment

- A raid leaves the defender a protected minimum of each raidable resource. [Raid checks](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/blob/main/spec/raid-rules.test.ts)
- An accepted trade exchanges both sides together. If the buyer cannot pay, the offer stays intact. [Trade checks](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/blob/main/spec/commerce.test.ts)
- Visitors see rough stock levels. The owner keeps the exact counts private. [Visit checks](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/blob/main/spec/visit.test.ts)

A friend and I tested face to face with fresh accounts, one in a private window. Friend requests, chat, an expedition and a trade each appeared on the other screen without refreshing, with no noticeable delay. Progress has survived every redeploy. Playing through a defeat myself showed me how hard it was to find the cause, so combat reports now group the rounds together. I would still want to watch a newcomer read one. Can they tell what went wrong and choose what to pack next time?

Exploration steps and team combat rounds currently take three seconds, with double equipment drops. Long-term balance is still an open question.

See the [game guide](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/blob/main/docs/game-guide.md) for detailed mechanics and [PROCESS.md](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/blob/main/PROCESS.md) for development decisions and evidence.
