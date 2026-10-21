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

// The twelve players follow the portraits picked at registration
// (scripts/generate-shelter-art.ts, survivor-1..12), so a player's figure
// is the person in their portrait, whole.
export const SPRITES: Record<string, string> = {
  toby: `A lean teenage boy of 16, about 174 cm, untidy sandy-brown hair tied back short, a round freckled face, ears that stick out a little, ` +
    `a patched olive work jacket over a bright orange hi-vis vest cut down to fit, fingerless gloves, a tool roll on his belt, faded cargo trousers, worn boots, ` +
    `chalk dust on his fingers, ${FIGURE}`,
  "player-1": `A woman in her thirties with short dark hair, goggles pushed up on her forehead, a scarf, a canvas jacket, a small backpack, ${FIGURE}`,
  "player-2": `An older man with a grey beard and a knitted cap, layered heavy coats, a small backpack, ${FIGURE}`,
  "player-3": `A young man with a shaved head, a dust mask around his neck, a padded vest with tool straps, a small backpack, ${FIGURE}`,
  "player-4": `A woman in her fifties with long grey braided hair, a poncho with the hood down, a small backpack, ${FIGURE}`,
  "player-5": `A teenage girl with a messy ponytail, an oversized military jacket, a bandage wrapped on one hand, a small backpack, ${FIGURE}`,
  "player-6": `A man in his forties with curly black hair, a respirator hanging at his chest, a leather work apron, a small backpack, ${FIGURE}`,
  "player-7": `A Latina woman in her twenties with a buzz cut, an olive drab hoodie, cargo trousers, a small backpack, ${FIGURE}`,
  "player-8": `An elderly East Asian man with round glasses taped at the bridge, a thick wool scarf, a long coat, a small backpack, ${FIGURE}`,
  "player-9": `A middle-aged woman with curly red hair tied up in a faded work bandana, a worn brown canvas coat buttoned to the collar, a small backpack, ${FIGURE}`,
  "player-10": `A Black man in his twenties with locs tied back, goggles around his neck, a patched rain poncho, a small backpack, ${FIGURE}`,
  "player-11": `A freckled boy about fifteen in an oversized knitted beanie, a canvas satchel strap across his chest, a baggy jacket, ${FIGURE}`,
  "player-12": `A South Asian woman in her sixties with short white hair, a hooded raincoat with the hood down, a small backpack, ${FIGURE}`,
  mags: `A small wiry stooped old woman of 77, about 155 cm, cropped white hair under a dark navy blue knitted beanie, deeply lined face, no glasses, ` +
    `wearing a long slate-grey waxed oilskin coat that reaches her knees, worn open over an oil-stained navy work shirt, a canvas apron full of pockets under the coat, ` +
    `a jeweller's loupe on a bootlace round her neck, men's steel-capped boots, a large spanner hanging in her right hand, ${FIGURE}`,
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
