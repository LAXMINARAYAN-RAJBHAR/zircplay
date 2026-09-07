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

// Minimum horizontal drag distance (px), as a fraction of the
// viewport's own width, before a released drag commits to the
// next/previous photo instead of snapping back to the current one.
const SWIPE_COMMIT_RATIO = 0.18;

/*
 * PhotoSlide — one photo + its own like/comment/share panel directly
 * below it, rendered as one full-width "slide" in the horizontal
 * carousel track — matches Facebook's own full-screen photo viewer
 * (X/⋮ at top, photo, caption + reaction row underneath, swipe to move
 * between photos). All reaction/comment state for this photo lives
 * here so each slide is independent — commenting on photo 3 doesn't
 * re-render or reset photo 1's picker/input state.
 */
const PhotoSlide = ({
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
}) => {
  const [reactionCounts, setReactionCounts] = useState(initialReactions.counts);
  const [myReaction, setMyReaction] = useState(initialReactions.mine);
  const [comments, setComments] = useState(initialComments);
  const [commentText, setCommentText] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [copied, setCopied] = useState(false);
  const pickerRef = useRef(null);

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
    <div className="pv-slide">
      {total > 1 && (
        <span className="pv-block-counter">
          {index + 1} / {total}
        </span>
      )}

      <img
        src={src}
        alt={`Photo ${index + 1}`}
        className="pv-block-image"
        draggable={false}
      />

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
 * PhotoViewer — Facebook/Instagram-style full-screen, one-photo-at-a-
 * time viewer for multi-image (and single-image) posts. Clicking any
 * tile in ImageGrid opens this, landing directly on the tapped photo.
 * Matches Facebook's own full-screen photo viewer layout: ✕ close
 * button top-left, the photo, and directly below it a caption/reaction
 * row with Like/Comment/Share — swipe (or drag/arrows/buttons) moves to
 * the next or previous photo, each with its own independent panel.
 *
 * Implementation: all photos sit in a flex row (.pv-track), each
 * exactly 100% of the viewport wide. The track's transform is driven by
 * currentIndex (its resting position) plus, while a drag is in
 * progress, a live pixel offset that follows the finger/mouse — so the
 * photo visibly tracks the gesture instead of only responding on
 * release. Releasing past SWIPE_COMMIT_RATIO of the viewport's width
 * commits to the next/previous photo; anything less snaps back to the
 * current one. A CSS transition is toggled on/off so mid-drag tracking
 * is instant (no lag behind the finger) while the settle/commit
 * animation itself is smoothly eased.
 *
 * Unlike an image-only lightbox, tapping the photo does NOT close the
 * viewer here (matching Facebook, where tapping the photo has no
 * special effect and only the ✕ button / Escape close it) — the panel
 * below has its own clickable Like/Comment/Share controls, so an
 * accidental-close-on-tap would fight with those.
 *
 * Each photo's reactions/comments are keyed by a deterministic
 * `${postId}_${index}` string rather than a real foreign key into a
 * dedicated photos table — this works retroactively on every existing
 * post's `image_urls` array with zero changes to the upload flow
 * (PostComposer.jsx). Tradeoff: if a post's photos are ever reordered
 * or individually removed after the fact, the index-based key can point
 * at the wrong photo's history. Not a concern for normal
 * add/delete-the-whole-post usage.
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
  const [currentIndex, setCurrentIndex] = useState(
    Math.min(Math.max(startIndex, 0), images.length - 1),
  );

  const viewportRef = useRef(null);

  // ── Drag state ──
  // dragOffset: live px offset applied on top of currentIndex's resting
  // position while a gesture is in progress (0 when not dragging).
  // isDragging drives whether the CSS transition is active — off while
  // actively tracking the finger, on for the settle animation.
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef(null); // { x, y } | null
  const axisLockRef = useRef(null); // "horizontal" | "vertical" | null

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

  const goTo = useCallback(
    (index) => {
      setCurrentIndex(Math.min(Math.max(index, 0), images.length - 1));
    },
    [images.length],
  );

  const navigate = useCallback(
    (direction) => {
      goTo(currentIndex + direction);
    },
    [currentIndex, goTo],
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

  const getViewportWidth = () => viewportRef.current?.clientWidth || window.innerWidth;

  const settleDrag = (dx) => {
    const width = getViewportWidth();
    const commitThreshold = width * SWIPE_COMMIT_RATIO;

    setDragOffset(0);
    setIsDragging(false);

    if (Math.abs(dx) > commitThreshold) {
      navigate(dx < 0 ? 1 : -1);
    }
    // else: dragOffset already reset to 0 above, which snaps back to
    // the current photo now that isDragging is false.
  };

  // ── Touch handlers — only attached on the image itself (see
  // PhotoSlide/CSS), so touches inside the panel (Like/Comment/Share
  // buttons, the comment input, scrolling a long comment list) behave
  // completely normally and never get mistaken for a swipe. ──
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
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        axisLockRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
    }

    if (axisLockRef.current === "horizontal") {
      e.preventDefault();
      setIsDragging(true);
      const atStart = currentIndex === 0 && dx > 0;
      const atEnd = currentIndex === images.length - 1 && dx < 0;
      setDragOffset(atStart || atEnd ? dx / 2.5 : dx);
    }
  };

  const handleTouchEnd = (e) => {
    if (axisLockRef.current !== "horizontal") {
      dragStartRef.current = null;
      axisLockRef.current = null;
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - dragStartRef.current.x;
    dragStartRef.current = null;
    axisLockRef.current = null;
    settleDrag(dx);
  };

  // ── Mouse drag handlers (desktop) — also only on the image itself ──
  const handleMouseDown = (e) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    axisLockRef.current = "horizontal"; // mouse drag is always intentional
    setIsDragging(true);
  };

  const handleMouseMoveGlobal = useCallback(
    (e) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const atStart = currentIndex === 0 && dx > 0;
      const atEnd = currentIndex === images.length - 1 && dx < 0;
      setDragOffset(atStart || atEnd ? dx / 2.5 : dx);
    },
    [currentIndex, images.length],
  );

  const handleMouseUpGlobal = useCallback(
    (e) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      dragStartRef.current = null;
      axisLockRef.current = null;
      settleDrag(dx);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentIndex],
  );

  // Mouse drag needs page-level listeners since the pointer can move
  // (and be released) outside the image element mid-drag.
  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener("mousemove", handleMouseMoveGlobal);
    window.addEventListener("mouseup", handleMouseUpGlobal);
    return () => {
      window.removeEventListener("mousemove", handleMouseMoveGlobal);
      window.removeEventListener("mouseup", handleMouseUpGlobal);
    };
  }, [isDragging, handleMouseMoveGlobal, handleMouseUpGlobal]);

  const trackStyle = {
    transform: `translateX(calc(-${currentIndex * 100}% + ${dragOffset}px))`,
    transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
  };

  return (
    <div className="pv-overlay">
      <button className="pv-close" onClick={onClose} aria-label="Close">
        ✕
      </button>

      {images.length > 1 && currentIndex > 0 && (
        <button
          type="button"
          className="pv-nav-btn pv-nav-btn--prev pv-nav-btn--fixed"
          onClick={() => navigate(-1)}
          aria-label="Previous photo"
        >
          ‹
        </button>
      )}
      {images.length > 1 && currentIndex < images.length - 1 && (
        <button
          type="button"
          className="pv-nav-btn pv-nav-btn--next pv-nav-btn--fixed"
          onClick={() => navigate(1)}
          aria-label="Next photo"
        >
          ›
        </button>
      )}

      <div className="pv-viewport" ref={viewportRef} onClick={(e) => e.stopPropagation()}>
        <div className="pv-track" style={trackStyle}>
          {images.map((src, i) => (
            <div
              className="pv-slide-wrap"
              key={i}
              // Swipe surface is this wrapper around image+panel — but
              // since the panel needs normal scroll/click behavior, we
              // only actually start tracking a gesture when it begins
              // on the image itself. See PhotoSlide's img element below
              // for where these get attached via event delegation.
              onTouchStart={(e) => e.target.tagName === "IMG" && handleTouchStart(e)}
              onTouchMove={(e) => e.target.tagName === "IMG" && handleTouchMove(e)}
              onTouchEnd={(e) => e.target.tagName === "IMG" && handleTouchEnd(e)}
              onMouseDown={(e) => e.target.tagName === "IMG" && handleMouseDown(e)}
            >
              <PhotoSlide
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
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PhotoViewer;