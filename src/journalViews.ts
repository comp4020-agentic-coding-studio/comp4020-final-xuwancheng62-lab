import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { destination } from "./game/world.ts";
import {
  HOME, STATUS_TEXT, connectionsFor, defaultFocus, fragment, leadsOpenedBy, LOOK_AROUND, openLeads, openQuestions, placeStatus,
  type FragmentId,
} from "./game/stories.ts";
import { SETS, recordsOf } from "./game/collections.ts";
import type { Found } from "./stories.ts";
import type { Progress } from "./game/quests.ts";
import type { ActiveJourney } from "./shelter.ts";

// The journal and the "What to look for" choice. The journal shows what a
// record is and what it says, and the facts two records share; it never says
// what they mean.

type H = HtmlEscapedString | Promise<HtmlEscapedString>;

const placeName = (id: string): string => (id === HOME ? "Your shelter" : destination(id)?.name ?? id);
const titleOf = (id: FragmentId): string => fragment(id)!.title;

// On a destination card: where your search there stands, and, if you have a
// lead there, which to follow. Inside the depart form; a lead that takes
// something with you says so.
export function recordChoice(place: string, found: readonly FragmentId[], away: boolean): H {
  const status = placeStatus(found, place);
  if (!status) return html``;
  const leads = openLeads(found, place);
  if (status !== "leads" || away) {
    return html`<p class="rec-status">${status === "leads" ? `Leads here: ${leads.map((l) => l.lead.label).join(", ")}.` : STATUS_TEXT[status]}</p>`;
  }
  const pick = defaultFocus(found, place);
  const option = (value: string, label: string, note: string, summary = label) =>
    html`<label class="rec-opt"><input type="radio" name="focus" value="${value}" data-search-label="${summary}" ${value === pick ? raw("checked") : ""}><span>${label}<small>${note}</small></span></label>`;
  return html`<fieldset class="rec-choice">
  <legend>What to look for</legend>
  ${leads.map((l) => {
    const why = [
      l.lead.cost ? `Takes ${l.lead.cost.scrap} scrap with you` : "",
      fragment(l.lead.fragment)?.calm ? "No fight on this trip: someone calls the dogs off" : "",
      `from “${titleOf(l.by)}”`,
    ].filter(Boolean).join(" · ");
    const summary = `${l.lead.label}${l.lead.cost ? ` · ${l.lead.cost.scrap} scrap` : ''}${fragment(l.lead.fragment)?.calm ? ' · No fight' : ''}`;
    return option(l.lead.id, l.lead.label, why[0].toUpperCase() + why.slice(1), summary);
  })}
  ${option(LOOK_AROUND, "Look around", "Wherever you haven't searched")}
  <p class="rec-note">Only changes which record you find. ${leads.some((l) => l.lead.cost || fragment(l.lead.fragment)?.calm) ? "Time away stays the same; supplies and danger too, unless it says otherwise." : "Supplies, danger and time away stay the same."}</p>
</fieldset>`;
}

// On the trip page, once you've arrived.
export const tripRecord = (j: ActiveJourney): H =>
  j.found
    ? html`<p class="rec-found">You found a record here: <a href="/journal?tab=clues&record=${j.found.id}#rec-${j.found.id}">${j.found.title}</a>. It's in your journal, and stays there whatever happens on the way back.</p>`
    : html``;

const MARK = { done: "✓", current: "●", locked: "○" } as const;
const NEXT_HINT: Record<string,string> = {
  'signed-t': 'Collect the remaining clues signed T.',
  'word-for-t': 'Leave word in the Workshop’s forwarding tin, then check for a reply.',
  'hold-for-him': 'Ask the Kell walkers at the Workshop to bring back the letters.',
  'underpass': 'Take Kerry’s letters to the underpass at the Creature Nest.',
  'screens': 'Help Toby clear the Reservoir intake. Bring scrap for his rake.',
  'bench': 'Invite Toby to stay at your shelter.',
  'lower-deck': 'Gather a party and clear The Lower Deck.',
};
const STATE_TEXT = { done: "Done", current: "To do", locked: "Not yet" } as const;

