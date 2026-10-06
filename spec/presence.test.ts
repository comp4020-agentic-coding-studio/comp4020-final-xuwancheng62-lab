import { JSDOM } from "jsdom";
import { expect, inject, it } from "vitest";

// Someone looking into your shelter shows up at your gate, live, by name.
const baseUrl = inject("baseUrl");
const url = (path: string) => new URL(path, baseUrl);
const tag = Date.now().toString(36);

async function register(name: string): Promise<{ cookie: string; address: string }> {
  const res = await fetch(url("/register"), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: name, password: "correct horse battery" }),
  });
  expect(res.status).toBe(303);
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("sid="))!.split(";")[0];
  const home = await (await fetch(url("/"), { headers: { cookie } })).text();
  return { cookie, address: home.match(/\/shelters\/(\d+)/)![0] };
}

function listen(cookie: string, watch?: string) {
  const ctrl = new AbortController();
  let seen = "";
  const ready = fetch(url(`/events${watch ? `?watch=${watch}` : ""}`), { headers: { cookie }, signal: ctrl.signal }).then(async (res) => {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          seen += decoder.decode(value);
        }
      } catch {}
    })();
  });
  return {
    ready,
    close: () => ctrl.abort(),
    // the latest presence event whose data matches
    async until(match: (visitors: string[]) => boolean, ms: number): Promise<number> {
      const start = performance.now();
      while (performance.now() - start < ms) {
        const events = [...seen.matchAll(/event: presence\ndata: (.*)\n/g)].map((m) => JSON.parse(m[1]));
        const last = events.at(-1);
        if (last && match(last.visitors.map((v: { name: string }) => v.name))) return performance.now() - start;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error("no matching presence event");
    },
  };
}
const gate = async (cookie: string) =>
  new JSDOM(await (await fetch(url("/"), { headers: { cookie } })).text()).window.document.querySelector(".sc-gate")?.textContent ?? "";

it("shows a visitor at the owner's gate within a second, and lets them leave", async () => {
  const owner = await register(`spec_o${tag}`);
  const visitor = await register(`spec_v${tag}`);
  const id = owner.address.split("/").pop()!;

  const ownerStream = listen(owner.cookie);
  await ownerStream.ready;
  const visit = listen(visitor.cookie, id);
  await visit.ready;
  expect(await ownerStream.until((v) => v.includes(`spec_v${tag}`), 1500)).toBeLessThan(1000);
  expect(await gate(owner.cookie)).toContain(`spec_v${tag}`);

  visit.close();
  await ownerStream.until((v) => !v.includes(`spec_v${tag}`), 8000);
  expect(await gate(owner.cookie)).not.toContain(`spec_v${tag}`);
  ownerStream.close();
}, 15_000);

it("never puts you at your own gate", async () => {
  const owner = await register(`spec_s${tag}`);
  const own = listen(owner.cookie, owner.address.split("/").pop());
  await own.ready;
  await new Promise((r) => setTimeout(r, 300));
  expect(await gate(owner.cookie)).not.toContain(`spec_s${tag}`);
  own.close();
});
