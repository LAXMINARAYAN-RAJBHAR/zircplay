import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import EmojiPicker from "./EmojiPicker";
import ExpandableText from "../../Component/ExpandableText/ExpandableText";
import ReportPostModal from "./ReportPostModal";

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
        controlsList="nodownload noplaybackrate nofullscreen"
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
   LIGHTBOX — click-to-zoom + touch swipe
───────────────────────────────────────── */
const Lightbox = ({ images, startIndex = 0, onClose }) => {
  const [index, setIndex] = useState(startIndex);
  const [autoPlay, setAutoPlay] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const startXRef = useRef(0);
  const dragXRef = useRef(0);

  const next = (e) => {
    e?.stopPropagation();
    setIndex((i) => (i + 1) % images.length);
  };

  const prev = (e) => {
    e?.stopPropagation();
    setIndex((i) => (i - 1 + images.length) % images.length);
  };

  useEffect(() => {
    setZoomed(false);
  }, [index]);

  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [autoPlay, images.length]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === " ") {
        e.preventDefault();
        setAutoPlay((a) => !a);
      }
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, images.length]);

  const handleTouchStart = (e) => {
    startXRef.current = e.touches[0].clientX;
    dragXRef.current = 0;
  };
  const handleTouchMove = (e) => {
    if (zoomed) return;
    dragXRef.current = e.touches[0].clientX - startXRef.current;
  };
  const handleTouchEnd = () => {
    if (zoomed) return;
    const dx = dragXRef.current;
    if (dx < -50) next();
    else if (dx > 50) prev();
    dragXRef.current = 0;
  };

  return (
    <div
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.92)",
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "zoom-out",
        overflow: "hidden",
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: "absolute",
          top: "16px",
          right: "20px",
          background: "rgba(255,255,255,0.1)",
          border: "none",
          color: "white",
          fontSize: "24px",
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
          zIndex: 2,
        }}
      >
        ✕
      </button>

      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setAutoPlay((a) => !a);
          }}
          aria-label={autoPlay ? "Pause slideshow" : "Play slideshow"}
          style={{
            position: "absolute",
            top: "16px",
            right: "70px",
            background: "rgba(255,255,255,0.1)",
            border: "none",
            color: "white",
            fontSize: "18px",
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
            zIndex: 2,
          }}
        >
          {autoPlay ? "⏸" : "▶"}
        </button>
      )}

      {images.length > 1 && !zoomed && (
        <>
          <button
            onClick={prev}
            aria-label="Previous image"
            style={{
              position: "absolute",
              left: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.1)",
              border: "none",
              color: "white",
              fontSize: "28px",
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              zIndex: 1,
            }}
          >
            ‹
          </button>

          <button
            onClick={next}
            aria-label="Next image"
            style={{
              position: "absolute",
              right: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.1)",
              border: "none",
              color: "white",
              fontSize: "28px",
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              zIndex: 1,
            }}
          >
            ›
          </button>
        </>
      )}

      <img
        src={images[index]}
        alt={`Image ${index + 1}`}
        onClick={(e) => {
          e.stopPropagation();
          setZoomed((z) => !z);
        }}
        style={{
          maxWidth: zoomed ? "none" : "92vw",
          maxHeight: zoomed ? "none" : "90vh",
          objectFit: "contain",
          borderRadius: "8px",
          boxShadow: "0 8px 48px rgba(0,0,0,0.8)",
          cursor: zoomed ? "zoom-out" : "zoom-in",
          transform: zoomed ? "scale(1.8)" : "scale(1)",
          transition: "transform 0.25s ease",
        }}
      />

      {images.length > 1 && !zoomed && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            bottom: "60px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "8px",
          }}
        >
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Go to image ${i + 1}`}
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                border: "none",
                cursor: "pointer",
                padding: 0,
                background: i === index ? "#ffffff" : "rgba(255,255,255,0.35)",
                transition: "background 0.2s",
              }}
            />
          ))}
        </div>
      )}

      {images.length > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            color: "white",
            fontSize: "14px",
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 700,
            background: "rgba(255,255,255,0.1)",
            padding: "4px 12px",
            borderRadius: "12px",
          }}
        >
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────
   IMAGE CAROUSEL
───────────────────────────────────────── */
const ImageCarousel = ({ images, onOpenLightbox }) => {
  const [idx, setIdx] = useState(0);
  const trackRef = useRef();
  const startXRef = useRef(0);
  const dragXRef = useRef(0);
  const isDraggingRef = useRef(false);

  const goTo = (i) => {
    const next = (i + images.length) % images.length;
    setIdx(next);
    if (trackRef.current) {
      trackRef.current.style.transition = "transform 0.3s ease";
      trackRef.current.style.transform = `translateX(-${next * 100}%)`;
    }
  };

  const applyDrag = (dx) => {
    if (trackRef.current) {
      trackRef.current.style.transition = "none";
      trackRef.current.style.transform = `translateX(calc(-${idx * 100}% + ${dx}px))`;
    }
  };

  const onMouseDown = (e) => {
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    dragXRef.current = 0;
  };

  const onMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    dragXRef.current = e.clientX - startXRef.current;
    applyDrag(dragXRef.current);
  };

  const onMouseUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const dx = dragXRef.current;
    if (dx < -50) goTo(idx + 1);
    else if (dx > 50) goTo(idx - 1);
    else goTo(idx);
  };

  const onTouchStart = (e) => {
    startXRef.current = e.touches[0].clientX;
    dragXRef.current = 0;
  };

  const onTouchMove = (e) => {
    dragXRef.current = e.touches[0].clientX - startXRef.current;
    applyDrag(dragXRef.current);
  };

  const onTouchEnd = () => {
    const dx = dragXRef.current;
    if (dx < -50) goTo(idx + 1);
    else if (dx > 50) goTo(idx - 1);
    else goTo(idx);
  };

  const handleClick = () => {
    if (Math.abs(dragXRef.current) < 8) {
      onOpenLightbox(idx);
    }
  };

  return (
    <div
      className="pf-carousel-wrap"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={handleClick}
    >
      <div className="pf-carousel-track" ref={trackRef}>
        {images.map((url, i) => (
          <div className="pf-carousel-slide" key={i}>
            <img
              src={url}
              alt={`Image ${i + 1}`}
              loading="lazy"
              draggable={false}
            />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <>
          <span className="pf-carousel-counter">
            {idx + 1} / {images.length}
          </span>

          <button
            className="pf-carousel-arrow pf-carousel-arrow-l"
            onClick={(e) => {
              e.stopPropagation();
              goTo(idx - 1);
            }}
            aria-label="Previous image"
          >
            ‹
          </button>
          <button
            className="pf-carousel-arrow pf-carousel-arrow-r"
            onClick={(e) => {
              e.stopPropagation();
              goTo(idx + 1);
            }}
            aria-label="Next image"
          >
            ›
          </button>

          <div className="pf-carousel-dots">
            {images.map((_, i) => (
              <button
                key={i}
                className={`pf-carousel-dot${i === idx ? " active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(i);
                }}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
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
}) => {
  const [commentText, setCommentText] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lightboxData, setLightboxData] = useState(null);
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

  const pickerRef = useRef();
  const shareRef = useRef();
  const menuRef = useRef();

  const navigate = useNavigate();

  const initials = (post.username || "?").slice(0, 2).toUpperCase();
  const totalReactions = Object.values(post.reactionCounts || {}).reduce(
    (a, b) => a + b,
    0,
  );
  const myReact = REACTIONS.find((r) => r.key === post.myReaction);

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

  return (
    <>
      {lightboxData && (
        <Lightbox
          images={lightboxData.images}
          startIndex={lightboxData.startIndex}
          onClose={() => setLightboxData(null)}
        />
      )}

      {showReportModal && (
        <ReportPostModal
          post={post}
          onClose={() => setShowReportModal(false)}
          onReport={onReport}
        />
      )}

      <div className="pf-card">
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

            {post.image_urls && post.image_urls.length > 0 ? (
              <ImageCarousel
                images={post.image_urls}
                onOpenLightbox={(startIndex) =>
                  setLightboxData({ images: post.image_urls, startIndex })
                }
              />
            ) : post.image_url ? (
              <img
                src={post.image_url}
                alt="Post"
                className="pf-card-image"
                loading="lazy"
                onClick={() =>
                  setLightboxData({ images: [post.image_url], startIndex: 0 })
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

        {/* ── Reaction summary ── */}
        {!isEditing && totalReactions > 0 && (
          <div className="pf-reaction-summary">
            <div className="pf-reaction-emojis">
              {Object.entries(post.reactionCounts || {})
                .filter(([, v]) => v > 0)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([k]) => {
                  const r = REACTIONS.find((x) => x.key === k);
                  return r ? <span key={k}>{r.emoji}</span> : null;
                })}
              <span className="pf-reaction-count">{totalReactions}</span>
            </div>
            <button
              className="pf-text-btn"
              onClick={() => onToggleComments(post.id)}
            >
              {post.comments?.length || 0} comment
              {post.comments?.length !== 1 ? "s" : ""}
            </button>
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
                  else setShowPicker((v) => !v);
                }}
                onMouseEnter={() => {
                  if (currentUser && currentUser !== "anonymous")
                    setShowPicker(true);
                }}
              >
                {myReact ? myReact.emoji : "👍"}
                <span>{myReact ? myReact.label : "Like"}</span>
              </button>
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
                onToggleComments(post.id);
              }}
            >
              💬 <span>Comment</span>
            </button>

            {/* Share */}
            <div className="pf-action-wrap" ref={shareRef}>
              <button className="pf-action-btn" onClick={handleShareClick}>
                🔁 <span>Share</span>
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
            {(post.comments || []).map((c) => (
              <div className="pf-comment" key={c.id}>
                <Link
                  to={`/user/${c.username}`}
                  className="pf-avatar pf-avatar-sm pf-avatar-amber pf-avatar-link"
                  title={`View ${c.username}'s profile`}
                >
                  {(c.username || "?").slice(0, 2).toUpperCase()}
                </Link>
                <div className="pf-comment-bubble">
                  <Link
                    to={`/user/${c.username}`}
                    className="pf-comment-author-link"
                  >
                    <p className="pf-comment-author">{c.username}</p>
                  </Link>
                  <p className="pf-comment-text">{c.text}</p>
                </div>
              </div>
            ))}

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