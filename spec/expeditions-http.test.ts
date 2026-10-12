import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";

// The Expeditions page over HTTP: plain forms that work without JavaScript,
// refusals for what a player can't do, and a friend's request answered by
// asking back. Parties themselves are played in spec/parties.test.ts.

const baseUrl = inject("baseUrl");
const url = (path: string) => new URL(path, baseUrl);
const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
async function post(path: string, fields: Record<string, string>, cookie?: string): Promise<Response> {
  return fetch(url(path), { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded", ...(cookie ? { cookie } : {}) }, body: new URLSearchParams(fields) });
}
async function register(name: string): Promise<string> {
  const res = await post("/register", { username: name, password: "correct horse battery" });
  expect(res.status).toBe(303);
  return res.headers.getSetCookie().find((c) => c.startsWith("sid="))!.split(";")[0];
}
const doc = async (path: string, cookie: string) => new JSDOM(await (await fetch(url(path), { headers: { cookie } })).text()).window.document;

describe("the Expeditions page", () => {
  it("is in the nav, explains the Lower Deck, and won't let a newcomer call a party", async () => {
    const me = await register(`spec_x${tag}`);
    const page = await doc("/expeditions", me);
    expect(page.querySelector("nav a[aria-current=page]")!.textContent).toBe("Expeditions");
    expect(page.querySelector("#ld-h")!.textContent).toBe("The Lower Deck");
    expect(page.querySelector("form[action='/parties']")).toBeNull();
    const ok = { who: "you", row: "front", size: "2", approach: "fight", retreat: "half", min_level: "1" };
    expect((await post("/parties", ok, me)).status).toBe(409);
    expect((await post("/parties", { ...ok, size: "7" }, me)).status).toBe(400);
    // the dispatch form is plain HTML with your survivor chosen by default
    expect(page.querySelector("#dispatch input[name=who][value=you]")!.hasAttribute("checked")).toBe(true);
  });

  it("refuses parties that aren't there and settings that make no sense", async () => {
    const me = await register(`spec_y${tag}`);
    expect((await post("/parties/999999/join", { who: "you", row: "front" }, me)).status).toBe(404);
    expect((await post("/parties/999999/leave", {}, me)).status).toBe(404);
    expect((await post("/parties/999999/dispatch", { friend: "1" }, me)).status).toBe(404);
    expect((await post("/dispatch", { who: "you", risk: "awful", row: "front", keep_food: "1", keep_water: "1" }, me)).status).toBe(400);
    expect((await post("/dispatch", { who: "nobody", risk: "risky", row: "front", keep_food: "1", keep_water: "1" }, me)).status).toBe(400);
    expect((await post("/dispatch", { who: "off", risk: "risky", row: "back", keep_food: "10", keep_water: "10" }, me)).status).toBe(303);
    expect((await doc("/expeditions", me)).querySelector("#dispatch input[value=off]")!.hasAttribute("checked")).toBe(true);
  });

  it("makes friends when both ask, and only then", async () => {
    const a = await register(`spec_fa${tag}`);
    const b = await register(`spec_fb${tag}`);
    expect((await post("/friends", { name: `spec_nobody${tag}` }, a)).status).toBe(404);
    expect((await post("/friends", { name: `spec_fa${tag}` }, a)).status).toBe(400);
    expect((await post("/friends", { name: `spec_fb${tag}` }, a)).status).toBe(303);
    const asked = await doc("/expeditions", b);
    expect(asked.querySelector("#friends")!.textContent).toContain("wants to be friends");
    expect((await post("/friends", { name: `spec_fa${tag}` }, b)).status).toBe(303);
    expect((await doc("/expeditions", a)).querySelector("#friends")!.textContent).toContain("Unfriend");
  });
});
