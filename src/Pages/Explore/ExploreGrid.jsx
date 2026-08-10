import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import useUnifiedFeed from "../../hooks/useUnifiedFeed";
import "./ExploreGrid.css";

const formatCount = (n) => {
  if (!n) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
};

const TYPE_BADGE = {
  video: { label: "🎬 Video", bg: "#7c3aed" },
  reel: { label: "📱 Reel", bg: "#dc2626" },
  post: { label: "📝 Post", bg: "#f97316" },
};

const HOVER_DELAY = 450;

// Which URL (if any) a given item can preview as a muted, looping
// video. Video/Reel items preview their own video_url. Posts only
// preview if they have no image (i.e. they're a video post) — image
// posts are left exactly as-is.
const getPreviewSrc = (item) => {
  if (item._type === "video") return item.video_url || item.preview_url || null;
  if (item._type === "reel") return item.video_url || item.preview_url || null;
  if (item._type === "post") {
    const media = item.image_urls?.[0] || item.image_url || null;
    if (media) return null;
    return item.video_url || null;
  }
  return null;
};

// Shared preview-trigger logic for a single card:
// - Desktop: hover for HOVER_DELAY ms before the preview activates,
//   matching the same hover-preview feel used on Videos/Reels/Trending/Live.
// - Mobile (no hover available): an IntersectionObserver on the card's
//   thumbnail wrapper activates the preview once ~60% of the card is
//   visible, and deactivates it the instant it scrolls back out — so
//   only on-screen cards are ever actually decoding video.
// `enabled` should be false when the item has no previewable source,
// so cards without a video never attach listeners/observers at all.
function usePreviewTrigger(isDesktop, enabled) {
  const [active, setActive] = useState(false);
  const wrapRef = useRef(null);
  const hoverTimer = useRef(null);

  const handleMouseEnter = useCallback(() => {
    if (!enabled) return;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setActive(true), HOVER_DELAY);
  }, [enabled]);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(hoverTimer.current);
    setActive(false);
  }, []);

  useEffect(() => {
    if (!enabled || isDesktop) return; // mobile-only observer path
    const node = wrapRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { threshold: 0.6 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, isDesktop]);

  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  return {
    active: enabled ? active : false,
    wrapRef,
    hoverHandlers: isDesktop
      ? { onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave }
      : {},
  };
}

// One grid tile. Links out to your EXISTING /video/:id, /reels/:id, or
// /feed?post=:id pages, which already handle full playback, likes,
// comments, and view tracking — this card only has to get the person
// there. It additionally shows a lightweight muted preview (hover on
// desktop, scroll-into-view on mobile) before that happens.
const ExploreCard = ({ item, isDesktop }) => {
  const badge = TYPE_BADGE[item._type];
  const previewSrc = getPreviewSrc(item);
  const { active, wrapRef, hoverHandlers } = usePreviewTrigger(isDesktop, !!previewSrc);
  const videoRef = useRef(null);
  const showPreview = active && !!previewSrc;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) {
      try { v.currentTime = 0; } catch (e) { /* not yet seekable, ignore */ }
      const playPromise = v.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {}); // autoplay can be blocked; fail silently
      }
    } else {
      v.pause();
    }
  }, [active]);

  if (item._type === "video") {
    return (
      <Link to={`/video/${item.id}`} className="eg-card">
        <div className="eg-thumb-wrap" ref={wrapRef} {...hoverHandlers}>
          {showPreview ? (
            <video
              ref={videoRef}
              src={previewSrc}
              className="eg-thumb eg-preview-video"
              muted
              loop
              playsInline
              preload="none"
            />
          ) : item.thumbnail_url ? (
            <img src={item.thumbnail_url} alt={item.title} className="eg-thumb" loading="lazy" />
          ) : (
            <div className="eg-thumb-placeholder" />
          )}
          <span className="eg-badge" style={{ background: badge.bg }}>{badge.label}</span>
          {item.duration && !showPreview && <span className="eg-duration">{item.duration}</span>}
          {!showPreview && (
            <div className="eg-hover-overlay">
              <span className="eg-play-icon">▶</span>
            </div>
          )}
        </div>
        <div className="eg-meta">
          <p className="eg-title">{item.title}</p>
          <p className="eg-sub">@{item.username || item.channel}</p>
        </div>
      </Link>
    );
  }

  if (item._type === "reel") {
    const reelRoute = `/reels/db_${item.id}`;
    return (
      <Link to={reelRoute} className="eg-card eg-card-tall">
        <div className="eg-thumb-wrap eg-thumb-tall" ref={wrapRef} {...hoverHandlers}>
          {showPreview ? (
            <video
              ref={videoRef}
              src={previewSrc}
              className="eg-thumb eg-preview-video"
              muted
              loop
              playsInline
              preload="none"
            />
          ) : item.thumbnail ? (
            <img src={item.thumbnail} alt={item.title} className="eg-thumb" loading="lazy" />
          ) : (
            <div className="eg-thumb-placeholder" />
          )}
          <span className="eg-badge" style={{ background: badge.bg }}>{badge.label}</span>
          {!showPreview && (
            <div className="eg-hover-overlay">
              <span className="eg-play-icon">▶</span>
            </div>
          )}
        </div>
        <div className="eg-meta">
          <p className="eg-title">{item.title}</p>
          <p className="eg-sub">@{item.username || item.user}</p>
        </div>
      </Link>
    );
  }

  // post
  const media = item.image_urls?.[0] || item.image_url || null;
  return (
    <Link to={`/feed?post=${item.id}`} className="eg-card">
      <div className="eg-thumb-wrap" ref={wrapRef} {...hoverHandlers}>
        {showPreview ? (
          <video
            ref={videoRef}
            src={previewSrc}
            className="eg-thumb eg-preview-video"
            muted
            loop
            playsInline
            preload="none"
          />
        ) : media ? (
          <img src={media} alt="" className="eg-thumb" loading="lazy" />
        ) : item.video_url ? (
          <video src={item.video_url} className="eg-thumb" muted preload="metadata" />
        ) : (
          <div className="eg-thumb-text">
            <p>{item.text}</p>
          </div>
        )}
        <span className="eg-badge" style={{ background: badge.bg }}>{badge.label}</span>
      </div>
      <div className="eg-meta">
        <p className="eg-title">{item.text || "View post"}</p>
        <p className="eg-sub">@{item.username}</p>
      </div>
    </Link>
  );
};

