import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../../config/supabase";
import "./PostFeed.css";
import PostComposer from "./PostComposer";
import PostCard from "./PostCard";
import SideNavbar from "../../Component/SideNavbar/sideNavbar";
import AdUnit from "../../Component/Ads/AdUnit";
// NEW: shared notification helper — see src/utils/notifications.js.
// notifySubscribers used to be a local function defined at the bottom of
// this file; it's now shared so video/reel uploads can use the same
// uuid-vs-username resolution logic instead of duplicating it.
import { notifySubscribers } from "../../utils/notifications";

const PostFeed = ({ sideNavbar }) => {
  const location = useLocation();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const PAGE_SIZE = 10;
  const offsetRef = useRef(0);
  const currentUser = localStorage.getItem("username") || "anonymous";

  // ── Infinite scroll sentinel ──
  // A near-invisible div placed after the last post. When it scrolls
  // into the viewport, loadMore() fires automatically — same
  // IntersectionObserver pattern used for Reels autoplay detection.
  //
  // FIX: this used to be a plain useRef(), but the component returns an
  // early "loading skeleton" render while `loading` is true — meaning
  // the sentinel div doesn't exist in the DOM yet on first mount. The
  // observer effect ran once against a null ref and never retried once
  // the real content (with the sentinel) rendered, so infinite scroll
  // silently never fired. Using a state-backed callback ref means the
  // effect re-runs the moment the sentinel actually mounts.
  const [sentinelNode, setSentinelNode] = useState(null);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);

  useEffect(() => { loadingMoreRef.current = loadingMore; }, [loadingMore]);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);

  const fetchPosts = useCallback(async (reset = false) => {
    try {
      const offset = reset ? 0 : offsetRef.current;
      const { data, error: fetchErr } = await supabase
        .from("posts")
        .select(`
          *,
          post_reactions ( type, username ),
          post_comments (
            id, text, username, created_at
          )
        `)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (fetchErr) throw fetchErr;

      const enriched = (data || []).map((p) => ({
        ...p,
        myReaction:
          p.post_reactions?.find((r) => r.username === currentUser)?.type ||
          null,
        reactionCounts: p.post_reactions?.reduce((acc, r) => {
          acc[r.type] = (acc[r.type] || 0) + 1;
          return acc;
        }, {}),
        comments: (p.post_comments || []).sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        ),
        showComments: false,
      }));

      if (reset) {
        setPosts(enriched);
        offsetRef.current = enriched.length;
      } else {
        setPosts((prev) => [...prev, ...enriched]);
        offsetRef.current += enriched.length;
      }

      setHasMore((data || []).length === PAGE_SIZE);
    } catch (err) {
      setError(err.message || "Failed to load posts.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [currentUser]);

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    setLoadingMore(true);
    fetchPosts(false);
  }, [fetchPosts]);

  useEffect(() => {
    fetchPosts(true);

    const channel = supabase
      .channel("posts-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        () => fetchPosts(true)
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "posts" },
        (payload) => {
          const deletedId = payload.old?.id;
          if (deletedId) {
            setPosts((prev) => prev.filter((p) => p.id !== deletedId));
            offsetRef.current = Math.max(0, offsetRef.current - 1);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchPosts]);

  // ── Infinite scroll observer ──
  // Re-runs whenever `sentinelNode` changes — i.e. the moment the
  // sentinel div mounts (once loading finishes) or unmounts/remounts
  // (e.g. if hasMore toggles). This is what the old ref-based version
  // was missing.
  useEffect(() => {
    if (!sentinelNode) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "600px" } // start loading well before the sentinel is actually visible
    );

    observer.observe(sentinelNode);
    return () => observer.disconnect();
  }, [sentinelNode, loadMore]);

  // ── Handle shared post links: /feed?post=<id> ──────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sharedPostId = params.get("post");
    if (!sharedPostId) return;

    setHighlightedPostId(sharedPostId);

    const ensurePostLoaded = async () => {
      const { data, error: fetchErr } = await supabase
        .from("posts")
        .select(`
          *,
          post_reactions ( type, username ),
          post_comments ( id, text, username, created_at )
        `)
        .eq("id", sharedPostId)
        .maybeSingle();

      if (fetchErr || !data) return;

      const enrichedPost = {
        ...data,
        myReaction:
          data.post_reactions?.find((r) => r.username === currentUser)?.type ||
          null,
        reactionCounts: data.post_reactions?.reduce((acc, r) => {
          acc[r.type] = (acc[r.type] || 0) + 1;
          return acc;
        }, {}),
        comments: (data.post_comments || []).sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        ),
        showComments: false,
      };

      setPosts((current) => {
        if (current.some((p) => p.id === sharedPostId)) return current;
        return [enrichedPost, ...current];
      });
    };

    ensurePostLoaded();
  }, [location.search, currentUser]);

  useEffect(() => {
    if (!highlightedPostId) return;
    const el = document.getElementById(`post-${highlightedPostId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("pf-highlighted");
      const timer = setTimeout(() => el.classList.remove("pf-highlighted"), 3000);
      return () => clearTimeout(timer);
    }
  }, [posts, highlightedPostId]);

  // FIX: notifySubscribers used to be a local function defined at the
  // bottom of this file (with a silent `await supabase...insert(...)`
  // and no error handling). It now delegates to the shared helper in
  // src/utils/notifications.js, which logs any Supabase error instead of
  // swallowing it — so if this insert is ever failing (e.g. an RLS
  // policy blocking it), it'll show up in the console instead of just
  // "nothing happens."
  const handleNewPost = async (post) => {
    setPosts((prev) => [post, ...prev]);

    const uploaderUsername = localStorage.getItem("username");
    await notifySubscribers(uploaderUsername, {
      type: "upload",
      message: `${uploaderUsername} made a new post: "${post.text?.slice(0, 60) || "Check it out"}"`,
      contentId: post.id,
      contentType: "post",
    });
  };

  const handleReaction = async (postId, reactionType) => {
    if (!currentUser || currentUser === "anonymous") {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const prev = post.myReaction;

    setPosts((all) =>
      all.map((p) => {
        if (p.id !== postId) return p;
        const counts = { ...p.reactionCounts };
        if (prev) counts[prev] = Math.max(0, (counts[prev] || 1) - 1);
        const next = prev === reactionType ? null : reactionType;
        if (next) counts[next] = (counts[next] || 0) + 1;
        return { ...p, myReaction: next, reactionCounts: counts };
      })
    );

    try {
      if (prev) {
        await supabase
          .from("post_reactions")
          .delete()
          .eq("post_id", postId)
          .eq("username", currentUser);
      }
      if (prev !== reactionType) {
        await supabase
          .from("post_reactions")
          .insert({ post_id: postId, username: currentUser, type: reactionType });
      }
    } catch {
      fetchPosts(true);
    }
  };

  const handleComment = async (postId, text) => {
    if (!currentUser || currentUser === "anonymous") {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    if (!text.trim()) return;
    const { data, error: err } = await supabase
      .from("post_comments")
      .insert({ post_id: postId, username: currentUser, text: text.trim() })
      .select()
      .single();
    if (err) return;
    setPosts((all) =>
      all.map((p) =>
        p.id === postId
          ? { ...p, comments: [...p.comments, data], showComments: true }
          : p
      )
    );
  };

  const handleToggleComments = (postId) => {
    setPosts((all) =>
      all.map((p) =>
        p.id === postId ? { ...p, showComments: !p.showComments } : p
      )
    );
  };

  // ── Share to feed ──
  const handleShare = async (postId) => {
    if (!currentUser || currentUser === "anonymous") {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    setError("");
    try {
      const { data, error: err } = await supabase
        .from("posts")
        .insert({
          username: currentUser,
          text: `Shared: "${post.text?.slice(0, 120) || ""}"`,
          image_url: post.image_url || null,
          image_urls: post.image_urls && post.image_urls.length > 0 ? post.image_urls : null,
          video_url: post.video_url || null,
          feeling: post.feeling || null,
          link: post.link || null,
          privacy: "public",
          shared_from: postId,
        })
        .select()
        .single();

      if (err) throw err;

      setPosts((prev) => [
        {
          ...data,
          myReaction: null,
          reactionCounts: {},
          comments: [],
          showComments: false,
        },
        ...prev,
      ]);
    } catch (err) {
      console.error("Share to feed failed:", err);
      setError(
        err.message ||
          "Couldn't share this post. Please try again."
      );
    }
  };

  // ── Report a post ──
  const handleReportPost = async (postId, reason, details) => {
    const { error: err } = await supabase.from("post_reports").insert({
      post_id: postId,
      reporter_username: currentUser,
      reason,
      details: details || null,
    });
    if (err) throw err;
  };

  const handleDeletePost = async (postId) => {
    setPosts((all) => all.filter((p) => p.id !== postId));
    offsetRef.current = Math.max(0, offsetRef.current - 1);

    const { error: delErr } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("username", currentUser);

    if (delErr) {
      fetchPosts(true);
    }
  };

  const handleEditPost = async (postId, updates) => {
    const { data, error: editErr } = await supabase
      .from("posts")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", postId)
      .eq("username", currentUser)
      .select()
      .single();

    if (editErr) {
      setError(editErr.message || "Failed to update post.");
      return;
    }

    setPosts((all) =>
      all.map((p) => (p.id === postId ? { ...p, ...data } : p))
    );
  };

  if (loading) {
    return (
      <div className={`pf-feed${!sideNavbar ? " sidebar-closed" : ""}`}>
        {[1, 2, 3].map((i) => (
          <div className="pf-skeleton" key={i}>
            <div className="pf-skeleton-avatar" />
            <div className="pf-skeleton-lines">
              <div className="pf-skeleton-line" style={{ width: "40%" }} />
              <div className="pf-skeleton-line" style={{ width: "70%" }} />
              <div className="pf-skeleton-line" style={{ width: "55%" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className={`pf-feed${!sideNavbar ? " sidebar-closed" : ""}`}>
        {currentUser && currentUser !== "anonymous" ? (
          <PostComposer currentUser={currentUser} onPost={handleNewPost} />
        ) : (
          <div
            style={{
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: "12px",
              padding: "20px",
              textAlign: "center",
              marginBottom: "16px",
            }}
          >
            <p style={{ color: "#aaa", fontSize: "14px", margin: "0 0 12px" }}>
              🔒 Please log in to post
            </p>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("openLogin"))}
              style={{
                background: "#ff0000",
                color: "white",
                border: "none",
                borderRadius: "8px",
                padding: "8px 24px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Login
            </button>
          </div>
        )}

        {error && <p className="pf-error">{error}</p>}

        {posts.length === 0 && !loading && (
          <div className="pf-empty">
            <span className="pf-empty-icon">📭</span>
            <p>No posts yet. Be the first to share something!</p>
          </div>
        )}

        {posts.map((post, index) => (
          <React.Fragment key={post.id}>
            <div id={`post-${post.id}`}>
              <PostCard
                post={post}
                currentUser={currentUser}
                onReaction={handleReaction}
                onComment={handleComment}
                onToggleComments={handleToggleComments}
                onShare={handleShare}
                onDelete={handleDeletePost}
                onEdit={handleEditPost}
                onReport={handleReportPost}
              />
            </div>
            {(index + 1) % 5 === 0 && (
              <AdUnit slot="7412839650" format="fluid" layout="in-feed" />
            )}
          </React.Fragment>
        ))}

        {/* ── Infinite scroll sentinel + status row ──
            FIX: replaced the manual "Load more posts" button with this
            sentinel div. IntersectionObserver above watches it and calls
            loadMore() automatically once it scrolls near the viewport
            (rootMargin: 600px means it fires a bit early, before the
            user actually hits the bottom, so there's no visible pause). */}
        {hasMore && (
          <div ref={setSentinelNode} className="pf-scroll-sentinel">
            {loadingMore && <span className="pf-scroll-loading">Loading more posts…</span>}
          </div>
        )}

        {!hasMore && posts.length > 0 && (
          <p className="pf-scroll-end">You're all caught up 🎉</p>
        )}
      </div>
    </>
  );
};

export default PostFeed;