import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { CHARACTER, LOWER_DECK } from "./game/config.ts";
import type { Readiness, RunEvent } from "./game/expedition.ts";
import { eventsSoFar, type Dispatch, type Friend, type PartyView } from "./parties.ts";
import type { Member, ShelterView } from "./shelter.ts";

// The Expeditions page (PLAN.md, "Expeditions, parties and items"): calling
// a party, joining one, bringing a friend's character, and your own say in
// what friends may do with yours. Every action is a plain form.

type H = HtmlEscapedString | Promise<HtmlEscapedString>;

const BAND: Record<Readiness, { label: string; text: string }> = {
  likely: { label: "Likely", text: "Most runs with this party clear it." },
  risky: { label: "Risky", text: "It could go either way." },
  grim: { label: "Grim", text: "Most runs with this party end badly." },
};
const bandChip = (b: Readiness | null) => (b ? html`<span class="ex-band ex-${b}">${BAND[b].label}</span>` : html``);
const APPROACH = { sneak: "Sneak past what they can", fight: "Fight everything" } as const;
const RETREAT = { anyone: "Turn back if anyone falls", half: "Turn back if half fall", never: "Never turn back" } as const;

const whoField = (s: ShelterView, name = "who"): H => {
  const free = s.crew.filter((m) => !m.journey && !m.party?.mustering && m.character.hp >= CHARACTER.travelMinHp);
  if (!free.length) return html`<p class="sv-note">Nobody's free to go: they're out, packed for a party, or under ${CHARACTER.travelMinHp} HP.</p>`;
  return html`<fieldset class="rec-choice"><legend>Who goes</legend>${free.map(
    (m, i) => html`<label class="rec-opt"><input type="radio" name="${name}" value="${m.who}" ${i === 0 ? raw("checked") : ""}><span>${m.who === "you" ? "You" : m.name}<small>Level ${m.character.level} · ${m.character.hp}/${m.character.maxHp} HP · hits ${m.character.damage[0]}–${m.character.damage[1]} · armour ${m.character.armour}</small></span></label>`,
  )}</fieldset>`;
};
const rowField = (name = "row", pick = "front") =>
  html`<fieldset class="rec-choice ex-row"><legend>Row</legend>
  <label class="rec-opt"><input type="radio" name="${name}" value="front" ${pick === "front" ? raw("checked") : ""}><span>Front<small>Takes the bites; melee works only here</small></span></label>
  <label class="rec-opt"><input type="radio" name="${name}" value="back" ${pick === "back" ? raw("checked") : ""}><span>Back<small>Safe until the front falls; for reach and ranged weapons</small></span></label>
</fieldset>`;

function partyCard(p: PartyView, me: number, s: ShelterView, friends: Friend[], now: number): H {
  const mine = p.seats.find((x) => x.user_id === me);
  const leader = p.leader_user_id === me;
  const seatedUsers = new Set(p.seats.map((x) => x.user_id));
  const free = friends.filter((f) => f.accepted && !seatedUsers.has(f.userId));
  if (p.state === "out") {
    const events = eventsSoFar(p, now);
    return html`<article class="card ex-party is-out" id="party-${p.id}">
  <h3>Out on the Lower Deck</h3>
  <p class="sv-note">${p.seats.map((x) => x.name).join(", ")} · back <time data-at="${p.ends_at}"></time></p>
  ${events.length ? timeline(events) : html`<p>On the way down the B1 ramp.</p>`}
</article>`;
  }
  const left = Math.max(0, Math.ceil((p.expires_at - now) / 60_000));
  return html`<article class="card ex-party" id="party-${p.id}">
  <header class="ex-head"><h3>${p.leader}'s party</h3>${bandChip(p.readiness)}</header>
  <p class="sv-note">${p.seats.length} of ${p.size} · ${APPROACH[p.approach]} · ${RETREAT[p.retreat]}${p.min_level > 1 ? ` · level ${p.min_level}+` : ""} · called off in ${left} min if it doesn't fill</p>
  ${p.readiness ? html`<p class="sv-note">${BAND[p.readiness].text}</p>` : ""}
  <ul class="ex-seats">
    ${p.seats.map(
      (x) => html`<li><span><b>${x.name}</b> <small>level ${x.level} · ${x.row}${x.dispatcher ? ` · sent by ${x.dispatcher}` : ""}</small></span>
      ${(leader && x.user_id !== me) || (x.user_id === me && x.dispatched_by !== null && !leader)
        ? html`<form method="post" action="/parties/${p.id}/leave"><input type="hidden" name="seat" value="${x.id}"><button class="sv-small">${x.user_id === me ? "Recall" : "Remove"}</button></form>`
        : ""}</li>`,
    )}
    ${Array.from({ length: p.size - p.seats.length }, () => html`<li class="is-empty"><span>An empty seat</span></li>`)}
  </ul>
  ${mine
    ? html`<div class="it-acts">
      <form method="post" action="/parties/${p.id}/leave"><button class="sv-small">${leader ? "Call it off" : mine.dispatched_by ? "Recall" : "Leave"}</button></form>
      ${leader ? html`<form method="post" action="/parties/${p.id}/recruit"><button class="sv-small">Post it in world chat again</button></form>` : ""}
      ${free.map(
        (f) => html`<form method="post" action="/parties/${p.id}/dispatch"><input type="hidden" name="friend" value="${f.userId}"><button class="sv-small">Bring ${f.username}'s</button></form>`,
      )}
    </div>`
    : html`<form method="post" action="/parties/${p.id}/join" class="ex-join">${whoField(s)}${rowField()}<button>Join, with ${LOWER_DECK.rations.food} Food and ${LOWER_DECK.rations.water} Water</button></form>`}
</article>`;
}

