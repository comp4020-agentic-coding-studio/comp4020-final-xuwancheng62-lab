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

  const scenes = [...stage.querySelectorAll(".sc")].map((el) => {
    const layout = JSON.parse(el.dataset.layout);
    const sv = el.querySelector(".sv");
    return {
      el,
      layout,
      sv,
      flip: sv?.querySelector(".sv-flip"),
      hots: [...el.querySelectorAll(".sc-hot")],
      st: sv ? { x: Number(sv.dataset.x), y: Number(sv.dataset.y), face: 1, mode: "idle", queue: [], last: "quarters" } : null,
    };
  });
  const visible = () => scenes.find((s) => s.el.offsetParent !== null) ?? scenes[0];

  function draw(s) {
    const { st } = s;
    s.sv.setAttribute("transform", `translate(${st.x.toFixed(1)} ${st.y.toFixed(1)})`);
    s.flip.setAttribute("transform", st.face < 0 ? "scale(-1 1)" : "");
    s.sv.setAttribute("class", `sv is-${st.mode}`);
  }

  // Route to an item: along the floor to the shaft, up or down it, then along
  // the target floor. Works from anywhere, including halfway up the ladder.
  function route(s, key, inspectMs) {
    const { st, layout } = s;
    const t = layout.spots[key];
    const steps = [];
    if (Math.abs(st.y - t.y) > 0.5) {
      if (Math.abs(st.x - layout.shaftX) > 0.5) steps.push({ type: "walk", x: layout.shaftX });
      steps.push({ type: "climb", y: t.y });
    }
    if (Math.abs(st.x - t.x) > 0.5) steps.push({ type: "walk", x: t.x });
    steps.push({ type: "face", face: t.face }, { type: "inspect", ms: inspectMs });
    st.last = key;
    return steps;
  }

  function wander(s) {
    const keys = Object.keys(s.layout.spots).filter((k) => k !== s.st.last && (k !== "hatch" || Math.random() < 0.25));
    const next = keys[Math.floor(Math.random() * keys.length)];
    s.st.queue.push({ type: "pause", ms: 900 + Math.random() * 1800 }, ...route(s, next, 1800 + Math.random() * 1600));
  }

  function step(s, dt, now) {
    const { st } = s;
    if (!st.queue.length) wander(s);
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
    } else {
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
    if (s.st) {
      step(s, dt, now);
      draw(s);
    }
    if (!reduce.matches) requestAnimationFrame(frame);
  }

  // Reduced motion: no walking. The survivor just appears at what you select.
  function jumpTo(s, key) {
    const t = s.layout.spots[key];
    Object.assign(s.st, { x: t.x, y: t.y, face: t.face, mode: "inspect", queue: [] });
    draw(s);
  }

  function goTo(key) {
    const s = visible();
    if (!s.st || !ownShelter) return;
    if (reduce.matches) return jumpTo(s, key);
    s.st.queue = route(s, key, 4500);
  }

  // ---- inspect panels

  let selected = null;
  function open(key) {
    selected = key;
    for (const p of panels) p.classList.toggle("is-open", p.id === `info-${key}`);
    for (const s of scenes) for (const h of s.hots) {
      const on = h.dataset.key === key;
      h.classList.toggle("is-selected", on);
      h.setAttribute("aria-expanded", String(on));
    }
    goTo(key);
    // On the wide plan the scene and the open panel fit on screen together, so
    // scroll until the panel sits below the scene instead of covering it.
    if (visible().el.classList.contains("sc-wide")) {
      const scene = stage.getBoundingClientRect();
      const panel = document.getElementById(`info-${key}`).offsetHeight;
      const by = Math.min(scene.bottom + panel + 16 - innerHeight, scene.top - 8);
      if (by > 0) scrollBy({ top: by, behavior: reduce.matches ? "auto" : "smooth" });
    }
  }

  function close() {
    const was = selected;
    selected = null;
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
  for (const a of document.querySelectorAll(".sc-info-close")) {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      close();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.("input, textarea, select")) return;
    const hots = visible().hots;
    if (/^[1-9]$/.test(e.key) && hots[Number(e.key) - 1]) {
      const h = hots[Number(e.key) - 1];
      h.focus();
      open(h.dataset.key);
      e.preventDefault();
    } else if (e.key === "Escape" && selected) {
      close();
    } else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && hots.includes(document.activeElement)) {
      const i = hots.indexOf(document.activeElement);
      hots[(i + (e.key === "ArrowRight" ? 1 : hots.length - 1)) % hots.length].focus();
      e.preventDefault();
    }
  });

  const fromHash = location.hash.match(/^#info-(\w+)$/);
  if (fromHash && panels.some((p) => p.id === `info-${fromHash[1]}`)) open(fromHash[1]);

  for (const s of scenes) if (s.st) draw(s);
  if (!reduce.matches) requestAnimationFrame(frame);
  reduce.addEventListener("change", () => {
    if (!reduce.matches) requestAnimationFrame(frame);
  });
})();
