import { JSDOM } from "jsdom";
import { expect, inject, it } from "vitest";

// The shelter is painted, and every player has a portrait: the same face on
// their Survivors card, at the top of their shelter, and beside what they say.
const baseUrl = inject("baseUrl");
const url = (path: string) => new URL(path, baseUrl);
const tag = `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

async function register(name: string): Promise<{ cookie: string; id: string }> {
  const res = await fetch(url("/register"), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: name, password: "correct horse battery" }),
  });
  expect(res.status).toBe(303);
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("sid="))!.split(";")[0];
  const home = await (await fetch(url("/"), { headers: { cookie } })).text();
  return { cookie, id: home.match(/\/shelters\/(\d+)/)![1] };
}
const page = async (path: string, cookie: string) =>
  new JSDOM(await (await fetch(url(path), { headers: { cookie } })).text()).window.document;
const loads = async (src: string | null) => (await fetch(url(src!))).status;

it("paints every room of the shelter and everything in it, on both layouts", async () => {
  const me = await register(`spec_r${tag}`);
  const doc = await page("/", me.cookie);
  for (const svg of doc.querySelectorAll(".sc-svg")) {
    expect(svg.querySelectorAll(".backdrop").length).toBe(svg.querySelectorAll(".room").length + 1); // and the skyline
    for (const k of ["generator", "purifier", "food", "water", "scrap", "quarters", "greenhouse", "hatch"]) expect(svg.querySelector(`.eq-${k} image`)).not.toBeNull();
    // stock stands on the shelves as separate painted items, not part of a picture
    for (const k of ["food", "water"]) {
      const items = svg.querySelectorAll(`.eq-${k} image`).length - 1; // less the shelf
      expect(items).toBeGreaterThan(0);
      expect(items).toBeLessThanOrEqual(9);
    }
    const art = [...svg.querySelectorAll("image")].map((i) => i.getAttribute("href"));
    for (const src of new Set(art)) expect(await loads(src)).toBe(200);
  }
});

it("shows the same portrait for a player everywhere they appear", async () => {
  const owner = await register(`spec_o${tag}`);
  const visitor = await register(`spec_v${tag}`);

  const own = (await page("/", owner.cookie)).querySelector(".sh-head img")!.getAttribute("src");
  expect(await loads(own)).toBe(200);

  expect((await page(`/shelters/${owner.id}`, visitor.cookie)).querySelector(".sh-head img")!.getAttribute("src")).toBe(own);

  // The Survivors list leaves out spec accounts, so on a fresh database (CI) it
  // is empty; where real players are listed, check whichever card comes first.
  const card = (await page("/world", visitor.cookie)).querySelector("[data-shelter-id]");
  if (card) {
    const face = card.querySelector("img")!.getAttribute("src");
    expect(await loads(face)).toBe(200);
    const there = await page(`/shelters/${card.getAttribute("data-shelter-id")}`, visitor.cookie);
    expect(card.textContent).toContain(there.querySelector("[data-live-status-text]")!.textContent!.replace(/ is (home|out).*/, ""));
    expect(there.querySelector(".sh-head img")!.getAttribute("src")).toBe(face);
  }

  const said = await fetch(url(`/shelters/${owner.id}/talk`), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", cookie: owner.cookie },
    body: new URLSearchParams({ body: "hello", request_id: crypto.randomUUID() }),
  });
  expect(said.status).toBe(200);
  const line = (await page(`/shelters/${owner.id}`, visitor.cookie)).querySelector(".sh-talk-log li")!;
  expect(line.querySelector("img")!.getAttribute("src")).toBe(own);
});

it("lets you pick your portrait when you register, from every one there is", async () => {
  const form = new JSDOM(await (await fetch(url("/register"))).text()).window.document;
  const choices = [...form.querySelectorAll<HTMLInputElement>("input[name=portrait]")];
  expect(choices.length).toBeGreaterThanOrEqual(12);
  expect(choices.filter((c) => c.checked)).toHaveLength(1);
  for (const c of choices) expect(c.closest("label")!.querySelector("img")!.getAttribute("alt")).toBeTruthy();

  const pick = choices.at(-1)!.value;
  const res = await fetch(url("/register"), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: `spec_p${tag}`, password: "correct horse battery", portrait: pick }),
  });
  expect(res.status).toBe(303);
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("sid="))!.split(";")[0];
  const src = (await page("/", cookie)).querySelector(".sh-head img")!.getAttribute("src");
  expect(src).toBe(choices.at(-1)!.closest("label")!.querySelector("img")!.getAttribute("src"));

  const bad = await fetch(url("/register"), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: `spec_q${tag}`, password: "correct horse battery", portrait: String(choices.length + 1) }),
  });
  expect(bad.status).toBe(400);
});
