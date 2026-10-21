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
  let enabled = read('enabled') === 'true';
  const saved = Number(read('volume') ?? 0.25);
  volume.value = String(Number.isFinite(saved) ? Math.max(0, Math.min(1, saved)) : 0.25);
  const audio = new Audio();
  audio.loop = true;
  audio.preload = 'none';
  let track = '', blocked = false, timer, generation = 0;
  const choose = () => document.querySelector('.fight, [data-music-combat], .br-card:not(.br-peaceful) > details[open], .ex-party.is-past > details[open]') ? 'combat' : 'quiet';
  function draw() {
    button.textContent = enabled && !blocked ? '♫ Music on' : '♫ Music off';
    button.setAttribute('aria-pressed', String(enabled && !blocked));
    label.textContent = blocked ? 'Tap to play' : track === 'combat' ? 'Combat' : 'Ambient';
  }
  function savePosition() { if (track && Number.isFinite(audio.currentTime)) write(`position.${track}`, audio.currentTime); }
  async function play() {
    if (!enabled || document.hidden) return;
    const token = ++generation;
    try {
      await audio.play();
      if (token !== generation || !enabled) return;
      blocked = false;
      clearInterval(timer);
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
    audio.src = `/static/audio/${track}.mp3`;
    draw();
    if (enabled) void play();
  }
  audio.addEventListener('loadedmetadata', () => {
    const position = Number(read(`position.${track}`));
    if (Number.isFinite(position) && position > 0 && position < audio.duration - 2) audio.currentTime = position;
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
  document.addEventListener('toggle', sync, true);
  new MutationObserver(sync).observe(document.querySelector('main'), {childList:true,subtree:true});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { ++generation; clearInterval(timer); savePosition(); audio.pause(); }
    else if (enabled) void play();
  });
  window.addEventListener('pagehide', () => { savePosition(); audio.pause(); });
  audio.addEventListener('error', () => { blocked = true; draw(); label.textContent = 'Music unavailable'; });
  sync();
})();
