import type { DatabaseSync } from "node:sqlite";
import { TALK } from "./game/config.ts";
import { tx } from "./db.ts";
import type { LiveEvent } from "./realtime.ts";

// Talking at a shelter. Anyone can speak there: the owner from their own page,
// a visitor from the visit page, or a note left at a sealed gate. Everyone on
// that shelter's page hears it, and the owner hears it wherever they are.

export interface TalkLine {
  id: number;
  authorId: number;
  author: string;
  owner: boolean; // said by the shelter's owner
  body: string;
  at: number;
}

export type TalkResult =
  | { ok: true; line: TalkLine; events: LiveEvent[] }
  | { ok: false; status: 400 | 404 | 429; reason: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One line of plain text: control characters and runs of whitespace collapse
// to single spaces.
export function cleanTalk(raw: string): string {
  return raw.replace(/[\p{Cc}\p{Cf}\s]+/gu, " ").trim();
}

interface Row {
  id: number;
  author_id: number;
  author: string;
  owner_id: number;
  body: string;
  at: number;
}
const toLine = (r: Row): TalkLine => ({ id: r.id, authorId: r.author_id, author: r.author, owner: r.author_id === r.owner_id, body: r.body, at: r.at });
const SELECT = `SELECT talk.id, talk.author_id, users.username AS author, shelters.user_id AS owner_id, talk.body, talk.at
  FROM talk JOIN users ON users.id = talk.author_id JOIN shelters ON shelters.id = talk.shelter_id`;

export function recentTalk(db: DatabaseSync, shelterId: number, now: number): TalkLine[] {
  const rows = db
    .prepare(`${SELECT} WHERE talk.shelter_id = ? AND talk.at > ? ORDER BY talk.at DESC, talk.id DESC LIMIT ?`)
    .all(shelterId, now - TALK.keepMs, TALK.shown) as unknown as Row[];
  return rows.reverse().map(toLine);
}

export function say(db: DatabaseSync, authorId: number, shelterId: number, raw: string, requestId: string, now: number): TalkResult {
  const body = cleanTalk(raw);
  if (!body) return { ok: false, status: 400, reason: "Say something first." };
  if ([...body].length > TALK.maxLength) return { ok: false, status: 400, reason: `Keep it under ${TALK.maxLength} characters.` };
  if (!UUID.test(requestId)) return { ok: false, status: 400, reason: "That form is out of date. Reload and try again." };
  return tx(db, (): TalkResult => {
    const shelter = db.prepare("SELECT user_id FROM shelters WHERE id = ?").get(shelterId) as { user_id: number } | undefined;
    if (!shelter) return { ok: false, status: 404, reason: "No shelter there." };
    const again = db.prepare(`${SELECT} WHERE talk.author_id = ? AND talk.request_id = ?`).get(authorId, requestId) as Row | undefined;
    if (again) return { ok: true, line: toLine(again), events: [] };
    const last = db.prepare("SELECT MAX(at) AS at FROM talk WHERE author_id = ?").get(authorId) as { at: number | null };
    if (last.at !== null && now - last.at < TALK.gapMs) return { ok: false, status: 429, reason: "Slow down a moment." };
    const { lastInsertRowid } = db
      .prepare("INSERT INTO talk (shelter_id, author_id, body, at, request_id) VALUES (?, ?, ?, ?, ?)")
      .run(shelterId, authorId, body, now, requestId);
    db.prepare("DELETE FROM talk WHERE at <= ?").run(now - TALK.keepMs);
    const line = toLine(db.prepare(`${SELECT} WHERE talk.id = ?`).get(Number(lastInsertRowid)) as unknown as Row);
    const data = { shelterId, ...line };
    return {
      ok: true,
      line,
      events: [
        { channel: `shelter:${shelterId}`, event: "talk", data },
        { channel: `user:${shelter.user_id}`, event: "talk", data: { ...data, own: true } },
      ],
    };
  });
}
