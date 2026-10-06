import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";

// Crit 8's "it's alive": a stranger can visit, do the core thing, and find
// their trace still there when they come back.
const baseUrl = inject("baseUrl");
const url = (path: string) => new URL(path, baseUrl);

async function post(path: string, fields: Record<string, string>, cookie?: string): Promise<Response> {
  return fetch(url(path), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", ...(cookie ? { cookie } : {}) },
    body: new URLSearchParams(fields),
  });
}

const sessionCookie = (res: Response): string => {
  const sid = res.headers.getSetCookie().find((c) => c.startsWith("sid="));
  expect(sid, "no session cookie set").toBeDefined();
  return sid!.split(";")[0];
};

const page = async (path: string, cookie: string): Promise<string> => {
  const html = await (await fetch(url(path), { headers: { cookie } })).text();
  return new JSDOM(html).window.document.body.textContent ?? "";
};

describe("a stranger's trace persists", () => {
  const username = `spec_${Date.now().toString(36)}`;
  const password = "correct horse battery";

  it("registers, leaves the shelter, and finds the trip again after logging back in", async () => {
    const reg = await post("/register", { username, password });
    expect(reg.status).toBe(303);
    const first = sessionCookie(reg);

    const go = await post("/world/depart", { destination: "reservoir" }, first);
    expect(go.status).toBe(303);

    await post("/logout", {}, first);

    const login = await post("/login", { username, password });
    expect(login.status).toBe(303);
    const second = sessionCookie(login);
    expect(second).not.toBe(first);

    const activity = await page("/activity", second);
    expect(activity).toContain("Dry Reservoir");
    expect(activity).toContain("left the shelter");
    expect(await page("/", second)).toContain(`${username}'s shelter`);
  });

  it("won't start a second trip while one is under way", async () => {
    const login = await post("/login", { username, password });
    const res = await post("/world/depart", { destination: "workshop" }, sessionCookie(login));
    expect(res.status).toBe(409);
  });

  it("rejects a wrong password and a taken name", async () => {
    expect((await post("/login", { username, password: "not the password" })).status).toBe(401);
    expect((await post("/register", { username, password })).status).toBe(409);
  });

  it("keeps the game behind a login", async () => {
    const res = await fetch(url("/world"), { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });
});
