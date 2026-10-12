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
  it("lets a newcomer create and cancel a party using the default plain form", async () => {
    const me = await register(`spec_x${tag}`);
    const page = await doc("/expeditions", me);
    expect(page.querySelector("nav a[aria-current=page]")!.textContent).toBe("Expeditions");
    expect(page.querySelector("#ld-h")!.textContent).toBe("The Lower Deck");
    const form = page.querySelector("form[action='/parties']")!;
    expect(form).not.toBeNull();
    const fields: Record<string, string> = {};
    for (const el of form.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select")) {
      if (el instanceof page.defaultView!.HTMLInputElement && el.type === "radio" && !el.checked) continue;
      fields[el.name] = el.value;
    }
    expect(fields).toMatchObject({ who: "you", row: "front", size: "3", approach: "sneak", retreat: "half", min_level: "1" });
    expect(form.querySelector("details")!.hasAttribute("open")).toBe(false);
    expect(page.body.textContent).toContain("Full parties leave automatically");
    expect(page.body.textContent).toContain("High danger");
    const ok = { who: "you", row: "front", size: "2", approach: "fight", retreat: "half", min_level: "1" };
    expect((await post("/parties", fields, me)).status).toBe(303);
    const gathering = await doc("/expeditions", me);
    const leave = gathering.querySelector("form[action$='/leave']")!;
    expect(leave).not.toBeNull();
    expect((await post(leave.getAttribute("action")!, {}, me)).status).toBe(303);
    expect((await post("/parties", { ...ok, size: "7" }, me)).status).toBe(400);
    // the dispatch form is plain HTML with your survivor chosen by default
    expect((await doc("/social?channel=friends", me)).querySelector<HTMLSelectElement>("select[name=who]")!.value).toBe("you");
  });

  it("refuses parties that aren't there and settings that make no sense", async () => {
    const me = await register(`spec_y${tag}`);
    expect((await post("/parties/999999/join", { who: "you", row: "front" }, me)).status).toBe(404);
    expect((await post("/parties/999999/leave", {}, me)).status).toBe(404);
    expect((await post("/parties/999999/dispatch", { friend: "1" }, me)).status).toBe(404);
    expect((await post("/dispatch", { who: "you", risk: "awful", row: "front", keep_food: "1", keep_water: "1" }, me)).status).toBe(400);
    expect((await post("/dispatch", { who: "nobody", risk: "risky", row: "front", keep_food: "1", keep_water: "1" }, me)).status).toBe(400);
    expect((await post("/dispatch", { who: "off", risk: "risky", row: "back", keep_food: "10", keep_water: "10" }, me)).status).toBe(303);
    expect((await doc("/social?channel=friends", me)).querySelector<HTMLSelectElement>("select[name=who]")!.value).toBe("off");
  });

  it("makes friends when both ask, and only then", async () => {
    const a = await register(`spec_fa${tag}`);
    const b = await register(`spec_fb${tag}`);
    expect((await post("/friends", { name: `spec_nobody${tag}` }, a)).status).toBe(404);
    expect((await post("/friends", { name: `spec_fa${tag}` }, a)).status).toBe(400);
    expect((await post("/friends", { name: `spec_fb${tag}` }, a)).status).toBe(303);
    const asked = await doc("/social?channel=friends", b);
    expect(asked.body.textContent).toContain("Accept friendship");
    expect((await post("/friends", { name: `spec_fa${tag}` }, b)).status).toBe(303);
    expect((await doc("/social?channel=friends", a)).body.textContent).toContain("Unfriend");
  });
});
