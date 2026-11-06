# Building Holdout

## Starting with a reason to play together

I started Holdout as a shelter survival game for a small group of people. My first idea was simple: leaving home to find supplies leaves the shelter exposed. Other players could help, visit or raid it. I wanted their presence to change decisions, rather than just add a chat box to a single-player game. The first plan separated the basic survival loop from multiplayer work ([`f53fa69`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/f53fa69)).

My definition of good grew during development. A shelter should feel worth returning to, exploration should reveal something worth knowing, and neighbours should matter. Fallout Shelter was a visual reference, while This War of Mine helped frame survival as choices involving other people. Looking back, [Robin Sloan’s family app](https://www.robinsloan.com/notes/home-cooked-app/) confirmed a choice I had made by instinct: among friends, direct offers give people a reason to talk, so I left out a public auction house ([`e48c215...bf28bbf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/compare/e48c215...bf28bbf)).

## Choosing tools and directing the work

The course provides one small Fly machine and a persistent volume. I used Node, Hono and SQLite, with pages rendered on the server. SQLite fits this setup without another database service. Resource production and journeys are calculated from saved timestamps when the game is accessed, so they survive the machine sleeping. The first working version included accounts, resources, journeys and saved progress ([`8e7df83`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/8e7df83)).

Normal actions use forms; live changes arrive through server-sent events. This was simpler than WebSockets because players already send actions through HTTP. The cost is maintaining browser update code ourselves. Multiplayer actions use database transactions so competing requests cannot spend the same resources ([`c44d17d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/c44d17d)). The [architecture record](docs/decisions/0003-stack-and-live-updates.md) documents these trade-offs retrospectively. Two earlier records explain [concurrent raids](docs/decisions/0001-concurrent-raids.md) and [visibility and permissions](docs/decisions/0002-who-sees-and-changes-what.md), connecting multiplayer choices to rules and tests.

I worked with Claude Code and Codex. They wrote code, tests and documentation drafts; I set the direction, reviewed screens and played the game. PLAN.md recorded decisions, while CLAUDE.md set rules such as keeping outcomes on the server and protecting private player data. Larger changes used branches before merging. Tests helped check whether changes broke existing behaviour, but could not decide whether the game was enjoyable.

## Making the shelter feel inhabited

The first interface felt like data tables. I wanted people walking through a base, with working equipment and visible changes. The shelter became a cutaway scene with rooms, lights, moving people and visitors ([`75c6608...5d5e818`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/compare/75c6608...5d5e818)). Painted backgrounds gave it atmosphere, while stock, water levels and characters remained live elements. A single background picture could not communicate those changes. I reviewed details such as shelves and lighting because generated assets did not automatically fit together ([`6491677`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/6491677)).

## Giving exploration a story

I wanted discoveries to explain what happened to ordinary people. Early writing used a drought setting; I corrected this to nuclear war so the background matched the world I intended ([`a8dd711`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/a8dd711)).

The collection system needed another correction. Cards initially showed too much of the reconstructed story. I wanted them to be things players actually found: a letter, a small object or writing on a wall. Only the completed collection should reveal the person's life through a comic. That distinction changed both the cards and the reading experience ([`c039d04`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/c039d04)). A visual bible recorded character appearances across stories.

When I asked the agent to keep speech bubbles clear of faces, some ended up so far away that I could barely tell who was speaking. Asking for bubbles close to each speaker gave the agent room to fit them to each drawing ([`df701af`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/df701af)).

## Letting play change the design

Toby's recruitment first made him mainly a production bonus. I wanted recruited people to use the same character system as the player: health, equipment, levels, defence and exploration. This changed the question from whether to leave home to whom to send and whom to keep there ([`62ae0fd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/62ae0fd)).

Playing also exposed gaps in progression. Losing equipment at the research station was frustrating when earlier locations did not provide a clear way to rebuild. I asked for Strength and Agility routes where suitable equipment from one stage could support the next at its recommended level. The resulting changes addressed progression and rewards together ([`1e32bd1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/1e32bd1)).

As systems grew, the interface became tiring to read. I asked for shorter pages, folded details, equipment icons and clearer actions. Later changes added direct investigation from the Journal and healing beside health bars ([`374d762`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/374d762), [`d3e8770`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/d3e8770)). More recently, I asked for solo, team and raid results to share the same report layout, with loot visible and combat details folded. Timeline now keeps other events instead of repeating battles ([`d64d3ee`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/d64d3ee)). These were responses to using the game, not just cosmetic changes.

## Checking what works and what remains uncertain

Server logs added another way to understand behaviour: who acted, what they did and whom it affected, without recording passwords or message contents ([`e1ce54a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/e1ce54a)). My Crit 10 reflection also records tests failing against an old server or different settings. Those failures taught me to check the environment before assuming the game was wrong.

Friends tried raids and messages. Later a friend and I tested face to face with fresh accounts, one of us in a private window. Friend requests, messages, a shared expedition and a trade each appeared on the other screen as soon as the other clicked, without a refresh. We noticed no delay and did not time it. Persistence was tested by deploying: progress survived every redeploy.

One story test always called localhost, even when the rest of the suite targeted the deployed app. It now reads the URL supplied by the test runner. I added that rule to CLAUDE.md so future HTTP tests follow the same target ([`a62910b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/a62910b)).

A deployment failure exposed a gap in my checks: the app read the game guide at startup, but the Docker image did not contain it. Local tests passed because the file existed locally. The fix included the file in Docker and added a rule to CLAUDE.md: runtime files must be packaged and the production image must start ([`00ab5fe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/00ab5fe)).

Holdout now includes trading, recruitment, collections and branching choices. Some trade-offs remain. Allowing one player to send several characters makes expeditions easier to access, but reduces dependence on other players ([`4f99cdf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xuwancheng62-lab/commit/4f99cdf)). After testing instant runs, I chose three-second exploration steps and team combat rounds with doubled equipment drops. The next priority is checking this pacing with newcomers, rather than adding another system.
