import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { RAID, RATES, RESOURCES, STEALABLE, type Resource } from "./game/config.ts";
import { defence, securityBand } from "./game/raid.ts";
import { currentRates } from "./game/resources.ts";
import { DESTINATIONS } from "./game/world.ts";
import { ITEM_ORDER, renderScene, type ItemKey, type SceneModel } from "./scene.ts";
import type { InteractionView, Options } from "./interactions.ts";
import type { Band, PublicShelter } from "./public.ts";
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
const lasts = (v: number, rate: number): string => (rate >= 0 ? "Not running down" : v <= 0 ? "Empty now" : roughHours(v / -rate));
const sources = (k: Resource): string =>
  DESTINATIONS.filter((d) => d.loot[k]).map((d) => d.name).join(" or ");

// ---- scene models

const fill = (v: number, per: number, max: number) => Math.max(0, Math.min(max, Math.ceil(v / per)));
const BAND_FILL: Record<Band, number> = { Plenty: 8, Some: 5, Scarce: 2, Empty: 0 };
const BAND_TANK: Record<Band, number> = { Plenty: 0.9, Some: 0.5, Scarce: 0.2, Empty: 0 };

function ownModel(s: ShelterView): SceneModel {
  const r = currentRates(s.stock);
  return {
    lit: s.stock.power > 0,
    generator: r.generator,
    purifier: r.purifier,
    occupied: !s.journey,
    sealed: Boolean(s.journey),
    items: { food: fill(s.stock.food, 6, 9), water: fill(s.stock.water, 6, 9), scrap: fill(s.stock.scrap, 5, 6) },
    tank: Math.min(1, s.stock.water / 60),
  };
}

function visitModel(p: PublicShelter): SceneModel {
  return {
    lit: p.bands.power !== "Empty",
    generator: p.generator,
    purifier: p.purifier,
    occupied: p.home,
    sealed: !p.home,
    items: { food: BAND_FILL[p.bands.food], water: BAND_FILL[p.bands.water], scrap: Math.min(6, BAND_FILL[p.bands.scrap]) },
    tank: BAND_TANK[p.bands.water],
  };
}

// ---- inspect panels

type Tone = "ok" | "warn" | "bad";
interface Info {
  key: ItemKey;
  title: string;
  tone: Tone;
  status: string;
  facts: [string, string][];
  note: string;
  action?: { href: string; label: string };
}

const stockTone = (v: number): Tone => (v < 1 ? "bad" : v < LOW ? "warn" : "ok");
const stockStatus = (v: number): string => (v < 1 ? "Empty" : v < LOW ? "Running low" : "Stocked");

