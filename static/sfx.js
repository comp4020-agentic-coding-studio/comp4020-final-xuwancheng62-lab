// Presentation only: sound cues never change combat or game state.
// Every sound is synthesised here with Web Audio; no files, no network.
(() => {
  if (window.top !== window.self) return;
  const box = document.querySelector('[data-sfx]');
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!box || !Ctx) return;
  box.hidden = false;
  const button = box.querySelector('button');
  const volume = box.querySelector('input');
  const read = (key) => { try { return localStorage.getItem(`holdout.sfx.${key}`); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(`holdout.sfx.${key}`, String(value)); } catch {} };
  let enabled = read('enabled') !== 'false';
  const saved = Number(read('volume') ?? 0.4);
  volume.value = String(Number.isFinite(saved) ? Math.max(0, Math.min(1, saved)) : 0.4);

  // [frequency, start (s), length (s), wave, pitch drop]
  const CUES = {
    alarm: [[220, 0, 0.22, 'square'], [165, 0.26, 0.32, 'square']],
    chime: [[880, 0, 0.4, 'sine'], [1320, 0, 0.25, 'sine']],
    knock: [[180, 0, 0.09, 'triangle', true], [180, 0.17, 0.09, 'triangle', true]],
    blip: [[1320, 0, 0.06, 'square'], [990, 0.07, 0.06, 'square']],
    return: [[523, 0, 0.16, 'triangle'], [659, 0.13, 0.16, 'triangle'], [784, 0.26, 0.32, 'triangle']],
    coin: [[1568, 0, 0.08, 'sine'], [2093, 0.09, 0.3, 'sine']],
    find: [[440, 0, 0.7, 'sine'], [554, 0.04, 0.66, 'sine'], [659, 0.08, 0.62, 'sine']],
    click: [[2600, 0, 0.03, 'triangle', true]],
  };
  const LOUDNESS = { alarm: 0.5, knock: 1, blip: 0.45, click: 0.6 };

  let ctx;
  const last = {};
  let lastAny = 0, lastSubmit = 0;
  function play(name, force = false) {
    const notes = CUES[name];
    if (!notes || (!force && (!enabled || document.hidden))) return;
    if (name === 'click') { ctx ??= new Ctx(); if (ctx.state === 'suspended') void ctx.resume(); return sound(notes, name); }
    const now = Date.now();
    // one cue per kind per second, and never two cues on top of each other
    if (!force && (now - (last[name] ?? 0) < 1000 || now - lastAny < 400)) return;
    // what you just did comes back to you as an event: stay quiet
    if (!force && now - lastSubmit < 1500) return;
    ctx ??= new Ctx();
    if (ctx.state === 'suspended') { void ctx.resume(); if (!force) return; }
    last[name] = lastAny = now;
    sound(notes, name);
  }
  function sound(notes, name) {
    const level = Number(volume.value) * (LOUDNESS[name] ?? 0.7) * 0.6;
    if (level <= 0) return;
    const t0 = ctx.currentTime + 0.01;
    for (const [freq, start, length, wave, drop] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, t0 + start);
      if (drop) osc.frequency.exponentialRampToValueAtTime(freq / 3, t0 + start + length);
      gain.gain.setValueAtTime(0.0001, t0 + start);
      gain.gain.exponentialRampToValueAtTime(level, t0 + start + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + length);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + length + 0.02);
    }
  }

  function draw() {
    button.textContent = enabled ? '🔔 Sounds on' : '🔕 Sounds off';
    button.setAttribute('aria-pressed', String(enabled));
  }
  button.addEventListener('click', () => {
    enabled = !enabled;
    write('enabled', enabled);
    draw();
    if (enabled) play('chime', true);
  });
  volume.addEventListener('change', () => { write('volume', volume.value); play('chime', true); });
  // Browsers keep audio suspended until a real interaction.
  const unlock = () => { if (!enabled) return; ctx ??= new Ctx(); if (ctx.state === 'suspended') void ctx.resume(); };
  for (const type of ['pointerdown', 'keydown', 'touchstart']) document.addEventListener(type, unlock, {passive: true});
  const mark = () => { lastSubmit = Date.now(); };
  document.addEventListener('submit', mark, true);
  // the chat drawer is a same-origin frame: its sends are yours too
  for (const frame of document.querySelectorAll('iframe')) frame.addEventListener('load', () => { try { frame.contentDocument.addEventListener('submit', mark, true); frame.contentDocument.addEventListener('click', tick, true); } catch {} });
  document.addEventListener('holdout:sfx', (e) => play(e.detail));
  // A crisp tick whenever something on the page answers a click or key press.
  const ACTIVE = 'a[href], button:not(:disabled), summary, [role=button], label, select, input[type=checkbox], input[type=radio], input[type=submit]';
  const tick = (e) => { if (e.target.closest?.(ACTIVE) && !box.contains(e.target)) play('click'); };
  document.addEventListener('click', tick, true);
  draw();
})();
