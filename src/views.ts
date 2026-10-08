import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { TIME_SCALE, TRAVEL_SEC_PER_KM } from "./game/config.ts";
import { DESTINATIONS, type Destination } from "./game/world.ts";
import type { LogEntry, ShelterView } from "./shelter.ts";
import { PORTRAITS, portraitSrc, type PublicShelter } from "./public.ts";
import { CHARACTER } from "./game/config.ts";
import { aftermath, fightCard, nestWarning, warningSigns } from "./survivorViews.ts";
import { recordChoice, tripRecord } from "./journalViews.ts";
import type { FragmentId } from "./game/stories.ts";

type H = HtmlEscapedString | Promise<HtmlEscapedString>;
type Tab = "shelter" | "world" | "activity" | "journal" | "readme" | "none";

const PHASE_LABEL = { traveling: "Traveling", exploring: "Exploring", encounter: "Beast", returning: "Returning" } as const;
const cap = (s: string): string => s[0].toUpperCase() + s.slice(1);
const mins = (sec: number): string => {
  const s = Math.round(sec / TIME_SCALE);
  return s < 60 ? `${s}s` : `${(s / 60).toFixed(1).replace(/\.0$/, "")} min`;
};
const dangerLabel = (d: number): string => (d >= 0.4 ? "High" : d >= 0.15 ? "Moderate" : "Low");

export function layout(opts: { title: string; tab: Tab; user?: string; shelter?: ShelterView; body: H; extraStyle?: string; extraScript?: string }): H {
  const { title, tab, user, shelter, body, extraStyle, extraScript } = opts;
  const j = shelter?.journey;
  const nav = (t: Tab, href: string, label: string) =>
    html`<a href="${href}" ${t === tab ? raw('aria-current="page"') : ""}>${label}</a>`;
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Holdout</title>
<link rel="stylesheet" href="/static/style.css">
${extraStyle ? html`<link rel="stylesheet" href="${extraStyle}">` : ""}
<script src="/static/app.js" defer></script>
${user ? html`<script src="/static/live.js" defer></script>` : ""}
${extraScript ? html`<script src="${extraScript}" defer></script>` : ""}
</head>
<body>
<header class="top">
  <a class="brand" href="/">HOLDOUT</a>
  ${user
    ? html`<nav aria-label="Main">${nav("shelter", "/", "Shelter")}${nav("world", "/world", "World")}${nav("activity", "/activity", "Activity")}${nav("journal", "/journal", "Journal")}</nav>
      <div class="status ${j ? "away" : "home"}" role="status">
        ${j?.phase === "encounter"
          ? html`<span class="dot"></span><a href="/activity#fight">In a fight</a>`
          : j
          ? html`<span class="dot"></span>${j.label} · <span data-until="${j.until}">…</span>`
          : html`<span class="dot"></span>At Shelter`}
      </div>
      <form method="post" action="/logout" class="logout"><button class="link">Log out ${user}</button></form>`
    : html`<nav aria-label="Main">${nav("readme", "/readme/", "About")}</nav>`}
</header>
<main>${body}</main>
<footer><a href="/readme/">What good means here</a></footer>
</body>
</html>`;
}

export function landing(error?: string): H {
  return html`<section class="hero hero-art">
  <h1>The world ended. Your shelter didn't.</h1>
  <p>Keep it fed, watered and powered. Go out into the wasteland for what you can't make — and remember that
  while you're out there, nobody is home.</p>
</section>
<div class="auth-grid">
  ${authForm("register", "Claim a shelter", error)}
  ${authForm("login", "Return to your shelter")}
</div>`;
}

export function authForm(kind: "login" | "register", heading: string, error?: string, picked?: number): H {
  return html`<form method="post" action="/${kind}" class="card auth">
  <h2>${heading}</h2>
  ${error ? html`<p class="error" role="alert">${error}</p>` : ""}
  <label>Name <input name="username" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_\\-]+" autocomplete="username"></label>
  <label>Password <input name="password" type="password" required minlength="8" autocomplete="${kind === "login" ? "current-password" : "new-password"}"></label>
  ${kind === "register" ? portraitPicker(picked) : ""}
  <button>${kind === "login" ? "Log in" : "Register"}</button>
