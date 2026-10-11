import type { DatabaseSync } from "node:sqlite";
import { tx } from "./db.ts";
import { QUEST_XP } from "./game/config.ts";
import { INVITED, LAST_REPLY, QUESTS, questProgress, ready, type Progress, type QuestState } from "./game/quests.ts";
import type { TendResult } from "./greenhouse.ts";
import { awardXp, levelNote } from "./character.ts";
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

// Asking Toby to stay: you must be home and have cleared the intake with him.
export function inviteToby(db: DatabaseSync, userId: number, now: number): TendResult {
  return tx(db, (): TendResult => {
    const s = loadForUpdate(db, "user_id", userId, now)!;
    const state = questState(db, s.id, LAST_REPLY.id);
    if (state.marks.includes(INVITED)) return { ok: true };
    if (s.journey) return { ok: false, status: 409, reason: "You're not home to ask him." };
    if (!ready(LAST_REPLY, "bench", state)) return { ok: false, status: 409, reason: "Toby doesn't know you well enough to move in. The Last Reply in your journal says what's left." };
    db.prepare("INSERT INTO quest_marks (owner, quest_id, mark, at) VALUES (?, ?, ?, ?)").run(owner(s.id), LAST_REPLY.id, INVITED, now);
    db.prepare("INSERT OR IGNORE INTO residents (shelter_id, who, joined_at) VALUES (?, 'toby', ?)").run(s.id, now);
    const xp = QUEST_XP[LAST_REPLY.id] ?? 0;
    const note = xp > 0 ? levelNote(awardXp(db, s.id, xp)) : "";
    log(db, s.id, now, "record", `Toby moved in. “Till the road's open. Then I'm going to Mum. I promised her. The dogs stay outside.” The Last Reply is done.${xp > 0 ? ` +${xp} XP.` : ""}${note}`);
    return { ok: true };
  });
}
