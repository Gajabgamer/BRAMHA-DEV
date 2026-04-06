export const STORAGE_KEY = "movie24-react-state-v1";
export const NIGHT_OFFER_START_HOUR = 0;
export const NIGHT_OFFER_END_HOUR = 5;

export function pad(value) {
  return String(value).padStart(2, "0");
}

export function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function capitalizeWords(value = "") {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function parseDurationToMinutes(duration) {
  const match = duration.match(/(?:(\d+)h)?\s*(?:(\d+)m)?/i);
  if (!match) {
    return 120;
  }

  return Number(match[1] || 0) * 60 + Number(match[2] || 0);
}

export function formatPlaybackPosition(duration, progress) {
  const totalMinutes = parseDurationToMinutes(duration);
  const watchedMinutes = Math.max(1, Math.round((totalMinutes * progress) / 100));
  const hours = Math.floor(watchedMinutes / 60);
  const minutes = watchedMinutes % 60;
  return `${pad(hours)}:${pad(minutes)}:00`;
}

export function formatDateTime(timestamp) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(timestamp);
}

export function splitRemaining(expiry) {
  const totalSeconds = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60
  };
}

export function formatRemaining(expiry, mode = "short") {
  const { hours, minutes, seconds } = splitRemaining(expiry);

  if (mode === "long") {
    return `${hours}h ${minutes}m`;
  }

  if (mode === "clock") {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `⏳ ${hours}h left`;
}

export function isNightOfferActive(date = new Date()) {
  const hour = date.getHours();
  return hour >= NIGHT_OFFER_START_HOUR && hour < NIGHT_OFFER_END_HOUR;
}

export function createPosterData({ title, genreLabel, duration, quality, palette }) {
  const [start = "#10192f", end = "#243b71", accent = "#f5c518"] = palette || [];
  const titleLines = wrapPosterTitle(title);
  const titleMarkup = titleLines
    .map((line, index) => `<tspan x="60" dy="${index === 0 ? 0 : 74}">${escapeHtml(line.toUpperCase())}</tspan>`)
    .join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${start}" />
          <stop offset="100%" stop-color="${end}" />
        </linearGradient>
      </defs>
      <rect width="600" height="900" fill="url(#g)" />
      <circle cx="500" cy="150" r="140" fill="${accent}" opacity="0.14" />
      <circle cx="120" cy="760" r="190" fill="#ffffff" opacity="0.06" />
      <rect x="40" y="40" width="520" height="820" rx="28" fill="none" stroke="rgba(255,255,255,0.14)" />
      <text x="60" y="110" fill="#f5c518" font-size="26" font-family="Arial, sans-serif" letter-spacing="6">MOVIE24 PREMIERE</text>
      <text x="60" y="620" fill="#f0f2f5" font-size="74" font-weight="700" font-family="Arial, sans-serif">${titleMarkup}</text>
      <text x="60" y="790" fill="#c8ccd6" font-size="24" font-family="Arial, sans-serif" letter-spacing="3">${escapeHtml((genreLabel || "FEATURED").toUpperCase())} • ${escapeHtml((duration || "2H 00M").toUpperCase())}</text>
      <text x="60" y="835" fill="#ffffff" font-size="20" font-family="Arial, sans-serif" opacity="0.75">${escapeHtml((quality || "HD").toUpperCase())}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function wrapPosterTitle(title) {
  const words = title.split(" ");
  if (words.length === 1) {
    return [words[0]];
  }

  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