function ownInfo(s: ShelterView, now: number): Info[] {
  const r = currentRates(s.stock);
  const g = RATES.generator;
  const p = RATES.purifier;
  const j = s.journey;
  const n = (k: Resource) => Math.floor(s.stock[k]).toString();
  return [
    j
      ? {
          key: "hatch",
          title: "Hatch",
          tone: "bad",
          status: "Sealed behind you",
          facts: [
            ["Out at", j.destinationName],
            ["Doing", j.label],
            ["Back in", `about ${Math.max(1, Math.ceil((j.times.returnAt - now) / 60_000))} min`],
          ],
          note: "Nobody is down here to answer it. Until you're back, the shelter is unguarded.",
        }
      : {
          key: "hatch",
          title: "Hatch",
          tone: "ok",
          status: "Open — you're home",
          facts: [["Your address", `/shelters/${s.id}`]],
          note: "The only way in or out. Go up it and the shelter is unguarded until you come back down.",
          action: { href: "/world", label: "Go into the wasteland" },
        },
    {
      key: "generator",
      title: "Generator",
      tone: r.generator ? "ok" : "bad",
      status: r.generator ? "Running" : "Stopped — out of scrap",
      facts: [
        ["Burns", `${g.scrapIn} Scrap/h`],
        ["Makes", `${g.powerOut} Power/h`],
        ["Scrap left", n("scrap")],
        ["Scrap lasts", lasts(s.stock.scrap, r.net.scrap)],
      ],
      note: r.generator
        ? "A steady thump through the floor. If the scrap runs out it stops, and the purifier and lights go with it."
        : `Cold and silent. Scrap comes from the ${sources("scrap")}.`,
    },
    {
      key: "purifier",
      title: "Water purifier",
      tone: r.purifier ? "ok" : "bad",
      status: r.purifier ? "Running" : "Stopped — no power",
      facts: [
        ["Uses", `${p.powerIn} Power/h`],
        ["Makes", `${p.waterOut} Water/h`],
        ["Power left", n("power")],
        ["Power", `${signed(r.net.power)}/h`],
      ],
      note: r.purifier
        ? "Drip by drip. The tank's level is your water store."
        : "Dry. It needs power before it will make another drop.",
    },
    {
      key: "food",
      title: "Food shelf",
      tone: stockTone(s.stock.food),
      status: stockStatus(s.stock.food),
      facts: [
        ["Stored", n("food")],
        ["Eaten", `${RATES.upkeep.food}/h`],
        ["Lasts", lasts(s.stock.food, r.net.food)],
      ],
      note: `Nothing down here grows yet. Food comes from the ${sources("food")}.`,
    },
    {
      key: "water",
      title: "Water jugs",
      tone: stockTone(s.stock.water),
      status: stockStatus(s.stock.water),
      facts: [
        ["Stored", n("water")],
        ["Net", `${signed(r.net.water)}/h`],
        ["Lasts", lasts(s.stock.water, r.net.water)],
      ],
      note: `The purifier tops these up while it has power. Otherwise, the ${sources("water")}.`,
    },
    {
      key: "scrap",
      title: "Scrap bin",
      tone: stockTone(s.stock.scrap),
      status: stockStatus(s.stock.scrap),
      facts: [
        ["Stored", n("scrap")],
        ["Net", `${signed(r.net.scrap)}/h`],
        ["Lasts", lasts(s.stock.scrap, r.net.scrap)],
      ],
      note: "Generator fuel, more or less. When it's empty, the lights follow.",
    },
    {
      key: "quarters",
      title: "Living quarters",
      tone: j ? "bad" : "ok",
      status: j ? "Empty" : "You're here, keeping watch",
      facts: [
        ["Upkeep", `${RATES.upkeep.food} Food + ${RATES.upkeep.water} Water an hour`],
        ["Combat", `${s.combatPower} of ${RAID.maxCombat}`],
        ["Defence now", `${securityBand(defence(!j, s.combatPower, s.reinforces))}${j ? " (you're out)" : ""}`],
        ...(s.reinforces ? ([["Reinforced", `×${s.reinforces} by neighbours`]] as [string, string][]) : []),
      ],
      note: "You at home are most of this shelter's defence. Creature Nest trips you survive make you tougher.",
    },
  ];
}

function visitInfo(p: PublicShelter): Info[] {
  const tone = (k: Resource): Tone => (p.bands[k] === "Empty" ? "bad" : p.bands[k] === "Scarce" ? "warn" : "ok");
  const rough = "From up here you can see roughly how full it is, not the count.";
  return [
    {
      key: "hatch",
      title: "Their hatch",
      tone: p.home ? "ok" : "bad",
      status: p.home ? `Open — ${p.owner} is home` : `Sealed — ${p.owner} is out`,
      facts: [],
      note: p.home ? "Someone is down there to answer it." : "Nobody is down there. This shelter is unguarded right now.",
    },
    {
      key: "generator",
      title: "Generator",
      tone: p.generator ? "ok" : "bad",
      status: p.generator ? "Running" : "Stopped",
      facts: [],
      note: p.generator ? "You can hear it from up here." : "Silent. They're out of scrap.",
    },
    {
      key: "purifier",
      title: "Water purifier",
      tone: p.purifier ? "ok" : "bad",
      status: p.purifier ? "Running" : "Stopped",
      facts: [],
      note: "From outside you can only guess at the tank's level.",
    },
    { key: "food", title: "Food shelf", tone: tone("food"), status: p.bands.food, facts: [], note: rough },
    { key: "water", title: "Water jugs", tone: tone("water"), status: p.bands.water, facts: [], note: rough },
    { key: "scrap", title: "Scrap bin", tone: tone("scrap"), status: p.bands.scrap, facts: [], note: rough },
    {
      key: "quarters",
      title: "Living quarters",
      tone: p.home ? "ok" : "bad",
      status: p.home ? "Someone's here" : "Empty",
      facts: [],
      note: p.home ? `${p.owner} is home, keeping watch.` : `${p.owner}'s bunk is empty.`,
    },
  ];
}

