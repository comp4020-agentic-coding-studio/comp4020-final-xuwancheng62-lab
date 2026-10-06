import { randomUUID } from "node:crypto";
import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";

// Raiding and helping, resolved by the server. These hold whatever the dice
// say: they check what moved, not whether a particular raid succeeded.
const baseUrl = inject("baseUrl");
const url = (path: string) => new URL(path, baseUrl);
const tag = Date.now().toString(36);
let n = 0;

interface Player {
  cookie: string;
  address: string;
}

async function player(): Promise<Player> {
  const res = await fetch(url("/register"), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: `spec_r${tag}${n++}`, password: "correct horse battery" }),
  });
  expect(res.status).toBe(303);
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("sid="))!.split(";")[0];
  const home = await (await fetch(url("/"), { headers: { cookie } })).text();
  return { cookie, address: home.match(/\/shelters\/\d+/)![0] };
}

const post = (p: Player, path: string, fields: Record<string, string>) =>
  fetch(url(path), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: p.cookie },
    body: new URLSearchParams(fields),
  });
const raid = (p: Player, target: Player, resource = "food", requestId: string = randomUUID()) =>
  post(p, `${target.address}/steal`, { resource, request_id: requestId });
const reinforce = (p: Player, target: Player) => post(p, `${target.address}/help`, { request_id: randomUUID() });

async function food(p: Player): Promise<number> {
  const doc = new JSDOM(await (await fetch(url("/"), { headers: { cookie: p.cookie } })).text()).window.document;
  return Number(doc.querySelector('[data-res="food"] [data-value]')!.getAttribute("data-value"));
}
async function log(p: Player): Promise<string> {
  const doc = new JSDOM(await (await fetch(url("/activity"), { headers: { cookie: p.cookie } })).text()).window.document;
  return doc.querySelector("[data-live-log]")!.textContent ?? "";
}

describe("raids", () => {
  it("refuse your own shelter, unknown goods, malformed requests and missing shelters", async () => {
    const a = await player();
    expect((await raid(a, a)).status).toBe(400);
    const b = await player();
    expect((await raid(a, b, "power")).status).toBe(400);
    expect((await raid(a, b, "food", "not-a-uuid")).status).toBe(400);
    expect((await post(a, "/shelters/999999999/steal", { resource: "food", request_id: randomUUID() })).status).toBe(404);
  });

  it("reach the target live within a second, move only what one side loses, and count once", async () => {
    const attacker = await player();
    const target = await player();
    const [before, theirsBefore] = [await food(attacker), await food(target)];

    const stream = new AbortController();
    const events = await fetch(url("/events"), { headers: { cookie: target.cookie }, signal: stream.signal });
    const reader = events.body!.getReader();
    const decoder = new TextDecoder();
    let seen = "";
    while (!seen.includes("event: hello")) seen += decoder.decode((await reader.read()).value);

    const requestId = randomUUID();
    const started = performance.now();
    const res = await raid(attacker, target, "food", requestId);
    expect(res.status).toBe(303);
    while (!seen.includes("event: alert")) seen += decoder.decode((await reader.read()).value);
    expect(performance.now() - started).toBeLessThan(1000);
    stream.abort();

    const again = await raid(attacker, target, "food", requestId);
    expect(again.status).toBe(303);
    expect(again.headers.get("location")).toBe(res.headers.get("location"));

    const gained = (await food(attacker)) - before;
    const lost = theirsBefore - (await food(target));
    expect(gained).toBeGreaterThanOrEqual(0);
    expect(Math.abs(gained - lost)).toBeLessThan(0.2);
    expect(await food(target)).toBeGreaterThanOrEqual(20);
    expect((await log(target)).match(/raid you|raided your shelter|broke in/g)).toHaveLength(1);
  });

  it("take the raider away from home, so they can't raid again at once", async () => {
    const attacker = await player();
    const target = await player();
    expect((await raid(attacker, target)).status).toBe(303);
    expect((await raid(attacker, await player())).status).toBe(409);
    const page = new JSDOM(await (await fetch(url("/"), { headers: { cookie: attacker.cookie } })).text()).window.document.body.textContent;
    expect(page).toContain("Away · shelter unguarded");
  });

  it("from several raiders at once never take the target below the floor or more than one haul", async () => {
    const target = await player();
    const raiders = await Promise.all([player(), player(), player(), player()]);
    const before = await Promise.all(raiders.map(food));
    const theirsBefore = await food(target);
    const results = await Promise.all(raiders.map((r) => raid(r, target)));
    for (const r of results) expect([303, 409]).toContain(r.status);
    const gained = (await Promise.all(raiders.map(food))).reduce((sum, f, i) => sum + (f - before[i]), 0);
    const after = await food(target);
    expect(after).toBeGreaterThanOrEqual(20);
    expect(Math.abs(gained - (theirsBefore - after))).toBeLessThan(0.3);
    expect(((await log(target)).match(/raided your shelter/g) ?? []).length).toBeLessThanOrEqual(1);
  });

  it("sent five times with one request id happen once", async () => {
    const attacker = await player();
    const target = await player();
    const requestId = randomUUID();
    const results = await Promise.all(Array.from({ length: 5 }, () => raid(attacker, target, "water", requestId)));
    const locations = new Set(results.map((r) => `${r.status} ${r.headers.get("location")}`));
    expect(locations.size).toBe(1);
    expect((await log(target)).match(/raid you|raided your shelter|broke in/g)).toHaveLength(1);
  });
});

describe("reinforcing", () => {
  it("helps once per hour, never yourself, and tells the target", async () => {
    const helper = await player();
    const target = await player();
    expect((await reinforce(helper, helper)).status).toBe(400);
    expect((await reinforce(helper, target)).status).toBe(303);
    expect((await reinforce(helper, target)).status).toBe(429);
    expect(await log(target)).toContain("reinforced your shelter");
  });
});