</form>`;
}

// Who you'll be: one of the painted portraits, shown wherever other players
// see you. One is picked at random to start, so the form works as it comes.
function portraitPicker(picked = 1 + Math.floor(Math.random() * PORTRAITS.length)): H {
  return html`<fieldset class="pick">
  <legend>Your survivor</legend>
  <div class="pick-grid">
    ${PORTRAITS.map(
      (alt, i) => html`<label class="pick-face"><input type="radio" name="portrait" value="${i + 1}" ${i + 1 === picked ? raw("checked") : ""}><img src="${portraitSrc(i + 1)}" alt="${alt}" width="56" height="56" loading="lazy"></label>`,
    )}
  </div>
</fieldset>`;
}

export function authPage(kind: "login" | "register", error?: string, picked?: number): H {
  return html`<div class="hero-art hero-slim"></div>
<div class="auth-grid single">${authForm(kind, kind === "login" ? "Return to your shelter" : "Claim a shelter", error, picked)}</div>`;
}

export function worldPage(s: ShelterView, survivors: PublicShelter[], error?: string, found: readonly FragmentId[] = []): H {
  const away = Boolean(s.journey);
  return html`<h1>The wasteland</h1>
<p class="lede">Pick somewhere to scavenge. You'll be gone for the whole trip — there and back.</p>
${error ? html`<p class="banner danger" role="alert">${error}</p>` : ""}
${away ? html`<p class="banner warn">You're already out at the ${s.journey!.destinationName}. <a href="/activity">Follow the trip</a>.</p>` : ""}
${worldMap(s, away)}
<div class="destinations">
  ${DESTINATIONS.map((d) => destinationCard(d, away, s, found))}
</div>
<section class="survivors" aria-labelledby="surv-h">
  <h2 id="surv-h">Survivors</h2>
  <p class="lede">Other shelters nearby. Looking in takes no time and doesn't take you outside.</p>
  ${survivors.length
    ? html`<div class="destinations">${survivors.map(survivorCard)}</div>`
    : html`<p>No other shelters yet. Ask someone to claim one.</p>`}
</section>`;
}

function survivorCard(p: PublicShelter): H {
  return html`<article class="card destination" data-shelter-id="${p.id}">
  <img class="survivor-face" src="${portraitSrc(p.portrait)}" alt="" width="720" height="411" loading="lazy">
  <h3>${p.name}</h3>
  <p class="survivor-who">${p.owner}</p>
  <p><span class="pill ${p.home ? "pill-home" : "pill-away"}" data-live-pill>${p.home ? "Owner home" : "Owner away"}</span></p>
  <dl>
    <div><dt>Security</dt><dd data-live-security>${p.security}</dd></div>
    ${(["food", "water", "scrap"] as const).map((k) => html`<div><dt>${cap(k)}</dt><dd data-band="${k}">${p.bands[k]}</dd></div>`)}
  </dl>
  <a class="button" href="/shelters/${p.id}">Look inside</a>
</article>`;
}

// ---- the map: an aerial photo with your shelter, distance rings and every
// destination drawn to scale on top, so how far a place looks is how long
// the walk takes. Coordinates are the photo's pixels.

const MAP = { w: 1344, h: 626, home: { x: 880, y: 380 }, pxPerKm: 111, rings: [1, 2, 3, 4], ringLabelBearing: 62 };
const at = (km: number, bearing: number) => {
  const r = km * MAP.pxPerKm;
  const b = (bearing * Math.PI) / 180;
  return { x: MAP.home.x + r * Math.sin(b), y: MAP.home.y - r * Math.cos(b) };
};
const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(2)}%`;
const lootLine = (d: Destination) => Object.entries(d.loot).map(([k, [a, b]]) => `${cap(k)} ${a}–${b}`).join(" · ");

// Where you are on the way, as a share of the route out (1 = there).
function onRoute(s: ShelterView, now: number): { d: Destination; share: number; label: string } | null {
  const j = s.journey;
  const d = j && !j.raid ? DESTINATIONS.find((x) => x.name === j.destinationName) : undefined;
  if (!j || !d) return null;
  const t = j.times;
  const share =
    j.phase === "traveling" ? (now - t.departedAt) / (t.arriveAt - t.departedAt)
    : j.phase === "exploring" ? 1
    : 1 - (now - t.exploreUntil) / (t.returnAt - t.exploreUntil);
  return { d, share: Math.max(0, Math.min(1, share)), label: j.label };
}

