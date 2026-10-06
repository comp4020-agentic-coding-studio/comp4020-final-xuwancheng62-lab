// Countdowns, live resource ticking and relative times. The server is the
// source of truth; this only animates between page loads.
const pad = (n) => String(n).padStart(2, "0");
const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
};
const ago = (ms) => {
  const s = Math.round(ms / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

let reloading = false;
function tick() {
  const now = Date.now();
  for (const el of document.querySelectorAll("[data-until]")) {
    const left = Number(el.dataset.until) - now;
    el.textContent = clock(left);
    if (left <= 0 && !reloading) {
      reloading = true;
      setTimeout(() => location.reload(), 600);
    }
  }
  for (const el of document.querySelectorAll("[data-rate]")) {
    const hours = (now - Number(el.dataset.at)) / 3_600_000;
    el.textContent = String(Math.max(0, Math.floor(Number(el.dataset.value) + Number(el.dataset.rate) * hours)));
  }
  for (const el of document.querySelectorAll("time[data-ago]")) {
    el.textContent = ago(now - Number(el.dataset.ago));
  }
  for (const el of document.querySelectorAll("time[data-at]")) {
    el.textContent = `at ${new Date(Number(el.dataset.at)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
}
tick();
setInterval(tick, 1000);
