import { html, raw } from 'hono/html';
import type { ShelterView } from './shelter.ts';
import { SOCIAL } from './game/config.ts';
import type { dispatchOf } from './parties.ts';
export function settingsPage(s:ShelterView,d:ReturnType<typeof dispatchOf>,message='') {
 const secs=SOCIAL.inviteMs/1000;
 return html`<div class="settings-page">${message ? html`<p role="status">${message}</p>` : ''}
  <section class="card settings-form" id="auto-join-settings">
    <h1>Auto-join settings</h1>
    <p>Invites auto-join after ${secs}s, even offline. You can decline.</p>
    <form method="post" action="/settings/dispatch">
      <label>Character<select name="who">${s.crew.map((m) => html`<option value="${m.who}" ${d.enabled && d.who === m.who ? raw("selected") : ""}>${m.who === "you" ? `You (${s.owner})` : m.name}</option>`)}<option value="off" ${!d.enabled ? raw("selected") : ""}>Off</option></select></label>
      <label>Risk limit<select name="risk">${(["likely", "risky", "grim"] as const).map((r) => html`<option value="${r}" ${r === d.risk ? raw("selected") : ""}>${r[0].toUpperCase() + r.slice(1)}</option>`)}</select></label>
      <label>Row<select name="row"><option value="front" ${d.row === "front" ? raw("selected") : ""}>Front</option><option value="back" ${d.row === "back" ? raw("selected") : ""}>Back</option></select></label>
      <button>Save</button>
    </form>
  </section></div>`;
}
