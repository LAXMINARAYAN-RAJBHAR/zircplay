import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import EmojiPicker from "./EmojiPicker";
import ExpandableText from "../../Component/ExpandableText/ExpandableText";
import ReportPostModal from "./ReportPostModal";
// CHANGED: Lightbox (view-only zoom/swipe) replaced with PhotoViewer,
// which adds per-photo like/comment/share/copy-link on top of the same
// full-screen swipe experience. See PhotoViewer.jsx.
import PhotoViewer from "./PhotoViewer";
// NEW: generic content-report modal (contentType/contentId/contentTitle/
// contentOwner/onClose), same component already used by Video.jsx and
// Reels.jsx for reel/video/comment reports. ReportPostModal above stays
// dedicated to post-level reports; this one is only used for individual
// comment reports (see the kebab menu below).
import ReportModal from "../../Component/Moderation/ReportModal";
// Connect button on each post's header — same "connections" table
// used by the Connect button on Video.jsx / Reels.jsx (see
// subscriptions_to_connections_migration.sql and the later
// connection_request_migration.sql that added the pending/accepted
// status column).
import { supabase } from "../../config/supabase";

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

// ── Comment translate stub — same as Reels.jsx / Video.jsx. NOT a real
// translation service, just a small word-swap dictionary so "Translate
// to Hindi" does something visible. Swap the body of this function for
// a real API call later without touching any call sites.
const HINDI_STUB_DICT = {
  hello: "नमस्ते", hi: "नमस्ते", love: "प्यार", you: "तुम", beautiful: "खूबसूरत",
  nice: "अच्छा", good: "अच्छा", great: "शानदार", awesome: "बहुत बढ़िया",
  thanks: "धन्यवाद", thank: "धन्यवाद", amazing: "अद्भुत", wow: "वाह",
  song: "गाना", dance: "नृत्य", video: "वीडियो", congratulations: "बधाई हो",
  congrats: "बधाई हो", happy: "खुश", cute: "प्यारा", pretty: "सुंदर",
};
const stubTranslateToHindi = (text) => {
  if (!text) return text;
  const translated = text.replace(/[A-Za-z']+/g, (word) => {
    const hit = HINDI_STUB_DICT[word.toLowerCase()];
    return hit || word;
  });
  return translated === text ? `${text} (डेमो अनुवाद उपलब्ध नहीं)` : translated;
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
   COMMENT ROW — used for both top-level comments and their (one level
   deep) replies. Renders the kebab menu (Share/Report/Save), the
   existing Like/Dislike actions, a Reply button (top-level only), and
   the Translate-to-Hindi toggle. Mirrors ReelCommentRow / VideoCommentRow
   in Reels.jsx / Video.jsx.
───────────────────────────────────────── */
const PostCommentRow = ({
  comment,
  currentUser,
  isReply,
  isTranslated,
  isMenuOpen,
  onToggleMenu,
  onLike,
  onDislike,
  onSave,
  onShare,
  onReport,
  onToggleTranslate,
  onReplyClick,
}) => {
  const likedBy = comment.liked_by || [];
  const dislikedBy = comment.disliked_by || [];
  const savedBy = comment.saved_by || [];
  const iLikedComment = likedBy.includes(currentUser);
  const iDislikedComment = dislikedBy.includes(currentUser);
  const iSaved = savedBy.includes(currentUser);
  const displayText = isTranslated
    ? stubTranslateToHindi(comment.text)
    : comment.text;

  return (
    <div className={`pf-comment${isReply ? " pf-comment--reply" : ""}`}>
      <Link
        to={`/user/${comment.username}`}
        className="pf-avatar pf-avatar-sm pf-avatar-amber pf-avatar-link"
        title={`View ${comment.username}'s profile`}
      >
        {(comment.username || "?").slice(0, 2).toUpperCase()}
      </Link>
      <div className="pf-comment-bubble">
        <div className="pf-comment-bubble-header">
          <Link
            to={`/user/${comment.username}`}
            className="pf-comment-author-link"
          >
            <p className="pf-comment-author">{comment.username}</p>
          </Link>
          <div className="pf-comment-header-right">
            {comment.created_at && (
              <span className="pf-comment-time">{timeAgo(comment.created_at)}</span>
            )}
            <div className="pf-comment-menu-wrap">
              <span className="pf-comment-menu-btn" onClick={onToggleMenu}>⋯</span>
              {isMenuOpen && (
                <div className="pf-comment-dropdown">
                  <div className="pf-comment-dropdown-item" onClick={onShare}>
                    ↪ Share
                  </div>
                  <div className="pf-comment-dropdown-item" onClick={onReport}>
                    🚩 Report
                  </div>
                  <div className="pf-comment-dropdown-item" onClick={onSave}>
                    {iSaved ? "🔖 Unsave" : "🔖 Save"}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="pf-comment-text">{displayText}</p>

        {/* Like + Dislike actions with counts, plus Reply (top-level
            only) and the Translate toggle. */}
        <div className="pf-comment-actions">
          <button
            className={`pf-comment-like-btn ${
              iLikedComment ? "pf-comment-like-active" : ""
            }`}
            onClick={onLike}
          >
            👍 Like
          </button>
          {likedBy.length > 0 && (
            <span className="pf-comment-like-count">{likedBy.length}</span>
          )}

          <button
            className={`pf-comment-dislike-btn ${
              iDislikedComment ? "pf-comment-dislike-active" : ""
            }`}
            onClick={onDislike}
          >
            👎 Dislike
          </button>
          {dislikedBy.length > 0 && (
            <span className="pf-comment-like-count">{dislikedBy.length}</span>
          )}

          {!isReply && (
            <button className="pf-comment-reply-btn" onClick={onReplyClick}>
              Reply
            </button>
          )}

          <button className="pf-comment-translate-btn" onClick={onToggleTranslate}>
            {isTranslated ? "Show original" : "Translate to Hindi"}
          </button>
        </div>
      </div>
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
  onLikeComment, // like/unlike a single comment
  onDislikeComment, // dislike/undislike a single comment
  onSaveComment, // NEW: (postId, commentId) => void — kebab menu "Save"
  viewCount = 0, // this post's total view count, from PostFeed's viewCounts map
  onView, // (postId) => void — called once per mount when the card scrolls into view
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

  // NEW: per-comment feature state — kebab menu, one-level replies, and
  // the translate-to-Hindi toggle (per comment id). Mirrors Reels.jsx /
  // Video.jsx.
  const [commentMenuOpenId, setCommentMenuOpenId] = useState(null);
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [translatedCommentIds, setTranslatedCommentIds] = useState(
    () => new Set(),
  );
  const [reportCommentTarget, setReportCommentTarget] = useState(null);
  const [commentShareToast, setCommentShareToast] = useState(false);
  const [commentSavedToast, setCommentSavedToast] = useState(false);

  // Connect button state — mirrors the same three-state flow used in
  // Video.jsx and Reels.jsx, against the same "connections" table.
  // connectionStatus is null (no relationship / never requested),
  // "pending" (a request is outstanding — either direction), or
  // "accepted" (both sides can message each other). Requesting a
  // connection no longer notifies via a client-side call — the
  // notify_on_subscribe DB trigger owns "wants to connect" notifications
  // on insert, and notify_on_connect_accept owns "accepted your request"
  // notifications on the status update, so this component never calls
  // notifyUser() for Connect anymore (that previously duplicated the
  // trigger's own notification, same issue we hit with likes/comments).
  const [connectionStatus, setConnectionStatus] = useState(null);
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

  // NEW: unique per-mount suffix for this card's connection-status
  // realtime channel (see the connection useEffect below). Supabase's
  // client REUSES a channel object whenever `.channel(name)` is called
  // with a name that's already subscribed elsewhere — so without this,
  // two posts from the same author both showing in the feed would build
  // the identical channel name (same viewer + same author), and the
  // second card's `.on()` call would land on the first card's
  // already-subscribed channel, crashing with "cannot add
  // postgres_changes callbacks ... after subscribe()". A random
  // per-instance suffix guarantees every mounted PostCard gets its own
  // channel even when several reference the same (viewer, author) pair.
  const channelInstanceIdRef = useRef(Math.random().toString(36).slice(2));

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

  // Load whether the current user has a connection (of any status) with
  // this post's author. Skipped entirely for the author's own posts,
  // since the button never renders there anyway — same early-return
  // shape as Reels.jsx / Video.jsx's connection loaders. Reads `status`
  // so the button can render its three states (Connect / Requested /
  // ✓ Connected) instead of just on/off.
  useEffect(() => {
    if (!post.username || post.username === currentUser) return;
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    const loadConnection = async () => {
      const { data, error } = await supabase
        .from("connections")
        .select("id, status")
        .match({ connector_id: userId, connected_to: post.username })
        .maybeSingle();
      if (error) console.error("loadConnection error:", error);
      setConnectionStatus(data?.status || null);
    };
    loadConnection();

    // FIX: keep connectionStatus in sync when the other person accepts
    // or declines from elsewhere (the bell dropdown or /notifications
    // page) while this card is already mounted. Previously this effect
    // only ever fetched once on mount, so the button stayed stuck on
    // "Requested" indefinitely — nothing here ever re-queried the
    // connections table until a full page reload re-ran loadConnection.
    //
    // Realtime filters can only match a single column server-side, so
    // this subscribes on connector_id (always this viewer's own userId
    // — set at insert time in handleConnect below) and then narrows to
    // this specific post's author client-side — matches the per-user
    // channel-scoping pattern already used in Navbar.jsx / Video.jsx /
    // Reels.jsx.
    const channel = supabase
      .channel(
        `postcard-connection-${userId}-${post.username}-${channelInstanceIdRef.current}`,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "connections",
          filter: `connector_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.eventType === "DELETE" ? payload.old : payload.new;
          if (row?.connected_to !== post.username) return;
          setConnectionStatus(
            payload.eventType === "DELETE" ? null : payload.new?.status || null,
          );
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [post.username, currentUser]);

  // Connect / Withdraw-Disconnect — unified with Reels.jsx / Video.jsx:
  //   • self-connect guard
  //   • optimistic flip with rollback on failure
  //   • connector_username included on insert
  //   • inserts as status: "pending" — a fresh Connect click no longer
  //     connects instantly, it sends a request the other person must
  //     accept (see the Notifications page's Accept/Decline actions)
  //   • clicking again while "pending" or "accepted" withdraws the
  //     request / disconnects, same delete path either way
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
    if (userId === post.username) return; // self-connect guard
    if (connectLoading) return;

    const wasStatus = connectionStatus; // null | "pending" | "accepted"
    setConnectLoading(true);

    try {
      if (wasStatus) {
        // Withdraw a pending request, or disconnect an accepted one.
        setConnectionStatus(null);
        const { error } = await supabase
          .from("connections")
          .delete()
          .match({ connector_id: userId, connected_to: post.username });
        if (error) {
          console.error("handleConnect delete error:", error);
          setConnectionStatus(wasStatus); // rollback
        }
      } else {
        setConnectionStatus("pending");
        const { error } = await supabase.from("connections").insert({
          connector_id: userId,
          connector_username: currentUser,
          connected_to: post.username,
          status: "pending",
        });
        if (error) {
          console.error("handleConnect insert error:", error);
          setConnectionStatus(null); // rollback
        }
        // No notifyUser() call here — the notify_on_subscribe DB
        // trigger sends the "wants to connect" notification on this
        // insert, so a client-side call would duplicate it.
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

  // NEW: submit a one-level-deep reply to a top-level comment. Same
  // onComment callback as a fresh comment, just with the parent's id as
  // the third argument (see PostFeed.jsx's handleComment).
  const handleReplySubmit = (parentId) => {
    if (!replyText.trim()) return;
    onComment(post.id, replyText, parentId);
    setReplyText("");
    setReplyingToId(null);
  };

  const handleCopyLink = () => {
    const shareUrl = `https://zixplon.in/api/og?type=post&id=${post.id}`;
    navigator.clipboard?.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowShareMenu(false);
  };

  // NEW: kebab menu "Share" action for an individual comment — copies a
  // link back to this post with the comment's id tagged on, same shape
  // as the post-level Share/Copy link.
  const handleShareComment = (comment) => {
    const shareUrl = `https://zixplon.in/api/og?type=post&id=${post.id}&comment=${comment.id}`;
    navigator.clipboard?.writeText(shareUrl).catch(() => {});
    setCommentMenuOpenId(null);
    setCommentShareToast(true);
    setTimeout(() => setCommentShareToast(false), 2000);
  };

  // NEW: kebab menu "Save" action for an individual comment — delegates
  // the actual state update + Supabase write up to PostFeed via the
  // passed-in onSaveComment callback, same delegation pattern already
  // used for onLikeComment/onDislikeComment.
  const handleSaveCommentClick = (comment) => {
    if (!currentUser || currentUser === "anonymous") {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    onSaveComment?.(post.id, comment.id);
    setCommentMenuOpenId(null);
    const isSaved = (comment.saved_by || []).includes(currentUser);
    if (!isSaved) {
      setCommentSavedToast(true);
      setTimeout(() => setCommentSavedToast(false), 1800);
    }
  };

  // NEW: per-comment translate toggle, backed by the stub dictionary
  // near the top of this file.
  const toggleTranslate = (commentId) => {
    setTranslatedCommentIds((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
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

  // NEW: kebab menu "Report" action for an individual comment.
  const handleReportCommentClick = (comment) => {
    if (!currentUser || currentUser === "anonymous") {
      window.dispatchEvent(new CustomEvent("openLogin"));
      setCommentMenuOpenId(null);
      return;
    }
    setReportCommentTarget(comment);
    setCommentMenuOpenId(null);
  };

  const connectLabel =
    connectionStatus === "accepted"
      ? "✓ Connected"
      : connectionStatus === "pending"
        ? "Requested"
        : "Connect";

  // NEW: build the top-level/reply comment tree. Top-level comments
  // (parent_comment_id null) are reversed for newest-first display;
  // each thread's replies stay in their natural chronological order
  // (post.comments is already sorted ascending in PostFeed's
  // enrichPost).
  const allComments = post.comments || [];
  const topLevelComments = [...allComments]
    .filter((c) => !c.parent_comment_id)
    .reverse();
  const repliesFor = (parentId) =>
    allComments.filter((c) => c.parent_comment_id === parentId);

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

      {/* NEW: reporting an individual comment — reuses the same generic
          ReportModal used by Video.jsx / Reels.jsx, pointed at
          contentType "comment". */}
      {reportCommentTarget && (
        <ReportModal
          contentType="comment"
          contentId={reportCommentTarget.id}
          contentTitle={reportCommentTarget.text?.slice(0, 80) || "Comment"}
          contentOwner={reportCommentTarget.username}
          onClose={() => setReportCommentTarget(null)}
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
              className={`pf-connect-btn ${
                connectionStatus === "accepted" ? "pf-connect-btn--connected" : ""
              } ${connectionStatus === "pending" ? "pf-connect-btn--pending" : ""}`}
              onClick={handleConnect}
              disabled={connectLoading}
            >
              {connectLabel}
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
                  {/* CHANGED: the Message action now only shows once the
                      connection is actually accepted — messaging an
                      unconnected or still-pending user isn't offered
                      from here anymore. MessagesPanel itself still
                      allows starting a fresh conversation as a message
                      request via its inbox search, independent of the
                      Connect system — this only gates the shortcut on
                      the post card. */}
                  {post.username !== currentUser &&
                    connectionStatus === "accepted" && (
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
            {commentShareToast && (
              <div className="pf-comment-toast">🔗 Link copied</div>
            )}
            {commentSavedToast && (
              <div className="pf-comment-toast">🔖 Comment saved</div>
            )}

            {topLevelComments.length === 0 ? (
              <p className="pf-comment-empty">No comments yet. Be the first!</p>
            ) : (
              topLevelComments.map((c) => (
                <div className="pf-comment-thread" key={c.id}>
                  <PostCommentRow
                    comment={c}
                    currentUser={currentUser}
                    isReply={false}
                    isTranslated={translatedCommentIds.has(c.id)}
                    isMenuOpen={commentMenuOpenId === c.id}
                    onToggleMenu={() =>
                      setCommentMenuOpenId((v) => (v === c.id ? null : c.id))
                    }
                    onLike={() => handleCommentReactionClick(c.id, onLikeComment)}
                    onDislike={() =>
                      handleCommentReactionClick(c.id, onDislikeComment)
                    }
                    onSave={() => handleSaveCommentClick(c)}
                    onShare={() => handleShareComment(c)}
                    onReport={() => handleReportCommentClick(c)}
                    onToggleTranslate={() => toggleTranslate(c.id)}
                    onReplyClick={() =>
                      setReplyingToId((v) => (v === c.id ? null : c.id))
                    }
                  />

                  {replyingToId === c.id && (
                    <div className="pf-reply-input-row">
                      <div className="pf-avatar pf-avatar-sm">
                        {(currentUser || "?").slice(0, 2).toUpperCase()}
                      </div>
                      <input
                        className="pf-comment-input"
                        placeholder={`Reply to ${c.username}…`}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleReplySubmit(c.id);
                          }
                        }}
                        autoFocus
                      />
                    </div>
                  )}

                  {repliesFor(c.id).map((r) => (
                    <PostCommentRow
                      key={r.id}
                      comment={r}
                      currentUser={currentUser}
                      isReply
                      isTranslated={translatedCommentIds.has(r.id)}
                      isMenuOpen={commentMenuOpenId === r.id}
                      onToggleMenu={() =>
                        setCommentMenuOpenId((v) => (v === r.id ? null : r.id))
                      }
                      onLike={() => handleCommentReactionClick(r.id, onLikeComment)}
                      onDislike={() =>
                        handleCommentReactionClick(r.id, onDislikeComment)
                      }
                      onSave={() => handleSaveCommentClick(r)}
                      onShare={() => handleShareComment(r)}
                      onReport={() => handleReportCommentClick(r)}
                      onToggleTranslate={() => toggleTranslate(r.id)}
                      onReplyClick={() => setReplyingToId(c.id)}
                    />
                  ))}
                </div>
              ))
            )}

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