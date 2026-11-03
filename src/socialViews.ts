import {achievementStrip} from './achievementViews.ts';
import {publicAchievements} from './achievements.ts';
import { factionBadge, factionFor } from './factionViews.ts';
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { SOCIAL } from "./game/config.ts";
import { friendsOf, openParties, partyTitle, type PartyInvite } from "./parties.ts";
import { portraitSrc } from "./public.ts";
import { canConverse, conversation, messages, threads, type Thread } from "./social.ts";
import { recentTalk } from "./talk.ts";
import { talkPanel } from "./shelterScreen.ts";
import type { ShelterView } from "./shelter.ts";

// The chat hub (PLAN.md, "Unified chat and friends"): the list of
// conversations and the one that's open. On a phone they are two screens; on
// a wide page they sit side by side. Every action is a plain form.

type H = HtmlEscapedString | Promise<HtmlEscapedString>;
type User = { id: number; username: string };
type Invite = PartyInvite & { sender: string; recipient: string; leader: string; definition_json: string | null; dungeon: string; size:number; filled:number };

export const playerLink = (name: string, faction?: import("./game/narrative.ts").Faction | null) => html`<a class="sx-player" href="/players/${encodeURIComponent(name)}" target="_top">${factionBadge(faction)}${name}</a>`;
const stamp = (at: number) => html`<time data-ago="${at}" datetime="${new Date(at).toISOString()}">${new Date(at).toISOString().slice(11, 16)} UTC</time>`;
const badge = (n: number) => (n ? html`<span class="sx-badge"><span class="visually-hidden">, </span>${n}<span class="visually-hidden"> new</span></span>` : "");
const secs = SOCIAL.inviteMs / 1000;

function invitesFor(db: DatabaseSync, userId: number): Invite[] {
  return db.prepare(
    `SELECT i.*, u.username AS sender, v.username AS recipient, l.username AS leader, p.definition_json, p.dungeon, p.size, (SELECT COUNT(*) FROM party_seats WHERE party_id=p.id) AS filled
     FROM party_invites i JOIN users u ON u.id = i.sender_id JOIN users v ON v.id = i.recipient_id
     JOIN parties p ON p.id = i.party_id JOIN users l ON l.id = p.leader_user_id
     WHERE i.sender_id = ? OR i.recipient_id = ? ORDER BY i.id DESC LIMIT 12`,
  ).all(userId, userId) as unknown as Invite[];
}

// An invitation, said from the point of view of whoever is reading it.
function inviteCard(i: Invite, me: number, key: string, now: number): H {
  const title = partyTitle(i.leader, i);
  const toMe = i.recipient_id === me;
  if (i.state !== "pending") return html`<p class="sx-invite is-${i.state}"><b>${toMe ? i.sender : i.recipient}</b> · ${title} · ${i.state}${i.reason ? html`<small>${i.reason}</small>` : ""}</p>`;
  const left = html`<span data-invite-deadline="${i.deadline}">${Math.max(0, Math.ceil((i.deadline - now) / 1000))}</span>`;
  return html`<article class="sx-invite is-pending" data-invite="${i.id}">
  ${toMe
    ? html`<p><b>${i.sender}</b> · <b>${title}</b> · ${i.filled}/${i.size}</p><p class="sx-hint">Auto-join in ${left}s</p>
  <form method="post" action="/social/invites/${i.id}"><input type="hidden" name="channel" value="${key}"><button name="answer" value="accept">Join</button><button name="answer" value="decline" class="sx-quiet">Decline</button></form>`
    : html`<p><b>${i.recipient}</b> · <b>${title}</b> · ${i.filled}/${i.size}</p><p class="sx-hint">Auto-join in ${left}s</p>`}
</article>`;
}

function threadList(list: Thread[], key: string, s: ShelterView, requests: number): H {
  const row = (k: string, title: string, note: string, n = 0) =>
    html`<li><a href="/social?channel=${k}" ${k === key ? raw('aria-current="page"') : ""}><span class="sx-t">${title}${badge(n)}</span>${note ? html`<small>${note}</small>` : ""}</a></li>`;
  const last = (t: Thread) => (t.last ? `${t.lastBy}: ${t.last}` : "");
  const parties = list.filter((t) => t.kind === "party");
  return html`<nav class="sx-list" aria-label="Conversations">
  <h2 class="sx-group">Public</h2>
  <ul>${row("world", "World", "")}${row(`shelter:${s.id}`, "My shelter", "")}</ul>
  ${parties.length ? (() => {
    // folded unless you're reading one of them or one has something new
    const unread = parties.reduce((n, t) => n + t.unread, 0);
    const open = unread > 0 || parties.some((t) => t.key === key);
    return html`<details class="sx-fold" id="sx-fold-parties" ${open ? raw("open") : ""}><summary class="sx-group">Parties <span class="sx-count">${parties.length}</span>${badge(unread)}</summary><ul>${parties.map((t) => row(t.key, t.title, last(t), t.unread))}</ul></details>`;
  })() : ""}
  <h2 class="sx-group">Friends</h2>
  <ul>${list.filter((t) => t.kind === "dm").map((t) => row(t.key, t.title, last(t), t.unread))}${row("friends", "Friends & requests", requests ? `${requests} waiting for you` : "", requests)}</ul>
</nav>`;
}

