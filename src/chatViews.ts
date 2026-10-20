import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { CHARACTER, WORLD_CHAT } from "./game/config.ts";
import { partyDefinition, type PartyView } from "./parties.ts";
import { portraitSrc } from "./public.ts";
import type { ShelterView } from "./shelter.ts";
import type { ChatLine } from "./worldChat.ts";

// World chat on the page (PLAN.md, "World chat"). A recruit card is a chat
// line with its party's seats, band and a Join form, all plain HTML;
// static/live.js only adds lines and updates the cards as things change.

type H = HtmlEscapedString | Promise<HtmlEscapedString>;
const BAND = { likely: "Likely", risky: "Risky", grim: "Grim" } as const;

function recruitCard(p: PartyView | undefined, me: number, s: ShelterView): H {
  if (!p) return html`<p class="ch-party">That party is gone.</p>`;
  const filled = p.seats.length;
  const status =
    p.state === "out" ? `Left for ${partyDefinition(p).name}` : p.state === "expired" ? "Called off" : `${filled} of ${p.size}`;
  const seated = p.seats.some((x) => x.user_id === me);
  const free = s.crew.filter((m) => !m.journey && !m.party?.mustering && m.character.hp >= CHARACTER.travelMinHp);
  return html`<div class="ch-party" data-party-live="${p.id}">
  <p><span data-party-status>${status}</span>${p.state === "mustering" && p.readiness ? html`<span data-party-odds> · <span class="ex-band ex-${p.readiness}" data-party-band>${BAND[p.readiness]}</span></span>` : ""}
  · <span data-party-names>${p.seats.map((x) => x.name).join(", ")}</span></p>
  ${p.state !== "mustering"
    ? ""
    : seated
      ? html`<p class="sv-note ch-in" data-party-note>You're in. <a class="sx-tool" href="/expeditions#party-${p.id}" target="_top">View party</a></p>`
      : free.length
        ? html`<form method="post" action="/parties/${p.id}/join" class="ch-join" target="_top">
      <label>Who <select name="who">${free.map((m) => html`<option value="${m.who}">${m.who === "you" ? "You" : m.name} (level ${m.character.level})</option>`)}</select></label>
      <label>Row <select name="row"><option value="front">Front</option><option value="back">Back</option></select></label>
      <button>Join expedition</button>
    </form>`
        : html`<p class="sv-note">Nobody of yours is free to go.</p>`}
</div>`;
}

export function chatPanel(s: ShelterView, lines: ChatLine[], parties: Map<number, PartyView>, ctx: { me: number; requestId: string; error?: string }): H {
  return html`<section class="card ch-panel" id="chat" aria-labelledby="ch-h" data-world-chat>
  <h2 id="ch-h">World chat</h2>
  <p class="sv-note">Everyone hears it. Expedition parties are called here; join from the card.</p>
  <ol class="ch-log" data-chat-log aria-live="polite">
    ${lines.map(
      (l) => html`<li data-chat-id="${l.id}" class="${l.partyId ? "is-recruit" : ""}${l.authorId === ctx.me ? " is-mine" : ""}">
      <img class="ch-face" src="${portraitSrc(l.portrait)}" alt="" width="28" height="28">
      <div><b><a class="sx-player" href="/players/${encodeURIComponent(l.author)}" target="_top">${l.author}</a></b> <time data-ago="${l.at}">${new Date(l.at).toISOString()}</time><p>${l.body}</p>${l.partyId ? recruitCard(parties.get(l.partyId), ctx.me, s) : ""}</div>
    </li>`,
    )}
  </ol>
  <p class="sv-note ch-empty" ${lines.length ? raw("hidden") : ""}>Quiet out there.</p>
  ${ctx.error ? html`<p class="sh-result tone-bad ch-why" role="alert">${ctx.error}</p>` : html`<p class="sh-result tone-bad ch-why" role="alert" hidden></p>`}
  <form method="post" action="/chat" class="ch-form">
    <input type="hidden" name="request_id" value="${ctx.requestId}">
    <label class="visually-hidden" for="ch-body">Say to everyone</label>
    <input id="ch-body" name="body" maxlength="${WORLD_CHAT.maxLength}" required autocomplete="off" placeholder="Say to everyone…">
    <button>Say</button>
  </form>
</section>`;
}
