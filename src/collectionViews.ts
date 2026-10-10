import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { COLLECTION_XP } from "./game/config.ts";
import { canRead, findableYet, isUnlocked, recordsOf, setTitle, shownEvidence, unlockedCount, type CollectionSet, type Line, type Panel } from "./game/collections.ts";
import { fragment, type FragmentId } from "./game/stories.ts";

const unreachable = (set: CollectionSet): number => set.cards.filter((c) => !findableYet(c)).length;

// The Collection page and the comic a finished set unlocks. A card is a thing
// the player found, quoted and not explained; one not found yet shows only
// its back and number. The set is named for its person once it's complete.
// The comic is read a page at a time; each page is its own URL, so it works
// without JavaScript, and static/comic.js adds keys, swipes and a bookmark.

type H = HtmlEscapedString | Promise<HtmlEscapedString>;

const sources = (ids: readonly FragmentId[], found: readonly FragmentId[]) =>
  ids.filter((id) => found.includes(id)).map((id, i) => html`${i ? ", " : ""}<a href="/journal#rec-${id}">${fragment(id)!.title}</a>`);

export function collectionPage(sets: readonly CollectionSet[], found: readonly FragmentId[], reward: (setId: string) => { xp: number } | null): H {
  return html`<h1>Collection</h1>
<p class="lede">Every record you find can complete a card. Cards stay yours whatever happens out there; they take no room and can't be lost.</p>
${sets.map((set) => {
  const got = unlockedCount(set, found);
  const paid = reward(set.id);
  const open = canRead(set, found, Boolean(paid));
  const xp = COLLECTION_XP[set.id] ?? 0;
  return html`<section class="cl-set" aria-labelledby="cl-${set.id}">
  <div class="cl-head">
    <h2 id="cl-${set.id}">${setTitle(set, found, Boolean(paid))}</h2>
    <p class="cl-progress"><span>${got} of ${set.cards.length} cards</span>
      <span class="cl-bar" role="progressbar" aria-label="Cards found" aria-valuemin="0" aria-valuemax="${set.cards.length}" aria-valuenow="${got}"><span style="width:${(got / set.cards.length) * 100}%"></span></span></p>
  </div>
  <ol class="cl-cards">
    ${set.cards.map((c) => {
      if (!isUnlocked(c, found)) {
        // a back says only whether a trip can turn it up yet, nothing more
        const label = findableYet(c) ? "Not found yet" : "Somewhere you can't reach yet";
        return html`<li class="cl-card is-back${findableYet(c) ? "" : " is-unreachable"}"><div class="cl-art" role="img" aria-label="Card ${c.n}, ${label.toLowerCase()}"><span class="cl-n">${c.n}</span></div><p class="cl-back-label">${label}</p></li>`;
      }
      const e = shownEvidence(c, found)!;
      return html`<li class="cl-card is-front">
      <div class="cl-art">${e.art ? html`<img src="${e.art}" alt="${e.shows}" width="1024" height="768" loading="lazy">` : html`<div class="cl-pending" role="img" aria-label="${e.shows}"><span class="cl-tag">Art in progress</span><span>${e.shows}</span></div>`}<span class="cl-n">${c.n}</span></div>
      <h3>${e.title}</h3>
      <p class="cl-where">${e.where}</p>
      ${e.reads ? html`<blockquote class="cl-reads">${e.reads}</blockquote>` : ""}
      <p class="cl-from">From ${sources(recordsOf(c), found)}</p>
    </li>`;
    })}
  </ol>
  ${open
    ? html`<p class="cl-done"><a class="button" href="/collection/${set.id}/comic">Read “${set.comic.title}”</a> <span>${paid ? `+${paid.xp} XP received for completing the set.` : ""}</span></p>
  ${got < set.cards.length ? html`<p class="cl-locked">You finished this story before card ${set.cards.length} existed, so it stays open. One more card is out there.</p>` : ""}`
    : html`<p class="cl-locked">${unreachable(set) ? `${unreachable(set) === 1 ? "One card lies" : `${unreachable(set)} cards lie`} somewhere no trip goes yet. ` : ""}Find all ${set.cards.length} cards to unlock ${/^(8|11|18)/.test(String(set.comic.pages.length)) ? "an" : "a"} ${set.comic.pages.length}-page story${xp ? html` and <strong>+${xp} XP</strong>, once` : ""}.</p>`}
</section>`;
})}`;
}

function line(l: Line): H {
  const who = l.who ? html`<span class="sr-only">${l.who}${l.kind === "aside" ? ", quietly" : ""}: </span>` : "";
  return html`<p class="cm-${l.kind}${l.tail ? ` tail-${l.tail}` : ""}">${who}${l.text}</p>`;
}

function panel(p: Panel, eager: boolean): H {
  // corners come in the order the script first uses them, so a screen reader
  // hears the lines in story order wherever they sit on the picture
  const corners = [...new Set(p.lines.map((l) => l.at))].map((at) => [at, p.lines.filter((l) => l.at === at)] as const);
  // the interim-art tag takes a corner the lettering doesn't use
  const free = (["tr", "br", "tl"] as const).find((at) => !corners.some(([c]) => c === at)) ?? "tr";
  return html`<figure class="cm-panel">
  <div class="cm-frame">
    ${p.art
      ? html`<img class="cm-art" src="${p.art.src}" alt="${p.scene}" width="1280" height="800" ${eager ? "" : raw('loading="lazy"')}>${p.art.interim ? html`<span class="cm-status at-${free}">Interim art</span>` : ""}`
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
