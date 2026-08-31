import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import PostCard from "../PostFeed/PostCard";
import { notifyUser } from "../../utils/notifications";
import { extractMentions } from "../../utils/linkify";
import "../PostFeed/PostFeed.css";
import "./HashtagPage.css";

/**
 * /tag/:tag — every post whose text contains #tag, newest first.
 *
 * This is a leaner, self-contained sibling of PostFeed.jsx: same
 * enrich/react/comment/share/report/edit/delete logic (kept in sync with
 * that file's behavior), but scoped to a single hashtag instead of the
 * full feed, with its own fetch instead of PostFeed's paginated/realtime
 * one. No infinite scroll or realtime subscription (v1) — a hashtag
 * page's result set is typically small enough that a single fetch on
 * load/tag-change is enough; can be added later if a tag gets popular
 * enough to need it.
 */
const HashtagPage = ({ sideNavbar, currentUser: currentUserProp }) => {
  const { tag } = useParams();
  const navigate = useNavigate();
  const currentUser = currentUserProp || "anonymous";

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        (a, b) => new Date(a.created_at) - new Date(b.created_at),
      ),
      showComments: false,
    }),
    [currentUser],
  );

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: fetchErr } = await supabase
      .from("posts")
      .select(`
        *,
        post_reactions ( type, username ),
        post_comments ( id, text, username, created_at )
      `)
      .ilike("text", `%#${tag}%`)
      .order("created_at", { ascending: false });

    if (fetchErr) {
      setError(fetchErr.message || "Failed to load posts.");
      setPosts([]);
    } else {
      setPosts((data || []).map(enrichPost));
    }
    setLoading(false);
  }, [tag, enrichPost]);

  useEffect(() => {
    fetchPosts();
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [fetchPosts]);

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
      }),
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
      fetchPosts();
    }
  };

  const handleComment = async (postId, text) => {
    if (!currentUser || currentUser === "anonymous") {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    if (!text.trim()) return;

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
          : p,
      ),
    );

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

    // Notify anyone @mentioned in the comment (skip the commenter
    // themselves and the post owner, who's already notified above).
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

  const handleToggleComments = (postId) => {
    setPosts((all) =>
      all.map((p) =>
        p.id === postId ? { ...p, showComments: !p.showComments } : p,
      ),
    );
  };

  const handleShare = async (postId) => {
    if (!currentUser || currentUser === "anonymous") {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    setError("");
    try {
      const { error: err } = await supabase.from("posts").insert({
        username: currentUser,
        text: `Shared: "${post.text?.slice(0, 120) || ""}"`,
        image_url: post.image_url || null,
        image_urls:
          post.image_urls && post.image_urls.length > 0
            ? post.image_urls
            : null,
        video_url: post.video_url || null,
        feeling: post.feeling || null,
        link: post.link || null,
        privacy: "public",
        shared_from: postId,
      });
      if (err) throw err;
      // The shared copy isn't spliced into THIS page's list — it'll show
      // up on the home feed / its own hashtag pages normally.
    } catch (err) {
      console.error("Share to feed failed:", err);
      setError(err.message || "Couldn't share this post. Please try again.");
    }
  };

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

    const { error: delErr } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("username", currentUser);

    if (delErr) fetchPosts();
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

    setPosts((all) => all.map((p) => (p.id === postId ? { ...p, ...data } : p)));
    // If the edited text no longer contains this hashtag, drop it from
    // the page immediately instead of leaving a stale, now-mismatched
    // post visible until the next full reload.
    if (!(data.text || "").toLowerCase().includes(`#${tag.toLowerCase()}`)) {
      setPosts((all) => all.filter((p) => p.id !== postId));
    }
  };

  return (
    <div className={`pf-feed${!sideNavbar ? " sidebar-closed" : ""}`}>
      <button className="hashtag-back-btn" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <h2 className="hashtag-page-title">#{tag}</h2>
      <p className="hashtag-page-subtitle">
        {loading
          ? "Loading…"
          : `${posts.length} post${posts.length !== 1 ? "s" : ""}`}
      </p>

      {error && <p className="pf-error">{error}</p>}

      {!loading && posts.length === 0 && (
        <div className="pf-empty">
          <span className="pf-empty-icon">🔖</span>
          <p>No posts yet with #{tag}.</p>
        </div>
      )}

      {posts.map((post) => (
        <PostCard
          key={post.id}
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
      ))}
    </div>
  );
};

export default HashtagPage;