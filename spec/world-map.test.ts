import { JSDOM } from "jsdom";
import { expect, inject, it } from "vitest";

// The World map puts every destination on one picture, and the walk to each is
// set by how far away it is: the same pace for every place, so farther is longer.
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
const field = (pop: Element, name: string) =>
  [...pop.querySelectorAll("dt")].find((dt) => dt.textContent === name)?.nextElementSibling?.textContent ?? "";

it("puts every destination on the map, with a picture and a card to jump to", async () => {
  const doc = await worldPage();
  const map = doc.querySelector(".wm img");
  expect(map).not.toBeNull();
  expect((await fetch(url(map!.getAttribute("src")!))).status).toBe(200);

  const pins = [...doc.querySelectorAll(".wm-pin")];
  const cards = doc.querySelectorAll("[id^='dest-']");
  expect(pins.length).toBeGreaterThan(0);
  expect(pins.length).toBe(cards.length);
  for (const pin of pins) {
    expect(doc.querySelector(pin.getAttribute("href")!)).not.toBeNull();
    const pop = doc.getElementById(pin.getAttribute("aria-describedby")!)!;
    const photo = pop.querySelector("img")!;
    expect((await fetch(url(photo.getAttribute("src")!))).status).toBe(200);
    expect(field(pop, "May find")).not.toBe("");
  }
});

it("walks every place at the same pace, so farther is longer", async () => {
  const doc = await worldPage();
  const places = [...doc.querySelectorAll(".wm-pop")].map((pop) => ({
    km: Number(field(pop, "Distance").match(/[\d.]+/)![0]),
    walk: seconds(field(pop, "Walk")),
  }));
  const pace = places[0].walk / places[0].km;
  for (const p of places) expect(p.walk / p.km).toBeCloseTo(pace, 5);
  expect(doc.querySelector(".wm-scale")!.textContent).toContain(`${pace} seconds a kilometre`);
});
