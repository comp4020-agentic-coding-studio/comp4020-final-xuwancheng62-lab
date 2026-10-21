import { SETS, isUnlocked } from "./collections.ts";
import type { FragmentId } from "./stories.ts";

// Quests (PLAN.md, "Quests"): a named run of steps, each done by records
// found or by a mark the player earns some other way, like asking someone to
// stay. Pure: progress depends only on the state passed in, so a shared party
// quest later needs only a merged state, not new rules.

export interface QuestState {
  found: readonly FragmentId[];
  marks: readonly string[];
}

export interface Step {
  id: string;
  title: string;
  // where to go or what to do, while it's the step to work on
  hint: string;
  href?: string;
  // steps that must be done before this one can be
  needs?: readonly string[];
  done: (s: QuestState) => boolean;
  // how far along a step with a count is
  count?: (s: QuestState) => { got: number; of: number };
}

export interface QuestDef {
  id: string;
  title: string;
  // one shelter's quest; "party" is for shared expeditions, not built yet
  scope: "shelter" | "party";
  steps: readonly Step[];
  // what's true once it's done
  after: string;
}

export type StepState = "done" | "current" | "locked";

export interface Progress {
  quest: QuestDef;
  steps: { step: Step; state: StepState; count?: { got: number; of: number } }[];
  done: number;
  complete: boolean;
}

const has = (s: QuestState, id: FragmentId) => s.found.includes(id);
const cardsOf = (id: string) => {
  const set = SETS.find((x) => x.id === id)!;
  return (s: QuestState) => ({ got: set.cards.filter((c) => isUnlocked(c, s.found)).length, of: set.cards.length });
};
const tobyCards = cardsOf("toby");
const magsCards = cardsOf("mags");

// The mark for asking Toby to stay.
export const INVITED = "invited";

export const LAST_REPLY: QuestDef = {
  id: "last-reply",
  title: "The Last Reply",
  scope: "shelter",
  after: "Toby lives in your shelter now, until the road north is safe. Then he's going to his mum.",
  steps: [
    {
      id: "signed-t",
      title: "Signed T.",
      // no name yet: the set is only “Signed T.” until it's complete
      hint: "Find every card in the collection signed T. They turn up at the Supermarket, the Reservoir, the Nest and the Workshop.",
      done: (s) => tobyCards(s).got === tobyCards(s).of,
      count: tobyCards,
    },
    {
      id: "word-for-t",
      title: "Word for T",
      hint: "The Kell Bridge chit is at the Workshop. Leave word for T in its forwarding tin, and check for an answer.",
      done: (s) => has(s, "toby-answer"),
    },
    {
      id: "hold-for-him",
      title: "Hold for him",
      hint: "Send word north with the Kell walkers from the Workshop's payment tin, and see what comes back.",
      needs: ["word-for-t"],
      done: (s) => has(s, "ruth-parcel"),
    },
    {
      id: "underpass",
      title: "The underpass",
      hint: "Go to the Creature Nest and take Kerry's letters to the underpass.",
      needs: ["signed-t", "hold-for-him"],
      done: (s) => has(s, "last-reply"),
    },
    {
      id: "screens",
      title: "Dev's autumn job",
      hint: "Go to the Dry Reservoir and clear the intake screens with Toby. He needs scrap for a rake.",
      needs: ["underpass"],
      done: (s) => has(s, "intake-screens"),
    },
    {
      id: "bench",
      title: "A bench here",
      hint: "At home, ask Toby to stay until the road north is safe.",
      needs: ["screens"],
      done: (s) => s.marks.includes(INVITED),
    },
  ],
};

// The mark for clearing the Lower Deck with a party.
export const CLEARED = "cleared";

// The first party quest is open to everyone; records give optional context.
export const DAY_FIFTEEN: QuestDef = {
  id: "day-fifteen",
  title: "Day Fifteen",
  scope: "party",
  after: "The Lower Deck is open. What CS-4 left there was shared out, the way Ruth would have wanted.",
  steps: [
    {
      id: "lower-deck",
      title: "The Lower Deck",
      hint: "No clue required. The Day 15 notice at the Supermarket explains the sealed level. It takes two on the cranks. Gather a party on the Expeditions page and clear it. Ruth's all-clear word, if anyone has it, would quiet the dust room.",
      done: (s) => s.marks.includes(CLEARED),
    },
  ],
};

