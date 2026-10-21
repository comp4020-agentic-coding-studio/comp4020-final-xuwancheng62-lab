// What people in the shelter scene say to each other: single lines when you
// click someone, and short exchanges between two people who are both there
// (scene.js walks one over to the other). Story talk only comes up once the
// player has found the record it's about, so nothing is given away early.
// Fixed text, picked in the browser; none of it changes the game.
import type { Chatter } from "./scene.ts";
import type { FragmentId } from "./game/stories.ts";

type Line = { who: string; line: string };
const ex = (...lines: [string, string][]): Line[] => lines.map(([who, line]) => ({ who, line }));

export interface Mood {
  low: boolean; // food or water running short
  dark: boolean; // no power
}

// ---- your own shelter

const YOU = [
  "One more day.",
  "Hold the line.",
  "Someone's got to run this place.",
  "I talk to the generator now. It's fine.",
  "Note to self: buy more scrap. From who?",
  "Five years. Still no pizza.",
  "Quiet. Too quiet. Good.",
];

const TOBY = [
  "Hi.",
  "Dev would've liked you.",
  "I counted the jugs again.",
  "Mum says keep my head down.",
  "I can fix that. Probably.",
  "Not scared of the dark. I just like lamps.",
  "Did you know dogs can smell rain?",
];

const MAGS = [
  "What.",
  "Busy.",
  "Don't touch the bench.",
  "Biscuit bites.",
  "If it's broke, bring it here.",
  "I've fixed Units older than you.",
  "Fifty years of hinges. Not one thank-you.",
];

// Exchanges, each with the record that has to be found first (if any).
const TOBY_CHATS: [FragmentId | null, Line[]][] = [
  [null, ex(["toby", "Can I go out with you next time?"], ["you", "When the hounds move on."])],
  [null, ex(["you", "Written to your mum yet?"], ["toby", "Twice. Nowhere to post it."])],
  [null, ex(["toby", "What did you do before?"], ["you", "Had a job. Paid rent. Complained."], ["toby", "Sounds hard."])],
  [null, ex(["toby", "I fixed the lamp."], ["you", "It was working."], ["toby", "Now it's working better."])],
  [null, ex(["you", "Why do you chalk on everything?"], ["toby", "So the next person knows."])],
  ["cart-dogs", ex(["you", "I found your dog drawing at FreshWay."], ["toby", "That's Gerald. The cart. He had a face."])],
  ["chime-camp", ex(["you", "Someone's feeding the dogs at the Nest."], ["toby", "...Don't tell anyone, okay?"])],
  ["chalk-warning", ex(["you", "\"Don't go single.\" Your chalk?"], ["toby", "Dev taught me. Two of you, or none."])],
  ["dev-toolbag", ex(["you", "I found Dev's toolbag."], ["toby", "Did you keep the logbook dry?"], ["you", "Bone dry."])],
  ["chained-valve", ex(["toby", "Did you see the valve?"], ["you", "Chained. Yellow tag."], ["toby", "They did that after Dev."])],
  ["toby-letter", ex(["you", "I read your fourth letter. Sorry."], ["toby", "S'okay. Somebody should."])],
  ["toby-answer", ex(["toby", "R.L.'s got my post. Kell Bridge."], ["you", "Then that's where we're headed."])],
  ["dev-repack-card", ex(["toby", "Quarter turn. Never more."], ["you", "You say that a lot."], ["toby", "Dev said it more."])],
];

const MAGS_CHATS: [FragmentId | null, Line[]][] = [
  [null, ex(["mags", "Your door hinge is shot."], ["you", "It's on the list."])],
  [null, ex(["you", "Need anything, Mags?"], ["mags", "Scrap. And quiet."])],
  [null, ex(["you", "Morning, Mags."], ["mags", "Is it."])],
  [null, ex(["mags", "Who wired this generator?"], ["you", "Me."], ["mags", "Hm. Don't."])],
  [null, ex(["you", "Is Biscuit friendly?"], ["mags", "No."])],
  ["unit-plate", ex(["you", "Your tags are on my purifier."], ["mags", "Course they are. I put them there."])],
  ["mags-jobbook", ex(["you", "I saw your job book."], ["mags", "Then you know I charge fair."])],
  ["ferris-docket", ex(["you", "You fitted this stack for the Ferrises."], ["mags", "Good people. She grew quinces."])],
  ["patels-keys", ex(["mags", "Still turning the Patels' tap over?"], ["you", "Every week."], ["mags", "Good."])],
  ["tagged-door", ex(["you", "They tagged your workshop door."], ["mags", "Yellow tag. I know what it means."])],
  ["mags-reply", ex(["mags", "Household forty-one."], ["you", "Now forty-two."], ["mags", "Don't get soppy."])],
  ["wade-ledger", ex(["you", "Wade's ledger had your name in it."], ["mags", "Then he can come and collect."])],
];