// A quest's steps: done, the ones to work on with where to go, and the rest
// with what they're waiting on. The last step's action sits on the step.
function questSection(quests: readonly Progress[], completed = false): H {
  return html`<section id="${completed?'jr-completed':'jr-tasks'}" aria-labelledby="${completed?'jr-completed-h':'jr-t-h'}">
  <h2 id="${completed?'jr-completed-h':'jr-t-h'}">${completed?'Completed':'Active tasks'}</h2>
  ${quests.map((p,i) => html`<details ${!completed && i===0 ? raw("open") : ""} class="card qs-quest${p.complete ? " is-complete" : ""}" data-quest="${p.quest.id}">
    <summary><h3>${p.quest.title} <span class="qs-count">${p.complete ? "Done" : `${p.done} of ${p.steps.length} steps`}</span></h3></summary>
    <button type="button" class="ui-action js-only" data-track-quest="${p.quest.id}">Track this task</button>
    <progress max="${p.steps.length}" value="${p.done}" aria-label="Quest progress"></progress>
    ${p.steps.filter(x=>x.state==='current').slice(0,1).map(x=>html`<div class="qs-next"><small>CURRENT OBJECTIVE</small><strong>${x.step.title}</strong><p>${NEXT_HINT[x.step.id]??x.step.hint}</p>${x.step.id==='send-helen'?html`<form method="post" action="/quests/undelivered/send"><button>Send the sealed letter to Ruth</button></form>`:x.step.id==='bench'?html`<form method="post" action="/quests/${p.quest.id}/invite"><button>Ask Toby to stay</button></form>`:html`<a class="jr-button" href="${x.step.href??(x.step.id==='signed-t'?'/collection':x.step.id==='lower-deck'?'/expeditions':x.step.id==='screens'?'/world#dest-reservoir':x.step.id==='underpass'?'/world#dest-nest':'/world#dest-workshop')}">${x.step.id==='signed-t'?'View collection':x.step.id==='lower-deck'?'Find a party':'Go to location'} →</a>`}</div>`)}
    <details class="qs-history"><summary>All steps · ${p.done}/${p.steps.length}</summary><ol class="qs-steps">
      ${p.steps.map(({ step, state, count }) => {
        const needs = (step.needs ?? []).map((n) => p.steps.find((x) => x.step.id === n)!).filter((x) => x.state !== "done").map((x) => x.step.title);
        return html`<li class="qs-step is-${state}" data-step="${step.id}" data-state="${state}">
        <span class="qs-mark" aria-hidden="true">${MARK[state]}</span>
        <span><strong>${step.title}</strong><span class="sr-only"> (${STATE_TEXT[state]})</span>${count && state !== "done" ? html` <span class="qs-count">${count.got} of ${count.of}</span>` : ""}
        ${state === "current" ? html`<br><span class="jr-muted">${step.hint}</span>` : ""}
        ${state === "locked" && needs.length ? html`<br><span class="jr-muted">After ${needs.join(" and ")}.</span>` : ""}
        ${state === "current" && step.id === "bench" ? html`<form method="post" action="/quests/${p.quest.id}/invite" class="qs-act"><button class="button">Ask Toby to stay</button></form>` : ""}</span>
      </li>`;
      })}
    </ol></details>
    ${p.complete ? html`<p class="jr-muted">${p.quest.after}</p>` : ""}
  </details>`)}
</section>`;
}

