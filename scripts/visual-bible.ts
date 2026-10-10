// Holdout's character visual bible as prompt text: one fixed description per
// person (and age), used word for word in every image prompt so the same
// person looks the same in every comic. The human-readable bible, with the
// approved reference sheets, is docs/narrative/visual-bible.md; change both
// together.
//
// The course image proxy passes only model, prompt, size and n (probed
// 2026-10-10: image_prompt and character_reference_image are dropped), so
// these words, plus compositing figures cut from the approved sheets, are
// how consistency is kept.

export const STYLE =
  "digital painting, painterly brushwork, muted earthy palette, soft directional light, " +
  "fictional Australian country region after a nuclear war, no text, no lettering, no readable writing, no watermark, no gore";

// Sheets are painted on flat light grey so figures can be cut out.
export const SHEET = "character design reference sheet, full body figures standing on a plain flat light grey background, even studio light, no floor, no scenery";

export const PEOPLE = {
  // Toby: the face never changes, only the age. The mole under the left eye
  // and the slightly sticking-out ears are the tells.
  toby11: "Toby, a small thin boy of eleven, about 142 cm, round freckled face, big grey-green eyes, a small mole under his left eye, ears that stick out a little, untidy sandy-brown hair falling over his forehead, a gap between his front teeth, olive-green school polo shirt, navy shorts, scuffed sneakers, an adult-size orange high-visibility vest that hangs to his knees",
  toby14: "Toby at fourteen, the same boy grown lanky, about 160 cm, the same round freckled face now narrower, big grey-green eyes, a small mole under his left eye, ears that stick out a little, untidy sandy-brown hair grown past his ears, oversized grey hooded jumper with frayed cuffs, faded cargo trousers, worn boots, a canvas pack",
  toby16: "Toby at sixteen, the same face as a lean teenager, about 174 cm, freckles, grey-green eyes, a small mole under his left eye, ears that stick out a little, untidy sandy-brown hair tied back short with loose strands, a thin pale scar across his right knuckles, a patched olive work jacket over a faded orange high-visibility vest cut down to fit, fingerless gloves, a tool roll on his belt, chalk dust on his fingers",
  kerry: "Kerry Wren, Toby's mother, a woman in her mid thirties, about 165 cm, slight build, the same sandy-brown hair as Toby pulled into a low ponytail, tired kind grey eyes, a few freckles, small silver stud earrings, a teal supermarket uniform polo shirt with an orange name badge, dark work trousers",
  kerry39: "Kerry Wren at thirty-nine, the same woman thinner and worn, about 165 cm, sandy-brown hair in a low ponytail with a streak of grey, tired kind grey eyes, freckles, small silver stud earrings, a faded teal polo under a grey cardigan, an apron",
  ruth: "Ruth Lane, a short sturdy woman of sixty-one, about 158 cm, broad shoulders, short cropped iron-grey hair, sharp blue eyes, reading glasses on a cord around her neck, a teal supermarket manager's polo shirt with a darker collar, a navy fleece vest, a pen behind her ear",
  ruth64: "Ruth Lane at sixty-four, the same short sturdy woman, about 158 cm, short cropped white-grey hair, sharp blue eyes, reading glasses on a cord, weathered skin, a navy fleece vest over a checked work shirt, fingerless gloves",
  dev: "Dev Pillai, a tall lean South Asian man of thirty-seven, about 182 cm, short black hair with grey at the temples, a short trimmed beard, warm brown eyes, thick dark eyebrows, faded navy work overalls with the sleeves rolled up, a head torch around his neck, a canvas tool bag stencilled with white letters",
  // Proposed for the other stories (docs/narrative/visual-bible.md); not
  // drawn yet. Ruth at 66 is ruth64 with white hair.
  ruth66: "Ruth Lane at sixty-six, the same short sturdy woman, about 158 cm, short cropped white hair, sharp blue eyes, reading glasses on a cord, weathered skin, a navy fleece vest over a checked work shirt, fingerless gloves",
  mags: "Mags Halloran, a small wiry woman in her seventies, about 155 cm, slightly stooped, cropped white hair under a navy knitted beanie, a deeply lined sun-spotted face, pale blue eyes, a thin mouth, big hands with taped fingertips, a jeweller's loupe on a bootlace round her neck, an oil-stained navy work shirt, a canvas apron full of pockets, men's steel-capped boots",
  helen: "Helen Lane, a slim woman of thirty-eight, about 168 cm, sharp blue eyes and a strong jaw, straight dark-brown hair in a neat chin-length bob, a navy council blazer, a lanyard with an ID card, a small silver wristwatch",
  helen41: "Helen Lane at forty-one, the same woman thin and tired, about 168 cm, sharp blue eyes, dark-brown hair grown out and tied back, grey at the temples, a grey wool coat over a cardigan, fingerless gloves, a small silver wristwatch",
  gary: "Gary, a big red-faced man in his fifties, thinning sandy hair, a faded football jumper",
  nina: "Nina Haas, a woman in her late twenties, about 168 cm, cropped dark hair, a burn scar on the back of her left hand, a black rubber apron and elbow-length rubber gloves",
  nell: "Nell Ashby, a wiry sun-browned trader in her fifties with laughing lines, a wide-brimmed hat and a long oilskin coat",
  hound: "an Ash Hounds raider, adult of any build, faceless and anonymous, a grey-dyed hooded coat made from old high-visibility gear with the reflective stripes painted over, a dull grey half-face respirator, yellow plastic freight tags tied on cords at the shoulder, dark gloves",
} as const;

