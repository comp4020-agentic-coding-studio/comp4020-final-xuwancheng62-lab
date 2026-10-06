import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { RESOURCES, TIME_SCALE } from "./game/config.ts";
import { currentRates } from "./game/resources.ts";
import { DESTINATIONS, type Destination } from "./game/world.ts";
import type { LogEntry, ShelterView } from "./shelter.ts";

type H = HtmlEscapedString | Promise<HtmlEscapedString>;
type Tab = "shelter" | "world" | "activity" | "readme" | "none";

const PHASE_LABEL = { traveling: "Traveling", exploring: "Exploring", returning: "Returning" } as const;
const cap = (s: string): string => s[0].toUpperCase() + s.slice(1);
const mins = (sec: number): string => {
  const s = Math.round(sec / TIME_SCALE);
  return s < 60 ? `${s}s` : `${(s / 60).toFixed(1).replace(/\.0$/, "")} min`;
};
const dangerLabel = (d: number): string => (d >= 0.4 ? "High" : d >= 0.15 ? "Moderate" : "Low");

export function layout(opts: { title: string; tab: Tab; user?: string; shelter?: ShelterView; body: H }): H {
  const { title, tab, user, shelter, body } = opts;
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
<script src="/static/app.js" defer></script>
</head>
<body>
<header class="top">
  <a class="brand" href="/">HOLDOUT</a>
  ${user
    ? html`<nav aria-label="Main">${nav("shelter", "/", "Shelter")}${nav("world", "/world", "World")}${nav("activity", "/activity", "Activity")}</nav>
      <div class="status ${j ? "away" : "home"}" role="status">
        ${j
          ? html`<span class="dot"></span>${PHASE_LABEL[j.phase]} · <span data-until="${j.until}">…</span>`
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
  return html`<section class="hero">
  <h1>The world ended. Your shelter didn't.</h1>
  <p>Keep it fed, watered and powered. Go out into the wasteland for what you can't make — and remember that
  while you're out there, nobody is home.</p>
</section>
<div class="auth-grid">
  ${authForm("register", "Claim a shelter", error)}
  ${authForm("login", "Return to your shelter")}
</div>`;
}

export function authForm(kind: "login" | "register", heading: string, error?: string): H {
  return html`<form method="post" action="/${kind}" class="card auth">
  <h2>${heading}</h2>
  ${error ? html`<p class="error" role="alert">${error}</p>` : ""}
  <label>Name <input name="username" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_\\-]+" autocomplete="username"></label>
  <label>Password <input name="password" type="password" required minlength="8" autocomplete="${kind === "login" ? "current-password" : "new-password"}"></label>
  <button>${kind === "login" ? "Log in" : "Register"}</button>
</form>`;
}

export function authPage(kind: "login" | "register", error?: string): H {
  return html`<div class="auth-grid single">${authForm(kind, kind === "login" ? "Return to your shelter" : "Claim a shelter", error)}</div>`;
}

export function shelterPage(s: ShelterView): H {
  const r = currentRates(s.stock);
  const now = Date.now();
  return html`<h1>${s.name}</h1>
${s.journey
    ? html`<p class="banner warn">You're away at the ${s.journey.destinationName}. The shelter is unguarded.</p>`
    : ""}
<section aria-labelledby="res-h">
  <h2 id="res-h">Stores</h2>
  <ul class="resources">
    ${RESOURCES.map((k) => {
      const v = s.stock[k];
      const rate = r.net[k];
      return html`<li class="res ${v <= 0 ? "empty" : v < 10 ? "low" : ""}">
        <span class="res-name">${cap(k)}</span>
        <span class="res-val" data-value="${v}" data-rate="${rate}" data-at="${now}">${Math.floor(v)}</span>
        <span class="res-rate">${rate > 0 ? "+" : ""}${rate}/h</span>
      </li>`;
    })}
  </ul>
  ${s.stock.food <= 0 || s.stock.water <= 0
    ? html`<p class="banner danger">${s.stock.food <= 0 ? "No food left. " : ""}${s.stock.water <= 0 ? "No water left. " : ""}Head out and find some.</p>`
    : ""}
</section>
<section aria-labelledby="fac-h">
  <h2 id="fac-h">Facilities</h2>
  <div class="facilities">
    ${facility("Generator", r.generator, "Burns 1 Scrap/h → 6 Power/h", "Out of scrap")}
    ${facility("Water purifier", r.purifier, "Uses 2 Power/h → 8 Water/h", "No power")}
    <article class="card facility">
      <h3>Survivors' upkeep</h3>
      <p>Eats 3 Food/h, drinks 3 Water/h.</p>
    </article>
  </div>
</section>
<p class="cta"><a class="button" href="/world">Go out into the world →</a></p>`;
}

function facility(name: string, running: boolean, desc: string, stalled: string): H {
  return html`<article class="card facility ${running ? "on" : "off"}">
  <h3>${name} <span class="pill">${running ? "Running" : stalled}</span></h3>
  <p>${desc}</p>
</article>`;
}

export function worldPage(s: ShelterView, error?: string): H {
  const away = Boolean(s.journey);
  return html`<h1>The wasteland</h1>
<p class="lede">Pick somewhere to scavenge. You'll be gone for the whole trip — there and back.</p>
${error ? html`<p class="banner danger" role="alert">${error}</p>` : ""}
${away ? html`<p class="banner warn">You're already out at the ${s.journey!.destinationName}. <a href="/activity">Follow the trip</a>.</p>` : ""}
<div class="destinations">
  ${DESTINATIONS.map((d) => destinationCard(d, away))}
</div>
<section class="later" aria-labelledby="surv-h">
  <h2 id="surv-h">Survivors</h2>
  <p>Other shelters are out there. Soon you'll be able to visit them.</p>
</section>`;
}

function destinationCard(d: Destination, away: boolean): H {
  const loot = Object.entries(d.loot).map(([k, [a, b]]) => `${cap(k)} ${a}–${b}`).join(" · ");
  return html`<article class="card destination">
  <h2>${d.name}</h2>
  <p>${d.blurb}</p>
  <dl>
    <div><dt>Round trip</dt><dd>${mins(d.travelSec * 2 + d.exploreSec)}</dd></div>
    <div><dt>Danger</dt><dd class="danger-${dangerLabel(d.danger).toLowerCase()}">${dangerLabel(d.danger)}</dd></div>
    <div><dt>Finds</dt><dd>${loot}</dd></div>
  </dl>
  <form method="post" action="/world/depart">
    <input type="hidden" name="destination" value="${d.id}">
    <button ${away ? raw("disabled") : ""}>Leave shelter</button>
  </form>
</article>`;
}

export function activityPage(s: ShelterView, entries: LogEntry[]): H {
  const j = s.journey;
  const step = (key: keyof typeof PHASE_LABEL, at: number) =>
    html`<li class="${j!.phase === key ? "now" : at <= Date.now() ? "past" : ""}">${PHASE_LABEL[key]}</li>`;
  return html`<h1>Activity</h1>
${j
    ? html`<section class="card journey" aria-labelledby="j-h">
  <h2 id="j-h">Out at the ${j.destinationName}</h2>
  <ol class="phases">
    ${step("traveling", j.times.departedAt)}${step("exploring", j.times.arriveAt)}${step("returning", j.times.exploreUntil)}
  </ol>
  <p>${PHASE_LABEL[j.phase]} — <span data-until="${j.until}">…</span> left in this leg. Back home <time data-at="${j.times.returnAt}"></time>.</p>
</section>`
    : html`<p class="banner">You're home. <a href="/world">Head out?</a></p>`}
<section aria-labelledby="log-h">
  <h2 id="log-h">Log</h2>
  <ol class="log">
    ${entries.map((e) => html`<li class="log-${e.kind}"><time data-ago="${e.at}">${new Date(e.at).toISOString()}</time> ${e.message}</li>`)}
  </ol>
</section>`;
}
