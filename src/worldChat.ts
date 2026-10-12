import type { DatabaseSync } from "node:sqlite";
import { WORLD_CHAT } from "./game/config.ts";
import { tx } from "./db.ts";
import type { LiveEvent } from "./realtime.ts";
import { cleanTalk } from "./talk.ts";

// World chat (PLAN.md, "World chat"): one channel for everyone, where
// parties are recruited. A line with a party is that party's recruit card;
// its seats and state are read fresh whenever it's drawn. Lines from spec
// accounts reach only other spec accounts, as with the Survivors list.

export interface ChatLine {
  id: number;
  authorId: number;
  author: string;
  portrait: number;
  body: string;
  at: number;
  partyId: number | null;
}

export type ChatResult = { ok: true; line: ChatLine; events: LiveEvent[] } | { ok: false; status: 400 | 429; reason: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SELECT = `SELECT world_chat.id, author_id, users.username AS author, users.portrait, body, at, party_id
  FROM world_chat JOIN users ON users.id = world_chat.author_id`;
interface Row {
  id: number;
  author_id: number;
  author: string;
  portrait: number;
  body: string;
  at: number;
  party_id: number | null;
}
const toLine = (r: Row): ChatLine => ({ id: r.id, authorId: r.author_id, author: r.author, portrait: r.portrait, body: r.body, at: r.at, partyId: r.party_id });

export const isSpec = (name: string) => name.startsWith("spec_");
// Who hears a line: everyone, or only the spec run's own accounts.
export const chatChannel = (author: string) => (isSpec(author) ? "chat:spec" : "chat");

export function recentChat(db: DatabaseSync, viewer: string, now: number): ChatLine[] {
  const rows = db
    .prepare(`${SELECT} WHERE at > ? AND (users.username NOT LIKE 'spec\\_%' ESCAPE '\\' OR ?) ORDER BY at DESC, world_chat.id DESC LIMIT ?`)
    .all(now - WORLD_CHAT.keepMs, isSpec(viewer) ? 1 : 0, WORLD_CHAT.shown) as unknown as Row[];
  return rows.reverse().map(toLine);
}

function insert(db: DatabaseSync, authorId: number, body: string, requestId: string, now: number, partyId: number | null): ChatLine {
  const { lastInsertRowid } = db
    .prepare("INSERT INTO world_chat (author_id, body, at, request_id, party_id) VALUES (?, ?, ?, ?, ?)")
    .run(authorId, body, now, requestId, partyId);
  db.prepare("DELETE FROM world_chat WHERE at <= ?").run(now - WORLD_CHAT.keepMs);
  return toLine(db.prepare(`${SELECT} WHERE world_chat.id = ?`).get(Number(lastInsertRowid)) as unknown as Row);
}

export const chatEvent = (line: ChatLine, extra: Record<string, unknown> = {}): LiveEvent => ({ channel: chatChannel(line.author), event: "chat", data: { ...line, ...extra } });

// Someone says something to everyone. Retrying the same form says it once.
export function sayToWorld(db: DatabaseSync, authorId: number, raw: string, requestId: string, now: number): ChatResult {
  const body = cleanTalk(raw);
  if (!body) return { ok: false, status: 400, reason: "Say something first." };
  if ([...body].length > WORLD_CHAT.maxLength) return { ok: false, status: 400, reason: `Keep it under ${WORLD_CHAT.maxLength} characters.` };
  if (!UUID.test(requestId)) return { ok: false, status: 400, reason: "That form is out of date. Reload and try again." };
  return tx(db, (): ChatResult => {
    const again = db.prepare(`${SELECT} WHERE author_id = ? AND request_id = ?`).get(authorId, requestId) as Row | undefined;
    if (again) return { ok: true, line: toLine(again), events: [] };
    const last = db.prepare("SELECT MAX(at) AS at FROM world_chat WHERE author_id = ?").get(authorId) as { at: number | null };
    if (last.at !== null && now - last.at < WORLD_CHAT.gapMs) return { ok: false, status: 429, reason: "Slow down a moment." };
    const line = insert(db, authorId, body, requestId, now, null);
    return { ok: true, line, events: [chatEvent(line)] };
  });
}

// A party's recruit card, posted by its leader when it's called or called
// again. Runs inside the party's transaction.
export function postRecruit(db: DatabaseSync, leaderId: number, partyId: number, body: string, now: number): ChatLine {
  return insert(db, leaderId, body, `party-${partyId}-${now}`, now, partyId);
}
