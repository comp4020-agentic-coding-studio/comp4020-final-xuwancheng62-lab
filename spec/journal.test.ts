import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";

// Records over HTTP: what a new player sees before finding anything, and that
// the choice of what to look for can't break a departure. Finding records
// takes a whole trip, so that's in spec/stories.test.ts.
const baseUrl = inject("baseUrl");
const url = (path: string) => new URL(path, baseUrl);
const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

async function post(path: string, fields: Record<string, string>, cookie?: string): Promise<Response> {
  return fetch(url(path), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", ...(cookie ? { cookie } : {}) },
    body: new URLSearchParams(fields),
  });
}
async function register(name: string): Promise<string> {
  const res = await post("/register", { username: name, password: "correct horse battery" });
  expect(res.status).toBe(303);
  return res.headers.getSetCookie().find((c) => c.startsWith("sid="))!.split(";")[0];
}
const doc = async (path: string, cookie: string) => new JSDOM(await (await fetch(url(path), { headers: { cookie } })).text()).window.document;

describe("the journal", () => {
  it("is only for someone signed in", async () => {
    const res = await fetch(url("/journal"), { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });

  it("starts empty, says where to begin, and is linked from every page", async () => {
    const me = await register(`spec_r${tag}`);
    const page = await doc("/journal", me);
    expect(page.querySelector("h1")!.textContent).toBe("Journal");
    expect(page.body.textContent).toContain("Nothing yet.");
    expect(page.querySelector(".jr-rec")).toBeNull();
    expect((await doc("/", me)).querySelector('nav a[href="/journal"]')).not.toBeNull();
  });
});

describe("what to look for", () => {
  it("is offered only where there are records, and only once you have a lead", async () => {
    const me = await register(`spec_s${tag}`);
    const world = await doc("/world", me);
    const shop = world.querySelector("#dest-supermarket")!;
    expect(shop.querySelector(".rec-status")!.textContent).toBe("Corners you haven't searched.");
    expect(shop.querySelector(".rec-choice")).toBeNull();
    expect(world.querySelector("#dest-reservoir .rec-status")).not.toBeNull();
    expect(world.querySelector("#dest-nest .rec-status")!.textContent).toBe("Corners you haven't searched.");
    expect(world.querySelector("#dest-workshop .rec-status")).toBeNull();
  });

  it("can't stop you leaving, whatever the form sends", async () => {
    const me = await register(`spec_t${tag}`);
    expect((await post("/world/depart", { destination: "supermarket", focus: "station-office" }, me)).status).toBe(303);
    const other = await register(`spec_u${tag}`);
    expect((await post("/world/depart", { destination: "reservoir", focus: "<script>" }, other)).status).toBe(303);
    expect((await doc("/activity", other)).querySelector("#j-h")!.textContent).toContain("Dry Reservoir");
  });
});
