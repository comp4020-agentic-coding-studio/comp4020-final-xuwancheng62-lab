// Generates Ruth's collection art (docs/narrative/collections-next.md): six
// card still lifes and ten comic panels (her panels 3 and 9 reuse Toby's).
// People and objects are described in the words of scripts/visual-bible.ts.
// Needs COMP4020_IMAGE_KEY; chosen images are processed into
// static/img/cards/ruth/ and static/img/comic/ruth/.
//   node --env-file=<file with COMP4020_IMAGE_KEY> scripts/generate-ruth-art.ts [name...]
import { downloadTo, generateImage } from "./generate-image.ts";
import { OBJECTS, PEOPLE, STYLE } from "./visual-bible.ts";

// As in generate-comic-panels.ts: "graphic novel" gives cartoons.
const PANEL = "a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render";
// As in generate-card-art.ts: the generator writes nonsense if it may.
const STILL = "close-up still life of a found object, as discovered in an abandoned place, shallow depth of field, no people. " +
  "There are no letters or words anywhere in the image: any writing is only faint wavy scribble lines, smudged and out of focus";
const walker = "a road-dusty walker with a pack and a wide hat";

export const CARDS: Record<string, string> = {
  // Seen from the shop floor side the sign shows only its plain back, so
  // there's no lettering for the generator to invent.
  "limits-sign": `${STILL}: a scratched perspex screen at a supermarket checkout seen at a steep angle from behind, a flattened cereal box taped to the inside of it so only the box's plain brown cardboard back and yellowed tape face the viewer, a dusty till and conveyor belt, a dark empty supermarket beyond, grey light, ${STYLE}`,
  fax: `${STILL}: ${OBJECTS.esdFax}, on a dusty desk in a small manager's office, ${STYLE}`,
  "cs4-board": `${STILL}: ${OBJECTS.cs4Board}, in a dark underground car park, cardboard and camp beds blurred on the floor behind, torchlight, ${STYLE}`,
  "radio-log": `${STILL}: ${OBJECTS.radioLog}, in a windowless radio room, lamplight, ${STYLE}`,
  "day-140": `${STILL}: a closed school exercise book with a plain blue card cover, lying inside an open square metal biscuit tin, the tin's lid beside it with strips of old brown tape on its edge, on a desk in a dusty office by a window, ${STYLE}`,
  chit: `${STILL}: ${OBJECTS.exchangeChit}, seen close through the split, in a dim workshop, ${STYLE}`,
};

export const PANELS: Record<string, string> = {
  "01": `${PANEL}. Night inside a small Australian country supermarket before the war, fluorescent light. In the foreground ${PEOPLE.ruth}, standing by the door with her arms folded. At a checkout behind a perspex screen with a hand-lettered cardboard sign taped inside it, ${PEOPLE.gary}, arguing, holding up a tin. At the next till, ${PEOPLE.kerry}. ${STYLE}`,
  "02": `${PANEL}. Early morning in a cramped supermarket manager's office. ${PEOPLE.ruth}, sitting at the desk writing with a blue biro across the bottom of a curling fax sheet, frowning. Through the window behind her, a big truck reversing into a loading bay. ${STYLE}`,
  "04": `${PANEL}. Late morning in a supermarket car park. A white coach bus pulling away, a small boy of about nine looking out of one window. Left behind on the tarmac, watching it go, ${PEOPLE.ruth}, a clipboard of yellow forms in her hand. A tall siren pole in the background. ${STYLE}`,
  "05": `${PANEL}. An underground car park used as a shelter, lit by camping lanterns: rows of people on cardboard and camp beds. In the middle ground ${PEOPLE.ruth}, writing on a small whiteboard screwed to a concrete pillar. Beside the pillar ${PEOPLE.gary}, watching her, two children asleep on a camp bed behind him. Close, tired, quiet. ${STYLE}`,
  "06": `${PANEL}. Before dawn in a small windowless radio room at a water pumping station, one lamp. ${PEOPLE.dev.replace("a canvas tool bag stencilled with white letters", "no bag")}, sitting at an old two-way radio set with headphones half on, writing in a hardback notebook. ${STYLE}`,
  "07": `${PANEL}. A dusty office upstairs at a pumping station. ${PEOPLE.ruth}, wearing a fleece vest over her polo, sitting at a desk writing the last line in a school exercise book, an open square biscuit tin beside it. Through the window behind her, a line of people with packs waiting in the yard. ${STYLE}`,
  "08": `${PANEL}. A wide dry country road at dawn, a line of nineteen people with packs walking north beside a row of old concrete pipe markers. At the front a tall bearded man with a map; at the very back, small in the frame, a short sturdy grey-haired woman. Long shadows, ${STYLE}`,
  "10": `${PANEL}. A trading shed by a river weir, shelves of crates and cartridges. Behind a wooden counter ${PEOPLE.ruth64}, holding out a folded note. On the other side ${walker}, half turned away, hesitating to take it, sorry for her. ${STYLE}`,
  "11": `${PANEL}. A wooden counter in a trading shed. Across it stands ${PEOPLE.hound}, faceless, one gloved hand laying a yellow plastic tag on the counter. In the foreground ${PEOPLE.ruth64}, seen from behind her shoulder, her hand firmly pushing the tag back across the counter. Tense, ${STYLE}`,
  "12": `${PANEL}. Dusk in a trading shed by a river weir, lamplight. ${PEOPLE.ruth66}, stamping a small tin token with a hand press and pressing one into the hand of ${walker}. On a shelf behind her, three envelopes tied together with string. Tired, steady, ${STYLE}`,
};

const names = process.argv.slice(2);
const all: Record<string, [string, string]> = {};
for (const [k, v] of Object.entries(CARDS)) all[`card-${k}`] = [v, "1024x1024"];
for (const [k, v] of Object.entries(PANELS)) all[`panel-${k}`] = [v, "1792x1024"];
await Promise.all((names.length ? names : Object.keys(all)).map(async (name) => {
  const [prompt, size] = all[name];
  const out = `/tmp/ruth-art/${name}-${Date.now().toString(36)}.png`;
  const url = await generateImage(prompt, { model: "flux-1.1-pro", size });
  await downloadTo(url, out);
  console.log(out);
}));