function readout(infos: Info[]): H {
  const order = (k: ItemKey) => ITEM_ORDER.indexOf(k) + 1;
  return html`<section class="sc-readout" aria-live="polite" aria-label="Inspection">
  ${infos.map(
    (i) => html`<article class="sc-info tone-${i.tone}" id="info-${i.key}" tabindex="-1" aria-labelledby="info-${i.key}-h">
    <div class="sc-info-head">
      <span class="sc-info-key" aria-hidden="true">${order(i.key)}</span>
      <h2 id="info-${i.key}-h">${i.title}</h2>
      <a class="sc-info-close" href="#scene">Close<span class="visually-hidden"> ${i.title}</span></a>
    </div>
    <p class="sc-info-status"><span class="sh-led" aria-hidden="true"></span>${i.status}</p>
    ${i.facts.length ? html`<dl class="sc-facts">${i.facts.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>` : ""}
    <p class="sc-info-note">${i.note}</p>
    ${i.action ? html`<a class="sh-cta sc-info-action" href="${i.action.href}">${i.action.label}</a>` : ""}
  </article>`,
  )}
</section>`;
}

const hint = html`<p class="sc-hint">Everything in the shelter can be inspected: select it<span class="js-only">, or press
  <kbd>1</kbd>–<kbd>7</kbd>. <kbd>Esc</kbd> closes</span>.</p>`;

// ---- page pieces

interface Attention {
  hours: number;
  text: string;
}

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

interface Cell {
  k: Resource;
  value: string;
  state: "ok" | "low" | "empty";
  live?: { num: number; rate: number; at: number };
}

function resourceStrip(cells: Cell[]): H {
  return html`<ul class="sh-res" aria-label="Stores">
  ${cells.map(
    (c) => html`<li class="sh-res-item is-${c.state}" data-res="${c.k}">
      <svg class="sh-res-icon" viewBox="0 0 24 24" aria-hidden="true">${raw(ICON[c.k])}</svg>
      <span class="sh-res-name">${LABEL[c.k]}</span>
      ${c.live
        ? html`<span class="sh-res-val" data-value="${c.live.num}" data-rate="${c.live.rate}" data-at="${c.live.at}">${c.value}</span>
          <span class="sh-res-rate ${c.live.rate < 0 ? "is-down" : c.live.rate > 0 ? "is-up" : ""}">${signed(c.live.rate)}/h</span>
          ${c.state !== "ok" ? html`<span class="sh-res-flag">${c.state === "empty" ? "Empty" : "Low"}</span>` : ""}`
        : html`<span class="sh-res-val sh-res-band" data-band="${c.k}">${c.value}</span>`}
    </li>`,
  )}
</ul>`;
}