function worldMap(s: ShelterView, away: boolean): H {
  const now = Date.now();
  const you = onRoute(s, now);
  const rings = MAP.rings
    .map((km) => {
      const l = at(km, MAP.ringLabelBearing);
      return `<circle class="wm-ring" cx="${MAP.home.x}" cy="${MAP.home.y}" r="${km * MAP.pxPerKm}"/>
      <text class="wm-ring-label" x="${l.x.toFixed(0)}" y="${(l.y - 6).toFixed(0)}" text-anchor="middle">${km} km · ${mins(km * TRAVEL_SEC_PER_KM)}</text>`;
    })
    .join("");
  const routes = DESTINATIONS.map((d) => {
    const p = at(d.km, d.bearing);
    return `<path class="wm-route${you?.d.id === d.id ? " is-taken" : ""}" d="M${MAP.home.x} ${MAP.home.y}L${p.x.toFixed(0)} ${p.y.toFixed(0)}"/>`;
  }).join("");
  const youAt = you ? at(you.d.km * you.share, you.d.bearing) : null;
  return html`<section class="wm" aria-labelledby="wm-h">
  <h2 id="wm-h" class="wm-title">Map</h2>
  <p class="wm-scale">Walking pace is ${TRAVEL_SEC_PER_KM / TIME_SCALE} seconds a kilometre, each way. The farther a place, the longer your shelter is left unguarded.</p>
  <div class="wm-frame">
    <img class="wm-photo" src="/static/img/world/map.jpg" width="${MAP.w}" height="${MAP.h}" alt="Aerial view of the land around your shelter: a dry lake, dead forest, ruined buildings and broken roads.">
    <svg class="wm-lines" viewBox="0 0 ${MAP.w} ${MAP.h}" aria-hidden="true">${raw(rings)}${raw(routes)}</svg>
    <div class="wm-home" style="left:${pct(MAP.home.x, MAP.w)};top:${pct(MAP.home.y, MAP.h)}"><span>Your shelter</span></div>
    ${youAt
      ? html`<div class="wm-you" style="left:${pct(youAt.x, MAP.w)};top:${pct(youAt.y, MAP.h)}"><span>You · ${you!.label.toLowerCase()}</span></div>`
      : ""}
    ${DESTINATIONS.map((d) => mapSpot(d, away))}
  </div>
</section>`;
}

function mapSpot(d: Destination, away: boolean): H {
  const p = at(d.km, d.bearing);
  const side = `${p.x > MAP.w * 0.55 ? "is-left" : "is-right"} ${p.y > MAP.h * 0.5 ? "is-up" : "is-down"}`;
  return html`<div class="wm-spot ${side}" style="left:${pct(p.x, MAP.w)};top:${pct(p.y, MAP.h)}">
  <a class="wm-pin" href="#dest-${d.id}" aria-describedby="pop-${d.id}"><span class="wm-pin-name">${d.name}</span><span class="wm-pin-km"><span class="wm-pin-short">${d.name.split(" ").pop()} · </span>${d.km} km</span></a>
  <div class="wm-pop" id="pop-${d.id}" role="tooltip">
    <img src="/static/img/world/${d.id}.jpg" alt="" width="720" height="411" loading="lazy">
    <div class="wm-pop-body">
      <h3>${d.name}</h3>
      <p>${d.blurb}</p>
      <dl>
        <div><dt>Distance</dt><dd>${d.km} km</dd></div>
        <div><dt>Walk</dt><dd>${mins(d.travelSec)} each way</dd></div>
        <div><dt>Searching</dt><dd>${mins(d.exploreSec)}</dd></div>
        <div><dt>Away in all</dt><dd>${mins(d.travelSec * 2 + d.exploreSec)}</dd></div>
        <div><dt>Danger</dt><dd class="danger-${dangerLabel(d.danger).toLowerCase()}">${dangerLabel(d.danger)}</dd></div>
        <div><dt>May find</dt><dd>${lootLine(d)}</dd></div>
      </dl>
      <form method="post" action="/world/depart">
        <input type="hidden" name="destination" value="${d.id}">
        <button ${away ? raw("disabled") : ""}>${away ? "You're already out" : `Leave for the ${d.name.split(" ").pop()}`}</button>
      </form>
    </div>
  </div>
</div>`;
}

