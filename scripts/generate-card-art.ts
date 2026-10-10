// Generates the pictures on Toby's collection cards (docs/narrative/toby-collection.md):
// each card is a found object, painted as a close still life from the same
// description the comic uses for it (OBJECTS in scripts/visual-bible.ts).
// Needs COMP4020_IMAGE_KEY; chosen images are resized into
// static/img/cards/toby/.
//   node --env-file=<file with COMP4020_IMAGE_KEY> scripts/generate-card-art.ts [card...]
import { downloadTo, generateImage } from "./generate-image.ts";
import { OBJECTS, STYLE } from "./visual-bible.ts";

// Found, not staged: each object where the player comes across it, in the
// light of that place. The generator writes nonsense words if allowed any,
// so writing is asked for as unreadable marks, viewed at an angle or out of
// focus; the card carries the real words.
const STILL = "close-up still life of a found object, as discovered in an abandoned place, shallow depth of field, no people. " +
  "There are no letters or words anywhere in the image: any writing is only faint wavy scribble lines, smudged and out of focus";

export const CARDS: Record<string, string> = {
  // Everything is drawn on the paper; asked for loosely, the generator put
  // real dogs in the cupboard.
  "crayon-drawing": `${STILL}: a sheet of yellowed paper taped flat inside a dusty cupboard door, filling the frame, with a crude wax crayon drawing by an eight-year-old on it. The drawing shows, all in crayon: on the left a white boxy rubbish cart on four little wheels with a big smiling face, blue musical notes rising from it, and on the right three simple stick-legged dogs, one brown and white, one black and white, one small and tan. No real animals, no words. A shaft of grey light, ${STYLE}`,
  worksheet: `${STILL}: a laminated school worksheet curled at one corner, seen from a low angle so the page is foreshortened and out of focus, the plastic laminate catching torchlight glare across the page, a red star sticker in sharp focus in the corner, pinned on a faded school display board in a windowless room, ${STYLE}`,
  "passenger-list": `${STILL}: a clipboard holding a pale yellow carbon-copy form seen at a low oblique angle, ruled rows of blurred unreadable scribble, a column of blue tick marks in sharp focus, one pencil scrawl squeezed into the margin, in an open ring binder on a dusty desk in a ransacked cash office, ${STYLE}`,
  "locker-6": `${STILL}: an open grey steel staff locker, taped inside its door one small faded school portrait photo of a gap-toothed boy of eleven with untidy sandy-brown hair in an oversized orange high-visibility vest, plain photo with no border text, a small folded slip of paper tucked behind it, a child's navy school jumper hanging on the hook, the locker otherwise empty, dim supermarket staff room, ${STYLE}`,
  "school-card": `${STILL}: a scuffed laminated school ID card the size of a credit card on a frayed lanyard, a small photo of a boy of thirteen and a plain green header band, the printing tiny and worn away, pinned inside the white plastic bin of an overturned cart beside a folded map, dusk light, ${STYLE}`,
  logbook: `${STILL}: a small water-stained hardback logbook open to pages of faint pencil scribble, in a dented tin beside a canvas toolbag, on damp concrete in a dark water-works tunnel, torchlight from one side, ${STYLE}`,
  "valve-chalk": `${STILL}: a large iron valve wheel mounted upright on a concrete tunnel wall, wrapped in heavy chain with a brass padlock and a yellow plastic tag, below it on the wall rough chalk scrawl, out of focus and half rubbed away, dark tunnel, torchlight, ${STYLE}`,
  "shelter-chalk": `${STILL}: the inside steel wall of a roadside bus shelter seen at a steep angle, a small chalk drawing of a sitting dog in sharp focus, beside it rough chalk scrawl, blurred, smeared and rubbed over, dusk light, an empty highway blurred beyond, ${STYLE}`,
  letter: `${STILL}: a dented round painted biscuit tin with its lid leaning against it, pencil tick marks scratched on the lid, inside the tin a sheet of lined paper folded in three with a smaller folded note pinned to it, on a shelf inside the doorway of a ruined workshop office, early morning light, ${STYLE}`,
};

const names = process.argv.slice(2);
await Promise.all((names.length ? names : Object.keys(CARDS)).map(async (name) => {
  const out = `/tmp/card-art/${name}-${Date.now().toString(36)}.png`;
  const url = await generateImage(CARDS[name], { model: "flux-1.1-pro", size: "1024x1024" });
  await downloadTo(url, out);
  console.log(out);
}));
