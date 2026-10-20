import { randomUUID } from "node:crypto";
import { describe, expect, inject, it } from "vitest";
import { JSDOM } from "jsdom";
const base = inject("baseUrl");
const stamp = Date.now().toString(36);
async function post(path: string, fields: Record<string, string>, cookie = "") {
  return fetch(new URL(path, base), { method: "POST", redirect: "manual", headers: { cookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields) });
}
async function player(suffix: string) {
  const name = `spec_s${stamp}${suffix}`;
  const r = await post("/register", { username: name, password: "correct horse battery" });
  expect(r.status).toBe(303);
  return { name, cookie: r.headers.getSetCookie().find((s) => s.startsWith("sid="))!.split(";")[0] };
}
const page = async (path: string, cookie: string) => new JSDOM(await (await fetch(new URL(path, base), { headers: { cookie } })).text()).window.document;
describe("unified chat authorization and persistence", () => {
  it("protects private messages, deduplicates sends, and counts unread until explicitly read", async () => {
    const a = await player("a"), b = await player("b"), stranger = await player("c");
    await post("/social/friends", { name: b.name }, a.cookie);
    await post("/social/friends", { name: a.name }, b.cookie);
    const aHub = await page("/social?channel=friends", a.cookie);
    const bHub = await page("/social?channel=friends", b.cookie);
    const toB = aHub.querySelector<HTMLAnchorElement>('a[href*="channel=dm:"]')!.getAttribute("href")!;
    const toA = bHub.querySelector<HTMLAnchorElement>('a[href*="channel=dm:"]')!.getAttribute("href")!;
    const keyB = new URL(toB, base).searchParams.get("channel")!;
    const keyA = new URL(toA, base).searchParams.get("channel")!;
    const f = { channel: keyB, body: '<script>private</script>', request_id: randomUUID() };
    expect((await post("/social/message", f, a.cookie)).status).toBe(303);
    expect((await post("/social/message", f, a.cookie)).status).toBe(303);
    const dm = await page(toA, b.cookie);
    const lines = dm.querySelectorAll('[data-social-messages] li');
    expect(lines.length).toBe(1);
    expect(lines[0].textContent).toContain(f.body);
    expect(lines[0].querySelector('script')).toBeNull();
    expect((await fetch(new URL(toB, base), { headers: { cookie: stranger.cookie } })).status).toBe(403);
    expect((await post("/social/message", { ...f, request_id: randomUUID() }, stranger.cookie)).status).toBe(403);
    const status = () => fetch(new URL('/social/status', base), { headers: { cookie: b.cookie } }).then(r => r.json());
    expect((await status()).unread).toBe(1);
    await post('/social/pulse', { channel: keyA, seen: lines[0].getAttribute('data-message-id')! }, b.cookie);
    expect((await status()).unread).toBe(0);
    await post(`/social/friends/${keyB.split(':')[1]}/remove`, {}, a.cookie);
    expect((await fetch(new URL(toB, base), { headers: { cookie: a.cookie } })).status).toBe(403);
  });
  it("limits party chat to members and makes the unified drawer available throughout the game", async () => {
    const a = await player("d"), b = await player("e");
    const r = await post('/parties', { dungeon: 'freight-yard', size: '3', approach: 'sneak', retreat: 'half', who: 'you', row: 'front' }, a.cookie);
    expect(r.status).toBe(303);
    const id = r.headers.get('location')!.split('#party-')[1];
    expect((await post('/social/message', { channel: `party:${id}`, body: 'Ready?', request_id: randomUUID() }, b.cookie)).status).toBe(403);
    expect((await post(`/parties/${id}/join`, { who: 'you', row: 'front' }, b.cookie)).status).toBe(303);
    expect((await post('/social/message', { channel: `party:${id}`, body: 'Ready?', request_id: randomUUID() }, b.cookie)).status).toBe(303);
    expect((await page(`/social?channel=party:${id}`, a.cookie)).querySelector('[data-social-messages]')!.textContent).toContain('Ready?');
    for (const path of ['/', '/world', '/journal', '/collection', '/expeditions']) expect((await page(path, a.cookie)).querySelector('[data-social-frame]')).not.toBeNull();
    expect((await page('/world', a.cookie)).querySelector('[data-world-chat]')).toBeNull();
    expect((await page('/', a.cookie)).querySelector('[data-talk-log]')).toBeNull();
  });
});

it('accepts an unanswered invitation over HTTP after eight seconds, only once', async () => {
  const a = await player('ia'), b = await player('ib');
  await post('/social/friends', { name: b.name }, a.cookie);
  await post('/social/friends', { name: a.name }, b.cookie);
  const hub = await page('/social?channel=friends', a.cookie);
  const key = new URL(hub.querySelector<HTMLAnchorElement>('a[href*="channel=dm:"]')!.getAttribute('href')!, base).searchParams.get('channel')!;
  const friend = key.split(':')[1];
  await post('/social/dispatch', { who: 'you', row: 'front', risk: 'grim' }, b.cookie);
  const made = await post('/parties', { dungeon: 'freight-yard', size: '2', approach: 'sneak', retreat: 'half' }, a.cookie);
  const party = made.headers.get('location')!.split('#party-')[1];
  expect((await post('/social/invite', { party, friend, channel: key }, a.cookie)).status).toBe(303);
  const offered = await page('/social?channel=world', b.cookie);
  const form = offered.querySelector<HTMLFormElement>('form[action^="/social/invites/"]')!;
  expect(form).not.toBeNull();
  expect((await post(form.getAttribute('action')!, { answer: 'decline' }, a.cookie)).status).toBe(403);
  // still waiting a second before the deadline
  await new Promise((r) => setTimeout(r, 7000));
  expect((await page('/expeditions', a.cookie)).querySelector(`#party-${party}`)!.textContent).not.toContain('Out on');
  await new Promise((r) => setTimeout(r, 1200));
  // The next request resolves the persisted deadline, even though B did not act.
  const after = await page('/expeditions', a.cookie);
  expect(after.querySelector(`#party-${party}`)!.textContent).toContain('Out on Abandoned Freight Yard');
  expect((await page(`/social?channel=${key}`, a.cookie)).querySelector('[data-social-thread]')!.textContent).toContain('accepted');
  expect((await post(form.getAttribute('action')!, { answer: 'decline' }, b.cookie)).status).toBe(303);
  expect((await page('/expeditions', a.cookie)).querySelector(`#party-${party}`)!.textContent).toContain('Out on Abandoned Freight Yard');
}, 20000);
