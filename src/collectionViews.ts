import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { COLLECTION_XP } from "./game/config.ts";
import { isUnlocked, panels, unlockedCount, type CollectionSet, type Line, type Panel } from "./game/collections.ts";
import { fragment, type FragmentId } from "./game/stories.ts";

// The Collection page and the comic a finished set unlocks. A card you
// haven't found shows only its back and number: no title, period or place.
// The comic is read a page at a time; each page is its own URL, so it works
// without JavaScript, and static/comic.js adds keys, swipes and a bookmark.

type H = HtmlEscapedString | Promise<HtmlEscapedString>;

const sources = (ids: readonly FragmentId[], found: readonly FragmentId[]) =>
  ids.filter((id) => found.includes(id)).map((id, i) => html`${i ? ", " : ""}<a href="/journal#rec-${id}">${fragment(id)!.title}</a>`);

const cardArt = (set: CollectionSet, n: number) => panels(set).find((p) => p.n === n);

export function collectionPage(sets: readonly CollectionSet[], found: readonly FragmentId[], reward: (setId: string) => { xp: number } | null): H {
  return html`<h1>Collection</h1>
<p class="lede">Every record you find can complete a card. Cards stay yours whatever happens out there; they take no room and can't be lost.</p>
${sets.map((set) => {
  const got = unlockedCount(set, found);
  const paid = reward(set.id);
  const open = Boolean(paid) || got === set.cards.length;
  const xp = COLLECTION_XP[set.id] ?? 0;
  return html`<section class="cl-set" aria-labelledby="cl-${set.id}">
  <div class="cl-head">
    <h2 id="cl-${set.id}">${got ? set.title : set.untitled}</h2>
    <p class="cl-progress"><span>${got} of ${set.cards.length} cards</span>
      <span class="cl-bar" role="progressbar" aria-label="Cards found" aria-valuemin="0" aria-valuemax="${set.cards.length}" aria-valuenow="${got}"><span style="width:${(got / set.cards.length) * 100}%"></span></span></p>
  </div>
  <ol class="cl-cards">
    ${set.cards.map((c) => {
      if (!isUnlocked(c, found)) return html`<li class="cl-card is-back"><div class="cl-art" role="img" aria-label="Card ${c.n}, not found yet"><span class="cl-n">${c.n}</span></div><p class="cl-back-label">Not found yet</p></li>`;
      const p = cardArt(set, c.art);
      return html`<li class="cl-card is-front">
      <div class="cl-art">${p?.art ? html`<img src="${p.art.src}" alt="${p.scene}" width="1280" height="800" loading="lazy">` : html`<span class="cl-pending">Art in progress</span>`}<span class="cl-n">${c.n}</span></div>
      <p class="cl-period">${c.period}</p>
      <h3>${c.title}</h3>
      <p>${c.front}</p>
      <p class="cl-sure"><strong>How sure:</strong> ${c.sure}</p>
      <p class="cl-from">From ${sources(c.unlockedBy, found)}</p>
    </li>`;
    })}
  </ol>
  ${open
    ? html`<p class="cl-done"><a class="button" href="/collection/${set.id}/comic">Read “${set.comic.title}”</a> <span>${paid ? `+${paid.xp} XP received for completing the set.` : ""}</span></p>
  ${got < set.cards.length ? html`<p class="cl-locked">You finished this story before card ${set.cards.length} existed, so it stays open. One more card is out there.</p>` : ""}`
    : html`<p class="cl-locked">Find all ${set.cards.length} cards to unlock a ${set.comic.pages.length}-page story${xp ? html` and <strong>+${xp} XP</strong>, once` : ""}.</p>`}
</section>`;
})}`;
}

function line(l: Line): H {
  const who = l.who ? html`<span class="sr-only">${l.who}${l.kind === "aside" ? ", quietly" : ""}: </span>` : "";
  return html`<p class="cm-${l.kind}${l.tail ? ` tail-${l.tail}` : ""}">${who}${l.text}</p>`;
}

function panel(p: Panel, eager: boolean): H {
  const corners = (["tl", "tr", "bl", "br"] as const).map((at) => [at, p.lines.filter((l) => l.at === at)] as const).filter(([, ls]) => ls.length);
  return html`<figure class="cm-panel">
  <div class="cm-frame">
    ${p.art
      ? html`<img class="cm-art" src="${p.art.src}" alt="${p.scene}" width="1280" height="800" ${eager ? "" : raw('loading="lazy"')}>${p.art.interim ? html`<span class="cm-status">Interim art</span>` : ""}`
      : html`<div class="cm-art cm-pending" role="img" aria-label="${p.scene}"><span class="cm-status">Art in progress</span><span class="cm-scene">${p.scene}</span></div>`}
    ${corners.map(([at, ls]) => {
      // two corners on one edge share it, so neither runs into the other
      const shared = corners.some(([o]) => o !== at && o[0] === at[0]);
      return html`<div class="cm-corner at-${at}${shared ? " is-shared" : ""}">${ls.map(line)}</div>`;
    })}
  </div>
</figure>`;
}

// One page of the comic. `n` counts from 1.
export function comicPage(set: CollectionSet, n: number): H {
  const pages = set.comic.pages;
  const page = pages[n - 1];
  const href = (k: number) => `/collection/${set.id}/comic?page=${k}`;
  const pager = (where: string) => html`<nav class="cm-pager" aria-label="Pages${where}">
  ${n > 1 ? html`<a class="button cm-prev" rel="prev" href="${href(n - 1)}">← Previous</a>` : html`<span class="cm-prev"></span>`}
  <span class="cm-count">Page ${n} of ${pages.length}</span>
  ${n < pages.length ? html`<a class="button cm-next" rel="next" href="${href(n + 1)}">Next →</a>` : html`<a class="button cm-next" href="${href(1)}">Read again</a>`}
</nav>`;
  return html`<div class="cm-reader" data-comic="${set.id}" data-page="${n}" data-pages="${pages.length}">
<header class="cm-head">
  <p class="cm-back"><a href="/collection">← Collection</a></p>
  <h1>${set.comic.title}</h1>
  <p class="cm-resume" hidden></p>
</header>
${pager("")}
<section class="cm-page is-${page.layout}" aria-label="Page ${n} of ${pages.length}">
  ${page.panels.map((p, i) => panel(p, i === 0))}
</section>
${pager(", bottom")}
${n === pages.length ? html`<p class="cm-end">The end, for now. <a href="/collection">Back to your collection</a></p>` : ""}
</div>`;
}

export function comicLocked(set: CollectionSet, found: readonly FragmentId[]): H {
  return html`<h1>Not yet</h1>
<p class="banner">This story opens once every card in the set is found. You have ${unlockedCount(set, found)} of ${set.cards.length}.</p>
<p><a href="/collection">Back to your collection</a></p>`;
}
