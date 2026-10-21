export function pad(n) {
  return n < 10 ? `0${n}` : String(n);
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function fh(x) {
  const H = Math.floor(x);
  const M = Math.round((x - H) * 60);
  return `${H}h${M ? (M < 10 ? `0${M}` : M) : ""}`;
}

export function dur(x) {
  const m = Math.round(x * 60);
  const j = Math.floor(m / 1440);
  const h = Math.floor(m % 1440 / 60);
  const n = m % 60;
  return ((j ? `${j} j ` : "") + (h ? `${h} h ` : "") + (n && !j ? `${n} min` : "")).trim() || "1 min";
}

export function t2s(x) {
  const h = Math.floor(x);
  const m = Math.round((x - h) * 60);
  return `${pad(h)}:${pad(m)}`;
}

export function s2t(v) {
  const p = String(v).split(":");
  return (+p[0]) + (+p[1]) / 60;
}

export function fgOf(c) {
  const r = parseInt(c.substr(1, 2), 16);
  const g = parseInt(c.substr(3, 2), 16);
  const b = parseInt(c.substr(5, 2), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#1d2330" : "#fff";
}

export function weekdayIndex() {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

export function localDateTime(date, time) {
  if (!date) return null;
  const p = date.split("-").map(Number);
  if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return null;
  const q = (time || "23:59").split(":").map(Number);
  return new Date(p[0], p[1] - 1, p[2], q[0] || 0, q[1] || 0, 0, 0);
}

export function niceDate(date) {
  if (!date) return "Sans date";
  const p = date.split("-");
  if (p.length !== 3) return date;
  return `${p[2]}/${p[1]}/${p[0]}`;
}

export function getCurrentDayIndex() {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

export function renderTimeZones() {
  const cards = document.querySelectorAll(".tz-card");
  if (!cards.length) return;
  const now = new Date();
  cards.forEach((card) => {
    const zone = card.dataset.timezone;
    const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
      timeZone: zone,
      weekday: "short",
      day: "2-digit",
      month: "short"
    });
    card.querySelector(".tz-time").textContent = timeFormatter.format(now);
    card.querySelector(".tz-date").textContent = dateFormatter.format(now);
  });
}
