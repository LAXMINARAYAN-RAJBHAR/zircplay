import React, { forwardRef, useState, useEffect, useRef } from "react";
import EMOJI_CATEGORIES from "./emojiData";
import {
  searchGifs,
  trendingGifs,
  searchStickers,
  trendingStickers,
} from "../../utils/giphyApi";
import "./EmojiGifStickerPicker.css";

const TABS = [
  { id: "emoji", label: "😀", title: "Emoji" },
  { id: "gif", label: "GIF", title: "GIFs" },
  { id: "sticker", label: "🏷️", title: "Stickers" },
];

// Shared picker used by MessagesPanel (1:1 chat), GroupChatWindow, and
// BroadcastComposeWindow (announcements). Forwards its ref to the root
// element so the existing click-outside-to-close handlers in each parent
// keep working unchanged.
const EmojiGifStickerPicker = forwardRef(
  ({ onEmojiSelect, onMediaSelect, defaultTab = "emoji" }, ref) => {
    const [activeTab, setActiveTab] = useState(defaultTab);
    const [emojiSearch, setEmojiSearch] = useState("");
    const [mediaQuery, setMediaQuery] = useState("");
    const [gifResults, setGifResults] = useState([]);
    const [stickerResults, setStickerResults] = useState([]);
    const [loadingMedia, setLoadingMedia] = useState(false);
    const [mediaError, setMediaError] = useState(null);
    const debounceRef = useRef(null);

    // Load trending content the first time each media tab is opened.
    useEffect(() => {
      if (activeTab === "gif" && gifResults.length === 0 && !mediaQuery.trim()) {
        setLoadingMedia(true);
        setMediaError(null);
        trendingGifs()
          .then(setGifResults)
          .catch((e) => setMediaError(e.message))
          .finally(() => setLoadingMedia(false));
      }
      if (
        activeTab === "sticker" &&
        stickerResults.length === 0 &&
        !mediaQuery.trim()
      ) {
        setLoadingMedia(true);
        setMediaError(null);
        trendingStickers()
          .then(setStickerResults)
          .catch((e) => setMediaError(e.message))
          .finally(() => setLoadingMedia(false));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    // Debounced search while typing in the GIF/sticker tabs.
    useEffect(() => {
      if (activeTab !== "gif" && activeTab !== "sticker") return undefined;
      clearTimeout(debounceRef.current);

      if (!mediaQuery.trim()) return undefined;

      debounceRef.current = setTimeout(() => {
        setLoadingMedia(true);
        setMediaError(null);
        const fn = activeTab === "gif" ? searchGifs : searchStickers;
        const setResults = activeTab === "gif" ? setGifResults : setStickerResults;
        fn(mediaQuery)
          .then(setResults)
          .catch((e) => setMediaError(e.message))
          .finally(() => setLoadingMedia(false));
      }, 450);

      return () => clearTimeout(debounceRef.current);
    }, [mediaQuery, activeTab]);

    const filteredEmojiCategories = EMOJI_CATEGORIES.map((cat) => ({
      ...cat,
      emojis: emojiSearch.trim()
        ? cat.emojis.filter((e) =>
            e.name.toLowerCase().includes(emojiSearch.trim().toLowerCase()),
          )
        : cat.emojis,
    })).filter((cat) => cat.emojis.length > 0);

    const results = activeTab === "gif" ? gifResults : stickerResults;

    return (
      <div className="egsp-panel" ref={ref}>
        <div className="egsp-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`egsp-tab ${activeTab === t.id ? "active" : ""}`}
              onClick={() => setActiveTab(t.id)}
              title={t.title}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "emoji" ? (
          <>
            <input
              type="text"
              className="egsp-search"
              placeholder="Search emoji…"
              value={emojiSearch}
              onChange={(e) => setEmojiSearch(e.target.value)}
              autoFocus
            />
            <div className="egsp-emoji-scroll">
              {filteredEmojiCategories.length === 0 ? (
                <p className="egsp-empty">No emoji found</p>
              ) : (
                filteredEmojiCategories.map((cat) => (
                  <div key={cat.category} className="egsp-emoji-category">
                    <div className="egsp-emoji-category-label">
                      {cat.category}
                    </div>
                    <div className="egsp-emoji-grid">
                      {cat.emojis.map((e) => (
                        <button
                          key={e.name + e.emoji}
                          type="button"
                          className="egsp-emoji-btn"
                          title={e.name}
                          onClick={() => onEmojiSelect(e.emoji)}
                        >
                          {e.emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <input
              type="text"
              className="egsp-search"
              placeholder={activeTab === "gif" ? "Search GIFs…" : "Search stickers…"}
              value={mediaQuery}
              onChange={(e) => setMediaQuery(e.target.value)}
              autoFocus
            />
            <div className="egsp-media-scroll">
              {loadingMedia ? (
                <p className="egsp-empty">Loading…</p>
              ) : mediaError ? (
                <p className="egsp-empty egsp-error">{mediaError}</p>
              ) : results.length === 0 ? (
                <p className="egsp-empty">No results</p>
              ) : (
                <div className="egsp-media-grid">
                  {results.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="egsp-media-btn"
                      title={r.title}
                      onClick={() =>
                        onMediaSelect({ url: r.sendUrl, type: activeTab })
                      }
                    >
                      <img src={r.previewUrl} alt={r.title} loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
              <div className="egsp-giphy-attribution">Powered by GIPHY</div>
            </div>
          </>
        )}
      </div>
    );
  },
);

export default EmojiGifStickerPicker;