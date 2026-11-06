import type { Progress } from "./quests.ts";
import type { OpenLead } from "./stories.ts";

// The one thing worth doing next, for the Shelter page (PLAN.md, "Next step
// on the Shelter page"). Pure: it only picks between pointers the Journal,
// Story and Collection already make; it adds no tutorial state of its own.

export interface NextStep { text: string; href: string; action: string }

export interface NextStepState {
  away: boolean;
  // someone whose quest is done but for asking them in: the page says so already
  invites: number;
  encounter: { id: string; title: string } | null;
  // a completed set whose comic has not been read and rewarded yet
  unread: { id: string; title: string } | null;
  quests: readonly Progress[];
  leads: readonly OpenLead[];
}

export const FIRST_STEP: NextStep = {
  text: "Explore the Supermarket to find your first clue.",
  href: "/world#dest-supermarket",
  action: "Explore",
};

export function nextStep(s: NextStepState): NextStep | null {
  if (s.away || s.invites > 0) return null;
  if (s.encounter) return { text: `${s.encounter.title}: someone is waiting for your answer.`, href: `/story/${s.encounter.id}`, action: "Respond" };
  if (s.unread) return { text: `${s.unread.title}'s story is complete.`, href: `/collection/${s.unread.id}/comic`, action: "Read it" };
  // a quest counts once it has started: a step done, or part of a count
  const quest = s.quests.find((q) => !q.complete && (q.done > 0 || q.steps.some((x) => (x.count?.got ?? 0) > 0)));
  const step = quest?.steps.find((x) => x.state === "current");
  if (quest && step) return { text: `${quest.quest.title}: ${step.step.hint}`, href: step.step.href ?? "/journal", action: "Go" };
  const lead = s.leads[0];
  if (lead) return { text: `Follow a lead: ${lead.lead.label}.`, href: "/journal?tab=clues", action: "Open Journal" };
  return FIRST_STEP;
}
