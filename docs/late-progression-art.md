# Late progression art — 2026-10-13

Generated with the built-in imagegen tool. Each asset was generated separately. Items were requested with genuine RGBA alpha transparency (no matte, scenery or checkerboard), validated before saving, and rechecked after WebP encoding. QA contact sheet inspected for subject, silhouette and background. Existing assets are unchanged.

Item prompt template:
> Use case: stylized-concept. Single inventory icon of SUBJECT for a gritty post-nuclear survival game. Realistic hand-painted weathered metal and grime, muted olive, rust and warm lighting. Full object centered diagonally with padding. No text, logos, scenery. Genuine RGBA alpha-transparent background, no checkerboard, matte or background pixels.

Chainsaw prompt:
> Use case: stylized-concept. Create a single inventory icon for a gritty post-nuclear survival game: a worn orange industrial chainsaw, full object diagonally framed, realistic hand-painted metal and grime, warm muted lighting, no text or logo. Genuine RGBA alpha-transparent background required. No checkerboard, solid-color matte, scenery, ground, or background pixels. Object entirely inside frame with padding.

Scene prompt template:
> Use case: stylized-concept. Landscape game location / field guide illustration: SUBJECT. Post-nuclear Australian wasteland, painterly realism, detailed weathered materials, muted olive, rust, amber and charcoal palette, cinematic atmospheric light. Readable wide composition, no text, labels, UI, logos or borders.

Assets (paths relative to repository root):

- `static/img/items/chainsaw.webp` — worn orange industrial chainsaw
- `static/img/items/warpick.webp` — armour-piercing steel war pick
- `static/img/items/powerhammer.webp` — powered industrial demolition hammer
- `static/img/items/breachhammer.webp` — military breaching sledgehammer
- `static/img/items/lightsaber.webp` — worn industrial metal lightsaber with a luminous pale blue blade
- `static/img/items/huntingrifle.webp` — heavy bolt-action hunting rifle
- `static/img/items/carbine.webp` — compact military assault carbine
- `static/img/items/antimateriel.webp` — long heavy anti-materiel rifle
- `static/img/items/lmg.webp` — belt-fed light machine gun
- `static/img/items/nuclearlauncher.webp` — fictional chunky retrofuturist portable nuclear catapult launcher
- `static/img/items/industrialarmour.webp` — reinforced industrial chest armour
- `static/img/items/compositearmour.webp` — layered tactical composite chest armour
- `static/img/items/powerarmour.webp` — heavy retrofuturistic full-body powered armour suit without wearer
- `static/img/items/powerassist.webp` — powered load-bearing harness
- `static/img/items/heavyround.webp` — three heavy rifle cartridges
- `static/img/items/mininuke.webp` — fictional small bulbous nuclear warhead with tail fins
- `static/img/world/steelworks.jpg` — abandoned steelworks, cold blast furnaces and rusted gantries
- `static/img/world/rail-terminal.jpg` — sealed railway terminal, wrecked carriages and armed checkpoint
- `static/img/world/command-bunker.jpg` — buried military command vault with old consoles and reinforced doors
- `static/img/dungeons/convoy.webp` — armoured raider truck convoy on a devastated road
- `static/img/dungeons/kestrel.webp` — buried retrofuturistic military arsenal with reinforced prototype storage
- `static/img/enemies/slag-beetle.webp` — a huge mineral-armoured slag beetle on a foundry floor
- `static/img/enemies/hound-gunner.webp` — an Ash Hounds raider gunner in battered tactical armour holding a rifle, abandoned rail yard
- `static/img/enemies/armoured-hound.webp` — ferocious dog in scavenged protective armour in a ruined rail yard
- `static/img/enemies/war-guardian.webp` — a heavy pre-war military security robot with gun arms in a bunker

## 2026-10-13 — powered melee icon revision

Re-edited `powerhammer.webp` and `warpick.webp` with the built-in image generator, using each existing icon as its reference. Both now have a blue rear thruster flame, luminous energy components and reinforced mechanical construction, retaining weathered painted wasteland materials. No gameplay values changed.

Edit prompt direction: make the hammer a substantial futuristic demolition weapon and the pick a powered armour-piercing weapon; place a short blue propulsion flame opposite the striking face/blade; add energy cells, cables and braces; preserve a readable full-object inventory silhouette without text. Explicitly require genuine RGBA alpha transparency, no baked checkerboard, matte, scenery or background pixels.

Generated source files: `exec-f0230c58-5ae8-4beb-9a03-b03ee2433371.png` (hammer) and `exec-53947114-5bdc-48a9-8ba1-bcc80c235a63.png` (pick). Verified actual RGBA channels before replacement: 65.2% and 78.1% fully transparent pixels respectively, all four corners transparent. Inspected both images for unwanted backgrounds, resized to 512 px and verified alpha again in the final WebP files.