export const UNDELIVERED: QuestDef = {
  id: "undelivered", title: "Undelivered", scope: "shelter",
  after: "Ruth has Helen's letter. Her reply is in your journal. The checkpoint and its captives are still there; this was one letter brought home.",
  steps: [
    { id:"relief-trail", title:"A road north", hint:"Search the Reservoir office or radio room for the northbound relief trail.", href:"/world#dest-reservoir", done:s=>has(s,"day-140")||has(s,"council-bulletin")||has(s,"convoy-manifest") },
    { id:"convoy", title:"The relief trucks", hint:"Follow the relief-convoy lead at Ridge Road. Recover the manifest after clearing the scavengers.", href:"/world#dest-ridge-road", needs:["relief-trail"], done:s=>has(s,"convoy-manifest") },
    { id:"envelope", title:"Stolen post", hint:"Search the outlying store at the Weighbridge. Defeat its guards to recover the envelope.", href:"/world#dest-weighbridge", needs:["convoy"], done:s=>has(s,"helen-letter") },
    { id:"send-helen", title:"For Ruth, by hand", hint:"At home, choose whether to entrust the sealed envelope to the Kell walkers. You can keep it until you are ready.", needs:["envelope"], done:s=>has(s,"helen-forwarded") },
    { id:"ruth-answer", title:"An answer", hint:"Check the Workshop forwarding tin for Ruth's reply.", href:"/world#dest-workshop", needs:["send-helen"], done:s=>has(s,"ruth-received") },
  ],
};

// Mags joins you: her set, the ledger that names her, a warning on her board, then asking her in.
export const EMPTY_IS_EMPTY: QuestDef = {
  id: "empty-is-empty",
  title: "Empty Is Empty",
  scope: "shelter",
  after: "Mags lives in your shelter now, with Biscuit on the purifier housing. She doesn't do people. She does your repairs.",
  steps: [
    {
      id: "forty-one",
      title: "Household forty-one",
      hint: "Find every card in Margit Halloran's collection. Most are at the Ruined Workshop; one is the plate behind your own purifier.",
      done: (s) => magsCards(s).got === magsCards(s).of,
      count: magsCards,
    },
    {
      id: "week-17",
      title: "Week 17",
      hint: "The stolen post came through the Weighbridge. With the riders out, get into the scale-house office and see what Wade has written down. You'll have to get past the gate watch.",
      href: "/world#dest-scale-house",
      done: (s) => has(s, "wade-ledger"),
    },
    {
      id: "note-on-the-board",
      title: "A note on the board",
      hint: "At the Ruined Workshop, warn M.H. on her drop-off board, and come back for her answer.",
      href: "/world#dest-workshop",
      needs: ["forty-one", "week-17"],
      done: (s) => has(s, "mags-reply"),
    },
    {
      id: "a-key-here",
      title: "A key here",
      hint: "At home, ask Mags to stay.",
      needs: ["note-on-the-board"],
      done: (s) => s.marks.includes(INVITED),
    },
  ],
};

export const QUESTS: readonly QuestDef[] = [LAST_REPLY, EMPTY_IS_EMPTY, DAY_FIFTEEN, UNDELIVERED];

// Who each recruitment quest brings home, and the step that asks them.
export const RECRUITS = {
  toby: { quest: LAST_REPLY, step: "bench" },
  mags: { quest: EMPTY_IS_EMPTY, step: "a-key-here" },
} as const;

// What the end of a person's comic points you at next: one line about them,
// and where to go. With a quest, where comes from its current step; Ruth and
// Dev have none yet, so they point at a place. Pure.
export interface NextLead { line: string; label: string; href: string; quest?: string }
const AFTER_STORY: Record<string, { line: string; quest?: QuestDef; place?: { label: string; href: string } }> = {
  toby: { line: "He's alive, in Calder. Leave word in the Workshop's forwarding tin.", quest: LAST_REPLY },
  mags: { line: "The ledger has her name. Warn her through the Workshop drop-off board.", quest: EMPTY_IS_EMPTY },
  helen: { line: "Her letter never reached Ruth. Follow the relief road north.", quest: UNDELIVERED },
  ruth: { line: "She's still at Kell Bridge. Walkers come through the Workshop.", place: { label: "Ruined Workshop", href: "/world#dest-workshop" } },
  dev: { line: "He died for the way round the valve. Toby knows where it starts.", place: { label: "Dry Reservoir", href: "/world#dest-reservoir" } },
};
export function nextLead(setId: string, stateOf: (questId: string) => QuestState): NextLead | null {
  const a = AFTER_STORY[setId];
  if (!a) return null;
  if (!a.quest) return { line: a.line, ...a.place! };
  const p = questProgress(a.quest, stateOf(a.quest.id));
  if (p.complete) return { line: a.line, label: `${a.quest.title} is done`, href: "/journal", quest: a.quest.id };
  const step = p.steps.find((x) => x.state === "current")!.step;
  return { line: a.line, label: step.title, href: step.href ?? "/journal", quest: a.quest.id };
}

// Every step done, current (all it needs is done) or locked.
export function questProgress(quest: QuestDef, s: QuestState): Progress {
  const done = new Set(quest.steps.filter((st) => st.done(s)).map((st) => st.id));
  const steps = quest.steps.map((step) => ({
    step,
    state: (done.has(step.id) ? "done" : (step.needs ?? []).every((n) => done.has(n)) ? "current" : "locked") as StepState,
    count: step.count?.(s),
  }));
  return { quest, steps, done: done.size, complete: done.size === quest.steps.length };
}

// Can the step be done now: is everything it needs done?
export const ready = (quest: QuestDef, stepId: string, s: QuestState): boolean =>
  questProgress(quest, s).steps.find((x) => x.step.id === stepId)?.state === "current";
