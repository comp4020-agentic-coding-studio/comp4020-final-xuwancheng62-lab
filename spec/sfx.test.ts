import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {expect,inject,it} from 'vitest';

// Sound cues for other players' actions: served to signed-in pages, with a
// labelled toggle that only appears once the script can drive it.
const baseUrl = inject('baseUrl');
const url = (path: string) => new URL(path, baseUrl);

it('serves the sound script and a hidden, labelled Settings toggle on game pages', async () => {
  const res = await fetch(url('/register'), {method:'POST', redirect:'manual', headers:{'content-type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({username:`sfx${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}`, password:'correct horse battery'})});
  const cookie = res.headers.getSetCookie().find(c => c.startsWith('sid='))!.split(';')[0];
  for (const path of ['/', '/world', '/activity']) {
    const doc = new JSDOM(await (await fetch(url(path), {headers:{cookie}})).text()).window.document;
    expect([...doc.querySelectorAll('script')].some(s => s.src.startsWith('/static/sfx.js'))).toBe(true);
    const box = doc.querySelector('[data-settings] [data-sfx]')!;
    expect(box.hasAttribute('hidden')).toBe(true);
    expect(box.querySelector('button[type=button][aria-pressed]')?.textContent).toMatch(/Sounds/);
    expect(box.querySelector('input[type=range]')?.getAttribute('aria-label')).toBe('Sound effects volume');
  }
  const script = await fetch(url('/static/sfx.js'));
  expect(script.status).toBe(200);
  const guest = new JSDOM(await (await fetch(url('/readme/'))).text()).window.document;
  expect(guest.querySelector('[data-sfx]')).toBeNull();
});

function load(saved?: string) {
  const dom = new JSDOM('<main><p id="text">Words</p><a id="link" href="#x">Go</a></main><aside data-sfx hidden><button type="button"></button><input type="range" value="0.4"></aside>', {url:'http://localhost/', runScripts:'outside-only', pretendToBeVisual:true});
  const w = dom.window as any;
  if (saved) w.localStorage.setItem('holdout.sfx.enabled', saved);
  const started: number[] = [];
  const param = () => ({setValueAtTime(){}, exponentialRampToValueAtTime(){}});
  class Ctx { state = 'running'; currentTime = 0; destination = {};
    createOscillator() { return {type:'', frequency:param(), connect:(g: any) => g, start:(t: number) => started.push(t), stop(){}}; }
    createGain() { return {gain:param(), connect:(d: any) => d}; }
    resume() { this.state = 'running'; return Promise.resolve(); } }
  w.AudioContext = Ctx;
  w.eval(readFileSync('static/sfx.js', 'utf8'));
  const cue = (name: string) => w.document.dispatchEvent(new w.CustomEvent('holdout:sfx', {detail:name}));
  return {w, started, cue};
}

it('plays a cue once per kind per second and stays silent when muted', () => {
  const {w, started, cue} = load();
  expect(w.document.querySelector('[data-sfx]').hidden).toBe(false);
  expect(w.document.querySelector('button').getAttribute('aria-pressed')).toBe('true');
  cue('knock'); const once = started.length; expect(once).toBeGreaterThan(0);
  cue('knock'); expect(started.length).toBe(once);
  cue('nonsense'); expect(started.length).toBe(once);
  w.document.querySelector('button').click();
  expect(w.localStorage.getItem('holdout.sfx.enabled')).toBe('false');
  expect(w.document.querySelector('button').textContent).toMatch(/off/);
  const muted = load('false');
  muted.w.document.getElementById('link').click(); expect(muted.started).toHaveLength(0);
  muted.cue('alarm'); expect(muted.started).toHaveLength(0);
});

it('ticks on every click that something answers, not on plain text', () => {
  const {w, started} = load();
  w.document.getElementById('text').click(); expect(started).toHaveLength(0);
  w.document.getElementById('link').click(); expect(started).toHaveLength(1);
  w.document.getElementById('link').click(); expect(started).toHaveLength(2);
});