export const ANIMALS = {
  bigsy: "Bigsy, a big brown and white cattle-dog cross with a white chest and one floppy ear",
  lady: "Lady, a slim black and white kelpie-type dog with a white blaze",
  chips: "Chips, a small scruffy tan terrier with wiry fur",
  pack: "a fallout-born feral dog from the depot pack: clearly a dog, large heavy cattle-dog and mastiff build, broad heavy jaw and brow, patchy hairless grey-brown hide, alert ears, lean ribs, wary rather than vicious",
} as const;

export const THINGS = {
  gerald: "Gerald, Loop collection cart number 4: a small white boxy electric rubbish cart on four small wheels, about waist height to an adult, a cheerful cartoon face painted on its front with round eyes and a wide smile, a round chime speaker on top, a green Loop stripe along the side",
} as const;

// The collection's cards are these objects, and each appears in the comic,
// so a card and its panel share one description.
export const OBJECTS = {
  crayonDrawing: "a child's wax crayon drawing on yellowed A4 paper taped at the corners: three dogs, one brown and white, one black and white, one small and tan, a white boxy cart with a smiling face, blue music notes",
  worksheet: "a laminated A4 school worksheet curled at one corner, pencil handwriting in a numbered list, a red teacher's star",
  passengerList: "a pale yellow carbon-copy passenger form on a brown clipboard, ruled lines, a column of blue ticks, a pencil note squeezed into the margin",
  locker6: "an open grey steel staff locker, a school photo of a gap-toothed boy in an oversized orange high-visibility vest taped inside the door, a handwritten note, a child's navy school jumper on the hook",
  schoolCard: "a scuffed laminated school ID card the size of a credit card with a small photo of a boy and a green header band, on a frayed lanyard",
  logbook: "a small water-stained hardback logbook open to pencil capitals, in a dented tin beside a canvas toolbag",
  valveChalk: "white chalk capitals on grey concrete below a faded painted note, under an iron valve wheel wrapped in chain with a brass padlock and a yellow plastic tag",
  shelterChalk: "white chalk writing gone over twice on a dented steel bus-shelter wall, a small sitting dog drawn beside it in chalk",
  letterTin: "a sheet of lined paper folded in three with a smaller note pinned to it, in a dented round painted biscuit tin with pencil ticks on its lid",
} as const;
