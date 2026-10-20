import { buildRow, facilityControls, facilityStatus, salvageControls } from "./baseViews.ts";
import { FACILITIES, type FacilityId } from "./game/base.ts";
import { BASE } from "./game/config.ts";
import { tierIndex } from "./game/base.ts";
import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { CROPS, GREENHOUSE, RAID, RATES, RESIDENTS, RESOURCES, STEALABLE, TALK, type Resource } from "./game/config.ts";
import { securityBand } from "./game/raid.ts";
import { currentRates } from "./game/resources.ts";
import { PURIFIER_PLATE, type FragmentId } from "./game/stories.ts";
import { DESTINATIONS } from "./game/world.ts";
import { renderScene, type ItemKey, type Sayings, type SceneModel } from "./scene.ts";
import type { InteractionView, Options } from "./interactions.ts";
import { band, plotStage, portraitSrc, type Band, type PublicShelter } from "./public.ts";
import { defenceOf, guardsOf, type ShelterView } from "./shelter.ts";
import type { TalkLine } from "./talk.ts";
import { survivorChip, survivorPanel } from "./survivorViews.ts";
import { stashPanel } from "./itemViews.ts";

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

function ownModel(s: ShelterView, now: number): SceneModel {
  const r = currentRates(s.stock, s.growing, s.residents, s.base, s.stash.supplies.arrow??0);
  return {
    production: {workshop:r.workshop,farm:r.farm,recycler:r.recycling},
    tiers: Object.fromEntries(Object.entries(s.base).map(([k,v])=>[k,v.tier])),
    doorCondition: s.gateHp / BASE.gateHp[tierIndex(s.base,"gate")],
    lit: s.stock.power > 0,
    generator: r.generator,
    purifier: r.purifier,
    occupied: !s.journey,
    sealed: Boolean(s.journey),
    items: { food: fill(s.stock.food, 6, 9), water: fill(s.stock.water, 6, 9), scrap: fill(s.stock.scrap, 5, 6) },
    tank: Math.min(1, s.stock.water / 60),
    greenhouse: { lit: r.greenhouse, plots: s.plots.map((p) => ({ stage: plotStage(p, now), crop: p.crop })) },
    residents: s.crew.filter((m) => m.who !== "you" && !m.journey).map((m) => m.who),
  };
}

// What Toby says about each thing, in Dev's words as often as his own.
function tobySays(l: Look): Partial<Sayings> {
  return {
    hatch: ["I don't go up there in daylight.", "Hounds don't come east. Yet."],
    generator: l.generator ? ["Don't let it run dry.", "Sounds like the depot's old one."] : ["Needs scrap. I'd go, but."],
    purifier: l.purifier ? ["Quarter turn. Never more.", "Dev packed these tighter.", "Filter's good for a while yet."] : ["No power, no water. Measure first."],
    greenhouse: ["Mum would've liked this.", "Kitchens at Northfield grow these."],
    food: ["I'll eat less. I'm used to it.", "Bigsy'd have this shelf cleared."],
    water: ["Water's honest. You just measure it."],
    scrap: ["I can make a rake out of anything."],
    quarters: ["Bench is fine. Better than a bin.", "I'm writing to Mum tonight.", "Till the road's open."],
  };
}

function visitModel(p: PublicShelter): SceneModel {
  return {
    tiers: p.facilityTiers,
    doorCondition: p.doorCondition==="Broken"?0:p.doorCondition==="Damaged"?.4:1,
    people: { owner: p.owner, guest: p.home },
    lit: p.bands.power !== "Empty",
    generator: p.generator,
    purifier: p.purifier,
    occupied: p.home,
    sealed: !p.home,
    items: { food: BAND_FILL[p.bands.food], water: BAND_FILL[p.bands.water], scrap: Math.min(6, BAND_FILL[p.bands.scrap]) },
    tank: BAND_TANK[p.bands.water],
    greenhouse: {
      lit: p.bands.power !== "Empty" && p.plots.some((x) => x.stage === "sprout" || x.stage === "growing"),
      plots: p.plots,
    },
  };
}