export function journalPage(records: readonly Found[], quests: readonly Progress[] = [], tab = "tasks", selected = ""): H {
  const found = records.map(r=>r.id);
  const leads = openLeads(found), questions = openQuestions(found), links = connectionsFor(found);
  const storyFor:Record<string,string> = {'last-reply':'toby','empty-is-empty':'mags','day-fifteen':'ruth','undelivered':'helen'};
  quests = quests.filter(q=>q.done>0 || q.steps.some(s=>(s.count?.got??0)>0) || SETS.find(s=>s.id===storyFor[q.quest.id])?.cards.some(c=>recordsOf(c).some(id=>found.includes(id))) || (q.quest.id==='undelivered' && found.some(id=>['day-140','council-bulletin'].includes(id))));
  const clues = tab === "clues" || Boolean(selected);
  const ref = (id: FragmentId) => `/journal?tab=clues&record=${id}#rec-${id}`;
  const evidence = SETS.flatMap(s=>s.cards.flatMap(c=>c.evidence));
  return html`<div class="journal"><header class="jr-heading"><div><p class="jr-kicker">FIELD NOTES</p><h1>Journal</h1></div><span>${found.length} records recovered</span></header>
  <nav class="jr-tabs" aria-label="Journal sections"><a href="/journal" ${!clues?raw('aria-current="page"'):''}>Tasks <span>${quests.filter(q=>!q.complete).length}</span></a><a href="/journal?tab=clues" ${clues?raw('aria-current="page"'):''}>Clues <span>${found.length}</span></a></nav>
  ${!clues?html`${questSection(quests.filter(q=>!q.complete))}${quests.some(q=>q.complete)?html`<details class="jr-archive"><summary>Completed tasks · ${quests.filter(q=>q.complete).length}</summary>${questSection(quests.filter(q=>q.complete), true)}</details>`:''}${!quests.some(q=>!q.complete)?html`<div class="card jr-empty"><h2>Your next step</h2><p>Explore nearby ruins to discover a story.</p><a class="jr-button" href="/world#dest-supermarket">Explore the Supermarket →</a></div>`:''}`:html`
  ${leads.length?html`<section class="jr-leads"><h2>Follow a lead</h2><div class="jr-grid">${leads.map(l=>html`<a class="jr-lead" href="/world#dest-${l.lead.place}"><small>${placeName(l.lead.place)}</small><strong>${l.lead.label}</strong><span>Explore →</span></a>`)}</div></section>`:''}
  <section id="jr-records"><h2>Recovered clues</h2>${!found.length?html`<div class="jr-empty"><span aria-hidden="true">✉</span><h3>Your notebook starts here</h3><p>Search the wasteland for objects, letters and traces of life.</p><a class="jr-button" href="/world#dest-supermarket">Explore the Supermarket →</a></div>`:''}
  <div class="jr-grid">${records.map(r=>{const f=fragment(r.id)!;const art=evidence.find(e=>e.record===r.id&&e.art);const mine=links.filter(c=>c.a===f.id||c.b===f.id);return html`<details class="jr-evidence" id="rec-${f.id}" ${selected===f.id?raw('open'):''}><summary>${art?html`<img src="${art.art}" alt="" loading="lazy">`:html`<span class="jr-paper" aria-hidden="true">✉</span>`}<span><small>${placeName(f.place)}</small><strong>${f.title}</strong><span class="jr-read">Read record ↗</span></span></summary><div class="jr-document"><p class="jr-label">What you see</p><p>${f.seen}</p><blockquote class="jr-text">${f.says.map(line=>html`<p>${line}</p>`)}</blockquote><p class="jr-signature">Signed: ${f.signed}</p>${mine.length?html`<h4>Related records</h4>${mine.map(c=>{const id=c.a===f.id?c.b:c.a;return html`<p><a href="${ref(id)}">${titleOf(id)}</a> · ${c.text}</p>`;})}`:''}</div></details>`;})}</div></section>
  <details class="jr-archive"><summary>Open questions · ${questions.length}</summary>${questions.map(q=>html`<p>${q.text}</p><div class="jr-refs">${q.about.filter(id=>found.includes(id)).map(id=>html`<a href="${ref(id)}">${titleOf(id)}</a>`)}</div>`)}</details>
  <details class="jr-archive"><summary>People & places</summary>${(['people','places'] as const).map(key=>html`<h3>${key}</h3>${[...new Set(found.flatMap(id=>fragment(id)![key]))].map(name=>html`<details><summary>${name}</summary><div class="jr-refs">${found.filter(id=>fragment(id)![key].includes(name)).map(id=>html`<a href="${ref(id)}">${titleOf(id)}</a>`)}</div></details>`)}`)}</details>`}</div>`;
}
