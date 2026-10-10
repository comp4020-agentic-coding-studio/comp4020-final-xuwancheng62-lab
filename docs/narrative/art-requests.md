# Art requests: Dev's and Helen's sets

Written by `scripts/generate-dev-helen-art.ts --brief`. **31 images**:
7 card still lifes and 24 comic panels. Everything else in the two sets reuses
art already on disk.

## How to make them

- **Cards**: generate square, then crop to **1024 × 768** (4:3, keep the
  middle). Save as WebP, quality about 80.
- **Panels**: generate wide, then crop to 16:10 and resize to **1280 × 800**.
  Save as WebP, quality about 80.
- **No readable writing.** Invented lettering gets blurred with a feathered
  Gaussian mask, as was done for Mags's cards; the words live in the HTML.
- **Look**: a painted film still, not a cartoon. Match the existing panels in
  `static/img/comic/mags/` and `static/img/comic/ruth/`. Dev has a short
  beard throughout. Mags wears a navy beanie and apron. Ruth has glasses.
- **Nina's look is still Proposed**, so the trainee in Dev's panels 7 and 11
  and the young woman in Helen's panel 13 are drawn generic, not as Nina.
- **Check each against its scene** in `src/game/collections.ts` (the
  `scene` and `shows` text). If a picture differs, fix the text to match
  the picture, as was done for Mags.

## Wiring them in

In `src/game/collections.ts`, change `art: null` on the matching card to the
path as a string (`art: "/static/img/cards/dev/roster.webp"`), or on the
matching panel to `art: { src: "/static/img/comic/dev/p01.webp" }`. Then run
`pnpm check` against a running app on a fresh DATA_DIR: the specs check
that every path exists on disk.

## The images

### dev-card-roster

- **Save as**: `static/img/cards/dev/roster.webp`
- **Generate at**: 1024x1024

> close-up still life of a found object, as discovered in an abandoned place, shallow depth of field, no people. There are no letters or words anywhere in the image: any writing is only faint wavy scribble lines, smudged and out of focus: a sun-faded laminated weekly roster behind cracked perspex in a steel-framed dispatch hatch, held on with black cable ties, a column of printed rows and a marker note, at the mouth of a concrete underpass, daylight from one side, digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### dev-card-run-sheet

- **Save as**: `static/img/cards/dev/run-sheet.webp`
- **Generate at**: 1024x1024

> close-up still life of a found object, as discovered in an abandoned place, shallow depth of field, no people. There are no letters or words anywhere in the image: any writing is only faint wavy scribble lines, smudged and out of focus: a clipboard of pencil carbon run sheets hanging on a nail beside an old electric pump starter box in a brick hut, the top sheet creased where a thumb held it, a dead torch on a shelf, torchlight, digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### dev-card-repack-card

- **Save as**: `static/img/cards/dev/repack-card.webp`
- **Generate at**: 1024x1024

> close-up still life of a found object, as discovered in an abandoned place, shallow depth of field, no people. There are no letters or words anywhere in the image: any writing is only faint wavy scribble lines, smudged and out of focus: a sheet of thin aluminium cut from an old sign, nailed above a workbench, six lines of letters scored in with a scriber and filled with black marker, small pencil ticks beside each line, in a dusty workshop, grey light through a high window, digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### dev-01

- **Save as**: `static/img/comic/dev/p01.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. A bright Thursday morning in a council depot yard under a highway overpass, the year before the war. Dev Pillai at thirty-three, a tall lean South Asian man, short black hair with no grey, a short trimmed beard, warm brown eyes, thick dark eyebrows, navy council work overalls with a water-authority patch, no tool bag, holding out an adult orange hi-vis vest to a small thin sandy-haired boy of ten with freckles, in an adult orange hi-vis vest that hangs to his knees, who is already lost inside one. Behind them a small white electric waste cart with a friendly face painted on its front, and a steel dispatch hatch with a laminated sheet behind perspex. Easy, proud mood, digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### dev-02

- **Save as**: `static/img/comic/dev/p02.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. A windowless school education room at a water pumping station, laminated worksheets on the walls. Dev Pillai at thirty-three, a tall lean South Asian man, short black hair with no grey, a short trimmed beard, warm brown eyes, thick dark eyebrows, navy council work overalls with a water-authority patch, no tool bag, holding up a handheld water meter to a dozen ten-year-old children sitting on the floor; at the front a sandy-haired boy with his hand up. digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### dev-03

