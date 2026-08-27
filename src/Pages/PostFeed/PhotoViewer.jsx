import React, { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../../config/supabase";
import { notifyUser } from "../../utils/notifications";
import "./PhotoViewer.css";

const REACTIONS = [
  { key: "like", emoji: "👍", label: "Like", color: "#1877f2" },
  { key: "love", emoji: "❤️", label: "Love", color: "#e0245e" },
  { key: "haha", emoji: "😂", label: "Haha", color: "#f5a623" },
  { key: "wow", emoji: "😮", label: "Wow", color: "#f5a623" },
  { key: "sad", emoji: "😢", label: "Sad", color: "#f5a623" },
  { key: "angry", emoji: "😡", label: "Angry", color: "#e05e00" },
];

const timeAgo = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

/*
 * PhotoBlock — one photo + its own like/comment/share, rendered as one
 * "row" in PhotoViewer's vertical stack. All state for this photo lives
 * here so each block is independent — commenting on photo 3 doesn't
 * re-render or reset photo 1's picker/input state.
 */
const PhotoBlock = ({
  src,
  index,
  total,
  imageKey,
  postId,
  postUsername,
  currentUser,
  initialReactions,
  initialComments,
  loading,
  blockRef,
}) => {
  const [reactionCounts, setReactionCounts] = useState(initialReactions.counts);
  const [myReaction, setMyReaction] = useState(initialReactions.mine);
  const [comments, setComments] = useState(initialComments);
  const [commentText, setCommentText] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [copied, setCopied] = useState(false);
  const pickerRef = useRef(null);

  // Keep in sync if the parent's initial fetch resolves after mount
  // (e.g. this block was rendered before the batched query returned).
  useEffect(() => {
    setReactionCounts(initialReactions.counts);
    setMyReaction(initialReactions.mine);
  }, [initialReactions]);
  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const totalReactions = Object.values(reactionCounts).reduce((a, b) => a + b, 0);
  const myReactionInfo = REACTIONS.find((r) => r.key === myReaction);

  const requireLogin = () => {
    if (!currentUser || currentUser === "anonymous") {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return false;
    }
    return true;
  };

  const react = async (type) => {
    if (!requireLogin()) return;
    setShowPicker(false);

    const isRemoving = myReaction === type;
    setReactionCounts((prev) => {
      const next = { ...prev };
      if (myReaction) next[myReaction] = Math.max(0, (next[myReaction] || 1) - 1);
      if (!isRemoving) next[type] = (next[type] || 0) + 1;
      return next;
    });
    setMyReaction(isRemoving ? null : type);

    if (myReaction) {
      await supabase
        .from("post_image_reactions")
        .delete()
        .eq("image_key", imageKey)
        .eq("username", currentUser);
    }
    if (!isRemoving) {
      await supabase.from("post_image_reactions").upsert(
        { image_key: imageKey, username: currentUser, type },
        { onConflict: "image_key,username" },
      );

      if (postUsername && postUsername !== currentUser) {
        notifyUser({
          recipientUsername: postUsername,
          senderUsername: currentUser,
          type: "like",
          message: `${currentUser} reacted to your photo`,
          contentId: postId,
          contentType: "post",
        });
      }
    }
  };

  const submitComment = async () => {
    if (!requireLogin()) return;
    if (!commentText.trim()) return;
    const { data, error } = await supabase
      .from("post_image_comments")
      .insert({ image_key: imageKey, username: currentUser, text: commentText.trim() })
      .select()
      .single();
    if (!error && data) {
      setComments((prev) => [...prev, data]);
      setCommentText("");
      setShowComments(true);

      if (postUsername && postUsername !== currentUser) {
        notifyUser({
          recipientUsername: postUsername,
          senderUsername: currentUser,
          type: "comment",
          message: `${currentUser} commented on your photo: "${data.text.slice(0, 60)}"`,
          contentId: postId,
          contentType: "post",
        });
      }
    }
  };

  const handleCopyLink = () => {
    const url = `https://zixplon.in/api/og?type=post&id=${postId}&photo=${index}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pv-block" ref={blockRef}>
      {total > 1 && (
        <span className="pv-block-counter">
          {index + 1} / {total}
        </span>
      )}

      <img src={src} alt={`Photo ${index + 1}`} className="pv-block-image" />

      {/* stopPropagation here (not on the whole block) so the panel's
          buttons/input stay usable, while the image above and the
          empty space around the block still bubble up to pv-overlay's
          click-to-close handler. */}
      <div className="pv-panel" onClick={(e) => e.stopPropagation()}>
        <div className="pv-summary">
          <span>
            {totalReactions > 0 &&
              Object.entries(reactionCounts)
                .filter(([, v]) => v > 0)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([k]) => REACTIONS.find((r) => r.key === k)?.emoji)
                .join("")}{" "}
            {totalReactions} {totalReactions === 1 ? "reaction" : "reactions"}
          </span>
          <button className="pv-text-btn" onClick={() => setShowComments((v) => !v)}>
            {comments.length} comment{comments.length !== 1 ? "s" : ""}
          </button>
        </div>

        <div className="pv-actions">
          <div className="pv-action-wrap" ref={pickerRef}>
            <button
              className="pv-action-btn"
              style={myReactionInfo ? { color: myReactionInfo.color } : {}}
              onClick={() => react(myReaction || "like")}
              onMouseEnter={() =>
                currentUser && currentUser !== "anonymous" && setShowPicker(true)
              }
            >
              {myReactionInfo ? myReactionInfo.emoji : "👍"}{" "}
              {myReactionInfo ? myReactionInfo.label : "Like"}
            </button>
            {showPicker && (
              <div className="pv-picker" onMouseLeave={() => setShowPicker(false)}>
                {REACTIONS.map((r) => (
                  <button
                    key={r.key}
                    className="pv-pick-btn"
                    title={r.label}
                    onClick={() => react(r.key)}
                  >
                    {r.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="pv-action-btn" onClick={() => setShowComments((v) => !v)}>
            💬 Comment
          </button>

          <button className="pv-action-btn" onClick={handleCopyLink}>
            {copied ? "✅ Copied" : "🔗 Copy link"}
          </button>
        </div>

        {showComments && (
          <div className="pv-comments">
            <div className="pv-comments-list">
              {loading ? (
                <p className="pv-muted">Loading…</p>
              ) : comments.length === 0 ? (
                <p className="pv-muted">No comments yet on this photo.</p>
              ) : (
                comments.map((c) => (
                  <div className="pv-comment" key={c.id}>
                    <span className="pv-comment-user">{c.username}</span>
                    <span className="pv-comment-time">{timeAgo(c.created_at)}</span>
                    <p className="pv-comment-text">{c.text}</p>
                  </div>
                ))
              )}
            </div>
            <div className="pv-comment-input-row">
              <input
                className="pv-comment-input"
                placeholder={
                  !currentUser || currentUser === "anonymous"
                    ? "Login to comment…"
                    : "Comment on this photo…"
                }
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitComment()}
                disabled={!currentUser || currentUser === "anonymous"}
              />
              <button className="pv-send-btn" onClick={submitComment}>
                ➤
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/*
 * PhotoViewer — Facebook-style vertical photo feed for multi-image (and
 * single-image) posts. Clicking any tile in ImageGrid opens this; every
 * photo in the post is shown stacked one below another (scroll to move
 * between photos, no swipe/arrows), and the view auto-scrolls to the
 * tapped photo's position on open.
 *
 * Each photo gets its OWN like/comment/share, independent of the
 * post-level reactions shown on the feed card. Per-photo reactions/
 * comments are keyed by a deterministic `${postId}_${index}` string
 * rather than a real foreign key into a dedicated photos table — this
 * works retroactively on every existing post's `image_urls` array with
 * zero changes to the upload flow (PostComposer.jsx). Tradeoff: if a
 * post's photos are ever reordered or individually removed after the
 * fact, the index-based key can point at the wrong photo's history. Not
 * a concern for normal add/delete-the-whole-post usage.
 *
 * All reactions/comments for every photo in the post are fetched in two
 * batched queries (image_key IN [...]) on open, rather than one query
 * per photo — keeps this cheap even for posts with many images.
 *
 * Requires the post_image_reactions / post_image_comments tables — see
 * the accompanying SQL migration.
 *
 * CHANGED: viewer now closes on (1) clicking anywhere on the dark
 * backdrop or on a photo itself, and (2) pressing the browser's back
 * button — instead of the back button navigating away from the page
 * underneath. See the history.pushState / popstate wiring below.
 */
const PhotoViewer = ({
  images,        // array of URL strings (post.image_urls, or [post.image_url])
  startIndex = 0,
  postId,
  postUsername,
  currentUser,
  onClose,
}) => {
  const [dataByIndex, setDataByIndex] = useState({});
  const [loading, setLoading] = useState(true);
  const blockRefs = useRef([]);
  const scrolledRef = useRef(false);
  // NEW: tracks whether this viewer is being torn down because of a
  // popstate (browser back button) event, vs. any other close path
  // (X button, backdrop/photo click, Escape). Lets the unmount cleanup
  // below tell the two apart so it doesn't fire a redundant
  // history.back() after the browser has already navigated back.
  const closedByPopStateRef = useRef(false);

  const loadAllImageData = useCallback(async () => {
    setLoading(true);
    const imageKeys = images.map((_, i) => `${postId}_${i}`);

    const [{ data: reactions }, { data: commentRows }] = await Promise.all([
      supabase
        .from("post_image_reactions")
        .select("image_key, type, username")
        .in("image_key", imageKeys),
      supabase
        .from("post_image_comments")
        .select("*")
        .in("image_key", imageKeys)
        .order("created_at", { ascending: true }),
    ]);

    const next = {};
    imageKeys.forEach((key, i) => {
      const keyReactions = (reactions || []).filter((r) => r.image_key === key);
      const counts = {};
      keyReactions.forEach((r) => {
        counts[r.type] = (counts[r.type] || 0) + 1;
      });
      next[i] = {
        counts,
        mine: keyReactions.find((r) => r.username === currentUser)?.type || null,
        comments: (commentRows || []).filter((c) => c.image_key === key),
      };
    });
    setDataByIndex(next);
    setLoading(false);
  }, [images, postId, currentUser]);

  useEffect(() => {
    loadAllImageData();
  }, [loadAllImageData]);

  // Jump straight to the tapped tile's photo once its block has rendered.
  useEffect(() => {
    if (scrolledRef.current) return;
    const el = blockRefs.current[startIndex];
    if (el) {
      el.scrollIntoView({ block: "start" });
      scrolledRef.current = true;
    }
  });

  // NEW: back-button handling. Push one history entry the moment the
  // viewer opens, so the browser's back gesture/button has something of
  // ours to pop first instead of immediately leaving the page. Every
  // in-app close path (X button, backdrop click, Escape) triggers that
  // pop via history.back() rather than calling onClose directly — the
  // popstate listener below is the single place that actually unmounts
  // the viewer, so however it's closed, the browser history stays
  // consistent with what's on screen.
  useEffect(() => {
    window.history.pushState({ photoViewer: true }, "");

    const handlePopState = () => {
      closedByPopStateRef.current = true;
      onClose();
    };
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      // If we're unmounting for some other reason than the back
      // button itself firing (e.g. a parent-level state change), the
      // history entry we pushed on open is still sitting there. Pop it
      // so a later back press doesn't land the user back on a closed
      // viewer instead of the previous real page.
      if (!closedByPopStateRef.current) {
        window.history.back();
      }
    };
  }, [onClose]);

  // Routes every non-popstate close path through history.back() so the
  // popstate handler above is the only place onClose actually fires —
  // keeps a single source of truth for "the viewer is closing".
  const closeViewer = useCallback(() => {
    window.history.back();
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handleKey = (e) => {
      if (e.key === "Escape") closeViewer();
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKey);
    };
  }, [closeViewer]);

  return (
    // NEW: clicking the backdrop (or a photo, since the image itself no
    // longer stops propagation) closes the viewer. Only the like/
    // comment/share panel below stops propagation, so those controls
    // keep working without accidentally closing the viewer.
    <div className="pv-overlay" onClick={closeViewer}>
      <button
        className="pv-close"
        onClick={(e) => {
          e.stopPropagation();
          closeViewer();
        }}
        aria-label="Close"
      >
        ✕
      </button>

      <div className="pv-scroll-stack">
        {images.map((src, i) => (
          <PhotoBlock
            key={i}
            src={src}
            index={i}
            total={images.length}
            imageKey={`${postId}_${i}`}
            postId={postId}
            postUsername={postUsername}
            currentUser={currentUser}
            initialReactions={dataByIndex[i] || { counts: {}, mine: null }}
            initialComments={dataByIndex[i]?.comments || []}
            loading={loading}
            blockRef={(el) => (blockRefs.current[i] = el)}
          />
        ))}
      </div>
    </div>
  );
};

export default PhotoViewer;