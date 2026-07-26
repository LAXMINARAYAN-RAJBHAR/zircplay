import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../../config/supabase";
import "./PostFeed.css";
import PostComposer from "./PostComposer";
import PostCard from "./PostCard";
import SideNavbar from "../../Component/SideNavbar/sideNavbar";

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

  // ── Handle shared post links: /feed?post=<id> ──────────────────────────
  // Ensures the specific shared post is loaded (even if not on page 1),
  // prepended to the feed, and scrolled into view + highlighted.
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

  // ── Scroll to + highlight the shared post once it's rendered ──────────
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

  // ── Notify subscribers about a new post ─────────────────────────────────
  // FIX: "subscriptions" table columns are "subscriber_id" and
  // "subscribed_to" (NOT "subscriber_username"). The old query selected a
  // column that doesn't exist, so `s.subscriber_username` was always
  // undefined, the .filter() dropped every row, and notifications were
  // silently never sent to anyone. "subscriber_id" can hold either a UUID
  // (current accounts) or a legacy plain username (older rows written
  // before the UUID standardization) — same dual-format situation as in
  // Profile.jsx, so we resolve UUIDs to usernames via the "profiles" table
  // before building notification rows, and pass legacy username rows
  // straight through.
  const notifySubscribers = async (uploaderUsername, post) => {
    if (!uploaderUsername) return;

    const { data: subRows } = await supabase
      .from("subscriptions")
      .select("subscriber_id")
      .eq("subscribed_to", uploaderUsername);

    if (!subRows || subRows.length === 0) return;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const uuidIds = [...new Set(subRows.filter((s) => uuidRegex.test(s.subscriber_id)).map((s) => s.subscriber_id))];

    let idToUsername = {};
    if (uuidIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", uuidIds);
      profilesData?.forEach((p) => {
        if (p.username && p.username.trim()) idToUsername[p.id] = p.username;
      });
    }

    const recipientUsernames = [
      ...new Set(
        subRows
          .map((s) =>
            uuidRegex.test(s.subscriber_id)
              ? idToUsername[s.subscriber_id]
              : s.subscriber_id
          )
          .filter(Boolean) // drops UUIDs that still couldn't be resolved
      ),
    ];

    if (recipientUsernames.length === 0) return;

    const notifications = recipientUsernames.map((recipient) => ({
  recipient_username: recipient,
  sender_username: uploaderUsername,
  type: "upload",
  message: `${uploaderUsername} made a new post: "${post.text?.slice(0, 60) || "Check it out"}"`,
  is_read: false,
  content_id: post.id,
  content_type: "post",
}));

    await supabase.from("notifications").insert(notifications);
  };

  const handleNewPost = async (post) => {
    setPosts((prev) => [post, ...prev]);

    const uploaderUsername = localStorage.getItem("username");
    await notifySubscribers(uploaderUsername, post);
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

  const handleShare = async (postId) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const { data, error: err } = await supabase
      .from("posts")
      .insert({
        username: currentUser,
        text: `Shared: "${post.text?.slice(0, 120) || ""}"`,
        image_url: post.image_url,
        link: post.link,
        privacy: "public",
        shared_from: postId,
      })
      .select()
      .single();
    if (!err && data) {
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
    }
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

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchPosts(false);
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
      {/* <SideNavbar sideNavbar={sideNavbar} /> */}

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

        {posts.map((post) => (
          <div id={`post-${post.id}`} key={post.id}>
            <PostCard
              post={post}
              currentUser={currentUser}
              onReaction={handleReaction}
              onComment={handleComment}
              onToggleComments={handleToggleComments}
              onShare={handleShare}
              onDelete={handleDeletePost}
              onEdit={handleEditPost}
            />
          </div>
        ))}

        {hasMore && (
          <button
            className="pf-load-more"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading…" : "Load more posts"}
          </button>
        )}
      </div>
    </>
  );
};

export default PostFeed;