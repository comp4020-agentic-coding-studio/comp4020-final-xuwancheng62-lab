// Keep the document (and music player) alive while turning a reader's pages.
// Normal links remain the fallback; game actions never pass through this code.
(() => {
  const readerPath = (path) => path === '/intro' || /^\/collection\/[^/]+\/comic$/.test(path);
  if (!readerPath(location.pathname)) return;
  const path = location.pathname;
  let controller;
  async function navigate(url, historyMode = 'push') {
    controller?.abort();
    const request = new AbortController();
    controller = request;
    const main = document.querySelector('main');
    main.setAttribute('aria-busy', 'true');
    try {
      const res = await fetch(url.href, { signal: request.signal, headers: { Accept: 'text/html' } });
      if (!res.ok || new URL(res.url).pathname !== path) throw new Error('Reader unavailable');
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      const next = doc.querySelector('main');
      if (!next?.querySelector('.intro, .cm-reader')) throw new Error('Not a reader');
      if (request.signal.aborted) return;
      document.dispatchEvent(new Event('holdout:reader-leaving'));
      main.replaceChildren(...next.childNodes);
      document.title = doc.title;
      if (historyMode === 'push') history.pushState(null, '', url.href);
      document.dispatchEvent(new Event('holdout:reader-ready'));
      const heading = main.querySelector('h1');
      if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
      window.scrollTo(0, 0);
    } catch (error) {
      if (error.name !== 'AbortError') location.assign(url.href);
    } finally {
      if (controller === request) main.removeAttribute('aria-busy');
    }
  }
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname !== path || url.hash) return;
    event.preventDefault();
    if (url.href !== location.href) void navigate(url);
  });
  window.addEventListener('popstate', () => {
    if (location.pathname === path) void navigate(new URL(location.href), 'pop');
    else location.reload();
  });
})();
