import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../config/supabase";

// How many rows to pull PER CONTENT TYPE, per page. Since we merge three
// sources and sort by recency, pulling a slightly larger page per type
// than the visual page size keeps the merged/sorted result from running
// dry on any single type too early.
const PAGE_SIZE = 6;

// Fetches videos + reels + posts in parallel, tags each with `_type`,
// merges and sorts by created_at (newest first), and exposes a
// paginated infinite-scroll-style API. Each content type is paginated
// independently (its own offset) so the merge stays correct across
// pages even if one type has far more/fewer rows than another.
export default function useUnifiedFeed(currentUser) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const offsetsRef = useRef({ video: 0, reel: 0, post: 0 });
  const seenIdsRef = useRef(new Set());

  const fetchPage = useCallback(async () => {
    const { video: vo, reel: ro, post: po } = offsetsRef.current;

    const [videosRes, reelsRes, postsRes] = await Promise.all([
      supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false })
        .range(vo, vo + PAGE_SIZE - 1),
      supabase
        .from("reels")
        .select("*")
        .order("created_at", { ascending: false })
        .range(ro, ro + PAGE_SIZE - 1),
      supabase
        .from("posts")
        .select(`*, post_reactions ( type, username ), post_comments ( id, text, username, created_at )`)
        .order("created_at", { ascending: false })
        .range(po, po + PAGE_SIZE - 1),
    ]);

    const videos = (videosRes.data || []).map((v) => ({
      ...v,
      _type: "video",
    }));

    const reels = (reelsRes.data || []).map((r) => ({
      ...r,
      _type: "reel",
    }));

    const posts = (postsRes.data || []).map((p) => ({
      ...p,
      _type: "post",
      myReaction:
        p.post_reactions?.find((r) => r.username === currentUser)?.type ||
        null,
      reactionCounts: (p.post_reactions || []).reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
      }, {}),
      comments: (p.post_comments || []).sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at),
      ),
    }));

    offsetsRef.current = {
      video: vo + videos.length,
      reel: ro + reels.length,
      post: po + posts.length,
    };

    const combined = [...videos, ...reels, ...posts]
      .filter((i) => !seenIdsRef.current.has(`${i._type}-${i.id}`))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    combined.forEach((i) => seenIdsRef.current.add(`${i._type}-${i.id}`));

    // Only stop paginating once ALL THREE sources are exhausted — a
    // single type running dry doesn't mean the feed is done, since the
    // other two may still have plenty left.
    const noneLeft =
      videos.length === 0 && reels.length === 0 && posts.length === 0;

    return { combined, noneLeft };
  }, [currentUser]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const { combined, noneLeft } = await fetchPage();
      setItems((prev) => [...prev, ...combined]);
      if (noneLeft) setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    offsetsRef.current = { video: 0, reel: 0, post: 0 };
    seenIdsRef.current = new Set();
    setItems([]);
    setHasMore(true);
    setLoading(true);

    (async () => {
      const { combined, noneLeft } = await fetchPage();
      setItems(combined);
      if (noneLeft) setHasMore(false);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  return { items, loading, loadingMore, hasMore, loadMore };
}