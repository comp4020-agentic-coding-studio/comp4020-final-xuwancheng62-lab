// Generates the panels of Toby's comic, revision 3
// (docs/narrative/toby-comic-script.md), through the course image proxy
// (needs COMP4020_IMAGE_KEY). Every person and found object is described in
// the exact words of scripts/visual-bible.ts, so they match each other and
// the collection cards. Chosen images are resized into static/img/comic/toby/.
// Panel 1 keeps its approved painting (scripts/generate-comic-art.ts).
//   node --env-file=<file with COMP4020_IMAGE_KEY> scripts/generate-comic-panels.ts [panel...]
import { downloadTo, generateImage } from "./generate-image.ts";
import { ANIMALS, OBJECTS, PEOPLE, STYLE, THINGS } from "./visual-bible.ts";

// "Graphic novel" brought back cartoon line art every time; the approved
// panel 1 reads as a painted film still, so that's what is asked for.
const PANEL = "a painterly realistic digital painting like a film still, visible brushwork, natural realistic proportions and faces, cinematic composition, not cartoon, not anime, no ink outlines, not a 3D render";
// "big eyes" pulls a child toward an animated-film face; panels drop it.
const toby11 = PEOPLE.toby11.replace("big grey-green eyes", "grey-green eyes") + ", a realistic child, photographic proportions";
const toby13 = PEOPLE.toby14.replace("Toby at fourteen", "Toby at thirteen").replace("about 160 cm", "about 155 cm").replace(", a canvas pack", "");
const toby15 = PEOPLE.toby16.replace("Toby at sixteen", "Toby at fifteen").replace("about 174 cm", "about 170 cm");

