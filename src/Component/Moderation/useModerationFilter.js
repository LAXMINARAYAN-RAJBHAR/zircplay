import { useEffect, useRef } from "react";
import { supabase } from "../../config/supabase";

// ── Hardcoded fallback list (used if DB fetch fails) ──────────────────────────
const FALLBACK_BANNED = [
  "sex","nude","naked","porn","xxx","explicit","nsfw","erotic",
  "rape","violence","terrorist","suicide","child abuse",
  "adult content","18+","sexual","genitals","intercourse",
];

// ── Module-level cache so we only fetch once per session ──────────────────────
let cachedWords = null;
let fetchPromise = null;

const loadBannedWords = () => {
  if (cachedWords) return Promise.resolve(cachedWords);
  if (fetchPromise) return fetchPromise;
  fetchPromise = supabase
    .from("banned_words")
    .select("word")
    .then(({ data, error }) => {
      if (error || !data || data.length === 0) {
        cachedWords = FALLBACK_BANNED;
      } else {
        cachedWords = data.map((r) => r.word.toLowerCase().trim());
      }
      fetchPromise = null;
      return cachedWords;
    });
  return fetchPromise;
};

// ── Preload on import ─────────────────────────────────────────────────────────
loadBannedWords();

// ── Main checker function (call this anywhere without the hook) ───────────────
export const checkContent = async (...texts) => {
  const words = await loadBannedWords();
  const combined = texts.join(" ").toLowerCase();
  const found = words.find((w) => combined.includes(w));
  return {
    isClean: !found,
    violatingWord: found || null,
  };
};

// ── Sync checker (uses cached words only — call after hook has loaded) ────────
export const checkContentSync = (...texts) => {
  if (!cachedWords) return { isClean: true, violatingWord: null };
  const combined = texts.join(" ").toLowerCase();
  const found = cachedWords.find((w) => combined.includes(w));
  return {
    isClean: !found,
    violatingWord: found || null,
  };
};

// ── React hook — preloads words, returns checker ──────────────────────────────
export const useModerationFilter = () => {
  const wordsRef = useRef(cachedWords || []);

  useEffect(() => {
    if (cachedWords) { wordsRef.current = cachedWords; return; }
    loadBannedWords().then((words) => { wordsRef.current = words; });
  }, []);

  const check = (...texts) => {
    const combined = texts.join(" ").toLowerCase();
    const found = wordsRef.current.find((w) => combined.includes(w));
    return { isClean: !found, violatingWord: found || null };
  };

  return { check };
};

export default useModerationFilter;