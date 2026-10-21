import { html } from "hono/html";

const frames = [
  { image: "street", title: "Before the silence", text: "There were streets like this. Shops still open. People on their way home.", alt: "A civilian carrying groceries on a town street at dusk." },
  { image: "flash", title: "Then came the war", text: "Cities burned. Beyond the strikes, the lights went out — and the fallout came.", alt: "A distant nuclear blast lights the horizon; a civilian shields their eyes." },
  { image: "dust", title: "What remained", text: "Those who survived carried what they could. The rest became traces of lives left behind.", alt: "A fallen grocery bag and scattered tins as dust fills the street." },
  {"image": "doors", "title": "The doors closed", "era": "The first days", "text": "Some reached the shelters. Others found the doors already closed.", "alt": "Families enter a community shelter as volunteers close the heavy door."},
  {"image": "waiting", "title": "Waiting for the all-clear", "era": "The first days", "text": "We counted the days until help would come.", "alt": "Survivors listen to a radio beside shelves full of supplies."},
  {"image": "silence", "title": "Only static", "era": "Weeks became months", "text": "The broadcasts grew shorter. Then there was only static.", "alt": "An empty chair faces a radio; the shelves are almost bare."},
  {"image": "outside", "title": "Back into the light", "era": "As supplies ran low", "text": "When the stores ran low, we opened the doors ourselves.", "alt": "Two scavengers in protective clothing step into an abandoned street."},
  {"image": "danger", "title": "A changed world", "era": "The years outside", "text": "The world outside had changed. We learned its dangers by what they cost us.", "alt": "Scavengers find claw marks and a lurking creature while checking a radiation meter."},
  {"image": "choices", "title": "What we chose", "era": "In the years that followed", "text": "Some shared what little they had. Others killed for what they wanted.", "alt": "Neighbours share water while, elsewhere, armed raiders loot a shelter beside a fallen guard."},
  {"image": "rebuild", "title": "Lives from the ruins", "era": "Year by year", "text": "Year by year, we built lives from what remained. Fragile lives. But ours.", "alt": "Survivors repair tools, run a water purifier and tend crops underground."},
];

export const INTRO_PAGE_COUNT = frames.length + 1;

export function introPage(page: number) {
  const frame = frames[page - 1];
  return html`<section class="intro" aria-labelledby="intro-title">
    <header class="intro-top"><a href="/collection" aria-label="Back to Collection">← COLLECTION</a>${page < INTRO_PAGE_COUNT ? html`<a href="/intro?page=${INTRO_PAGE_COUNT}">Skip to your shelter →</a>` : html`<span>HOLDOUT · PROLOGUE</span>`}</header>
    ${frame ? html`<figure class="intro-frame"><img src="/static/img/intro/${frame.image}.jpg" alt="${frame.alt}"><figcaption><p class="intro-kicker">${"era" in frame ? frame.era : "A world at war"}</p><h1 id="intro-title">${frame.title}</h1><p>${frame.text}</p></figcaption></figure>` : html`<div class="intro-arrival"><img class="intro-arrival-art" src="/static/img/intro/shelter.jpg" alt="A survivor approaches a warmly lit shelter built into a hillside above Calder Valley."><div class="intro-arrival-copy"><p class="intro-kicker">Five years later · Calder Valley</p><h1 id="intro-title">A shelter. A beginning.</h1><p>Calder escaped the strikes, but not the fallout. You have taken over a Resilience Unit. Keep it running. Venture out. Find out who came before you.</p><a class="intro-primary" href="/">Enter your shelter →</a></div></div>
    <section class="intro-guide" aria-label="Your first steps">
      <a href="/#scene"><span>01 · SETTLE IN</span><h2>Know your shelter</h2><p>Click a facility to inspect production and upgrades. Keep an eye on food, water and power.</p></a>
      <a href="/#survivor"><span>02 · PREPARE</span><h2>Pack for the road</h2><p>Equip a weapon, check your health and carry supplies. Guns need matching ammunition.</p></a>
      <a href="/world#dest-supermarket"><span>03 · EXPLORE</span><h2>Start small</h2><p>Try the Abandoned Supermarket. Combat is automatic; defeat costs your carried equipment and supplies.</p></a>
      <a href="/activity"><span>04 · RETURN</span><h2>Follow the traces</h2><p>Read your trip report and check your stash. Found clues appear in the Journal and unlock Collection cards.</p></a>
    </section>`}
    <nav class="intro-nav" aria-label="Prologue pages">${page > 1 ? html`<a href="/intro?page=${page - 1}">← Previous</a>` : html`<a href="/">Skip intro</a>`}<span>${page} / ${INTRO_PAGE_COUNT}</span>${page < INTRO_PAGE_COUNT ? html`<a class="intro-primary" href="/intro?page=${page + 1}">Continue →</a>` : html`<a href="/intro">Replay</a>`}</nav>
  </section>`;
}
