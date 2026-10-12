# Inventory art

Generated with the built-in image_gen tool on 2026-10-12. Final assets: `static/img/items/<kind>.webp`, 512 × 512 RGBA cutouts. Quantities, quality and level are rendered by the UI.

## Shared prompt

Premium post-nuclear survival game inventory icon. Whole item visible, centered with generous empty padding, readable silhouette, diagonally arranged if long. Detailed hand-painted digital illustration matching the gritty painted underground bunker props: painterly brushwork, believable materials, patina, chips, dirt in crevices, muted earthy olive-grey and warm brown palette, subtle warm overhead bunker light, controlled highlights for readability on charcoal UI at 96–128 px. No flat vector pictogram, cartoon outlines, rarity glow or borders. Genuine RGBA/alpha-transparent background required. Forbid baked checkerboards, solid-color mattes, scenery, floors, opaque background pixels and cast shadows outside the object. No words, branding, UI, people, hands or watermark.

## Subjects

- `crowbar`: a worn steel crowbar with a hooked end.
- `stick`: a rough wooden stick, splintered aged wood, simple improvised club.
- `nailbat`: a heavy wooden baseball bat with a few rusty nails hammered through the head.
- `machete`: a battered machete with a broad scratched steel blade and worn brown grip.
- `spear`: an improvised spear, narrow scrap metal spearhead tied to a wooden pole.
- `baton`: a worn black police riot baton with a perpendicular side handle.
- `fireaxe`: a council fire axe with faded red axehead, bare chipped steel cutting edge and wooden handle.
- `slingshot`: a handmade wooden Y slingshot, frayed rubber bands and leather pouch.
- `bow`: a scuffed compound hunting bow, complete intact bowstring.
- `rifle22`: a worn .22 farm hunting rifle, long slim barrel and old wooden stock.
- `shotgun`: a pump shotgun with worn wood furniture and scratched metal, unmistakable sliding pump.
- `servicerifle`: a battered olive military service rifle with magazine and no branding.
- `launcher`: an olive 84 mm recoilless launcher, long hollow shoulder-fired tube, worn sights and handle.
- `jacket`: a reinforced brown canvas jacket, patched thick elbows, visibly worn seams, laid flat with sleeves.
- `tyreplates`: improvised torso armour made from sections of truck tyre rubber tied with straps.
- `hazmat`: a faded ochre hazmat coverall with hood, front zip, arms and legs visible, empty suit.
- `riot`: dark navy police riot torso armour with shoulder pads and impact-resistant chest plates.
- `bodyarmour`: olive drab military plate carrier torso vest with aged webbing and protective plates.
- `backpack`: a battered small tan canvas backpack, buckles, flap, straps and seams.
- `hikingpack`: a large olive hiking backpack, external pockets, padded straps and rolled top flap.
- `headtorch`: an old head torch on a frayed adjustable fabric headband, lens catching warm light.
- `boltcutters`: a pair of heavy bolt cutters, long faded red handles, weathered steel cutting jaws.
- `respirator`: a dusty rubber half-face respirator with two cylindrical filter cartridges, complete straps.
- `webbing`: old olive utility webbing harness with a belt and multiple canvas pouches, empty wearable gear.
- `bandage`: a roll of frayed off-white gauze bandage with a short loose end, lightly soiled cloth.
- `firstaid`: a worn red canvas first-aid bag with handles, zippers and a small unlettered pale medical cross.
- `peaches`: one dented food tin with worn faded ochre label illustrated with peaches, no letters.
- `smoke`: an olive cylindrical smoke grenade canister, weathered metal, pull ring, no writing.
- `flare`: an unlit red emergency flare stick with scratched protective cap.
- `molotov`: a green glass bottle with rag wick at its neck, improvised Molotov, unlit, scratched glass.
- `shot`: a small tight cluster of dull steel ball bearings and nuts used as slingshot shot.
- `arrow`: three hunting arrows together, feathers at one end and sharp steel points, complete arrows.
- `r22`: a small cluster of .22 rimfire cartridges, tarnished brass cases and lead tips.
- `shell`: three worn red shotgun shells with tarnished brass bases.
- `r556`: a small cluster of 5.56 rifle cartridges, tarnished brass and pointed copper bullets.
- `rocket84`: one olive 84mm recoilless projectile, pointed nose, fins, no lettering.
- `cloth`: a folded scrap of faded beige canvas cloth with frayed edges.
- `nails`: a small bundle of rusty iron nails of varied length.
- `ducttape`: a partly used roll of weathered grey duct tape with short peeled end.
- `circuit`: a salvaged green circuit board with traces, capacitors and solder, dusty damaged edges.
- `sorbent`: a worn sealed foil pouch of purifier sorbent media, dusty olive-grey packaging without lettering.

## Preparation and validation

`scripts/prepare-item-icons.py` accepts a JSON list of `{kind, path}` generated-image sources. It checks actual alpha channels, substantial fully transparent canvas and absence of significant corner/edge opacity before copying anything into the project. Tiny alpha noise under 16/255 is excluded when computing the object bounding box; visible object pixels are preserved. The cutout is fitted into a padded 512 px canvas and compressed to WebP; the saved file's alpha is checked again. No colour keying or background removal is used. Visual QA checks the set for baked backgrounds, subject clarity and consistency.

