import {colouredLoot} from "./lootText.ts";
import { explorationTime } from "./game/config.ts";
import { battleReportCard } from "./battleReportViews.ts";
import type { BattleReport } from "./battleReports.ts";
import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { BEAST, ENEMIES, SOCIAL, TIME_SCALE } from "./game/config.ts";
import { canExplore, unlockLevel, destinationEnemies, DESTINATIONS, type Destination } from "./game/world.ts";
import type { LogEntry, Member, ShelterView } from "./shelter.ts";
import { PORTRAITS, portraitSrc, type PublicShelter } from "./public.ts";
import { CHARACTER } from "./game/config.ts";
import type { RunEvent } from "./game/expedition.ts";
import { timeline } from "./expeditionViews.ts";
import { aftermath, fightCard, DEFEAT_WARNING, warningSigns } from "./survivorViews.ts";
import { recordChoice, tripRecord } from "./journalViews.ts";
import { wordsFor } from "./character.ts";
import { storyRouteBlock, defaultFocus, fragment, openLeads, type FragmentId } from "./game/stories.ts";

type H = HtmlEscapedString | Promise<HtmlEscapedString>;
export type Tab = "shelter" | "world" | "activity" | "expeditions" | "journal" | "collection" | "readme" | "trade" | "none";

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
<link rel="stylesheet" href="/static/style.css?v=lessons-20261013">
${extraStyle ? html`<link rel="stylesheet" href="${extraStyle === "/static/shelter.css" ? `${extraStyle}?v=raid-20261021` : extraStyle === "/static/journal.css" ? `${extraStyle}?v=notebook-20261021` : extraStyle}">` : ""}
<script src="/static/app.js?v=notebook-20261021" defer></script>
${user ? html`<script src="/static/live.js?v=timeline-20261021" defer></script><script src="/static/social-shell.js?v=social-20261021b" defer></script><link rel="stylesheet" href="/static/social.css?v=social-20261021b">` : ""}
${extraScript ? html`<script src="${extraScript}" defer></script>` : ""}
${["shelter","world","activity","expeditions","collection"].includes(tab)?html`<link rel="stylesheet" href="/static/game-ui.css?v=20261021">`:""}
</head>
<body>
<header class="top">
  <a class="brand" href="/">HOLDOUT</a>
  ${user
    ? html`<nav aria-label="Main">${nav("shelter", "/", "Shelter")}${nav("world", "/world", "World")}${nav("activity", "/activity", "Activity")}${nav("expeditions", "/expeditions", "Expeditions")}${nav("journal", "/journal", "Journal")}${nav("collection", "/collection", "Collection")}${nav("trade", "/trade", "Trade")}</nav>
      <div class="status ${j ? "away" : "home"}" role="status">
        ${j?.reinforcement
          ? html`<span class="dot"></span>Reinforcing · until recalled`
          : j?.phase === "encounter"
          ? html`<span class="dot"></span><a class="ui-action" href="/activity#fight">In a fight</a>`
          : j
          ? html`<span class="dot"></span>${j.label} · <span data-until="${j.until}">…</span>`
          : html`<span class="dot"></span>At Shelter`}
      </div>
      <form method="post" action="/logout" class="logout"><button class="link">Log out ${user}</button></form>`
    : html`<nav aria-label="Main">${nav("readme", "/readme/", "About")}</nav>`}
</header>
<main class="${["shelter","world","activity","expeditions","collection"].includes(tab)?`game-ui game-${tab}`:""}">${body}</main>
${user ? html`<aside class="social-shell" data-social-account="${user}" data-poll="${SOCIAL.pollMs}"><a href="/social?channel=lobby&amp;embed=0" class="social-toggle" aria-controls="social-drawer" aria-expanded="false">Chat & friends <span data-unread></span></a><section hidden id="social-drawer" class="social-drawer" aria-label="Chat and friends"><header><h2>Chat & friends</h2><a class="sx-icon" href="/social?channel=lobby&amp;embed=0" target="_top" aria-label="Open chat as a full page" title="Open as a full page"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg></a><button type="button" class="sx-icon" data-social-close aria-label="Close chat" title="Close">✕</button></header><iframe title="Chat and friends" data-social-frame></iframe></section></aside>` : ""}
<footer><a class="ui-action" href="/readme/">What good means here</a></footer>
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

