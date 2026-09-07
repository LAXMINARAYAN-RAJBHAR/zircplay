// src/utils/translate.js
//
// Real translation via a self-hosted LibreTranslate server, replacing
// the earlier stub dictionary used in Reels.jsx / Video.jsx /
// PostCard.jsx (which only swapped a handful of hardcoded words).
//
// ── SETUP ──────────────────────────────────────────────────────────
// Set LIBRETRANSLATE_URL to your server's /translate endpoint below,
// e.g. "https://your-libretranslate-domain.com/translate". If your
// instance requires an API key, set LIBRETRANSLATE_API_KEY too —
// otherwise leave it as an empty string and it's simply omitted from
// the request body.
//
// This is the ONLY place that needs to change if the endpoint or key
// ever changes — every component below just imports translateToHindi().
const LIBRETRANSLATE_URL = "https://YOUR-LIBRETRANSLATE-SERVER/translate"; // <-- set this to your server's URL
const LIBRETRANSLATE_API_KEY = ""; // <-- set this only if your instance requires an API key

// In-memory cache so re-toggling "Translate to Hindi" / "Show original"
// on the same comment within one page session doesn't re-hit the
// network every time. Cleared on full page reload, which is fine — a
// fresh translation on next load is cheap and always up to date.
const translationCache = new Map();

/**
 * Translates `text` to Hindi via the configured LibreTranslate server.
 * Returns the original text (with a short marker appended) if the
 * request fails, so the UI always shows *something* instead of an
 * empty string or a thrown error.
 */
export async function translateToHindi(text) {
  if (!text || !text.trim()) return text;

  if (translationCache.has(text)) {
    return translationCache.get(text);
  }

  try {
    const res = await fetch(LIBRETRANSLATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "auto",
        target: "hi",
        format: "text",
        ...(LIBRETRANSLATE_API_KEY ? { api_key: LIBRETRANSLATE_API_KEY } : {}),
      }),
    });

    if (!res.ok) {
      throw new Error(`LibreTranslate responded with status ${res.status}`);
    }

    const data = await res.json();
    const translated = data?.translatedText;
    if (!translated) {
      throw new Error("LibreTranslate response had no translatedText field");
    }

    translationCache.set(text, translated);
    return translated;
  } catch (err) {
    console.error("[translate] LibreTranslate request failed:", err);
    // Fall back to showing the original text with a visible marker,
    // rather than silently failing or throwing up into the caller.
    return `${text} (translation unavailable — check LibreTranslate server)`;
  }
}