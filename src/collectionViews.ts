import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { COLLECTION_XP } from "./game/config.ts";
import { canRead, findableYet, isUnlocked, panels, recordsOf, setTitle, shownEvidence, unlockedCount, type CollectionSet, type Line, type Panel } from "./game/collections.ts";
import { fragment, type FragmentId } from "./game/stories.ts";
import { layoutPanel, type Box } from "./comicLayout.ts";
import { nameOfGear, type Gear } from "./game/items.ts";
import type { NextLead } from "./game/quests.ts";
import { itemCard } from "./itemViews.ts";

const unreachable = (set: CollectionSet): number => set.cards.filter((c) => !findableYet(c)).length;

// The Collection page and the comic a finished set unlocks. A card is a thing
// the player found, quoted and not explained; one not found yet shows only
// its back and number. The set is named for its person once it's complete.
// The comic is read a picture at a time, each balloon placed by its speaker
// (src/comicLayout.ts); each page is its own URL, so it works without
// JavaScript, and static/comic.js adds keys, swipes and a bookmark.

type H = HtmlEscapedString | Promise<HtmlEscapedString>;

const sources = (ids: readonly FragmentId[], found: readonly FragmentId[]) =>
  ids.filter((id) => found.includes(id)).map((id, i) => html`<a class="ui-action" href="/journal?tab=clues&record=${id}#rec-${id}">${fragment(id)!.title}</a>`);

export function collectionPage(sets: readonly CollectionSet[], found: readonly FragmentId[], reward: (setId: string) => { xp: number } | null, waiting: (setId: string) => boolean = () => false): H {
  return html`<nav class="collection-tabs" aria-label="Collection type"><a class="ui-action" href="/collection" aria-current="page">Stories</a><a class="ui-action" href="/collection/enemies">Enemies</a></nav><h1>Collection</h1>
<p class="lede">Recover clues. Complete a set. Discover a life.</p><details class="ui-help"><summary>How collections work</summary><p>Every record can complete a card. Cards stay yours even after defeat and take no inventory space. Complete a set to unlock its comic and reward.</p></details>
<a class="cl-prologue" href="/intro"><img src="/static/img/intro/prologue-icon.jpg" alt="" width="80" height="80"><span><small>PROLOGUE · ALWAYS AVAILABLE</small><strong>A shelter. A beginning.</strong><span>Revisit the opening and your first steps.</span></span><span class="cl-prologue-arrow" aria-hidden="true">→</span></a>
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
      return html`<li class="cl-card is-front"><details class="cl-discovery"><summary>
      <div class="cl-art">${e.art ? html`<img src="${e.art}" alt="${e.shows}" width="1024" height="768" loading="lazy">` : html`<div class="cl-pending" role="img" aria-label="${e.shows}"><span class="cl-tag">Art in progress</span><span>${e.shows}</span></div>`}<span class="cl-n">${c.n}</span></div>
      <h3>${e.title}</h3><span class="ui-card-hint">Inspect clue ↗</span></summary><div class="cl-discovery-body">
      <p class="cl-where">${e.where}</p>
      ${e.reads ? html`<blockquote class="cl-reads">${e.reads}</blockquote>` : ""}
      <p class="cl-from">${sources(recordsOf(c), found)}</p></div></details>
    </li>`;
    })}
  </ol>
  ${open
    ? html`<p class="cl-done"><a class="button" href="/collection/${set.id}/comic">Read “${set.comic.title}”</a> <span>${paid ? waiting(set.id) ? `+${paid.xp} XP received. A Legendary waits at the end of the story.` : `+${paid.xp} XP and a Legendary received for completing the set.` : ""}</span></p>
  ${got < set.cards.length ? html`<p class="cl-locked">You finished this story before card ${set.cards.length} existed, so it stays open. One more card is out there.</p>` : ""}`
    : html`<p class="cl-locked">${unreachable(set) ? `${unreachable(set) === 1 ? "One card lies" : `${unreachable(set)} cards lie`} somewhere no trip goes yet. ` : ""}Find all ${set.cards.length} cards to unlock ${/^(8|11|18)/.test(String(panels(set).length)) ? "an" : "a"} ${panels(set).length}-page story${xp ? html`, <strong>+${xp} XP</strong>` : ""} and <strong>a Legendary item</strong>, once.</p>`}
</section>`;
})}`;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

// One box of words, placed by layoutPanel (src/comicLayout.ts). The slot
// carries the phone layout's tail; on wide screens it steps out of the way.
function box(b: Box): H {
  const who = b.line.who ? html`<span class="sr-only">${b.line.who}${b.line.kind === "aside" ? ", quietly" : ""}: </span>` : "";
  const style = `--x:${r2(b.x)};--y:${r2(b.y)};--w:${r2(b.w)};--across:${r2(b.across ?? 0)}`;
  return html`<div class="cm-slot${b.tail ? " has-tail" : ""}" style="${style}"><p class="cm-box cm-${b.line.kind} is-${b.band}">${who}${b.line.text}</p></div>`;
}

function panel(p: Panel): H {
  const L = layoutPanel(p);
  const top = L.boxes.filter((b) => b.band !== "bottom");
  const bottom = L.boxes.filter((b) => b.band === "bottom");
  const tails = L.boxes.flatMap((b) => (b.tail ? [b.tail] : []));
  const pt = ([x, y]: [number, number]) => `${r2(x)},${r2(y)}`;
  return html`<figure class="cm-panel">
  <div class="cm-stage" style="--h:${r2(L.height)};--iy:${r2(L.imgY)}">
    ${top.map(box)}
    <div class="cm-frame">
      ${p.art
        ? html`<img class="cm-art" src="${p.art.src}" alt="${p.scene}" width="1280" height="800">${p.art.interim ? html`<span class="cm-status">Interim art</span>` : ""}`
        : html`<div class="cm-art cm-pending" role="img" aria-label="${p.scene}"><span class="cm-status">Art in progress</span><span class="cm-scene">${p.scene}</span></div>`}
    </div>
    ${tails.length
      ? html`<svg class="cm-tails" viewBox="0 0 100 ${r2(L.height)}" preserveAspectRatio="none" aria-hidden="true">${tails.map(
          (t) => html`<polygon points="${pt(t.b1)} ${pt(t.b2)} ${pt(t.tip)}"/>`,
        )}</svg>`
      : ""}
    ${bottom.map(box)}
  </div>
