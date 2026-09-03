import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import EmojiPicker from "./EmojiPicker";
import ExpandableText from "../../Component/ExpandableText/ExpandableText";
import ReportPostModal from "./ReportPostModal";
// CHANGED: Lightbox (view-only zoom/swipe) replaced with PhotoViewer,
// which adds per-photo like/comment/share/copy-link on top of the same
// full-screen swipe experience. See PhotoViewer.jsx.
import PhotoViewer from "./PhotoViewer";
// NEW: Connect button on each post's header — same "connections" table
// and notifyUser() pattern used by the Connect button on Video.jsx /
// Reels.jsx (see subscriptions_to_connections_migration.sql).
import { supabase } from "../../config/supabase";
import { notifyUser } from "../../utils/notifications";

const REACTIONS = [
  { key: "like", emoji: "👍", label: "Like", color: "#1877f2" },
  { key: "love", emoji: "❤️", label: "Love", color: "#e0245e" },
  { key: "haha", emoji: "😂", label: "Haha", color: "#f5a623" },
  { key: "wow", emoji: "😮", label: "Wow", color: "#f5a623" },
  { key: "sad", emoji: "😢", label: "Sad", color: "#f5a623" },
  { key: "angry", emoji: "😡", label: "Angry", color: "#e05e00" },
];

const PRIVACY_ICON = { public: "🌐", friends: "👥", only_me: "🔒" };
const PRIVACY_OPTIONS = [
  { value: "public", label: "Public", icon: "🌐" },
  { value: "friends", label: "Friends", icon: "👥" },
  { value: "only_me", label: "Only me", icon: "🔒" },
];

const timeAgo = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// ── View count formatting — mirrors formatViews() in homePage.js so
// posts, videos, and reels all display counts the same way. ──
const formatViews = (n) => {
  if (!n || n === 0) return "0 views";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M views";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K views";
  return n + " views";
};

// ─────────────────────────────────────────────────────────────────────────────
// useIsMobile — same pattern used on HomePage's video/reel/trending cards,
// duplicated here at module scope since PostCard lives in its own file.
// Gates hover-preview to non-touch, wider viewports.
// ─────────────────────────────────────────────────────────────────────────────
const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth <= 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
};

/* ─────────────────────────────────────────
   POST VIDEO — hover-to-preview for uploaded post videos.
   Unlike Video/Reel/Trending cards, a post video has no separate
   thumbnail image — only `video_url` — so the video's own first frame
   IS the thumbnail. Behavior:
     • Paused on frame 0 by default, with a play button overlay.
     • Desktop hover (after a short delay, same feel as the other
       preview hooks): plays a MUTED, looping preview right there —
       nothing to click, just like hovering a video/reel/trending card.
     • Click ("activate"): stops the muted preview and switches to the
       real player — sound on, native controls, playing from the start.
       Once activated it stays a normal player (hovering away no longer
       resets or mutes it — that would be a jarring surprise mid-watch).
───────────────────────────────────────── */
const HOVER_PREVIEW_DELAY = 450; // ms

