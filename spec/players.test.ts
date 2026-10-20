import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";

// A player's card: anyone's name opens what you can see of them and what you
// can do together, without ever showing their exact stock.
const base = inject("baseUrl");
const url = (p: string) => new URL(p, base);
const tag = Date.now().toString(36);

async function player(suffix: string) {
  const name = `spec_p${tag}${suffix}`;
  const r = await fetch(url("/register"), { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ username: name, password: "correct horse battery" }) });
  expect(r.status).toBe(303);
  return { name, cookie: r.headers.getSetCookie().find((s) => s.startsWith("sid="))!.split(";")[0] };
}
const get = (p: string, cookie = "") => fetch(url(p), { redirect: "manual", headers: { cookie } });
const post = (p: string, fields: Record<string, string>, cookie: string) =>
  fetch(url(p), { method: "POST", redirect: "manual", headers: { cookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields) });
const doc = async (p: string, cookie: string) => new JSDOM(await (await get(p, cookie)).text()).window.document;
const buttons = (d: Document) => [...d.querySelectorAll("main button, main a.button")].map((b) => b.textContent!.trim());

describe("player cards", () => {
  it("show rough public facts only, and need a login", async () => {
    const a = await player("a"), b = await player("b");
    const res = await get(`/players/${b.name}`, a.cookie);
    expect(res.status).toBe(200);
    const html = await res.text();
    const page = new JSDOM(html).window.document;
    expect(page.querySelector("main h1")!.textContent).toBe(b.name);
    expect(page.body.textContent).toMatch(/Security (Low|Medium|High)/);
    expect(html).not.toContain("data-value=");
    expect(page.body.textContent).not.toMatch(/\bFood\s*\d|\bWater\s*\d|\bScrap\s*\d/);
    expect((await get(`/players/${b.name}`)).status).toBe(302);
    expect((await get(`/players/spec_nobody${tag}`, a.cookie)).status).toBe(404);
  });

  it("turn a name into a friendship in two clicks, one on each side", async () => {
    const a = await player("c"), b = await player("d");
    expect(buttons(await doc(`/players/${b.name}`, a.cookie))).toContain("Add friend");
    expect((await post(`/players/${b.name}/friend`, {}, a.cookie)).status).toBe(303);
    expect((await doc(`/players/${b.name}`, a.cookie)).body.textContent).toContain("Friend request sent");
    expect(buttons(await doc(`/players/${a.name}`, b.cookie))).toContain("Accept friendship");
    expect((await post(`/players/${a.name}/friend`, {}, b.cookie)).status).toBe(303);
    const now = await doc(`/players/${b.name}`, a.cookie);
    expect(buttons(now)).toContain("Message");
    expect(buttons(now)).not.toContain("Add friend");
  });

  it("are linked from world chat and shelter talk", async () => {
    const a = await player("e");
    const lines = await doc("/social?channel=world", a.cookie);
    for (const link of lines.querySelectorAll("[data-chat-log] b a")) expect(link.getAttribute("href")).toMatch(/^\/players\//);
    const own = await doc(`/players/${a.name}`, a.cookie);
    expect(own.body.textContent).toContain("This is you");
    expect(buttons(own)).not.toContain("Add friend");
  });
});
