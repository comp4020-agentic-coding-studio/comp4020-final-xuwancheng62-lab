// The comic reader, on top of plain page links: arrow keys, swipes, and a
// bookmark so you can carry on where you left off. Without it the Previous
// and Next links still do everything.
(() => {
  let cleanup = () => {};
  function init() {
  cleanup();
  const events = new AbortController();
  cleanup = () => events.abort();
  const reader = document.querySelector(".cm-reader");
  if (!reader) return;
  const set = reader.dataset.comic;
  const page = Number(reader.dataset.page);
  const pages = Number(reader.dataset.pages);
  // v2: pages became one picture each, so older bookmarks point elsewhere
  const key = `holdout.comic.v2.${set}`;
  const go = (rel) => {
    const a = reader.querySelector(`a[rel="${rel}"]`);
    if (a) a.click();
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
    document.querySelectorAll('link[data-reader-prefetch]').forEach(el => el.remove());
    l.dataset.readerPrefetch = "";
    l.rel = "prefetch";
    l.href = next.href;
    document.head.append(l);
  }

  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
    if (e.key === "ArrowRight") go("next");
    else if (e.key === "ArrowLeft") go("prev");
  }, { signal: events.signal });

  // A clear sideways swipe turns the page; anything mostly vertical is a scroll.
  let x0 = null;
  let y0 = 0;
  const area = reader.querySelector(".cm-page");
  area.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return (x0 = null);
    x0 = e.touches[0].clientX;
    y0 = e.touches[0].clientY;
  }, { passive: true, signal: events.signal });
  area.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) go(dx < 0 ? "next" : "prev");
  }, { signal: events.signal });
  }
  document.addEventListener("holdout:reader-leaving", () => cleanup());
  document.addEventListener("holdout:reader-ready", init);
  init();
})();
