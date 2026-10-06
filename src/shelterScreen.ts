import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { RATES, RESOURCES, type Resource } from "./game/config.ts";
import { currentRates } from "./game/resources.ts";
import type { ShelterView } from "./shelter.ts";

type H = HtmlEscapedString | Promise<HtmlEscapedString>;

const LABEL: Record<Resource, string> = { food: "Food", water: "Water", power: "Power", scrap: "Scrap" };
const PHASES = [
  ["traveling", "Traveling"],
  ["exploring", "Exploring"],
  ["returning", "Returning"],
] as const;
const LOW = 10;
const ATTENTION_HOURS = 24;

const ICON: Record<Resource, string> = {
  food: `<path d="M7 6h10v2H7zM6 8h12v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM9 12h6v4H9z"/>`,
  water: `<path d="M12 2.5c3.6 4.6 6 8 6 11a6 6 0 0 1-12 0c0-3 2.4-6.4 6-11zm-2.6 11.2a2.8 2.8 0 0 0 2.6 2.8v-1.6a1.3 1.3 0 0 1-1.2-1.2z"/>`,
  power: `<path d="M13.5 2 5 13.5h6L9.5 22 19 9.5h-6.2z"/>`,
  scrap: `<path d="M10.3 2h3.4l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5v3.4l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6h-3.4l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9L2 13.7v-3.4l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"/>`,
};

const clock = (ms: number): string => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const roughHours = (h: number): string => (h < 1 ? "under an hour" : `about ${Math.round(h)} h`);
const signed = (n: number): string => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}`;

interface Attention {
  hours: number;
  text: string;
}

// What runs out first, worked out from the current net rates.
function attention(s: ShelterView): Attention[] {
  const { net } = currentRates(s.stock);
  const then: Partial<Record<Resource, string>> = {
    scrap: "then the generator stops",
    power: "then the purifier and the lights go off",
  };
  const out: Record<Resource, string> = {
    food: "Out of food.",
    water: "Out of water.",
    power: "Out of power: the purifier and the lights are off.",
    scrap: "Out of scrap: the generator has stopped.",
  };
  const items: Attention[] = [];
  for (const k of RESOURCES) {
    const v = s.stock[k];
    if (v <= 0 && net[k] <= 0) {
      items.push({ hours: 0, text: out[k] });
    } else if (net[k] < 0) {
      const hours = v / -net[k];
      if (hours <= ATTENTION_HOURS) {
        items.push({ hours, text: `${LABEL[k]} runs out in ${roughHours(hours)}${then[k] ? `, ${then[k]}` : ""}.` });
      }
    }
  }
  return items.sort((a, b) => a.hours - b.hours).slice(0, 3);
}

function resourceStrip(s: ShelterView, now: number): H {
  const { net } = currentRates(s.stock);
  return html`<ul class="sh-res" aria-label="Stores">
  ${RESOURCES.map((k) => {
    const v = s.stock[k];
    const state = v <= 0 ? "empty" : v < LOW ? "low" : "ok";
    return html`<li class="sh-res-item is-${state}">
      <svg class="sh-res-icon" viewBox="0 0 24 24" aria-hidden="true">${raw(ICON[k])}</svg>
      <span class="sh-res-name">${LABEL[k]}</span>
      <span class="sh-res-val" data-value="${v}" data-rate="${net[k]}" data-at="${now}">${Math.floor(v)}</span>
      <span class="sh-res-rate ${net[k] < 0 ? "is-down" : net[k] > 0 ? "is-up" : ""}">${signed(net[k])}/h</span>
      ${state !== "ok" ? html`<span class="sh-res-flag">${state === "empty" ? "Empty" : "Low"}</span>` : ""}
    </li>`;
  })}
</ul>`;
}

function surface(s: ShelterView, now: number): H {
  const j = s.journey;
  if (!j) {
    return html`<div class="sh-surface is-home">
  ${hatch(false)}
  <div class="sh-exit">
    <a class="sh-cta" href="/world">Go into the wasteland</a>
    <p class="sh-exit-note">Leaving takes the whole trip, there and back. Nobody guards the shelter while you're gone.</p>
  </div>
</div>`;
  }
  const at = PHASES.findIndex(([key]) => key === j.phase);
  return html`<div class="sh-surface is-away">
  ${hatch(true)}
  <section class="sh-trip" aria-labelledby="trip-h">
    <p class="sh-trip-kicker">Out in the wasteland</p>
    <h2 id="trip-h">${j.destinationName}</h2>
    <p class="sh-trip-now"><span class="sh-trip-phase">${PHASES[at][1]}</span>
      <span class="sh-trip-clock" data-until="${j.until}">${clock(j.until - now)}</span>
      <span class="sh-trip-unit">left in this leg</span></p>
    <ol class="sh-trip-steps">
      ${PHASES.map(([, label], i) => html`<li class="${i < at ? "is-done" : i === at ? "is-now" : ""}" ${i === at ? raw('aria-current="step"') : ""}>${label}</li>`)}
    </ol>
    <p class="sh-trip-foot">Back in about ${Math.max(1, Math.ceil((j.times.returnAt - now) / 60_000))} min · <a href="/activity">Follow the trip</a></p>
  </section>
