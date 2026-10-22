// The shelter scene: a survivor who walks, pauses, inspects and climbs, and
// inspect panels opened by clicking or keys. Without this script the hotspots
// are plain #links and the panels open with :target.
(() => {
  const stage = document.querySelector(".sc-stage");
  if (!stage) return;
  stage.closest(".sh")?.classList.add("js");

  const WALK = 110; // viewBox units per second
  const CLIMB = 75;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const ownShelter = stage.classList.contains("mode-own");
  const panels = [...document.querySelectorAll(".sc-info")];
  let sayings = {};
  let visitors = [];
  let residents = {};
  let chatter = { lines: {}, chats: [] };
  try {
    ({ sayings = {}, visitors = [], residents = {}, chatter = chatter } = JSON.parse(stage.querySelector(".sc-sayings")?.textContent || "{}"));
  } catch {}
  const me = stage.closest(".sh")?.dataset.me;

  // Everyone drawn in a scene. On your own shelter you direct your survivor;
  // on a visit you direct yourself, let in while the owner is home, and the
  // owner goes about their business.
  const agent = (sv) => ({
    sv,
    base: sv.getAttribute("class"),
    flip: sv.querySelector(".sv-flip"),
    st: { x: Number(sv.dataset.x), y: Number(sv.dataset.y), face: 1, mode: "idle", queue: [], last: "quarters" },
  });
  const scenes = [...stage.querySelectorAll(".sc")].map((el) => {
    const agents = [...el.querySelectorAll(".sv")].map(agent);
    const guest = agents.find((a) => a.sv.classList.contains("sv--guest"));
    // someone who lives here, like Toby, goes about their own business
    const lodger = (a) => a.sv.classList.contains("sv--resident");
    return {
      el,
      layout: JSON.parse(el.dataset.layout),
      width: el.querySelector("svg").viewBox.baseVal.width,
      agents,
      guest,
      you: ownShelter ? agents.find((a) => !lodger(a)) : guest,
      lodger,
      hots: [...el.querySelectorAll(".sc-hot")],
    };
  });
  const visible = () => scenes.find((s) => s.el.offsetParent !== null) ?? scenes[0];

  // Fit a label's box to its text, centred on x = dx.
  function fit(text, box, pad, dx = 0) {
    const len = text.getComputedTextLength();
    if (!len) return 0; // not laid out (the other layout); keep the server's estimate
    const w = len + pad;
    box.setAttribute("x", String(-w / 2 + dx));
    box.setAttribute("width", String(w));
    return w;
  }

  // A line about what they're looking at, in a bubble sized to fit and kept
  // inside the drawing.
  function say(s, a, key) {
    const lines = (a.sv.dataset.who ? residents[a.sv.dataset.who] ?? {} : sayings)[key];
    const text = a.sv.querySelector(".sv-say");
    if (!lines?.length || !text) return;
    text.textContent = lines[Math.floor(Math.random() * lines.length)];
    const box = a.sv.querySelector(".sv-bubble-box");
    const w = fit(text, box, 18);
    const left = a.st.x - w / 2;
    const dx = left < 4 ? 4 - left : a.st.x + w / 2 > s.width - 4 ? s.width - 4 - (a.st.x + w / 2) : 0;
    text.setAttribute("x", String(dx));
    box.setAttribute("x", String(-w / 2 + dx));
  }

  function draw(a) {
    const { st } = a;
    a.sv.setAttribute("transform", `translate(${st.x.toFixed(1)} ${st.y.toFixed(1)})`);
    a.flip.setAttribute("transform", st.face < 0 ? "scale(-1 1)" : "");
    a.sv.setAttribute("class", `${a.base} is-${st.mode}${a.talking ? " is-talking" : ""}${a.chatting ? " is-chatting" : ""}`);
    a.sv.placeChat?.(st.x);
  }

  // Route to an item: along the floor to the shaft, up or down it, then along
  // the target floor. Works from anywhere, including halfway up the ladder.
  function walkTo(s, a, t) {
    const { st } = a;
    const steps = [];
    if (Math.abs(st.y - t.y) > 0.5) {
      if (Math.abs(st.x - s.layout.shaftX) > 0.5) steps.push({ type: "walk", x: s.layout.shaftX });
      steps.push({ type: "climb", y: t.y });
    }
    if (Math.abs(st.x - t.x) > 0.5) steps.push({ type: "walk", x: t.x });
    return steps;
  }

  function route(s, a, key, inspectMs) {
    const { st } = a;
    const t = s.layout.spots[key];
    const steps = walkTo(s, a, t);
    steps.push({ type: "face", face: t.face }, { type: "inspect", ms: inspectMs, key });
    st.last = key;
    return steps;
  }

  // Nobody wanders to where someone else is already standing.
  function wander(s, a) {
    const taken = new Set(s.agents.filter((o) => o !== a).map((o) => o.st.last));
    const keys = Object.keys(s.layout.spots).filter(
      // Toby keeps away from the hatch: he's hiding from the Ash Hounds
      (k) => k !== a.st.last && !taken.has(k) && (k !== "hatch" || (a !== s.guest && !s.lodger(a) && Math.random() < 0.25)),
    );
    const next = keys[Math.floor(Math.random() * keys.length)];
    // a guest lingers longer between things; it isn't their shelter
    const pause = a === s.guest ? 2500 + Math.random() * 3000 : 900 + Math.random() * 1800;
    a.st.queue.push({ type: "pause", ms: pause }, ...route(s, a, next, 1800 + Math.random() * 1600));
  }

  function step(s, a, dt, now) {
    const { st } = a;
    if (!st.queue.length) wander(s, a);
    const cur = st.queue[0];
    let done = false;
    if (cur.type === "walk" || cur.type === "climb") {
      const axis = cur.type === "walk" ? "x" : "y";
      const target = cur[axis];
      const diff = target - st[axis];
      const move = (cur.type === "walk" ? WALK : CLIMB) * dt;
      if (cur.type === "walk" && diff) st.face = Math.sign(diff);
      st.mode = cur.type;
      if (Math.abs(diff) <= move) {
        st[axis] = target;
        done = true;
      } else st[axis] += Math.sign(diff) * move;
    } else if (cur.type === "face") {
      st.face = cur.face;
      done = true;
    } else if (cur.type === "chat") {
      st.queue.shift();
      chat(s, cur.lines);
      return;
    } else {
      if (cur.end === undefined && cur.type === "inspect") say(s, a, cur.key);
      cur.end ??= now + cur.ms;
      st.mode = cur.type === "inspect" ? "inspect" : "idle";
      done = now >= cur.end;
    }
    if (done) st.queue.shift();
  }

  let lastFrame = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - (lastFrame || now)) / 1000);
    lastFrame = now;
    const s = visible();
    for (const a of s.agents) {
      step(s, a, dt, now);
      draw(a);
    }
    if (!reduce.matches) requestAnimationFrame(frame);
  }

  // Reduced motion: no walking. You just appear at what you select.
  function jumpTo(s, a, key) {
    const t = s.layout.spots[key];
    Object.assign(a.st, { x: t.x, y: t.y, face: t.face, mode: "inspect", queue: [], last: key });
    say(s, a, key);
    draw(a);
  }

  function goTo(key) {
    const s = visible();
    if (!s.you) return;
    if (reduce.matches) return jumpTo(s, s.you, key);
    s.you.st.queue = route(s, s.you, key, 4500);
  }

  // A guest climbs down through the hatch as the page opens.
  for (const s of scenes) if (s.guest) s.guest.st.queue.push({ type: "pause", ms: 600 }, ...route(s, s.guest, "generator", 2400));

  // ---- people at the gate

  const SVG = "http://www.w3.org/2000/svg";
  const el = (name, attrs = {}) => {
    const node = document.createElementNS(SVG, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    return node;
  };
  const short = (name) => (name.length > 12 ? `${name.slice(0, 11)}…` : name);

  function figure(name, x, y, row, id, portrait) {
    const g = el("g", { class: "sc-visitor", transform: `translate(${x} ${y})` });
    if (id !== undefined) Object.assign(g.dataset, { id, x });
    // their painted figure, the person in their portrait, facing the hatch
    if (portrait) g.append(
      el("ellipse", { class: "sc-visitor-shadow", cx: 0, cy: 0, rx: 10, ry: 2 }),
      el("image", { class: "sc-visitor-painted", href: `/static/img/shelter/sv-player-${portrait}.webp`, x: -13, y: -62, width: 26, height: 62, preserveAspectRatio: "xMidYMax meet", transform: "scale(-1 1)" }),
    );
    // or a hooded traveller in a long coat, shaded like the survivors inside
    else g.append(
      el("ellipse", { class: "sc-visitor-shadow", cx: 0, cy: 0, rx: 10, ry: 2 }),
      el("path", { class: "sc-visitor-leg", d: "M-3 -21V-4M3 -21V-4" }),
      el("path", { class: "sc-visitor-boot", d: "M-6 -5h5q3 0 3.5 3.5V0H-6zM0 -5h5q3 0 3.5 3.5V0H0z" }),
      el("rect", { class: "sc-visitor-pack", x: -14.5, y: -42, width: 8, height: 17, rx: 2.5 }),
      el("path", { class: "sc-visitor-body", d: "M-8 -18Q-10 -39 0 -43Q10 -39 8 -18Q0 -16.5 -8 -18Z" }),
      el("path", { class: "sc-visitor-shade", d: "M8 -18Q9.6 -34 4.5 -41Q3.5 -30 1.5 -17Z" }),
      el("path", { class: "sc-visitor-belt", d: "M-8.6 -28H8.6" }),
      el("circle", { class: "sc-visitor-head", cx: 0, cy: -49, r: 6.5 }),
      el("path", { class: "sc-visitor-shade", d: "M-5.4 -45.4A6.5 6.5 0 0 0 6.2 -47Q2 -44.8 -5.4 -45.4Z" }),
      el("circle", { class: "sc-visitor-eye", cx: 3.8, cy: -49, r: 0.8 }),
      el("path", { class: "sc-visitor-hood", d: "M-7 -50a7 7 0 0 1 14 0v3h-2v-2a5 5 0 0 0 -10 0v2h-2z" }),
    );
    const tagY = row ? -96 : -76;
    const tag = el("g", { class: "sc-visitor-tag" });
    const text = el("text", { x: 0, y: tagY + 12, "text-anchor": "middle" });
    text.textContent = short(name);
    const est = short(name).length * 7 + 12;
    const box = el("rect", { x: -est / 2, y: tagY, width: est, height: 17, rx: 4 });
    tag.append(box, text);
    g.append(tag);
    return { g, text, box };
  }

  // On a visit while the owner is out, the hatch is sealed: you wait at the
  // gate with everyone else.
  const youOutside = !ownShelter && !scenes[0].guest;

  function renderVisitors(list) {
    const others = list.filter((v) => String(v.id) !== me);
    const people = youOutside ? [{ id: me, name: "You", portrait: Number(stage.closest(".sh")?.dataset.mePortrait) || undefined }, ...others] : others;
    for (const s of scenes) {
      const layer = s.el.querySelector(".sc-visitors");
      if (!layer) continue;
      layer.replaceChildren();
      const { x, y, step, max } = s.layout.gate;
      const shown = people.slice(0, people.length > max ? max - 1 : max);
      const tags = shown.map((v, i) => figure(v.name, x + i * step, y, i % 2, v.id, v.portrait));
      if (people.length > shown.length) tags.push(figure(`+${people.length - shown.length}`, x + shown.length * step, y, shown.length % 2));
      if (youOutside) tags[0].g.classList.add("is-you");
      for (const t of tags) layer.append(t.g);
      // size each tag to its text once it's in the document
      for (const t of tags) fit(t.text, t.box, 12);
    }
    const line = document.querySelector(".sc-gate");
    if (line) {
      line.hidden = others.length === 0;
      line.querySelector(".sc-gate-names").textContent = others.map((v) => v.name).join(", ");
    }
  }

  renderVisitors(visitors);
  document.addEventListener("holdout:presence", (e) => {
    if (String(e.detail.shelterId) === stage.closest(".sh")?.dataset.sceneShelter) renderVisitors(e.detail.visitors);
  });

  // ---- talking: what someone says shows over their head for a few seconds

  const clip = (t) => ([...t].length > 40 ? `${[...t].slice(0, 39).join("")}…` : t);
  const timers = new WeakMap();

  // `top` is the bubble's top edge relative to the figure's feet.
  function bubble(s, host, x, text, top, done) {
    host.querySelector(".sc-chat")?.remove();
    host.placeChat = null;
    clearTimeout(timers.get(host));
    const g = el("g", { class: "sc-chat" });
    const box = el("rect", { y: top, height: 22, rx: 6 });
    const tail = el("path", { d: `M-4 ${top + 22}l4 6 4 -6z` });
    const t = el("text", { x: 0, y: top + 16, "text-anchor": "middle" });
    t.textContent = clip(text);
    g.append(box, tail, t);
    host.append(g);
    const w = fit(t, box, 18) || [...t.textContent].length * 7 + 18;
    box.setAttribute("width", String(w));
    // kept inside the scene, again each time the speaker moves
    host.placeChat = (x) => {
      const left = x - w / 2;
      const dx = left < 4 ? 4 - left : x + w / 2 > s.width - 4 ? s.width - 4 - (x + w / 2) : 0;
      t.setAttribute("x", String(dx));
      box.setAttribute("x", String(-w / 2 + dx));
    };
    host.placeChat(x);
    timers.set(
      host,
      setTimeout(() => {
        g.remove();
        host.placeChat = null;
        done();
      }, 3500 + Math.min(4000, text.length * 60)),
    );
  }

  document.addEventListener("holdout:talk", ({ detail: d }) => {
    for (const s of scenes) {
      // the owner's survivor, or you let in as a guest; anyone else is at the gate
      const a = d.owner ? s.agents.find((x) => x !== s.guest) : String(d.authorId) === me ? s.guest : undefined;
      if (a) {
        a.talking = true;
        bubble(s, a.sv, a.st.x, d.body, -94, () => (a.talking = false));
        draw(a);
        continue;
      }
      const f = s.el.querySelector(`.sc-visitor[data-id="${d.authorId}"]`);
      if (f) {
        f.classList.add("is-talking");
        bubble(s, f, Number(f.dataset.x), d.body, -86, () => f.classList.remove("is-talking"));
      }
    }
  });

  // ---- clicking someone: they stop and say something, or turn to whoever
  // else is home and the two of them have a word

  const talker = (s, who) => s.agents.find((a) => a.sv.dataset.talk === who);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  function speak(s, a, line, ms, done = () => {}) {
    // in front of everyone else, so nobody stands over the words
    const last = [...a.sv.parentNode.querySelectorAll(":scope > .sv")].pop();
    if (last !== a.sv) last.after(a.sv);
    a.st.queue = [{ type: "pause", ms }];
    a.st.mode = "idle";
    a.talking = true;
    bubble(s, a.sv, a.st.x, line, -94, () => {
      a.talking = false;
      done();
    });
    draw(a);
  }

  function chat(s, lines) {
    const said = lines.map((l) => ({ ...l, a: talker(s, l.who) }));
    const [first, second] = said;
    if (said.some((l) => !l.a)) return false;
    // face each other if they're on the same floor
    if (Math.abs(first.a.st.y - second.a.st.y) < 1 && first.a.st.x !== second.a.st.x) {
      first.a.st.face = Math.sign(second.a.st.x - first.a.st.x);
      second.a.st.face = -first.a.st.face;
    }
    // both wait where they are until it's over; neither's name tag gets in
    // the way of the other's words
    const people = [first.a, second.a];
    for (const x of people) {
      x.chatting = true;
      x.st.queue = [{ type: "pause", ms: 6000 * said.length }];
    }
    const next = (i) => {
      if (i === said.length) {
        for (const x of people) {
          x.chatting = false;
          x.st.queue = [{ type: "pause", ms: 800 }];
        }
        return;
      }
      speak(s, said[i].a, said[i].line, 6000 * (said.length - i), () => next(i + 1));
    };
    next(0);
    return true;
  }

  function poke(s, a) {
    const who = a.sv.dataset.talk;
    const chats = chatter.chats.filter((c) => c.some((l) => l.who === who) && c.every((l) => talker(s, l.who)));
    if (chats.length && Math.random() < 0.4 && chat(s, pick(chats))) return;
    const lines = chatter.lines[who];
    if (lines?.length) speak(s, a, pick(lines), 3500);
  }

  for (const s of scenes) {
    for (const a of s.agents) {
      if (!a.sv.dataset.talk) continue;
      const name = a.sv.querySelector(".sv-tag text")?.textContent || "this survivor";
      a.sv.setAttribute("tabindex", "0");
      a.sv.setAttribute("role", "button");
      a.sv.setAttribute("aria-label", `Talk to ${name}`);
      a.sv.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        poke(s, a);
      });
    }
    // People stand in front of the things you can click, so a click on a
    // person goes to them before the hotspot underneath.
    s.el.addEventListener(
      "click",
      (e) => {
        const a = s.agents.find((x) => {
          const r = x.sv.dataset.talk && x.sv.querySelector(".sv-hit")?.getBoundingClientRect();
          return r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        });
        if (!a) return;
        e.preventDefault();
        e.stopPropagation();
        poke(s, a);
      },
      true,
    );
  }

  // Now and then two people who are both home have a word on their own: the
  // one who starts walks over to the other, who waits for them. A guest
  // goes looking for their host soon after coming in.
  const onFloor = (s, a) => s.layout.floors.some((y) => Math.abs(a.st.y - y) < 0.5);
  function seek(s, lines) {
    const [from, to] = lines.map((l) => talker(s, l.who));
    if (!from || !to || !onFloor(s, to)) return false;
    if (reduce.matches) return chat(s, lines);
    // stand a step away, on whichever side of them is open
    const side = from.st.y === to.st.y ? Math.sign(from.st.x - to.st.x) || 1 : to.st.x - 30 < s.layout.shaftX + 20 ? 1 : -1;
    const x = Math.min(s.width - 20, Math.max(s.layout.shaftX + 20, to.st.x + side * 30));
    to.st.queue = [{ type: "pause", ms: 30000 }];
    from.st.queue = [...walkTo(s, from, { x, y: to.st.y }), { type: "chat", lines }];
    return true;
  }
  function mingle(chance, from = chatter.chats) {
    const s = visible();
    if (document.hidden || s.agents.some((a) => a.talking || a.st.queue.some((q) => q.type === "chat"))) return;
    const ready = from.filter((c) => c.every((l) => talker(s, l.who)));
    if (ready.length && Math.random() < chance) seek(s, pick(ready));
  }
  if (chatter.chats.length) {
    if (scenes[0].guest) setTimeout(() => mingle(1, chatter.opening ?? chatter.chats), 7000);
    setInterval(() => mingle(scenes[0].guest ? 0.7 : 0.5), 20000);
  }

  // ---- inspect panels

  let selected = null;
  function open(key) {
    selected = key;
    history.replaceState(null, "", `${location.pathname}${location.search}#info-${key}`);
    for (const p of panels) p.classList.toggle("is-open", p.id === `info-${key}`);
    for (const s of scenes) for (const h of s.hots) {
      const on = h.dataset.key === key;
      h.classList.toggle("is-selected", on);
      h.setAttribute("aria-expanded", String(on));
    }
    goTo(key);
    // Keep what you selected in view above the panel pinned to the bottom.
    const hot = visible().hots.find((h) => h.dataset.key === key)?.getBoundingClientRect();
    const panel = document.getElementById(`info-${key}`).offsetHeight;
    if (hot) {
      let by = hot.bottom + panel + 16 - innerHeight;
      if (hot.top - by < 8) by = hot.top - 8;
      if (Math.abs(by) > 4) scrollBy({ top: by, behavior: reduce.matches ? "auto" : "smooth" });
    }
  }

  function close() {
    const was = selected;
    selected = null;
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    for (const p of panels) p.classList.remove("is-open");
    for (const s of scenes) for (const h of s.hots) {
      h.classList.remove("is-selected");
      h.setAttribute("aria-expanded", "false");
    }
    if (was) visible().hots.find((h) => h.dataset.key === was)?.focus();
  }

  for (const s of scenes) for (const h of s.hots) {
    h.setAttribute("aria-controls", `info-${h.dataset.key}`);
    h.setAttribute("aria-expanded", "false");
    h.addEventListener("click", (e) => {
      e.preventDefault();
      selected === h.dataset.key ? close() : open(h.dataset.key);
    });
  }
  // Recruitment notices and other links outside the scene must use the same
  // inspector as hotspots. A repeated identical hash does not fire hashchange.
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a[href]');
    if (!a || a.classList.contains("sc-hot") || a.classList.contains("sc-info-close")) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search) return;
    const key = url.hash.match(/^#info-(\w+)$/)?.[1];
    if (!key || !panels.some((p) => p.id === `info-${key}`)) return;
    e.preventDefault();
    open(key);
  });
  window.addEventListener("hashchange", () => {
    const key = location.hash.match(/^#info-(\w+)$/)?.[1];
    if (key && panels.some((p) => p.id === `info-${key}`)) open(key);
    else if (selected) {
      selected = null;
      for (const p of panels) p.classList.remove("is-open");
      for (const s of scenes) for (const h of s.hots) {
        h.classList.remove("is-selected");
        h.setAttribute("aria-expanded", "false");
      }
    }
  });

  for (const a of document.querySelectorAll(".sc-info-close")) {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      close();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.("input, textarea, select")) return;
    const hots = visible().hots;
    if (e.key === "Escape" && selected) {
      close();
    } else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && hots.includes(document.activeElement)) {
      const i = hots.indexOf(document.activeElement);
      hots[(i + (e.key === "ArrowRight" ? 1 : hots.length - 1)) % hots.length].focus();
      e.preventDefault();
    }
  });

  const fromHash = location.hash.match(/^#info-(\w+)$/);
  const preset = document.querySelector(".sc-info[data-open]")?.id.slice("info-".length);
  if (preset) open(preset);
  else if (fromHash && panels.some((p) => p.id === `info-${fromHash[1]}`)) open(fromHash[1]);

  for (const s of scenes) for (const a of s.agents) {
    const tag = a.sv.querySelector(".sv-tag");
    if (tag) fit(tag.querySelector("text"), tag.querySelector("rect"), 14);
    draw(a);
  }
  if (!reduce.matches) requestAnimationFrame(frame);
  reduce.addEventListener("change", () => {
    if (!reduce.matches) requestAnimationFrame(frame);
  });
})();
