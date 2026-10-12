import { DUNGEONS, LOWER_DECK, type DungeonDef } from "./game/dungeons.ts";
import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { CHARACTER, SUPPLIES, type SupplyKind } from "./game/config.ts";
import type { Readiness, RunEvent, Share } from "./game/expedition.ts";
import { itemCard } from "./itemViews.ts";
import { eventsSoFar, partyDefinition, type Dispatch, type Friend, type PartyView } from "./parties.ts";
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

const available = (s: ShelterView) => s.crew.filter((m) => !m.journey && !m.party?.mustering && m.character.hp >= CHARACTER.travelMinHp);
const canPrepare = (s: ShelterView) => available(s).length > 0;
const preparation = (s: ShelterView): H => {
  const m = available(s)[0];
  return html`<p>Default: ${m ? `${m.who === "you" ? "You" : m.name} · Level ${m.character.level} · ${m.character.hp}/${m.character.maxHp} HP · Front row` : "Nobody is ready to go. Return home or recover first."}</p>
    <p>No food or water required. Bring your equipment and combat supplies.</p>
    <p><a href="/#survivor">Prepare equipment at home</a></p>
    <details class="ex-options"><summary>Change character or row</summary>${whoField(s)}${rowField()}</details>`;
};

function partyCard(p: PartyView, me: number, s: ShelterView, friends: Friend[], now: number): H {
  const def = partyDefinition(p);
  const mine = p.seats.find((x) => x.user_id === me);
  const leader = p.leader_user_id === me;
  const seatedUsers = new Set(p.seats.map((x) => x.user_id));
  const free = friends.filter((f) => f.accepted && !seatedUsers.has(f.userId));
  if (p.state === "out") {
    const events = eventsSoFar(p, now);
    return html`<article class="card ex-party is-out" id="party-${p.id}">
  <h3>Out on ${def.name}</h3>
  <p class="sv-note">${p.seats.map((x) => x.name).join(", ")} · back <time data-at="${p.ends_at}"></time></p>
  ${events.length ? timeline(events) : html`<p>On the way to ${def.name}.</p>`}
</article>`;
  }
  const left = Math.max(0, Math.ceil((p.expires_at - now) / 60_000));
  return html`<article class="card ex-party" id="party-${p.id}">
  <header class="ex-head"><h3>${p.leader}'s party · ${def.name}</h3>${bandChip(p.readiness)}</header>
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
        (f) => html`<form method="post" action="/parties/${p.id}/dispatch"><input type="hidden" name="friend" value="${f.userId}"><input type="hidden" name="channel" value="dm:${f.userId}"><button class="sv-small">Invite ${f.username} · 5s to decline</button></form>`,
      )}
    </div>`
    : html`<form method="post" action="/parties/${p.id}/join" class="ex-join">${preparation(s)}<button ${canPrepare(s) ? "" : raw("disabled")}>Join expedition</button></form>`}
</article>`;
}

const OUTCOME = { cleared: "Cleared", "turned-back": "Turned back", wiped: "Wiped out" } as const;

// A run that's over: how it went, what you got, and the whole story.
function pastCard(p: PartyView, me: number): H {
  const r = p.result!;
  const def = partyDefinition(p);
  const mine = p.seats.find((x) => x.user_id === me);
  const share: Share | null = mine?.share_json ? JSON.parse(mine.share_json) : null;
  const got = share
    ? [
        ...(["food", "water", "scrap"] as const).filter((k) => share.resources[k] > 0).map((k) => `${share.resources[k]} ${k[0].toUpperCase()}${k.slice(1)}`),
        ...(Object.entries(share.supplies) as [string, number][]).map(([k, n]) => `${n} ${SUPPLIES[k as SupplyKind].name.toLowerCase()}`),
      ]
    : [];
  return html`<article class="card ex-party is-past ex-${r.outcome}" id="party-${p.id}">
  <header class="ex-head"><h3>${OUTCOME[r.outcome]}</h3><time data-ago="${p.ends_at}">${new Date(p.ends_at!).toISOString()}</time></header>
  <p class="sv-note">${p.seats.map((x) => x.name).join(", ")} · ${r.cleared.length} of ${def.rooms.length} rooms</p>
  ${r.outcome === "wiped"
    ? html`<p>Everyone came home carried, without what they'd brought.</p>`
    : html`<p>Your share: ${got.length ? got.join(", ") : "nothing"}${share?.gear.length ? "," : "."}</p>
  ${share?.gear.length ? html`<div class="st-grid">${share.gear.map((g) => itemCard(g, { compact: true }))}</div>` : ""}`}
  <details><summary>The whole run</summary>${timeline(r.events)}</details>
