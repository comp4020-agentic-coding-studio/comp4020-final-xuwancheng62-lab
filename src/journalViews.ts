import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { destination } from "./game/world.ts";
import {
  HOME, STATUS_TEXT, connectionsFor, defaultFocus, fragment, leadsOpenedBy, LOOK_AROUND, openLeads, openQuestions, placeStatus,
  type FragmentId,
} from "./game/stories.ts";
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
    ? html`<p class="rec-found">You found a record here: <a href="/journal#rec-${j.found.id}">${j.found.title}</a>. It's in your journal, and stays there whatever happens on the way back.</p>`
    : html``;

const MARK = { done: "✓", current: "●", locked: "○" } as const;
const STATE_TEXT = { done: "Done", current: "To do", locked: "Not yet" } as const;

// A quest's steps: done, the ones to work on with where to go, and the rest
// with what they're waiting on. The last step's action sits on the step.
function questSection(quests: readonly Progress[]): H {
  return html`<section id="jr-tasks" aria-labelledby="jr-t-h">
  <h2 id="jr-t-h">Tasks</h2>
  ${quests.map((p) => html`<article class="card qs-quest${p.complete ? " is-complete" : ""}" data-quest="${p.quest.id}">
    <h3>${p.quest.title} <span class="qs-count">${p.complete ? "Done" : `${p.done} of ${p.steps.length} steps`}</span></h3>
    <ol class="qs-steps">
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
    </ol>
    ${p.complete ? html`<p class="jr-muted">${p.quest.after}</p>` : ""}
  </article>`)}
</section>`;
}

export function journalPage(records: readonly Found[], quests: readonly Progress[] = []): H {
  const found = records.map((r) => r.id);
  if (!found.length) {
    return html`<h1>Journal</h1>
<p class="lede">Records people left behind turn up as you search the wasteland. Whatever you find stays here, even if a trip goes badly.</p>
<p class="banner">Nothing yet. The <a href="/world#dest-supermarket">Abandoned Supermarket</a> is the closest place to start.</p>
${quests.length ? questSection(quests) : ""}`;
  }
  const leads = openLeads(found);
  const questions = openQuestions(found);
  const links = connectionsFor(found);
  const places = [...new Set(records.map((r) => fragment(r.id)!.place))];
  const mentions = (key: "people" | "places") => {
    const m = new Map<string, FragmentId[]>();
    for (const id of found) for (const n of fragment(id)![key]) m.set(n, [...(m.get(n) ?? []), id]);
    return [...m.entries()];
  };
  const refs = (ids: readonly FragmentId[]) => ids.map((id, i) => html`${i ? ", " : ""}<a href="#rec-${id}">${titleOf(id)}</a>`);
  return html`<h1>Journal</h1>
<p class="lede">What you've found, as you found it. It stays with you whatever happens out there. Connections only note what two records have in common.</p>
<nav class="jr-toc" aria-label="Journal sections">${quests.length ? html`<a href="#jr-tasks">Tasks</a>` : ""}<a href="#jr-records">Records (${found.length})</a>${leads.length ? html`<a href="#jr-leads">Leads (${leads.length})</a>` : ""}<a href="#jr-questions">Questions (${questions.length})</a><a href="#jr-names">People and places</a></nav>
${quests.length ? questSection(quests) : ""}
${leads.length
    ? html`<section id="jr-leads" aria-labelledby="jr-leads-h">
  <h2 id="jr-leads-h">Leads</h2>
  <ul class="jr-list">
    ${leads.map((l) => html`<li><strong>${l.lead.label}</strong> · <a href="/world#dest-${l.lead.place}">${placeName(l.lead.place)}</a><br><span class="jr-muted">From <a href="#rec-${l.by}">${titleOf(l.by)}</a>: ${l.lead.from[l.by]}</span></li>`)}
  </ul>
</section>`
    : ""}
<section id="jr-questions" aria-labelledby="jr-q-h">
  <h2 id="jr-q-h">Open questions</h2>
  ${questions.length
    ? html`<ul class="jr-list">${questions.map((q) => {
        const seen = q.about.filter((f) => found.includes(f));
        return html`<li>${q.text}<br><span class="jr-muted">Records that mention it: ${refs(seen)}</span></li>`;
      })}</ul>`
    : html`<p class="jr-muted">None yet.</p>`}
</section>
<section id="jr-records" aria-labelledby="jr-r-h">
  <h2 id="jr-r-h">Records</h2>
  ${places.map((p) => html`<h3 class="jr-place">${placeName(p)}</h3>
  ${records.filter((r) => fragment(r.id)!.place === p).map((r) => {
    const f = fragment(r.id)!;
    const mine = links.filter((c) => c.a === f.id || c.b === f.id);
    const opened = leadsOpenedBy(f.id);
    return html`<article class="card jr-rec" id="rec-${f.id}">
    <h4>${f.title}</h4>
    <p class="jr-label">What you see</p>
    <p>${f.seen}</p>
    <p class="jr-label">What it says</p>
    <blockquote class="jr-text">${f.says.map((line) => html`<p>${line}</p>`)}</blockquote>
    <p class="jr-muted">Signed: ${f.signed}</p>
    ${mine.length
      ? html`<p class="jr-label">In common with</p><ul class="jr-list">${mine.map((c) => html`<li><a href="#rec-${c.a === f.id ? c.b : c.a}">${titleOf(c.a === f.id ? c.b : c.a)}</a>: ${c.text}</li>`)}</ul>`
      : ""}
    ${opened.length ? html`<p class="jr-muted">Pointed you to: ${opened.map((o, i) => html`${i ? ", " : ""}${o.lead.label}`)}</p>` : ""}
  </article>`;
  })}`)}
</section>
<section id="jr-names" aria-labelledby="jr-n-h">
  <h2 id="jr-n-h">People and places</h2>
  <p class="jr-muted">Names exactly as the records write them.</p>
  <h3 class="jr-place">People</h3>
  <ul class="jr-list">${mentions("people").map(([n, ids]) => html`<li><strong>${n}</strong> · ${refs(ids)}</li>`)}</ul>
  <h3 class="jr-place">Places</h3>
  <ul class="jr-list">${mentions("places").map(([n, ids]) => html`<li><strong>${n}</strong> · ${refs(ids)}</li>`)}</ul>
</section>`;
}
