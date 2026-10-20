// The chat hub between loads. Every form still posts normally; this sends
// messages without a reload, keeps drafts, and swaps in the parts that
// changed when a live event says something happened, with a slow fallback.
(() => {
  const channel = document.body.dataset.channel;
  const account = document.body.dataset.account;
  const draftKey = `holdout-draft:${account}:${channel}`;
  const alertBox = document.querySelector('.sx-error');
  const say = (text) => { if (alertBox) alertBox.textContent = text; };
  const body = document.querySelector('[data-message-form] input[name=body]');
  try { if (body && !body.value) body.value = sessionStorage.getItem(draftKey) || ''; } catch {}
  body?.addEventListener('input', () => { try { sessionStorage.setItem(draftKey, body.value); } catch {} });

  const bottom = () => {
    const log = document.querySelector('[data-social-messages]');
    log?.lastElementChild?.scrollIntoView({ block: 'end' });
  };

  // Clear a draft only once its POST succeeded; keep it on a refusal or a lost connection.
  document.addEventListener('submit', async (e) => {
    const form = e.target;
    if (!form.matches('[data-message-form]')) return;
    e.preventDefault();
    const button = form.querySelector('button');
    if (button) button.disabled = true;
    try {
      const r = await fetch(form.action, { method: 'POST', body: new URLSearchParams(new FormData(form)) });
      if (r.ok) {
        try { sessionStorage.removeItem(draftKey); } catch {}
        form.reset();
        form.elements.request_id.value = crypto.randomUUID();
        say('');
        await refresh(true);
        form.elements.body.focus();
      } else say(r.status === 429 ? 'Slow down a moment, then send again.' : `Message not sent (${r.status}). Check its length and try again.`);
    } catch { say('Connection lost. Your draft is kept.'); }
    finally { if (button) button.disabled = false; }
  });

  if (parent !== window) parent.postMessage({ type: 'chat-channel', url: `/social?channel=${encodeURIComponent(channel)}` }, location.origin);
  // links that leave the hub open in the game, not inside the drawer
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (a && new URL(a.href, location.href).pathname !== '/social') a.target = '_top';
  });

  // Countdown runs here; when one reaches zero the server is asked, since it decides.
  let settled = new Set();
  function countdown() {
    for (const el of document.querySelectorAll('[data-invite-deadline]')) {
      const left = Number(el.dataset.inviteDeadline) - Date.now();
      el.textContent = Math.max(0, Math.ceil(left / 1000));
      if (left <= 0 && !settled.has(el.dataset.inviteDeadline)) { settled.add(el.dataset.inviteDeadline); setTimeout(() => refresh(true), 300); }
    }
  }

  const PARTS = ['[data-social-messages]', '[data-social-empty]', '[data-social-thread]', '[data-social-invites]', '[data-social-links]', '[data-social-friends]', '[data-social-count]', '[data-chat-log]', '.ch-empty', '[data-talk-log]', '.sh-talk-empty'];
  let busy = false, again = false;
  async function refresh(force = false) {
    if (busy) { again = true; return; }
    if (!force && (document.hidden || window.frameElement?.closest('[hidden]'))) return;
    busy = true;
    try {
      const atEnd = (() => { const log = document.querySelector('[data-social-messages]'); return !log || log.getBoundingClientRect().bottom <= innerHeight + 80; })();
      const ids = [...document.querySelectorAll('[data-message-id]')].map((el) => Number(el.dataset.messageId));
      const r = await fetch('/social/pulse', { method: 'POST', body: new URLSearchParams({ channel, seen: String(Math.max(0, ...ids)) }) });
      if (r.status === 401 || r.status === 403) { location.reload(); return; }
      if (!r.ok) return;
      const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
      for (const sel of PARTS) {
        const next = doc.querySelector(sel), cur = document.querySelector(sel);
        if (!next || !cur) continue;
        for (const d of cur.querySelectorAll('details[id]')) { const n = next.querySelector(`#${d.id}`); if (n) n.open = d.open; }
        if (next.outerHTML !== cur.outerHTML) cur.replaceWith(next);
      }
      countdown();
      if (atEnd) bottom();
    } catch {} finally {
      busy = false;
      if (again) { again = false; refresh(true); }
    }
  }

  const watch = channel.startsWith('shelter:') ? `?watch=${channel.split(':')[1]}` : '';
  const events = 'EventSource' in window ? new EventSource(`/events${watch}`) : null;
  for (const type of ['social', 'chat', 'talk', 'party']) events?.addEventListener(type, () => refresh());
  addEventListener('pagehide', () => events?.close());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  bottom();
  countdown();
  setInterval(countdown, 1000);
  setInterval(() => refresh(), Number(document.body.dataset.poll) || 10000);
})();
