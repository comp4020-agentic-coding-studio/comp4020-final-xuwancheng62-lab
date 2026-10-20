import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Crit 10: whoever runs `flyctl logs` can say who did what to whom. The shared
// app's output isn't readable from here, so this starts its own copy of the
// server on a throwaway database and reads what it prints.
const port = 20_000 + Math.floor(Math.random() * 20_000);
const base = `http://localhost:${port}`;
const dir = mkdtempSync(join(tmpdir(), "holdout-logging-"));
let server: ChildProcess;
let out = "";

beforeAll(async () => {
  server = spawn(process.execPath, ["src/server.ts"], { env: { ...process.env, PORT: String(port), DATA_DIR: dir }, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout!.on("data", (d) => (out += d));
  server.stderr!.on("data", (d) => (out += d));
  for (let i = 0; !out.includes("listening on"); i++) {
    if (i > 150) throw new Error(`server didn't start:\n${out}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}, 20_000);

afterAll(() => {
  server?.kill();
  rmSync(dir, { recursive: true, force: true });
});

const post = (path: string, fields: Record<string, string>, cookie = "") =>
  fetch(base + path, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", ...(cookie ? { cookie } : {}) },
    body: new URLSearchParams(fields),
  });

const tag = Date.now().toString(36);
const password = "correct horse battery";
async function player(name: string) {
  const res = await post("/register", { username: name, password });
  expect(res.status).toBe(303);
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("sid="))!.split(";")[0];
  const home = await (await fetch(base + "/", { headers: { cookie } })).text();
  return { name, cookie, shelter: home.match(/\/shelters\/\d+/)![0] };
}

// lines are written once the response is done, so give the last one a moment to land
async function lines(): Promise<string[]> {
  await new Promise((r) => setTimeout(r, 200));
  return out.split("\n");
}
const find = (all: string[], ...parts: string[]) => all.find((l) => parts.every((p) => l.includes(p)));

describe("the server log says who did what", () => {
  it("tells two players apart, names who an action was aimed at, and records refusals", async () => {
    const alice = await player(`log_a${tag}`);
    const bob = await player(`log_b${tag}`);

    await fetch(base + bob.shelter, { headers: { cookie: alice.cookie } });
    expect((await post(`${bob.shelter}/steal`, { resource: "food", request_id: randomUUID() }, alice.cookie)).status).toBe(303);
    expect((await post(`${alice.shelter}/steal`, { resource: "food", request_id: "not-a-uuid" }, bob.cookie)).status).toBe(400);

    const all = await lines();
    const a = new RegExp(`user=${alice.name}#\\d+`);
    expect(find(all, "POST /register 303", `name=${alice.name}`)).toMatch(a);
    expect(find(all, `GET ${bob.shelter} 200`)).toMatch(new RegExp(`${a.source} target=${bob.name}#\\d+`));
    expect(find(all, `POST ${bob.shelter}/steal 303`, "resource=food")).toMatch(new RegExp(`${a.source} target=${bob.name}#\\d+`));
    expect(find(all, `POST ${alice.shelter}/steal 400`)).toMatch(new RegExp(`user=${bob.name}#\\d+ target=${alice.name}#\\d+`));
  });

  it("never prints a password or what someone said, and skips anonymous noise", async () => {
    const carol = await player(`log_c${tag}`);
    const secret = `whisper-${tag}`;
    await post(`${carol.shelter}/talk`, { body: secret, request_id: randomUUID() }, carol.cookie);
    await post("/login", { username: carol.name, password: "wrong password here" });
    await fetch(base + "/static/app.js");

    const all = await lines();
    expect(find(all, "POST /login 401", `name=${carol.name}`)).toContain("user=-");
    expect(find(all, `POST ${carol.shelter}/talk`)).toContain(`chars=${secret.length}`);
    expect(out).not.toContain(secret);
    expect(out).not.toContain(password);
    expect(out).not.toContain("wrong password here");
    expect(out).not.toContain("/static/");
  });
});