function actionBar(s: ShelterView, now: number): H {
  const j = s.journey;
  if (!j) {
    return html`<div class="sh-actionbar is-home">
  <a class="sh-cta" href="/world">Go into the wasteland</a>
  <p class="sh-exit-note">Leaving takes the whole trip, there and back. Nobody guards the shelter while you're gone.</p>
</div>`;
  }
  if (j.raid) {
    return html`<section class="sh-actionbar is-away" aria-labelledby="trip-h">
  <div>
    <p class="sh-trip-kicker">Out raiding</p>
    <h2 id="trip-h">${j.destinationName}</h2>
  </div>
  <div>
    <p class="sh-trip-now"><span class="sh-trip-phase">Getting back</span>
      <span class="sh-trip-clock" data-until="${j.until}">${clock(j.until - now)}</span></p>
    <p class="sh-trip-foot">Your shelter is unguarded until you're home. · <a href="/activity">What happened</a></p>
  </div>
</section>`;
  }
  const at = PHASES.findIndex(([key]) => key === j.phase);
  return html`<section class="sh-actionbar is-away" aria-labelledby="trip-h">
  <div>
    <p class="sh-trip-kicker">Out in the wasteland</p>
    <h2 id="trip-h">${j.destinationName}</h2>
  </div>
  <div>
    <p class="sh-trip-now"><span class="sh-trip-phase">${PHASES[at][1]}</span>
      <span class="sh-trip-clock" data-until="${j.until}">${clock(j.until - now)}</span>
      <span class="sh-trip-unit">left in this leg</span></p>
    <ol class="sh-trip-steps">
      ${PHASES.map(([, label], i) => html`<li class="${i < at ? "is-done" : i === at ? "is-now" : ""}" ${i === at ? raw('aria-current="step"') : ""}>${label}</li>`)}
    </ol>
    <p class="sh-trip-foot">Back in about ${Math.max(1, Math.ceil((j.times.returnAt - now) / 60_000))} min · <a href="/activity">Follow the trip</a></p>
  </div>
</section>`;
}

const stageState = (m: SceneModel, mode: "own" | "visit") => `${m.lit ? "is-lit" : "is-dark"} mode-${mode}`;
const hotspots = (infos: Info[]) => infos.map((i) => ({ key: i.key, label: `${i.title}: ${i.status}` }));

export function shelterScreen(s: ShelterView, now: number): H {
  const away = Boolean(s.journey);
  const issues = attention(s);
  const { net } = currentRates(s.stock);
  const model = ownModel(s);
  const infos = ownInfo(s, now);
  return html`<div class="sh">
<header class="sh-head">
  <p class="sh-kicker">Your shelter</p>
  <h1>${s.name}</h1>
  <p class="sh-status ${away ? "is-away" : "is-home"}"><span class="sh-led" aria-hidden="true"></span>${
    away ? "Away · shelter unguarded" : "At shelter · guarded"
  }</p>
</header>
${resourceStrip(
  RESOURCES.map((k) => {
    const v = s.stock[k];
    return { k, value: String(Math.floor(v)), state: v <= 0 ? "empty" : v < LOW ? "low" : "ok", live: { num: v, rate: net[k], at: now } };
  }),
)}
<section class="sh-attention ${issues.length ? "has-issues" : ""}" aria-labelledby="att-h">
  <h2 id="att-h">${issues.length ? "Needs attention" : "Holding steady"}</h2>
  ${issues.length
    ? html`<ul>${issues.map((i) => html`<li class="${i.hours === 0 ? "is-out" : ""}">${i.text}</li>`)}</ul>`
    : html`<p>Nothing runs out in the next ${ATTENTION_HOURS} hours.</p>`}
</section>
${actionBar(s, now)}
${hint}
${s.stock.power <= 0 ? html`<p class="sh-blackout">No power. The lights are out.</p>` : ""}
${renderScene(model, hotspots(infos), stageState(model, "own"))}
${readout(infos)}
</div>`;
}

const clockUntil = (until: number, now: number) => clock(until - now);

function resultBanner(p: PublicShelter, r: InteractionView): H {
  const res = r.resource ? r.resource[0].toUpperCase() + r.resource.slice(1) : "";
  const [tone, text] =
    r.kind === "help"
      ? ["ok", `You reinforced ${p.name}. ${p.owner} will see it straight away.`]
      : r.amount > 0
        ? ["ok", `You got away with ${r.amount} ${res}. You're out for a minute; your own shelter is unguarded.`]
        : r.success
          ? ["warn", `You got in, but their ${r.resource} is down to the last ${RAID.protectedMin}. You left it.`]
          : ["bad", r.targetHome ? `${p.owner} caught you at the hatch. You got nothing.` : `The locks held. You got nothing.`];
  return html`<p class="sh-result tone-${tone}" role="status">${text}</p>`;
}

