import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";

// Looking into another shelter is instant, shows only rough levels, and never
// moves your own survivor.
const baseUrl = inject("baseUrl");
const url = (path: string) => new URL(path, baseUrl);

async function register(username: string): Promise<string> {
  const res = await fetch(url("/register"), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password: "correct horse battery" }),
  });
  expect(res.status).toBe(303);
  return res.headers.getSetCookie().find((c) => c.startsWith("sid="))!.split(";")[0];
}

const get = (path: string, cookie?: string) => fetch(url(path), { redirect: "manual", headers: cookie ? { cookie } : {} });
const text = (html: string) => new JSDOM(html).window.document.body.textContent ?? "";

describe("visiting another shelter", () => {
  const tag = Date.now().toString(36);
  let visitor: string;
  let host: string;
  let hostAddress: string;
  let ownAddress: string;

  it("each player can find their own shelter's address", async () => {
    visitor = await register(`spec_v${tag}`);
    host = await register(`spec_h${tag}`);
    hostAddress = text(await (await get("/", host)).text()).match(/\/shelters\/\d+/)![0];
    ownAddress = text(await (await get("/", visitor)).text()).match(/\/shelters\/\d+/)![0];
    expect(hostAddress).not.toBe(ownAddress);
  });

  it("opens straight away and shows rough levels, not exact stock", async () => {
    const res = await get(hostAddress, visitor);
    expect(res.status).toBe(200);
    const html = await res.text();
    const page = text(html);
    expect(page).toContain(`spec_h${tag}'s shelter`);
    expect(page).toMatch(/Plenty|Some|Scarce|Empty/);
    expect(html).not.toContain("data-value=");
    expect(page).not.toMatch(/Stored\s*\d/);
  });

  it("leaves the visitor at home", async () => {
    expect(text(await (await get("/", visitor)).text())).toContain("At shelter · guarded");
  });

  it("sends you home if it's your own shelter, and 404s for nonsense", async () => {
    const own = await get(ownAddress, visitor);
    expect(own.status).toBe(302);
    expect(own.headers.get("location")).toBe("/");
    expect((await get("/shelters/999999999", visitor)).status).toBe(404);
    expect((await get("/shelters/not-a-number", visitor)).status).toBe(404);
  });

  it("needs a login", async () => {
    const res = await get(hostAddress);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });
});
