import { money } from "./currency.ts";
import { ECONOMY, RESIDENTS, type ResidentId } from "./game/config.ts";
import type { DatabaseSync } from "node:sqlite";
import { tx } from "./db.ts";
import { QUEST_XP } from "./game/config.ts";
import { INVITED, OLD_WORKS, OLD_WORKS_COST, QUESTS, RECRUITS, questProgress, ready, type Progress, type QuestState } from "./game/quests.ts";
import type { TendResult } from "./greenhouse.ts";
import { addResident, awardXp, levelNote, raiseTo } from "./character.ts";
import { recruitLevel } from "./game/character.ts";
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
  QUESTS.map((q) => {
    const state=questState(db,shelterId,q.id);
    const choice=q.id===OLD_WORKS.id ? state.marks.find(m=>m==='warning'||m==='relief') : undefined;
    const after=choice ? `${choice==='relief'?'You sent 20 Water and 10 Scrap with the warning.':'You sent the warning and kept your supplies at home.'} ${q.after}` : q.after;
    return questProgress({...q,after},state);
  });

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
    const joined = addResident(db, s.id, who, now);
    if (joined) raiseTo(db, joined, recruitLevel(s.character.level));
    money(db, s.id, ECONOMY.questCredits, "Recruitment completed", `quest:${quest.id}`, now);
    const xp = QUEST_XP[quest.id] ?? 0;
    const note = xp > 0 ? levelNote(awardXp(db, s.character.id, xp)) : "";
    log(db, s.id, now, "recruit", `${MOVED_IN[who]} ${quest.title} is done. +${ECONOMY.questCredits} Credits.${xp > 0 ? ` +${xp} XP.` : ""}${note}`);
    return { ok: true };
  });
}

export const inviteToby = (db: DatabaseSync, userId: number, now: number): TendResult => invite(db, userId, "toby", now);

// A single, durable chapter choice; repeat requests cannot spend or award twice.
export function respondOldWorks(db:DatabaseSync,userId:number,choice:unknown,now:number):TendResult {
 return tx(db,()=>{
  if(choice!=='warning'&&choice!=='relief')return {ok:false,status:400,reason:'Choose a warning or a relief parcel.'};
  const s=loadForUpdate(db,'user_id',userId,now)!;
  const state=questState(db,s.id,OLD_WORKS.id);
  if(state.marks.some(m=>m==='warning'||m==='relief'))return {ok:true};
  if(s.journey)return {ok:false,status:409,reason:'Return home to prepare the message.'};
  if(!ready(OLD_WORKS,'works-response',state))return {ok:false,status:409,reason:'Follow The Old Works evidence in your journal first.'};
  if(choice==='relief'){
   const changed=db.prepare('UPDATE shelters SET water=water-?,scrap=scrap-? WHERE id=? AND water>=? AND scrap>=?').run(OLD_WORKS_COST.water,OLD_WORKS_COST.scrap,s.id,OLD_WORKS_COST.water,OLD_WORKS_COST.scrap);
   if(!changed.changes)return {ok:false,status:409,reason:'The parcel needs 20 Water and 10 Scrap. You can still send the warning alone.'};
  }
  db.prepare('INSERT INTO quest_marks(owner,quest_id,mark,at) VALUES(?,?,?,?)').run(owner(s.id),OLD_WORKS.id,choice,now);
  const note=levelNote(awardXp(db,s.character.id,40));
  log(db,s.id,now,'info',choice==='relief'?`The Old Works: you sent the east-side warning with 20 Water and 10 Scrap through the Kell walkers. Your stock is lighter; the threatened households have supplies on the way. +40 XP.${note}`:`The Old Works: you sent the east-side warning through the Kell walkers, keeping your supplies at home. The message is on its way; the water works remain controlled by the Ash Hounds. +40 XP.${note}`);
  return {ok:true};
 });
}