</figure>`;
}

// One page of the comic: one picture and its words. `n` counts from 1.
// The end of a story: what it's still holding for you, glowing, with Accept.
// A plain form; static/comic.js lifts it into an overlay.
function rewardPanel(set: CollectionSet, gear: Gear): H {
  return html`<section class="cm-reward" id="reward" aria-labelledby="cm-reward-h" data-reward>
  <div class="cm-reward-box" role="group" aria-labelledby="cm-reward-h">
    <p class="cm-reward-kicker">For finishing ${set.title}'s story</p>
    <h2 id="cm-reward-h">A Legendary</h2>
    <div class="cm-reward-item">${itemCard(gear)}</div>
    <form method="post" action="/collection/${set.id}/claim"><button class="cm-accept">Accept</button></form>
  </div>
</section>`;
}

// After accepting: where this person's story goes next.
export function nextPage(set: CollectionSet, lead: NextLead | null, got: Gear | null): H {
  return html`<div class="cm-next-page">
<p class="cm-back"><a class="ui-action" href="/collection">← Collection</a></p>
${got ? html`<p class="banner" role="status">${nameOfGear(got)} is in your stash.</p>` : ""}
<article class="card cm-lead">
  <p class="cm-reward-kicker">${set.title}</p>
  <h1>What's next</h1>
  ${lead ? html`<p class="cm-lead-line">${lead.line}</p>
  <a class="button cm-lead-go" href="${lead.href}">${lead.label} →</a>` : html`<p class="cm-lead-line">That's the whole of it, for now.</p>`}
  <p><a class="ui-action" href="/journal">Open your journal</a></p>
</article>
</div>`;
}

export function comicPage(set: CollectionSet, n: number, pending: Gear | null = null): H {
  const all = panels(set);
  const href = (k: number) => `/collection/${set.id}/comic?page=${k}`;
  const pager = (where: string) => html`<nav class="cm-pager" aria-label="Pages${where}">
  ${n > 1 ? html`<a class="button cm-prev" rel="prev" href="${href(n - 1)}">← Previous</a>` : html`<span class="cm-prev"></span>`}
  <span class="cm-count">Page ${n} of ${all.length}</span>
  ${n < all.length ? html`<a class="button cm-next" rel="next" href="${href(n + 1)}">Next →</a>` : html`<a class="button cm-next" href="${href(1)}">Read again</a>`}
</nav>`;
  return html`<div class="cm-reader" data-comic="${set.id}" data-page="${n}" data-pages="${all.length}">
<header class="cm-head">
  <p class="cm-back"><a class="ui-action" href="/collection">← Collection</a></p>
  <h1>${set.comic.title}</h1>
  <p class="cm-resume" hidden></p>
</header>
${pager("")}
<section class="cm-page" aria-label="Page ${n} of ${all.length}">
  ${panel(all[n - 1])}
</section>
${pager(", bottom")}
${n === all.length ? pending ? rewardPanel(set, pending) : html`<p class="cm-end">The end, for now. <a class="ui-action" href="/collection/${set.id}/next">What's next →</a></p>` : ""}
</div>`;
}

export function comicLocked(set: CollectionSet, found: readonly FragmentId[]): H {
  return html`<h1>Not yet</h1>
<p class="banner">This story opens once every card in the set is found. You have ${unlockedCount(set, found)} of ${set.cards.length}.</p>
<p><a class="ui-action" href="/collection">Back to your collection</a></p>`;
}