- **Save as**: `static/img/comic/dev/p03.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. Before dawn in a small radio room at a pumping station, one oil lamp. Dev Pillai at thirty-four, a tall lean South Asian man, short black hair with no grey yet, a short trimmed beard, warm brown eyes, thick dark eyebrows, faded navy work overalls with the sleeves rolled up, alone at a desk, headphones round his neck, writing in a hardback notebook, a handheld meter with a dim flickering battery light in front of him. Alone, careful mood, digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### dev-04

- **Save as**: `static/img/comic/dev/p04.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. Dawn inside a small brick bore house. Dev Pillai at thirty-four, a tall lean South Asian man, short black hair with no grey yet, a short trimmed beard, warm brown eyes, thick dark eyebrows, faded navy work overalls with the sleeves rolled up, at an old electric pump starter box with a clipboard of papers; through the open door a water tanker truck backing up, Gary, a big red-faced man in his fifties, thinning sandy hair, a faded football jumper leaning out of the cab window. digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### dev-05

- **Save as**: `static/img/comic/dev/p05.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. Dusk at a chain-link gate of a country pumping station. Two tired neighbours holding plastic jerrycans; Dev Pillai at thirty-four, a tall lean South Asian man, short black hair with no grey yet, a short trimmed beard, warm brown eyes, thick dark eyebrows, faded navy work overalls with the sleeves rolled up, filling one from the tap at the back of a water tanker truck, a clipboard under his arm. digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### dev-06

- **Save as**: `static/img/comic/dev/p06.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. A dusty office up the stairs of a pumping station, afternoon light. Dev Pillai at thirty-four, a tall lean South Asian man, short black hair with no grey yet, a short trimmed beard, warm brown eyes, thick dark eyebrows, faded navy work overalls with the sleeves rolled up, bent over an old council map spread on the desk, beside him Ruth Lane, a short sturdy woman of sixty-one, about 158 cm, broad shoulders, short cropped iron-grey hair, sharp blue eyes, reading glasses on a cord around her neck, a teal supermarket manager's polo shirt with a darker collar, a navy fleece vest, a pen behind her ear; through the window a line of people with packs waiting. digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### dev-07

- **Save as**: `static/img/comic/dev/p07.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. A water-treatment plant beside a river weir, a long bench of salvaged steel, rows of cylindrical purifier cartridges. Dev Pillai at thirty-four, a tall lean South Asian man, short black hair with no grey yet, a short trimmed beard, warm brown eyes, thick dark eyebrows, faded navy work overalls with the sleeves rolled up, teaching three locals to pack sorbent into a cartridge; a young woman in her late twenties in a black rubber apron and elbow-length rubber gloves watches his hands closely. An aluminium plate is nailed on the wall above the bench. Purposeful mood, digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### dev-08

- **Save as**: `static/img/comic/dev/p08.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. A long dry concrete water-works tunnel by torchlight. Dev Pillai at thirty-four, a tall lean South Asian man, short black hair with no grey yet, a short trimmed beard, warm brown eyes, thick dark eyebrows, faded navy work overalls with the sleeves rolled up, a head torch on, painting white letters on the concrete wall beside a large iron valve wheel with a small brush; the wheel is clean, with no chain on it. The painted letters are a blur. digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### dev-09

- **Save as**: `static/img/comic/dev/p09.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. Autumn inside a small country workshop. Dev Pillai, a tall lean South Asian man of thirty-seven, about 182 cm, short black hair with grey at the temples, a short trimmed beard, warm brown eyes, thick dark eyebrows, faded navy work overalls with the sleeves rolled up, a head torch around his neck, a canvas tool bag stencilled with white letters, holding out a scratched aluminium plate; facing him, Mags Halloran, a small wiry woman in her seventies, about 155 cm, slightly stooped, cropped white hair under a navy knitted beanie, a deeply lined sun-spotted face, pale blue eyes, a thin mouth, big hands with taped fingertips, a jeweller's loupe on a bootlace round her neck, an oil-stained navy work shirt, a canvas apron full of pockets, men's steel-capped boots, arms folded, not taking it, oil to the elbows. Dry humour, digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### dev-11

- **Save as**: `static/img/comic/dev/p11.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. Winter night in a water-treatment plant by a weir. One place at a long steel bench empty, a black rubber apron hanging on its hook. A yellow plastic freight tag lies on the bench; Dev Pillai, a tall lean South Asian man of thirty-seven, about 182 cm, short black hair with grey at the temples, a short trimmed beard, warm brown eyes, thick dark eyebrows, faded navy work overalls with the sleeves rolled up, a head torch around his neck, a canvas tool bag stencilled with white letters and Ruth Lane at sixty-four, the same short sturdy woman, about 158 cm, short cropped white-grey hair, sharp blue eyes, reading glasses on a cord, weathered skin, a navy fleece vest over a checked work shirt, fingerless gloves stand over it, grim. Threat, quiet, digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### dev-14