function moves(p: PublicShelter, o: Options, requestIds: { steal: string; help: string }): H {
  const pct = Math.round(o.steal.chance * 100);
  return html`<section class="sh-moves" aria-label="What you can do">
  <form method="post" action="/shelters/${p.id}/steal" class="sh-move">
    <h2>Raid</h2>
    <p>Your odds: <strong>about ${pct}%</strong>. ${p.home ? `${p.owner} is home and will fight back.` : `${p.owner} is out. Only the locks stand in your way.`}</p>
    <fieldset ${o.steal.ok ? "" : raw("disabled")}>
      <legend>Take</legend>
      ${STEALABLE.map(
        (k, i) => html`<label class="sh-pick"><input type="radio" name="resource" value="${k}" ${i === 0 ? raw("checked") : ""}>
        <span>${LABEL[k]}</span><small>${p.bands[k]}</small></label>`,
      )}
    </fieldset>
    <input type="hidden" name="request_id" value="${requestIds.steal}">
    ${o.steal.ok
      ? html`<button class="sh-move-go is-raid">Raid ${p.owner}</button>`
      : html`<p class="sh-move-why">${o.steal.reason}</p>`}
    <p class="sh-move-note">You'll be away for a minute, and your shelter unguarded. A raid never takes them below ${RAID.protectedMin}.</p>
  </form>
  <form method="post" action="/shelters/${p.id}/help" class="sh-move">
    <h2>Reinforce</h2>
    <p>+${RAID.reinforceBonus} defence for ${RAID.reinforceMs / 60_000} minutes. Doesn't take you away from home.</p>
    <p class="sh-move-meta">Reinforced now: ×${p.reinforces} of ${RAID.maxReinforce}</p>
    <input type="hidden" name="request_id" value="${requestIds.help}">
    ${o.help.ok
      ? html`<button class="sh-move-go">Reinforce ${p.owner}</button>`
      : html`<p class="sh-move-why">${o.help.reason}</p>`}
  </form>
</section>`;
}

export function visitScreen(
  p: PublicShelter,
  o: Options,
  ctx: { now: number; requestIds: { steal: string; help: string }; result?: InteractionView | null; error?: string },
): H {
  const model = visitModel(p);
  const infos = visitInfo(p);
  return html`<div class="sh" data-watch-shelter="${p.id}">
<p class="sh-back"><a href="/world">← Back to the world</a></p>
<header class="sh-head">
  <p class="sh-kicker">Another survivor's shelter</p>
  <h1>${p.name}</h1>
  <p class="sh-status ${p.home ? "is-home" : "is-away"}" data-live-status><span class="sh-led" aria-hidden="true"></span><span data-live-status-text>${
    p.home ? `${p.owner} is home` : `${p.owner} is out · unguarded`
  }</span></p>
  <p class="sh-chip" data-live-security>Security: ${p.security}</p>
  ${p.shieldedUntil ? html`<p class="sh-chip is-shield">Guard up · <span data-until-quiet="${p.shieldedUntil}">${clockUntil(p.shieldedUntil, ctx.now)}</span></p>` : ""}
</header>
<p class="sh-visit-note">You're looking in from your own shelter. Visiting takes no time, and your survivor stays at home.</p>
${ctx.result ? resultBanner(p, ctx.result) : ""}
${ctx.error ? html`<p class="sh-result tone-bad" role="alert">${ctx.error}</p>` : ""}
${resourceStrip(
  RESOURCES.map((k) => ({ k, value: p.bands[k], state: p.bands[k] === "Empty" ? "empty" : p.bands[k] === "Scarce" ? "low" : "ok" })),
)}
${moves(p, o, ctx.requestIds)}
${hint}
${renderScene(model, hotspots(infos), stageState(model, "visit"))}
${readout(infos)}
</div>`;
}