function friendsPanel(db: DatabaseSync, user: User, s: ShelterView, now: number, friendName: string): H {
  const friends = friendsOf(db, user.id);
  const incoming = friends.filter((f) => !f.accepted && !f.askedByMe);
  const outgoing = friends.filter((f) => !f.accepted && f.askedByMe);
  const mine = friends.filter((f) => f.accepted);
  const face = (p: number) => html`<img class="sx-face" src="${portraitSrc(p)}" alt="" width="40" height="40">`;
  return html`<section class="sx-pane" aria-labelledby="sx-friends-h" data-social-friends>
  <h2 id="sx-friends-h">Friends</h2>
  <form method="post" action="/social/friends" class="sx-row-form"><label>Add by player name<input name="name" value="${friendName}" required maxlength="20" autocomplete="off"></label><button>Send request</button></form>

  ${incoming.length ? html`<h3>Requests</h3><ul class="sx-people">${incoming.map((f) => html`<li>${face(f.portrait)}<span>${playerLink(f.username, factionFor(db,f.username))}${achievementStrip(publicAchievements(db,f.userId,now),f.username)}</span>
    <div class="sx-acts"><form method="post" action="/social/friends"><input type="hidden" name="name" value="${f.username}"><button>Accept</button></form>
    <form method="post" action="/social/friends/${f.userId}/remove"><button class="sx-quiet">Dismiss</button></form></div></li>`)}</ul>` : ""}
  <h3>Your friends</h3>
  ${mine.length ? html`<ul class="sx-people">${mine.map((f) => {
    return html`<li>${face(f.portrait)}<span>${playerLink(f.username, factionFor(db,f.username))}${achievementStrip(publicAchievements(db,f.userId,now),f.username)}</span>
    <div class="sx-acts"><a class="button" href="/social?channel=dm:${f.userId}">Message</a>
    <a class="button" href="/social?channel=dm:${f.userId}&amp;invite=1">Invite</a><details class="sx-pop" id="friend-actions-${f.userId}"><summary class="sx-tool" aria-label="More actions for ${f.username}">⋯</summary><div class="sx-pop-body"><form method="post" action="/social/friends/${f.userId}/remove"><button class="sx-quiet">Unfriend</button></form></div></details></div></li>`;
  })}</ul>` : html`<p class="sx-hint">No friends yet.</p>`}
  ${outgoing.length ? html`<h3>Sent requests</h3><ul class="sx-people">${outgoing.map((f) => html`<li>${face(f.portrait)}<span>${playerLink(f.username, factionFor(db,f.username))}${achievementStrip(publicAchievements(db,f.userId,now),f.username)}<small>Request sent</small></span><div class="sx-acts"><form method="post" action="/social/friends/${f.userId}/remove"><button class="sx-quiet">Cancel</button></form></div></li>`)}</ul>` : ""}

</section>`;
}

