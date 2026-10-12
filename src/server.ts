import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { raw } from "hono/html";
import { streamSSE } from "hono/streaming";
import { marked } from "marked";
import { hashPassword, hashToken, MIN_PASSWORD, newToken, USERNAME, verifyPassword } from "./auth.ts";
import { openDb, tx } from "./db.ts";
import { SESSION_TTL_MS } from "./game/config.ts";
import { createShelter, depart, listSurvivors, loadShelter, loadShelterById, recentLog } from "./shelter.ts";
import { harvest, plant, type TendResult } from "./greenhouse.ts";
import { help, interactionFor, steal, visitOptions, type ActionResult } from "./interactions.ts";
import { isPortrait, PORTRAITS, publicShelter } from "./public.ts";
import { arrive, leave, publish, subscribe, visitorsOf } from "./realtime.ts";
import { shelterScreen, visitScreen } from "./shelterScreen.ts";
import { recentTalk, say } from "./talk.ts";
import { carrySupply, equip, meal, setTask, train, unequip, type GearResult } from "./character.ts";
import { useAtHome, useMaterial } from "./items.ts";
import { befriend, createParty, dispatchFriend, dispatchOf, eventsSoFar, friendsOf, joinParty, leaveSeat, openParties, partyRow, pastParties, partyView, repostRecruit, setDispatch, unfriend, type PartyResult, type PartyView } from "./parties.ts";
import { isSpec, recentChat, sayToWorld } from "./worldChat.ts";
import { chatPanel } from "./chatViews.ts";
import { expeditionsPage } from "./expeditionViews.ts";
import { attack, escape, useItem, type FightResult } from "./encounter.ts";
import * as v from "./views.ts";
import { journalPage } from "./journalViews.ts";
import { foundIds, foundRecords } from "./stories.ts";
import { inspectPurifier } from "./inspect.ts";
import { inviteToby, progressOf, questState } from "./quests.ts";
import { LAST_REPLY, ready } from "./game/quests.ts";
import { canRead, collectionSet, panels, SETS } from "./game/collections.ts";
import { rewarded } from "./collections.ts";
import { collectionPage, comicLocked, comicPage } from "./collectionViews.ts";

const db = openDb();
const readmeHtml = await marked.parse(readFileSync("README.md", "utf8"));
const DUMMY_HASH = hashPassword("timing-equaliser");

type User = { id: number; username: string };
type Env = { Variables: { user: User | null } };
const app = new Hono<Env>();

app.use("/static/*", serveStatic({ root: "./" }));
app.use("/docs/*", serveStatic({ root: "./" }));

// Cross-site form posts carry a foreign Origin; same-site ones and non-browser
// clients either match or send none.
app.use("*", async (c, next) => {
  if (c.req.method === "POST") {
    const origin = c.req.header("origin");
    if (origin && origin !== "null" && new URL(origin).host !== c.req.header("host")) {
      return c.text("Cross-site request refused", 403);
    }
  }
  await next();
});

