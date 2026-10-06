// Generates the World map and destination pictures through the course image
// proxy (needs COMP4020_IMAGE_KEY). Kept so the prompts are on record; the
// chosen images are committed under static/img/world/ after resizing.
//   node --env-file=<file with COMP4020_IMAGE_KEY> scripts/generate-world-art.ts [name...]
import { downloadTo, generateImage } from "./generate-image.ts";

const STYLE = "realistic photograph, overcast dusty light, muted desaturated colours, post-apocalyptic, no people, no text, no watermark";

export const ART: Record<string, { prompt: string; size: string }> = {
  map: {
    size: "1792x1024",
    prompt:
      "Straight top-down satellite photograph of abandoned countryside outskirts years after a collapse: cracked empty roads, a dry lake bed with pale silt, " +
      "patches of dead forest, a few ruined buildings and warehouses, overgrown fields, dust. Orthographic aerial imagery, realistic, muted desaturated colours, " +
      "no labels, no text, no map symbols, no people",
  },
  supermarket: { size: "1792x1024", prompt: `Abandoned suburban supermarket with a blank weathered facade and no signage or lettering, smashed glass front, dark unlit interior with bare stripped shelves, rusted shopping trolleys in a cracked weedy car park, ${STYLE}` },
  workshop: { size: "1792x1024", prompt: `Interior of a ruined mechanical workshop, rusted tools on a workbench, tangled wiring, old car batteries, light through a broken roof, ${STYLE}` },
  reservoir: { size: "1792x1024", prompt: `Dry reservoir with cracked silt, a few shallow pools of water left, a concrete dam wall and an old pumping station, ${STYLE}` },
  nest: { size: "1792x1024", prompt: `Creature nest inside a collapsed concrete underpass, piles of bones, scrap and hoarded cans, scratch marks on the walls, dark and threatening, ${STYLE}` },
};

const names = process.argv.slice(2);
for (const name of names.length ? names : Object.keys(ART)) {
  const a = ART[name];
  const out = `/tmp/world-art/${name}-${Date.now().toString(36)}.png`;
  const url = await generateImage(a.prompt, { model: "flux-1.1-pro", size: a.size });
  await downloadTo(url, out);
  console.log(out);
}