function conversationPane(db: DatabaseSync, user: User, s: ShelterView, key: string, world: H, now: number, invites: Invite[], title: string | null): H {
  if (key === "world") return html`<section class="sx-pane" data-social-world>${world}</section>`;
  if (key.startsWith("shelter:")) {
    const id = /^shelter:[1-9]\d*$/.test(key) ? Number(key.split(":")[1]) : 0;
    const shelter = db.prepare("SELECT name FROM shelters WHERE id = ?").get(id) as { name: string } | undefined;
    if (!shelter) return html`<section class="sx-pane"><p>No shelter here.</p></section>`;
    return html`<section class="sx-pane">${talkPanel(id, shelter.name, id === s.id ? "Public messages" : "Public messages", recentTalk(db, id, now), randomUUID())}</section>`;
  }
  const c = conversation(key);
  if (!c) return html`<section class="sx-pane"><p>Pick a conversation.</p></section>`;
  const lines = messages(db, user.id, c);
  const here = invites.filter((i) => (c.kind === "dm" ? i.sender_id === c.id || i.recipient_id === c.id : i.party_id === c.id));
  const mustering = openParties(db, now).filter((p) => p.state === "mustering" && p.seats.some((x) => x.user_id === user.id));
  return html`<section class="sx-pane sx-convo" aria-labelledby="sx-convo-h">
  <header class="sx-convo-head">
    <div><h2 id="sx-convo-h">${c.kind === "dm" && title ? playerLink(title, factionFor(db,title)) : title}</h2>${c.kind === "dm" && title?achievementStrip(publicAchievements(db,c.id,now),title):""}</div>
    <div class="sx-tools">
      ${c.kind === "party" ? html`<a class="sx-tool" href="/expeditions#party-${c.id}" target="_top">View party</a>` : ""}
      ${c.kind === "dm" ? html`<details class="sx-pop"><summary class="sx-tool">Invite</summary><div class="sx-pop-body">${mustering.length
        ? html`<form method="post" action="/social/invite"><input type="hidden" name="friend" value="${c.id}"><input type="hidden" name="channel" value="${key}"><label>Party<select name="party">${mustering.map((p) => html`<option value="${p.id}">${partyTitle(p.leader, p)} (${p.seats.length}/${p.size})</option>`)}</select></label><button>Invite</button></form>`
        : html`<p class="sx-hint">No open party.</p><a class="sx-tool" href="/expeditions" target="_top">Create party</a>`}</div></details>
      <a class="sx-tool" href="/trade?tab=players&amp;friend=${c.id}" target="_top">Trade</a>` : ""}
    </div>
  </header>
  <div data-social-thread>${here.filter(i=>i.state === "pending").map(i=>inviteCard(i,user.id,key,now))}${here.some(i=>i.state !== "pending") ? html`<details id="invite-history" class="sx-history"><summary>Past invites</summary>${here.filter(i=>i.state !== "pending").map(i=>inviteCard(i,user.id,key,now))}</details>` : ""}</div>
  <ol class="sx-messages" data-social-messages aria-live="polite">${lines.map((l,i) => html`<li data-message-id="${l.id}" class="${l.author_id === user.id ? "is-mine" : ""}${i>0 && lines[i-1].author_id===l.author_id && l.at-lines[i-1].at<300000 ? " is-continuation" : ""}"><p class="sx-meta"><b>${factionBadge(factionFor(db,l.author))}${l.author_id === user.id ? "You" : l.author}</b> ${stamp(l.at)}</p>${achievementStrip(publicAchievements(db,l.author_id,now),l.author)}<p>${l.body}</p></li>`)}</ol>
  <p class="sx-hint" data-social-empty ${lines.length ? raw("hidden") : ""}>No messages yet.</p>
  <form method="post" action="/social/message" class="sx-compose" data-message-form><input type="hidden" name="channel" value="${key}"><input type="hidden" name="request_id" value="${randomUUID()}"><label class="visually-hidden" for="sx-body">Message</label><input id="sx-body" name="body" required maxlength="${SOCIAL.maxLength}" autocomplete="off" placeholder="Message…"><button>Send</button></form>
</section>`;
}

export function socialPage(db: DatabaseSync, user: User, s: ShelterView, key: string, world: H, now: number, error = "", friendName = "", embed = false): H {
  const list = threads(db, user.id);
  const c = conversation(key);
  const allowed = !c || canConverse(db, user.id, c);
  const title = c ? list.find((t) => t.key === key)?.title ?? null : null;
  const invites = invitesFor(db, user.id);
  const waiting = invites.filter((i) => i.state === "pending" && i.recipient_id === user.id);
  const requests = friendsOf(db, user.id).filter((f) => !f.accepted && !f.askedByMe).length;
  const count = list.reduce((n, t) => n + t.unread, 0) + requests + waiting.length;
  const lobby = key === "lobby";
  const pane = !allowed
    ? html`<section class="sx-pane"><p role="alert">Only friends or members of this party can read this conversation.</p></section>`
    : key === "friends" ? friendsPanel(db, user, s, now, friendName) : conversationPane(db, user, s, key, world, now, invites, title);
  return html`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Chat · Holdout</title><link rel="stylesheet" href="/static/style.css?v=compact-20261103"><link rel="stylesheet" href="/static/social.css?v=compact-20261103"><script src="/static/app.js" defer></script><script src="/static/social.js?v=compact-20261103" defer></script></head>
<body class="social-page${embed ? " is-embed" : ""}${lobby ? "" : " in-convo"}" data-channel="${key}" data-account="${user.username}" data-poll="${SOCIAL.pollMs}">
${embed ? "" : html`<header class="sx-top"><a class="sx-icon" href="/" target="_top" aria-label="Back to the game" title="Back to the game">←</a><h1>Chat & friends <span data-social-count>${badge(count)}</span></h1></header>`}
<p role="alert" class="sx-error">${error}</p>
<div data-social-invites aria-live="polite">${waiting.filter((i) => !(c?.kind === "dm" && i.sender_id === c.id)).map((i) => inviteCard(i, user.id, key, now))}</div>
<div class="sx-layout${lobby ? " is-lobby" : ""}">
  <div data-social-links>${threadList(list, key, s, requests)}</div>
  ${lobby ? html`<div class="sx-main sx-pick"><p class="sx-hint">Pick a conversation from the list.</p><a class="sx-tool" href="/social?channel=world">Find a party in World</a></div>` : html`<div class="sx-main"><a class="sx-back" href="/social?channel=lobby"><span aria-hidden="true">←</span> Conversations</a>${pane}</div>`}
</div>
</body></html>`;
}
