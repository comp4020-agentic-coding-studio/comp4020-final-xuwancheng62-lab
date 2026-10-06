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
import { help, interactionFor, steal, visitOptions, type ActionResult } from "./interactions.ts";
import { publicShelter } from "./public.ts";
import { publish, subscribe } from "./realtime.ts";
import { shelterScreen, visitScreen } from "./shelterScreen.ts";
import * as v from "./views.ts";

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

async function credentials(c: Context<Env>): Promise<{ username: string; password: string }> {
  const form = await c.req.parseBody();
  return { username: String(form.username ?? "").trim(), password: String(form.password ?? "") };
}

app.get("/", (c) => {
  const user = c.get("user");
  if (!user) return c.html(v.layout({ title: "Welcome", tab: "none", body: v.landing() }));
  const now = Date.now();
  const shelter = loadShelter(db, user.id, now);
  return c.html(
    v.layout({ title: "Shelter", tab: "shelter", user: user.username, shelter, body: shelterScreen(shelter, now), extraStyle: "/static/shelter.css", extraScript: "/static/scene.js" }),
  );
});

app.get("/register", (c) => c.html(v.layout({ title: "Register", tab: "none", body: v.authPage("register") })));
app.get("/login", (c) => c.html(v.layout({ title: "Log in", tab: "none", body: v.authPage("login") })));

app.post("/register", async (c) => {
  const { username, password } = await credentials(c);
  const fail = (msg: string, status: 400 | 409) =>
    c.html(v.layout({ title: "Register", tab: "none", body: v.authPage("register", msg) }), status);
  if (!USERNAME.test(username)) return fail("Names are 3–20 letters, digits, - or _.", 400);
  if (password.length < MIN_PASSWORD) return fail(`Passwords need at least ${MIN_PASSWORD} characters.`, 400);
  const now = Date.now();
  let userId: number;
  try {
    userId = tx(db, () => {
      const { lastInsertRowid } = db
        .prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)")
        .run(username, hashPassword(password), now);
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
  return c.html(v.layout({ title: "World", tab: "world", user: user.username, shelter, body: v.worldPage(shelter, survivors) }));
});

app.post("/world/depart", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login", 303);
  const form = await c.req.parseBody();
  const result = depart(db, user.id, String(form.destination ?? ""), Date.now());
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
    v.layout({ title: "World", tab: "world", user: user.username, shelter, body: v.worldPage(shelter, survivors, result.reason) }),
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

// Live updates: your own events, every shelter's public status, and the
// shelter you're looking into.
app.get("/events", (c) => {
  const user = c.get("user");
  if (!user) return c.text("Log in first.", 401);
  const watch = Number(c.req.query("watch"));
  const names = [`user:${user.id}`, "world", ...(Number.isInteger(watch) && watch > 0 ? [`shelter:${watch}`] : [])];
  c.header("X-Accel-Buffering", "no");
  return streamSSE(c, async (stream) => {
    let open = true;
    const unsubscribe = subscribe(names, (event, data) => {
      stream.writeSSE({ event, data: JSON.stringify(data) }).catch(() => {});
    });
    stream.onAbort(() => {
      open = false;
    });
    try {
      await stream.writeSSE({ event: "hello", data: "{}" });
      // a heartbeat keeps proxies from closing a quiet stream
      while (open) {
        await stream.sleep(25_000);
        if (open) await stream.writeSSE({ event: "ping", data: "{}" });
      }
    } finally {
      unsubscribe();
    }
  });
});

app.get("/activity", (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
  const shelter = loadShelter(db, user.id, Date.now());
  return c.html(
    v.layout({ title: "Activity", tab: "activity", user: user.username, shelter, body: v.activityPage(shelter, recentLog(db, shelter.id)) }),
  );
});

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
