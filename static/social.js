(() => {
  const channel = document.body.dataset.channel;
  const account = document.body.dataset.account;
  const draftKey = `holdout-draft:${account}:${channel}`;
  const bodyInput = document.querySelector('input[name=body]');
  try { if (bodyInput) bodyInput.value = sessionStorage.getItem(draftKey) || ''; } catch {}
  bodyInput?.addEventListener('input', () => { try { sessionStorage.setItem(draftKey, bodyInput.value); } catch {} });
  // A normal form remains usable without JavaScript. Clear a sent draft only
  // when its POST succeeds; keep it on validation/network errors.
  document.addEventListener('submit', async (e) => {
    const form = e.target;
    if (!form.querySelector('input[name=body]')) return;
    e.preventDefault();
    const button = form.querySelector('button');
    if (button) button.disabled = true;
    try {
      const r = await fetch(form.action, { method: 'POST', body: new FormData(form) });
      if (r.ok) { try { sessionStorage.removeItem(draftKey); } catch {} location.href = `/social?channel=${encodeURIComponent(channel)}`; }
      else { const alert = document.querySelector('[role=alert]'); if (alert) alert.textContent = `Message not sent (${r.status}). Check its length or wait a moment and retry.`; }
    } catch { const alert = document.querySelector('[role=alert]'); if (alert) alert.textContent = 'Connection lost. Your draft is kept.'; }
    finally { if (button) button.disabled = false; }
  });
  if (parent !== window) parent.postMessage({ type: 'chat-channel', url: `/social?channel=${encodeURIComponent(channel)}` }, location.origin);
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (a && new URL(a.href).pathname !== '/social') a.target = '_top';
  });
  let busy = false;
  function countdown() {
    document.querySelectorAll('[data-invite-deadline]').forEach((el) => { el.textContent = Math.max(0, Math.ceil((Number(el.dataset.inviteDeadline) - Date.now()) / 1000)); });
  }
  async function refresh() {
    countdown();
    if (busy || document.hidden || window.frameElement?.closest("[hidden]")) return;
    busy = true;
    try {
      const ids = [...document.querySelectorAll('[data-message-id]')].map((el) => Number(el.dataset.messageId));
      const r = await fetch('/social/pulse', { method: 'POST', body: new URLSearchParams({ channel, seen: String(Math.max(0, ...ids)) }) });
      if (!r.ok) { if (r.status === 403 || r.status === 401) location.reload(); return; }
      const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
      for (const selector of ['[data-social-messages]', '[data-social-invites]', '[data-social-links]', '[data-social-friends]', '[data-social-count]', '[data-chat-log]', '.ch-empty', '[data-talk-log]', '.sh-talk-empty']) {
        const next = doc.querySelector(selector), current = document.querySelector(selector);
        if (next && current && selector === '[data-social-invites]') {
          next.querySelectorAll('[data-invite-deadline]').forEach((el) => {
            const old = current.querySelector(`[data-invite-deadline="${el.dataset.inviteDeadline}"]`);
            if (old) el.textContent = old.textContent;
          });
        }
        if (next && current && next.outerHTML !== current.outerHTML) current.replaceWith(next);
      }
      countdown();
    } catch {} finally { busy = false; }
  }
  const events = new EventSource(`/events${channel.startsWith("shelter:") ? `?watch=${channel.split(":")[1]}` : ""}`);
  for (const type of ["social", "chat", "talk", "party"]) events.addEventListener(type, refresh);
  window.addEventListener("pagehide", () => events.close());
  refresh(); setInterval(refresh, Number(document.body.dataset.poll) || 1000);
})();
