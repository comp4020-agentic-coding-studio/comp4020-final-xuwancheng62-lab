import { currentRates } from "./game/resources.ts";
import { html, raw } from "hono/html";
import { BASE, BASE_RECIPES, SUPPLIES } from "./game/config.ts";
import { capacity, FACILITIES, gateMax, gateReduction, tierIndex, type FacilityId } from "./game/base.ts";
import type { ShelterView } from "./shelter.ts";
const title=["Sealed room","Salvaged","Reinforced","Industrial"];
export function basePanel(s:ShelterView) {
  const form=(kind:string,action:string,expected:string,label:string,disabled=false)=>html`<form method="post" action="/base/facility"><input type="hidden" name="kind" value="${kind}"><input type="hidden" name="action" value="${action}"><input type="hidden" name="expected" value="${expected}"><button ${disabled?raw("disabled"):""}>${label}</button></form>`;
  const rates=currentRates(s.stock,s.growing,s.residents,s.base,s.stash.supplies.arrow??0);
  const status=(k:FacilityId)=>{
    const f=s.base[k],i=tierIndex(s.base,k);
    if(!f.tier) return "Unbuilt";
    if(k==="gate") return `${Math.floor(s.gateHp)} / ${gateMax(s.base)} door HP · ${Math.round(gateReduction(s.base,s.gateHp)*100)}% less raid loot`;
    if(k==="storage") return `Automatic production limit: ${capacity(s.base)} per resource`;
    if(!f.enabled) return "Paused · no operating costs";
    const active=k==="generator"?rates.generator:k==="purifier"?rates.purifier:k==="farm"?rates.farm:k==="recycler"?rates.recycling:rates.workshop;
    if(!active) return k==="workshop" && (s.stash.supplies.arrow??0)+BASE.arrowBatch>BASE.arrowStockLimit?"Standby · arrow stock replenished":"Standby · waiting for inputs or storage space";
    if(k==="generator") return `${BASE.generatorFuel[i]} scrap → ${BASE.generatorOutput[i]} power /h`;
    if(k==="purifier") return `${BASE.purifierPower[i]} power → ${BASE.purifierOutput[i]} water /h`;
    if(k==="farm") return `${BASE.farmPower[i]} power + ${BASE.farmWater[i]} water → ${BASE.farmFood[i]} food /h`;
    if(k==="recycler") return `${BASE.recyclerPower[i]} power → ${BASE.recyclerScrap[i]} scrap /h`;
    return `${BASE.arrowBatch} arrows / ${BASE.arrowMinutes[i]} min · ${BASE.arrowScrap} scrap/batch + ${BASE.workshopPower[i]} power/h`;
  };
  return html`<section class="base" id="base" aria-labelledby="base-h"><header class="base-heading"><div><p class="sh-kicker">Build a home</p><h2 id="base-h">Rooms & facilities</h2></div><a href="#stash">Materials in stash ↓</a></header>
  <p>Build new rooms and improve their equipment. Production continues while you are away; pause a facility to save its inputs. Missing inputs or full stores stop automatic output.</p>
  <div class="base-grid">${(Object.keys(FACILITIES) as FacilityId[]).map(k=>{
    const d=FACILITIES[k],f=s.base[k],next=BASE.costs[f.tier];
    const art=["entrance","workshop","cultivation","recycling"].includes(d.art)?`/static/img/base/${d.art}.webp`:`/static/img/shelter/${d.art}.jpg`;
    return html`<article class="base-room tier-${f.tier} ${f.enabled?"":"is-paused"}" id="base-${k}" data-facility="${k}" data-tier="${f.tier}">
    <div class="base-art ${k==="gate"?"base-art-gate":""}" ${!f.tier?raw('aria-label="Sealed expansion room"'):""}><img src="${art}" alt="${f.tier?d.room:""}" width="960" height="640" loading="lazy">
    ${!f.tier?html`<div class="base-seal"><span>SEALED</span><small>Excavate & fit out</small></div>`:""}
    ${k==="gate" && f.tier>=2?html`<svg class="base-door-upgrade" viewBox="0 0 960 640" aria-label="Reinforced vault door"><rect x="300" y="340" width="355" height="25" rx="6"/><circle cx="320" cy="353" r="6"/><circle cx="635" cy="353" r="6"/>${f.tier===3?html`<rect x="300" y="245" width="355" height="25" rx="6"/><path d="M290 160H670V440"/>`:""}</svg>`:""}
    ${f.tier && ["generator","purifier","storage"].includes(k)?html`<div class="base-addons"><img src="/static/img/shelter/${k==="storage"?"shelf":k}.webp" alt="" width="130" height="100">${f.tier>=2?html`<img src="/static/img/shelter/${k==="storage"?"shelf":k}.webp" alt="" width="130" height="100">`:""}${f.tier===3?html`<img src="/static/img/shelter/${k==="storage"?"crate":k}.webp" alt="" width="130" height="100">`:""}</div>`:""}
    ${f.tier>=2 && ["farm","recycler"].includes(k)?html`<div class="base-addons"><img src="/static/img/shelter/${k==="farm"?"planter":"crate"}.webp" alt="" width="130" height="100">${f.tier===3?html`<img src="/static/img/shelter/${k==="farm"?"beans-ready":"crate"}.webp" alt="" width="130" height="100">`:""}</div>`:""}
    ${k==="workshop" && f.tier>=2?html`<svg class="base-workshop-upgrade" viewBox="0 0 960 640" aria-label="Additional workbench equipment"><rect x="80" y="380" width="250" height="80" rx="8"/><path d="M100 460v70M310 460v70M100 410h210"/>${f.tier===3?html`<rect x="80" y="240" width="250" height="90" rx="8"/><path d="M115 260v50M155 260v50M195 260v50M235 260v50M275 260v50"/>`:""}</svg>`:""}
    ${f.tier>=2?html`<div class="base-reinforcement" aria-hidden="true"></div>`:""}
    <span class="base-tier">${title[f.tier]}${f.tier?` · Tier ${f.tier}`:""}</span>
    ${f.tier && !f.enabled?html`<span class="base-paused">Paused</span>`:""}</div>
    <div class="base-controls"><h3>${d.name}</h3><p class="base-rate">${status(k)}</p><small>${d.description}</small>
    <div class="base-actions">${f.tier<BASE.maxTier?form(k,"upgrade",String(f.tier),`${f.tier?"Upgrade":"Build room"} · ${next} scrap`,!s.anyoneHome || s.stock.scrap<next):html`<span class="base-max">Fully upgraded</span>`}
    ${f.tier && !["gate","storage"].includes(k)?form(k,"toggle",f.enabled?"off":"on",f.enabled?"Pause":"Resume",!s.anyoneHome):""}
    ${k==="gate"?form(k,"repair","",`Repair +${BASE.repairHp} HP · ${BASE.repairScrap} scrap`,!s.anyoneHome||s.gateHp>=gateMax(s.base)||s.stock.scrap<BASE.repairScrap):""}</div>
    ${k==="gate"?html`<details><summary>Door defence</summary><p>Door condition reduces protection. Raiders damage the door on each attempt. From tier 2, roaming scavengers may test it every 6 hours; someone home halves door damage. Offline sieges do not stack. Repair before it breaks.</p></details>`:""}
    </div></article>`;
  })}</div>
  ${s.base.workshop.tier?html`<section class="base-crafting" aria-labelledby="craft-h"><h3 id="craft-h">Workbench</h3><p>Craft from the shelter stash. Workshop upgrades unlock better recipes.</p><div class="base-recipes">${Object.entries(BASE_RECIPES).map(([id,r])=>html`<form method="post" action="/base/craft"><input type="hidden" name="recipe" value="${id}"><strong>${r.name}${"count" in r?` ×${r.count}`:""}</strong><small>${r.scrap} scrap + ${r.amount} ${SUPPLIES[r.material].name.toLowerCase()} · Tier ${r.tier}</small><button ${s.base.workshop.tier<r.tier||!s.anyoneHome||!s.base.workshop.enabled||s.stock.power<=0||s.stock.scrap<r.scrap||(s.stash.supplies[r.material]??0)<r.amount?raw("disabled"):""}>Craft</button></form>`)}</div></section>`:""}
  </section>`;
}