</div>`;
}

function hatch(sealed: boolean): H {
  return raw(`<svg class="sh-hatch" viewBox="0 0 160 90" aria-hidden="true">
  <path class="ground" d="M0 62 Q30 56 52 60 T110 58 T160 61 V90 H0z"/>
  <path class="rubble" d="M8 62l6-7 5 4 4-3 3 6zM124 60l7-9 5 5 6-2 4 7z"/>
  <rect class="collar" x="54" y="50" width="52" height="14" rx="2"/>
  ${
    sealed
      ? `<rect class="lid" x="50" y="44" width="60" height="8" rx="2"/><rect class="bar" x="58" y="40" width="44" height="5" rx="1"/><circle class="lock" cx="80" cy="42" r="4"/>`
      : `<path class="lid" d="M56 50 L44 14 L52 12 L64 49z"/><rect class="opening" x="60" y="52" width="40" height="8"/><path class="ladder" d="M70 52v38M90 52v38M70 60h20M70 70h20M70 80h20"/>`
  }
</svg>`);
}

interface Room {
  id: string;
  name: string;
  state: "running" | "stopped" | "ok" | "low";
  status: string;
  detail: string;
  art: string;
}

function rooms(s: ShelterView): Room[] {
  const r = currentRates(s.stock);
  const g = RATES.generator;
  const p = RATES.purifier;
  const stored = ["food", "water", "scrap"] as const;
  const empty = stored.filter((k) => s.stock[k] <= 0).map((k) => LABEL[k]);
  const low = stored.filter((k) => s.stock[k] > 0 && s.stock[k] < LOW).map((k) => LABEL[k]);
  const storageStatus = [empty.length ? `Empty: ${empty.join(", ")}` : "", low.length ? `Low: ${low.join(", ")}` : ""]
    .filter(Boolean)
    .join(" · ");
  return [
    {
      id: "generator",
      name: "Generator",
      state: r.generator ? "running" : "stopped",
      status: r.generator ? "Running" : "Stopped — out of scrap",
      detail: `Burns ${g.scrapIn} Scrap/h, makes ${g.powerOut} Power/h`,
      art: generatorArt(),
    },
    {
      id: "purifier",
      name: "Water purifier",
      state: r.purifier ? "running" : "stopped",
      status: r.purifier ? "Running" : "Stopped — no power",
      detail: `Uses ${p.powerIn} Power/h, makes ${p.waterOut} Water/h`,
      art: purifierArt(Math.min(1, s.stock.water / 60)),
    },
    {
      id: "storage",
      name: "Storage",
      state: storageStatus ? "low" : "ok",
      status: storageStatus || "Stocked",
      detail: s.journey ? "Nobody home. The shelter is unguarded." : `You're here, keeping watch. Upkeep: ${RATES.upkeep.food} Food and ${RATES.upkeep.water} Water an hour.`,
      art: storageArt(s, !s.journey),
    },
  ];
}

const crates = (n: number) => Math.max(0, Math.min(5, Math.ceil(n / 10)));

function generatorArt(): string {
  return `<svg class="art" viewBox="0 0 240 150" aria-hidden="true">
  <path class="pipe" d="M150 64V26h44V0"/>
  <path class="metal" d="M66 64l8-20h34l8 20z"/>
  <rect class="metal" x="36" y="64" width="128" height="68" rx="4"/>
  <path class="vent" d="M50 80h56M50 88h56M50 96h56M50 104h56"/>
  <rect class="panel" x="118" y="76" width="34" height="40" rx="2"/>
  <circle class="lamp" cx="135" cy="88" r="5"/>
  <rect class="gauge" x="124" y="100" width="22" height="8" rx="1"/>
  <g class="flywheel"><circle class="metal-dark" cx="192" cy="104" r="26"/><path class="spoke" d="M192 80v48M168 104h48M175 87l34 34M209 87l-34 34"/><circle class="hub" cx="192" cy="104" r="6"/></g>
  <path class="cable" d="M36 118c-18 0-14 20-36 20"/>
  <rect class="floor" x="0" y="132" width="240" height="18"/>
</svg>`;
}

