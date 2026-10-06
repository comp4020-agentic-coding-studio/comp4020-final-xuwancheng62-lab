// Generates the shelter's painted room backdrops and the survivor portraits
// through the course image proxy (needs COMP4020_IMAGE_KEY). Kept so the
// prompts are on record; the chosen images are committed under
// static/img/shelter/ and static/img/survivors/ after resizing.
//   node --env-file=<file with COMP4020_IMAGE_KEY> scripts/generate-shelter-art.ts [name...]
import { downloadTo, generateImage } from "./generate-image.ts";

// Backdrops sit behind drawn equipment, so the middle of each wall stays bare.
const ROOM =
  "2D side-view game background, digital painting, painterly brushwork, straight-on front view of the back wall of an underground bunker room, " +
  "flat orthographic view with no perspective and no side walls, the floor is a thin strip along the bottom edge, ceiling along the top edge, " +
  "dim warm lamp light from above, muted earthy palette, grimy concrete, empty open wall in the middle, no furniture, no people, no text, no lettering, no signs, no watermark";

const PORTRAIT =
  "head-and-shoulders portrait, digital painting, painterly brushwork, post-apocalyptic survivor, dusty weathered clothes, warm dim lamp light from one side, " +
  "dark plain background, muted earthy palette, looking toward the viewer, no text, no watermark";

// Equipment is painted on flat green and keyed out, so it can stand in any room.
const PROP =
  "2D side-view game asset, digital painting, painterly brushwork, straight side view with no perspective, worn and rusted, muted earthy palette, " +
  "warm light from above, isolated on a flat solid pure bright green background, nothing else in the frame, no floor, no cast shadow, no people, no text, no lettering, no watermark";

export const ART: Record<string, { prompt: string; size: string }> = {
  generator: {
    size: "1792x1024",
    prompt: `Heavy diesel generator on skids, long low steel housing in faded olive and grey, louvred side vents, a small control panel with one round indicator lamp and two dials, an exhaust pipe rising from the top, cables coiled at one end, ${PROP}`,
  },
  purifier: {
    size: "1024x1024",
    prompt: `Water purification unit: a tall riveted steel cylindrical tank with a wide vertical glass sight window down its front, copper pipes leading in at the top, a small pump box beside it with a tap, ${PROP}`,
  },
  ladder: {
    size: "1024x1792",
    prompt:
      "Seamless vertical texture for a 2D side-view game, digital painting, painterly brushwork, flat orthographic close-up of a rusted steel ladder on a dark concrete wall, " +
      "the two rails are perfectly parallel and vertical and fill most of the width, no perspective, no vanishing point, evenly spaced flat rungs from top to bottom edge, " +
      "even dim warm light, muted earthy palette, no people, no text, no watermark",
  },

  "room-generator": { size: "1792x1024", prompt: `Power room: cables and conduits running along the ceiling, oil stains on the concrete, a fuse box at the far edge, ${ROOM}` },
  "room-purifier": { size: "1792x1024", prompt: `Water room: cracked white tiles on the lower wall, copper and steel pipes along the ceiling, damp water stains, ${ROOM}` },
  "room-storage": { size: "1792x1024", prompt: `Storeroom: bare cinderblock wall, scuffed paint, a few hooks and chalk tally marks near the top, ${ROOM}` },
  "room-quarters": { size: "1792x1024", prompt: `Sleeping quarters: patched plaster wall, a faded blanket hung as a curtain at one edge, a few nails, cosy but worn, ${ROOM}` },
  "room-greenhouse": { size: "1792x1024", prompt: `Underground grow room: damp concrete wall with moss in the cracks, irrigation pipes and a rail along the ceiling, faint green tint, ${ROOM}` },
  surface: {
    size: "1792x1024",
    prompt:
      "2D side-view game background, digital painting, painterly brushwork, wide flat horizon of a ruined city skyline in silhouette at dusk, " +
      "broken towers and pylons, dusty orange haze low in the sky fading to dark grey above, barren ground along the bottom edge, muted palette, no people, no text, no watermark",
  },
  "survivor-1": { size: "1024x1024", prompt: `Woman in her thirties with short dark hair, scarf and canvas jacket, goggles pushed up on her forehead, ${PORTRAIT}` },
  "survivor-2": { size: "1024x1024", prompt: `Older man with a grey beard and a knitted cap, layered coats, a scar on his cheek, ${PORTRAIT}` },
  "survivor-3": { size: "1024x1024", prompt: `Young man with a shaved head and a dust mask around his neck, padded vest with tool straps, ${PORTRAIT}` },
  "survivor-4": { size: "1024x1024", prompt: `Woman in her fifties with grey braided hair, poncho and a hood down, calm tired eyes, ${PORTRAIT}` },
  "survivor-5": { size: "1024x1024", prompt: `Teenage girl with a messy ponytail, oversized military jacket, bandage on one hand, ${PORTRAIT}` },
  "survivor-6": { size: "1024x1024", prompt: `Man in his forties with curly black hair and a respirator hanging at his chest, leather work apron, ${PORTRAIT}` },
};

const names = process.argv.slice(2);
for (const name of names.length ? names : Object.keys(ART)) {
  const a = ART[name];
  const out = `/tmp/shelter-art/${name}-${Date.now().toString(36)}.png`;
  const url = await generateImage(a.prompt, { model: "flux-1.1-pro", size: a.size });
  await downloadTo(url, out);
  console.log(out);
}
