// Generates Holdout's character reference sheets (docs/narrative/visual-bible.md)
// through the course image proxy (needs COMP4020_IMAGE_KEY). Each sheet keeps
// every version of a person in one image, because one generation holds a
// face steady far better than separate ones. Approved sheets are copied into
// docs/narrative/visual-bible/.
//   node --env-file=<file with COMP4020_IMAGE_KEY> scripts/generate-character-refs.ts [sheet...]
import { downloadTo, generateImage } from "./generate-image.ts";
import { ANIMALS, PEOPLE, SHEET, STYLE, THINGS } from "./visual-bible.ts";

export const SHEETS: Record<string, string> = {
  // Painted, not cartoon: the first attempt came back as a 3D cartoon with
  // the clothes on the wrong ages, so each age's outfit is pinned to its place.
  "toby-ages": `${SHEET}, graphic novel character art with natural realistic human proportions, not cartoon, not chibi, not a 3D render, exactly three figures and nothing else, an age progression lineup of ONE boy, left to right growing taller, each in front view, unmistakably the same face at every age. LEFT figure, the shortest: ${PEOPLE.toby11}. MIDDLE figure: ${PEOPLE.toby14}. RIGHT figure, the tallest: ${PEOPLE.toby16}. ${STYLE}`,
  // The lineup above came back as a cartoon three times; a turnaround of one
  // age at a time stays painted, and the lineup is assembled from these.
  "toby-11": `${SHEET}, turnaround of one child: front view, three-quarter view, side view and back view in a row, plus three head-and-shoulders close-ups, curious, delighted and frightened, all the same person, natural proportions: ${PEOPLE.toby11}, ${STYLE}`,
  "toby-14": `${SHEET}, turnaround of one teenage boy: front view, three-quarter view, side view and back view in a row, plus three head-and-shoulders close-ups, sullen, stubborn and unsure, all the same person: ${PEOPLE.toby14}, ${STYLE}`,
  "toby-16": `${SHEET}, turnaround of one teenage boy: front view, three-quarter view, side view and back view in a row, plus three head-and-shoulders close-ups showing a guarded neutral look, a quick crooked grin and quiet grief, all the same person: ${PEOPLE.toby16}, ${STYLE}`,
  kerry: `${SHEET}, the same woman twice side by side, (left) ${PEOPLE.kerry}; (right) three years later, ${PEOPLE.kerry39}; plus two head close-ups, one warm and one worried, ${STYLE}`,
  ruth: `${SHEET}, the same woman twice side by side, (left) ${PEOPLE.ruth}; (right) three years later, ${PEOPLE.ruth64}; plus two head close-ups, one stern and one with a reluctant softness, ${STYLE}`,
  dev: `${SHEET}, turnaround of one man: front view, three-quarter view and side view in a row, plus two head close-ups, one patient and teaching and one tense: ${PEOPLE.dev}, ${STYLE}`,
  hounds: `${SHEET}, two different anonymous raiders standing side by side, one tall and one stocky, front view and three-quarter view, faces fully covered: ${PEOPLE.hound}, ${STYLE}`,
  dogs: `${SHEET}, animal reference sheet, side views on the same scale left to right: ${ANIMALS.bigsy}; ${ANIMALS.lady}; ${ANIMALS.chips}; and much larger on the right, ${ANIMALS.pack}, ${STYLE}`,
  gerald: `${SHEET}, prop reference sheet of one vehicle from the front, three-quarter and side: ${THINGS.gerald}, ${STYLE}`,
};

const names = process.argv.slice(2);
for (const name of names.length ? names : Object.keys(SHEETS)) {
  const out = `/tmp/refs/${name}-${Date.now().toString(36)}.png`;
  const url = await generateImage(SHEETS[name], { model: "flux-1.1-pro", size: "1792x1024" });
  await downloadTo(url, out);
  console.log(out);
}
