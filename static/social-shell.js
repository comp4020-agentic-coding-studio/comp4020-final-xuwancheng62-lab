(() => {
  const shell = document.querySelector('[data-social-account]');
  if (!shell) return;
  const key = `holdout-chat:${shell.dataset.socialAccount}`;
  const drawer = shell.querySelector('.social-drawer');
  const frame = shell.querySelector('iframe');
  const toggle = shell.querySelector('.social-toggle');
  const badge = shell.querySelector('[data-unread]');
  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem(key) || '{}'); } catch {}
  function store() { try { sessionStorage.setItem(key, JSON.stringify(saved)); } catch {} }
  function open(url = saved.url || '/social?channel=world') {
    saved = { url, open: true }; store(); drawer.hidden = false;
    if (frame.getAttribute('src') !== url) frame.src = url;
    toggle.setAttribute('aria-expanded', 'true');
  }
  function close() { saved.open = false; store(); drawer.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); }
  shell.querySelector('[data-social-close]').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) close(); });
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && url.pathname === '/social') { e.preventDefault(); open(url.pathname + url.search); }
  });
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.source !== frame.contentWindow) return;
    if (e.data?.type === 'chat-channel' && typeof e.data.url === 'string' && /^\/social\?channel=/.test(e.data.url)) { saved.url = e.data.url; store(); }
  });
  if (saved.open) open();
  let busy = false;
  async function poll() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const r = await fetch('/social/status', { cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      badge.textContent = d.unread + d.pending + d.requests || '';
      if (d.pending && drawer.hidden) open();
    } catch {} finally { busy = false; }
  }
  poll(); setInterval(poll, Number(shell.dataset.poll));
})();
