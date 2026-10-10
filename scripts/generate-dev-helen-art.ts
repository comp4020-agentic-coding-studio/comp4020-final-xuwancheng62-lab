// Prompts for Dev's and Helen's collection art (docs/narrative/dev.md,
// docs/narrative/helen.md): the card still lifes and comic panels not
// already reused from Toby's and Ruth's sets. People and objects are
// described in the words of scripts/visual-bible.ts.
//   node scripts/generate-dev-helen-art.ts --brief   writes docs/narrative/art-requests.md
//   node --env-file=<file with COMP4020_IMAGE_KEY> scripts/generate-dev-helen-art.ts [name...]
// The second form generates through the course image proxy into
// /tmp/dev-helen-art/; chosen images are then processed into the paths below.
import { writeFileSync } from "node:fs";
import { OBJECTS, PEOPLE, STYLE } from "./visual-bible.ts";

// As in generate-ruth-art.ts and generate-mags-art.ts.
const PANEL = "a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render";
const STILL = "close-up still life of a found object, as discovered in an abandoned place, shallow depth of field, no people. " +
  "There are no letters or words anywhere in the image: any writing is only faint wavy scribble lines, smudged and out of focus";
// Nina's look is still proposed, so the trainee is drawn without it.
const trainee = "a young woman in her late twenties in a black rubber apron and elbow-length rubber gloves";
const toby10 = "a small thin sandy-haired boy of ten with freckles, in an adult orange hi-vis vest that hangs to his knees";

type Art = { path: string; prompt: string; size: "1024x1024" | "1792x1024" };
const card = (set: string, name: string, prompt: string): Art => ({ path: `static/img/cards/${set}/${name}.webp`, prompt: `${STILL}: ${prompt}, ${STYLE}`, size: "1024x1024" });
const panel = (set: string, n: string, prompt: string): Art => ({ path: `static/img/comic/${set}/p${n}.webp`, prompt: `${PANEL}. ${prompt} ${STYLE}`, size: "1792x1024" });

