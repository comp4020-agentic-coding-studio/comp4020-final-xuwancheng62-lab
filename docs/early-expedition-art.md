# Early expeditions and enemy card art

Generated on 2026-10-12 with the built-in image_gen tool. Game assets are 960 × 640 WebP images under `static/img/dungeons/` and `static/img/enemies/`. Full source images remain in the generation library.

## Shared style prompt

Hand-painted digital illustration for Holdout, a post-nuclear survival game. Match existing gritty bunker and comic artwork: painterly brushwork, realistic worn materials, muted earth brown, olive and grey, dim warm highlights, melancholy post-war atmosphere. No text, lettering, logos, UI borders, badges, watermarks or graphic violence. Landscape 3:2 composition. Location cards use a wide establishing view with a clear central landmark. Enemy cards use a single prominent enemy, an entire visible silhouette and an atmospheric subordinate background. Cards are environmental paintings, not transparent cutouts.

## Subjects

- `freight-yard`: An abandoned freight yard after nuclear war, rusted containers, collapsed loading canopy, scattered crates, weeds through cracked concrete, two distant feral dogs. No humans.
- `pump-station`: An old municipal pumping station after nuclear war, cracked settling pools, rusty pipes, shallow muddy water, faded concrete pump house, reeds and a distant crab near water. No humans.
- `road-checkpoint`: An abandoned road checkpoint after nuclear war, improvised vehicle barricade, sandbags, corrugated steel watch post, a broken automatic inspection machine, dusty ruined highway. No humans.
- `scavenger`: A fallout-born feral sentry dog guarding an underpass food cache. Large cattle-dog mastiff build, patchy grey brown hide, heavy jaw, lean ribs, wary ears. Still recognizably a dog, no hyena or rat anatomy.
- `rat`: A dirty ordinary feral rat beside a gnawed sack in a sealed abandoned food storeroom. Low eye level, whiskers and sharp claws, believable rat size.
- `rustshell`: A cat-sized mutated arthropod nesting beside warm industrial pipes, mineral-encrusted rusty brown segmented shell, jointed legs, soft underside briefly visible. Shell is mineral crust, not metal. No people.
- `warden`: A bulky pre-war municipal decontamination robot in a dusty sealed bunker room, tracked industrial chassis, armoured grey panels, amber rotating beacon, spraying nozzles and old hoses. Industrial cleaning equipment, no humanoid face, no weapons cannon.
- `feral-dog`: A thin ordinary feral dog in a ruined freight yard, dirty tan fur, scars, wary crouching posture, visible ribs, believable anatomy. A hungry territorial animal, not a zombie.
- `mudback`: A large mutated mud crab in shallow water beside corroded pumping pipes, silt-coated broad brown shell, asymmetrical heavy claws, believable crab anatomy, foreground focal creature. No giant kaiju.
- `raider`: An anonymous adult highway raider in a grey hooded coat and worn half-face respirator, faded reflective strips painted over, freight tags hanging at shoulder, holding a worn farm rifle behind a sandbag road barricade. Dangerous scavenger ambush, no gore.
- `sentry`: A small pre-war checkpoint inspection machine, low wheeled boxy chassis, dirty olive metal, amber warning lens, paired short cleaning spray nozzles, worn cables, abandoned checkpoint background. No humanoid face, not a tank.

## Gameplay content

The registry in `src/game/dungeons.ts` owns names, positions, difficulty guidance, art and rewards, consumed by both World and Expeditions. Enemy field notes in `src/game/bestiary.ts` describe real mechanics. First encounter unlocks one permanent card; no multi-fragment collection is needed. Existing approved character stories and the Lower Deck's combat remain intact.