</article>`;
}

export const timeline = (events: RunEvent[]): H =>
  html`<ol class="ex-events">${events.map((e) => html`<li class="ex-${e.tone}">${e.text}</li>`)}</ol>`;

export function expeditionsPage(
  s: ShelterView,
  ctx: { me: number; parties: PartyView[]; past: PartyView[]; friends: Friend[]; dispatch: Dispatch; dungeon?: DungeonDef; now: number; message?: string; error?: string },
): H {
  const def = ctx.dungeon ?? LOWER_DECK;
  const pending = ctx.friends.filter((f) => !f.accepted);
  return html`<h1>Expeditions</h1><nav aria-label="Expedition destinations">${DUNGEONS.map((d) => html`<a href="/expeditions?dungeon=${d.id}">${d.name}</a>`)}</nav>
${ctx.message ? html`<p class="banner" role="status">${ctx.message}</p>` : ""}
${ctx.error ? html`<p class="banner danger" role="alert">${ctx.error}</p>` : ""}
<section class="card ex-intro" aria-labelledby="ld-h">
  <h2 id="ld-h">${def.name}</h2>
  <p>${def.description} It takes ${def.players.min} to ${def.players.max} players, one character each, and runs on its own once everyone's in: what you bring, and who, decides how it goes. A wipe loses what everyone carried, never the stash. Everyone gets an equal share; the equipment is dealt round the table.</p>
  <p>No clue required to start. Records found while exploring reveal the story, and some help you avoid danger inside.</p>
  <p class="banner">${def.danger} Check the party’s risk rating before filling the last seat.</p>
  <p class="sv-note">${def.rooms.length} rooms: ${def.rooms.map((r) => r.name).join(", ")}. About ${Math.round((def.rooms.reduce((t, r) => t + r.ms, 0)) / 60_000)} minutes, more if it's a long fight.</p>
</section>

<section aria-labelledby="ex-call-h">
  <h2 id="ex-call-h">Call a party</h2>
  <form method="post" action="/parties" class="card ex-call"><input type="hidden" name="dungeon" value="${def.id}">
    ${preparation(s)}
    <label>Players <select name="size">${Array.from({ length: def.players.max - def.players.min + 1 }, (_, i) => def.players.min + i).map((n) => html`<option value="${n}" ${n === 3 ? raw("selected") : ""}>${n}</option>`)}</select></label>
    <details class="ex-options"><summary>Tactics and level requirements</summary>
    <label>Approach <select name="approach">${(Object.keys(APPROACH) as (keyof typeof APPROACH)[]).map((k) => html`<option value="${k}">${APPROACH[k]}</option>`)}</select></label>
    <label>Turning back <select name="retreat">${(Object.keys(RETREAT) as (keyof typeof RETREAT)[]).map((k) => html`<option value="${k}" ${k === "half" ? raw("selected") : ""}>${RETREAT[k]}</option>`)}</select></label>
    <label>Lowest level <input type="number" name="min_level" min="1" max="${CHARACTER.maxLevel}" value="1" inputmode="numeric"></label>
    </details>
    <p>Defaults: sneak past optional fights; turn back if half the party falls. Full parties leave automatically.</p>
    <button ${canPrepare(s) ? "" : raw("disabled")}>Call the party</button>
  </form>
</section>

<section aria-labelledby="ex-open-h">
  <h2 id="ex-open-h">Parties</h2>
  <p class="sv-note">Calling a party posts it in <a href="/social?channel=world">world chat</a>, where anyone can join from the card.</p>
  ${ctx.parties.length ? ctx.parties.map((p) => partyCard(p, ctx.me, s, ctx.friends, ctx.now)) : html`<p class="sv-note">Nobody's gathering right now.</p>`}
</section>

${ctx.past.length
  ? html`<section aria-labelledby="ex-past-h" id="past">
  <h2 id="ex-past-h">Your expeditions</h2>
  ${ctx.past.map((p) => pastCard(p, ctx.me))}
</section>`
  : ""}

<section class="card" id="friends"><h2>Friends & chat</h2><a href="/social?channel=friends">Manage friends and your expedition character</a><p>Invite friends from your party or private chat. They can accept now or decline within 5 seconds; otherwise their selected character joins automatically, even offline.</p></section>`;
}
