// Generates full-body standing figures for the shelter scene through the
// course image proxy (needs COMP4020_IMAGE_KEY). Painted on flat green and
// cut out with scripts/cut-character-sprites.py, like the shelter props.
// Looks come from docs/narrative/visual-bible.md. Kept so the prompts are on
// record; only the chosen, cut-out figures are committed.
//   node --env-file=<file with COMP4020_IMAGE_KEY> scripts/generate-character-sprites.ts <name...>
import { downloadTo, generateImage } from "./generate-image.ts";

// One figure, whole body, side-on facing right, small enough to read in a
// room: the silhouette matters more than the face.
const FIGURE =
  "2D side-view game character sprite, digital painting, painterly brushwork matching a gritty painted underground bunker, " +
  "one person standing, whole body visible from the top of the head to the boots, seen from the side facing right in a relaxed standing pose, " +
  "arms at the sides, readable silhouette, worn weathered post-apocalyptic clothes, muted earthy palette, warm light from above, " +
  "isolated on a flat solid pure bright green background, nothing else in the frame, no floor, no cast shadow, no text, no watermark";

export const SPRITES: Record<string, string> = {
  mags: `A small wiry stooped woman of 77, about 155 cm, cropped white hair under a navy knitted beanie, deeply lined face, ` +
    `a long grey oilskin coat to her knees over an oil-stained navy work shirt, a canvas apron full of pockets, a jeweller's loupe on a bootlace round her neck, ` +
    `men's steel-capped boots, a large spanner in her right hand, ${FIGURE}`,
};

async function main(): Promise<void> {
  const names = process.argv.slice(2);
  if (!names.length) throw new Error(`name a figure: ${Object.keys(SPRITES).join(", ")}`);
  for (const name of names) {
    const prompt = SPRITES[name];
    if (!prompt) throw new Error(`unknown figure ${name}`);
    const out = `output/sprites/${name}-m${Date.now()}.png`;
    await downloadTo(await generateImage(prompt, { model: "flux-1.1-pro", size: "1024x1792" }), out);
    console.log(`saved ${out}`);
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});
