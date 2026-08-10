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

// One grid tile. Unlike the earlier full-screen version, this never
// mounts a playing <video> element at all — it's a thumbnail card that
// links out to your EXISTING /video/:id, /reels/:id, or /feed?post=:id
// pages, all of which already handle their own playback, likes,
// comments, and view tracking correctly. This card only has to get the
// person there.
const ExploreCard = ({ item }) => {
  const badge = TYPE_BADGE[item._type];

  if (item._type === "video") {
    return (
      <Link to={`/video/${item.id}`} className="eg-card">
        <div className="eg-thumb-wrap">
          {item.thumbnail_url ? (
            <img src={item.thumbnail_url} alt={item.title} className="eg-thumb" loading="lazy" />
          ) : (
            <div className="eg-thumb-placeholder" />
          )}
          <span className="eg-badge" style={{ background: badge.bg }}>{badge.label}</span>
          {item.duration && <span className="eg-duration">{item.duration}</span>}
          <div className="eg-hover-overlay">
            <span className="eg-play-icon">▶</span>
          </div>
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
        <div className="eg-thumb-wrap eg-thumb-tall">
          {item.thumbnail ? (
            <img src={item.thumbnail} alt={item.title} className="eg-thumb" loading="lazy" />
          ) : (
            <div className="eg-thumb-placeholder" />
          )}
          <span className="eg-badge" style={{ background: badge.bg }}>{badge.label}</span>
          <div className="eg-hover-overlay">
            <span className="eg-play-icon">▶</span>
          </div>
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
      <div className="eg-thumb-wrap">
        {media ? (
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

const ROW_SIZE = 5;
const TYPE_ORDER = ["post", "reel", "video"];
const TYPE_ROW_LABEL = {
  post: "📝 Posts",
  reel: "📱 Reels",
  video: "🎬 Videos",
};

// Buckets items by type (keeping each type's original relative order
// from useUnifiedFeed), then lays out rows of up to 5 cards, cycling
// Post -> Reel -> Video -> Post -> Reel -> Video ... until every
// bucket is drained. Desktop-only "lined" layout.
function buildTypeRows(items) {
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
      const chunk = bucket.slice(start, start + ROW_SIZE);
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

// Instagram-Explore-style grid mixing videos, reels, and posts on
// mobile; on desktop, reorganized into same-type rows of 5
// (Posts -> Reels -> Videos, repeating). Reuses the same
// merged/sorted data source either way — only the presentation
// layer changes.
const ExploreGrid = () => {
  const currentUser = localStorage.getItem("username") || "anonymous";
  const { items, loading, loadingMore, hasMore, loadMore } = useUnifiedFeed(currentUser);
  const isDesktop = useIsDesktop();

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
    () => (isDesktop ? buildTypeRows(items) : []),
    [isDesktop, items]
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

      {isDesktop ? (
        <div className="eg-type-rows">
          {typeRows.map((row) => (
            <div key={row.key} className="eg-type-row">
              <p className="eg-type-row-label">{TYPE_ROW_LABEL[row.type]}</p>
              <div className="eg-type-row-grid">
                {row.items.map((item) => (
                  <ExploreCard key={`${item._type}-${item.id}`} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="eg-grid">
          {items.map((item) => (
            <ExploreCard key={`${item._type}-${item.id}`} item={item} />
          ))}
        </div>
      )}

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