function destinationCard(d: Destination, away: boolean, s: ShelterView, found: readonly FragmentId[]): H {
  const loot = lootLine(d);
  const hurt = s.character.hp < CHARACTER.travelMinHp;
  return html`<article class="card destination" id="dest-${d.id}">
  <img class="destination-photo" src="/static/img/world/${d.id}.jpg" alt="" width="720" height="411" loading="lazy">
  <h2>${d.name}</h2>
  <p>${d.blurb}</p>
  <dl>
    <div><dt>Distance</dt><dd>${d.km} km · ${mins(d.travelSec)} each way</dd></div>
    <div><dt>Round trip</dt><dd>${mins(d.travelSec * 2 + d.exploreSec)}</dd></div>
    <div><dt>Danger</dt><dd class="danger-${dangerLabel(d.danger).toLowerCase()}">${dangerLabel(d.danger)}</dd></div>
    <div><dt>Finds</dt><dd>${loot}</dd></div>
  </dl>
  ${d.beast ? nestWarning(s.character) : ""}
  <form method="post" action="/world/depart">
    <input type="hidden" name="destination" value="${d.id}">
    ${recordChoice(d.id, found, away || hurt)}
    ${hurt && !away ? html`<p class="dest-why">Too hurt to travel (${s.character.hp} HP). Rest at the shelter until you have ${CHARACTER.travelMinHp}.</p>` : ""}
    <button ${away || hurt ? raw("disabled") : ""}>${d.beast ? "Leave for the Nest" : "Leave shelter"}</button>
  </form>
</article>`;
}

export function activityPage(s: ShelterView, entries: LogEntry[], ctx: { ids?: { attack: string; escape: string }; fresh?: boolean; error?: string } = {}): H {
  const j = s.journey;
  const e = j?.encounter ?? null;
  const legs: (keyof typeof PHASE_LABEL)[] = e ? ["traveling", "exploring", "encounter", "returning"] : ["traveling", "exploring", "returning"];
  const order = legs.indexOf(j?.phase as keyof typeof PHASE_LABEL);
  const step = (key: keyof typeof PHASE_LABEL, i: number) =>
    html`<li class="${j!.phase === key ? "now" : i < order ? "past" : ""}">${PHASE_LABEL[key]}</li>`;
  const timing =
    j?.phase === "encounter"
      ? html`<p>Everything waits on you: the trip won't go on, and the beast won't move, until you act. Your shelter stays unguarded meanwhile.</p>`
      : j
        ? html`<p>${PHASE_LABEL[j.phase]} — <span data-until="${j.until}">…</span> left in this leg.${e && e.state !== "awaiting" && e.state !== "combat" ? html` Back home <time data-at="${j.times.returnAt}"></time>.` : e ? "" : html` Back home <time data-at="${j.times.returnAt}"></time>.`}</p>`
        : "";
  return html`<h1>Activity</h1>
${ctx.error && !(j?.phase === "encounter") ? html`<p class="banner danger" role="alert">${ctx.error}</p>` : ""}
${j?.raid
    ? html`<section class="card journey" aria-labelledby="j-h">
  <h2 id="j-h">Raiding ${j.destinationName}</h2>
  <p>Getting back — home in <span data-until="${j.until}">…</span>. Your shelter is unguarded until then.</p>
</section>`
    : j
    ? html`<section class="card journey" aria-labelledby="j-h">
  <h2 id="j-h">Out at the ${j.destinationName}</h2>
  <ol class="phases">
    ${legs.map((k, i) => step(k, i))}
  </ol>
  ${timing}
  ${tripRecord(j)}
  ${e && (j.phase === "traveling" || j.phase === "exploring") ? warningSigns() : ""}
</section>
${e && j.phase === "encounter" && ctx.ids ? fightCard(s, e, ctx.ids, Boolean(ctx.fresh), ctx.error) : ""}
${e && j.phase === "returning" ? aftermath(s, e, Boolean(ctx.fresh)) : ""}`
    : html`<p class="banner">You're home. <a href="/world">Head out?</a></p>`}
<section aria-labelledby="log-h">
  <h2 id="log-h">Log</h2>
  <ol class="log" data-live-log>
    ${entries.map((e) => html`<li class="log-${e.kind}"><time data-ago="${e.at}">${new Date(e.at).toISOString()}</time> ${e.message}</li>`)}
  </ol>
</section>`;
}
