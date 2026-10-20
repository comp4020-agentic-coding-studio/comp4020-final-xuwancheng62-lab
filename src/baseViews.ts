import { html, raw } from "hono/html";
import { BASE, BASE_BUILD_COSTS, BASE_RECIPES, GEAR, SUPPLIES, type BaseCost, type SupplyKind } from "./game/config.ts";
import { capacity, FACILITIES, gateMax, gateReduction, tierIndex, type FacilityId } from "./game/base.ts";
import { currentRates } from "./game/resources.ts";
import type { ShelterView } from "./shelter.ts";
import type { ItemKey } from "./scene.ts";
import { buildScrap } from "./base.ts";
// What this shelter would actually pay right now, with any resident's cut.
const priced=(s:ShelterView,c:BaseCost):BaseCost => ({...c,scrap:buildScrap(s,c.scrap)});
const cut=(s:ShelterView,c:BaseCost) => buildScrap(s,c.scrap)<c.scrap?` (was ${c.scrap} scrap)`:"";
export const facilityKey=(kind:string):ItemKey => kind==="gate"?"hatch":kind==="storage"?"food":["generator","purifier","workshop","farm","recycler"].includes(kind)?kind as ItemKey:"scrap";
export const costText=(cost:BaseCost) => [cost.scrap?`${cost.scrap} scrap`:"",cost.water?`${cost.water} water`:"",...Object.entries(cost.materials??{}).map(([k,n])=>`${n} ${SUPPLIES[k as SupplyKind].name.toLowerCase()}`)].filter(Boolean).join(" + ");
const affordable=(s:ShelterView,c:BaseCost) => s.stock.scrap>=c.scrap && s.stock.water>=(c.water??0) && Object.entries(c.materials??{}).every(([k,n])=>(s.stash.supplies[k as SupplyKind]??0)>=n);
function action(kind:string,op:string,expected:string,label:string,disabled=false) {
 return html`<form method="post" action="/base/facility"><input type="hidden" name="kind" value="${kind}"><input type="hidden" name="action" value="${op}"><input type="hidden" name="expected" value="${expected}"><button ${disabled?raw("disabled"):""}>${label}</button></form>`;
}
export function facilityStatus(s:ShelterView,k:FacilityId):string {
 const f=s.base[k],i=tierIndex(s.base,k),rates=currentRates(s.stock,s.growing,s.residents,s.base,s.stash.supplies.arrow??0);
 if(!f.tier)return "Not built";
 if(k==="gate")return `${Math.floor(s.gateHp)} / ${gateMax(s.base)} door HP · ${Math.round(gateReduction(s.base,s.gateHp)*100)}% less raid loot`;
 if(k==="storage")return `Production storage: ${capacity(s.base)} per resource`;
 if(!f.enabled)return "Paused · no operating costs";
 const active=k==="generator"?rates.generator:k==="purifier"?rates.purifier:k==="farm"?rates.farm:k==="recycler"?rates.recycling:rates.workshop;
 if(!active)return "Standby · waiting for inputs or storage space";
 if(k==="generator")return `${BASE.generatorFuel[i]} scrap → ${BASE.generatorOutput[i]} power /h`;
 if(k==="purifier")return `${BASE.purifierPower[i]} power → ${BASE.purifierOutput[i]} water /h`;
 if(k==="farm")return `${BASE.farmPower[i]} power + ${BASE.farmWater[i]} water → ${BASE.farmFood[i]} food /h`;
 if(k==="recycler")return `${BASE.recyclerPower[i]} power → ${BASE.recyclerScrap[i]} renewable scrap /h`;
 return `${BASE.arrowBatch} arrows / ${BASE.arrowMinutes[i]} min · ${BASE.arrowScrap} scrap/batch + ${BASE.workshopPower[i]} power/h`;
}
export function facilityControls(s:ShelterView,k:FacilityId) {
 const f=s.base[k],full=BASE_BUILD_COSTS[k][f.tier],cost=full&&priced(s,full),repair=buildScrap(s,BASE.repairScrap);
 if(!f.tier)return html``;
 return html`<section class="facility-controls" data-facility="${k}" data-tier="${f.tier}" aria-label="${FACILITIES[k].name} controls">
 <p class="facility-tier">Tier ${f.tier} / ${BASE.maxTier} · ${facilityStatus(s,k)}</p>
 <div class="base-actions">${f.tier<BASE.maxTier?action(k,"upgrade",String(f.tier),`Upgrade · ${costText(cost)}${cut(s,full)}`,!s.anyoneHome||!affordable(s,cost)):html`<span class="base-max">Fully upgraded</span>`}
 ${!["gate","storage"].includes(k)?action(k,"toggle",f.enabled?"off":"on",f.enabled?"Pause":"Resume",!s.anyoneHome):""}
 ${k==="gate"?action(k,"repair","",`Repair +${BASE.repairHp} HP · ${repair} scrap`,!s.anyoneHome||s.gateHp>=gateMax(s.base)||s.stock.scrap<repair):""}</div>
 ${k==="gate"?html`<p class="facility-note">Door condition affects protection. Creature probes cause damage; crew at home reduce it. Repair a damaged door.</p>`:""}
 ${k==="workshop"?crafting(s):""}
 </section>`;
}
function crafting(s:ShelterView) {
 return html`<details class="base-crafting"><summary>Craft equipment & supplies</summary><div class="base-recipes">${Object.entries(BASE_RECIPES).map(([id,r])=>html`<form method="post" action="/base/craft"><input type="hidden" name="recipe" value="${id}"><strong>${r.name}${"count" in r?` ×${r.count}`:""}</strong><small>${costText({scrap:r.scrap,materials:{[r.material]:r.amount}})} · Tier ${r.tier}</small><button ${s.base.workshop.tier<r.tier||!s.anyoneHome||!s.base.workshop.enabled||s.stock.power<=0||s.stock.scrap<r.scrap||(s.stash.supplies[r.material]??0)<r.amount?raw("disabled"):""}>Craft</button></form>`)}</div></details>`;
}
export function buildRow(s:ShelterView) {
 const unbuilt=(["workshop","farm","recycler"] as const).filter(k=>!s.base[k].tier);
 return html`<section class="base-build-row" id="base" aria-label="Expand shelter"><strong>Expand shelter</strong>${unbuilt.map(k=>{const c=priced(s,BASE_BUILD_COSTS[k][0]);return action(k,"upgrade","0",`Build ${FACILITIES[k].room.replace(" expansion","")} · ${costText(c)}${cut(s,BASE_BUILD_COSTS[k][0])}`,!s.anyoneHome||!affordable(s,c));})}${!unbuilt.length?html`<span>All rooms built · select equipment to upgrade</span>`:""}</section>`;
}
export function salvageControls(s:ShelterView) {
 return html`<p class="facility-note">Recover renewable scrap in the recycling room or bring back salvage from the Workshop. Spare equipment can also be dismantled.</p>${s.stash.gear.length?html`<details><summary>Recover spare equipment</summary><div class="base-recipes">${s.stash.gear.map(g=>html`<form method="post" action="/base/salvage"><input type="hidden" name="item" value="${g.id}"><strong>${GEAR[g.kind].name} · Lv ${g.level}</strong><button ${!s.anyoneHome?raw("disabled"):""}>Dismantle · +${BASE.salvageScrap[g.quality]+g.level*BASE.salvagePerLevel} scrap</button></form>`)}</div></details>`:""}`;
}
