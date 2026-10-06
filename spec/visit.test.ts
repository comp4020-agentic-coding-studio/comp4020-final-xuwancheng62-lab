import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";

// Looking into another shelter is instant, shows only rough levels, and never
// moves your own survivor. While the owner is home you're shown inside with
// them; while they're out the hatch is sealed and nobody is inside.
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
const post = (path: string, fields: Record<string, string>, cookie: string) =>
  fetch(url(path), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie },
    body: new URLSearchParams(fields),
  });
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

  it("shows the owner and you inside while the owner is home", async () => {
    const doc = new JSDOM(await (await get(hostAddress, visitor)).text()).window.document;
    for (const scene of doc.querySelectorAll(".sc")) {
      const people = [...scene.querySelectorAll(".sv")];
      expect(people).toHaveLength(2);
      expect(people.map((p) => p.querySelector(".sv-tag")?.textContent?.trim())).toEqual([`spec_h${tag}`, "You"]);
    }
  });

  it("leaves nobody inside while the owner is out", async () => {
    expect((await post("/world/depart", { destination: "reservoir" }, host)).status).toBe(303);
    const doc = new JSDOM(await (await get(hostAddress, visitor)).text()).window.document;
    expect(doc.querySelectorAll(".sc").length).toBeGreaterThan(0);
    expect(doc.querySelectorAll(".sv")).toHaveLength(0);
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
