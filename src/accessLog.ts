import type { DatabaseSync } from "node:sqlite";

export type Actor = { id: number; username: string };
export type Fields = Record<string, string | number | undefined>;

// Every POST, plus looking into someone else's shelter. Polling and static files would bury the rest.
export function logged(method: string, path: string): boolean {
  if (method === "POST") return path !== "/social/pulse";
  return method === "GET" && /^\/shelters\/\d+$/.test(path);
}

// Values come from players, so anything beyond a plain token is quoted to keep one event on one line.
const value = (v: string | number) => (typeof v === "number" || /^[\w.:#@\/-]+$/.test(v) ? String(v) : JSON.stringify(v));
export const who = (u: Actor | null | undefined) => (u ? `${u.username}#${u.id}` : "-");

export function line(now: number, method: string, path: string, status: number, ms: number, fields: Fields): string {
  const extra = Object.entries(fields)
    .filter((e): e is [string, string | number] => e[1] !== undefined && e[1] !== "")
    .map(([k, v]) => `${k}=${value(v)}`);
  return [new Date(now).toISOString(), method, path, status, ...extra, `ms=${ms}`].join(" ");
}

const userById = (db: DatabaseSync, id: number) => db.prepare("SELECT id, username FROM users WHERE id = ?").get(id) as Actor | undefined;
const ownerOfShelter = (db: DatabaseSync, id: number) =>
  db.prepare("SELECT users.id, users.username FROM shelters JOIN users ON users.id = shelters.user_id WHERE shelters.id = ?").get(id) as Actor | undefined;

// Who or what the action was aimed at, by name. Never passwords, message text or stock.
export function subject(db: DatabaseSync, path: string, form: Record<string, unknown>): Fields {
  const str = (k: string) => (typeof form[k] === "string" ? (form[k] as string).slice(0, 40) : undefined);
  const out: Fields = {};
  const shelter = path.match(/^\/shelters\/(\d+)/);
  if (shelter) {
    const owner = ownerOfShelter(db, Number(shelter[1]));
    out.target = owner ? who(owner) : `shelter#${shelter[1]}`;
  }
  const friend = path.match(/^\/(?:social\/)?friends\/(\d+)\/remove$/);
  if (friend) {
    const other = userById(db, Number(friend[1]));
    out.target = other ? who(other) : `user#${friend[1]}`;
  }
  const party = path.match(/^\/parties\/(\d+)/);
  if (party) out.party = Number(party[1]);
  const invite = path.match(/^\/social\/invites\/(\d+)$/);
  if (invite) out.invite = Number(invite[1]);
  if (path === "/register" || path === "/login") out.name = str("username");
  if (path === "/friends" || path === "/social/friends") out.target = str("name");
  if (form.friend !== undefined) {
    const f = userById(db, Number(form.friend));
    out.target = f ? who(f) : `user#${String(form.friend).slice(0, 12)}`;
  }
  if (path === "/social/invite") out.party = str("party");
  for (const k of ["resource", "destination", "recipe", "kind", "action", "crop", "item", "stat", "task", "slot", "answer", "channel"]) {
    if (out[k] === undefined) out[k] = str(k);
  }
  out.character = str("who");
  if (typeof form.body === "string") out.chars = form.body.length;
  return out;
}
