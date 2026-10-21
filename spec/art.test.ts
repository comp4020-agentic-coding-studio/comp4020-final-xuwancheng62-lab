import { JSDOM } from "jsdom";
import { expect, inject, it } from "vitest";

// The shelter is painted, and every player has a portrait: the same face on
// their Survivors card, at the top of their shelter, and beside what they say.
const baseUrl = inject("baseUrl");
const url = (path: string) => new URL(path, baseUrl);
const tag = `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

async function register(name: string): Promise<{ cookie: string; id: string }> {
  const res = await fetch(url("/register"), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: name, password: "correct horse battery" }),
  });
  expect(res.status).toBe(303);
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("sid="))!.split(";")[0];
  const home = await (await fetch(url("/"), { headers: { cookie } })).text();
  return { cookie, id: home.match(/\/shelters\/(\d+)/)![1] };
}
const page = async (path: string, cookie: string) =>
  new JSDOM(await (await fetch(url(path), { headers: { cookie } })).text()).window.document;
const loads = async (src: string | null) => (await fetch(url(src!))).status;

it("paints every room of the shelter and everything in it, on both layouts", async () => {
  const me = await register(`spec_r${tag}`);
  const doc = await page("/", me.cookie);
  for (const svg of doc.querySelectorAll(".sc-svg")) {
    expect(svg.querySelectorAll(".backdrop").length).toBe(svg.querySelectorAll(".room").length);
    expect(svg.querySelector(".sc-mountain")).not.toBeNull();
    expect(svg.querySelector(".sc-entry-corridor")).not.toBeNull();
    for (const k of ["generator", "purifier", "food", "water", "scrap", "quarters", "greenhouse", "hatch"]) expect(svg.querySelector(`.eq-${k} image`)).not.toBeNull();
    // stock stands on the shelves as separate painted items, not part of a picture
    for (const k of ["food", "water"]) {
      const items = svg.querySelectorAll(`.eq-${k} image`).length - 1; // less the shelf
      expect(items).toBeGreaterThan(0);
      expect(items).toBeLessThanOrEqual(9);
    }
    const art = [...svg.querySelectorAll("image")].map((i) => i.getAttribute("href"));
    for (const src of new Set(art)) expect(await loads(src)).toBe(200);
  }
});

it("shows the same portrait for a player everywhere they appear", async () => {
  const owner = await register(`spec_o${tag}`);
  const visitor = await register(`spec_v${tag}`);

  const own = (await page("/", owner.cookie)).querySelector(".sh-head img")!.getAttribute("src");
  expect(await loads(own)).toBe(200);

  expect((await page(`/shelters/${owner.id}`, visitor.cookie)).querySelector(".sh-head img")!.getAttribute("src")).toBe(own);

  // The Survivors list leaves out spec accounts, so on a fresh database (CI) it
  // is empty; where real players are listed, check whichever card comes first.
  const card = (await page("/world", visitor.cookie)).querySelector("[data-shelter-id]");
  if (card) {
    const face = card.querySelector("img")!.getAttribute("src");
    expect(await loads(face)).toBe(200);
    const there = await page(`/shelters/${card.getAttribute("data-shelter-id")}`, visitor.cookie);
    expect(card.textContent).toContain(there.querySelector("[data-live-status-text]")!.textContent!.replace(/ is (home|out).*/, ""));
    expect(there.querySelector(".sh-head img")!.getAttribute("src")).toBe(face);
  }

  const said = await fetch(url(`/shelters/${owner.id}/talk`), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", cookie: owner.cookie },
    body: new URLSearchParams({ body: "hello", request_id: crypto.randomUUID() }),
  });
  expect(said.status).toBe(200);
  const line = (await page(`/social?channel=shelter:${owner.id}`, visitor.cookie)).querySelector(".sh-talk-log li")!;
  expect(line.querySelector("img")!.getAttribute("src")).toBe(own);
});

it("lets you pick your portrait when you register, from every one there is", async () => {
  const form = new JSDOM(await (await fetch(url("/register"))).text()).window.document;
  const choices = [...form.querySelectorAll<HTMLInputElement>("input[name=portrait]")];
  expect(choices.length).toBeGreaterThanOrEqual(12);
  expect(choices.filter((c) => c.checked)).toHaveLength(1);
  for (const c of choices) expect(c.closest("label")!.querySelector("img")!.getAttribute("alt")).toBeTruthy();

  const pick = choices.at(-1)!.value;
  const res = await fetch(url("/register"), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: `spec_p${tag}`, password: "correct horse battery", portrait: pick }),
  });
  expect(res.status).toBe(303);
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("sid="))!.split(";")[0];
  const src = (await page("/", cookie)).querySelector(".sh-head img")!.getAttribute("src");
  expect(src).toBe(choices.at(-1)!.closest("label")!.querySelector("img")!.getAttribute("src"));

  const bad = await fetch(url("/register"), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: `spec_q${tag}`, password: "correct horse battery", portrait: String(choices.length + 1) }),
  });
  expect(bad.status).toBe(400);
});

// In the scene a player is the person in their portrait, standing whole: the
// same figure in their own shelter and on a visit, and a guest let in shows
// their own figure, not a stand-in.
it("draws each player in the shelter as the person in their portrait", async () => {
  const join = async (name: string, portrait: string) => {
    const res = await fetch(url("/register"), {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: name, password: "correct horse battery", portrait }),
    });
    expect(res.status).toBe(303);
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith("sid="))!.split(";")[0];
    const home = await page("/", cookie);
    return { cookie, id: home.querySelector(".sh")!.getAttribute("data-scene-shelter")!, home };
  };
  const figure = (doc: Document, sel: string) => {
    const srcs = [...doc.querySelectorAll(`.sc-svg ${sel} .sv-painted`)].map((i) => i.getAttribute("href"));
    expect(srcs).toHaveLength(2); // the wide and the tall layout
    expect(srcs[0]).toBe(srcs[1]);
    return srcs[0];
  };
  const owner = await join(`spec_f${tag}`, "4");
  const guest = await join(`spec_g${tag}`, "9");
  const ownerFigure = figure(owner.home, ".sv:not(.sv--guest):not(.sv--resident)");
  const guestFigure = figure(guest.home, ".sv:not(.sv--guest):not(.sv--resident)");
  expect(await loads(ownerFigure)).toBe(200);
  expect(guestFigure).not.toBe(ownerFigure);

  const visit = await page(`/shelters/${owner.id}`, guest.cookie);
  expect(figure(visit, ".sv:not(.sv--guest):not(.sv--resident)")).toBe(ownerFigure);
  expect(figure(visit, ".sv--guest")).toBe(guestFigure);
});

// Everyone in the scene has their name over their head, your own survivor
// included, and anyone you can click to talk to has something to say.
it("names everyone in the shelter scene and gives each of them lines", async () => {
  const me = await register(`spec_n${tag}`);
  const doc = await page("/", me.cookie);
  const you = [...doc.querySelectorAll(".sc-svg .sv:not(.sv--resident)")];
  expect(you).toHaveLength(2);
  for (const sv of you) expect(sv.querySelector(".sv-tag")?.textContent?.trim()).toBe(`spec_n${tag}`);
  const { chatter } = JSON.parse(doc.querySelector(".sc-sayings")!.textContent!);
  for (const sv of doc.querySelectorAll(".sc-svg .sv[data-talk]")) expect(chatter.lines[sv.getAttribute("data-talk")!].length).toBeGreaterThan(0);
});

// Two players who picked the same portrait look alike, and say so when one
// visits the other; anyone else doesn't.
it("has look-alike players remark on it when one visits the other", async () => {
  const join = async (name: string, portrait: string) => {
    const res = await fetch(url("/register"), {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: name, password: "correct horse battery", portrait }),
    });
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith("sid="))!.split(";")[0];
    const home = await page("/", cookie);
    return { cookie, id: home.querySelector(".sh")!.getAttribute("data-scene-shelter")! };
  };
  const host = await join(`spec_t${tag}`, "5");
  const twin = await join(`spec_u${tag}`, "5");
  const other = await join(`spec_w${tag}`, "6");
  const lines = async (cookie: string) => {
    const doc = await page(`/shelters/${host.id}`, cookie);
    const { chatter } = JSON.parse(doc.querySelector(".sc-sayings")!.textContent!);
    return chatter.chats.flat().map((l: { line: string }) => l.line).join(" ");
  };
  expect(await lines(twin.cookie)).toMatch(/look just like me/);
  expect(await lines(other.cookie)).not.toMatch(/look just like me/);
});