const TOBY_MAGS: Line[][] = [
  ex(["mags", "Boy. Small spanner."], ["toby", "It's Toby."]),
  ex(["toby", "How old's Biscuit?"], ["mags", "Older than you. Better manners."]),
  ex(["toby", "Can you teach me to weld?"], ["mags", "Can you keep your eyebrows?"]),
  ex(["mags", "Who taught you to strip a pump?"], ["toby", "Dev."], ["mags", "...He did it right."]),
  ex(["toby", "Biscuit likes me."], ["mags", "Biscuit likes your sandwich."]),
];

export function ownChatter(mood: Mood, residents: readonly string[], found: readonly FragmentId[]): Chatter {
  const known = (c: [FragmentId | null, Line[]]) => !c[0] || found.includes(c[0]);
  const chats: Line[][] = [];
  if (residents.includes("toby")) chats.push(...TOBY_CHATS.filter(known).map((c) => c[1]));
  if (residents.includes("mags")) chats.push(...MAGS_CHATS.filter(known).map((c) => c[1]));
  if (residents.includes("toby") && residents.includes("mags")) chats.push(...TOBY_MAGS);
  return {
    lines: {
      you: [mood.low ? "We need supplies. Soon." : "We're doing all right.", ...(mood.dark ? ["Who turned the lights off? Oh. Me."] : []), ...YOU],
      toby: [...(mood.low ? ["I'll eat less. I'm used to it."] : []), ...TOBY],
      mags: [...(mood.dark ? ["Dark. Feed the generator, genius."] : []), ...MAGS],
    },
    chats,
  };
}

// ---- someone else's shelter

const HOST = [
  "Don't touch anything.",
  "Make yourself at home. Sort of.",
  "Mind the ladder.",
  "Shoes off. Joking. It's freezing.",
  "Mi bunker, su bunker.",
];

const GUEST = [
  "Nice place.",
  "Quiet down here.",
  "You've done well with it.",
  "Smells like my place. Rust and hope.",
  "Your ladder squeaks too.",
];

const VISIT_CHATS: Line[][] = [
  // the guest opens: they go looking for the host when they come in
  ex(["guest", "Thanks for letting me in."], ["host", "Wipe your boots."]),
  ex(["guest", "How's the water holding?"], ["host", "Ask me tomorrow."]),
  ex(["guest", "Generator sounds good."], ["host", "Took me a week to fix."]),
  ex(["guest", "Got any scrap to trade?"], ["host", "Depends what you've got."]),
  ex(["guest", "Anything growing yet?"], ["host", "If the lights hold."]),
  ex(["guest", "Is that a bed or a pile of coats?"], ["host", "Yes."]),
  ex(["guest", "Do you get lonely down here?"], ["host", "I named the generator. So, yes."]),
  ex(["guest", "What's for dinner?"], ["host", "Beans."], ["guest", "What was lunch?"], ["host", "Also beans."]),
  ex(["guest", "Ever been to FreshWay?"], ["host", "Ration sign's still up at till one."]),
  ex(["guest", "Heard the Loop carts still chime."], ["host", "On sunny days. Gave me a fright."]),
  ex(["guest", "Ever go up to the reservoir?"], ["host", "Once. Don't go single."]),
  ex(["guest", "Seen any yellow tags round here?"], ["host", "Not on my door. Yet."]),
  ex(["guest", "Who had this Unit before you?"], ["host", "Dunno. Their tags are on the purifier."]),
  // the host opens
  ex(["host", "Seen any hounds out there?"], ["guest", "Not today."]),
  ex(["host", "You eaten today?"], ["guest", "Enough."]),
  ex(["host", "Don't linger. Raiders watch doors."], ["guest", "I'll be quick."]),
  ex(["host", "Bring anything?"], ["guest", "My charming company."], ["host", "So no."]),
  ex(["host", "Grey coats were on the highway again."], ["guest", "Ash Hounds. Keep your door shut."]),
  ex(["host", "Five years since the Ninth."], ["guest", "Feels like fifty."]),
  ex(["host", "Tell Mags my hinge is fine."], ["guest", "She'll know you're lying."]),
];

// When the guest's painted figure is the same person as the host's.
const TWINS: Line[][] = [
  ex(["guest", "Huh. You look just like me."], ["host", "I was going to say that."]),
  ex(["host", "Wait. Which one of us is the real one?"], ["guest", "The one with the better shelter."], ["host", "...Me, then."]),
  ex(["guest", "Same coat, same face."], ["host", "Same bad haircut."]),
  ex(["host", "Are you my long-lost twin?"], ["guest", "Only if you've got food."]),
  ex(["guest", "Don't tell the hounds there's two of us."], ["host", "Twice the tribute."]),
];

export function visitChatter(owner: string, twins: boolean): Chatter {
  return {
    lines: {
      host: [...HOST, `Welcome to ${owner}'s place.`, ...(twins ? ["Stop copying me."] : [])],
      guest: [...GUEST, ...(twins ? ["Nice face. Where'd you get it?"] : [])],
    },
    chats: twins ? [...TWINS, ...VISIT_CHATS] : VISIT_CHATS,
    // the first thing said when the guest comes in: twins remark on it
    opening: twins ? [TWINS[0]] : VISIT_CHATS.filter((c) => c[0].who === "guest"),
  };
}
