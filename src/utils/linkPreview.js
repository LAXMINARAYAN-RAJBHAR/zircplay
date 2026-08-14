// Shared URL detection + a deduped, cached fetch layer for link previews,
// used by both 1:1 chat (MessagesPanel) and group chat (GroupChatWindow).
// Fetches via the existing /api/link-preview edge function.

// Non-global — used with .match() to find the FIRST url in a message
// (for deciding whether to render a preview card at all).
export const URL_MATCH_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/i;

// Global — used with .split() to break message text into url / non-url
// segments so every url in the text can be turned into a clickable link.
export const URL_SPLIT_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

export const isUrlToken = (str) =>
  new RegExp(`^${URL_MATCH_REGEX.source}$`, "i").test(str);

export const extractFirstUrl = (text) => {
  if (!text) return null;
  const match = text.match(URL_MATCH_REGEX);
  if (!match) return null;
  const raw = match[0];
  return raw.startsWith("www.") ? `https://${raw}` : raw;
};

export const truncateUrlDisplay = (url, max = 40) => {
  const clean = url.replace(/^https?:\/\//, "").replace(/^www\./, "");
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
};

// ── In-memory cache, shared across every open chat window for the
// lifetime of the page. Keyed by exact URL string. Prevents re-fetching
// the same link's preview on every re-render, and prevents duplicate
// in-flight requests when the same link appears in multiple messages
// (or multiple open conversations) at once. ──
const previewCache = new Map(); // url -> { status: 'loading'|'done'|'error', data }
const listeners = new Map(); // url -> Set<callback>

const notify = (url) => {
  (listeners.get(url) || []).forEach((cb) => cb(previewCache.get(url)));
};

export const fetchLinkPreview = async (url) => {
  if (!url) return null;

  const existing = previewCache.get(url);
  // Already loading or already succeeded — don't re-fetch. Errors ARE
  // retried (e.g. a transient network blip shouldn't permanently blank
  // a link for the rest of the session).
  if (existing && existing.status !== "error") return existing;

  previewCache.set(url, { status: "loading", data: null });
  notify(url);

  try {
    const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error("preview fetch failed");
    const data = await res.json();
    const entry = { status: "done", data };
    previewCache.set(url, entry);
    notify(url);
    return entry;
  } catch {
    const entry = { status: "error", data: null };
    previewCache.set(url, entry);
    notify(url);
    return entry;
  }
};

export const subscribeToPreview = (url, cb) => {
  if (!listeners.has(url)) listeners.set(url, new Set());
  listeners.get(url).add(cb);
  return () => {
    listeners.get(url)?.delete(cb);
  };
};

export const getCachedPreview = (url) => previewCache.get(url) || null;