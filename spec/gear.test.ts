import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";

// The survivor over HTTP: what the Shelter and World pages promise before a
// trip, and that gear only changes at home. The fight itself is in
// spec/encounter.test.ts, since it comes minutes into a trip.
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
const text = async (path: string, cookie: string) => (await doc(path, cookie)).body.textContent ?? "";

describe("the survivor", () => {
  it("starts rested, level 1, with a crowbar, and shows it on the Shelter page", async () => {
    const me = await register(`spec_g${tag}`);
    const page = await doc("/", me);
    const panel = page.querySelector("#survivor")!;
    expect(panel).not.toBeNull();
    expect(panel.querySelector("[role=meter]")!.getAttribute("aria-valuenow")).toBe("100");
    expect(panel.textContent).toContain("level 1");
    expect(panel.querySelector(".sv-slots")!.textContent).toContain("Crowbar");
    expect(page.querySelector(".sh-head [role=meter]")).not.toBeNull();
  });

  it("moves an item between equipped and storage, never into both", async () => {
    const me = await register(`spec_h${tag}`);
    expect((await post("/gear/unequip", { slot: "weapon" }, me)).status).toBe(303);
    let panel = (await doc("/", me)).querySelector("#survivor")!;
    expect(panel.querySelector(".sv-slots")!.textContent).not.toContain("Crowbar");
    expect(panel.querySelector(".sv-stored")!.textContent).toContain("Crowbar");
    expect((await post("/gear/equip", { item: "crowbar" }, me)).status).toBe(303);
    panel = (await doc("/", me)).querySelector("#survivor")!;
    expect(panel.querySelector(".sv-slots")!.textContent).toContain("Crowbar");
    expect(panel.querySelector(".sv-stored")).toBeNull();
  });

  it("refuses gear you don't own, nonsense, and spending points you haven't earned", async () => {
    const me = await register(`spec_i${tag}`);
    expect((await post("/gear/equip", { item: "spear" }, me)).status).toBe(404);
    expect((await post("/gear/equip", { item: "rocket" }, me)).status).toBe(400);
    expect((await post("/gear/unequip", { slot: "hat" }, me)).status).toBe(400);
    expect((await post("/character/train", { stat: "strength" }, me)).status).toBe(409);
    expect((await post("/character/train", { stat: "__proto__" }, me)).status).toBe(400);
  });

  it("changes gear only at home", async () => {
    const me = await register(`spec_j${tag}`);
    expect((await post("/world/depart", { destination: "reservoir" }, me)).status).toBe(303);
    expect((await post("/gear/unequip", { slot: "weapon" }, me)).status).toBe(409);
    expect((await doc("/", me)).querySelector("#survivor .sv-slots")!.textContent).toContain("Crowbar");
  });

  it("won't heal what isn't hurt, and fights only when there's something to fight", async () => {
    const me = await register(`spec_k${tag}`);
    expect((await post("/character/meal", {}, me)).status).toBe(409);
    expect((await post("/encounter/attack", { request_id: crypto.randomUUID(), turn: "0" }, me)).status).toBe(409);
    expect((await post("/encounter/escape", { request_id: crypto.randomUUID() }, me)).status).toBe(409);
  });

  it("warns, before you leave for the Nest, what a defeat costs", async () => {
    const me = await register(`spec_l${tag}`);
    const card = (await doc("/world", me)).querySelector("#dest-nest")!;
    const warning = card.querySelector(".nest-warn")!;
    expect(warning.textContent).toContain("Defeat means losing all equipped gear and supplies collected on this trip.");
    // it sits above the button that leaves, not behind it
    expect(warning.compareDocumentPosition(card.querySelector("form button")!) & 4).toBeTruthy();
    expect((await doc("/world", me)).querySelector("#dest-reservoir .nest-warn")).toBeNull();
  });

  it("keeps a player's health and gear off what others see", async () => {
    const owner = await register(`spec_m${tag}`);
    const visitor = await register(`spec_n${tag}`);
    const id = (await doc("/", owner)).querySelector("[data-scene-shelter]")!.getAttribute("data-scene-shelter");
    const seen = await text(`/shelters/${id}`, visitor);
    expect(seen).not.toContain("Crowbar");
    expect(seen).not.toContain("Strength");
  });
});