export const timeline = (events: RunEvent[]): H =>
  html`<ol class="ex-events">${events.map((e) => html`<li class="ex-${e.tone}">${e.text}</li>`)}</ol>`;

export function expeditionsPage(
  s: ShelterView,
  ctx: { me: number; parties: PartyView[]; friends: Friend[]; dispatch: Dispatch; canCall: boolean; now: number; message?: string; error?: string },
): H {
  const d = ctx.dispatch;
  const pending = ctx.friends.filter((f) => !f.accepted);
  return html`<h1>Expeditions</h1>
${ctx.message ? html`<p class="banner" role="status">${ctx.message}</p>` : ""}
${ctx.error ? html`<p class="banner danger" role="alert">${ctx.error}</p>` : ""}
<section class="card ex-intro" aria-labelledby="ld-h">
  <h2 id="ld-h">${LOWER_DECK.name}</h2>
  <p>CS-4's sealed level, under the Supermarket. It takes ${LOWER_DECK.players.min} to ${LOWER_DECK.players.max} players, one character each, and runs on its own once everyone's in: what you bring, and who, decides how it goes. A wipe loses what everyone carried, never the stash. Everyone gets an equal share; the equipment is dealt round the table.</p>
  <p class="sv-note">Five rooms: the crank door, the plant room (dark), the dust room (the warden), a police locker, the stores. About ${Math.round((2 * LOWER_DECK.travelMs + LOWER_DECK.rooms.reduce((t, r) => t + r.ms, 0)) / 60_000)} minutes, more if it's a long fight.</p>
</section>

<section aria-labelledby="ex-call-h">
  <h2 id="ex-call-h">Call a party</h2>
  ${ctx.canCall
    ? html`<form method="post" action="/parties" class="card ex-call">
    ${whoField(s)}
    ${rowField()}
    <label>Players <select name="size">${[2, 3, 4].map((n) => html`<option value="${n}" ${n === 3 ? raw("selected") : ""}>${n}</option>`)}</select></label>
    <label>Approach <select name="approach">${(Object.keys(APPROACH) as (keyof typeof APPROACH)[]).map((k) => html`<option value="${k}">${APPROACH[k]}</option>`)}</select></label>
    <label>Turning back <select name="retreat">${(Object.keys(RETREAT) as (keyof typeof RETREAT)[]).map((k) => html`<option value="${k}" ${k === "half" ? raw("selected") : ""}>${RETREAT[k]}</option>`)}</select></label>
    <label>Lowest level <input type="number" name="min_level" min="1" max="${CHARACTER.maxLevel}" value="1" inputmode="numeric"></label>
    <button>Call the party</button>
  </form>`
    : html`<p class="banner">You'd need to find the way down first: at the Supermarket, past CS-4's camp beds, there's a level below. Anyone can join a party someone else calls.</p>`}
</section>

<section aria-labelledby="ex-open-h">
  <h2 id="ex-open-h">Parties</h2>
  <p class="sv-note">Calling a party posts it in <a href="/world#chat">world chat</a>, where anyone can join from the card.</p>
  ${ctx.parties.length ? ctx.parties.map((p) => partyCard(p, ctx.me, s, ctx.friends, ctx.now)) : html`<p class="sv-note">Nobody's gathering right now.</p>`}
</section>

<section class="card" aria-labelledby="fr-h" id="friends">
  <h2 id="fr-h">Friends</h2>
  <p class="sv-note">Friends can put each other's chosen character into a party, even while the other is away from the game, within the limits below.</p>
  <ul class="ex-seats">
    ${ctx.friends.filter((f) => f.accepted).map(
      (f) => html`<li><span><b>${f.username}</b></span><form method="post" action="/friends/${f.userId}/remove"><button class="sv-small">Unfriend</button></form></li>`,
    )}
    ${pending.map(
      (f) => html`<li><span><b>${f.username}</b> <small>${f.askedByMe ? "asked, waiting" : "wants to be friends"}</small></span>
      ${f.askedByMe ? "" : html`<form method="post" action="/friends"><input type="hidden" name="name" value="${f.username}"><button class="sv-small">Say yes</button></form>`}</li>`,
    )}
  </ul>
  <form method="post" action="/friends" class="ex-friend"><label>Name <input name="name" required maxlength="40" autocomplete="off"></label><button>Ask</button></form>
</section>

<section class="card" aria-labelledby="dp-h" id="dispatch">
  <h2 id="dp-h">If a friend sends someone of yours</h2>
  <form method="post" action="/dispatch" class="ex-call">
    <fieldset class="rec-choice"><legend>Who they can send</legend>
      ${s.crew.map((m: Member) => html`<label class="rec-opt"><input type="radio" name="who" value="${m.who}" ${d.enabled && d.who === m.who ? raw("checked") : ""}><span>${m.who === "you" ? "Your survivor" : m.name}</span></label>`)}
      <label class="rec-opt"><input type="radio" name="who" value="off" ${d.enabled ? "" : raw("checked")}><span>Nobody<small>Friends can't send anyone of yours</small></span></label>
    </fieldset>
    <label>No worse than <select name="risk">${(["likely", "risky", "grim"] as Readiness[]).map((b) => html`<option value="${b}" ${d.risk === b ? raw("selected") : ""}>${BAND[b].label}</option>`)}</select></label>
    ${rowField("row", d.row)}
    <label>Keep at least this much Food <input type="number" name="keep_food" min="0" max="999" value="${d.keepFood}" inputmode="numeric"></label>
    <label>…and Water <input type="number" name="keep_water" min="0" max="999" value="${d.keepWater}" inputmode="numeric"></label>
    <button>Save</button>
  </form>
</section>`;
}
