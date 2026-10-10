import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { COLLECTION_XP } from "./game/config.ts";
import { isComplete, isUnlocked, panelArt, unlockedCount, type Basis, type CollectionSet } from "./game/collections.ts";
import { fragment, type FragmentId } from "./game/stories.ts";

// The Collection page and the comic a finished set unlocks. A card you
// haven't found shows only its back and number: no title, period or place.

type H = HtmlEscapedString | Promise<HtmlEscapedString>;

const BASIS: Record<Basis, string> = { record: "From the records", account: "Someone's account", unknown: "Not known" };

const sources = (ids: readonly FragmentId[], found: readonly FragmentId[]) =>
  ids.filter((id) => found.includes(id)).map((id, i) => html`${i ? ", " : ""}<a href="/journal#rec-${id}">${fragment(id)!.title}</a>`);

export function collectionPage(sets: readonly CollectionSet[], found: readonly FragmentId[], reward: (setId: string) => { xp: number } | null): H {
  return html`<h1>Collection</h1>
<p class="lede">Every record you find can complete a card. Cards stay yours whatever happens out there; they take no room and can't be lost.</p>
${sets.map((set) => {
  const got = unlockedCount(set, found);
  const done = isComplete(set, found);
  const paid = reward(set.id);
  const xp = COLLECTION_XP[set.id] ?? 0;
  return html`<section class="cl-set" aria-labelledby="cl-${set.id}">
  <div class="cl-head">
    <h2 id="cl-${set.id}">${got ? set.title : set.untitled}</h2>
    <p class="cl-progress"><span>${got} of ${set.cards.length} cards</span>
      <span class="cl-bar" role="progressbar" aria-label="Cards found" aria-valuemin="0" aria-valuemax="${set.cards.length}" aria-valuenow="${got}"><span style="width:${(got / set.cards.length) * 100}%"></span></span></p>
  </div>
  <ol class="cl-cards">
    ${set.cards.map((c) =>
      isUnlocked(c, found)
        ? html`<li class="cl-card is-front">
      <div class="cl-art"><img src="${panelArt(set.id, c.art)}" alt="${set.comic.panels.find((p) => p.n === c.art)?.scene ?? ""}" width="1280" height="800" loading="lazy"><span class="cl-n">${c.n}</span></div>
      <p class="cl-period">${c.period}</p>
      <h3>${c.title}</h3>
      <p>${c.front}</p>
      <p class="cl-sure"><strong>How sure:</strong> ${c.sure}</p>
      <p class="cl-from">From ${sources(c.unlockedBy, found)}</p>
    </li>`
        : html`<li class="cl-card is-back"><div class="cl-art" role="img" aria-label="Card ${c.n}, not found yet"><span class="cl-n">${c.n}</span></div><p class="cl-back-label">Not found yet</p></li>`,
    )}
  </ol>
  ${done
    ? html`<p class="cl-done"><a class="button" href="/collection/${set.id}/comic">Read “${set.comic.title}”</a> <span>${paid ? `+${paid.xp} XP received for completing the set.` : ""}</span></p>`
    : html`<p class="cl-locked">Find all ${set.cards.length} cards to unlock a ${set.comic.panels.length}-panel story${xp ? html` and <strong>+${xp} XP</strong>, once` : ""}.</p>`}
</section>`;
})}`;
}

export function comicPage(set: CollectionSet, found: readonly FragmentId[]): H {
  const panels = set.comic.panels;
  return html`<p class="cm-back"><a href="/collection">← Collection</a></p>
<h1>${set.comic.title}</h1>
<p class="lede">${set.title}'s story, as far as the records go. Each panel says what it rests on; where nothing does, it says so.</p>
<nav class="cm-index" aria-label="Panels">${panels.map((p) => html`<a href="#panel-${p.n}">${p.n}</a>`)}</nav>
<ol class="cm-panels">
  ${panels.map((p, i) => html`<li id="panel-${p.n}" class="cm-panel">
    <figure>
      <img class="cm-art" src="${panelArt(set.id, p.n)}" alt="${p.scene}" width="1280" height="800" ${i > 1 ? raw('loading="lazy"') : ""}>
      <figcaption>
        <p class="cm-caption">${p.caption}</p>
        <p class="cm-basis">${p.basis.map((b) => html`<span class="cm-tag is-${b}">${BASIS[b]}</span>`)}${p.sources.length
          ? p.sources.some((id) => found.includes(id))
            ? html` <span class="cm-src">${sources(p.sources, found)}</span>`
            : html` <span class="cm-src">a record you haven't found yet</span>`
          : ""}</p>
      </figcaption>
    </figure>
    <p class="cm-nav"><span>Panel ${p.n} of ${panels.length}</span>${i > 0 ? html`<a href="#panel-${p.n - 1}">Previous</a>` : ""}${i < panels.length - 1 ? html`<a href="#panel-${p.n + 1}">Next</a>` : html`<a href="#panel-1">Read again</a>`}</p>
  </li>`)}
</ol>`;
}

export function comicLocked(set: CollectionSet, found: readonly FragmentId[]): H {
  return html`<h1>Not yet</h1>
<p class="banner">This story opens once every card in the set is found. You have ${unlockedCount(set, found)} of ${set.cards.length}.</p>
<p><a href="/collection">Back to your collection</a></p>`;
}
