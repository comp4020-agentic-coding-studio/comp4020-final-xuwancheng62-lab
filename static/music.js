// Presentation only: music never changes combat or game state.
(() => {
  if (window.top !== window.self) return;
  const box = document.querySelector('[data-music]');
  if (!box) return;
  box.hidden = false;
  const button = box.querySelector('button');
  const volume = box.querySelector('input');
  const label = box.querySelector('[data-music-label]');
  const read = (key) => { try { return localStorage.getItem(`holdout.music.${key}`); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(`holdout.music.${key}`, String(value)); } catch {} };
  let enabled = read('enabled') !== 'false';
  const saved = Number(read('volume') ?? 0.25);
  volume.value = String(Number.isFinite(saved) ? Math.max(0, Math.min(1, saved)) : 0.25);
  const audio = new Audio();
  audio.loop = true;
  audio.preload = 'auto';
  // carry: this page continues music the last page was playing a moment ago
  let track = '', blocked = false, timer, generation = 0, carry = false;
  const choose = () => /^\/(world|expeditions)(?:\/|$)/.test(location.pathname) ? 'combat' : 'quiet';
  function draw() {
    button.textContent = enabled ? '♫ Music on' : '♫ Music off';
    button.setAttribute('aria-pressed', String(enabled));
    label.textContent = blocked ? 'Tap to play' : track === 'combat' ? 'Combat' : 'Ambient';
  }
  function savePosition() { if (track && Number.isFinite(audio.currentTime)) { write(`position.${track}`, audio.currentTime); write(`at.${track}`, audio.paused ? 0 : Date.now()); } }
  const since = () => (Date.now() - Number(read(`at.${track}`) ?? 0)) / 1000;
  async function play() {
    if (!enabled || document.hidden) return;
    const token = ++generation;
    try {
      await audio.play();
      if (token !== generation || !enabled) return;
      blocked = false;
      clearInterval(timer);
      // a page change is not a new start: keep the volume instead of fading in again
      if (carry) { carry = false; audio.volume = Number(volume.value); draw(); return; }
      audio.volume = 0;
      timer = setInterval(() => {
        const target = Number(volume.value);
        audio.volume = Math.min(target, audio.volume + 0.025);
        if (audio.volume >= target) clearInterval(timer);
      }, 60);
    } catch { if (token === generation) blocked = true; }
    draw();
  }
  function sync() {
    const next = choose();
    if (next === track) return;
    savePosition();
    ++generation;
    clearInterval(timer);
    audio.pause();
    track = next;
    const gap = since();
    carry = gap > 0 && gap < 5;
    audio.src = `/static/audio/${track}.mp3`;
    draw();
    if (enabled) void play();
  }
  audio.addEventListener('loadedmetadata', () => {
    let position = Number(read(`position.${track}`));
    // pick up where the music would be by now, not where the last page let go
    const gap = since();
    if (gap > 0 && gap < 5) position += gap;
    if (Number.isFinite(position) && position > 0 && audio.duration > 2) audio.currentTime = position % audio.duration;
  });
  button.addEventListener('click', () => {
    enabled = blocked || !enabled;
    write('enabled', enabled);
    blocked = false;
    if (enabled) void play();
    else { ++generation; clearInterval(timer); audio.pause(); savePosition(); }
    draw();
  });
  volume.addEventListener('input', () => { clearInterval(timer); audio.volume = Number(volume.value); write('volume', volume.value); });
  // Browsers may block sound until a real interaction; retry without changing preference.
  const unlock = (event) => { if (enabled && blocked && !box.contains(event.target)) void play(); };
  document.addEventListener('click', unlock);
  document.addEventListener('keydown', unlock);
  window.addEventListener('popstate', sync);
  new MutationObserver(sync).observe(document.querySelector('main'), {childList:true,subtree:true});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { ++generation; clearInterval(timer); savePosition(); audio.pause(); }
    else if (enabled) void play();
  });
  window.addEventListener('pagehide', () => { savePosition(); audio.pause(); });
  audio.addEventListener('error', () => { blocked = true; draw(); label.textContent = 'Music unavailable'; });
  sync();
})();