export const PANELS: Record<string, string> = {
  "02": `${PANEL}. Exactly two people. Evening in a small Australian country supermarket before the war, dim warm light. In the foreground, filling the left half of the frame, ${toby11}, sitting on an upturned plastic milk crate, bent over a school worksheet on a clipboard on his knee, pencil in hand, his school bag at his feet with a tin of dog food sticking out. In the background on the right, slightly out of focus, ${PEOPLE.kerry}, standing at a checkout till, looking back at him over her shoulder. ${STYLE}`,
  "03": `${PANEL}. Exactly two people: one woman and one boy. Night in a small supermarket staff room lit only by a dim green emergency light. Clearly visible in the background, in sharp focus: a row of grey steel lockers, one locker door standing open with a small school photo of a boy taped inside it; on a cupboard door beside the lockers a child's crayon drawing of dogs and a white cart. In the foreground, ${PEOPLE.kerry} crouches beside two plastic chairs, one hand on the shoulder of a small boy of eleven who is lying asleep across the chairs under her jacket. Urgent mood, ${STYLE}`,
  "04": `${PANEL}. Morning in a supermarket car park, a long queue of worried people beside a white coach bus. On the right, ${PEOPLE.ruth}, no vest, holding a brown clipboard with pale yellow forms and writing on it with a pencil, looking down at the boy. On the left, much shorter than her, his head only reaching her chest, a small eleven-year-old child with untidy sandy-brown hair and freckles, wearing a huge adult orange high-visibility vest that hangs to his knees over an olive school polo, clutching a bulging plastic carrier bag to his chest with both arms, looking up at her pleading. Hazy brownish sky, ${STYLE}`,
  "05": `${PANEL}. Daytime inside a canvas tent used as a school at a crowded country showground refugee camp. At a folding trestle table ${toby13}, absorbed in taking apart an old radio with a screwdriver, ${OBJECTS.schoolCard} hanging round his neck. Through the open tent flap, old exhibition pavilions, a dusty arena and rows of tents, ${STYLE}`,
  "06": `${PANEL}. Night inside a small canvas tent lit by one oil lamp. ${PEOPLE.toby14}, the pack on his shoulder, facing ${PEOPLE.kerry39}, who stands between him and the tent flap with her arms folded, tired and hurt. Tense, quiet argument, ${STYLE}`,
  "07": `${PANEL}. A trading shed beside a river weir, shelves stacked with crates and water-purifier cartridges, afternoon light through the gaps. Behind a wooden counter ${PEOPLE.ruth64}, her reading glasses low on her nose, looking up in recognition at ${PEOPLE.toby14}, road-dirty and tired, standing at the counter. ${STYLE}`,
  "08": `${PANEL}. A workbench inside a small water-treatment plant by a weir, pipes and gauges, daylight from a high window. ${PEOPLE.dev}, packing a cylindrical water-purifier cartridge with careful hands, while ${PEOPLE.toby14.replace(", a canvas pack", "")}, sleeves pushed up, leans in watching closely. Teaching, patient mood, ${STYLE}`,
  "09": `${PANEL}. Inside a long concrete water-works tunnel by torchlight. The main subject, in the foreground and dry: ${PEOPLE.dev}, sitting on a raised concrete ledge, a small hardback notebook open on his knee, writing in it with a pencil, a faint proud smile, his canvas tool bag beside him. Far down the tunnel behind him, small and distant, a teenage boy in an orange vest crouches in shallow water working at a metal grate, his face turned away. Warm torchlight on wet concrete, ${STYLE}`,
  "10": `${PANEL}. A long dark concrete tunnel seen from behind a defender. At the far end, four hooded figures in grey coats and grey respirator masks, backlit by harsh torchlight, faceless silhouettes, advancing toward the viewer. In the foreground, with his back to the viewer and facing them, ${PEOPLE.dev}, his arms spread wide to block the tunnel, his navy overalls and head torch clearly visible. At the lower left, a teenage boy in an orange vest scrambles into a round dark drain pipe opening low in the tunnel wall, only his back and legs visible. Tension, nothing graphic, no weapons fired, ${STYLE}`,
  "11": `${PANEL}. Days later, a dim concrete tunnel. ${OBJECTS.valveChalk.replace("white chalk capitals on grey concrete below a faded painted note, under ", "")} on the wall. Kneeling on the floor right below the wheel, seen from directly behind, a lean teenage boy in a patched olive work jacket over a faded orange vest, sandy-brown hair tied back, reaching up to write on the wall with a stick of white chalk, his face not visible, the chalk marks rough and unreadable. Cold torchlight, grief, ${STYLE}`,
  "12": `${PANEL}. The dark mouth of a concrete highway underpass at dusk. ${THINGS.gerald} lying on its side, a small solar panel wired to a round speaker, a row of steel dog bowls, a rolled sleeping bag. Crouched by the bowls, seen from behind and in shadow, a lean teenage boy in a patched olive work jacket over a faded orange vest, holding out his hand. Around him, five big lean feral dogs, each ${ANIMALS.pack.replace("a fallout-born feral dog from the depot pack: ", "")}, standing at a wary distance, one closer than the rest sniffing his hand. The dogs are clearly visible and important to the scene. Warm, tense trust, ${STYLE}`,
  "13": `${PANEL}. A weathered roadside bus shelter at dusk, plain dented steel inside wall. Seen from behind, his back to the viewer and his face turned to the wall, a lean teenage boy in a patched olive work jacket over a faded orange vest, sandy-brown hair tied back, holding a stick of white chalk to the wall, where there is a small simple line drawing of a sitting dog in white chalk and a few rough unreadable chalk marks, nothing else on the wall. His tool roll and a mended old radio sit on the bench. An empty highway outside under an orange sky, ${STYLE}`,
  "14": `${PANEL}. Dawn at a ruined country workshop, golden light through the open doorway. ${PEOPLE.toby16}, his face clearly visible and calm in the light, a tired determined half smile, bending to drop a folded letter into an open dented round painted biscuit tin that sits on a low shelf by the office door, the tin's lid in his other hand, pencil tick marks on the lid. Hopeful, resolved mood, ${STYLE}`,
};

const names = process.argv.slice(2);
await Promise.all((names.length ? names : Object.keys(PANELS)).map(async (name) => {
  const out = `/tmp/comic-art/r3/${name}-${Date.now().toString(36)}.png`;
  const url = await generateImage(PANELS[name], { model: "flux-1.1-pro", size: "1792x1024" });
  await downloadTo(url, out);
  console.log(out);
}));
