// Live updates over server-sent events. Every page still renders in full on
// the server; this only patches it when something happens elsewhere.
(() => {
  if (!("EventSource" in window)) return;
  const watch = document.querySelector("[data-watch-shelter]")?.dataset.watchShelter;
  const es = new EventSource(`/events${watch ? `?watch=${watch}` : ""}`);
  const parse = (e) => {
    try {
      return JSON.parse(e.data);
    } catch {
      return null;
    }
  };
  const flash = (el) => {
    el.classList.remove("is-flash");
    void el.offsetWidth;
    el.classList.add("is-flash");
  };

  let box;
  function toast(tone, message) {
    if (!box) {
      box = document.createElement("div");
      box.className = "toasts";
      box.setAttribute("role", "status");
      box.setAttribute("aria-live", "polite");
      document.body.append(box);
    }
    const t = document.createElement("div");
    t.className = `toast tone-${tone}`;
    t.textContent = message;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "toast-close";
    close.setAttribute("aria-label", "Dismiss");
    close.textContent = "×";
    close.addEventListener("click", () => t.remove());
    t.append(close);
    box.prepend(t);
    setTimeout(() => t.remove(), 9000);
  }

  es.addEventListener("alert", (e) => {
    const d = parse(e);
    if (d) toast(d.tone, d.message);
  });

  es.addEventListener("activity", (e) => {
    const d = parse(e);
    const log = document.querySelector("[data-live-log]");
    if (!d || !log) return;
    const li = document.createElement("li");
    li.className = `log-${d.kind}`;
    const time = document.createElement("time");
    time.dataset.ago = d.at;
    time.textContent = "just now";
    li.append(time, ` ${d.message}`);
    log.prepend(li);
    flash(li);
  });

  // Your own stores, after someone else changed them.
  es.addEventListener("resources", (e) => {
    const d = parse(e);
    if (!d) return;
    for (const [k, v] of Object.entries(d.stock)) {
      const li = document.querySelector(`.sh-res-item[data-res="${k}"]`);
      const val = li?.querySelector("[data-value]");
      if (!val) continue;
      const before = Math.floor(Number(val.textContent));
      Object.assign(val.dataset, { value: v, rate: d.net[k], at: d.at });
      val.textContent = String(Math.floor(v));
      const rate = li.querySelector(".sh-res-rate");
      if (rate) rate.textContent = `${d.net[k] > 0 ? "+" : d.net[k] < 0 ? "−" : "±"}${Math.abs(d.net[k])}/h`;
      const state = v <= 0 ? "empty" : v < 10 ? "low" : "ok";
      li.classList.remove("is-ok", "is-low", "is-empty");
      li.classList.add(`is-${state}`);
      let flag = li.querySelector(".sh-res-flag");
      if (state === "ok") flag?.remove();
      else {
        if (!flag) {
          flag = document.createElement("span");
          flag.className = "sh-res-flag";
          li.append(flag);
        }
        flag.textContent = state === "empty" ? "Empty" : "Low";
      }
      if (before !== Math.floor(v)) flash(li);
    }
  });

  // Who is at a gate: the scene draws them; the owner hears about arrivals anywhere.
  es.addEventListener("presence", (e) => {
    const d = parse(e);
    if (!d) return;
    document.dispatchEvent(new CustomEvent("holdout:presence", { detail: d }));
    if (d.own && d.arrived) toast("ok", `${d.arrived} is at your gate.`);
  });

  // Talk: add the line where it's being shown, let the scene put it in a
  // bubble, and tell the owner when they're somewhere else.
  const talk = document.querySelector("[data-talk-shelter]");
  function addLine(d) {
    if (!talk || String(d.shelterId) !== talk.dataset.talkShelter) return false;
    const log = talk.querySelector("[data-talk-log]");
    if (log.querySelector(`[data-talk-id="${d.id}"]`)) return true;
    const li = document.createElement("li");
    li.dataset.talkId = d.id;
    if (d.owner) li.className = "is-owner";
    const face = document.createElement("img");
    Object.assign(face, { className: "sh-talk-face", src: `/static/img/survivors/${d.portrait}.jpg`, alt: "", width: 28, height: 28 });
    const who = document.createElement("b");
    who.textContent = d.author;
    const body = document.createElement("span");
    body.textContent = d.body;
    const time = document.createElement("time");
    time.dataset.ago = d.at;
    time.textContent = "just now";
    li.append(face, who, " ", body, " ", time);
    log.append(li);
    talk.querySelector(".sh-talk-empty").hidden = true;
    log.scrollTop = log.scrollHeight;
    flash(li);
    document.dispatchEvent(new CustomEvent("holdout:talk", { detail: d }));
    return true;
  }
  es.addEventListener("talk", (e) => {
    const d = parse(e);
    if (!d) return;
    if (!addLine(d) && d.own) toast("ok", `${d.author} at your gate: “${d.body}”`);
  });

  const form = talk?.querySelector(".sh-talk-form");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const why = talk.querySelector(".sh-talk-why");
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      const res = await fetch(form.action, { method: "POST", headers: { accept: "application/json" }, body: new URLSearchParams(new FormData(form)) });
      const d = await res.json();
      if (!res.ok) {
        why.textContent = d.reason;
        why.hidden = false;
        return;
      }
      why.hidden = true;
      addLine({ shelterId: Number(talk.dataset.talkShelter), ...d });
      form.reset();
      form.elements.request_id.value = crypto.randomUUID();
    } catch {
      why.textContent = "Couldn't reach the shelter. Try again.";
      why.hidden = false;
    } finally {
      button.disabled = false;
      form.elements.body.focus();
    }
  });

  // Someone's public status: Survivors cards, and the shelter you're looking into.
  es.addEventListener("status", (e) => {
    const p = parse(e);
    if (!p) return;
    const card = document.querySelector(`[data-shelter-id="${p.id}"]`);
    if (card) {
      const pill = card.querySelector("[data-live-pill]");
      pill.textContent = p.home ? "Owner home" : "Owner away";
      pill.className = `pill ${p.home ? "pill-home" : "pill-away"}`;
      card.querySelector("[data-live-security]").textContent = p.security;
      for (const k of ["food", "water", "scrap"]) {
        const dd = card.querySelector(`[data-band="${k}"]`);
        if (dd) dd.textContent = p.bands[k];
      }
      flash(card);
    }
    if (watch && String(p.id) === watch) {
      const status = document.querySelector("[data-live-status]");
      const wasHome = status.classList.contains("is-home");
      status.classList.toggle("is-home", p.home);
      status.classList.toggle("is-away", !p.home);
      status.querySelector("[data-live-status-text]").textContent = p.home ? `${p.owner} is home` : `${p.owner} is out · unguarded`;
      document.querySelector("[data-live-security]").textContent = `Security: ${p.security}`;
      for (const [k, b] of Object.entries(p.bands)) {
        const cell = document.querySelector(`[data-band="${k}"]`);
        if (!cell || cell.textContent === b) continue;
        cell.textContent = b;
        const li = cell.closest(".sh-res-item");
        li.classList.remove("is-ok", "is-low", "is-empty");
        li.classList.add(`is-${b === "Empty" ? "empty" : b === "Scarce" ? "low" : "ok"}`);
        flash(li);
      }
      flash(status);
      // The scene and your options depend on whether they're home: redraw it.
      if (wasHome !== p.home) {
        toast(p.home ? "ok" : "bad", p.home ? `${p.owner} just got home.` : `${p.owner} just left their shelter.`);
        setTimeout(() => location.replace(location.pathname), 2500);
      }
    }
  });
})();
