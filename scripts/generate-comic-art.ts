// Generates the panels of Toby's comic (docs/narrative/toby-collection.md)
// through the course image proxy (needs COMP4020_IMAGE_KEY). Kept so the
// prompts are on record; the chosen images are resized into
// static/img/comic/toby/.
//   node --env-file=<file with COMP4020_IMAGE_KEY> scripts/generate-comic-art.ts [panel...]
import { downloadTo, generateImage } from "./generate-image.ts";

// One look for every panel: the shelter's painted style, no lettering (the
// captions carry the words), nothing graphic.
const STYLE =
  "comic book panel illustration, digital painting, painterly brushwork, muted earthy palette, cinematic composition, " +
  "fictional Australian country town after a war, no speech bubbles, no text, no lettering, no readable writing, no watermark, no gore";

// The same people, described the same way each time.
const TOBY = "a small thin boy of eleven, a young child not a teenager, with untidy sandy-brown hair and a gap in his front teeth";
const DOGS = "three ordinary mixed-breed dogs: a big brown cattle-dog cross, a slim black-and-white dog and a small scruffy tan terrier";

export const PANELS: Record<string, string> = {
  "01": `A sunny Australian suburban footpath before the war, low brick houses and gum trees, a small white automated rubbish-collection cart on little wheels with a friendly face painted on its front, parked with nobody in it; on the footpath beside the cart ${TOBY} kneels on the ground holding out food to ${DOGS}, warm afternoon light, hopeful mood, ${STYLE}`,
  "02": `Night inside a small supermarket staff room, the main lights off and only a dim emergency light glowing, ${TOBY} asleep across two plastic chairs under an adult's jacket, an old portable radio on a shelf, grey metal lockers along the wall, quiet uneasy mood, ${STYLE}`,
  "03": `Morning in a supermarket car park, a long queue of worried people beside a white coach bus, each carrying one bag, in the foreground ${TOBY} wearing a huge adult-size orange high-visibility vest that hangs down to his knees, clutching a plastic carrier bag, and beside him a woman in a supermarket uniform polo shirt, cropped so only her torso and her hand resting on his shoulder are visible, hazy brownish sky, ${STYLE}`,
  "04": `A single white coach bus very far away on an empty straight highway through dry Australian farmland, flat paddocks and a few dead trees, grey hazy sky, wide long shot, lonely mood, ${STYLE}`,
  "05": `A laminated student identity card lying on a folding trestle table inside a canvas tent, through the open tent flap the old exhibition pavilions and a wooden grandstand of a country showground, rows of camp beds, muted daylight, the card's printing is blurred and unreadable, ${STYLE}`,
  "06": `An empty cracked country road stretching to the horizon, a single line of small footprints in the red dust leading away, dry grass on both verges, hazy grey and orange sky, no people, ${STYLE}`,
  "07": `Inside a long concrete water-works tunnel lit by a single torch, a man in work overalls seen from behind and a lanky teenage boy whose face is in deep shadow, both kneeling to clear metal intake screens in shallow running water, warm torchlight on wet concrete, close quiet teamwork, ${STYLE}`,
  "08": `Close view of a large old iron valve wheel in a concrete tunnel, wrapped tight in a heavy chain with a padlock, a yellow plastic tag wired to the chain, pale chalk marks scrawled on the wall below, cold dim light, no people, still and ominous, ${STYLE}`,
  "09": `The dark mouth of a concrete highway underpass at dusk, an overturned small white collection cart with a faded painted face, a small solar panel and a car battery beside it, a row of steel dog bowls, a rolled sleeping bag, several large lean feral dogs watching from the shadows at a distance, no people, ${STYLE}`,
  "10": `The inside wall of a weathered roadside bus shelter, one small simple white chalk drawing of a dog and a few chalk tally lines on the scratched metal panel, absolutely no words or letters anywhere, an empty highway beyond under a dusk sky, no people, ${STYLE}`,
};

const names = process.argv.slice(2);
for (const name of names.length ? names : Object.keys(PANELS)) {
  const out = `/tmp/comic-art/${name}-${Date.now().toString(36)}.png`;
  const url = await generateImage(PANELS[name], { model: "flux-1.1-pro", size: "1792x1024" });
  await downloadTo(url, out);
  console.log(out);
}
