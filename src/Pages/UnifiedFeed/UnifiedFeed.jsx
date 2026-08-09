import React, { useEffect, useRef, useState, useCallback } from "react";
import useUnifiedFeed from "../../hooks/useUnifiedFeed";
import FeedVideoItem from "./FeedVideoItem";
import FeedReelItem from "./FeedReelItem";
import FeedPostItem from "./FeedPostItem";
import "./UnifiedFeed.css";

// TikTok-style vertical feed mixing videos, reels, and posts in one
// continuous scroll. Two things make this safe to run at scale:
//
// 1. Snap-scroll container (CSS) — each slide fills the viewport and
//    scroll always settles exactly on one slide, never half-between two.
// 2. Windowed mounting — only the active slide and its immediate
//    neighbors (±1) actually get a real <video>/<img> element with a
//    loaded source; everything else renders a lightweight placeholder.
//    Without this, scrolling through even 20 items would mean 20 live
//    <video> elements trying to buffer simultaneously.
const UnifiedFeed = () => {
  const currentUser = localStorage.getItem("username") || "anonymous";
  const { items, loading, loadingMore, hasMore, loadMore } = useUnifiedFeed(currentUser);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);
  const itemRefs = useRef({});

  const setItemRef = useCallback((idx) => (node) => {
    if (node) itemRefs.current[idx] = node;
    else delete itemRefs.current[idx];
  }, []);

  // Tracks which slide is currently centered in the viewport via
  // IntersectionObserver — the same pattern your existing Reels.jsx
  // already uses for autoplay-on-scroll, just applied to the whole
  // mixed feed instead of only reels.
  useEffect(() => {
    if (!containerRef.current || items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const idx = Number(entry.target.dataset.index);
            setActiveIndex(idx);
          }
        });
      },
      { root: containerRef.current, threshold: [0.6] },
    );

    Object.values(itemRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [items.length]);

  // Infinite scroll: start loading the next page once the user is
  // within 3 slides of the end, so it's ready before they actually hit it.
  useEffect(() => {
    if (activeIndex >= items.length - 3 && hasMore && !loadingMore) {
      loadMore();
    }
  }, [activeIndex, items.length, hasMore, loadingMore, loadMore]);

  if (loading) {
    return (
      <div className="uf-loading">
        <div className="uf-spinner" />
        <p>Loading your feed…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="uf-empty">
        <div style={{ fontSize: 48 }}>📭</div>
        <p>Nothing here yet.</p>
      </div>
    );
  }

  return (
    <div className="uf-container" ref={containerRef}>
      {items.map((item, idx) => {
        const shouldMount = Math.abs(idx - activeIndex) <= 1;
        const isActive = idx === activeIndex;
        const key = `${item._type}-${item.id}`;

        return (
          <div className="uf-item" key={key} data-index={idx} ref={setItemRef(idx)}>
            {item._type === "video" && (
              <FeedVideoItem video={item} isActive={isActive} shouldMount={shouldMount} currentUser={currentUser} />
            )}
            {item._type === "reel" && (
              <FeedReelItem reel={item} isActive={isActive} shouldMount={shouldMount} currentUser={currentUser} />
            )}
            {item._type === "post" && (
              <FeedPostItem post={item} currentUser={currentUser} />
            )}
          </div>
        );
      })}

      {loadingMore && <div className="uf-loading-more">Loading more…</div>}
      {!hasMore && <div className="uf-loading-more">You're all caught up 🎉</div>}
    </div>
  );
};

export default UnifiedFeed;