export const ART: Record<string, Art> = {
  // Dev: cards 1, 3, 4 (2, 5, 6 reuse Ruth's and Toby's)
  "dev-card-roster": card("dev", "roster", `${OBJECTS.roster}, at the mouth of a concrete underpass, daylight from one side`),
  "dev-card-run-sheet": card("dev", "run-sheet", `${OBJECTS.runSheet}, torchlight`),
  "dev-card-repack-card": card("dev", "repack-card", `${OBJECTS.repackCard}, in a dusty workshop, grey light through a high window`),
  // Dev: panels 10, 12, 13 reuse Toby's p08, p09, p10
  "dev-01": panel("dev", "01", `A bright Thursday morning in a council depot yard under a highway overpass, the year before the war. ${PEOPLE.dev33}, holding out an adult orange hi-vis vest to ${toby10}, who is already lost inside one. Behind them a small white electric waste cart with a friendly face painted on its front, and a steel dispatch hatch with a laminated sheet behind perspex. Easy, proud mood,`),
  "dev-02": panel("dev", "02", `A windowless school education room at a water pumping station, laminated worksheets on the walls. ${PEOPLE.dev33}, holding up a handheld water meter to a dozen ten-year-old children sitting on the floor; at the front a sandy-haired boy with his hand up.`),
  "dev-03": panel("dev", "03", `Before dawn in a small radio room at a pumping station, one oil lamp. ${PEOPLE.dev34}, alone at a desk, headphones round his neck, writing in a hardback notebook, a handheld meter with a dim flickering battery light in front of him. Alone, careful mood,`),
  "dev-04": panel("dev", "04", `Dawn inside a small brick bore house. ${PEOPLE.dev34}, at an old electric pump starter box with a clipboard of papers; through the open door a water tanker truck backing up, ${PEOPLE.gary} leaning out of the cab window.`),
  "dev-05": panel("dev", "05", `Dusk at a chain-link gate of a country pumping station. Two tired neighbours holding plastic jerrycans; ${PEOPLE.dev34}, filling one from the tap at the back of a water tanker truck, a clipboard under his arm.`),
  "dev-06": panel("dev", "06", `A dusty office up the stairs of a pumping station, afternoon light. ${PEOPLE.dev34}, bent over an old council map spread on the desk, beside him ${PEOPLE.ruth}; through the window a line of people with packs waiting.`),
  "dev-07": panel("dev", "07", `A water-treatment plant beside a river weir, a long bench of salvaged steel, rows of cylindrical purifier cartridges. ${PEOPLE.dev34}, teaching three locals to pack sorbent into a cartridge; ${trainee} watches his hands closely. An aluminium plate is nailed on the wall above the bench. Purposeful mood,`),
  "dev-08": panel("dev", "08", `A long dry concrete water-works tunnel by torchlight. ${PEOPLE.dev34}, a head torch on, painting white letters on the concrete wall beside a large iron valve wheel with a small brush; the wheel is clean, with no chain on it. The painted letters are a blur.`),
  "dev-09": panel("dev", "09", `Autumn inside a small country workshop. ${PEOPLE.dev}, holding out a scratched aluminium plate; facing him, ${PEOPLE.mags}, arms folded, not taking it, oil to the elbows. Dry humour,`),
  "dev-11": panel("dev", "11", `Winter night in a water-treatment plant by a weir. One place at a long steel bench empty, a black rubber apron hanging on its hook. A yellow plastic freight tag lies on the bench; ${PEOPLE.dev} and ${PEOPLE.ruth64} stand over it, grim. Threat, quiet,`),
  "dev-14": panel("dev", "14", `Autumn morning in a water-treatment plant by a river weir, light through high windows. Five people at a long steel bench re-packing cylindrical purifier cartridges; above them a scratched aluminium plate nailed to the wall, worn bright. Through the window the river runs low. Grief and continuity,`),
  // Helen: cards 1, 2, 6, 7 (3, 4, 5 reuse Toby's and Ruth's)
  "helen-card-siren-handout": card("helen", "siren-handout", `${OBJECTS.sirenHandout}, a windowless room, torchlight`),
  "helen-card-bulletins": card("helen", "bulletins", `${OBJECTS.bulletins}, lamplight`),
  "helen-card-manifest": card("helen", "manifest", `${OBJECTS.manifest}, cold grey winter light`),
  "helen-card-envelope": card("helen", "envelope", `${OBJECTS.envelope}, a thin bar of light through a bullet hole`),
  // Helen: panel 6 reuses Ruth's p06
  "helen-01": panel("helen", "01", `A primary-school hall before the war, morning light. ${PEOPLE.helen}, standing at a whiteboard holding up a laminated handout; rows of ten-year-olds on the floor, one hand up. At the back, ${toby10}.`),
  "helen-02": panel("helen", "02", `Evening in a small suburban kitchen. ${PEOPLE.ruth}, feet up on a chair; ${PEOPLE.helen}, at the kitchen table with folders, her wristwatch beside them. Close, combative family mood,`),
  "helen-03": panel("helen", "03", `Early morning in a cramped council emergency centre full of phones and wall maps, a wall clock. ${PEOPLE.helen}, a yellow liaison vest over her blazer, reading from a sheet into a desk microphone.`),
  "helen-04": panel("helen", "04", `Midday in the same cramped council emergency room. A forecaster places a slip of paper in front of ${PEOPLE.helen}; she looks at her wristwatch. Behind her a corkboard of pinned sheets with an empty space. Tense,`),
  "helen-05": panel("helen", "05", `A concrete council stairwell. ${PEOPLE.helen}, alone, a phone to her ear, eyes shut, her watch hand pressed to her mouth. In a small inset in the lower right corner, ${PEOPLE.ruth}, in a supermarket car park writing on a clipboard. Guilt,`),
  "helen-07": panel("helen", "07", `An allocation office in an old showground produce pavilion: a long queue of evacuees, trestle tables of ledgers, a laminating machine. ${PEOPLE.helen}, handing a laminated card across the table to ${PEOPLE.kerry}, with a small sandy-haired boy of eleven beside her.`),
  "helen-08": panel("helen", "08", `Night inside a canvas radio tent, lamplight. ${PEOPLE.helen}, hunched at a two-way radio set, a ration sheet in her hand; through the tent flap, a meal queue in lamplight.`),
  "helen-09": panel("helen", "09", `A split composition. Left: ${PEOPLE.helen}, in a showground office reading a folded note, an open cash tin full of folded notes beside her, a road-dusty walker waiting. Right, faint as a memory: a dusty pumping-station office, a square biscuit tin on a desk, its lid taped.`),
  "helen-10": panel("helen", "10", `Winter, a cold council room, a long table, breath visible. Older councillors in heavy coats on one side; ${PEOPLE.helen}, standing, signing a sheet on a clipboard; a fuel docket on the table.`),
  "helen-11": panel("helen", "11", `A road cutting through grey hills in winter light. A burnt-out truck; three graves marked with crosses cut from road signs. No people. Behind the cracked windscreen, a child's crayon drawing on the sun visor. Desolate,`),
  "helen-12": panel("helen", "12", `Winter, a camp bed at the end of a showground pavilion, a lantern, a hot-water bottle. ${PEOPLE.helen41}, propped up, writing on a clipboard; an open cash tin of folded notes on the blanket.`),
  "helen-13": panel("helen", "13", `Dawn at the gate of a fenced showground. ${PEOPLE.nell}, tucking an envelope into her pack beside a tear-off calendar, a bay pack horse with a white blaze. Behind her, a young woman with a rubber apron rolled on her pack. ${PEOPLE.helen41}, wrapped in a blanket at the gate, coughing.`),
  "helen-14": panel("helen", "14", `Dark inside a shipping container used as a store, light through a bullet-holed door: stacked crates with yellow plastic freight tags, a canvas trader's pack spilled open, a tear-off calendar, and a sealed envelope. No people.`),
};