const SkeletonCard = () => (
  <div className="eg-card">
    <div className="eg-thumb-wrap eg-skeleton" />
    <div className="eg-meta">
      <div className="eg-skeleton-line" style={{ width: "80%" }} />
      <div className="eg-skeleton-line" style={{ width: "50%" }} />
    </div>
  </div>
);

const TYPE_ORDER = ["post", "reel", "video"];
const TYPE_ROW_LABEL = {
  post: "📝 Posts",
  reel: "📱 Reels",
  video: "🎬 Videos",
};

// Buckets items by type (keeping each type's original relative order
// from useUnifiedFeed), then lays out rows of up to `rowSize` cards,
// cycling Post -> Reel -> Video -> Post -> Reel -> Video ... until
// every bucket is drained. Used on BOTH desktop (rowSize 5) and
// mobile (rowSize 2) — only the row size and grid column count change
// between breakpoints, the row-by-type structure itself stays.
function buildTypeRows(items, rowSize) {
  const buckets = { post: [], reel: [], video: [] };
  items.forEach((item) => {
    if (buckets[item._type]) buckets[item._type].push(item);
  });

  const cursor = { post: 0, reel: 0, video: 0 };
  const rows = [];

  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const type of TYPE_ORDER) {
      const bucket = buckets[type];
      const start = cursor[type];
      if (start >= bucket.length) continue;
      const chunk = bucket.slice(start, start + rowSize);
      cursor[type] += chunk.length;
      rows.push({ type, key: `${type}-${start}`, items: chunk });
      progressed = true;
    }
  }
  return rows;
}

function useIsDesktop(breakpoint = 769) {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= breakpoint : true
  );
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isDesktop;
}

// Instagram-Explore-style grid, reorganized into same-type rows on
// BOTH desktop and mobile: Posts -> Reels -> Videos, repeating.
// Desktop shows 5 cards per row, mobile shows 2 per row — the
// underlying merged/sorted data source and row-building logic are
// identical, only ROW_SIZE and the CSS column count differ per
// breakpoint. Cards preview on hover (desktop) or scroll-into-view
// (mobile) before the person taps/clicks through.
const ExploreGrid = () => {
  const currentUser = localStorage.getItem("username") || "anonymous";
  const { items, loading, loadingMore, hasMore, loadMore } = useUnifiedFeed(currentUser);
  const isDesktop = useIsDesktop();
  const rowSize = isDesktop ? 5 : 2;

  const [sentinelNode, setSentinelNode] = useState(null);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);
  useEffect(() => { loadingMoreRef.current = loadingMore; }, [loadingMore]);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);

  const handleLoadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    loadMore();
  }, [loadMore]);

  useEffect(() => {
    if (!sentinelNode) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) handleLoadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(sentinelNode);
    return () => observer.disconnect();
  }, [sentinelNode, handleLoadMore]);

  const typeRows = useMemo(
    () => buildTypeRows(items, rowSize),
    [items, rowSize]
  );

  if (loading) {
    return (
      <div className="eg-page">
        <h1 className="eg-heading">Explore</h1>
        <div className="eg-grid">
          {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="eg-page">
        <h1 className="eg-heading">Explore</h1>
        <div className="eg-empty">
          <div style={{ fontSize: 48 }}>📭</div>
          <p>Nothing here yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="eg-page">
      <h1 className="eg-heading">Explore</h1>

      <div className="eg-type-rows">
        {typeRows.map((row) => (
          <div key={row.key} className="eg-type-row">
            <p className="eg-type-row-label">{TYPE_ROW_LABEL[row.type]}</p>
            <div className="eg-type-row-grid">
              {row.items.map((item) => (
                <ExploreCard key={`${item._type}-${item.id}`} item={item} isDesktop={isDesktop} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div ref={setSentinelNode} className="eg-sentinel">
          {loadingMore && <span>Loading more…</span>}
        </div>
      )}
      {!hasMore && <p className="eg-end">You're all caught up 🎉</p>}
    </div>
  );
};

export default ExploreGrid;