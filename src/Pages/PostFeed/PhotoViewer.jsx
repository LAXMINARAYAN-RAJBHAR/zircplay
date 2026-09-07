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

// Minimum horizontal drag/swipe distance (px) before it counts as a
// deliberate "go to next/previous photo" gesture rather than an
// incidental wiggle or the start of a vertical scroll.
const SWIPE_THRESHOLD = 50;

/*
 * PhotoBlock — one photo + its own like/comment/share, rendered as one
 * "row" in PhotoViewer's vertical stack. All state for this photo lives
 * here so each block is independent — commenting on photo 3 doesn't
 * re-render or reset photo 1's picker/input state.
 *
 * NEW: the image itself now also supports horizontal swipe (touch),
 * click-and-drag (mouse), and left/right chevron buttons to jump
 * directly to the next/previous photo — on top of (not instead of) the
 * existing vertical scroll between blocks. onNavigate(direction) is
 * called with -1 (previous) or +1 (next); the parent (PhotoViewer)
 * owns actually scrolling to that block, since it holds all the refs.
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
  onNavigate,
}) => {
  const [reactionCounts, setReactionCounts] = useState(initialReactions.counts);
  const [myReaction, setMyReaction] = useState(initialReactions.mine);
  const [comments, setComments] = useState(initialComments);
  const [commentText, setCommentText] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [copied, setCopied] = useState(false);
  const pickerRef = useRef(null);

  // ── Horizontal swipe / drag tracking ──
  // dragState holds the in-progress gesture's start point and axis lock
  // decision. axisLockRef prevents a gesture from being reinterpreted
  // mid-drag — once we've decided "this is horizontal" or "this is
  // vertical" based on the first few pixels of movement, we stick with
  // that decision for the rest of the gesture.
  const dragStartRef = useRef(null); // { x, y } | null
  const axisLockRef = useRef(null); // "horizontal" | "vertical" | null
  const isMouseDraggingRef = useRef(false);

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

  // ── Touch swipe handlers ──
  // Only the image itself is the swipe surface (see JSX below) — the
  // panel underneath (like/comment/share, comment list) keeps its
  // normal touch behavior untouched.
  const handleTouchStart = (e) => {
    const t = e.touches[0];
    dragStartRef.current = { x: t.clientX, y: t.clientY };
    axisLockRef.current = null;
  };

  const handleTouchMove = (e) => {
    if (!dragStartRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - dragStartRef.current.x;
    const dy = t.clientY - dragStartRef.current.y;

    if (!axisLockRef.current) {
      // Decide once, on the first meaningfully-sized movement, whether
      // this gesture is horizontal (photo nav) or vertical (let the
      // page's normal scroll handle it — don't preventDefault in that
      // case, or scrolling between blocks would break).
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        axisLockRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
    }

    if (axisLockRef.current === "horizontal") {
      // Prevent the browser from also trying to scroll/pan while we're
      // handling a horizontal swipe ourselves.
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e) => {
    if (!dragStartRef.current || axisLockRef.current !== "horizontal") {
      dragStartRef.current = null;
      axisLockRef.current = null;
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - dragStartRef.current.x;
    dragStartRef.current = null;
    axisLockRef.current = null;

    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    // Swiped left (dx negative) → advance to next photo.
    // Swiped right (dx positive) → go back to previous photo.
    onNavigate(dx < 0 ? 1 : -1);
  };

  // ── Mouse drag handlers (desktop) — mirrors the touch gesture above ──
  const handleMouseDown = (e) => {
    isMouseDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isMouseDraggingRef.current || !dragStartRef.current) return;
    // No preventDefault needed here — native image drag-ghosting is
    // already suppressed via draggable={false} on the <img> below.
  };

  const handleMouseUp = (e) => {
    if (!isMouseDraggingRef.current || !dragStartRef.current) {
      isMouseDraggingRef.current = false;
      dragStartRef.current = null;
      return;
    }
    const dx = e.clientX - dragStartRef.current.x;
    isMouseDraggingRef.current = false;
    dragStartRef.current = null;

    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    onNavigate(dx < 0 ? 1 : -1);
  };

  const handleMouseLeave = () => {
    // Cancel an in-progress drag if the pointer leaves the image
    // entirely (e.g. user drags off the edge) — avoids a stale
    // dragStartRef causing a spurious jump on the next mouseup
    // elsewhere on the page.
    isMouseDraggingRef.current = false;
    dragStartRef.current = null;
  };

  return (
    <div className="pv-block" ref={blockRef}>
      {total > 1 && (
        <span className="pv-block-counter">
          {index + 1} / {total}
        </span>
      )}

      <div className="pv-image-wrap">
        {total > 1 && index > 0 && (
          <button
            type="button"
            className="pv-nav-btn pv-nav-btn--prev"
            onClick={() => onNavigate(-1)}
            aria-label="Previous photo"
          >
            ‹
          </button>
        )}

        <img
          src={src}
          alt={`Photo ${index + 1}`}
          className="pv-block-image"
          draggable={false}
          onTouchStart={total > 1 ? handleTouchStart : undefined}
          onTouchMove={total > 1 ? handleTouchMove : undefined}
          onTouchEnd={total > 1 ? handleTouchEnd : undefined}
          onMouseDown={total > 1 ? handleMouseDown : undefined}
          onMouseMove={total > 1 ? handleMouseMove : undefined}
          onMouseUp={total > 1 ? handleMouseUp : undefined}
          onMouseLeave={total > 1 ? handleMouseLeave : undefined}
          style={total > 1 ? { cursor: "grab", touchAction: "pan-y" } : undefined}
        />

        {total > 1 && index < total - 1 && (
          <button
            type="button"
            className="pv-nav-btn pv-nav-btn--next"
            onClick={() => onNavigate(1)}
            aria-label="Next photo"
          >
            ›
          </button>
        )}
      </div>

      <div className="pv-panel">
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
 * between photos), and the view auto-scrolls to the tapped photo's
 * position on open.
 *
 * NEW: each photo's image also supports jumping directly to the next/
 * previous photo via touch swipe, mouse drag, on-screen ‹ › buttons, or
 * the ArrowLeft/ArrowRight keys — all of these funnel through
 * scrollToIndex() below, which just smooth-scrolls the vertical stack
 * to that photo's block. This is additive: the vertical scroll-through-
 * all-photos behavior is unchanged, horizontal navigation is just a
 * faster way to get to a specific adjacent photo without scrolling
 * past its whole panel.
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

  // NEW: smooth-scrolls the stack so the given photo index's block is
  // at the top of the view. Used by swipe/drag/button/keyboard nav —
  // all of them just compute a target index and call this.
  const scrollToIndex = useCallback((index) => {
    const el = blockRefs.current[index];
    if (el) el.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);

  // NEW: figures out which photo is currently most in view (used as
  // the "current" position for relative navigation — swiping left on
  // whichever photo you're looking at should go to the NEXT photo
  // relative to that one, not relative to startIndex forever).
  const getCurrentIndex = useCallback(() => {
    let closestIndex = 0;
    let closestDistance = Infinity;
    blockRefs.current.forEach((el, i) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const distance = Math.abs(rect.top);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    });
    return closestIndex;
  }, []);

  // direction: -1 (previous) or +1 (next), relative to whichever photo
  // is currently most visible — not relative to the block that
  // triggered the gesture, so this stays correct even if the person
  // has scrolled elsewhere with normal vertical scrolling in between.
  const navigate = useCallback(
    (direction) => {
      const current = getCurrentIndex();
      const target = current + direction;
      if (target < 0 || target >= images.length) return; // no-op at the ends
      scrollToIndex(target);
    },
    [getCurrentIndex, scrollToIndex, images.length],
  );

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") navigate(-1);
      else if (e.key === "ArrowRight") navigate(1);
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose, navigate]);

  return (
    <div className="pv-overlay">
      <button className="pv-close" onClick={onClose} aria-label="Close">
        ✕
      </button>

      <div className="pv-scroll-stack" onClick={(e) => e.stopPropagation()}>
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
            onNavigate={navigate}
          />
        ))}
      </div>
    </div>
  );
};

export default PhotoViewer;