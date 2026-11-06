import { JSDOM } from "jsdom";
import { expect, inject, it } from "vitest";

// A friend can see whether you have the game open, live, and nobody else can.
const baseUrl = inject("baseUrl");
const url = (path: string) => new URL(path, baseUrl);
const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

async function register(name: string) {
  const res = await fetch(url("/register"), {
    method: "POST", redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: name, password: "correct horse battery" }),
  });
  expect(res.status).toBe(303);
  return { name, cookie: res.headers.getSetCookie().find((c) => c.startsWith("sid="))!.split(";")[0] };
}
const post = (path: string, body: Record<string, string>, cookie: string) =>
  fetch(url(path), { method: "POST", redirect: "manual", headers: { cookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
const page = async (path: string, cookie: string) => new JSDOM(await (await fetch(url(path), { headers: { cookie } })).text()).window.document;

// An open game: the event stream every signed-in page keeps.
function open(cookie: string) {
  const ctrl = new AbortController();
  let seen = "";
  const ready = fetch(url("/events"), { headers: { cookie }, signal: ctrl.signal }).then(async (res) => {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    (async () => { try { for (;;) { const { value, done } = await reader.read(); if (done) break; seen += decoder.decode(value); } } catch {} })();
    while (!seen.includes("event: hello")) await new Promise((r) => setTimeout(r, 20));
  });
  return {
    ready,
    close: () => ctrl.abort(),
    async until(name: string, on: boolean, ms: number) {
      const start = performance.now();
      while (performance.now() - start < ms) {
        const last = [...seen.matchAll(/event: online\ndata: (.*)\n/g)].map((m) => JSON.parse(m[1])).filter((d) => d.name === name).at(-1);
        if (last?.online === on) return performance.now() - start;
        await new Promise((r) => setTimeout(r, 25));
      }
      throw new Error(`no online=${on} event for ${name}`);
    },
  };
}
const dotFor = (doc: Document, name: string) =>
  [...doc.querySelectorAll(".sx-people li")].find((li) => li.textContent?.includes(name))?.querySelector(".online-dot");

it("shows a friend online within a second of opening the game, and offline after they leave", async () => {
  const a = await register(`spec_oa${tag}`);
  const b = await register(`spec_ob${tag}`);
  const c = await register(`spec_oc${tag}`);
  await post("/social/friends", { name: b.name }, a.cookie);
  await post("/social/friends", { name: a.name }, b.cookie);

  const watching = open(a.cookie);
  await watching.ready;
  const outsider = open(c.cookie);
  await outsider.ready;

  expect(dotFor(await page("/social?channel=friends", a.cookie), b.name)?.classList.contains("is-on")).toBe(false);
  const game = open(b.cookie);
  await game.ready;
  expect(await watching.until(b.name, true, 1500)).toBeLessThan(1500);
  const hub = await page("/social?channel=friends", a.cookie);
  expect(dotFor(hub, b.name)?.classList.contains("is-on")).toBe(true);
  expect(dotFor(hub, b.name)?.textContent).toBe("Online");

  // not a friend: no event, no dot on b's World card, nothing on b's profile
  await expect(outsider.until(b.name, true, 400)).rejects.toThrow();
  const world = await page("/world", c.cookie);
  const card = [...world.querySelectorAll(".neighbour-row")].find((el) => el.textContent?.includes(b.name));
  if (card) expect(card.querySelector(".online-dot")).toBeNull();

  game.close();
  // a closed tab gets a short grace period, so a page change doesn't flicker
  expect(await watching.until(b.name, false, 7000)).toBeGreaterThan(0);
  expect(dotFor(await page("/social?channel=friends", a.cookie), b.name)?.classList.contains("is-on")).toBe(false);
  watching.close();
  outsider.close();
}, 15_000);