// ---- what the survivor says while inspecting

interface Look {
  generator: boolean;
  purifier: boolean;
  greenhouse: "ready" | "growing" | "empty" | "dark";
  food: Band;
  water: Band;
  scrap: Band;
  reinforced: boolean;
}

function sayings(l: Look): Sayings {
  const by = (b: Band, plenty: string[], some: string[], scarce: string[], empty: string[]) =>
    b === "Plenty" ? plenty : b === "Some" ? some : b === "Scarce" ? scarce : empty;
  return {
    hatch: ["All quiet up top.", "Wonder who's out there today.", "Someone could be watching."],
    generator: !l.generator
      ? ["Dead quiet. Needs scrap.", "No scrap, no power."]
      : l.scrap === "Scarce"
        ? ["Scrap's nearly gone.", "It'll choke soon without scrap."]
        : ["Still thumping along.", "Sounds healthy enough.", "Keep it fed, it keeps us lit."],
    purifier: l.purifier ? ["Drip, drip, drip.", "Water's coming through clean.", "Filter's holding up."] : ["Bone dry. No power.", "Can't purify in the dark."],
    greenhouse: {
      ready: ["These are ready to pick!", "Harvest time."],
      growing: ["Coming along nicely.", "Grow, little ones.", "Lights on, roots down."],
      empty: ["Empty planters. Wasted light.", "Could plant something here."],
      dark: ["Lights are out in here.", "Nothing grows in the dark."],
    }[l.greenhouse],
    food: by(l.food, ["Plenty to eat. For now.", "Shelf's looking good."], ["Should last a while.", "Not starving yet."], ["Shelf's nearly bare.", "Need food. Soon."], ["Nothing left to eat."]),
    water: by(l.water, ["Jugs are full.", "Plenty to drink."], ["Enough water, just.", "Could use a refill."], ["Down to the last jugs.", "Water's running low."], ["Not a drop left."]),
    scrap: by(l.scrap, ["Good pile of junk.", "Plenty to burn."], ["Enough scrap for now.", "Could use more junk."], ["Barely enough to burn.", "Bin's nearly empty."], ["Bin's empty."]),
    quarters: ["Home. Sort of.", "Another mark on the wall.", "Could use a nap.", ...(l.reinforced ? ["Neighbours have our back."] : [])],
  };
}

const greenhouseLook = (stages: string[], lit: boolean, dark: boolean): Look["greenhouse"] =>
  stages.includes("ready") ? "ready" : dark ? "dark" : lit ? "growing" : "empty";

function ownLook(s: ShelterView, now: number): Look {
  const r = currentRates(s.stock, s.growing, s.residents, s.base, s.stash.supplies.arrow??0);
  return {
    generator: r.generator,
    purifier: r.purifier,
    greenhouse: greenhouseLook(s.plots.map((p) => plotStage(p, now)), r.greenhouse, s.stock.power <= 0),
    food: band(s.stock.food),
    water: band(s.stock.water),
    scrap: band(s.stock.scrap),
    reinforced: s.reinforces > 0,
  };
}

