import { randomInt } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { RAID, STEALABLE, type Stealable } from "./game/config.ts";
import { defence, raidHaul, raidStrength, spare } from "./game/raid.ts";
import { currentRates } from "./game/resources.ts";
import { tx } from "./db.ts";
import { publicShelter } from "./public.ts";
import type { LiveEvent } from "./realtime.ts";
import { loadForUpdate, log, type LogEntry, type ShelterView } from "./shelter.ts";

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
}

function options(db: DatabaseSync, me: ShelterView, target: ShelterView, now: number): Options {
  const def = defence(!target.journey, target.combatPower, target.reinforces);
  const strength = raidStrength(me.combatPower, def);
  const since = (t: number) => now - t;
  let stealReason: string | undefined;
  const lastAny = lastAt(db, me.id, "steal");
  const lastHere = lastAt(db, me.id, "steal", target.id);
  if (me.journey) stealReason = me.journey.raid ? `You're still getting back from ${me.journey.destinationName}.` : "You're out in the wasteland. Raids start from home.";
  else if (since(lastHere) < RAID.pairCooldownMs) stealReason = `They'll be watching for you. Try again in ${wait(RAID.pairCooldownMs - since(lastHere))}.`;
  else if (since(lastAny) < RAID.cooldownMs) stealReason = `Catch your breath. You can raid again in ${wait(RAID.cooldownMs - since(lastAny))}.`;
  else if (target.shieldUntil > now) stealReason = `They were just raided and their guard is up for ${wait(target.shieldUntil - now)}.`;

  let helpReason: string | undefined;
  const lastHelp = lastAt(db, me.id, "help", target.id);
  if (since(lastHelp) < RAID.helpCooldownMs) helpReason = `You helped them recently. Again in ${wait(RAID.helpCooldownMs - since(lastHelp))}.`;
  else if (target.reinforces >= RAID.maxReinforce) helpReason = "Their defences are already as strong as helpers can make them.";

  return { steal: { ok: !stealReason, reason: stealReason, strength }, help: { ok: !helpReason, reason: helpReason } };
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
  const net = currentRates(target.stock, target.growing).net;
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

export function steal(db: DatabaseSync, actor: Actor, targetShelterId: number, resource: string, requestId: string, now: number): ActionResult {
  if (!UUID.test(requestId)) return { ok: false, status: 400, reason: "That request was malformed. Reload and try again." };
  if (!STEALABLE.includes(resource as Stealable)) return { ok: false, status: 400, reason: "You can only take food, water or scrap." };
  const r = resource as Stealable;

  try {
    return tx(db, (): ActionResult => {
      const prior = replayed(db, actor.id, requestId);
      if (prior) return { ok: true, interactionId: prior, replay: true, events: [] };

      const me = loadForUpdate(db, "user_id", actor.id, now)!;
      const target = loadForUpdate(db, "id", targetShelterId, now);
      if (!target) return { ok: false, status: 404, reason: "There's no shelter there." };
      if (target.userId === actor.id) return { ok: false, status: 400, reason: "That's your own shelter." };
      const can = options(db, me, target, now).steal;
      if (!can.ok) return { ok: false, status: me.journey || target.shieldUntil > now ? 409 : 429, reason: can.reason! };

      const targetHome = !target.journey;
      const roll = randomInt(1001);
      const luck = RAID.luckMin + ((RAID.luckMax - RAID.luckMin) * roll) / 1000;
      const nothingSpare = spare(target.stock[r]) === 0;
      let amount = raidHaul(target.stock[r], can.strength, luck);
      if (amount > 0) {
        // the floor is enforced by the update itself, not just by the arithmetic above
        const taken = db
          .prepare(`UPDATE shelters SET ${r} = ${r} - ? WHERE id = ? AND ${r} - ? >= ?`)
          .run(amount, target.id, amount, RAID.protectedMin);
        if (taken.changes !== 1) amount = 0;
      }
      if (amount > 0) {
        db.prepare(`UPDATE shelters SET ${r} = ${r} + ? WHERE id = ?`).run(amount, me.id);
        db.prepare("UPDATE shelters SET raid_shield_until = ? WHERE id = ?").run(now + RAID.shieldAfterRaidMs, target.id);
      }

      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO interactions (request_id, actor_user_id, actor_shelter_id, target_shelter_id, kind, resource, amount, success, chance, roll, target_home, created_at)
           VALUES (?, ?, ?, ?, 'steal', ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(requestId, actor.id, me.id, target.id, r, amount, 1, can.strength, roll, targetHome ? 1 : 0, now);
      const interactionId = Number(lastInsertRowid);

      db.prepare(
        `INSERT INTO journeys (shelter_id, target_kind, target_id, action, departed_at, arrive_at, explore_until, return_at)
         VALUES (?, 'shelter', ?, 'raid', ?, ?, ?, ?)`,
      ).run(me.id, String(target.id), now, now, now + RAID.awayMs, now + RAID.awayMs);

      const res = cap(r);
      const away = " You're out for a minute, and your own shelter is unguarded.";
      const mine =
        amount > 0
          ? `You raided ${target.name}: +${amount} ${res}.`
          : nothingSpare
            ? `You got into ${target.name}, but their ${r} is down to the last ${RAID.protectedMin}. You left it.`
            : targetHome
              ? `You got into ${target.name}, but ${target.owner} chased you out empty-handed.`
              : `You got into ${target.name}, but couldn't carry any ${r} out.`;
      const theirs =
        amount > 0
          ? `${actor.username} raided your shelter${targetHome ? "" : " while you were out"}: −${amount} ${res}.`
          : nothingSpare
            ? `${actor.username} broke in, but found nothing they'd take.`
            : targetHome
              ? `${actor.username} raided you, but you chased them out before they took anything.`
              : `${actor.username} raided you while you were out, but left with nothing.`;
      const link = { interactionId };
      log(db, me.id, now, amount > 0 ? "loot" : "danger", mine + away, { ...link, shelterId: target.id });
      const targetEntry = log(db, target.id, now, amount > 0 ? "danger" : "info", theirs, { ...link, shelterId: me.id });

      const meAfter = loadForUpdate(db, "id", me.id, now)!;
      const targetAfter = loadForUpdate(db, "id", target.id, now)!;
      return { ok: true, interactionId, replay: false, events: liveEvents(targetAfter, meAfter, targetEntry, amount > 0 ? "bad" : "ok", now) };
    });
  } catch (e) {
    // a concurrent request with the same request_id, or a second raid journey
    if (String(e).includes("UNIQUE")) {
      const prior = replayed(db, actor.id, requestId);
      if (prior) return { ok: true, interactionId: prior, replay: true, events: [] };
      return { ok: false, status: 409, reason: "You're already out." };
    }
    throw e;
  }
}

export function help(db: DatabaseSync, actor: Actor, targetShelterId: number, requestId: string, now: number): ActionResult {
  if (!UUID.test(requestId)) return { ok: false, status: 400, reason: "That request was malformed. Reload and try again." };
  try {
    return tx(db, (): ActionResult => {
      const prior = replayed(db, actor.id, requestId);
      if (prior) return { ok: true, interactionId: prior, replay: true, events: [] };

      const me = loadForUpdate(db, "user_id", actor.id, now)!;
      const target = loadForUpdate(db, "id", targetShelterId, now);
      if (!target) return { ok: false, status: 404, reason: "There's no shelter there." };
      if (target.userId === actor.id) return { ok: false, status: 400, reason: "You can't reinforce your own shelter. Ask someone." };
      const can = options(db, me, target, now).help;
      if (!can.ok) return { ok: false, status: target.reinforces >= RAID.maxReinforce ? 409 : 429, reason: can.reason! };

      db.prepare("INSERT INTO buffs (shelter_id, kind, from_user_id, expires_at) VALUES (?, 'reinforced', ?, ?)").run(
        target.id, actor.id, now + RAID.reinforceMs,
      );
      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO interactions (request_id, actor_user_id, actor_shelter_id, target_shelter_id, kind, success, target_home, created_at)
           VALUES (?, ?, ?, ?, 'help', 1, ?, ?)`,
        )
        .run(requestId, actor.id, me.id, target.id, target.journey ? 0 : 1, now);
      const interactionId = Number(lastInsertRowid);
      const mins = RAID.reinforceMs / 60_000;
      log(db, me.id, now, "loot", `You reinforced ${target.name}: +${RAID.reinforceBonus} defence for ${mins} minutes.`, {
        interactionId,
        shelterId: target.id,
      });
      const targetEntry = log(db, target.id, now, "loot", `${actor.username} reinforced your shelter: +${RAID.reinforceBonus} defence for ${mins} minutes.`, {
        interactionId,
        shelterId: me.id,
      });
      const targetAfter = loadForUpdate(db, "id", target.id, now)!;
      return { ok: true, interactionId, replay: false, events: liveEvents(targetAfter, me, targetEntry, "ok", now) };
    });
  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      const prior = replayed(db, actor.id, requestId);
      if (prior) return { ok: true, interactionId: prior, replay: true, events: [] };
    }
    throw e;
  }
}

export interface InteractionView {
  kind: "steal" | "help";
  resource: string | null;
  amount: number;
  success: boolean;
  targetHome: boolean;
}

// Only the actor can read back their own result.
export function interactionFor(db: DatabaseSync, actorUserId: number, id: number): InteractionView | null {
  const row = db
    .prepare("SELECT kind, resource, amount, success, target_home FROM interactions WHERE id = ? AND actor_user_id = ?")
    .get(id, actorUserId) as { kind: "steal" | "help"; resource: string | null; amount: number; success: number; target_home: number } | undefined;
  return row ? { kind: row.kind, resource: row.resource, amount: row.amount, success: row.success === 1, targetHome: row.target_home === 1 } : null;
}
