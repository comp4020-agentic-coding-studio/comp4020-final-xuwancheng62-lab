import { CHARACTER, USES } from "./game/config.ts";
import { addSupply, memberOf } from "./character.ts";
import { resolveRaid } from "./game/raidCombat.ts";
import { seeded } from "./game/rng.ts";
import type { Fighter, PartyMember } from "./game/combat.ts";
import type { SupplyKind } from "./game/config.ts";
import type { Member } from "./shelter.ts";

import { randomInt } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { RAID, STEALABLE, type Stealable } from "./game/config.ts";
import { raidStrength, spare } from "./game/raid.ts";
import { currentRates } from "./game/resources.ts";
import { tx } from "./db.ts";
import { publicShelter } from "./public.ts";
import type { LiveEvent } from "./realtime.ts";
import { defenceOf, loadForUpdate, log, type LogEntry, type ShelterView } from "./shelter.ts";

export type ActionResult =
  | { ok: true; interactionId: number; replay: boolean; events: LiveEvent[] }
  | { ok: false; status: 400 | 404 | 409 | 429; reason: string };

interface Actor {
  id: number;
  username: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const wait = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function lastAt(db: DatabaseSync, actorShelterId: number, kind: string, targetShelterId?: number): number {
  const row = (
    targetShelterId === undefined
      ? db.prepare("SELECT MAX(created_at) AS at FROM interactions WHERE actor_shelter_id = ? AND kind = ?").get(actorShelterId, kind)
      : db
          .prepare("SELECT MAX(created_at) AS at FROM interactions WHERE actor_shelter_id = ? AND kind = ? AND target_shelter_id = ?")
          .get(actorShelterId, kind, targetShelterId)
  ) as { at: number | null };
  return row.at ?? 0;
}

// What the visitor can do right now, and why not. Used for the page and
// re-checked inside every transaction.
export interface Options {
  steal: { ok: boolean; reason?: string; strength: number };
  help: { ok: boolean; reason?: string };
  available: { who: string; name: string }[];
  stationed: boolean;
}

function options(db: DatabaseSync, me: ShelterView, target: ShelterView, now: number): Options {
  const available = me.crew.filter(m => !m.journey && !m.party?.mustering && m.character.hp >= CHARACTER.travelMinHp);
  const def = defenceOf(target);
  const strength = raidStrength(me.combatPower, def);
  const since = (t: number) => now - t;
  let stealReason: string | undefined;
  const lastAny = lastAt(db, me.id, "steal");
  const lastHere = lastAt(db, me.id, "steal", target.id);
  if (!available.length) stealReason = "No character is available. Return home, leave any preparing party and recover first.";
  else if (since(lastHere) < RAID.pairCooldownMs) stealReason = `They'll be watching for you. Try again in ${wait(RAID.pairCooldownMs - since(lastHere))}.`;
  else if (since(lastAny) < RAID.cooldownMs) stealReason = `Catch your breath. You can raid again in ${wait(RAID.cooldownMs - since(lastAny))}.`;
  else if (target.shieldUntil > now) stealReason = `They were just raided and their guard is up for ${wait(target.shieldUntil - now)}.`;

  let helpReason: string | undefined;
  const stationed = Boolean(target.reinforcement);
  if (stationed) helpReason = "Someone is already reinforcing this shelter.";
  else if (!available.length) helpReason = "No character is available to reinforce.";
  return { steal: { ok: !stealReason, reason: stealReason, strength }, help: { ok: !helpReason, reason: helpReason },
    available: available.map(m => ({who:m.who,name:m.who === 'you' ? me.owner : m.name})), stationed };

}

export function visitOptions(db: DatabaseSync, actorUserId: number, targetShelterId: number, now: number): Options | null {
  return tx(db, () => {
    const me = loadForUpdate(db, "user_id", actorUserId, now)!;
    const target = loadForUpdate(db, "id", targetShelterId, now);
    return target ? options(db, me, target, now) : null;
  });
}

function replayed(db: DatabaseSync, actorUserId: number, requestId: string): number | null {
  const row = db.prepare("SELECT id FROM interactions WHERE actor_user_id = ? AND request_id = ?").get(actorUserId, requestId) as
    | { id: number }
    | undefined;
  return row?.id ?? null;
}

function liveEvents(target: ShelterView, actorShelter: ShelterView, targetEntry: LogEntry, tone: "bad" | "ok", now: number): LiveEvent[] {
  const net = currentRates(target.stock, target.growing, target.residents, target.base, target.stash.supplies.arrow??0).net;
  const pubTarget = publicShelter(target, now);
  const pubActor = publicShelter(actorShelter, now);
  return [
    { channel: `user:${target.userId}`, event: "alert", data: { tone, message: targetEntry.message } },
    { channel: `user:${target.userId}`, event: "activity", data: targetEntry },
    { channel: `user:${target.userId}`, event: "resources", data: { stock: target.stock, net, at: now } },
    { channel: "world", event: "status", data: pubTarget },
    { channel: "world", event: "status", data: pubActor },
    { channel: `shelter:${target.id}`, event: "status", data: pubTarget },
    { channel: `shelter:${actorShelter.id}`, event: "status", data: pubActor },
  ];
}

function availableMember(s: ShelterView, who: unknown): Member | undefined {
  const m = memberOf(s, who);
  return m && !m.journey && !m.party?.mustering && m.character.hp >= CHARACTER.travelMinHp ? m : undefined;
}
function combatMember(s: ShelterView, m: Member): PartyMember {
  const c = m.character;
  return { key:String(m.id), name:m.who === 'you' ? s.owner : `${m.name} (${s.owner})`, who:m.who,
    hp:c.hp, body:c.base, gear:c.gear, belt:c.belt, pack:c.pack, row:'front' };
}
function saveFighter(db: DatabaseSync, shelterId: number, f: Fighter, now: number) {
  const id = Number(f.key);
  db.prepare('UPDATE characters SET hp=?,hp_at=? WHERE id=?').run(Math.max(RAID.minimumSurvivorHp,f.hp),now,id);
  db.prepare('DELETE FROM items WHERE held_by=? AND level=0').run(id);
  for (const slot of ['belt','pack'] as const)
    for (const [kind,n] of Object.entries(f[slot])) if (n && n>0) addSupply(db,shelterId,kind as SupplyKind,n,now,{id,slot});
}
function startPosting(db: DatabaseSync, s: ShelterView, m: Member, target: number, now: number, reinforcing: boolean) {
  return Number(db.prepare(`INSERT INTO journeys (shelter_id,character_id,target_kind,target_id,action,departed_at,arrive_at,explore_until,return_at)
    VALUES (?,?,'shelter',?,?,?,?,?,?)`).run(s.id,m.id,String(target),reinforcing?'reinforce':'raid',now,now,
      reinforcing?RAID.stationUntil:now+RAID.awayMs,reinforcing?RAID.stationUntil:now+RAID.awayMs).lastInsertRowid);
}

export function steal(db: DatabaseSync, actor: Actor, targetShelterId: number, resource: string, requestId: string, now: number, who?: unknown): ActionResult {
  if (!UUID.test(requestId)) return { ok:false,status:400,reason:'That request was malformed. Reload and try again.' };
  if (!STEALABLE.includes(resource as Stealable)) return { ok:false,status:400,reason:'You can only take food, water or scrap.' };
  const r = resource as Stealable;
  return tx(db, (): ActionResult => {
    const prior = replayed(db,actor.id,requestId);
    if(prior) return {ok:true,interactionId:prior,replay:true,events:[]};
    const me = loadForUpdate(db,'user_id',actor.id,now)!;
    const target = loadForUpdate(db,'id',targetShelterId,now);
    if(!target) return {ok:false,status:404,reason:"There's no shelter there."};
    if(target.userId===actor.id) return {ok:false,status:400,reason:"That's your own shelter."};
    const m = availableMember(me,who);
    if(!m) return {ok:false,status:409,reason:'Choose an available character at home with enough health.'};
    // A shelter cannot attack its own deployed defender.
    if(me.crew.some(c=>c.journey?.reinforcement && c.journey.targetId===String(target.id)))
      return {ok:false,status:409,reason:'Recall your reinforcement before raiding this shelter.'};
    const can=options(db,me,target,now).steal;
    if(!can.ok) return {ok:false,status:target.shieldUntil>now?409:429,reason:can.reason!};
    const defenders=target.crew.filter(c=>!c.journey && !c.party?.mustering && c.character.hp>0);
    let ally: ShelterView|null=null;
    let allyMember: Member|undefined;
    if(target.reinforcement) {
      const home=db.prepare('SELECT shelter_id FROM characters WHERE id=?').get(target.reinforcement.characterId) as {shelter_id:number};
      ally=loadForUpdate(db,'id',home.shelter_id,now)!;
      allyMember=ally.crew.find(c=>c.id===target.reinforcement!.characterId);
    }
    const seed=randomInt(2147483647);
    const combat=resolveRaid(seeded(seed),combatMember(me,m),[
      ...defenders.map(d=>combatMember(target,d)),
      ...(ally && allyMember && allyMember.character.hp>0 ? [combatMember(ally,allyMember)] : [])
    ],target.gateHp,target.base.gate.tier*RAID.gateArmourPerTier+(target.taped?USES.tape.defence:0));
    saveFighter(db,me.id,combat.raider,now);
    for(const d of combat.guards) saveFighter(db,Number(d.key)===allyMember?.id?ally!.id:target.id,d,now);
    db.prepare('UPDATE shelters SET gate_hp=?,raid_shield_until=? WHERE id=?').run(combat.gateHp,now+RAID.shieldAfterRaidMs,target.id);
    const amount=combat.won ? Math.min(RAID.maxSteal,spare(target.stock[r]),Math.floor(m.character.capacity)) : 0;
    if(amount>0) {
      const taken=db.prepare(`UPDATE shelters SET ${r}=${r}-? WHERE id=? AND ${r}-?>=?`).run(amount,target.id,amount,RAID.protectedMin);
      if(taken.changes!==1) throw new Error('Protected raid stock changed inside transaction');
      db.prepare(`UPDATE shelters SET ${r}=${r}+? WHERE id=?`).run(amount,me.id);
    }
    startPosting(db,me,m,target.id,now,false);
    combat.log.push(amount ? `Taken: ${amount} ${r}.` : 'No supplies taken.', 'Equipment is kept. Used ammunition and healing are spent.');
    for (const f of [combat.raider,...combat.guards]) combat.log.push(`${f.name}: ${Math.max(RAID.minimumSurvivorHp,f.hp)} HP after combat${f.hp<=0?' (downed, recovered alive)':''}; ${f.shots} shots fired.`);
    const report=JSON.stringify(combat.log);
    const interactionId=Number(db.prepare(`INSERT INTO interactions
      (request_id,actor_user_id,actor_shelter_id,target_shelter_id,kind,resource,amount,success,chance,roll,target_home,created_at,report_json)
      VALUES (?,?,?,?,'steal',?,?,?,?,?,?,?,?)`).run(requestId,actor.id,me.id,target.id,r,amount,combat.won?1:0,can.strength,seed,target.anyoneHome?1:0,now,report).lastInsertRowid);
    const summary=`${actor.username} raided your shelter with ${combat.raider.name}: ${combat.won?'breached':'repelled'}; lost ${amount} ${r}.`;
    log(db,me.id,now,combat.won?'loot':'danger',`Raid on ${target.name}: ${combat.won?'won':'repelled'}. Taken: ${amount} ${r}. Door damage: ${target.gateHp-combat.gateHp}. Equipment kept.`,{interactionId,shelterId:target.id});
    const entry=log(db,target.id,now,combat.won?'danger':'info',`${summary} Door damage: ${target.gateHp-combat.gateHp}. Equipment kept.`,{interactionId,shelterId:me.id});
    const events=liveEvents(loadForUpdate(db,'id',target.id,now)!,loadForUpdate(db,'id',me.id,now)!,entry,combat.won?'bad':'ok',now);
    if(ally && allyMember) {
      const aidLog=log(db,ally.id,now,'info',`${allyMember.name} defended ${target.name}. ${combat.won?"Raid broke through":"Raid repelled"}. Equipment kept.`,{interactionId,shelterId:target.id});
      events.push({channel:`user:${ally.userId}`,event:'activity',data:aidLog},{channel:`user:${ally.userId}`,event:'alert',data:{tone:'bad',message:`Your reinforcement defended ${target.name}. Check Activity.`}});
    }
    return {ok:true,interactionId,replay:false,events};
  });
}

export function help(db: DatabaseSync, actor: Actor, targetShelterId: number, requestId: string, now: number, who?: unknown): ActionResult {
  if(!UUID.test(requestId)) return {ok:false,status:400,reason:'That request was malformed. Reload and try again.'};
  return tx(db,():ActionResult=>{
    const prior=replayed(db,actor.id,requestId);
    if(prior) return {ok:true,interactionId:prior,replay:true,events:[]};
    const me=loadForUpdate(db,'user_id',actor.id,now)!;
    const target=loadForUpdate(db,'id',targetShelterId,now);
    if(!target) return {ok:false,status:404,reason:"There's no shelter there."};
    if(target.userId===actor.id) return {ok:false,status:400,reason:"You can't reinforce your own shelter."};
    const can=options(db,me,target,now).help;
    if(!can.ok) return {ok:false,status:409,reason:can.reason!};
    const m=availableMember(me,who);
    if(!m) return {ok:false,status:409,reason:'Choose an available character at home with enough health.'};
    const journeyId=startPosting(db,me,m,target.id,now,true);
    db.prepare('INSERT INTO reinforcements (target_shelter_id,character_id,journey_id,sent_at) VALUES (?,?,?,?)').run(target.id,m.id,journeyId,now);
    const interactionId=Number(db.prepare(`INSERT INTO interactions (request_id,actor_user_id,actor_shelter_id,target_shelter_id,kind,success,target_home,created_at)
      VALUES (?,?,?,?,'help',1,?,?)`).run(requestId,actor.id,me.id,target.id,target.anyoneHome?1:0,now).lastInsertRowid);
    log(db,me.id,now,'info',`${m.name} is reinforcing ${target.name} until recalled or dismissed.`,{interactionId,shelterId:target.id});
    const entry=log(db,target.id,now,'info',`${actor.username} reinforced your shelter with ${m.name}. You can dismiss the reinforcement.`,{interactionId,shelterId:me.id});
    return {ok:true,interactionId,replay:false,events:liveEvents(loadForUpdate(db,'id',target.id,now)!,loadForUpdate(db,'id',me.id,now)!,entry,'ok',now)};
  });
}

// Atomic with raids: a recall cannot interrupt a fight or undo its costs.
export function endReinforcement(db: DatabaseSync, actor: Actor, characterId: number, now: number): ActionResult {
  return tx(db,():ActionResult=>{
    const row=db.prepare(`SELECT r.*, c.shelter_id FROM reinforcements r JOIN characters c ON c.id=r.character_id WHERE r.character_id=?`).get(characterId) as
      {target_shelter_id:number;character_id:number;journey_id:number;shelter_id:number}|undefined;
    if(!row) return {ok:false,status:404,reason:'That reinforcement is no longer posted.'};
    const own=db.prepare('SELECT user_id FROM shelters WHERE id=?').get(row.shelter_id) as {user_id:number};
    const host=db.prepare('SELECT user_id FROM shelters WHERE id=?').get(row.target_shelter_id) as {user_id:number};
    if(actor.id!==own.user_id && actor.id!==host.user_id) return {ok:false,status:404,reason:'That reinforcement is not yours to recall or dismiss.'};
    const home=loadForUpdate(db,'id',row.shelter_id,now)!;
    const target=loadForUpdate(db,'id',row.target_shelter_id,now)!;
    db.prepare('DELETE FROM reinforcements WHERE character_id=?').run(characterId);
    db.prepare('UPDATE journeys SET resolved_at=?,return_at=?,explore_until=? WHERE id=?').run(now,now,now,row.journey_id);
    db.prepare('UPDATE characters SET hp_at=? WHERE id=?').run(now,characterId);
    const name=home.crew.find(m=>m.id===characterId)!.name;
    const homeEntry=log(db,home.id,now,'info',`${name} returned from reinforcing ${target.name}.`,{shelterId:target.id});
    const entry=log(db,target.id,now,'info',`${name} (${home.owner}) ended their reinforcement posting.`,{shelterId:home.id});
    const events=liveEvents(loadForUpdate(db,'id',target.id,now)!,loadForUpdate(db,'id',home.id,now)!,entry,'ok',now);
    events.push({channel:`user:${home.userId}`,event:'activity',data:homeEntry},{channel:`user:${home.userId}`,event:'alert',data:{tone:'ok',message:homeEntry.message}});
    return {ok:true,interactionId:0,replay:false,events};
  });
}

export interface InteractionView {
  kind: "steal" | "help";
  resource: string | null;
  amount: number;
  success: boolean;
  targetHome: boolean;
  report: string[];
}

// Only the actor can read back their own result.
export function interactionFor(db: DatabaseSync, actorUserId: number, id: number): InteractionView | null {
  const row = db
    .prepare("SELECT kind, resource, amount, success, target_home, report_json FROM interactions WHERE id = ? AND actor_user_id = ?")
    .get(id, actorUserId) as { kind: "steal" | "help"; resource: string | null; amount: number; success: number; target_home: number; report_json: string|null } | undefined;
  return row ? { kind: row.kind, resource: row.resource, amount: row.amount, success: row.success === 1, targetHome: row.target_home === 1, report: row.report_json ? JSON.parse(row.report_json) : [] } : null;
}
