import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { SOCIAL } from "./game/config.ts";
import { dispatchOf, friendsOf, openParties, partyDefinition, type PartyInvite } from "./parties.ts";
import { canConverse, conversation, messages, unread } from "./social.ts";
import { recentTalk } from "./talk.ts";
import { talkPanel } from "./shelterScreen.ts";
import type { ShelterView } from "./shelter.ts";

type H = HtmlEscapedString | Promise<HtmlEscapedString>;
export function socialPage(db: DatabaseSync, user: { id: number; username: string }, s: ShelterView, key: string, world: H, now: number, error = "", friendName = ""): H {
  const friends = friendsOf(db, user.id);
  const parties = openParties(db, now).filter((p) => p.seats.some((seat) => seat.user_id === user.id));
  const c = conversation(key);
  const lines = c ? messages(db, user.id, c) : [];
  const allowed = c && canConverse(db, user.id, c);
  const invites = db.prepare("SELECT i.*, u.username AS sender, v.username AS recipient FROM party_invites i JOIN users u ON u.id = i.sender_id JOIN users v ON v.id = i.recipient_id WHERE i.sender_id = ? OR i.recipient_id = ? ORDER BY i.id DESC LIMIT 12").all(user.id, user.id) as unknown as (PartyInvite & { sender: string; recipient: string })[];
  const d = dispatchOf(db, user.id);
  const shelterId = /^shelter:[1-9]\d*$/.test(key) ? Number(key.split(":")[1]) : s.id;
  const shelter = db.prepare("SELECT name FROM shelters WHERE id = ?").get(shelterId) as { name: string } | undefined;
  const name = c?.kind === "dm" ? friends.find((f) => f.userId === c.id)?.username : c?.kind === "party" ? `Party ${c.id}` : "";
  return html`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Chat · Holdout</title><link rel="stylesheet" href="/static/style.css"><link rel="stylesheet" href="/static/social.css"><script src="/static/social.js" defer></script></head>
<body class="social-page" data-channel="${key}" data-account="${user.username}" data-poll="${SOCIAL.pollMs}">
<header><h1>Chat & friends <span data-social-count>${unread(db, user.id) || ""}</span></h1><a href="/" target="_top">Back to shelter</a></header>
<nav aria-label="Chat channels"><a href="/social?channel=world">World</a><a href="/social?channel=shelter:${s.id}">Shelter messages</a><a href="/social?channel=friends">Friends</a></nav>
<p role="alert">${error}</p>
<section data-social-invites aria-live="polite"><h2>Party invitations</h2>
${invites.length ? invites.map((i) => html`<article class="card"><p>${i.sender} → ${i.recipient} · Party ${i.party_id}</p>
${i.state === "pending" ? html`<p>Accepts automatically in <span data-invite-deadline="${i.deadline}">${Math.max(0, Math.ceil((i.deadline - now) / 1000))}</span>s, including while offline. Uses the recipient's selected character.</p>
${i.recipient_id === user.id ? html`<form method="post" action="/social/invites/${i.id}"><input type="hidden" name="channel" value="${key}"><button name="answer" value="accept">Accept now</button><button name="answer" value="decline">Decline</button></form>` : ""}` : html`<p>${i.state}: ${i.reason}</p>`}</article>`) : html`<p>No invitations.</p>`}</section>
<section data-social-links><h2>Conversations</h2>
${parties.map((p) => html`<a href="/social?channel=party:${p.id}">${partyDefinition(p).name} · Party ${p.id}</a>`)}
${friends.filter((f) => f.accepted).map((f) => html`<a href="/social?channel=dm:${f.userId}">${f.username}</a>`)}</section>
${key === "friends" ? html`<section><h2>Friends</h2><form method="post" action="/social/friends"><label>Player name<input name="name" value="${friendName}" required maxlength="20"></label><button>Add friend</button></form>
<div data-social-friends>${friends.map((f) => html`<article class="card"><b>${f.username}</b> ${f.accepted ? html`<a href="/social?channel=dm:${f.userId}">Chat</a>` : f.askedByMe ? "Request sent" : html`<form method="post" action="/social/friends"><input type="hidden" name="name" value="${f.username}"><button>Accept friendship</button></form>`}<form method="post" action="/social/friends/${f.userId}/remove"><button>${f.accepted ? "Unfriend" : "Dismiss request"}</button></form></article>`)}</div>
<details><summary>My expedition character</summary><p>Friends can invite this character. Accept immediately or decline within 5 seconds; otherwise auto-accept, even offline. No food or water is charged.</p><form method="post" action="/social/dispatch"><label>Character<select name="who">${s.crew.map((m) => html`<option value="${m.who}" ${d.enabled && d.who === m.who ? raw("selected") : ""}>${m.name}</option>`)}<option value="off" ${!d.enabled ? raw("selected") : ""}>Nobody — turn off invitations</option></select></label><label>Maximum risk<select name="risk">${["likely", "risky", "grim"].map((r) => html`<option value="${r}" ${r === d.risk ? raw("selected") : ""}>${r}</option>`)}</select></label><label>Row<select name="row"><option value="front" ${d.row === "front" ? raw("selected") : ""}>Front</option><option value="back" ${d.row === "back" ? raw("selected") : ""}>Back</option></select></label><button>Save</button></form></details></section>` : ""}
${key === "world" ? html`<div data-social-world>${world}</div>` : key.startsWith("shelter:") ? shelter ? talkPanel(shelterId, shelter.name, "Public messages at this shelter.", recentTalk(db, shelterId, now), randomUUID()) : html`<p>No shelter here.</p>` : c ? allowed ? html`<h2>${name}</h2>
${c.kind === "dm" ? html`<a href="/trade?tab=players&friend=${c.id}" target="_top">Offer trade</a><form method="post" action="/social/invite"><input type="hidden" name="friend" value="${c.id}"><input type="hidden" name="channel" value="${key}"><label>Invite to party<select name="party">${parties.filter((p) => p.state === "mustering").map((p) => html`<option value="${p.id}">${partyDefinition(p).name} (${p.seats.length}/${p.size})</option>`)}</select></label><button ${!parties.some((p) => p.state === "mustering") ? raw("disabled") : ""}>Invite · 5s to decline</button><a href="/expeditions" target="_top">Create a party</a></form>` : ""}
<ol data-social-messages aria-live="polite">${lines.map((l) => html`<li data-message-id="${l.id}"><b>${l.author}</b> ${l.body}<small>${new Date(l.at).toISOString()}</small></li>`)}</ol>
<form method="post" action="/social/message" data-message-form><input type="hidden" name="channel" value="${key}"><input type="hidden" name="request_id" value="${randomUUID()}"><label>Message<input name="body" required maxlength="${SOCIAL.maxLength}" autocomplete="off"></label><button>Send</button></form>` : html`<p role="alert">Only friends or members of this party can read this conversation.</p>` : ""}
</body></html>`;
}
