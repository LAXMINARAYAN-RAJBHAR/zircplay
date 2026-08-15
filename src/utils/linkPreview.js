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

// ── Trailing punctuation trim ──────────────────────────────────────────
// NEW: URL_MATCH_REGEX/URL_SPLIT_REGEX's `[^\s]+` is greedy and has no
// concept of sentence punctuation, so a message like
// "check this out: https://example.com/page." or
// "see (https://example.com/page)" swallows the trailing "." or ")"
// into the URL — breaking both the preview fetch (wrong resource / 404)
// and the rendered link. Strip common trailing punctuation that isn't
// meaningfully part of the URL before using it anywhere.
const TRAILING_PUNCT_RE = /[).,!?;:'"]+$/;

export const stripTrailingPunctuation = (url) => url.replace(TRAILING_PUNCT_RE, "");

export const extractFirstUrl = (text) => {
  if (!text) return null;
  const match = text.match(URL_MATCH_REGEX);
  if (!match) return null;
  const raw = stripTrailingPunctuation(match[0]);
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

// ── FIXED: subscribeToPreview now cleans up after itself. Previously
// the returned unsubscribe() only ever removed the callback from the
// url's Set, leaving an empty Set (and its `listeners` entry) behind
// forever once the last subscriber for a given url unmounted — a slow
// memory leak over a long session that pastes many distinct links.
export const subscribeToPreview = (url, cb) => {
  if (!listeners.has(url)) listeners.set(url, new Set());
  listeners.get(url).add(cb);
  return () => {
    const set = listeners.get(url);
    if (!set) return;
    set.delete(cb);
    if (set.size === 0) listeners.delete(url);
  };
};

export const getCachedPreview = (url) => previewCache.get(url) || null;