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
const toby = SETS.find((x) => x.id === "toby")!;
const tobyCards = (s: QuestState) => ({ got: toby.cards.filter((c) => isUnlocked(c, s.found)).length, of: toby.cards.length });

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

export const QUESTS: readonly QuestDef[] = [LAST_REPLY];

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
