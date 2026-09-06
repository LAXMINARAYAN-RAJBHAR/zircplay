import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../../config/supabase";
import "./PostFeed.css";
import PostComposer from "./PostComposer";
import PostCard from "./PostCard";
import SideNavbar from "../../Component/SideNavbar/sideNavbar";
import AdUnit from "../../Component/Ads/AdUnit";
// CHANGED: now also imports notifyUser — needed for post like/comment
// notifications added below. notifyConnections already handled new-post
// notifications; likes/comments on posts previously never notified
// anyone at all (unlike Video.jsx/Reels.jsx, which both call notifyUser
// inline right after their like/comment Supabase writes).
import { notifyConnections, notifyUser } from "../../utils/notifications";
// NEW: parses @mentions out of post/comment text so the mentioned user
// gets notified, same as a like or comment would. See src/utils/linkify.js
// (also used by ExpandableText to render #hashtags/@mentions as links).
import { extractMentions } from "../../utils/linkify";

// currentUser now comes from App.js via HomeHub — the same auth state
// that drives the Navbar's Upload button, BottomNav, etc — instead of
// being read independently from localStorage here. That mismatch was
// why the feed could show you as logged in while Upload still asked you
// to log in: two different, occasionally-out-of-sync sources of truth.
const PostFeed = ({ sideNavbar, currentUser: currentUserProp }) => {
  const location = useLocation();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const [postNotFound, setPostNotFound] = useState(false);
  // NEW: per-post view counts, keyed by post id (string) → count.
  // Populated by fetchViewCounts() and bumped locally (then persisted)
  // by incrementView(), mirroring the viewCounts state + incrementView/
  // fetchViewCounts pattern already used for videos/reels on the
  // homepage (see homePage.js) — same "views" table, content_type: "post".
  const [viewCounts, setViewCounts] = useState({});
  const PAGE_SIZE = 10;
  const offsetRef = useRef(0);

  // Normalized so every existing `currentUser === "anonymous"` /
  // `!currentUser || currentUser === "anonymous"` check below keeps
  // working unchanged — App.js's currentUser state is `null` when
  // logged out, this file's convention is the string "anonymous".
  const currentUser = currentUserProp || "anonymous";

  const [sentinelNode, setSentinelNode] = useState(null);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);

  useEffect(() => { loadingMoreRef.current = loadingMore; }, [loadingMore]);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);

  const enrichPost = useCallback(
    (p) => ({
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
    }),
    [currentUser]
  );

  // ── NEW: view-count helpers, mirroring homePage.js's fetchViewCounts /
  // incrementView exactly (same "views" table, same upsert conflict
  // target, same 24h-per-user de-dupe via localStorage) but scoped to
  // content_type: "post". ──

  const fetchViewCounts = async (ids) => {
    if (!ids || !ids.length) return;
    try {
      const { data, error: err } = await supabase
        .from("views")
        .select("content_id")
        .eq("content_type", "post")
        .in("content_id", ids.map(String));
      const map = {};
      ids.forEach((id) => {
        map[String(id)] = 0;
      });
      if (!err && data) {
        data.forEach((r) => {
          map[r.content_id] = (map[r.content_id] || 0) + 1;
        });
      }
      setViewCounts((prev) => ({ ...prev, ...map }));
    } catch (_) {}
  };

  const incrementView = useCallback(async (postId) => {
    const storageKey = `lastViewed_post_${postId}`;
    const lastViewed = localStorage.getItem(storageKey);
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    if (lastViewed && now - parseInt(lastViewed, 10) < TWENTY_FOUR_HOURS)
      return;
    localStorage.setItem(storageKey, String(now));

    const key = String(postId);
    setViewCounts((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));

    try {
      const userId = localStorage.getItem("userId");
      if (!userId) return;
      await supabase.from("views").upsert(
        {
          user_id: userId,
          content_id: key,
          content_type: "post",
          viewed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,content_id,content_type" },
      );
    } catch (_) {}
  }, []);

  const fetchPosts = useCallback(async (reset = false) => {
    try {
      const offset = reset ? 0 : offsetRef.current;
      const { data, error: fetchErr } = await supabase
        .from("posts")
        .select(`
          *,
          post_reactions ( type, username ),
          post_comments (
            id, text, username, created_at, liked_by, disliked_by
          )
        `)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (fetchErr) throw fetchErr;

      const enriched = (data || []).map(enrichPost);

      if (reset) {
        setPosts(enriched);
        offsetRef.current = enriched.length;
      } else {
        setPosts((prev) => [...prev, ...enriched]);
        offsetRef.current += enriched.length;
      }

      // NEW: pull view counts for whichever page of posts just loaded.
      fetchViewCounts(enriched.map((p) => p.id));

      setHasMore((data || []).length === PAGE_SIZE);
    } catch (err) {
      setError(err.message || "Failed to load posts.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [enrichPost]);

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    setLoadingMore(true);
    fetchPosts(false);
  }, [fetchPosts]);

  // ── Fetch a single newly-inserted post and prepend it ──
  // Fetches only the one new row and prepends it, leaving every other
  // post's object reference untouched — avoids remounting every PostCard
  // (and resetting in-progress comment input) whenever ANYONE creates a
  // post, which is what a full fetchPosts(true) reset used to do.
  const handleRealtimeInsert = useCallback(
    async (payload) => {
      const newId = payload.new?.id;
      if (!newId) return;

      const { data, error: fetchErr } = await supabase
        .from("posts")
        .select(`
          *,
          post_reactions ( type, username ),
          post_comments ( id, text, username, created_at, liked_by, disliked_by )
        `)
        .eq("id", newId)
        .maybeSingle();

      if (fetchErr || !data) return;

      const enrichedPost = enrichPost(data);

      setPosts((prev) => {
        if (prev.some((p) => p.id === newId)) return prev;
        return [enrichedPost, ...prev];
      });

      // NEW: seed a view-count entry (0) for the freshly inserted post.
      fetchViewCounts([newId]);
    },
    [enrichPost]
  );

  useEffect(() => {
    fetchPosts(true);

    const channel = supabase
      .channel("posts-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        handleRealtimeInsert
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
  }, [fetchPosts, handleRealtimeInsert]);

  // ── Infinite scroll observer ──
  useEffect(() => {
    if (!sentinelNode) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "600px" }
    );

    observer.observe(sentinelNode);
    return () => observer.disconnect();
  }, [sentinelNode, loadMore]);

  // ── Handle shared post links: /feed?post=<id> ──────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sharedPostId = params.get("post");
    if (!sharedPostId) {
      setPostNotFound(false);
      return;
    }

    setHighlightedPostId(sharedPostId);

    const ensurePostLoaded = async () => {
      const { data, error: fetchErr } = await supabase
        .from("posts")
        .select(`
          *,
          post_reactions ( type, username ),
          post_comments ( id, text, username, created_at, liked_by, disliked_by )
        `)
        .eq("id", sharedPostId)
        .maybeSingle();

      if (fetchErr || !data) {
        setPostNotFound(true);
        return;
      }
      setPostNotFound(false);

      const enrichedPost = enrichPost(data);

      setPosts((current) => {
        if (current.some((p) => p.id === sharedPostId)) return current;
        return [enrichedPost, ...current];
      });

      // NEW: make sure a directly-linked-to post also gets its view
      // count loaded, since it may not have come through fetchPosts.
      fetchViewCounts([sharedPostId]);
    };

    ensurePostLoaded();
  }, [location.search, currentUser, enrichPost]);

  // Scrolls to and highlights the shared post exactly once per
  // highlightedPostId. `posts` stays a dependency because the target
  // post may not be in the DOM yet on first render (still being fetched
  // by ensurePostLoaded above) — but every OTHER state update that also
  // touches `posts` (commenting/reacting on any post, realtime inserts,
  // etc.) was re-triggering this effect too, re-scrolling and
  // re-highlighting the same post every time, which made it feel
  // "locked" on screen. scrolledForIdRef guards against that: once
  // we've successfully scrolled for a given id, later `posts` changes
  // are ignored until highlightedPostId itself changes.
  const scrolledForIdRef = useRef(null);
  useEffect(() => {
    if (!highlightedPostId) {
      scrolledForIdRef.current = null;
      return;
    }
    if (scrolledForIdRef.current === highlightedPostId) return;

    const el = document.getElementById(`post-${highlightedPostId}`);
    if (el) {
      scrolledForIdRef.current = highlightedPostId;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("pf-highlighted");
      const timer = setTimeout(() => el.classList.remove("pf-highlighted"), 3000);
      return () => clearTimeout(timer);
    }
  }, [posts, highlightedPostId]);

  const handleNewPost = async (post) => {
    setPosts((prev) => [post, ...prev]);
    // NEW: seed a view-count entry for a post the current user just made.
    fetchViewCounts([post.id]);

    const uploaderUsername = currentUser;
    await notifyConnections(uploaderUsername, {
      type: "upload",
      message: `${uploaderUsername} made a new post: "${post.text?.slice(0, 60) || "Check it out"}"`,
      contentId: post.id,
      contentType: "post",
    });

    // NEW: notify anyone @mentioned in the post's own text — independent
    // of the connections broadcast above, since a mentioned person isn't
    // necessarily connected to the poster.
    extractMentions(post.text).forEach((mentioned) => {
      if (mentioned === uploaderUsername) return;
      notifyUser({
        recipientUsername: mentioned,
        senderUsername: uploaderUsername,
        type: "mention",
        message: `${uploaderUsername} mentioned you in a post`,
        contentId: post.id,
        contentType: "post",
      });
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

        // NEW: notify the post owner about the reaction — only on an
        // actual new reaction (not on removing/undoing one), and never
        // for reacting to your own post. Mirrors the like-notification
        // pattern already used in Video.jsx / Reels.jsx.
        if (post.username && post.username !== currentUser) {
          notifyUser({
            recipientUsername: post.username,
            senderUsername: currentUser,
            type: "like",
            message: `${currentUser} reacted to your post`,
            contentId: postId,
            contentType: "post",
          });
        }
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

    // NEW: look up the post so we know who to notify below (handleReaction
    // and handleShare already do this same lookup; handleComment
    // previously didn't need `post` for anything else).
    const post = posts.find((p) => p.id === postId);

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

    // NEW: notify the post owner about the comment, unless they're
    // commenting on their own post.
    if (post?.username && post.username !== currentUser) {
      notifyUser({
        recipientUsername: post.username,
        senderUsername: currentUser,
        type: "comment",
        message: `${currentUser} commented on your post: "${text.trim().slice(0, 60)}"`,
        contentId: postId,
        contentType: "post",
      });
    }

    // NEW: notify anyone @mentioned in the comment — skipping the
    // commenter themselves and the post owner (already notified above,
    // so they'd otherwise get two notifications for one comment).
    extractMentions(text).forEach((mentioned) => {
      if (mentioned === currentUser || mentioned === post?.username) return;
      notifyUser({
        recipientUsername: mentioned,
        senderUsername: currentUser,
        type: "mention",
        message: `${currentUser} mentioned you in a comment: "${text.trim().slice(0, 60)}"`,
        contentId: postId,
        contentType: "post",
      });
    });
  };

  // NEW: like/dislike a single comment. `type` is "like" or "dislike";
  // the two are mutually exclusive per-user — picking one removes you
  // from the other list, same relationship as post reactions vs. their
  // opposite. Mirrors handleReaction's pattern (optimistic local update
  // first, then persist, then roll back with a re-fetch if the write
  // fails).
  //
  // Storage model: post_comments.liked_by / disliked_by are text[]
  // columns holding the usernames who currently like/dislike that
  // comment — no separate join table needed since a comment's
  // like/dislike lists are small and only ever read alongside the
  // comment itself.
  //
  // Migration required once, in Supabase SQL editor:
  //   alter table post_comments add column liked_by text[] default '{}';
  //   alter table post_comments add column disliked_by text[] default '{}';
  const handleCommentReaction = async (postId, commentId, type) => {
    if (!currentUser || currentUser === "anonymous") {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }

    const post = posts.find((p) => p.id === postId);
    const comment = post?.comments.find((c) => c.id === commentId);
    if (!comment) return;

    const likedBy = comment.liked_by || [];
    const dislikedBy = comment.disliked_by || [];

    const isLike = type === "like";
    const sameList = isLike ? likedBy : dislikedBy;
    const otherList = isLike ? dislikedBy : likedBy;
    const alreadyActive = sameList.includes(currentUser);

    // Toggling the same reaction off just removes you from that list.
    // Picking the opposite reaction removes you from the other list too
    // (you can't like AND dislike the same comment at once).
    const nextSameList = alreadyActive
      ? sameList.filter((u) => u !== currentUser)
      : [...sameList, currentUser];
    const nextOtherList = otherList.filter((u) => u !== currentUser);

    const nextLikedBy = isLike ? nextSameList : nextOtherList;
    const nextDislikedBy = isLike ? nextOtherList : nextSameList;

    // Optimistic update
    setPosts((all) =>
      all.map((p) =>
        p.id !== postId
          ? p
          : {
              ...p,
              comments: p.comments.map((c) =>
                c.id === commentId
                  ? { ...c, liked_by: nextLikedBy, disliked_by: nextDislikedBy }
                  : c
              ),
            }
      )
    );

    const { error: err } = await supabase
      .from("post_comments")
      .update({ liked_by: nextLikedBy, disliked_by: nextDislikedBy })
      .eq("id", commentId);

    if (err) {
      // Roll back by re-syncing from the server on failure.
      fetchPosts(true);
      return;
    }

    // Notify the comment's author only on a genuinely new LIKE (not on
    // unliking, not on dislikes, and never for reacting to your own
    // comment) — matches how post reactions only notify on a new like.
    if (
      isLike &&
      !alreadyActive &&
      comment.username &&
      comment.username !== currentUser
    ) {
      notifyUser({
        recipientUsername: comment.username,
        senderUsername: currentUser,
        type: "like",
        message: `${currentUser} liked your comment`,
        contentId: postId,
        contentType: "post",
      });
    }
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

      // NEW: seed a view-count entry for the newly-created shared post.
      fetchViewCounts([data.id]);
    } catch (err) {
      console.error("Share to feed failed:", err);
      setError(
        err.message ||
          "Couldn't share this post. Please try again."
      );
    }
  };

  // ── Report a post ──
  // FIX: previously inserted into a "post_reports" table that AdminPanel
  // never queries (AdminPanel reads only from "reports"). Reports were
  // being saved but were invisible to admins. Now writes to the same
  // "reports" table used by video/reel reporting, with the same shape
  // AdminPanel expects (content_type, content_id, content_title,
  // content_owner, reporter_username, reason, details, status).
  const handleReportPost = async (postId, reason, details) => {
    const post = posts.find((p) => p.id === postId);

    const { error: err } = await supabase.from("reports").insert({
      content_type: "post",
      content_id: postId,
      content_title: post?.text?.slice(0, 80) || "Post",
      content_owner: post?.username || "unknown",
      reporter_username: currentUser,
      reason,
      details: details || null,
      status: "pending",
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
        {postNotFound && (
          <p className="pf-error">
            That post isn't available anymore — it may have been deleted, or the link is incorrect.
          </p>
        )}

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
                onLikeComment={(postId, commentId) =>
                  handleCommentReaction(postId, commentId, "like")
                }
                onDislikeComment={(postId, commentId) =>
                  handleCommentReaction(postId, commentId, "dislike")
                }
                viewCount={viewCounts[String(post.id)] ?? 0}
                onView={incrementView}
              />
            </div>
            {(index + 1) % 5 === 0 && (
              <AdUnit slot="7412839650" format="fluid" layout="in-feed" />
            )}
          </React.Fragment>
        ))}

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