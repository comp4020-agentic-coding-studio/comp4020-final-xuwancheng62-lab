// The chat drawer on every game page. Without JavaScript the button is a
// link to the full chat page. The badge follows live events, with a slow
// fallback; an invitation lights the badge and a toast, never opens the drawer.
(() => {
  const shell = document.querySelector('[data-social-account]');
  if (!shell) return;
  const key = `holdout-chat:${shell.dataset.socialAccount}`;
  const drawer = shell.querySelector('.social-drawer');
  const frame = shell.querySelector('iframe');
  const toggle = shell.querySelector('.social-toggle');
  const badge = shell.querySelector('[data-unread]');
  const embed = (url) => `${url}${url.includes('?') ? '&' : '?'}embed=1`;
  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem(key) || '{}'); } catch {}
  const store = () => { try { sessionStorage.setItem(key, JSON.stringify(saved)); } catch {} };
  function open(url = saved.url || '/social?channel=lobby') {
    saved = { url, open: true }; store();
    drawer.hidden = false;
    document.documentElement.classList.add('chat-open');
    if (frame.dataset.url !== url) { frame.dataset.url = url; frame.src = embed(url); }
    toggle.setAttribute('aria-expanded', 'true');
    frame.focus();
  }
  function close() {
    saved.open = false; store();
    drawer.hidden = true;
    document.documentElement.classList.remove('chat-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  }
  shell.querySelector('[data-social-close]').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) close(); });
  toggle.addEventListener('click', (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    drawer.hidden ? open() : close();
  });
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link || link === toggle || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && url.pathname === '/social') { e.preventDefault(); open(url.pathname + url.search); }
  });
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.source !== frame.contentWindow) return;
    if (e.data?.type === 'chat-channel' && typeof e.data.url === 'string' && /^\/social\?channel=[\w:%-]+$/.test(e.data.url)) {
      saved.url = e.data.url; frame.dataset.url = e.data.url; store();
    }
  });
  if (saved.open) open();

  let busy = false, timer = 0;
  async function poll() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const r = await fetch('/social/status', { cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      const n = d.unread + d.pending + d.requests;
      badge.textContent = n || '';
      toggle.classList.toggle('has-news', n > 0);
      clearTimeout(timer);
      // an invitation is settled on the server at its deadline; look again just after
      if (d.nextDeadline) timer = setTimeout(poll, Math.max(500, d.nextDeadline - Date.now() + 400));
    } catch {} finally { busy = false; }
  }
  document.addEventListener('holdout:social', poll);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  poll();
  setInterval(poll, Number(shell.dataset.poll) || 10000);
})();