app.use("*", async (c, next) => {
  const token = getCookie(c, "sid");
  let user: User | null = null;
  if (token) {
    user = (db
      .prepare(
        `SELECT users.id, users.username FROM sessions JOIN users ON users.id = sessions.user_id
         WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
      )
      .get(hashToken(token), Date.now()) as User | undefined) ?? null;
  }
  c.set("user", user);
  await next();
});

function startSession(c: Context<Env>, userId: number): void {
  const token = newToken();
  const now = Date.now();
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(hashToken(token), userId, now + SESSION_TTL_MS);
  setCookie(c, "sid", token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: c.req.header("x-forwarded-proto") === "https",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

async function credentials(c: Context<Env>): Promise<{ username: string; password: string; portrait: string }> {
  const form = await c.req.parseBody();
  return { username: String(form.username ?? "").trim(), password: String(form.password ?? ""), portrait: String(form.portrait ?? "") };
}

app.get("/", (c) => {
  const user = c.get("user");
  if (!user) return c.html(v.layout({ title: "Welcome", tab: "none", body: v.landing() }));
  const now = Date.now();
  const shelter = loadShelter(db, user.id, now);
  return c.html(
    v.layout({ title: "Shelter", tab: "shelter", user: user.username, shelter, body: shelterScreen(shelter, now, ownCtx(shelter.id, now)), extraStyle: "/static/shelter.css", extraScript: "/static/scene.js" }),
  );
});

// What the own page needs besides the shelter: who's at the gate and what's
// been said there.
const ownCtx = (shelterId: number, now: number) => ({
  found: foundIds(db, shelterId),
  visitors: visitorsOf(shelterId),
  talk: recentTalk(db, shelterId, now),
  talkRequestId: randomUUID(),
  // the last step of The Last Reply, ready to take
  inviteToby: ready(LAST_REPLY, "bench", questState(db, shelterId, LAST_REPLY.id)),
});

async function tend(c: Context<Env>, run: (userId: number, form: Record<string, unknown>) => TendResult, open: "greenhouse" | "purifier" | "quarters" = "greenhouse") {
  const user = c.get("user");
  if (!user) return c.redirect("/login", 303);
  const result = run(user.id, await c.req.parseBody());
  if (result.ok) return c.redirect(`/#info-${open}`, 303);
  const now = Date.now();
  const shelter = loadShelter(db, user.id, now);
  return c.html(
    v.layout({
      title: "Shelter",
      tab: "shelter",
      user: user.username,
      shelter,
      body: shelterScreen(shelter, now, { ...ownCtx(shelter.id, now), error: result.reason, open }),
      extraStyle: "/static/shelter.css",
      extraScript: "/static/scene.js",
    }),
    result.status,
  );
}

app.post("/greenhouse/plant", (c) => tend(c, (id, f) => plant(db, id, String(f.slot ?? ""), String(f.crop ?? ""), Date.now())));
app.post("/greenhouse/harvest", (c) => tend(c, (id, f) => harvest(db, id, String(f.slot ?? ""), Date.now())));
app.post("/purifier/inspect", (c) => tend(c, (id) => inspectPurifier(db, id, Date.now()), "purifier"));
app.post("/quests/last-reply/invite", (c) => tend(c, (id) => inviteToby(db, id, Date.now()), "quarters"));

app.get("/register", (c) => c.html(v.layout({ title: "Register", tab: "none", body: v.authPage("register") })));
app.get("/login", (c) => c.html(v.layout({ title: "Log in", tab: "none", body: v.authPage("login") })));

app.post("/register", async (c) => {
  const { username, password, portrait: picked } = await credentials(c);
  // no choice sent (an old form, or a script) gets one at random
  const portrait = picked === "" ? 1 + Math.floor(Math.random() * PORTRAITS.length) : Number(picked);
  const fail = (msg: string, status: 400 | 409) =>
    c.html(v.layout({ title: "Register", tab: "none", body: v.authPage("register", msg, isPortrait(portrait) ? portrait : undefined) }), status);
  if (!USERNAME.test(username)) return fail("Names are 3–20 letters, digits, - or _.", 400);
  if (password.length < MIN_PASSWORD) return fail(`Passwords need at least ${MIN_PASSWORD} characters.`, 400);
  if (!isPortrait(portrait)) return fail("Pick one of the survivors.", 400);
  const now = Date.now();
  let userId: number;
  try {
    userId = tx(db, () => {
      const { lastInsertRowid } = db
        .prepare("INSERT INTO users (username, password_hash, created_at, portrait) VALUES (?, ?, ?, ?)")
        .run(username, hashPassword(password), now, portrait);
      createShelter(db, Number(lastInsertRowid), username, now);
      return Number(lastInsertRowid);
    });
  } catch {
    return fail("That name is taken.", 409);
  }
  startSession(c, userId);
  return c.redirect("/", 303);
});

app.post("/login", async (c) => {
  const { username, password } = await credentials(c);
  const row = db.prepare("SELECT id, password_hash FROM users WHERE username = ?").get(username) as
    | { id: number; password_hash: string }
    | undefined;
  const ok = verifyPassword(password, row?.password_hash ?? DUMMY_HASH) && row;
  if (!ok) return c.html(v.layout({ title: "Log in", tab: "none", body: v.authPage("login", "Wrong name or password.") }), 401);
  startSession(c, row.id);
  return c.redirect("/", 303);
});

app.post("/logout", (c) => {
  const token = getCookie(c, "sid");
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
  deleteCookie(c, "sid", { path: "/" });
  return c.redirect("/", 303);
});

app.get("/world", (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
  const now = Date.now();
  const shelter = loadShelter(db, user.id, now);
  const survivors = listSurvivors(db, user.id, now).map((x) => publicShelter(x, now));
  return c.html(v.layout({ title: "World", tab: "world", user: user.username, shelter, body: v.worldPage(shelter, survivors, undefined, foundIds(db, shelter.id), worldChat(user, shelter, now)) }));
});

// World chat (PLAN.md, "World chat"), with each recruit card's party read fresh.
function worldChat(user: User, shelter: ReturnType<typeof loadShelter>, now: number, error?: string) {
  const lines = recentChat(db, user.username, now);
  const parties = new Map<number, PartyView>();
  for (const l of lines) if (l.partyId && !parties.has(l.partyId)) {
    const p = partyRow(db, l.partyId);
    if (p) parties.set(p.id, partyView(db, p));
  }
  return chatPanel(shelter, lines, parties, { me: user.id, requestId: randomUUID(), error });
}
app.post("/chat", async (c) => {
  const user = c.get("user");
  const json = (c.req.header("accept") ?? "").includes("application/json");
  if (!user) return json ? c.json({ reason: "Log in first." }, 401) : c.redirect("/login", 303);
  const form = await c.req.parseBody();
  const result = sayToWorld(db, user.id, String(form.body ?? ""), String(form.request_id ?? ""), Date.now());
  if (result.ok) publish(result.events);
  if (json) return result.ok ? c.json(result.line) : c.json({ reason: result.reason }, result.status);
  if (result.ok) return c.redirect("/world#chat", 303);
  const now = Date.now();
  const shelter = loadShelter(db, user.id, now);
  const survivors = listSurvivors(db, user.id, now).map((x) => publicShelter(x, now));
  return c.html(v.layout({ title: "World", tab: "world", user: user.username, shelter, body: v.worldPage(shelter, survivors, undefined, foundIds(db, shelter.id), worldChat(user, shelter, now, result.reason)) }), result.status);
});

// Your cards, read from your records. Like the journal, only ever your own.
app.get("/collection", (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
  const shelter = loadShelter(db, user.id, Date.now());
  const found = foundIds(db, shelter.id);
  return c.html(v.layout({ title: "Collection", tab: "collection", user: user.username, shelter, body: collectionPage(SETS, found, (id) => rewarded(db, shelter.id, id)), extraStyle: "/static/collection.css" }));
});

app.get("/collection/:set/comic", (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
  const set = collectionSet(c.req.param("set"));
  if (!set) return c.notFound();
  const shelter = loadShelter(db, user.id, Date.now());
  const found = foundIds(db, shelter.id);
  if (!canRead(set, found, Boolean(rewarded(db, shelter.id, set.id)))) {
    return c.html(v.layout({ title: "Collection", tab: "collection", user: user.username, shelter, body: comicLocked(set, found), extraStyle: "/static/collection.css" }), 403);
  }
  const n = Number(c.req.query("page") ?? "1");
  if (!Number.isInteger(n) || n < 1 || n > panels(set).length) return c.notFound();
  return c.html(
    v.layout({ title: `${set.comic.title}, page ${n}`, tab: "collection", user: user.username, shelter, body: comicPage(set, n), extraStyle: "/static/collection.css", extraScript: "/static/comic.js" }),
  );
});

// Your records. Only ever your own: there's no route to anyone else's.
app.get("/journal", (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
  const shelter = loadShelter(db, user.id, Date.now());
  return c.html(v.layout({ title: "Journal", tab: "journal", user: user.username, shelter, body: journalPage(foundRecords(db, shelter.id), progressOf(db, shelter.id)), extraStyle: "/static/journal.css" }));
});

app.post("/world/depart", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login", 303);
  const form = await c.req.parseBody();
  const result = depart(db, user.id, String(form.destination ?? ""), Date.now(), typeof form.focus === "string" ? form.focus : undefined, typeof form.who === "string" ? form.who : "you");
  if (result.ok) {
    const now = Date.now();
    const pub = publicShelter(loadShelterById(db, result.shelterId, now)!, now);
    publish([
      { channel: "world", event: "status", data: pub },
      { channel: `shelter:${result.shelterId}`, event: "status", data: pub },
    ]);
    return c.redirect("/activity", 303);
  }
  const now = Date.now();
  const shelter = loadShelter(db, user.id, now);
  const survivors = listSurvivors(db, user.id, now).map((x) => publicShelter(x, now));
  return c.html(
    v.layout({ title: "World", tab: "world", user: user.username, shelter, body: v.worldPage(shelter, survivors, result.reason, foundIds(db, shelter.id)) }),
    result.status,
  );
});

// Looking into another shelter is instant and changes nothing about your own
// survivor: no journey, no log entry.
function renderVisit(c: Context<Env>, user: User, id: number, extra: { resultId?: number; error?: string }, status: 200 | 400 | 404 | 409 | 429 = 200) {
  const now = Date.now();
  const target = Number.isInteger(id) ? loadShelterById(db, id, now) : null;
  if (!target) return c.text("No shelter there.", 404);
  if (target.userId === user.id) return extra.error ? c.text(extra.error, status) : c.redirect("/");
  const own = loadShelter(db, user.id, now);
  const options = visitOptions(db, user.id, id, now)!;
  const result = extra.resultId ? interactionFor(db, user.id, extra.resultId) : null;
  return c.html(
    v.layout({
      title: target.name,
      tab: "world",
      user: user.username,
      shelter: own,
      body: visitScreen(publicShelter(target, now), options, {
        now,
        requestIds: { steal: randomUUID(), help: randomUUID() },
        viewerId: user.id,
        visitors: visitorsOf(target.id).filter((x) => x.id !== user.id),
        talk: recentTalk(db, target.id, now),
        talkRequestId: randomUUID(),
        result,
        error: extra.error,
      }),
      extraStyle: "/static/shelter.css",
      extraScript: "/static/scene.js",
    }),
    status,
  );
}

app.get("/shelters/:id", (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
  const r = Number(c.req.query("r"));
  return renderVisit(c, user, Number(c.req.param("id")), { resultId: Number.isInteger(r) && r > 0 ? r : undefined });
});

async function act(c: Context<Env>, run: (user: User, id: number, form: Record<string, unknown>) => ActionResult) {
  const user = c.get("user");
  if (!user) return c.redirect("/login", 303);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.text("No shelter there.", 404);
  const result = run(user, id, await c.req.parseBody());
  if (result.ok) {
    publish(result.events);
    return c.redirect(`/shelters/${id}?r=${result.interactionId}`, 303);
  }
  return renderVisit(c, user, id, { error: result.reason }, result.status);
}

app.post("/shelters/:id/steal", (c) =>
  act(c, (user, id, form) => steal(db, user, id, String(form.resource ?? ""), String(form.request_id ?? ""), Date.now())),
);
app.post("/shelters/:id/help", (c) => act(c, (user, id, form) => help(db, user, id, String(form.request_id ?? ""), Date.now())));

// Talking at a shelter, yours or someone else's. The scripted form asks for
// JSON and stays on the page; a plain form post comes back to the talk.
app.post("/shelters/:id/talk", async (c) => {
  const user = c.get("user");
  const json = (c.req.header("accept") ?? "").includes("application/json");
  if (!user) return json ? c.json({ reason: "Log in first." }, 401) : c.redirect("/login", 303);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.text("No shelter there.", 404);
  const form = await c.req.parseBody();
  const result = say(db, user.id, id, String(form.body ?? ""), String(form.request_id ?? ""), Date.now());
  if (result.ok) publish(result.events);
  if (json) return result.ok ? c.json(result.line) : c.json({ reason: result.reason }, result.status);
  const own = (db.prepare("SELECT id FROM shelters WHERE user_id = ?").get(user.id) as { id: number }).id === id;
  if (result.ok) return c.redirect(own ? "/#talk" : `/shelters/${id}#talk`, 303);
  if (!own) return renderVisit(c, user, id, { error: result.reason }, result.status);
  const now = Date.now();
  const shelter = loadShelter(db, user.id, now);
  return c.html(
    v.layout({
      title: "Shelter",
      tab: "shelter",
      user: user.username,
      shelter,
      body: shelterScreen(shelter, now, { ...ownCtx(shelter.id, now), error: result.reason }),
      extraStyle: "/static/shelter.css",
      extraScript: "/static/scene.js",
    }),
    result.status,
  );
});

// Live updates: your own events, every shelter's public status, and the
// shelter you're looking into.
app.get("/events", (c) => {
  const user = c.get("user");
  if (!user) return c.text("Log in first.", 401);
  const watch = Number(c.req.query("watch"));
  // world chat from spec accounts reaches only other spec accounts
  const names = [`user:${user.id}`, "world", "chat", ...(isSpec(user.username) ? ["chat:spec"] : []), ...(Number.isInteger(watch) && watch > 0 ? [`shelter:${watch}`] : [])];
  // Looking into someone else's shelter puts you at their gate.
  const owner = Number.isInteger(watch) && watch > 0
    ? (db.prepare("SELECT user_id FROM shelters WHERE id = ?").get(watch) as { user_id: number } | undefined)?.user_id
    : undefined;
  const visiting = owner !== undefined && owner !== user.id ? { shelterId: watch, ownerId: owner } : null;
  c.header("X-Accel-Buffering", "no");
  return streamSSE(c, async (stream) => {
    let open = true;
    const unsubscribe = subscribe(names, (event, data) => {
      stream.writeSSE({ event, data: JSON.stringify(data) }).catch(() => {});
    });
    // runs as soon as the connection drops, not after the heartbeat's sleep
    const close = () => {
      if (!open) return;
      open = false;
      unsubscribe();
      if (visiting) leave(visiting.shelterId, user.id, () => publishPresence(visiting, null));
    };
    stream.onAbort(close);
    try {
      await stream.writeSSE({ event: "hello", data: "{}" });
      if (open && visiting && arrive(visiting.shelterId, { id: user.id, name: user.username })) publishPresence(visiting, user.username);
      // a heartbeat keeps proxies from closing a quiet stream
      while (open) {
        await stream.sleep(25_000);
        if (open) await stream.writeSSE({ event: "ping", data: "{}" });
      }
    } finally {
      close();
    }
  });
});

function publishPresence(v: { shelterId: number; ownerId: number }, arrived: string | null) {
  const visitors = visitorsOf(v.shelterId);
  publish([
    { channel: `user:${v.ownerId}`, event: "presence", data: { shelterId: v.shelterId, visitors, arrived, own: true } },
    { channel: `shelter:${v.shelterId}`, event: "presence", data: { shelterId: v.shelterId, visitors, arrived, own: false } },
  ]);
}

function renderActivity(c: Context<Env>, user: User, extra: { fresh?: boolean; error?: string } = {}, status: 200 | 400 | 404 | 409 = 200) {
  const shelter = loadShelter(db, user.id, Date.now());
  return c.html(
    v.layout({
      title: "Activity",
      tab: "activity",
      user: user.username,
      shelter,
      // fresh request ids for each fight under way, so each form is answered once
      body: v.activityPage(shelter, recentLog(db, shelter.id), {
        ids: Object.fromEntries(shelter.crew.map((m) => [m.who, { attack: randomUUID(), escape: randomUUID(), use: randomUUID() }])),
        // what each expedition under way has been through so far
        expeditions: Object.fromEntries(
          shelter.crew.filter((m) => m.journey?.partyId).map((m) => [m.journey!.partyId!, eventsSoFar(partyView(db, partyRow(db, m.journey!.partyId!)!), Date.now())]),
        ),
        ...extra,
      }),
    }),
    status,
  );
}

app.get("/activity", (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
  // ?seen marks the page drawn straight after a blow, so its animation plays once
  return renderActivity(c, user, { fresh: c.req.query("seen") === "1" });
});

// The fight: the server rolls, records the turn, and sends you back to watch it.
async function fight(c: Context<Env>, run: (userId: number, form: Record<string, unknown>) => FightResult) {
  const user = c.get("user");
  if (!user) return c.redirect("/login", 303);
  const form = await c.req.parseBody();
  const result = run(user.id, form);
  const anchor = typeof form.who === "string" && form.who && form.who !== "you" ? `#fight-${encodeURIComponent(form.who)}` : "#fight";
  if (result.ok) return c.redirect(result.replay ? `/activity${anchor}` : `/activity?seen=1${anchor}`, 303);
  return renderActivity(c, user, { error: result.reason }, result.status);
}

app.post("/encounter/attack", (c) => fight(c, (id, f) => attack(db, id, String(f.request_id ?? ""), Number(f.turn ?? -1), Date.now(), {}, f.who)));
app.post("/encounter/escape", (c) => fight(c, (id, f) => escape(db, id, String(f.request_id ?? ""), Date.now(), {}, f.who)));
app.post("/encounter/use", (c) => fight(c, (id, f) => useItem(db, id, String(f.request_id ?? ""), Number(f.turn ?? -1), String(f.item ?? ""), Date.now(), {}, f.who)));

// The survivor: gear, training and a meal, all at the shelter.
async function survivorAction(c: Context<Env>, run: (userId: number, form: Record<string, unknown>) => GearResult, anchor = "#survivor") {
  const user = c.get("user");
  if (!user) return c.redirect("/login", 303);
  const result = run(user.id, await c.req.parseBody());
  if (result.ok) return c.redirect(`/${anchor}`, 303);
  const now = Date.now();
  const shelter = loadShelter(db, user.id, now);
  return c.html(
    v.layout({
      title: "Shelter",
      tab: "shelter",
      user: user.username,
      shelter,
      body: shelterScreen(shelter, now, { ...ownCtx(shelter.id, now), survivor: { error: result.reason } }),
      extraStyle: "/static/shelter.css",
      extraScript: "/static/scene.js",
    }),
    result.status,
  );
}

app.post("/gear/equip", (c) => survivorAction(c, (id, f) => equip(db, id, f.item, Date.now(), f.who)));
app.post("/gear/carry", (c) => survivorAction(c, (id, f) => carrySupply(db, id, String(f.kind ?? ""), f.n, Date.now(), f.who), "#stash"));
app.post("/gear/use", (c) => survivorAction(c, (id, f) => useAtHome(db, id, String(f.kind ?? ""), Date.now(), f.who), "#stash"));
app.post("/stash/use", (c) => survivorAction(c, (id, f) => useMaterial(db, id, String(f.use ?? ""), Date.now(), f.item), "#stash"));
app.post("/gear/unequip", (c) => survivorAction(c, (id, f) => unequip(db, id, String(f.slot ?? ""), Date.now(), f.who)));
app.post("/character/train", (c) => survivorAction(c, (id, f) => train(db, id, String(f.stat ?? ""), Date.now(), f.who)));
app.post("/character/meal", (c) => survivorAction(c, (id, f) => meal(db, id, Date.now(), f.who)));
app.post("/crew/task", (c) => survivorAction(c, (id, f) => setTask(db, id, f.who, String(f.task ?? ""), Date.now())));

// Expeditions: parties, friends and dispatch (PLAN.md, "Expeditions, parties and items").
function renderExpeditions(c: Context<Env>, user: User, extra: { message?: string; error?: string } = {}, status: 200 | 400 | 403 | 404 | 409 | 429 = 200) {
  const now = Date.now();
  const shelter = loadShelter(db, user.id, now);
  const body = expeditionsPage(shelter, {
    me: user.id,
    parties: openParties(db, now),
    past: pastParties(db, user.id, now),
    friends: friendsOf(db, user.id),
    dispatch: dispatchOf(db, user.id),
    canCall: foundIds(db, shelter.id).includes("day-fifteen"),
    now,
    ...extra,
  });
  return c.html(v.layout({ title: "Expeditions", tab: "expeditions", user: user.username, shelter, body, extraStyle: "/static/shelter.css" }), status);
}
app.get("/expeditions", (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
  return renderExpeditions(c, user);
});
async function partyAction(c: Context<Env>, run: (userId: number, form: Record<string, unknown>) => PartyResult, anchor = "") {
  const user = c.get("user");
  if (!user) return c.redirect("/login", 303);
  const result = run(user.id, await c.req.parseBody());
  if (result.ok) {
    // live news goes out only after the transaction has committed
    publish(result.events ?? []);
    return c.redirect(`/expeditions${result.partyId ? `#party-${result.partyId}` : anchor}`, 303);
  }
  return renderExpeditions(c, user, { error: result.reason }, result.status);
}
const idParam = (c: Context<Env>) => Number(c.req.param("id")) || 0;
app.post("/parties", (c) => partyAction(c, (id, f) => createParty(db, id, f, Date.now())));
app.post("/parties/:id/join", (c) => partyAction(c, (id, f) => joinParty(db, id, idParam(c), f, Date.now())));
app.post("/parties/:id/leave", (c) => partyAction(c, (id, f) => leaveSeat(db, id, idParam(c), f.seat ? Number(f.seat) || -1 : null, Date.now())));
app.post("/parties/:id/recruit", (c) => partyAction(c, (id) => repostRecruit(db, id, idParam(c), Date.now())));
app.post("/parties/:id/dispatch", (c) => partyAction(c, (id, f) => dispatchFriend(db, id, idParam(c), Number(f.friend) || 0, Date.now())));
app.post("/friends", (c) => partyAction(c, (id, f) => befriend(db, id, String(f.name ?? ""), Date.now()), "#friends"));
app.post("/friends/:id/remove", (c) => partyAction(c, (id) => unfriend(db, id, idParam(c)), "#friends"));
app.post("/dispatch", (c) => partyAction(c, (id, f) => setDispatch(db, id, f, Date.now()), "#dispatch"));

app.get("/readme", (c) => c.redirect("/readme/", 301));
app.get("/readme/", (c) => {
  const user = c.get("user");
  const shelter = user ? loadShelter(db, user.id, Date.now()) : undefined;
  return c.html(v.layout({ title: "About", tab: "readme", user: user?.username, shelter, body: raw(`<article class="readme">${readmeHtml}</article>`) }));
});

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => console.log(`listening on :${port}`));

// As PID 1 in the container, node gets no default SIGTERM handling, so Fly's
// stop would otherwise wait out its timeout.
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => process.exit(0));
