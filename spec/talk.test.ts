import { randomUUID } from "node:crypto";
import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";

// People at a shelter can talk: the owner and anyone looking in hear each
// other, live, and what was said stays on the page for later visitors.
const baseUrl = inject("baseUrl");
const url = (path: string) => new URL(path, baseUrl);
const tag = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

async function register(name: string): Promise<{ cookie: string; address: string }> {
  const res = await fetch(url("/register"), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: name, password: "correct horse battery" }),
  });
  expect(res.status).toBe(303);
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("sid="))!.split(";")[0];
  const home = await (await fetch(url("/"), { headers: { cookie } })).text();
  return { cookie, address: home.match(/\/shelters\/(\d+)/)![0] };
}

const talk = (cookie: string, address: string, body: string, opts: { json?: boolean; requestId?: string } = {}) =>
  fetch(url(`${address}/talk`), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie, ...(opts.json ? { accept: "application/json" } : {}) },
    body: new URLSearchParams({ body, request_id: opts.requestId ?? randomUUID() }),
  });

const lines = async (cookie: string, path: string) => {
  const doc = new JSDOM(await (await fetch(url(path), { headers: { cookie } })).text()).window.document;
  return [...doc.querySelectorAll("[data-talk-log] li")].map((li) => ({
    who: li.querySelector("b")?.textContent,
    said: li.querySelector("span")?.textContent,
    owner: li.classList.contains("is-owner"),
    scripts: li.querySelectorAll("script").length,
  }));
};
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("talking at a shelter", () => {
  let host: { cookie: string; address: string };
  let guest: { cookie: string; address: string };

  it("a visitor's line reaches the owner live, within a second", async () => {
    host = await register(`spec_h${tag}`);
    guest = await register(`spec_g${tag}`);
    const ctrl = new AbortController();
    let seen = "";
    const res = await fetch(url("/events"), { headers: { cookie: host.cookie }, signal: ctrl.signal });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    void (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          seen += decoder.decode(value);
        }
      } catch {}
    })();
    await pause(200);
    const start = performance.now();
    expect((await talk(guest.cookie, host.address, "Anyone home?")).status).toBe(303);
    while (!seen.includes("Anyone home?") && performance.now() - start < 1500) await pause(25);
    ctrl.abort();
    expect(seen).toMatch(/event: talk\ndata: .*Anyone home\?/);
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it("both of them see it on the page, with who said it", async () => {
    const expected = { who: `spec_g${tag}`, said: "Anyone home?", owner: false, scripts: 0 };
    expect(await lines(host.cookie, "/")).toContainEqual(expected);
    expect(await lines(guest.cookie, host.address)).toContainEqual(expected);
  });

  it("the owner answers from their own page, marked as the owner", async () => {
    expect((await talk(host.cookie, host.address, "Down here.")).status).toBe(303);
    expect(await lines(guest.cookie, host.address)).toContainEqual({ who: `spec_h${tag}`, said: "Down here.", owner: true, scripts: 0 });
  });

  it("treats what people say as text", async () => {
    await pause(1600);
    expect((await talk(guest.cookie, host.address, "<script>alert(1)</script>")).status).toBe(303);
    expect(await lines(host.cookie, "/")).toContainEqual({ who: `spec_g${tag}`, said: "<script>alert(1)</script>", owner: false, scripts: 0 });
  });

  it("refuses empty or overlong lines, and a flood", async () => {
    await pause(1600);
    expect((await talk(guest.cookie, host.address, "   ", { json: true })).status).toBe(400);
    expect((await talk(guest.cookie, host.address, "x".repeat(201), { json: true })).status).toBe(400);
    expect((await talk(guest.cookie, host.address, "one", { json: true })).status).toBe(200);
    expect((await talk(guest.cookie, host.address, "two", { json: true })).status).toBe(429);
  });

  it("says a line once, however often the same form is sent", async () => {
    await pause(1600);
    const requestId = randomUUID();
    const sent = await Promise.all(Array.from({ length: 4 }, () => talk(guest.cookie, host.address, "only once", { json: true, requestId })));
    expect(sent.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    expect((await lines(host.cookie, "/")).filter((l) => l.said === "only once")).toHaveLength(1);
  });

  it("needs a login and a real shelter", async () => {
    const anon = await fetch(url(`${host.address}/talk`), {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ body: "hi", request_id: randomUUID() }),
    });
    expect(anon.status).toBe(303);
    expect(anon.headers.get("location")).toBe("/login");
    expect((await talk(guest.cookie, "/shelters/999999999", "hi", { json: true })).status).toBe(404);
  });
});