- **Save as**: `static/img/comic/dev/p14.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. Autumn morning in a water-treatment plant by a river weir, light through high windows. Five people at a long steel bench re-packing cylindrical purifier cartridges; above them a scratched aluminium plate nailed to the wall, worn bright. Through the window the river runs low. Grief and continuity, digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### helen-card-siren-handout

- **Save as**: `static/img/cards/helen/siren-handout.webp`
- **Generate at**: 1024x1024

> close-up still life of a found object, as discovered in an abandoned place, shallow depth of field, no people. There are no letters or words anywhere in the image: any writing is only faint wavy scribble lines, smudged and out of focus: a laminated council handout with a clip-art siren printed on it, pinned at the end of a school display of laminated worksheets, felt-pen writing showing through from the back, a windowless room, torchlight, digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### helen-card-bulletins

- **Save as**: `static/img/cards/helen/bulletins.webp`
- **Generate at**: 1024x1024

> close-up still life of a found object, as discovered in an abandoned place, shallow depth of field, no people. There are no letters or words anywhere in the image: any writing is only faint wavy scribble lines, smudged and out of focus: a corkboard above an old two-way radio set, typed bulletin sheets pinned to it with rubber-stamped times, two empty pins and a torn paper corner, lamplight, digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### helen-card-manifest

- **Save as**: `static/img/cards/helen/manifest.webp`
- **Generate at**: 1024x1024

> close-up still life of a found object, as discovered in an abandoned place, shallow depth of field, no people. There are no letters or words anywhere in the image: any writing is only faint wavy scribble lines, smudged and out of focus: a convoy manifest on a small clipboard in an open steel tin, in the scorched glovebox of a burnt-out truck, a child's crayon drawing tucked behind the sun visor above, cold grey winter light, digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### helen-card-envelope

- **Save as**: `static/img/cards/helen/envelope.webp`
- **Generate at**: 1024x1024

> close-up still life of a found object, as discovered in an abandoned place, shallow depth of field, no people. There are no letters or words anywhere in the image: any writing is only faint wavy scribble lines, smudged and out of focus: a sealed envelope soft with handling, lying in a spilled canvas trader's pack beside a tear-off joke-a-day calendar and a trade book, on a container floor, a thin bar of light through a bullet hole, digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### helen-01

- **Save as**: `static/img/comic/helen/p01.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. A primary-school hall before the war, morning light. Helen Lane, a slim woman of thirty-eight, about 168 cm, sharp blue eyes and a strong jaw, straight dark-brown hair in a neat chin-length bob, a navy council blazer, a lanyard with an ID card, a small silver wristwatch, standing at a whiteboard holding up a laminated handout; rows of ten-year-olds on the floor, one hand up. At the back, a small thin sandy-haired boy of ten with freckles, in an adult orange hi-vis vest that hangs to his knees. digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### helen-02

- **Save as**: `static/img/comic/helen/p02.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. Evening in a small suburban kitchen. Ruth Lane, a short sturdy woman of sixty-one, about 158 cm, broad shoulders, short cropped iron-grey hair, sharp blue eyes, reading glasses on a cord around her neck, a teal supermarket manager's polo shirt with a darker collar, a navy fleece vest, a pen behind her ear, feet up on a chair; Helen Lane, a slim woman of thirty-eight, about 168 cm, sharp blue eyes and a strong jaw, straight dark-brown hair in a neat chin-length bob, a navy council blazer, a lanyard with an ID card, a small silver wristwatch, at the kitchen table with folders, her wristwatch beside them. Close, combative family mood, digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### helen-03

- **Save as**: `static/img/comic/helen/p03.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. Early morning in a cramped council emergency centre full of phones and wall maps, a wall clock. Helen Lane, a slim woman of thirty-eight, about 168 cm, sharp blue eyes and a strong jaw, straight dark-brown hair in a neat chin-length bob, a navy council blazer, a lanyard with an ID card, a small silver wristwatch, a yellow liaison vest over her blazer, reading from a sheet into a desk microphone. digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### helen-04

- **Save as**: `static/img/comic/helen/p04.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. Midday in the same cramped council emergency room. A forecaster places a slip of paper in front of Helen Lane, a slim woman of thirty-eight, about 168 cm, sharp blue eyes and a strong jaw, straight dark-brown hair in a neat chin-length bob, a navy council blazer, a lanyard with an ID card, a small silver wristwatch; she looks at her wristwatch. Behind her a corkboard of pinned sheets with an empty space. Tense, digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### helen-05

- **Save as**: `static/img/comic/helen/p05.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. A concrete council stairwell. Helen Lane, a slim woman of thirty-eight, about 168 cm, sharp blue eyes and a strong jaw, straight dark-brown hair in a neat chin-length bob, a navy council blazer, a lanyard with an ID card, a small silver wristwatch, alone, a phone to her ear, eyes shut, her watch hand pressed to her mouth. In a small inset in the lower right corner, Ruth Lane, a short sturdy woman of sixty-one, about 158 cm, broad shoulders, short cropped iron-grey hair, sharp blue eyes, reading glasses on a cord around her neck, a teal supermarket manager's polo shirt with a darker collar, a navy fleece vest, a pen behind her ear, in a supermarket car park writing on a clipboard. Guilt, digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### helen-07