export function worldPage(s: ShelterView, survivors: PublicShelter[], error?: string, found: readonly FragmentId[] = [], chat: H = html``, learned:Record<string,string[]>={}): H {
  const away = Boolean(s.journey);
  return html`<div class="world-page"><header class="world-head"><h1>The wasteland</h1><nav aria-label="World sections"><a class="ui-action" href="#solo-h">Solo</a><a class="ui-action" href="/expeditions#team-dungeons-h">Team</a><a class="ui-action" href="#surv-h">Neighbours</a></nav></header>
${error ? html`<p class="banner danger" role="alert">${error}</p>` : ""}
${away ? html`<p class="banner warn">You're already out at the ${s.journey!.destinationName}. <a class="ui-action" href="/activity">Follow the trip</a>.</p>` : ""}
${worldMap(s, away)}
<section aria-labelledby="solo-h"><div class="world-section-head"><h2 id="solo-h">Solo exploration</h2><span>Auto combat · retreat below 30% HP</span></div><div class="destinations solo-grid">
  ${DESTINATIONS.map((d) => destinationCard(d, away, s, found, learned[d.id]))}
</div></section>
<section class="world-team-hub"><h2>Team expeditions</h2><a class="button" href="/expeditions#team-dungeons-h">Explore team dungeons →</a><a href="/social?channel=world">World chat</a></section>
<section class="survivors" aria-labelledby="surv-h">
  <h2 id="surv-h">Neighbours <span class="world-count">${survivors.length}</span></h2>
  ${survivors.length
    ? html`<div class="world-neighbours">${survivors.map(survivorCard)}</div>`
    : html`<p>No other shelters yet. Ask someone to claim one.</p>`}
</section>
${chat}</div>`;
}

function survivorCard(p: PublicShelter): H {
  return html`<article class="card destination neighbour-row" data-shelter-id="${p.id}">
  <img class="survivor-face" src="${portraitSrc(p.portrait)}" alt="" width="48" height="48" loading="lazy">
  <div class="neighbour-name"><h3>${p.name}</h3><span class="pill ${p.home ? 'pill-home':'pill-away'}" data-live-pill>${p.home?'Home':'Away'}</span> <small>Security <span data-live-security>${p.security}</span></small></div>
  <div class="neighbour-actions"><a href="/social?channel=friends&name=${encodeURIComponent(p.owner)}" title="Add ${p.owner} as a friend">Add friend</a><a class="button" href="/shelters/${p.id}">Visit</a></div>
  <details class="neighbour-supplies"><summary>Supplies</summary><dl>${(['food','water','scrap'] as const).map(k=>html`<div><dt>${cap(k)}</dt><dd data-band="${k}">${p.bands[k]}</dd></div>`)}</dl></details>
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
      <text class="wm-ring-label" x="${l.x.toFixed(0)}" y="${(l.y - 6).toFixed(0)}" text-anchor="middle">${km} km</text>`;
    })
    .join("");
  const routes = DESTINATIONS.filter(d=>!d.offMap).map((d) => {
    const p = at(d.km, d.bearing);
    return `<path class="wm-route${you?.d.id === d.id ? " is-taken" : ""}" d="M${MAP.home.x} ${MAP.home.y}L${p.x.toFixed(0)} ${p.y.toFixed(0)}"/>`;
  }).join("");
  const youAt = you ? at(you.d.km * you.share, you.d.bearing) : null;
  return html`<section class="wm" aria-labelledby="wm-h">
  <h2 id="wm-h" class="wm-title">Map</h2>
  <div class="wm-legend"><span class="wm-solo-key">● Solo exploration</span></div>
  <div class="wm-scroll" tabindex="0" aria-label="Scrollable world map"><div class="wm-frame">
    <img class="wm-photo" src="/static/img/world/map.jpg" width="${MAP.w}" height="${MAP.h}" alt="Aerial view of the land around your shelter: a dry lake, dead forest, ruined buildings and broken roads.">
    <svg class="wm-lines" viewBox="0 0 ${MAP.w} ${MAP.h}" aria-hidden="true">${raw(rings)}${raw(routes)}</svg>
    <div class="wm-home" style="left:${pct(MAP.home.x, MAP.w)};top:${pct(MAP.home.y, MAP.h)}"><span>Your shelter</span></div>
    ${youAt
      ? html`<div class="wm-you" style="left:${pct(youAt.x, MAP.w)};top:${pct(youAt.y, MAP.h)}"><span>You · ${you!.label.toLowerCase()}</span></div>`
      : ""}
    ${DESTINATIONS.filter(d=>!d.offMap).map((d) => mapSpot(d, s.character.level))}
  </div></div><p class="wm-mobile-note">Swipe the map ↔ to see all locations.</p>
<nav class="ui-sections" aria-label="Northern story routes">${DESTINATIONS.filter(d=>d.offMap).map(d=>html`<a class="ui-action" data-story-route href="#dest-${d.id}">${d.name} · ${d.km} km north →</a>`)}</nav>
</section>`;
}

function mapSpot(d: Destination, playerLevel: number): H {
  const p = at(d.km, d.bearing);
  const side = `${p.x > MAP.w * 0.55 ? "is-left" : "is-right"} ${p.y > MAP.h * 0.5 ? "is-up" : "is-down"}`;
  return html`<div class="wm-spot ${side}${p.y > MAP.h * .82 ? ' is-edge-bottom' : ''}" style="left:${pct(p.x, MAP.w)};top:${pct(p.y, MAP.h)}">
  <a class="wm-pin${canExplore(playerLevel,d.level)?'':' is-locked'}" href="#dest-${d.id}" aria-label="${d.name} ${d.km} km" aria-describedby="pop-${d.id}"><span class="wm-pin-name">${d.mapName ?? d.name}</span><span class="wm-pin-km"><span class="wm-pin-short">${d.name.split(" ").pop()} · </span>${d.km} km</span></a>
  <div class="wm-pop" id="pop-${d.id}" role="tooltip">
    <img src="${d.image ?? `/static/img/world/${d.id}.jpg`}" alt="" width="720" height="411" loading="lazy">
    <div class="wm-pop-body">
      <h3>${d.name}</h3>
      <p class="wm-short-meta">${d.km} km · ${explorationTime(1) ? mins(d.exploreSec) : "Instant"} · ${dangerLabel(d.danger)} risk</p><p class="world-loot">${lootLine(d)}</p>
      <a class="ui-action" href="#dest-${d.id}">View location →</a>
    </div>
  </div>
</div>`;
}

// Who can go: anyone home with the health to travel. One of them is picked
// by default (you, if you can); the choice sits in the form.
function whoGoes(s: ShelterView): H {
  const home = s.crew.filter((m) => !m.journey);
  const fit = home.filter((m) => m.character.hp >= CHARACTER.travelMinHp && !m.party?.mustering);
  if (s.crew.length === 1) return html`<input type="hidden" name="who" value="you">`;
  if (!fit.length) return html``;
  const pick = fit.find((m) => m.who === "you") ?? fit[0];
  return html`<label class="world-who">Character<select name="who" aria-label="Who goes">
  ${home.map(m=>{
    const c=m.character; const ok=c.hp>=CHARACTER.travelMinHp && !m.party?.mustering;
    return html`<option value="${m.who}" ${m===pick?raw('selected'):''} ${ok?'':raw('disabled')}>${m.who==='you'?'You':m.name} · ${c.hp}/${c.maxHp} HP${m.party?.mustering?' · Preparing expedition':!ok?' · Rest required':''}</option>`;
  })}</select></label>`;
}

function destinationCard(d: Destination, away: boolean, s: ShelterView, found: readonly FragmentId[], lessons:readonly string[]=[]): H {
  const loot = d.offMap ? "Story investigation · recover evidence" : lootLine(d);
  const home = s.crew.filter((m) => !m.journey);
  away = !home.length;
  const hurt = !away && home.every((m) => m.character.hp < CHARACTER.travelMinHp);
  const lead = openLeads(found,d.id).find(l=>l.lead.id===defaultFocus(found,d.id))?.lead;
  const search = lead ? `${lead.label}${lead.cost ? ` · ${lead.cost.scrap} scrap` : ''}${fragment(lead.fragment)?.calm ? ' · No fight' : ''}` : 'Details & search';
  const storyBlock = storyRouteBlock(d.id, found);
  const locked = !canExplore(s.character.level,d.level);
  const enemies = d.beast ? BEAST.name : [...new Set(destinationEnemies(d).map(e=>d.stages ? ENEMIES[e.id].name : `${ENEMIES[e.id].name} ×${e.n}`))].join(' · ');
  return html`<article class="card destination solo-card${locked ? ' is-locked' : ''}" id="dest-${d.id}">
  <img class="destination-photo" src="${d.image ?? `/static/img/world/${d.id}.jpg`}" alt="" width="720" height="411" loading="lazy">
  <div class="world-card-head"><h2>${d.name}</h2><span class="world-risk danger-${dangerLabel(d.danger).toLowerCase()}">${dangerLabel(d.danger)}</span></div>
  <p class="world-time">${explorationTime(1) ? mins(d.exploreSec) : "Instant"} exploration${d.level ? ` · Recommended Lv ${d.level.join("–")} · ${d.stages?.length} ${d.stages?.length===1?"encounter":"encounters"}` : ''}</p>
  <p class="world-loot">${loot}</p>

  <form method="post" action="/world/depart">
    <input type="hidden" name="destination" value="${d.id}">
    ${away || hurt || locked ? '' : whoGoes(s)}
    <details class="world-options"><summary><span class="world-search-label">${search}</span></summary><div class="world-options-body">
      <p>${d.blurb} · ${d.km} km</p><p class="world-enemies">${enemies}</p>${d.rewards?html`<p class="world-rewards">${d.rewards.join(" · ")}</p>`:""}
      ${lessons.length?html`<aside class="br-lessons"><b>What you learned</b>${lessons.map(t=>html`<p>${t}</p>`)}</aside>`:''}
      ${d.stages ? html`<ol>${d.stages.map(stage=>html`<li><b>${stage.name}</b> · ${stage.enemies.map(e=>`${ENEMIES[e.id].name} ×${e.n}`).join(" · ")}</li>`)}</ol>` : ''}
      <p>${d.offMap ? "Evidence recovery only; no equipment drops." : "Solo equipment varies by location."} Automatic combat · retreat below 30% HP after healing. Escape keeps equipment and half the loot; failure forces combat.</p>
      <p class="exploration-stakes">${DEFEAT_WARNING}</p>
      ${d.beast ? html`<p>${BEAST.hp} HP · hits ${BEAST.bite.join('–')}</p>` : d.stages ? html`<p>Continuous encounters: health, ammunition and healing carry between fights.</p>` : html`<p>Starter encounter: healthy characters with the starting crowbar can clear it.</p>`}
      ${recordChoice(d.id, found, away || hurt || locked)}
    </div></details>
    ${storyBlock ? html`<p class="dest-why">${storyBlock}</p>` : ""}
    ${hurt ? html`<p class="dest-why">Rest to ${CHARACTER.travelMinHp} HP before exploring.</p>` : ''}
    <button ${away || hurt || locked || storyBlock ? raw('disabled') : ''}>${storyBlock?'Investigation unavailable':locked?`Player Lv ${unlockLevel(d.level)} required`:away?'Everyone is out':hurt?'Rest required':'Explore'}</button>
  </form>
</article>`;
}

// One person's trip: where they are in it, the fight if there is one, and
// what happened after.
function tripCard(s: ShelterView, m: Member, ctx: { ids?: Record<string, { attack: string; escape: string }>; fresh?: boolean; error?: string; expeditions?: Record<number, RunEvent[]> }): H {
  const j = m.journey!;
  if (j.partyId !== null) {
    const events = ctx.expeditions?.[j.partyId] ?? [];
    const h = m.who === "you" ? "j-h" : `j-${m.who}`;
    return html`<section class="card journey" aria-labelledby="${h}" data-trip="${m.who}">
  <h2 id="${h}">${m.who === "you" ? "On" : `${m.name}, on`} an expedition to ${j.destinationName.replace(/^The /, "the ")}</h2>
  <p>${PHASE_LABEL[j.phase]} — back home <time data-at="${j.times.returnAt}"></time>. The party runs on its own; reload to see how it's going.${m.party?.sentBy ? ` Sent by ${m.party.sentBy}.` : ""}</p>
  ${events.length ? timeline(events) : html`<p class="sv-note">Exploration has started.</p>`}
</section>`;
  }
  const you = m.who === "you";
  const e = j.encounter;
  const legs: (keyof typeof PHASE_LABEL)[] = e ? ["exploring", "encounter"] : ["exploring"];
  const order = legs.indexOf(j.phase as keyof typeof PHASE_LABEL);
  const step = (key: keyof typeof PHASE_LABEL, i: number) => html`<li class="${j.phase === key ? "now" : i < order ? "past" : ""}">${PHASE_LABEL[key]}</li>`;
  const watch = s.anyoneHome ? "Someone's home keeping watch." : "Your shelter stays unguarded meanwhile.";
  const timing =
    j.phase === "encounter"
      ? html`<p>Everything waits on ${you ? "you" : m.name}: the trip won't go on, and the beast won't move, until ${you ? "you act" : `you choose for ${wordsFor(m.who).them}`}. ${watch}</p>`
      : html`<p>${PHASE_LABEL[j.phase]} — <span data-until="${j.until}">…</span> left in this leg.${e && e.state !== "awaiting" && e.state !== "combat" ? html` Back home <time data-at="${j.times.returnAt}"></time>.` : e ? "" : html` Back home <time data-at="${j.times.returnAt}"></time>.`}</p>`;
  const h = you ? "j-h" : `j-${m.who}`;
  if (j.reinforcement) return html`<section class="card journey"><h2>${m.name}: reinforcing ${j.destinationName}</h2><form method="post" action="/reinforcements/${m.id}/end"><button>Recall</button></form></section>`;
  if (j.raid)
    return html`<section class="card journey" aria-labelledby="${h}">
  <h2 id="${h}">Raiding ${j.destinationName}</h2>
  <p>Getting back — home in <span data-until="${j.until}">…</span>. ${watch}</p>
</section>`;
  const ids = ctx.ids?.[m.who];
  return html`<section class="card journey" aria-labelledby="${h}" data-trip="${m.who}">
  <h2 id="${h}">${you ? "Out" : `${m.name}, out`} at the ${j.destinationName}</h2>
  <ol class="phases">
    ${legs.map((k, i) => step(k, i))}
  </ol>
  ${timing}
  ${j.automatic ? html`<p class="sv-note">Combat runs automatically, including while offline. Use carried healing; below 30% HP, attempt retreat once. Failed escape means fighting on.</p>` : ""}
  ${tripRecord(j)}
  ${e && (j.phase === "traveling" || j.phase === "exploring") ? warningSigns() : ""}
</section>
${e && j.phase === "encounter" && ids ? fightCard(s, m, e, ids, Boolean(ctx.fresh), ctx.error) : ""}
${e && j.phase === "returning" ? aftermath(s, m, e, Boolean(ctx.fresh)) : ""}`;
}

function activityEntry(e:LogEntry):H {
 const npc=e.kind==='recruit'||(e.kind==='record'&&/^.+ moved in\./.test(e.message));
 const label=npc?'NPC recruited':e.kind==='card'?'Clue card':e.kind==='enemy-card'?'Enemy card':e.kind==='record'&&e.message.includes("every card")?'Collection complete':e.kind==='record'?'Journal':e.kind==='raid'?'Raid':e.kind==='trade'?'Trade':e.kind==='explore'?'Exploration':'Shelter';
 const href=e.raidId?`/raids/${e.raidId}`:npc?'/#survivor':e.kind==='enemy-card'?'/collection/enemies':e.kind==='card'||label==='Collection complete'?'/collection':e.kind==='record'?'/journal?tab=clues':null;
 return html`<li class="log-${e.kind}${npc?' log-recruit':''}"><time data-ago="${e.at}">${new Date(e.at).toISOString()}</time><div>${label?html`<span class="log-event-kind">${label}</span>`:''}<span>${colouredLoot(e.message)}</span>${href?html` <a class="log-event-link" href="${href}">View →</a>`:''}</div></li>`;
}

export function activityPage(s: ShelterView, entries: LogEntry[], ctx: { reports?: BattleReport[]; ids?: Record<string, { attack: string; escape: string }>; fresh?: boolean; error?: string; expeditions?: Record<number, RunEvent[]> } = {}): H {
  const out = s.crew.filter((m) => m.journey);
  const fighting = out.some((m) => m.journey!.phase === "encounter");
  return html`<header class="ui-heading"><div><p class="ui-eyebrow">SHELTER LOGBOOK</p><h1>Activity</h1></div><a class="ui-action" href="/world">Explore →</a></header><nav class="ui-sections" aria-label="Activity sections"><a class="ui-action" href="#activity-now">Now</a>${ctx.reports?.length?html`<a class="ui-action" href="#reports-h">Battle reports</a>`:''}<a class="ui-action" href="#log-h">Timeline</a></nav><div id="activity-now"></div>
${ctx.error && !fighting ? html`<p class="banner danger" role="alert">${ctx.error}</p>` : ""}
${out.length ? out.map((m) => tripCard(s, m, ctx)) : html`<p class="banner">${s.crew.length > 1 ? "Everyone's home." : "You're home."} <a class="ui-action" href="/world">Head out?</a></p>`}
${out.length && s.anyoneHome ? html`<p class="banner">${s.crew.filter((m) => !m.journey).map((m) => (m.who === "you" ? "You're" : `${m.name}'s`)).join(" and ")} home keeping watch. <a class="ui-action" href="/world">Send someone out?</a></p>` : ""}
${ctx.reports?.length ? html`<section aria-labelledby="reports-h"><h2 id="reports-h">Exploration reports</h2><div class="br-list">${ctx.reports.slice(0,3).map(battleReportCard)}${ctx.reports.length>3?html`<details class="ui-archive"><summary>Earlier reports · ${ctx.reports.length-3}</summary>${ctx.reports.slice(3).map(battleReportCard)}</details>`:""}</div></section>` : ''}
<section aria-labelledby="log-h">
  <h2 id="log-h">Timeline <span class="ui-count">${entries.length}</span></h2>
  <ol class="log" data-live-log>
    ${entries.map(activityEntry)}
  </ol>
</section>`;
}
