// The comic reader, on top of plain page links: arrow keys, swipes, and a
// bookmark so you can carry on where you left off. Without it the Previous
// and Next links still do everything.
(() => {
  const reader = document.querySelector(".cm-reader");
  if (!reader) return;
  const set = reader.dataset.comic;
  const page = Number(reader.dataset.page);
  const pages = Number(reader.dataset.pages);
  // v2: pages became one picture each, so older bookmarks point elsewhere
  const key = `holdout.comic.v2.${set}`;
  const go = (rel) => {
    const a = reader.querySelector(`a[rel="${rel}"]`);
    if (a) location.href = a.href;
  };

  // The bookmark is only a convenience for this browser; reading works without it.
  // Opening the comic from the collection lands on page 1 without a page in
  // the address; that offers the bookmark instead of overwriting it.
  const fresh = !new URLSearchParams(location.search).has("page");
  let saved = 0;
  try {
    saved = Number(localStorage.getItem(key)) || 0;
    if (!(fresh && page === 1)) localStorage.setItem(key, String(page));
  } catch {}
  if (fresh && page === 1 && saved > 1 && saved <= pages) {
    const resume = reader.querySelector(".cm-resume");
    resume.innerHTML = "";
    const a = document.createElement("a");
    a.href = `?page=${saved}`;
    a.textContent = `Carry on from page ${saved}`;
    resume.append("You were reading. ", a);
    resume.hidden = false;
  }

  // Fetch the next page ahead so turning feels instant.
  const next = reader.querySelector('a[rel="next"]');
  if (next) {
    const l = document.createElement("link");
    l.rel = "prefetch";
    l.href = next.href;
    document.head.append(l);
  }

  // A Legendary waiting at the end of the story opens over the page, and holds
  // the keyboard until it's accepted or put aside. Escape keeps it on the page.
  const reward = reader.querySelector("[data-reward]");
  if (reward) {
    reward.classList.add("is-overlay");
    reward.setAttribute("role", "dialog");
    reward.setAttribute("aria-modal", "true");
    document.body.classList.add("cm-open-body");
    const accept = reward.querySelector(".cm-accept");
    setTimeout(() => accept?.focus(), 60);
    const close = () => { reward.classList.remove("is-overlay"); reward.removeAttribute("role"); reward.removeAttribute("aria-modal"); document.body.classList.remove("cm-open-body"); };
    reward.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
      else if (e.key === "Tab") { e.preventDefault(); accept?.focus(); }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (reward?.classList.contains("is-overlay")) return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
    if (e.key === "ArrowRight") go("next");
    else if (e.key === "ArrowLeft") go("prev");
  });

  // A clear sideways swipe turns the page; anything mostly vertical is a scroll.
  let x0 = null;
  let y0 = 0;
  const area = reader.querySelector(".cm-page");
  area.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return (x0 = null);
    x0 = e.touches[0].clientX;
    y0 = e.touches[0].clientY;
  }, { passive: true });
  area.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) go(dx < 0 ? "next" : "prev");
  });
})();