- **Save as**: `static/img/comic/helen/p07.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. An allocation office in an old showground produce pavilion: a long queue of evacuees, trestle tables of ledgers, a laminating machine. Helen Lane, a slim woman of thirty-eight, about 168 cm, sharp blue eyes and a strong jaw, straight dark-brown hair in a neat chin-length bob, a navy council blazer, a lanyard with an ID card, a small silver wristwatch, handing a laminated card across the table to Kerry Wren, Toby's mother, a woman in her mid thirties, about 165 cm, slight build, the same sandy-brown hair as Toby pulled into a low ponytail, tired kind grey eyes, a few freckles, small silver stud earrings, a teal supermarket uniform polo shirt with an orange name badge, dark work trousers, with a small sandy-haired boy of eleven beside her. digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### helen-08

- **Save as**: `static/img/comic/helen/p08.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. Night inside a canvas radio tent, lamplight. Helen Lane, a slim woman of thirty-eight, about 168 cm, sharp blue eyes and a strong jaw, straight dark-brown hair in a neat chin-length bob, a navy council blazer, a lanyard with an ID card, a small silver wristwatch, hunched at a two-way radio set, a ration sheet in her hand; through the tent flap, a meal queue in lamplight. digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### helen-09

- **Save as**: `static/img/comic/helen/p09.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. A split composition. Left: Helen Lane, a slim woman of thirty-eight, about 168 cm, sharp blue eyes and a strong jaw, straight dark-brown hair in a neat chin-length bob, a navy council blazer, a lanyard with an ID card, a small silver wristwatch, in a showground office reading a folded note, an open cash tin full of folded notes beside her, a road-dusty walker waiting. Right, faint as a memory: a dusty pumping-station office, a square biscuit tin on a desk, its lid taped. digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### helen-10

- **Save as**: `static/img/comic/helen/p10.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. Winter, a cold council room, a long table, breath visible. Older councillors in heavy coats on one side; Helen Lane, a slim woman of thirty-eight, about 168 cm, sharp blue eyes and a strong jaw, straight dark-brown hair in a neat chin-length bob, a navy council blazer, a lanyard with an ID card, a small silver wristwatch, standing, signing a sheet on a clipboard; a fuel docket on the table. digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### helen-11

- **Save as**: `static/img/comic/helen/p11.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. A road cutting through grey hills in winter light. A burnt-out truck; three graves marked with crosses cut from road signs. No people. Behind the cracked windscreen, a child's crayon drawing on the sun visor. Desolate, digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### helen-12

- **Save as**: `static/img/comic/helen/p12.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. Winter, a camp bed at the end of a showground pavilion, a lantern, a hot-water bottle. Helen Lane at forty-one, the same woman thin and tired, about 168 cm, sharp blue eyes, dark-brown hair grown out and tied back, grey at the temples, a grey wool coat over a cardigan, fingerless gloves, a small silver wristwatch, propped up, writing on a clipboard; an open cash tin of folded notes on the blanket. digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### helen-13

- **Save as**: `static/img/comic/helen/p13.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. Dawn at the gate of a fenced showground. Nell Ashby, a wiry sun-browned trader in her fifties with laughing lines, a wide-brimmed hat and a long oilskin coat, tucking an envelope into her pack beside a tear-off calendar, a bay pack horse with a white blaze. Behind her, a young woman with a rubber apron rolled on her pack. Helen Lane at forty-one, the same woman thin and tired, about 168 cm, sharp blue eyes, dark-brown hair grown out and tied back, grey at the temples, a grey wool coat over a cardigan, fingerless gloves, a small silver wristwatch, wrapped in a blanket at the gate, coughing. digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore

### helen-14

- **Save as**: `static/img/comic/helen/p14.webp`
- **Generate at**: 1792x1024

> a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render. Dark inside a shipping container used as a store, light through a bullet-holed door: stacked crates with yellow plastic freight tags, a canvas trader's pack spilled open, a tear-off calendar, and a sealed envelope. No people. digital painting, painterly brushwork, muted earthy palette, soft directional light, fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore
