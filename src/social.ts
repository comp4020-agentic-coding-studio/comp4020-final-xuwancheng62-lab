import type { DatabaseSync } from "node:sqlite";
import { tx } from "./db.ts";
import { SOCIAL } from "./game/config.ts";
import { areFriends, partyDefinition, type PartyResult, type PartyRow } from "./parties.ts";
import { cleanTalk } from "./talk.ts";

export type Conversation = { kind: "dm" | "party"; id: number };
export function conversation(key: string): Conversation | null {
  const m = /^(dm|party):([1-9]\d*)$/.exec(key);
  return m && Number.isSafeInteger(Number(m[2])) ? { kind: m[1] as "dm" | "party", id: Number(m[2]) } : null;
}
export function canConverse(db: DatabaseSync, userId: number, c: Conversation): boolean {
  return c.kind === "dm" ? areFriends(db, userId, c.id) : Boolean(db.prepare("SELECT 1 FROM party_seats WHERE party_id = ? AND user_id = ?").get(c.id, userId));
}
export interface Message { id: number; author: string; author_id: number; body: string; at: number }
export function messages(db: DatabaseSync, userId: number, c: Conversation): Message[] {
  if (!canConverse(db, userId, c)) return [];
  const clause = c.kind === "party" ? "m.party_id = ?" : "((m.author_id = ? AND m.recipient_id = ?) OR (m.author_id = ? AND m.recipient_id = ?))";
  const args = c.kind === "party" ? [c.id] : [userId, c.id, c.id, userId];
  return (db.prepare(`SELECT m.id, u.username AS author, m.author_id, m.body, m.at FROM social_messages m JOIN users u ON u.id = m.author_id WHERE ${clause} ORDER BY m.id DESC LIMIT ?`).all(...args, SOCIAL.shown) as unknown as Message[]).reverse();
}
export function sendMessage(db: DatabaseSync, userId: number, key: string, raw: string, requestId: string, now: number): PartyResult {
  const c = conversation(key);
  const body = cleanTalk(raw);
  if (!c || !body || [...body].length > SOCIAL.maxLength || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(requestId)) return { ok: false, status: 400, reason: "Use a valid conversation and 1–300 characters. Reload an expired form." };
  return tx(db, () => {
    if (!canConverse(db, userId, c)) return { ok: false, status: 403, reason: "This conversation is for friends or party members only." };
    if (db.prepare("SELECT 1 FROM social_messages WHERE author_id = ? AND request_id = ?").get(userId, requestId)) return { ok: true, message: "Sent." };
    const last = db.prepare("SELECT MAX(at) AS at FROM social_messages WHERE author_id = ?").get(userId) as { at: number | null };
    if (last.at !== null && now - last.at < SOCIAL.gapMs) return { ok: false, status: 429, reason: "Slow down a moment." };
    db.prepare("INSERT INTO social_messages(author_id, recipient_id, party_id, body, at, request_id) VALUES (?, ?, ?, ?, ?, ?)").run(userId, c.kind === "dm" ? c.id : null, c.kind === "party" ? c.id : null, body, now, requestId);
    const listeners = c.kind === "dm" ? [userId, c.id] : (db.prepare("SELECT user_id FROM party_seats WHERE party_id = ?").all(c.id) as { user_id: number }[]).map((r) => r.user_id);
    return { ok: true, message: "Sent.", events: listeners.map((id) => ({ channel: `user:${id}`, event: "social", data: { channel: key } })) };
  });
}
export function markRead(db: DatabaseSync, userId: number, key: string, seen: number): void {
  const c = conversation(key);
  if (!c || !Number.isSafeInteger(seen) || seen < 0 || !canConverse(db, userId, c)) return;
  const last = messages(db, userId, c).at(-1)?.id ?? 0;
  db.prepare("INSERT INTO social_reads(user_id, channel, last_id) VALUES (?, ?, ?) ON CONFLICT(user_id, channel) DO UPDATE SET last_id = MAX(last_id, excluded.last_id)").run(userId, key, Math.min(seen, last));
}
export function unread(db: DatabaseSync, userId: number): number {
  return threads(db, userId).reduce((n, t) => n + t.unread, 0);
}

// Every private and party conversation you're in, with its own unread count
// and last line, most recent first.
export interface Thread { key: string; kind: "dm" | "party"; id: number; title: string; unread: number; lastAt: number | null; last: string | null; lastBy: string | null; online?: boolean }
export function threads(db: DatabaseSync, userId: number): Thread[] {
  const dms = db.prepare(
    `SELECT u.id, u.username AS title,
       (SELECT COUNT(*) FROM social_messages m WHERE m.recipient_id = ? AND m.author_id = u.id
          AND m.id > COALESCE((SELECT last_id FROM social_reads WHERE user_id = ? AND channel = 'dm:' || u.id), 0)) AS unread,
       last.at AS lastAt, last.body AS last, lu.username AS lastBy
     FROM friends f JOIN users u ON u.id = CASE WHEN f.a = ? THEN f.b ELSE f.a END
     LEFT JOIN social_messages last ON last.id = (SELECT MAX(id) FROM social_messages m WHERE (m.author_id = ? AND m.recipient_id = u.id) OR (m.author_id = u.id AND m.recipient_id = ?))
     LEFT JOIN users lu ON lu.id = last.author_id
     WHERE (f.a = ? OR f.b = ?) AND f.accepted_at IS NOT NULL`,
  ).all(userId, userId, userId, userId, userId, userId, userId) as unknown as Omit<Thread, "key" | "kind">[];
  const parties = db.prepare(
    `SELECT p.id, p.definition_json, p.dungeon, lead.username AS leader,
       (SELECT COUNT(*) FROM social_messages m WHERE m.party_id = p.id AND m.author_id != ?
          AND m.id > COALESCE((SELECT last_id FROM social_reads WHERE user_id = ? AND channel = 'party:' || p.id), 0)) AS unread,
       last.at AS lastAt, last.body AS last, lu.username AS lastBy
     FROM parties p JOIN users lead ON lead.id = p.leader_user_id
     LEFT JOIN social_messages last ON last.id = (SELECT MAX(id) FROM social_messages m WHERE m.party_id = p.id)
     LEFT JOIN users lu ON lu.id = last.author_id
     WHERE EXISTS (SELECT 1 FROM party_seats s WHERE s.party_id = p.id AND s.user_id = ?)
     ORDER BY p.id DESC LIMIT ?`,
  ).all(userId, userId, userId, SOCIAL.partyThreads) as unknown as (Omit<Thread, "key" | "kind" | "title"> & { definition_json: string | null; dungeon: string; leader: string })[];
  return [
    ...parties.map(({ definition_json, dungeon, leader, ...p }) => ({ ...p, key: `party:${p.id}`, kind: "party" as const, title: `${leader}'s party · ${partyDefinition({ definition_json, dungeon } as PartyRow).name}` })),
    ...dms.map((d) => ({ ...d, key: `dm:${d.id}`, kind: "dm" as const })),
  ].sort((x, y) => (y.lastAt ?? 0) - (x.lastAt ?? 0) || x.title.localeCompare(y.title));
}

// Who a conversation is with, for its heading.
export const threadTitle = (db: DatabaseSync, userId: number, key: string) => threads(db, userId).find((t) => t.key === key)?.title ?? null;