const args = process.argv.slice(2);
if (args[0] === "--brief") {
  const rows = Object.entries(ART).map(([name, a]) =>
    `### ${name}\n\n- **Save as**: \`${a.path}\`\n- **Generate at**: ${a.size}\n\n> ${a.prompt}\n`);
  writeFileSync("docs/narrative/art-requests.md", `# Art requests: Dev's and Helen's sets

Written by \`scripts/generate-dev-helen-art.ts --brief\`. **${Object.keys(ART).length} images**:
${Object.keys(ART).filter((k) => k.includes("card")).length} card still lifes and ${Object.keys(ART).filter((k) => !k.includes("card")).length} comic panels. Everything else in the two sets reuses
art already on disk.

## How to make them

- **Cards**: generate square, then crop to **1024 × 768** (4:3, keep the
  middle). Save as WebP, quality about 80.
- **Panels**: generate wide, then crop to 16:10 and resize to **1280 × 800**.
  Save as WebP, quality about 80.
- **No readable writing.** Invented lettering gets blurred with a feathered
  Gaussian mask, as was done for Mags's cards; the words live in the HTML.
- **Look**: a painted film still, not a cartoon. Match the existing panels in
  \`static/img/comic/mags/\` and \`static/img/comic/ruth/\`. Dev has a short
  beard throughout. Mags wears a navy beanie and apron. Ruth has glasses.
- **Nina's look is still Proposed**, so the trainee in Dev's panels 7 and 11
  and the young woman in Helen's panel 13 are drawn generic, not as Nina.
- **Check each against its scene** in \`src/game/collections.ts\` (the
  \`scene\` and \`shows\` text). If a picture differs, fix the text to match
  the picture, as was done for Mags.

## Wiring them in

In \`src/game/collections.ts\`, change \`art: null\` on the matching card to the
path as a string (\`art: "/static/img/cards/dev/roster.webp"\`), or on the
matching panel to \`art: { src: "/static/img/comic/dev/p01.webp" }\`. Then run
\`pnpm check\` against a running app on a fresh DATA_DIR: the specs check
that every path exists on disk.

## The images

${rows.join("\n")}`);
  console.log("wrote docs/narrative/art-requests.md");
} else {
  const { downloadTo, generateImage } = await import("./generate-image.ts");
  await Promise.all((args.length ? args : Object.keys(ART)).map(async (name) => {
    const a = ART[name];
    const out = `/tmp/dev-helen-art/${name}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}.png`;
    await downloadTo(await generateImage(a.prompt, { model: "flux-1.1-pro", size: a.size }), out);
    console.log(out);
  }));
}
