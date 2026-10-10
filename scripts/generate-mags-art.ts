// Generates Mags's collection art (docs/narrative/mags.md): seven card
// still lifes (the passenger list is reused) and her twelve comic panels.
// People and objects are described in the words of scripts/visual-bible.ts.
// Needs COMP4020_IMAGE_KEY; chosen images are processed into
// static/img/cards/mags/ and static/img/comic/mags/.
//   node --env-file=<file with COMP4020_IMAGE_KEY> scripts/generate-mags-art.ts [name...]
import { downloadTo, generateImage } from "./generate-image.ts";
import { OBJECTS, PEOPLE, STYLE } from "./visual-bible.ts";

// As in generate-ruth-art.ts.
const PANEL = "a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render";
const STILL = "close-up still life of a found object, as discovered in an abandoned place, shallow depth of field, no people. " +
  "There are no letters or words anywhere in the image: any writing is only faint wavy scribble lines, smudged and out of focus";
const mags = PEOPLE.mags;
const mags71 = mags.replace("in her seventies", "of seventy-one").replace("slightly stooped, ", "");
const oilskin = `${mags}, in a long grey oilskin coat`;

export const CARDS: Record<string, string> = {
  jobbook: `${STILL}: ${OBJECTS.jobbook}, the lid off, under a dusty workbench, torchlight, ${STYLE}`,
  "bore-tag": `${STILL}: ${OBJECTS.boreTag}, inside a dim brick pump house, torchlight from one side, ${STYLE}`,
  keys: `${STILL}: ${OBJECTS.patelsKeys}, beside a roller door in a dusty workshop, grey light, ${STYLE}`,
  docket: `${STILL}: ${OBJECTS.docket}, oily tools blurred behind, ${STYLE}`,
  "unit-plate": `${STILL}: ${OBJECTS.unitPlate}, in a cramped underground shelter plant room, lamplight, ${STYLE}`,
  dropboard: `${STILL}: ${OBJECTS.dropboard}, morning light through the doorway, ${STYLE}`,
  // "Freight tag" got the word FREIGHT painted on it; the tag is described by shape alone.
  "door-tag": `${STILL}: ${OBJECTS.doorTag.replace("freight tag", "luggage-style tag, blank except for a few faint smudged marker scribbles")}, dusk light, peeling paint, ${STYLE}`,
};

export const PANELS: Record<string, string> = {
  "01": `${PANEL}. Before the war, summer light down a ladder into a small underground shelter's hatch room. ${mags71}, lying on her back under an air handler with a torch in her teeth. On the ladder step above her, a householder holding a carton of eggs. An exercise book open on an upturned bucket. ${STYLE}`,
  // Round 1 put Mags's beanie on Ruth too; Ruth is bareheaded here.
  "02": `${PANEL}. Exactly two women in the foreground. Morning in a supermarket car park, a queue at the door of a white coach bus. On the left, ${PEOPLE.ruth}, bareheaded, no hat, holding a clipboard of yellow forms and gesturing at the bus door. On the right, facing her, ${mags71}, her open palm raised flat between them, refusing, a stubborn half smile. ${STYLE}`,
  "03": `${PANEL}. The same bus queue in a supermarket car park. ${PEOPLE.anjali}, pressing a ring of house keys into the hand of ${mags71}. Worried people with bags behind them. ${STYLE}`,
  // Round 1 drew the main figure as a bearded man; the old woman leads the prompt now.
  "04": `${PANEL}. The main figure is an old woman, clean-faced, no beard: ${mags71}, coming down a steel hatch ladder into a cramped underground shelter with a heavy metal cylinder on her shoulder, an exercise book sticking out of her apron pocket. Below her, ${PEOPLE.coopers} asleep in a plastic washing basket, the young parents looking up at her. Afternoon light from the hatch, urgent, ${STYLE}`,
  "05": `${PANEL}. Night inside a small brick pump house, lit by one torch. ${mags71}, kneeling at an old electric pump motor with its cover off, a coil of copper wire across her lap, tapping letters into a small aluminium tag with a nail punch. Standing over her holding the torch, ${PEOPLE.dev34}. ${STYLE}`,
  "06": `${PANEL}. Spring, the open roller door of a small country workshop. ${mags}, standing in the doorway reading a sheet of lined paper, a ring of keys with a cardboard tag in her other hand, a pencil stub on a string. ${STYLE}`,
  "07": `${PANEL}. Seen through a dusty workshop window: an empty country road running north, four small figures walking away along it, a family. In the foreground, an old woman's hand hanging a ring of keys on a nail. ${STYLE}`,
  "08": `${PANEL}. A small country workshop stripped bare: an empty pegboard on the wall with painted outlines where tools used to hang, a yellow plastic tag left on the bench. ${oilskin}, standing in the doorway, an old ginger tabby cat with one torn ear at her boots. ${STYLE}`,
  "09": `${PANEL}. Night inside a cramped underground shelter, one lamp. ${mags}, sitting at a small table re-packing a water purifier cartridge with gloved hands. In the corner, a tall metal cylinder wrapped in a grey blanket. ${STYLE}`,
  "10": `${PANEL}. Winter, inside a cramped underground shelter's plant room. ${PEOPLE.ferrises}, watching from the hatch. ${mags}, wiring a small metal tag onto a tall cylindrical purifier stack, a pad of carbon dockets on the step beside her. Lamplight, ${STYLE}`,
  "11": `${PANEL}. Inside the office door of a small country workshop. ${oilskin}, pinning a note to a corkboard; on the shelf below, a green soup tin with a bowl upside down on it and a dented biscuit tin. Through the open door, far off, a roadside bus shelter. ${STYLE}`,
  "12": `${PANEL}. Dusk outside a small country workshop. A yellow plastic tag wired to the door handle. ${oilskin}, standing close, looking at the tag without touching it, unafraid. ${STYLE}`,
};

const names = process.argv.slice(2);
const all: Record<string, [string, string]> = {};
for (const [k, v] of Object.entries(CARDS)) all[`card-${k}`] = [v, "1024x1024"];
for (const [k, v] of Object.entries(PANELS)) all[`panel-${k}`] = [v, "1792x1024"];
await Promise.all((names.length ? names : Object.keys(all)).map(async (name) => {
  const [prompt, size] = all[name];
  const out = `/tmp/mags-art/${name}-${Date.now().toString(36)}.png`;
  const url = await generateImage(prompt, { model: "flux-1.1-pro", size });
  await downloadTo(url, out);
  console.log(out);
}));