function purifierArt(level: number): string {
  const h = Math.round(64 * level);
  return `<svg class="art" viewBox="0 0 240 150" aria-hidden="true">
  <defs><clipPath id="tank-glass"><rect x="80" y="48" width="40" height="64" rx="6"/></clipPath></defs>
  <path class="pipe" d="M0 44h64M136 60h44v34"/>
  <rect class="metal" x="62" y="26" width="76" height="106" rx="30"/>
  <rect class="glass" x="80" y="48" width="40" height="64" rx="6"/>
  <rect class="water" x="80" y="${112 - h}" width="40" height="${h}" clip-path="url(#tank-glass)"/>
  <path class="glint" d="M86 54v40"/>
  <rect class="metal-dark" x="166" y="94" width="28" height="38" rx="3"/>
  <path class="vent" d="M172 104h16M172 112h16M172 120h16"/>
  <circle class="lamp" cx="100" cy="36" r="4"/>
  <path class="drip" d="M206 108c3 5 5 8 5 10a5 5 0 0 1-10 0c0-2 2-5 5-10z"/>
  <path class="pipe" d="M194 100h12v6"/>
  <rect class="floor" x="0" y="132" width="240" height="18"/>
</svg>`;
}

function storageArt(s: ShelterView, home: boolean): string {
  const row = (y: number, n: number, item: (x: number) => string) =>
    Array.from({ length: n }, (_, i) => item(22 + i * 26)).join("") + `<rect class="shelf" x="14" y="${y}" width="140" height="4"/>`;
  const can = (y: number) => (x: number) => `<rect class="can" x="${x}" y="${y - 18}" width="18" height="18" rx="2"/><rect class="label" x="${x}" y="${y - 12}" width="18" height="5"/>`;
  const jug = (y: number) => (x: number) => `<path class="jug" d="M${x + 4} ${y - 20}h10v4l4 4v12h-18v-12l4-4z"/>`;
  const scrap = (y: number) => (x: number) => `<path class="scrapbit" d="M${x} ${y}l4-12 8 3 6-6 2 15z"/>`;
  return `<svg class="art" viewBox="0 0 240 150" aria-hidden="true">
  <rect class="rack" x="14" y="20" width="4" height="112"/><rect class="rack" x="150" y="20" width="4" height="112"/>
  ${row(50, crates(s.stock.food), can(50))}
  ${row(88, crates(s.stock.water), jug(88))}
  ${row(128, crates(s.stock.scrap), scrap(128))}
  ${
    home
      ? `<g class="survivor"><circle cx="198" cy="72" r="9"/><path d="M186 132l3-34c1-9 6-14 9-14s8 5 9 14l3 34h-7l-3-26-2 26z"/><path class="pack" d="M206 88h8v18h-8z"/></g>`
      : `<path class="absent" d="M184 132h28"/>`
  }
  <rect class="floor" x="0" y="132" width="240" height="18"/>
</svg>`;
}

export function shelterScreen(s: ShelterView, now: number): H {
  const away = Boolean(s.journey);
  const issues = attention(s);
  const dark = s.stock.power <= 0;
  return html`<div class="sh">
<header class="sh-head">
  <p class="sh-kicker">Your shelter</p>
  <h1>${s.name}</h1>
  <p class="sh-status ${away ? "is-away" : "is-home"}"><span class="sh-led" aria-hidden="true"></span>${
    away ? "Away · shelter unguarded" : "At shelter · guarded"
  }</p>
</header>
${resourceStrip(s, now)}
<section class="sh-attention ${issues.length ? "has-issues" : ""}" aria-labelledby="att-h">
  <h2 id="att-h">${issues.length ? "Needs attention" : "Holding steady"}</h2>
  ${issues.length
    ? html`<ul>${issues.map((i) => html`<li class="${i.hours === 0 ? "is-out" : ""}">${i.text}</li>`)}</ul>`
    : html`<p>Nothing runs out in the next ${ATTENTION_HOURS} hours.</p>`}
</section>
<section class="sh-bunker ${dark ? "is-dark" : "is-lit"} ${away ? "is-away" : "is-home"}" aria-labelledby="bunker-h">
  <h2 id="bunker-h" class="visually-hidden">Inside the shelter</h2>
  ${surface(s, now)}
  <div class="sh-shell">
    ${dark ? html`<p class="sh-blackout">No power. The lights are out.</p>` : ""}
    <div class="sh-rooms">
      ${rooms(s).map(
        (r) => html`<article class="sh-room sh-room--${r.id} is-${r.state}" aria-labelledby="room-${r.id}">
        <div class="sh-room-art">${raw(r.art)}</div>
        <div class="sh-plaque">
          <h3 id="room-${r.id}">${r.name}</h3>
          <p class="sh-state"><span class="sh-led" aria-hidden="true"></span>${r.status}</p>
          <p class="sh-detail">${r.detail}</p>
        </div>
      </article>`,
      )}
    </div>
  </div>
</section>
</div>`;
}
