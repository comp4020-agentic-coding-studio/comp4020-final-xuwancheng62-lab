import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";
import { openDb, tx } from "../src/db.ts";
import { WORLD_CHAT } from "../src/game/config.ts";
import { createParty, joinParty } from "../src/parties.ts";
import { createShelter } from "../src/shelter.ts";
import { chatChannel, recentChat, sayToWorld } from "../src/worldChat.ts";

// World chat (PLAN.md, "World chat"): everyone hears it, live; it's plain
// text, said once however often a form is retried; and a party's recruit
// card goes up when the party is called. Over HTTP, then on a throwaway
// database for the parts a newcomer can't reach.

const baseUrl = inject("baseUrl");
const url = (path: string) => new URL(path, baseUrl);
const tag = `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function register(name: string): Promise<string> {
  const res = await fetch(url("/register"), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: name, password: "correct horse battery" }),
  });
  expect(res.status).toBe(303);
  return res.headers.getSetCookie().find((c) => c.startsWith("sid="))!.split(";")[0];
}
const say = (cookie: string, body: string, requestId: string = randomUUID()) =>
  fetch(url("/chat"), { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: new URLSearchParams({ body, request_id: requestId }) });
const chatLines = async (cookie: string) =>
  [...new JSDOM(await (await fetch(url("/social?channel=world"), { headers: { cookie } })).text()).window.document.querySelectorAll("#chat [data-chat-log] li")].map((li) => ({
    who: li.querySelector("b")?.textContent,
    said: li.querySelector("p")?.textContent,
    scripts: li.querySelectorAll("script").length,
  }));

describe("world chat over HTTP", () => {
  it("reaches someone else live, within a second, and stays in the unified world channel", async () => {
    const a = await register(`spec_ca${tag}`);
    const b = await register(`spec_cb${tag}`);
    const ctrl = new AbortController();
    let seen = "";
    const res = await fetch(url("/events"), { headers: { cookie: b }, signal: ctrl.signal });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    void (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          seen += decoder.decode(value);
        }
      } catch {}
    })();
    await pause(200);
    const start = performance.now();
    expect((await say(a, `Anyone for the Lower Deck? ${tag}`)).status).toBe(303);
    while (!seen.includes(tag) && performance.now() - start < 1500) await pause(25);
    ctrl.abort();
    expect(seen).toMatch(/event: chat\ndata: .*Anyone for the Lower Deck\?/);
    expect(performance.now() - start).toBeLessThan(1000);
    expect(await chatLines(b)).toContainEqual({ who: `spec_ca${tag}`, said: `Anyone for the Lower Deck? ${tag}`, scripts: 0 });
  });

  it("is plain text, said once per form, and not too fast or too long", async () => {
    const me = await register(`spec_cc${tag}`);
    const rid = randomUUID();
    expect((await say(me, `<script>alert(1)</script>${tag}`, rid)).status).toBe(303);
    expect((await say(me, `<script>alert(1)</script>${tag}`, rid)).status).toBe(303);
    const mine = (await chatLines(me)).filter((l) => l.said?.includes(tag) && l.who === `spec_cc${tag}`);
    expect(mine).toEqual([{ who: `spec_cc${tag}`, said: `<script>alert(1)</script>${tag}`, scripts: 0 }]);
    expect((await say(me, "again, straight away")).status).toBe(429);
    expect((await say(me, "   ")).status).toBe(400);
    expect((await say(me, "x".repeat(WORLD_CHAT.maxLength + 1))).status).toBe(400);
    expect((await say(me, "hi", "not-a-uuid")).status).toBe(400);
  });
});

describe("recruit cards and party news", () => {
  const T0 = 1_800_000_000_000;
  function world() {
    const db = openDb(mkdtempSync(join(tmpdir(), "holdout-chat-")));
    const player = (name: string) =>
      tx(db, () => {
        const { lastInsertRowid } = db.prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, 'x', ?)").run(name, T0);
        createShelter(db, Number(lastInsertRowid), name, T0);
        return Number(lastInsertRowid);
      });
    return { db, player };
  }

  it("posts a card when a party is called, and tells the party when someone joins and when it leaves", () => {
    const { db, player } = world();
    const a = player("ana");
    const b = player("ben");
    db.prepare("INSERT INTO discoveries (shelter_id, fragment_id, found_at) SELECT id, 'day-fifteen', ? FROM shelters WHERE user_id = ?").run(T0, a);
    const called = createParty(db, a, { who: "you", row: "front", size: "2", approach: "fight", retreat: "half", min_level: "1" }, T0);
    expect(called.ok).toBe(true);
    const id = (called as { partyId: number }).partyId;
    const card = recentChat(db, "ana", T0).find((l) => l.partyId === id)!;
    expect(card).toMatchObject({ author: "ana" });
    expect(card.body).toContain("Gathering 2 for The Lower Deck");
    expect((called as { events: { event: string }[] }).events.map((e) => e.event)).toEqual(expect.arrayContaining(["chat", "party"]));
    const joined = joinParty(db, b, id, {}, T0 + 1) as { ok: true; events: { channel: string; event: string; data: { message?: string } }[] };
    const toAna = joined.events.filter((e) => e.channel === `user:${a}` && e.event === "alert").map((e) => e.data.message);
    expect(toAna.some((m) => m?.includes("ben joined your party"))).toBe(true);
    expect(toAna.some((m) => m?.includes("The party left"))).toBe(true);
    expect(joined.events.some((e) => e.channel === `user:${b}` && e.data.message?.includes("The party left"))).toBe(true);
    expect(joined.events.some((e) => e.event === "party")).toBe(true);
  });

  it("keeps the spec run's lines away from everyone else", () => {
    const { db, player } = world();
    const real = player("ruth_fan");
    const spec = player("spec_robot");
    expect(sayToWorld(db, spec, "beep", randomUUID(), T0).ok).toBe(true);
    expect(sayToWorld(db, real, "hello", randomUUID(), T0).ok).toBe(true);
    expect(recentChat(db, "ruth_fan", T0 + 1).map((l) => l.body)).toEqual(["hello"]);
    expect(recentChat(db, "spec_other", T0 + 1).map((l) => l.body)).toEqual(["beep", "hello"]);
    expect(chatChannel("spec_robot")).toBe("chat:spec");
    expect(chatChannel("ruth_fan")).toBe("chat");
  });

  it("forgets lines after a day", () => {
    const { db, player } = world();
    const a = player("ana");
    expect(sayToWorld(db, a, "old news", randomUUID(), T0).ok).toBe(true);
    expect(recentChat(db, "ana", T0 + WORLD_CHAT.keepMs + 1)).toEqual([]);
  });
});
