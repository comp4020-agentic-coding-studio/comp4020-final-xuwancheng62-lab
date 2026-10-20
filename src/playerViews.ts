import type { DatabaseSync } from "node:sqlite";
import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { SOCIAL } from "./game/config.ts";
import { friendsOf, openParties, partyTitle } from "./parties.ts";
import { portraitSrc, type PublicShelter } from "./public.ts";

// A player's card: who they are to you, and what you can do together.
// Everything about their shelter comes from publicShelter, the same
// whitelist as a visit; nothing here reads their stock, crew or journeys.

type H = HtmlEscapedString | Promise<HtmlEscapedString>;
export type Relation = "self" | "friend" | "asked-me" | "asked-them" | "none";

export function relationTo(db: DatabaseSync, me: number, them: number): Relation {
  if (me === them) return "self";
  const f = friendsOf(db, me).find((x) => x.userId === them);
  if (!f) return "none";
  return f.accepted ? "friend" : f.askedByMe ? "asked-them" : "asked-me";
}

export function playerCard(db: DatabaseSync, me: number, them: { id: number; username: string }, p: PublicShelter, now: number, msg?: { message?: string; error?: string }): H {
  const rel = relationTo(db, me, them.id);
  const mustering = rel === "friend" ? openParties(db, now).filter((x) => x.state === "mustering" && x.seats.some((s) => s.user_id === me) && !x.seats.some((s) => s.user_id === them.id)) : [];
  const status = p.home ? `${them.username} is at their shelter` : p.guarded ? `${them.username} is out · someone's keeping watch` : `${them.username} is out`;
  return html`<div class="pc">
<p class="sh-back"><a class="ui-action" href="/world">← Back to the world</a></p>
<header class="pc-head card">
  <img class="pc-face" src="${portraitSrc(p.portrait)}" alt="" width="96" height="96">
  <div>
    <h1>${them.username}</h1>
    <p class="pc-sub">${p.name} · <span class="sh-status ${p.home ? "is-home" : "is-away"}"><span class="sh-led" aria-hidden="true"></span>${status}</span></p>
    <p class="pc-sub">Security ${p.security}${p.shieldedUntil ? " · guard up" : ""}${p.reinforces ? ` · reinforced by ${p.reinforces}` : ""}</p>
  </div>
</header>
${msg?.message ? html`<p class="banner" role="status">${msg.message}</p>` : ""}
${msg?.error ? html`<p class="banner danger" role="alert">${msg.error}</p>` : ""}
<section class="pc-acts" aria-label="What you can do">
  <a class="button" href="/shelters/${p.id}">Visit their shelter</a>
  ${rel === "self" ? html`<p class="sv-note">This is you. Others see this card when they open your name.</p>` : ""}
  ${rel === "friend" ? html`<a class="button" href="/social?channel=dm:${them.id}">Message</a><a class="button" href="/trade?tab=players&amp;friend=${them.id}">Offer trade</a>` : ""}
  ${rel === "none" ? html`<form method="post" action="/players/${encodeURIComponent(them.username)}/friend"><button>Add friend</button></form>` : ""}
  ${rel === "asked-me" ? html`<form method="post" action="/players/${encodeURIComponent(them.username)}/friend"><button>Accept friendship</button></form>` : ""}
  ${rel === "asked-them" ? html`<p class="sv-note">Friend request sent. You're friends once they accept.</p>` : ""}
</section>
${rel === "friend" && mustering.length
  ? html`<section class="card pc-invite" aria-labelledby="pc-invite-h"><h2 id="pc-invite-h">Invite ${them.username} to your party</h2>
  <p class="sv-note">They get ${SOCIAL.inviteMs / 1000} seconds to decline; otherwise their chosen character joins, even if they're offline.</p>
  ${mustering.map((x) => html`<form method="post" action="/parties/${x.id}/dispatch"><input type="hidden" name="friend" value="${them.id}"><input type="hidden" name="channel" value="dm:${them.id}"><button>Invite to ${partyTitle(x.leader, x)} (${x.seats.length}/${x.size})</button></form>`)}
</section>`
  : ""}
${rel === "friend" || rel === "asked-them" || rel === "asked-me"
  ? html`<form method="post" action="/social/friends/${them.id}/remove" class="pc-unfriend"><input type="hidden" name="channel" value="friends"><button class="link">${rel === "friend" ? "Unfriend" : rel === "asked-them" ? "Cancel request" : "Dismiss request"}</button></form>`
  : ""}
</div>`;
}