function visitLook(p: PublicShelter): Look {
  const growing = p.plots.some((x) => x.stage === "sprout" || x.stage === "growing");
  return {
    generator: p.generator,
    purifier: p.purifier,
    greenhouse: greenhouseLook(p.plots.map((x) => x.stage), growing, p.bands.power === "Empty"),
    food: p.bands.food,
    water: p.bands.water,
    scrap: p.bands.scrap,
    reinforced: p.reinforces > 0,
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
  body?: H;
  action?: { href: string; label: string };
}

function greenhouseBody(s: ShelterView, now: number): H {
  const away = Boolean(s.journey);
  const dark = s.stock.power <= 0;
  return html`<ol class="sc-plots">
    ${s.plots.map((p) => {
      const label = `Planter ${p.slot + 1}`;
      if (!p.crop) {
        const cheapest = Math.min(...CROPS.map((k) => GREENHOUSE.crops[k].water));
        const why = away
          ? "You're out. Plant when you're home."
          : dark
            ? "The grow lights need power."
            : s.stock.water < cheapest
              ? `Not enough water to plant anything (seeds need ${cheapest}+).`
              : "";
        return html`<li class="sc-plot is-empty"><span class="sc-plot-name">${label}: empty</span>
          ${why
            ? html`<span class="sc-plot-why">${why}</span>`
            : html`<form method="post" action="/greenhouse/plant" class="sc-plot-form">
              <input type="hidden" name="slot" value="${p.slot}">
              ${CROPS.map((k) => {
                const c = GREENHOUSE.crops[k];
                return html`<button name="crop" value="${k}" ${s.stock.water < c.water ? raw("disabled") : ""}>${c.name}<small>${c.water} Water · ${c.growMin} min · +${c.food} Food</small></button>`;
              })}
            </form>`}
        </li>`;
      }
      const c = GREENHOUSE.crops[p.crop];
      if (p.ready) {
        return html`<li class="sc-plot is-ready"><span class="sc-plot-name">${label}: ${c.name}, ready</span>
          ${away
            ? html`<span class="sc-plot-why">Harvest when you're home.</span>`
            : html`<form method="post" action="/greenhouse/harvest"><input type="hidden" name="slot" value="${p.slot}"><button class="sc-harvest">Harvest +${c.food} Food</button></form>`}
        </li>`;
      }
      const pct = Math.round((100 * (now - p.plantedAt)) / (p.readyAt - p.plantedAt));
      return html`<li class="sc-plot is-growing"><span class="sc-plot-name">${label}: ${c.name}</span>
        <span class="sc-plot-time">ready in <span data-until="${p.readyAt}">${clock(p.readyAt - now)}</span></span>
        <progress max="100" value="${pct}">${pct}%</progress>
      </li>`;
    })}
  </ol>`;
}

const stockTone = (v: number): Tone => (v < 1 ? "bad" : v < LOW ? "warn" : "ok");
const stockStatus = (v: number): string => (v < 1 ? "Empty" : v < LOW ? "Running low" : "Stocked");

// Behind the purifier's side panel: the serial plate, once you've looked.
function purifierBody(s: ShelterView, found: readonly FragmentId[]): H {
  if (found.includes(PURIFIER_PLATE))
    return html`<p class="sc-plate">Behind the side panel, a serial plate: SN 118-0447, serviced and fitted by M.H. <a href="/journal#rec-${PURIFIER_PLATE}">In your journal</a></p>`;
  if (s.journey) return html``;
  return html`<form method="post" action="/purifier/inspect" class="sc-inspect"><button>Inspect purifier<small>Take the side panel off and look</small></button></form>`;
}

function ownInfo(s: ShelterView, now: number, found: readonly FragmentId[], inviteToby = false): Info[] {
  const r = currentRates(s.stock, s.growing, s.residents, s.base, s.stash.supplies.arrow??0);
  // Toby's purifier work counts only while he's home on it; he eats either way
  const toby = s.residents.some((h) => h.who === "toby" && h.working);
  const tobyHere = s.residents.some((h) => h.who === "toby");
  const g = {scrapIn:BASE.generatorFuel[tierIndex(s.base,"generator")],powerOut:BASE.generatorOutput[tierIndex(s.base,"generator")]};
  const p = {powerIn:BASE.purifierPower[tierIndex(s.base,"purifier")],waterOut:BASE.purifierOutput[tierIndex(s.base,"purifier")]};
  const j = s.journey;
  const n = (k: Resource) => Math.floor(s.stock[k]).toString();
  const infos:Info[] = [
    j
      ? {
          key: "hatch",
          title: "Vault entrance",
          tone: "bad",
          status: "Sealed behind you",
          facts: [
            ["Out at", j.destinationName],
            ["Doing", j.label],
            ["Back in", `about ${Math.max(1, Math.ceil((j.times.returnAt - now) / 60_000))} min`],
          ],
          note: "The vault door protects stored supplies. Crew at home also defend it; check door condition here.",
        }
      : {
          key: "hatch",
          title: "Vault entrance",
          tone: "ok",
          status: "Open — you're home",
          facts: [["Your address", `/shelters/${s.id}`]],
          note: "The hillside vault door leads through an access tunnel to the internal ladder. Upgrade and repair the door here.",
          action: { href: "/world", label: "Go into the wasteland" },
        },
    {
      key: "generator",
      title: "Generator",
      tone: r.generator ? "ok" : "bad",
      status: r.generator ? "Running" : s.base.generator.enabled ? "Stopped — fuel or full storage" : "Paused",
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
      status: r.purifier ? "Running" : s.base.purifier.enabled ? "Stopped — power or full storage" : "Paused",
      facts: [
        ["Uses", `${p.powerIn} Power/h`],
        ["Makes", `${p.waterOut} Water/h`],
        ...(toby ? ([["Toby's re-packing", `+${RESIDENTS.toby.purifierWater} Water/h`]] as [string, string][]) : []),
        ["Power left", n("power")],
        ["Power", `${signed(r.net.power)}/h`],
      ],
      body: purifierBody(s, found),
      note: r.purifier
        ? toby
          ? "Drip by drip, faster since Toby re-packed the filter the way Dev taught him."
          : "Drip by drip. The tank's level is your water store."
        : "Dry. It needs power before it will make another drop.",
    },
    (() => {
      const ready = s.plots.filter((p) => p.ready).length;
      const dark = s.stock.power <= 0;
      const gh = GREENHOUSE.perPlot;
      return {
        key: "greenhouse" as const,
        title: "Greenhouse",
        tone: (dark ? "bad" : s.growing || ready ? "ok" : "warn") as Tone,
        status: ready ? `${ready} ready to harvest` : dark ? "Dark — no power" : s.growing ? `${s.growing} growing` : "Empty planters",
        facts: [
          ["Each growing plot", `${gh.water} Water + ${gh.power} Power/h`],
          ["Water left", n("water")],
          ["Power left", n("power")],
        ] as [string, string][],
        note: "Planting costs water up front. While anything grows, the plants drink water and the lights draw power.",
        body: greenhouseBody(s, now),
      };
    })(),
    {
      key: "food",
      title: "Food shelf",
      tone: stockTone(s.stock.food),
      status: stockStatus(s.stock.food),
      facts: [
        ["Stored", n("food")],
        ["Eaten", `${RATES.upkeep.food + (tobyHere ? RESIDENTS.toby.food : 0)}/h${tobyHere ? " (you and Toby)" : ""}`],
        ["Lasts", lasts(s.stock.food, r.net.food)],
      ],
      note: `Cultivation beds can produce food automatically. Exploration and manual greenhouse harvests supply extra food.`,
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
      note: "Construction metal, crafting stock and a small part of generator upkeep. Recycling provides a renewable supply.",
    },
    {
      key: "quarters",
      title: "Living quarters",
      tone: s.anyoneHome ? "ok" : "bad",
      status: watchLine(s),
      facts: [
        ["Upkeep", `${RATES.upkeep.food} Food + ${RATES.upkeep.water} Water an hour`],
        ...s.crew.map((m): [string, string] => [m.who === "you" ? "Your combat" : `${m.name}'s combat`, m.journey ? `${m.character.combat}, out` : `${m.character.combat}${m.who !== "you" && m.task === "work" ? ", working (counts half)" : ""}`]),
        ["Defence now", securityBand(defenceOf(s))],
        ...(s.reinforces ? ([["Reinforced", `×${s.reinforces} by neighbours`]] as [string, string][]) : []),
      ],
      note: s.crew.length > 1
        ? "Whoever's home defends the shelter: their combat and weapon count, half for anyone busy with their work. Creature Nest trips survived make each of you tougher."
        : "You at home are most of this shelter's defence. Creature Nest trips you survive make you tougher.",
      body: inviteToby ? inviteForm() : undefined,
    },
  ];
  const control:Partial<Record<ItemKey,FacilityId>>={hatch:"gate",generator:"generator",purifier:"purifier",food:"storage",water:"storage"};
  for(const info of infos) {
    const kind=control[info.key];
    if(kind)info.body=html`${info.body??""}${facilityControls(s,kind)}`;
    if(info.key==="scrap")info.body=salvageControls(s);
  }
  for(const key of ["workshop","farm","recycler"] as const)if(s.base[key].tier>0)infos.push({
    key,title:FACILITIES[key].name,tone:s.base[key].enabled?"ok":"warn",status:facilityStatus(s,key),facts:[],note:FACILITIES[key].description,body:facilityControls(s,key)
  });
  return infos;
}

// Toby's answer, once you've cleared the intake with him.
const inviteForm = (): H =>
  html`<form method="post" action="/quests/last-reply/invite" class="sh-invite"><p>Toby's at the underpass, waiting to hear if there's a bench here for him.</p><button class="button">Ask Toby to stay</button></form>`;

function visitInfo(p: PublicShelter): Info[] {
  const tone = (k: Resource): Tone => (p.bands[k] === "Empty" ? "bad" : p.bands[k] === "Scarce" ? "warn" : "ok");
  const rough = "From up here you can see roughly how full it is, not the count.";
  return [
    {
      key: "hatch",
      title: "Their vault entrance",
      tone: p.home ? "ok" : "bad",
      status: p.home ? `Open — ${p.owner} is home` : `Sealed — ${p.owner} is out`,
      facts: [],
      note: p.home ? "Someone is down there to answer it." : "Nobody is down there, but the vault door still protects supplies.",
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
    (() => {
      const ready = p.plots.filter((x) => x.stage === "ready").length;
      const growing = p.plots.filter((x) => x.stage === "sprout" || x.stage === "growing").length;
      return {
        key: "greenhouse" as const,
        title: "Greenhouse",
        tone: (ready || growing ? "ok" : "warn") as Tone,
        status: ready ? `${ready} ready to pick` : growing ? `${growing} growing` : "Empty planters",
        facts: [] as [string, string][],
        note: "You can see what's growing through the glass, not how much it will feed them.",
      };
    })(),
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

function readout(infos: Info[], open?: ItemKey): H {
  return html`<section class="sc-readout" aria-live="polite" aria-label="Inspection">
  ${infos.map(
    (i) => html`<article class="sc-info tone-${i.tone}" id="info-${i.key}" tabindex="-1" aria-labelledby="info-${i.key}-h" ${i.key === open ? raw("data-open") : ""}>
    <div class="sc-info-head">
      <h2 id="info-${i.key}-h">${i.title}</h2>
      <a class="sc-info-close" href="#scene">Close<span class="visually-hidden"> ${i.title}</span></a>
    </div>
    <p class="sc-info-status"><span class="sh-led" aria-hidden="true"></span>${i.status}</p>
    ${i.facts.length ? html`<dl class="sc-facts">${i.facts.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>` : ""}
    ${i.body ?? ""}
    <p class="sc-info-note">${i.note}</p>
    ${i.action ? html`<a class="sh-cta sc-info-action" href="${i.action.href}">${i.action.label}</a>` : ""}
  </article>`,
  )}
</section>`;
}

const hint = html`<p class="sc-hint">Select a facility to inspect it. <a href="#base">Build a new room</a><span class="js-only"> · Esc closes inspection</span>.</p>`;

// ---- page pieces

interface Attention {
  hours: number;
  text: string;
}

function attention(s: ShelterView): Attention[] {
  const { net } = currentRates(s.stock, s.growing, s.residents, s.base, s.stash.supplies.arrow??0);
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
  <nav class="sh-tools" aria-label="Shelter sections"><a class="sh-cta" href="/world">Explore</a><a href="#survivor">People</a><a href="#stash">Stash</a></nav>
</div>`;
  }
  if (j.reinforcement) return html`<section class="sh-actionbar is-away"><div><h2>Reinforcing ${j.destinationName}</h2><p>Guarding with your equipped gear. <a href="#survivor">Recall from People</a></p></div></section>`;
  if (j.raid) {
    return html`<section class="sh-actionbar is-away" aria-labelledby="trip-h">
  <div>
    <p class="sh-trip-kicker">Out raiding</p>
    <h2 id="trip-h">${j.destinationName}</h2>
  </div>
  <div>
    <p class="sh-trip-now"><span class="sh-trip-phase">Getting back</span>
      <span class="sh-trip-clock" data-until="${j.until}">${clock(j.until - now)}</span></p>
    <p class="sh-trip-foot">Your vault door and any crew staying home defend the shelter. · <a href="/activity">What happened</a></p>
  </div>
</section>`;
  }
  if (j.phase === "encounter") {
    return html`<section class="sh-actionbar is-away is-fight" aria-labelledby="trip-h">
  <div>
    <p class="sh-trip-kicker">Out in the wasteland</p>
    <h2 id="trip-h">${j.destinationName}</h2>
  </div>
  <div>
    <p class="sh-trip-now"><span class="sh-trip-phase">A beast blocks your way</span></p>
    <p class="sh-trip-foot">Nothing moves on until you choose. <a class="sh-cta" href="/activity#fight">Fight or flee</a></p>
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
      <span class="sh-trip-unit">remaining</span></p>

    <p class="sh-trip-foot"><a href="/activity">Activity →</a></p>
  </div>
</section>`;
}

// Who's keeping watch: you, whoever's home if you're out, or nobody.
export function watchLine(s: ShelterView): string {
  const home = s.crew.filter((m) => !m.journey);
  if (!s.journey) return home.length > 1 ? `You're here, with ${home.filter((m) => m.who !== "you").map((m) => m.name).join(" and ")}` : "You're here, keeping watch";
  if (home.length) return `${home.map((m) => m.name).join(" and ")} ${home.length > 1 ? "are" : "is"} keeping watch`;
  return "Empty";
}

const stageState = (m: SceneModel, mode: "own" | "visit") => `${m.lit ? "is-lit" : "is-dark"} mode-${mode}`;
const hotspots = (infos: Info[]) => infos.map((i) => ({ key: i.key, label: `${i.title}: ${i.status}` }));

type Visitors = { id: number; name: string }[];

// Who's at the gate, in words, for anyone not watching the drawing.
const gateLine = (label: string, visitors: Visitors) =>
  html`<p class="sc-gate" data-gate-label="${label}" aria-live="polite" ${visitors.length ? "" : raw("hidden")}>${label}
    <span class="sc-gate-names">${visitors.map((v) => v.name).join(", ")}</span></p>`;

// What's been said at this shelter, and a line to add. Works as a plain form;
// static/live.js sends it without a reload and adds lines as they're said.
export function talkPanel(shelterId: number, title: string, note: string, lines: TalkLine[], requestId: string): H {
  return html`<section class="sh-talk" id="talk" aria-labelledby="talk-h" data-talk-shelter="${shelterId}">
  <h2 id="talk-h">${title}</h2>
  <p class="sh-talk-note">${note}</p>
  <ol class="sh-talk-log" data-talk-log aria-live="polite">
    ${lines.map(
      (l) => html`<li data-talk-id="${l.id}" class="${l.owner ? "is-owner" : ""}"><img class="sh-talk-face" src="${portraitSrc(l.portrait)}" alt="" width="28" height="28"><b>${l.author}</b> <span>${l.body}</span> <time data-ago="${l.at}">${new Date(l.at).toISOString()}</time></li>`,
    )}
  </ol>
  <p class="sh-talk-empty" ${lines.length ? raw("hidden") : ""}>Nobody has said anything here today.</p>
  <form method="post" action="/shelters/${shelterId}/talk" class="sh-talk-form">
    <input aria-label="Say something" name="body" maxlength="${TALK.maxLength}" required autocomplete="off" placeholder="Say something…">
    <input type="hidden" name="request_id" value="${requestId}">
    <button>Say</button>
  </form>
  <p class="sh-talk-why" role="alert" hidden></p>
</section>`;
}

type TalkCtx = { talk?: TalkLine[]; talkRequestId?: string };

export function shelterScreen(
  s: ShelterView,
  now: number,
  ctx: { error?: string; open?: ItemKey; found?: readonly FragmentId[]; visitors?: Visitors; survivor?: { message?: string; error?: string }; inviteToby?: boolean } & TalkCtx = {},
): H {
  const away = Boolean(s.journey);
  const issues = attention(s);
  const { net } = currentRates(s.stock, s.growing, s.residents, s.base, s.stash.supplies.arrow??0);
  const model = ownModel(s, now);
  const infos = ownInfo(s, now, ctx.found ?? [], Boolean(ctx.inviteToby) && !away);
  return html`<div class="sh sh-own" data-scene-shelter="${s.id}" data-me="${s.userId}">
<header class="sh-head">
  <img class="sh-face" src="${portraitSrc(s.portrait)}" alt="" width="56" height="56">
  <h1>${s.name}</h1>
  <p class="sh-status ${away ? "is-away" : "is-home"}${away && s.anyoneHome ? " is-watched" : ""}"><span class="sh-led" aria-hidden="true"></span>${
    !away ? "At shelter · guarded" : s.anyoneHome ? `Away · ${watchLine(s)}` : "Away · shelter unguarded"
  }</p>
  ${survivorChip(s.character)}
</header>
${resourceStrip(
  RESOURCES.map((k) => {
    const v = s.stock[k];
    return { k, value: String(Math.floor(v)), state: v <= 0 ? "empty" : v < LOW ? "low" : "ok", live: { num: v, rate: net[k], at: now } };
  }),
)}
${issues.length ? html`<section class="sh-attention has-issues" aria-label="Needs attention"><ul>${issues.map(i=>html`<li class="${i.hours===0?'is-out':''}">${i.text}</li>`)}</ul></section>` : ''}
${ctx.error ? html`<p class="sh-result tone-bad" role="alert">${ctx.error}</p>` : ""}
${actionBar(s, now)}
${s.stock.power <= 0 ? html`<p class="sh-blackout">No power. The lights are out.</p>` : ""}
${gateLine("At your gate:", ctx.visitors ?? [])}
${ctx.inviteToby && !away ? html`<p class="sh-quest"><a href="#info-quarters">Toby is waiting for your answer.</a> Ask him to stay from the living quarters.</p>` : ""}
${renderScene(model, hotspots(infos), stageState(model, "own"), sayings(ownLook(s, now)), ctx.visitors ?? [], s.crew.some((m) => m.who === "toby" && !m.journey) ? { toby: tobySays(ownLook(s, now)) } : {})}
${readout(infos, ctx.open)}
${buildRow(s)}
${survivorPanel(s, now, ctx.survivor)}
${stashPanel(s)}
<section id="talk"><a href="/social?channel=shelter:${s.id}">Messages</a> · <a href="/shelters/${s.id}">Shelter address</a></section>
</div>`;
}

const clockUntil = (until: number, now: number) => clock(until - now);

function resultBanner(p: PublicShelter, r: InteractionView): H {
  const text = r.kind === 'help' ? `Reinforcement deployed to ${p.name}.` : r.success ? `Raid won. Taken: ${r.amount} ${r.resource}.` : 'Raid repelled. No supplies taken.';
  return html`<section class="sh-result" role="status"><p>${text} <a href="/activity">Activity</a></p>
    ${r.report.length ? html`<details><summary>Battle report</summary><ol>${r.report.map(line=>html`<li>${line}</li>`)}</ol></details>` : ''}</section>`;
}

function moves(p: PublicShelter, o: Options, requestIds: { steal: string; help: string }): H {
  const select=(id:string)=>html`<label for="${id}">Character</label><select id="${id}" name="who">${o.available.map(m=>html`<option value="${m.who}">${m.name}</option>`)}</select>`;
  return html`<section class="sh-moves" aria-label="What you can do">
  <form method="post" action="/shelters/${p.id}/steal" class="sh-move">
    <h2>Raid</h2>
    <p>Door: ${p.doorCondition}. ${p.guarded ? 'Defenders are present.' : 'No defenders inside.'}</p>
    <p class="sh-move-meta">Break the door, then fight the defenders. Equipment stays yours; injuries, ammunition and healing costs remain.</p>
    ${select('raid-character')}
    <fieldset ${o.steal.ok ? '' : raw('disabled')}><legend>Take</legend>
    ${STEALABLE.map((k,i)=>html`<label class="sh-pick"><input type="radio" name="resource" value="${k}" ${i===0?raw('checked'):''}><span>${LABEL[k]}</span><small>${p.bands[k]}</small></label>`)}</fieldset>
    <input type="hidden" name="request_id" value="${requestIds.steal}">
    ${o.steal.ok ? html`<button class="sh-move-go is-raid">Raid ${p.owner}</button>` : html`<p class="sh-move-why">${o.steal.reason}</p>`}
    <p class="sh-move-note">Returns in a minute. Take up to ${RAID.maxSteal}; always leave ${RAID.protectedMin}. Every raid grants the target ${RAID.shieldAfterRaidMs/60000} minutes of protection.</p>
  </form>
  <form method="post" action="/shelters/${p.id}/help" class="sh-move">
    <h2>Reinforce</h2>
    <p>Send one character to defend this shelter with their own equipment and supplies.</p>
    <p class="sh-move-meta">Until recalled or dismissed, they cannot work at home or explore. One visiting defender per shelter.</p>
    ${select('reinforce-character')}
    <input type="hidden" name="request_id" value="${requestIds.help}">
    ${o.help.ok ? html`<button class="sh-move-go">Reinforce ${p.owner}</button>` : html`<p class="sh-move-why">${o.help.reason}</p>`}
  </form>
</section>`;
}

export function visitScreen(
  p: PublicShelter,
  o: Options,
  ctx: {
    now: number;
    requestIds: { steal: string; help: string };
    viewerId: number;
    visitors: Visitors;
    result?: InteractionView | null;
    error?: string;
  } & TalkCtx,
): H {
  const model = visitModel(p);
  const infos = visitInfo(p);
  return html`<div class="sh" data-watch-shelter="${p.id}" data-scene-shelter="${p.id}" data-me="${ctx.viewerId}">
<p class="sh-back"><a href="/world">← Back to the world</a></p>
<header class="sh-head">
  <p class="sh-kicker">Another survivor's shelter</p>
  <img class="sh-face" src="${portraitSrc(p.portrait)}" alt="" width="56" height="56">
  <h1>${p.name}</h1>
  <p class="sh-status ${p.home ? "is-home" : "is-away"}" data-live-status><span class="sh-led" aria-hidden="true"></span><span data-live-status-text>${
    p.home ? `${p.owner} is home` : `${p.owner} is out · unguarded`
  }</span></p>
  <p class="sh-chip" data-live-security>Security: ${p.security}</p>
  ${p.shieldedUntil ? html`<p class="sh-chip is-shield">Guard up · <span data-until-quiet="${p.shieldedUntil}">${clockUntil(p.shieldedUntil, ctx.now)}</span></p>` : ""}
</header>
<p class="sh-visit-note">${p.home ? html`${p.owner} let you in.` : "The vault door is sealed, so you wait outside."} Visiting takes no time and doesn't leave your own shelter unguarded.</p>
${ctx.result ? resultBanner(p, ctx.result) : ""}
${ctx.error ? html`<p class="sh-result tone-bad" role="alert">${ctx.error}</p>` : ""}
${resourceStrip(
  RESOURCES.map((k) => ({ k, value: p.bands[k], state: p.bands[k] === "Empty" ? "empty" : p.bands[k] === "Scarce" ? "low" : "ok" })),
)}
${moves(p, o, ctx.requestIds)}
${hint}
${gateLine("Also at their gate:", ctx.visitors)}
${renderScene(model, hotspots(infos), stageState(model, "visit"), sayings(visitLook(p)), ctx.visitors)}
${readout(infos)}
<section id="talk"><a href="/social?channel=shelter:${p.id}">Open shelter messages</a></section>
</div>`;
}
