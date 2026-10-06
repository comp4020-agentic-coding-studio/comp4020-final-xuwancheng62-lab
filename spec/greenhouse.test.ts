import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";
import { GREENHOUSE } from "../src/game/config.ts";
import { settle } from "../src/game/resources.ts";

// The greenhouse: planting costs water, growing plots keep drinking water and
// drawing power, and a planter can only be planted and harvested once.
const baseUrl = inject("baseUrl");
const url = (path: string) => new URL(path, baseUrl);

async function register(): Promise<string> {
  const res = await fetch(url("/register"), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: `spec_g${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, password: "correct horse battery" }),
  });
  expect(res.status).toBe(303);
  return res.headers.getSetCookie().find((c) => c.startsWith("sid="))!.split(";")[0];
}
const post = (cookie: string, path: string, fields: Record<string, string>) =>
  fetch(url(path), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie },
    body: new URLSearchParams(fields),
  });
async function water(cookie: string): Promise<{ value: number; rate: number }> {
  const doc = new JSDOM(await (await fetch(url("/"), { headers: { cookie } })).text()).window.document;
  const el = doc.querySelector('[data-res="water"] [data-value]')!;
  return { value: Number(el.getAttribute("data-value")), rate: Number(el.getAttribute("data-rate")) };
}

describe("the greenhouse", () => {
  it("charges water to plant, and growing crops add to the water drain", async () => {
    const me = await register();
    const before = await water(me);
    const res = await post(me, "/greenhouse/plant", { slot: "0", crop: "mushrooms" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/#info-greenhouse");
    const after = await water(me);
    expect(before.value - after.value).toBeCloseTo(GREENHOUSE.crops.mushrooms.water, 0);
    expect(before.rate - after.rate).toBe(GREENHOUSE.perPlot.water);
  });

  it("won't plant a full planter, harvest early, or take nonsense", async () => {
    const me = await register();
    expect((await post(me, "/greenhouse/plant", { slot: "1", crop: "beans" })).status).toBe(303);
    expect((await post(me, "/greenhouse/plant", { slot: "1", crop: "potatoes" })).status).toBe(409);
    expect((await post(me, "/greenhouse/harvest", { slot: "1" })).status).toBe(409);
    expect((await post(me, "/greenhouse/harvest", { slot: "2" })).status).toBe(409);
    expect((await post(me, "/greenhouse/plant", { slot: "2", crop: "roses" })).status).toBe(400);
    expect((await post(me, "/greenhouse/plant", { slot: "9", crop: "beans" })).status).toBe(400);
  });

  it("needs you at home", async () => {
    const me = await register();
    expect((await post(me, "/world/depart", { destination: "reservoir" })).status).toBe(303);
    expect((await post(me, "/greenhouse/plant", { slot: "0", crop: "mushrooms" })).status).toBe(409);
  });

  it("only draws while something is growing", () => {
    const stock = { food: 40, water: 40, power: 20, scrap: 15 };
    const hour = 3_600_000;
    const none = settle(stock, 0, hour).stock;
    const half = settle(stock, 0, hour, [{ plantedAt: 0, readyAt: hour / 2 }]).stock;
    expect(none.water - half.water).toBeCloseTo(GREENHOUSE.perPlot.water / 2, 5);
    expect(none.power - half.power).toBeCloseTo(GREENHOUSE.perPlot.power / 2, 5);
  });
});
