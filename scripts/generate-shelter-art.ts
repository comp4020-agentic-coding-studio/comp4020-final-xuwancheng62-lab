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

// Plants are painted on magenta instead, since keying out green would eat them.
const PLANT = PROP.replace("pure bright green", "pure bright magenta");
const TEXTURE = "seamless tileable texture, digital painting, painterly brushwork, flat front-on, even dim warm light, muted earthy palette, no objects, no text, no watermark";

export const ART: Record<string, { prompt: string; size: string }> = {
  shelf: { size: "1024x1024", prompt: `An empty grey steel storage shelving unit seen straight from the front, four flat shelves evenly spaced, bolted uprights, ${PROP}` },
  can: { size: "1024x1024", prompt: `A single dented food tin can standing upright, faded plain paper label with no writing, ${PROP}` },
  jug: { size: "1024x1024", prompt: `A single opaque milky white plastic water jug with a handle and a blue screw cap, standing upright, ${PROP}` },
  crate: { size: "1792x1024", prompt: `A long low open-topped wooden crate seen from the front, rough planks and corner battens, ${PROP}` },
  "scrap-1": { size: "1024x1024", prompt: `A single bent rusty sheet of scrap metal leaning upright, jagged edges, the whole background one flat even green with no floor and no horizon, ${PROP}` },
  "scrap-2": { size: "1024x1024", prompt: `A single rusty pipe offcut with a cog wheel and a bolt, standing upright, ${PROP}` },
  "scrap-3": { size: "1024x1024", prompt: `A single twisted piece of salvaged machinery, a coil spring and a bracket, rusty, standing upright, ${PROP}` },
  bed: { size: "1792x1024", prompt: `Seen exactly from the side, flat, long side facing the viewer: a narrow metal army cot with a thin mattress, a pillow at the left end and an olive green blanket, and to its right a small wooden nightstand with a little table lamp on it, ${PROP}` },
  planter: { size: "1792x1024", prompt: `A long low raised wooden planter box seen from the front, filled to the top with dark soil, ${PROP}` },
  growlamp: { size: "1024x1024", prompt: `A single small industrial grow lamp hanging from a short chain, cone-shaped metal shade, seen from the side, ${PROP}` },
  sprout: { size: "1024x1024", prompt: `A tiny bare-root seedling with two small leaves and a short stem, floating on its own, absolutely no pot, no container and no soil, ${PLANT}` },
  "potatoes-growing": { size: "1024x1024", prompt: `A young bushy potato plant, green leaves on short stems, no potatoes and no flowers, floating on its own, absolutely no pot, no container and no soil, ${PLANT}` },
  "potatoes-ready": { size: "1024x1024", prompt: `A full grown potato plant with small white flowers and a few potatoes at its base, no pot and no soil, ${PLANT}` },
  "beans-growing": { size: "1024x1024", prompt: `A young climbing bean plant on a thin stake, leaves only, no pot and no soil, ${PLANT}` },
  "beans-ready": { size: "1024x1024", prompt: `A tall bean plant climbing a thin stake, full of hanging green bean pods, no pot and no soil, ${PLANT}` },
  "mushrooms-growing": { size: "1024x1024", prompt: `A small cluster of tiny pale button mushrooms just emerging, no pot and no soil, ${PLANT}` },
  "mushrooms-ready": { size: "1024x1024", prompt: `A cluster of plump mature brown cap mushrooms, no pot and no soil, ${PLANT}` },
  "hatch-closed": { size: "1792x1024", prompt: `A round steel bunker hatch seen from the side, closed, lid lying flat on a thick concrete collar, a handwheel on top, ${PROP}` },
  "hatch-open": { size: "1024x1024", prompt: `A round steel bunker hatch seen from the side, open, the heavy lid swung up standing vertical on its hinge, thick concrete collar, ${PROP}` },
  earth: { size: "1024x1024", prompt: `Cross-section of dark packed earth underground, small stones, pebbles and thin roots, ${TEXTURE}` },
  concrete: { size: "1024x1024", prompt: `Dark weathered poured concrete wall, faint form lines, stains and small pits, ${TEXTURE}` },
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
  "survivor-7": { size: "1024x1024", prompt: `Latina woman in her twenties with a buzz cut and a small scar on her chin, olive drab hoodie, ${PORTRAIT}` },
  "survivor-8": { size: "1024x1024", prompt: `Elderly East Asian man with round glasses taped at the bridge and a thick wool scarf, ${PORTRAIT}` },
  "survivor-9": { size: "1024x1024", prompt: `Middle-aged woman with curly red hair tied up in a faded work bandana, worn brown canvas coat buttoned to the collar, ${PORTRAIT}` },
  "survivor-10": { size: "1024x1024", prompt: `Black man in his twenties with locs tied back, goggles around his neck, patched rain poncho, ${PORTRAIT}` },
  "survivor-11": { size: "1024x1024", prompt: `Freckled boy about fifteen in an oversized knitted beanie and a canvas satchel strap across his chest, ${PORTRAIT}` },
  "survivor-12": { size: "1024x1024", prompt: `South Asian woman in her sixties with short white hair and a hooded raincoat, kind weathered face, ${PORTRAIT}` },
};

const names = process.argv.slice(2);
for (const name of names.length ? names : Object.keys(ART)) {
  const a = ART[name];
  const out = `/tmp/shelter-art/${name}-${Date.now().toString(36)}.png`;
  const url = await generateImage(a.prompt, { model: "flux-1.1-pro", size: a.size });
  await downloadTo(url, out);
  console.log(out);
}
