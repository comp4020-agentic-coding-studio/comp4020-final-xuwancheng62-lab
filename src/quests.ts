import { money } from "./currency.ts";
import { ECONOMY, RESIDENTS, type ResidentId } from "./game/config.ts";
import type { DatabaseSync } from "node:sqlite";
import { tx } from "./db.ts";
import { QUEST_XP } from "./game/config.ts";
import { INVITED, QUESTS, RECRUITS, questProgress, ready, type Progress, type QuestState } from "./game/quests.ts";
import type { TendResult } from "./greenhouse.ts";
import { addResident, awardXp, levelNote } from "./character.ts";
import { loadForUpdate, log } from "./shelter.ts";
import { foundIds } from "./stories.ts";

// A shelter's quests (PLAN.md, "Quests"). Steps done by records read the
// discoveries table; the rest are marks, and a mark's insert is what claims
// it, so nothing is paid or logged twice.

const owner = (shelterId: number) => `shelter:${shelterId}`;

export function questState(db: DatabaseSync, shelterId: number, questId: string): QuestState {
  const marks = db.prepare("SELECT mark FROM quest_marks WHERE owner = ? AND quest_id = ?").all(owner(shelterId), questId) as { mark: string }[];
  return { found: foundIds(db, shelterId), marks: marks.map((m) => m.mark) };
}

export const progressOf = (db: DatabaseSync, shelterId: number): Progress[] =>
  QUESTS.map((q) => questProgress(q, questState(db, shelterId, q.id)));

export type Recruit = keyof typeof RECRUITS;
export const isRecruit = (who: string): who is Recruit => Object.hasOwn(RECRUITS, who);

// Whether this shelter has done everything but ask them in.
export const canInvite = (db: DatabaseSync, shelterId: number, who: Recruit): boolean =>
  ready(RECRUITS[who].quest, RECRUITS[who].step, questState(db, shelterId, RECRUITS[who].quest.id));

const MOVED_IN: Record<Recruit, string> = {
  toby: "Toby moved in. “Till the road's open. Then I'm going to Mum. I promised her. The dogs stay outside.”",
  mags: "Mags moved in, with a toolbag, a cat box and the top cartridge. “I don't do people. I do Units. Where's the scrap kept?”",
};

// Asking someone to stay: you must be home and have done the rest of their quest.
export function invite(db: DatabaseSync, userId: number, who: Recruit, now: number): TendResult {
  const { quest, step } = RECRUITS[who];
  const name = RESIDENTS[who as ResidentId].name;
  const pronoun = RESIDENTS[who as ResidentId].pronouns.them;
  return tx(db, (): TendResult => {
    const s = loadForUpdate(db, "user_id", userId, now)!;
    const state = questState(db, s.id, quest.id);
    if (state.marks.includes(INVITED)) return { ok: true };
    if (s.journey) return { ok: false, status: 409, reason: `You're not home to ask ${pronoun}.` };
    if (!ready(quest, step, state)) return { ok: false, status: 409, reason: `${name} doesn't know you well enough to move in. ${quest.title} in your journal says what's left.` };
    db.prepare("INSERT INTO quest_marks (owner, quest_id, mark, at) VALUES (?, ?, ?, ?)").run(owner(s.id), quest.id, INVITED, now);
    addResident(db, s.id, who, now);
    money(db, s.id, ECONOMY.questCredits, "Recruitment completed", `quest:${quest.id}`, now);
    const xp = QUEST_XP[quest.id] ?? 0;
    const note = xp > 0 ? levelNote(awardXp(db, s.character.id, xp)) : "";
    log(db, s.id, now, "recruit", `${MOVED_IN[who]} ${quest.title} is done. +${ECONOMY.questCredits} Credits.${xp > 0 ? ` +${xp} XP.` : ""}${note}`);
    return { ok: true };
  });
}

export const inviteToby = (db: DatabaseSync, userId: number, now: number): TendResult => invite(db, userId, "toby", now);