const PostVideo = ({ src }) => {
  const isMobile = useIsMobile();
  const [activated, setActivated] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const videoRef = useRef(null);
  const timeoutRef = useRef(null);

  const canPreview = !isMobile && !activated;

  const cancelTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const onMouseEnter = () => {
    if (!canPreview) return;
    cancelTimer();
    timeoutRef.current = setTimeout(() => {
      setIsPreviewing(true);
      if (videoRef.current) {
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }
    }, HOVER_PREVIEW_DELAY);
  };

  const onMouseLeave = () => {
    cancelTimer();
    if (activated) return; // never interrupt real, sound-on playback
    setIsPreviewing(false);
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      } catch (_) {}
    }
  };

  const handleActivate = () => {
    if (activated) return;
    cancelTimer();
    setActivated(true);
    setIsPreviewing(false);
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  useEffect(() => () => cancelTimer(), []);

  return (
    <div
      className="pf-card-video-wrap"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={!activated ? handleActivate : undefined}
    >
      <video
        ref={videoRef}
        src={src}
        controls={activated}
        muted={!activated}
        loop={!activated}
        playsInline
        preload="metadata"
        className="pf-card-video"
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
      />
      {!activated && (
        <div className="pf-card-video-overlay">
          <div className="pf-card-video-playbtn">▶</div>
          {isPreviewing && (
            <span className="pf-card-video-previewtag">Preview</span>
          )}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────
   IMAGE GRID — Facebook-style collage for multi-image posts.
   Replaces the old in-feed ImageCarousel. Layout is driven entirely by
   the existing .pf-img-grid / .pf-img-grid-1..4 CSS in PostFeed.css
   (which was already written but never wired to any component):
     1 photo  → full-width single tile
     2 photos → two tiles side by side
     3 photos → one large + two stacked small
     4 photos → 2x2 grid
     5+       → same 2x2 grid, with a "+N" overlay on the 4th tile
                showing how many more photos aren't shown here
   Tapping ANY tile opens the full-screen, swipeable PhotoViewer
   starting at that tile's actual index in the full image_urls array —
   so tapping the "+N" tile still lands you on photo #4, and swiping
   from there reveals the rest, exactly like Facebook. ── */
const ImageGrid = ({ images, onOpenViewer }) => {
  const count = images.length;
  const displayCount = Math.min(count, 4);
  const remaining = count - displayCount;

  return (
    <div className={`pf-img-grid pf-img-grid-${displayCount}`}>
      {images.slice(0, displayCount).map((url, i) => (
        <div
          className="pf-img-grid-item"
          key={i}
          onClick={() => onOpenViewer(i)}
        >
          <img src={url} alt={`Image ${i + 1}`} loading="lazy" />
          {i === displayCount - 1 && remaining > 0 && (
            <div className="pf-img-grid-more">+{remaining}</div>
          )}
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────
   POST CARD
───────────────────────────────────────── */
const PostCard = ({
  post,
  currentUser,
  onReaction,
  onComment,
  onToggleComments,
  onShare,
  onDelete,
  onEdit,
  onReport,
  onLikeComment, // NEW: like/unlike a single comment
  onDislikeComment, // NEW: dislike/undislike a single comment
  viewCount = 0, // NEW: this post's total view count, from PostFeed's viewCounts map
  onView, // NEW: (postId) => void — called once per mount when the card scrolls into view
}) => {
  const [commentText, setCommentText] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  // CHANGED: renamed from lightboxData — now drives PhotoViewer instead
  // of the old view-only Lightbox. Same {images, startIndex} shape.
  const [photoViewerData, setPhotoViewerData] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(post.text || "");
  const [editPrivacy, setEditPrivacy] = useState(post.privacy || "public");
  const [editImages, setEditImages] = useState(
    post.image_urls || (post.image_url ? [post.image_url] : []),
  );
  const [showEditEmoji, setShowEditEmoji] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const [showCommentEmoji, setShowCommentEmoji] = useState(false);

  // NEW: Connect button state — mirrors isConnected/handleConnect in
  // Video.jsx and connected/handleConnect in Reels.jsx, against the
  // same "connections" table.
  const [connected, setConnected] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);

  // ── Action bar animation state ──
  // likePopKey / burstKey: replayed via React key remount rather than
  // toggling classes, since remounting an element always restarts its
  // CSS animation cleanly (no need to force a reflow).
  const [likePopKey, setLikePopKey] = useState(0);
  const [burstKey, setBurstKey] = useState(null);
  const [commentBounceKey, setCommentBounceKey] = useState(0);
  const [countPopKey, setCountPopKey] = useState(0);
  const prevReactionRef = useRef(post.myReaction);
  const prevTotalRef = useRef(0);

  const pickerRef = useRef();
  const shareRef = useRef();
  const menuRef = useRef();

  // NEW: root card ref + one-shot guard for the view-count
  // IntersectionObserver below. Mirrors ShortCard's viewFiredRef pattern
  // on the homepage — fires at most once per mount, once the card is
  // at least 60% visible.
  const cardRef = useRef(null);
  const viewFiredRef = useRef(false);

  const navigate = useNavigate();

  const initials = (post.username || "?").slice(0, 2).toUpperCase();
  const totalReactions = Object.values(post.reactionCounts || {}).reduce(
    (a, b) => a + b,
    0,
  );
  const totalComments = post.comments?.length || 0;
  const myReact = REACTIONS.find((r) => r.key === post.myReaction);

  // Fire the like-burst + icon pop only when going from "no reaction" to
  // "reacted" — not on every reaction swap, so picking a different
  // reaction doesn't retrigger the confetti-style burst repeatedly.
  useEffect(() => {
    const prev = prevReactionRef.current;
    prevReactionRef.current = post.myReaction;
    if (!prev && post.myReaction) {
      setLikePopKey((k) => k + 1);
      setBurstKey(Date.now());
    }
  }, [post.myReaction]);

  useEffect(() => {
    if (burstKey === null) return;
    const t = setTimeout(() => setBurstKey(null), 650);
    return () => clearTimeout(t);
  }, [burstKey]);

  // Small pop on the reaction count whenever it changes, in either
  // direction (someone else's like landing counts too, via realtime).
  useEffect(() => {
    if (prevTotalRef.current !== totalReactions) {
      setCountPopKey((k) => k + 1);
      prevTotalRef.current = totalReactions;
    }
  }, [totalReactions]);

  // NEW: view-count tracking. Same 60%-visible threshold used by
  // ShortCard/VideoCard on the homepage — counts a "view" once the post
  // has genuinely scrolled into the viewport, not just rendered
  // off-screen in a long feed. onView() itself (in PostFeed) handles
  // the 24h-per-user de-duplication, same as incrementView() there.
  useEffect(() => {
    viewFiredRef.current = false;
    if (!cardRef.current || !onView) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          entry.isIntersecting &&
          entry.intersectionRatio >= 0.6 &&
          !viewFiredRef.current
        ) {
          viewFiredRef.current = true;
          onView(post.id);
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [post.id, onView]);

  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target))
        setShowPicker(false);
      if (shareRef.current && !shareRef.current.contains(e.target))
        setShowShareMenu(false);
      if (menuRef.current && !menuRef.current.contains(e.target))
        setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // NEW: load whether the current user is already connected to this
  // post's author. Skipped entirely for the author's own posts, since
  // the button never renders there anyway.
  useEffect(() => {
    if (!post.username || post.username === currentUser) return;
    const loadConnection = async () => {
      const userId = localStorage.getItem("userId");
      if (!userId) return;
      const { data } = await supabase
        .from("connections")
        .select("id")
        .match({ connector_id: userId, connected_to: post.username })
        .maybeSingle();
      setConnected(!!data);
    };
    loadConnection();
  }, [post.username, currentUser]);

  const handleConnect = async () => {
    if (!currentUser || currentUser === "anonymous") {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    const userId = localStorage.getItem("userId");
    if (!userId) {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    if (connectLoading) return;
    setConnectLoading(true);
    try {
      if (connected) {
        await supabase
          .from("connections")
          .delete()
          .match({ connector_id: userId, connected_to: post.username });
        setConnected(false);
      } else {
        const { error } = await supabase
          .from("connections")
          .insert({ connector_id: userId, connected_to: post.username });
        if (!error) {
          setConnected(true);
          notifyUser({
            recipientUsername: post.username,
            senderUsername: currentUser,
            type: "connection",
            message: `${currentUser} connected with you`,
          });
        }
      }
    } finally {
      setConnectLoading(false);
    }
  };

  const handleCommentSubmit = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (commentText.trim()) {
        onComment(post.id, commentText);
        setCommentText("");
      }
    }
  };

  const handleCopyLink = () => {
    const shareUrl = `https://zixplon.in/api/og?type=post&id=${post.id}`;
    navigator.clipboard?.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowShareMenu(false);
  };

  const startEdit = () => {
    setEditText(post.text || "");
    setEditPrivacy(post.privacy || "public");
    setEditImages(post.image_urls || (post.image_url ? [post.image_url] : []));
    setIsEditing(true);
    setShowMenu(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setShowEditEmoji(false);
  };

  const removeEditImage = (idx) => {
    setEditImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveEdit = async () => {
    if (!editText.trim() && editImages.length === 0) return;
    setSavingEdit(true);
    try {
      await onEdit(post.id, {
        text: editText.trim() || null,
        privacy: editPrivacy,
        image_url: editImages[0] || null,
        image_urls: editImages.length > 0 ? editImages : null,
      });
      setIsEditing(false);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleShareClick = () => {
    if (!currentUser || currentUser === "anonymous") {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    setShowShareMenu((v) => !v);
  };

  const handleReportClick = () => {
    if (!currentUser || currentUser === "anonymous") {
      window.dispatchEvent(new CustomEvent("openLogin"));
      setShowMenu(false);
      return;
    }
    setShowReportModal(true);
    setShowMenu(false);
  };

  // NEW: like/dislike an individual comment. Guards against logged-out
  // users the same way every other interactive action on this card
  // does (Like/Comment/Share), then delegates the actual state update
  // + Supabase write up to PostFeed via the passed-in callback
  // (onLikeComment or onDislikeComment).
  const handleCommentReactionClick = (commentId, callback) => {
    if (!currentUser || currentUser === "anonymous") {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    callback(post.id, commentId);
  };

  return (
    <>
      {/* PhotoViewer — same {images, startIndex} shape as before, now
          launched from ImageGrid taps instead of ImageCarousel drags. */}
      {photoViewerData && (
        <PhotoViewer
          images={photoViewerData.images}
          startIndex={photoViewerData.startIndex}
          postId={post.id}
          postUsername={post.username}
          currentUser={currentUser}
          onClose={() => setPhotoViewerData(null)}
        />
      )}

      {showReportModal && (
        <ReportPostModal
          post={post}
          onClose={() => setShowReportModal(false)}
          onReport={onReport}
        />
      )}

      <div className="pf-card" ref={cardRef}>
        {/* ── Header ── */}
        <div className="pf-card-header">
          <Link
            to={`/user/${post.username}`}
            className="pf-avatar pf-avatar-green pf-avatar-link"
            title={`View ${post.username}'s profile`}
          >
            {initials}
          </Link>
          <div className="pf-card-meta">
            <p className="pf-card-author">
              <Link to={`/user/${post.username}`} className="pf-author-link">
                {post.username}
              </Link>
              {post.feeling && (
                <span className="pf-card-feeling">
                  {" "}
                  — feeling {post.feeling}
                </span>
              )}
            </p>
            <p className="pf-card-time">
              {timeAgo(post.created_at)}&nbsp;·&nbsp;
              {new Date(post.created_at).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
              &nbsp;{PRIVACY_ICON[post.privacy] || "🌐"}
              {post.updated_at && post.updated_at !== post.created_at && (
                <span> · Edited</span>
              )}
            </p>
          </div>

          {!isEditing && post.username !== currentUser && (
            <button
              className={`pf-connect-btn ${connected ? "pf-connect-btn-active" : ""}`}
              onClick={handleConnect}
              disabled={connectLoading}
            >
              {connected ? "✓ Connected" : "Connect"}
            </button>
          )}

          {!isEditing && (
            <div className="pf-menu-wrap" ref={menuRef}>
              <button
                className="pf-icon-btn"
                onClick={() => setShowMenu((v) => !v)}
                aria-label="Post options"
              >
                ⋯
              </button>
              {showMenu && (
                <div className="pf-dropdown">
                  {post.username !== currentUser && (
                    <button
                      className="pf-dropdown-item"
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent("openMessages", {
                            detail: { username: post.username },
                          }),
                        );
                        setShowMenu(false);
                      }}
                    >
                      ✉️ Message {post.username}
                    </button>
                  )}
                  {post.username === currentUser && (
                    <button className="pf-dropdown-item" onClick={startEdit}>
                      ✏️ Edit post
                    </button>
                  )}
                  {post.username === currentUser && (
                    <button
                      className="pf-dropdown-item pf-dropdown-danger"
                      onClick={() => {
                        onDelete(post.id);
                        setShowMenu(false);
                      }}
                    >
                      🗑️ Delete post
                    </button>
                  )}
                  {post.username !== currentUser && (
                    <button
                      className="pf-dropdown-item pf-dropdown-danger"
                      onClick={handleReportClick}
                    >
                      🚩 Report post
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Body / Edit mode ── */}
        {isEditing ? (
          <div className="pf-card-body">
            <div style={{ position: "relative" }}>
              <textarea
                className="pf-composer-input"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={3}
                placeholder="Edit your post…"
              />
              <div className="pf-attach-wrap" style={{ marginTop: "6px" }}>
                <button
                  type="button"
                  className="pf-attach-btn"
                  title="Emoji"
                  onClick={() => setShowEditEmoji((v) => !v)}
                >
                  🙂
                </button>
                {showEditEmoji && (
                  <EmojiPicker
                    onSelect={(emoji) => setEditText((t) => t + emoji)}
                    onClose={() => setShowEditEmoji(false)}
                  />
                )}
              </div>
            </div>

            {editImages.length > 0 && (
              <div className="pf-edit-images-grid">
                {editImages.map((url, idx) => (
                  <div className="pf-img-preview-wrap" key={idx}>
                    <img src={url} alt={`Image ${idx + 1}`} />
                    <button
                      className="pf-edit-image-remove"
                      onClick={() => removeEditImage(idx)}
                      aria-label="Remove image"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: "10px" }}>
              <select
                className="pf-privacy-select"
                value={editPrivacy}
                onChange={(e) => setEditPrivacy(e.target.value)}
              >
                {PRIVACY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.icon} {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="pf-edit-actions">
              <button
                className="pf-edit-cancel-btn"
                onClick={cancelEdit}
                disabled={savingEdit}
              >
                Cancel
              </button>
              <button
                className="pf-post-btn"
                onClick={saveEdit}
                disabled={
                  savingEdit || (!editText.trim() && editImages.length === 0)
                }
              >
                {savingEdit ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        ) : (
          <div className="pf-card-body">
            {post.text && (
              <p className="pf-card-text">
                <ExpandableText text={post.text} maxChars={220} />
              </p>
            )}

            {/* CHANGED: ImageCarousel → ImageGrid. Multi-image (and
                single-image, via image_urls) posts now render as a
                Facebook-style collage in the feed instead of a
                one-at-a-time carousel — tapping any tile opens
                PhotoViewer at that tile's index. */}
            {post.image_urls && post.image_urls.length > 0 ? (
              <ImageGrid
                images={post.image_urls}
                onOpenViewer={(startIndex) =>
                  setPhotoViewerData({ images: post.image_urls, startIndex })
                }
              />
            ) : post.image_url ? (
              <img
                src={post.image_url}
                alt="Post"
                className="pf-card-image"
                loading="lazy"
                onClick={() =>
                  setPhotoViewerData({ images: [post.image_url], startIndex: 0 })
                }
                style={{ cursor: "zoom-in" }}
              />
            ) : (
              post.video_url && <PostVideo src={post.video_url} />
            )}

            {post.link && (
              <a
                href={post.link.url}
                target="_blank"
                rel="noreferrer"
                className="pf-link-preview"
              >
                {post.link.image && (
                  <img
                    src={post.link.image}
                    alt=""
                    className="pf-link-image"
                    loading="lazy"
                  />
                )}
                <div className="pf-link-bar" />
                <div className="pf-link-body">
                  <p className="pf-link-domain">{post.link.domain}</p>
                  <p className="pf-link-title">{post.link.title}</p>
                  <p className="pf-link-desc">{post.link.desc}</p>
                </div>
              </a>
            )}
          </div>
        )}

        {/* ── Reaction summary ──
            CHANGED: this row used to be wrapped in `totalReactions > 0`,
            which meant the comment-count button (on the same row) also
            disappeared whenever a post had comments but zero likes — the
            two counts were accidentally coupled together. Now the row
            always renders per post, and the like-count/comment-count
            each show independently — a post can display "0 Likes" next
            to "3 comments" (or vice versa) instead of hiding one because
            the other is zero.

            NEW: view count now sits alongside the comment-count button,
            on the right side of the row, showing total views for this
            post — same 👁 formatting used on the homepage's video/reel
            cards. */}
        {!isEditing && (
          <div className="pf-reaction-summary">
            <div className="pf-reaction-emojis">
              {totalReactions > 0 &&
                Object.entries(post.reactionCounts || {})
                  .filter(([, v]) => v > 0)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3)
                  .map(([k]) => {
                    const r = REACTIONS.find((x) => x.key === k);
                    return r ? <span key={k}>{r.emoji}</span> : null;
                  })}
              <span className="pf-reaction-count pf-count-pop" key={countPopKey}>
                {totalReactions} {totalReactions === 1 ? "Like" : "Likes"}
              </span>
            </div>
            <div className="pf-reaction-summary-right">
              <span className="pf-view-count">👁 {formatViews(viewCount)}</span>
              <button
                className="pf-text-btn"
                onClick={() => onToggleComments(post.id)}
              >
                {totalComments} comment{totalComments !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        )}

        {/* ── Action bar ── */}
        {!isEditing && (
          <div className="pf-action-bar">
            {/* Like */}
            <div className="pf-action-wrap" ref={pickerRef}>
              <button
                className={`pf-action-btn ${post.myReaction ? "pf-action-active" : ""}`}
                style={myReact ? { color: myReact.color } : {}}
                onClick={() => {
                  if (!currentUser || currentUser === "anonymous") {
                    window.dispatchEvent(new CustomEvent("openLogin"));
                    return;
                  }
                  if (post.myReaction) onReaction(post.id, post.myReaction);
                  else {
                    onReaction(post.id, "like");
                  }
                }}
                onMouseEnter={() => {
                  if (currentUser && currentUser !== "anonymous")
                    setShowPicker(true);
                }}
              >
                <span className="pf-action-icon pf-icon-pop" key={likePopKey}>
                  {myReact ? myReact.emoji : "👍"}
                </span>
                <span>{myReact ? myReact.label : "Like"}</span>
              </button>

              {/* Signature moment: a small particle burst radiating from
                  the Like button the instant a reaction lands, echoing
                  the tactile "pop" of a physical button press. */}
              {burstKey !== null && (
                <span
                  className="pf-like-burst"
                  key={burstKey}
                  style={{ "--pf-burst-color": myReact?.color || "var(--zx-primary)" }}
                >
                  {Array.from({ length: 8 }).map((_, i) => (
                    <span key={i} />
                  ))}
                </span>
              )}

              {showPicker && (
                <div
                  className="pf-reaction-picker"
                  onMouseLeave={() => setShowPicker(false)}
                >
                  {REACTIONS.map((r) => (
                    <button
                      key={r.key}
                      className="pf-reaction-pick-btn"
                      title={r.label}
                      onClick={() => {
                        onReaction(post.id, r.key);
                        setShowPicker(false);
                      }}
                    >
                      {r.emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Comment */}
            <button
              className="pf-action-btn"
              onClick={() => {
                if (!currentUser || currentUser === "anonymous") {
                  window.dispatchEvent(new CustomEvent("openLogin"));
                  return;
                }
                setCommentBounceKey((k) => k + 1);
                onToggleComments(post.id);
              }}
            >
              <span className="pf-action-icon pf-comment-bounce" key={commentBounceKey}>
                💬
              </span>
              <span>Comment</span>
            </button>

            {/* Share */}
            <div className="pf-action-wrap" ref={shareRef}>
              <button className="pf-action-btn" onClick={handleShareClick}>
                <span className="pf-action-icon pf-share-icon">🔁</span>
                <span>Share</span>
              </button>
              {showShareMenu && (
                <div className="pf-dropdown pf-dropdown-up">
                  <button
                    className="pf-dropdown-item"
                    onClick={() => {
                      onShare(post.id);
                      setShowShareMenu(false);
                    }}
                  >
                    📢 Share to feed
                  </button>
                  <button className="pf-dropdown-item" onClick={handleCopyLink}>
                    {copied ? "✅ Copied!" : "🔗 Copy link"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Comments ── */}
        {!isEditing && post.showComments && (
          <div className="pf-comments-section">
            {(post.comments || []).map((c) => {
              // NEW: per-comment like/dislike state. liked_by and
              // disliked_by are text[] columns on post_comments (see
              // migration note) holding the usernames who've liked /
              // disliked this comment. The two are mutually exclusive
              // per-user, enforced server-side in handleCommentReaction.
              const likedBy = c.liked_by || [];
              const dislikedBy = c.disliked_by || [];
              const iLikedComment = likedBy.includes(currentUser);
              const iDislikedComment = dislikedBy.includes(currentUser);

              return (
                <div className="pf-comment" key={c.id}>
                  <Link
                    to={`/user/${c.username}`}
                    className="pf-avatar pf-avatar-sm pf-avatar-amber pf-avatar-link"
                    title={`View ${c.username}'s profile`}
                  >
                    {(c.username || "?").slice(0, 2).toUpperCase()}
                  </Link>
                  <div className="pf-comment-bubble">
                    <div className="pf-comment-bubble-header">
                      <Link
                        to={`/user/${c.username}`}
                        className="pf-comment-author-link"
                      >
                        <p className="pf-comment-author">{c.username}</p>
                      </Link>
                      {c.created_at && (
                        <span className="pf-comment-time">
                          {timeAgo(c.created_at)}
                        </span>
                      )}
                    </div>
                    <p className="pf-comment-text">{c.text}</p>

                    {/* NEW: Like + Dislike actions with counts for this comment */}
                    <div className="pf-comment-actions">
                      <button
                        className={`pf-comment-like-btn ${
                          iLikedComment ? "pf-comment-like-active" : ""
                        }`}
                        onClick={() =>
                          handleCommentReactionClick(c.id, onLikeComment)
                        }
                      >
                        👍 Like
                      </button>
                      {likedBy.length > 0 && (
                        <span className="pf-comment-like-count">
                          {likedBy.length}
                        </span>
                      )}

                      <button
                        className={`pf-comment-dislike-btn ${
                          iDislikedComment ? "pf-comment-dislike-active" : ""
                        }`}
                        onClick={() =>
                          handleCommentReactionClick(c.id, onDislikeComment)
                        }
                      >
                        👎 Dislike
                      </button>
                      {dislikedBy.length > 0 && (
                        <span className="pf-comment-like-count">
                          {dislikedBy.length}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="pf-comment-input-row">
              <div className="pf-avatar pf-avatar-sm">
                {currentUser.slice(0, 2).toUpperCase()}
              </div>
              <input
                className="pf-comment-input"
                placeholder={
                  !currentUser || currentUser === "anonymous"
                    ? "Login to comment…"
                    : "Write a comment… (Enter to send)"
                }
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={handleCommentSubmit}
                disabled={!currentUser || currentUser === "anonymous"}
                style={
                  !currentUser || currentUser === "anonymous"
                    ? { opacity: 0.5, cursor: "not-allowed" }
                    : {}
                }
              />
              <div className="pf-attach-wrap">
                <button
                  type="button"
                  className="pf-attach-btn"
                  title="Emoji"
                  disabled={!currentUser || currentUser === "anonymous"}
                  onClick={() => setShowCommentEmoji((v) => !v)}
                >
                  🙂
                </button>
                {showCommentEmoji && (
                  <EmojiPicker
                    onSelect={(emoji) => setCommentText((t) => t + emoji)}
                    onClose={() => setShowCommentEmoji(false)}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PostCard;