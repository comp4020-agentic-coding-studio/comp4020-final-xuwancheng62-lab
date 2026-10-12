import { JSDOM } from "jsdom";
import { expect, inject, it } from "vitest";

// The World map keeps geographic distance, but demo trips wait only for exploration.
const baseUrl = inject("baseUrl");
const url = (path: string) => new URL(path, baseUrl);
const tag = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

let n = 0;
async function worldPage(): Promise<Document> {
  const res = await fetch(url("/register"), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: `spec_${tag}${n++}`, password: "correct horse battery" }),
  });
  expect(res.status).toBe(303);
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("sid="))!.split(";")[0];
  return new JSDOM(await (await fetch(url("/world"), { headers: { cookie } })).text()).window.document;
}

// "30s", "1 min", "1.5 min" → seconds
const seconds = (s: string) => {
  const m = s.match(/([\d.]+)\s*(s|min)/)!;
  return Number(m[1]) * (m[2] === "min" ? 60 : 1);
};

it("puts every destination on the map, with a picture and a card to jump to", async () => {
  const doc = await worldPage();
  const map = doc.querySelector(".wm img");
  expect(map).not.toBeNull();
  expect((await fetch(url(map!.getAttribute("src")!))).status).toBe(200);

  const pins = [...doc.querySelectorAll(".wm-pin:not(.wm-team-pin)")];
  const cards = doc.querySelectorAll("[id^='dest-']");
  expect(pins.length).toBeGreaterThan(0);
  expect(pins.length).toBe(cards.length);
  for (const pin of pins) {
    expect(doc.querySelector(pin.getAttribute("href")!)).not.toBeNull();
    const pop = doc.getElementById(pin.getAttribute("aria-describedby")!)!;
    const photo = pop.querySelector("img")!;
    expect((await fetch(url(photo.getAttribute("src")!))).status).toBe(200);
    expect(pop.querySelector(".world-loot")!.textContent).not.toBe("");
    expect(pop.querySelector(`a[href="${pin.getAttribute("href")}"]`)).not.toBeNull();
  }
});

it("shows only exploration time while keeping geographic distance", async () => {
  const doc = await worldPage();
  const places = [...doc.querySelectorAll(".wm-spot:not(.wm-team-spot) .wm-pop")];
  expect(places.length).toBeGreaterThan(0);
  for (const pop of places) {
    const meta = pop.querySelector('.wm-short-meta')!.textContent!;
    const distance = meta.match(/[\d.]+ km/)![0];
    expect(Number(distance.match(/[\d.]+/)![0])).toBeGreaterThan(0);
    expect(seconds(meta)).toBeGreaterThan(0);
    expect(meta).not.toContain('Walk');
    expect(meta).not.toContain('Away in all');
    const card = doc.getElementById(`dest-${pop.id.replace("pop-", "")}`)!;
    expect(seconds(card.querySelector('.world-time')!.textContent!)).toBe(seconds(meta));
    expect(card.querySelector('.world-options-body')!.textContent).toContain(distance);
    expect(card.textContent).not.toContain('Round trip');
    expect(card.querySelector('details.world-options')!.hasAttribute('open')).toBe(false);
    expect(card.querySelector('form[action="/world/depart"]')).not.toBeNull();
  }
  expect(doc.querySelector(".world-section-head")!.textContent).toContain("retreat below 30% HP");
});
