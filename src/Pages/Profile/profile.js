import React, { useState, useEffect, useRef } from "react";
import "./profile.css";
import SideNavbar from "../../Component/SideNavbar/sideNavbar";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { uploadToR2, buildTransformUrl } from "../../utils/mediaUpload";
// NEW: shared notification helper — same one PostCard.jsx / Video.jsx /
// Reels.jsx already use for their Connect buttons. Profile.js previously
// had no equivalent notification on a successful connect at all.
import { notifyUser } from "../../utils/notifications";

const allVideos = [
  { id: 7679, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTu-l3JR0guZspKsBZkVoakjkQ-qxUCCpkQnw&s", title: "Big Buck Bunny open-source film", duration: "09:56", channel: "Gangeshwary" },
  { id: 2, thumbnail: "https://i.ytimg.com/vi/ScMzIvxBSi4/hqdefault.jpg", title: "Sample Video 2", duration: "30:00", channel: "Mummy" },
  { id: 3, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTwyNTbTLzlbDj6RSQdV6imNyxNywT3pchKKg&s", title: "3d Lion Stock Photo", duration: "60:00", channel: "Papa" },
  { id: 4, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQpWv_QvC-7P4_8Ubbg2rwn0Om4APOgf6B3yA&s", title: "Sample Video 4", duration: "10:00", channel: "Karthik" },
  { id: 5, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZleDiTkppd2k7GVmREMQRs8D8JBbNXuuxUA&s", title: "8k Wallpaper 3d Photos", duration: "18:00", channel: "Annu" },
  { id: 6, thumbnail: "https://damassets.autodesk.net/content/dam/autodesk/www/industry/3d-animation/create-beautiful-3d-animations-thumb-1204x677.jpg", title: "3D Animation Solutions", duration: "08:00", channel: "Jyoti" },
  { id: 7, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTMxQZtpZz8NgMYzzNMiBm-n4h2oGYovjK2lQ&s", title: "3D Shapes | Types & Examples", duration: "28:00", channel: "Sarita" },
  { id: 8, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSK5izd-jLAR_UjqnUULPW42Pv_LIpL0W60cQ&s", title: "3d Graphics Pictures", duration: "20:00", channel: "Jaynarayan" },
  { id: 9, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQN6EQg2_-8zTqUk1YRvLpJinJk67VF0wEZfg&s", title: "Scenery 3d wallpaper", duration: "10:00", channel: "Shyamnarayan" },
  { id: 10, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRS5r-8k6FyUEN9OYQu5WgyyNqT8lrqgw7dCQ&s", title: "3D Nature Images", duration: "12:00", channel: "Rajbhar" },
  { id: 11, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQeUzhAtZL9ElXiENfplVjR5dCJsUQUG2NuXg&s", title: "5,364,800+ 3d Images", duration: "13:30", channel: "Narayan" },
  { id: 12, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQdcK3NWfTM_cOjFOH6ArcBdUbu29e0AVjFZw&s", title: "Understanding 3D Computer Graphics", duration: "20:50", channel: "Laxminarayan" },
];

const matchesKey = (candidate = "", key = "") => {
  if (!candidate || !key) return false;
  const c = candidate.toLowerCase();
  return c === key || c.replace(/\s+/g, "_") === key || c.replace(/\s+/g, ".") === key;
};

const timeAgo = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const getUserGradient = (name = "") => {
  const colors = [
    ["#1a1a2e", "#e94560"], ["#0f0c29", "#302b63"], ["#134e5e", "#71b280"],
    ["#373b44", "#4286f4"], ["#c94b4b", "#4b134f"], ["#11998e", "#38ef7d"],
    ["#f46b45", "#eea849"], ["#4776e6", "#8e54e9"], ["#1d4350", "#a43931"], ["#134e5e", "#71b280"],
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const pair = colors[Math.abs(hash) % colors.length];
  const angle = (Math.abs(hash) % 60) + 120;
  return `linear-gradient(${angle}deg, ${pair[0]}, ${pair[1]})`;
};

// ── Feelings list — matches PostComposer.jsx so edited posts can pick the same set ──
const FEELINGS = [
  "Happy 😊", "Excited 🤩", "Grateful 🙏", "Blessed ✨",
  "Motivated 💪", "Tired 😴", "Loved ❤️", "Proud 🎉",
];

const PRIVACY_OPTIONS = [
  { value: "public", label: "Public", icon: "🌐" },
  { value: "friends", label: "Friends", icon: "👥" },
  { value: "only_me", label: "Only me", icon: "🔒" },
];

// ── Tabs, in swipe order ──
const PROFILE_TABS = ["videos", "reels", "posts"];

// How many characters of post text to show before offering "Show more"
const POST_TEXT_LIMIT = 220;

// ─── Action Menu (⋮) ────────────────────────────────────────────────────────
const ActionMenu = ({ onEdit, onDelete, variant = "dark", extraActions = [] }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const isDark = variant === "dark";

  return (
    <div ref={menuRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen((v) => !v); }}
        title="More options"
        aria-label="More options"
        style={{
          background: isDark ? "rgba(0,0,0,0.65)" : "rgba(124,58,237,0.12)",
          border: isDark ? "none" : "1px solid rgba(124,58,237,0.3)",
          color: isDark ? "white" : "#a78bfa",
          borderRadius: "8px",
          width: "28px",
          height: "28px",
          cursor: "pointer",
          fontSize: "18px",
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        ⋮
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "34px",
            right: 0,
            background: "#212121",
            border: "1px solid #444",
            borderRadius: "10px",
            overflow: "hidden",
            zIndex: 50,
            minWidth: "140px",
            boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
          }}
        >
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(false); onEdit(); }}
              style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", background: "none", border: "none", color: "#e0e0e0", padding: "10px 14px", fontSize: "13px", cursor: "pointer", textAlign: "left" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              ✏️ Edit
            </button>
          )}
          {extraActions.map((action, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(false); action.onClick(); }}
              style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", background: "none", border: "none", color: "#e0e0e0", padding: "10px 14px", fontSize: "13px", cursor: "pointer", textAlign: "left", borderTop: "1px solid #333" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {action.icon} {action.label}
            </button>
          ))}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(false); onDelete(); }}
              style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", background: "none", border: "none", color: "#ff6666", padding: "10px 14px", fontSize: "13px", cursor: "pointer", textAlign: "left", borderTop: "1px solid #333" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              🗑️ Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Lightbox ─────────────────────────────────────────────────────────────────
const Lightbox = ({ images, startIndex = 0, onClose }) => {
  const [index, setIndex] = useState(startIndex);
  const next = (e) => { e?.stopPropagation(); setIndex((i) => (i + 1) % images.length); };
  const prev = (e) => { e?.stopPropagation(); setIndex((i) => (i - 1 + images.length) % images.length); };

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleKey); document.body.style.overflow = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, images.length]);

  return (
    <div onClick={onClose} style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.93)", zIndex:999999, display:"flex", alignItems:"center", justifyContent:"center", cursor:"zoom-out" }}>
      <button onClick={onClose} style={{ position:"absolute", top:"16px", right:"20px", background:"rgba(255,255,255,0.1)", border:"none", color:"white", fontSize:"22px", width:"40px", height:"40px", borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2 }}>✕</button>
      {images.length > 1 && <button onClick={prev} style={{ position:"absolute", left:"16px", top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,0.1)", border:"none", color:"white", fontSize:"28px", width:"44px", height:"44px", borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2 }}>‹</button>}
      {images.length > 1 && <button onClick={next} style={{ position:"absolute", right:"16px", top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,0.1)", border:"none", color:"white", fontSize:"28px", width:"44px", height:"44px", borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2 }}>›</button>}
      <img src={images[index]} alt={`Image ${index + 1}`} onClick={(e) => e.stopPropagation()} style={{ maxWidth:"92vw", maxHeight:"90vh", objectFit:"contain", borderRadius:"8px", boxShadow:"0 8px 48px rgba(0,0,0,0.8)", cursor:"default" }} />
      {images.length > 1 && (
        <div onClick={(e) => e.stopPropagation()} style={{ position:"absolute", bottom:"60px", left:"50%", transform:"translateX(-50%)", display:"flex", gap:"8px" }}>
          {images.map((_, i) => <button key={i} onClick={() => setIndex(i)} style={{ width:"10px", height:"10px", borderRadius:"50%", border:"none", cursor:"pointer", padding:0, background: i === index ? "#ffffff" : "rgba(255,255,255,0.35)", transition:"background 0.2s" }} />)}
        </div>
      )}
      {images.length > 1 && <div style={{ position:"absolute", bottom:"20px", left:"50%", transform:"translateX(-50%)", color:"white", fontSize:"14px", fontWeight:"700", background:"rgba(255,255,255,0.1)", padding:"4px 12px", borderRadius:"12px" }}>{index + 1} / {images.length}</div>}
    </div>
  );
};

// ─── Profile Post Card ────────────────────────────────────────────────────────
const ProfilePostCard = ({ post, isOwner, onDelete, onEdit, onReactionChange, onAddComment }) => {
  const [lightboxData, setLightboxData] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSending, setCommentSending] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  const totalReactions = Object.values(post.reactionCounts || {}).reduce((a, b) => a + b, 0);
  const images = post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];

  const isLongText = (post.text || "").length > POST_TEXT_LIMIT;
  const displayText = isLongText && !expanded
    ? post.text.slice(0, POST_TEXT_LIMIT).trimEnd() + "…"
    : post.text;

  const gridStyle = (count) => {
    if (count === 1) return { gridTemplateColumns: "1fr", height: "auto" };
    if (count === 2) return { gridTemplateColumns: "1fr 1fr", height: "260px" };
    if (count === 3) return { gridTemplateColumns: "2fr 1fr", gridTemplateRows: "1fr 1fr", height: "300px" };
    return { gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", height: "300px" };
  };

  const itemStyle = (idx, count) => {
    const base = { position: "relative", overflow: "hidden", cursor: "zoom-in" };
    if (count === 3 && idx === 0) return { ...base, gridRow: "1 / 3" };
    return base;
  };

  const handleToggleLike = async () => {
    const currentUser = localStorage.getItem("username") || "";
    if (!currentUser) { alert("Please log in to like posts."); return; }
    if (likeBusy) return;
    setLikeBusy(true);

    const wasLiked = !!post.myReaction;
    const newCounts = { ...(post.reactionCounts || {}) };

    try {
      if (wasLiked) {
        newCounts.like = Math.max(0, (newCounts.like || 0) - 1);
        onReactionChange(post.id, { myReaction: null, reactionCounts: newCounts });
        await supabase.from("post_reactions").delete().eq("post_id", post.id).eq("username", currentUser);
      } else {
        newCounts.like = (newCounts.like || 0) + 1;
        onReactionChange(post.id, { myReaction: "like", reactionCounts: newCounts });
        await supabase.from("post_reactions").insert({ post_id: post.id, username: currentUser, type: "like" });
      }
    } finally {
      setLikeBusy(false);
    }
  };

  const handleAddComment = async () => {
    const currentUser = localStorage.getItem("username") || "";
    if (!currentUser) { alert("Please log in to comment."); return; }
    const trimmed = commentText.trim();
    if (!trimmed || commentSending) return;

    setCommentSending(true);
    const { data, error } = await supabase
      .from("post_comments")
      .insert({ post_id: post.id, username: currentUser, text: trimmed })
      .select()
      .single();

    if (!error && data) {
      onAddComment(post.id, data);
      setCommentText("");
    }
    setCommentSending(false);
  };

  return (
    <>
      {lightboxData && <Lightbox images={lightboxData.images} startIndex={lightboxData.startIndex} onClose={() => setLightboxData(null)} />}
      <div style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:"12px", padding:"16px", marginBottom:"14px", position:"relative" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px" }}>
          <div style={{ width:"38px", height:"38px", borderRadius:"50%", background:"linear-gradient(135deg,#7c3aed,#a855f7)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:"700", fontSize:"14px", flexShrink:0 }}>
            {(post.username || "?").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ color:"white", fontWeight:"600", fontSize:"14px" }}>
              {post.username}
              {post.feeling && <span style={{ color:"#aaa", fontWeight:"400", fontSize:"13px" }}> — feeling {post.feeling}</span>}
            </div>
            <div style={{ color:"#888", fontSize:"12px" }}>
              {timeAgo(post.created_at)}
              {post.privacy === "only_me" && " · 🔒"}
              {post.privacy === "friends" && " · 👥"}
              {post.privacy === "public" && " · 🌐"}
            </div>
          </div>
          {isOwner && (
            <div style={{ marginLeft:"auto" }}>
              <ActionMenu
                variant="dark"
                onEdit={() => onEdit(post)}
                onDelete={() => onDelete(post.id)}
              />
            </div>
          )}
        </div>
        {post.text && (
          <p style={{ color:"#e0e0e0", fontSize:"14px", lineHeight:"1.6", margin:"0 0 12px", wordBreak:"break-word" }}>
            {displayText}
            {isLongText && (
              <button
                onClick={() => setExpanded((v) => !v)}
                style={{ background:"none", border:"none", color:"#a78bfa", fontSize:"13px", fontWeight:"700", cursor:"pointer", padding:"0 0 0 6px" }}
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </p>
        )}
        {images.length > 0 && (
          <div style={{ display:"grid", gap:"4px", borderRadius:"8px", overflow:"hidden", marginBottom:"12px", border:"1px solid #2a2a2a", ...gridStyle(Math.min(images.length, 4)) }}>
            {images.slice(0, 4).map((url, idx) => (
              <div key={idx} style={itemStyle(idx, Math.min(images.length, 4))} onClick={() => setLightboxData({ images, startIndex: idx })}>
                <img src={url} alt={`Post image ${idx + 1}`} loading="lazy" style={{ width:"100%", height: images.length === 1 ? "auto" : "100%", maxHeight: images.length === 1 ? "400px" : "none", objectFit:"cover", display:"block" }} />
                {idx === 3 && images.length > 4 && <div style={{ position:"absolute", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:"26px", fontWeight:"800" }}>+{images.length - 4}</div>}
              </div>
            ))}
          </div>
        )}
        {/* ── NEW: post video ── */}
        {post.video_url && (
          <div style={{ borderRadius:"8px", overflow:"hidden", marginBottom:"12px", border:"1px solid #2a2a2a", background:"#000" }}>
            <video
              src={post.video_url}
              controls
              playsInline
              preload="metadata"
              style={{ width:"100%", maxHeight:"480px", display:"block", background:"#000" }}
            />
          </div>
        )}
        {post.link && (
          <a href={post.link.url} target="_blank" rel="noreferrer" style={{ display:"block", background:"#111", border:"1px solid #333", borderRadius:"8px", padding:"12px", textDecoration:"none", marginBottom:"12px" }}>
            <div style={{ color:"#888", fontSize:"11px", marginBottom:"4px" }}>{post.link.domain}</div>
            <div style={{ color:"#3ea6ff", fontSize:"14px", fontWeight:"600" }}>{post.link.title}</div>
          </a>
        )}
        <div style={{ display:"flex", gap:"16px", alignItems:"center", paddingTop:"10px", borderTop:"1px solid #2a2a2a" }}>
          <button
            onClick={handleToggleLike}
            disabled={likeBusy}
            style={{
              background: "none",
              border: "none",
              color: post.myReaction ? "#a78bfa" : "#aaa",
              fontSize: "13px",
              fontWeight: post.myReaction ? "700" : "400",
              cursor: likeBusy ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: 0,
            }}
          >
            {post.myReaction
              ? <ThumbUpIcon style={{ fontSize:"16px" }} />
              : <ThumbUpOutlinedIcon style={{ fontSize:"16px" }} />}
            {totalReactions}
          </button>
          <button onClick={() => setShowComments((v) => !v)} style={{ background:"none", border:"none", color:"#aaa", fontSize:"13px", cursor:"pointer", display:"flex", alignItems:"center", gap:"4px", padding:0 }}>
            <ChatBubbleOutlineIcon style={{ fontSize:"16px" }} />
            {post.comments?.length || 0} comment{post.comments?.length !== 1 ? "s" : ""}
          </button>
        </div>
        {showComments && (
          <div style={{ marginTop:"12px", display:"flex", flexDirection:"column", gap:"8px" }}>
            {post.comments?.map((c) => (
              <div key={c.id} style={{ display:"flex", gap:"8px", alignItems:"flex-start" }}>
                <div style={{ width:"28px", height:"28px", borderRadius:"50%", background:"#333", display:"flex", alignItems:"center", justifyContent:"center", color:"#ccc", fontSize:"11px", fontWeight:"700", flexShrink:0 }}>
                  {(c.username || "?").slice(0, 2).toUpperCase()}
                </div>
                <div style={{ background:"#262626", borderRadius:"8px", padding:"6px 10px", flex:1 }}>
                  <div style={{ color:"#fff", fontSize:"12px", fontWeight:"600" }}>{c.username}</div>
                  <div style={{ color:"#ccc", fontSize:"13px", wordBreak:"break-word" }}>{c.text}</div>
                </div>
              </div>
            ))}
            <div style={{ display:"flex", gap:"8px", alignItems:"center", marginTop:"4px" }}>
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddComment(); }}
                placeholder="Write a comment…"
                style={{ flex:1, background:"#262626", border:"1px solid #333", borderRadius:"20px", color:"#fff", padding:"8px 14px", fontSize:"13px", outline:"none" }}
              />
              <button
                onClick={handleAddComment}
                disabled={commentSending || !commentText.trim()}
                aria-label="Post comment"
                style={{
                  background: "#7c3aed",
                  color: "#fff",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  cursor: commentSending || !commentText.trim() ? "not-allowed" : "pointer",
                  flexShrink: 0,
                  opacity: commentText.trim() ? 1 : 0.5,
                  fontSize: "13px",
                }}
              >
                ➤
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ─── Connections Modal ─────────────────────────────────────────────────────
// RENAMED from SubscribersModal. Now reads the shared `connections` table
// (same one PostCard.jsx / Video.jsx / Reels.jsx write to via handleConnect)
// instead of the old `subscriptions` table. This also drops the old
// UUID-vs-username resolution hack that SubscribersModal needed — that
// hack existed only because `subscriptions.subscriber_id` was written
// inconsistently (sometimes a uuid, sometimes a raw username). The
// `connections` table always stores the human-readable username directly
// in `connector_username`, so no lookup against `profiles` is needed here.
const ConnectionsModal = ({ channelUsername, onClose }) => {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleKey); document.body.style.overflow = ""; };
  }, [onClose]);

  useEffect(() => {
    const fetchConnections = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("connections")
        .select("connector_username, created_at")
        .eq("connected_to", channelUsername)
        .order("created_at", { ascending: false });
      if (error) console.error("fetchConnections error:", error);
      setConnections(
        (data || []).map((c) => ({
          displayName: c.connector_username || "Unknown",
          created_at: c.created_at,
        })),
      );
      setLoading(false);
    };
    fetchConnections();
  }, [channelUsername]);

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.88)", zIndex:999999, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#ffffff", borderRadius:"16px", width:"100%", maxWidth:"420px", maxHeight:"75vh", display:"flex", flexDirection:"column", border:"2px solid var(--zx-border)", overflow:"hidden", boxShadow:"0 8px 40px rgba(124,58,237,0.2)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px 16px", borderBottom:"1px solid var(--zx-border)" }}>
          <div>
            <h2 style={{ color:"var(--zx-text)", margin:0, fontSize:"18px", fontWeight:"700", fontFamily:"Nunito, sans-serif" }}>👥 Connections</h2>
            <p style={{ color:"var(--zx-text3)", margin:"2px 0 0", fontSize:"13px" }}>{connections.length} {connections.length === 1 ? "person" : "people"} connected</p>
          </div>
          <button onClick={onClose} style={{ background:"rgba(124,58,237,0.1)", border:"none", color:"var(--zx-primary)", width:"36px", height:"36px", borderRadius:"50%", cursor:"pointer", fontSize:"16px", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        </div>
        <div style={{ overflowY:"auto", flex:1, padding:"12px 16px" }}>
          {loading ? (
            <div style={{ display:"flex", justifyContent:"center", padding:"40px 0" }}>
              <div style={{ width:"32px", height:"32px", border:"3px solid #e0d4ff", borderTop:"3px solid #7c3aed", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
            </div>
          ) : connections.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:"var(--zx-text3)" }}>
              <div style={{ fontSize:"36px", marginBottom:"10px" }}>👤</div>
              <p style={{ margin:0, fontSize:"14px" }}>No connections yet.</p>
            </div>
          ) : (
            connections.map((c, idx) => (
              <div key={idx} style={{ display:"flex", alignItems:"center", gap:"12px", padding:"10px 8px", borderRadius:"10px", transition:"background 0.15s", cursor:"default" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(124,58,237,0.06)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <div style={{ width:"40px", height:"40px", borderRadius:"50%", background:"linear-gradient(135deg, #7c3aed, #a855f7)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:"700", fontSize:"14px", flexShrink:0, textTransform:"uppercase" }}>
                  {(c.displayName || "?").slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ color:"var(--zx-text)", fontWeight:"600", fontSize:"14px" }}>{c.displayName}</div>
                  <div style={{ color:"var(--zx-text3)", fontSize:"12px" }}>Connected {timeAgo(c.created_at)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Profile Component ───────────────────────────────────────────────────
const Profile = ({ sideNavbar }) => {
  const { username } = useParams();
  const key = username?.toLowerCase();
  const navigate = useNavigate();

  const [activeTab, setActiveTab]   = useState("videos");
  const [user, setUser]             = useState(null);
  const [dbVideos, setDbVideos]     = useState([]);
  const [dbReels, setDbReels]       = useState([]);
  const [userPosts, setUserPosts]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [videoCounts, setVideoCounts] = useState({});
  const [reelCounts, setReelCounts]   = useState({});

  // RENAMED from subscriberCount / isSubscribed / subLoading /
  // showSubscribersModal — now backed by the shared `connections` table
  // instead of a Profile-only `subscriptions` table. See handleConnect
  // below for the write-side wiring, matched to PostCard.jsx / Video.jsx
  // / Reels.jsx's handleConnect implementations.
  const [connectionCount, setConnectionCount]       = useState(0);
  const [connected, setConnected]                   = useState(false);
  const [connectLoading, setConnectLoading]         = useState(false);
  const [showConnectionsModal, setShowConnectionsModal] = useState(false);

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName]   = useState("");
  const [editAbout, setEditAbout] = useState("");
  const [editPic, setEditPic]     = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Edit Video/Reel content state ──
  const [editContentTarget, setEditContentTarget]           = useState(null); // { type: 'video' | 'reel', id, dbId }
  const [editContentTitle, setEditContentTitle]             = useState("");
  const [editContentDescription, setEditContentDescription] = useState("");
  const [editContentThumbnail, setEditContentThumbnail]     = useState("");
  const [editContentLoading, setEditContentLoading]         = useState(false);
  const [editContentSaving, setEditContentSaving]           = useState(false);

  // ── Edit Post state ──
  const [editPostTarget, setEditPostTarget]   = useState(null);
  const [editPostText, setEditPostText]       = useState("");
  const [editPostFeeling, setEditPostFeeling] = useState("");
  const [editPostPrivacy, setEditPostPrivacy] = useState("public");
  const [editPostSaving, setEditPostSaving]   = useState(false);
  const [editPostError, setEditPostError]     = useState("");

  // ── Swipe-to-switch-tabs (mobile) ──
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  const handleTabTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTabTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - touchStartX.current;
    const deltaY = endY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    // Ignore short or mostly-vertical swipes (scrolling)
    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;

    const currentIndex = PROFILE_TABS.indexOf(activeTab);
    if (deltaX < 0 && currentIndex < PROFILE_TABS.length - 1) {
      setActiveTab(PROFILE_TABS[currentIndex + 1]); // swipe left → next tab
    } else if (deltaX > 0 && currentIndex > 0) {
      setActiveTab(PROFILE_TABS[currentIndex - 1]); // swipe right → previous tab
    }
  };

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      const lsUsername   = localStorage.getItem("username");
      const lsProfilePic = localStorage.getItem("profilePic");
      const lsAbout      = localStorage.getItem("about");
      const lsEmail      = localStorage.getItem("email");
      const lsUserId     = localStorage.getItem("userId");

      // ── PATH 1: Owner via localStorage ──
      if (lsUsername && matchesKey(lsUsername, key)) {
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("id, banner_pic, profile_pic, about, channel_name")
          .eq("username", lsUsername)
          .maybeSingle();

        const bannerPic   = ownerProfile?.banner_pic || null;
        const profilePic  = ownerProfile?.profile_pic || lsProfilePic
          || `https://ui-avatars.com/api/?name=${encodeURIComponent(lsUsername)}&background=7c3aed&color=fff&size=120&length=2`;
        const about       = ownerProfile?.about || lsAbout || `${lsUsername}'s channel`;
        const channelName = ownerProfile?.channel_name || localStorage.getItem("channelName") || lsUsername;

        if (profilePic)  localStorage.setItem("profilePic",  profilePic);
        if (about)       localStorage.setItem("about",       about);
        if (channelName) localStorage.setItem("channelName", channelName);

        setUser({ id: ownerProfile?.id || lsUserId, name: channelName, username: lsUsername, handle: `@${lsUsername}`, profilePic, about, email: lsEmail, isOwner: true, bannerPic });

      // ── PATH 2: Owner via Supabase auth session ──
      } else {
        const { data: authData } = await supabase.auth.getUser();
        const authUser     = authData?.user;
        const authUsername = authUser?.user_metadata?.username || authUser?.user_metadata?.channelName;

        if (authUsername && matchesKey(authUsername, key)) {
          const { data: ownerProfile } = await supabase
            .from("profiles")
            .select("id, banner_pic, profile_pic, about, channel_name")
            .eq("username", authUsername)
            .maybeSingle();

          const bannerPic   = ownerProfile?.banner_pic || null;
          const profilePic  = ownerProfile?.profile_pic || authUser.user_metadata?.profilePic
            || `https://ui-avatars.com/api/?name=${encodeURIComponent(authUsername)}&background=7c3aed&color=fff&size=120`;
          const about       = ownerProfile?.about || authUser.user_metadata?.about || `${authUsername}'s channel`;
          const channelName = ownerProfile?.channel_name || authUser?.user_metadata?.channel_name || localStorage.getItem("channelName") || authUsername;

          localStorage.setItem("username",    authUsername);
          localStorage.setItem("channelName", channelName);
          if (profilePic) localStorage.setItem("profilePic", profilePic);
          if (about)      localStorage.setItem("about",      about);

          setUser({ id: ownerProfile?.id || authUser.id, name: channelName, username: authUsername, handle: `@${authUsername}`, profilePic, about, email: authUser.email, isOwner: true, bannerPic });

        // ── PATH 3: Visitor ──
        } else {
          let foundUser = null;

          const { data: profileRow } = await supabase
            .from("profiles")
            .select("id, username, channel_name, banner_pic, profile_pic, about")
            .eq("username", key)
            .maybeSingle();

          if (profileRow) {
            foundUser = {
              id:         profileRow.id,
              name:       profileRow.channel_name || profileRow.username,
              username:   profileRow.username,
              handle:     `@${profileRow.username}`,
              profilePic: profileRow.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileRow.username)}&background=7c3aed&color=fff&size=120`,
              about:      profileRow.about || `${profileRow.username}'s channel`,
              bannerPic:  profileRow.banner_pic || null,
              isOwner:    false,
            };
          }

          if (!foundUser) {
            const { data: videoUserData } = await supabase.from("videos").select("channel, username").limit(200);
            if (videoUserData) {
              const match = videoUserData.find((v) => matchesKey(v.username, key) || matchesKey(v.channel, key));
              if (match) foundUser = { name: match.channel || match.username, username: match.username || match.channel, handle: `@${match.username || match.channel}`, profilePic: `https://ui-avatars.com/api/?name=${encodeURIComponent(match.channel || match.username)}&background=7c3aed&color=fff&size=120`, about: `${match.channel || match.username}'s channel`, bannerPic: null, isOwner: false };
            }
          }

          if (!foundUser) {
            const { data: reelUserData } = await supabase.from("reels").select("username, user").limit(200);
            if (reelUserData) {
              const match = reelUserData.find((r) => matchesKey(r.username, key));
              if (match) foundUser = { name: match.user || match.username, username: match.username, handle: `@${match.username}`, profilePic: `https://ui-avatars.com/api/?name=${encodeURIComponent(match.user || match.username)}&background=7c3aed&color=fff&size=120`, about: `${match.user || match.username}'s channel`, bannerPic: null, isOwner: false };
            }
          }

          setUser(foundUser || null);
        }
      }

      // ── Fetch videos ──
      const { data: vData } = await supabase.from("videos").select("*").order("created_at", { ascending: false });
      if (vData) {
        setDbVideos(vData.filter((v) => matchesKey(v.username, key) || matchesKey(v.channel, key)).map((v) => ({ id: v.id, src: v.video_url, thumbnail: v.thumbnail_url, title: v.title, duration: v.duration || "00:00", channel: v.channel })));
        const ids = vData.map((v) => String(v.id));
        const [{ data: vLikes }, { data: vViews }] = await Promise.all([
          supabase.from("likes").select("content_id").eq("content_type", "video").in("content_id", ids),
          supabase.from("views").select("content_id").eq("content_type", "video").in("content_id", ids),
        ]);
        const counts = {};
        ids.forEach((id) => { counts[id] = { likes: vLikes?.filter((l) => l.content_id === id).length || 0, views: vViews?.filter((v) => v.content_id === id).length || 0 }; });
        setVideoCounts(counts);
      }

      // ── Fetch reels ──
      const { data: rData } = await supabase.from("reels").select("*").order("created_at", { ascending: false });
      if (rData) {
        setDbReels(
          rData.filter((r) => matchesKey(r.username, key)).map((r) => ({
            id:          `db_${r.id}`,
            dbId:        r.id,
            src:         r.video_url,
            thumbnail:   r.thumbnail || `https://picsum.photos/seed/${r.id}/200/350`,
            title:       r.title       || "Untitled",
            duration:    r.duration    || "00:00",
            description: r.description || "",
            username:    r.username,
            user:        r.user || r.username,
            profilePic:  `https://api.dicebear.com/7.x/initials/svg?seed=${r.username || "user"}`,
            likes:       0,
          }))
        );

        const ids = rData.map((r) => `db_${r.id}`);
        const [{ data: rLikes }, { data: rViews }] = await Promise.all([
          supabase.from("likes").select("content_id").eq("content_type", "reel").in("content_id", ids),
          supabase.from("views").select("content_id").eq("content_type", "reel").in("content_id", ids),
        ]);
        const counts = {};
        ids.forEach((id) => {
          counts[id] = {
            likes: rLikes?.filter((l) => l.content_id === id).length || 0,
            views: rViews?.filter((v) => v.content_id === id).length || 0,
          };
        });
        setReelCounts(counts);
      }

      // ── Fetch posts ──
      const { data: postsData } = await supabase.from("posts").select(`*, post_reactions ( type, username ), post_comments ( id, text, username, created_at )`).eq("username", key).order("created_at", { ascending: false });
      if (postsData) {
        const currentUser = localStorage.getItem("username") || "";
        setUserPosts(postsData.map((p) => ({
          ...p,
          myReaction: p.post_reactions?.find((r) => r.username === currentUser)?.type || null,
          reactionCounts: p.post_reactions?.reduce((acc, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {}),
          comments: (p.post_comments || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
        })));
      }

      // ── Connection count / connected state ──
      // RENAMED from the old "Subscriber count" block. Reads the shared
      // `connections` table instead of `subscriptions`, and — since
      // `connections` always stores a real userId in `connector_id` (no
      // legacy username-as-id rows like `subscriptions` had) — only needs
      // a single lookup instead of the old id-then-username double-check.
      const { count: connCount } = await supabase.from("connections").select("*", { count: "exact", head: true }).eq("connected_to", key);
      const currentUser   = localStorage.getItem("username") || "";
      const currentUserId = localStorage.getItem("userId") || "";
      let alreadyConnected = false;
      if (currentUserId && currentUser && currentUser.toLowerCase() !== key) {
        const { data: connCheck, error: connCheckError } = await supabase
          .from("connections")
          .select("id")
          .match({ connector_id: currentUserId, connected_to: key })
          .maybeSingle();
        if (connCheckError) console.error("connection check error:", connCheckError);
        alreadyConnected = !!connCheck;
      }
      setConnectionCount(connCount || 0);
      setConnected(alreadyConnected);
      setLoading(false);
    };

    loadProfile();
  }, [key]);

  const hardcodedVideos = allVideos.filter((v) => v.channel?.toLowerCase() === key);
  const allUserVideos   = [...dbVideos, ...hardcodedVideos];
  const allUserReels    = dbReels;

  // RENAMED from handleSubscribe — now writes to the shared `connections`
  // table with the same shape (`connector_id` / `connector_username` /
  // `connected_to`) and the same optimistic-flip-with-rollback +
  // connectLoading-guard + notifyUser() pattern used by
  // PostCard.jsx / Video.jsx / Reels.jsx's handleConnect. Also swaps the
  // old alert() login gate for the shared "openLogin" event, matching
  // those same three files.
  const handleConnect = async () => {
    const currentUser   = localStorage.getItem("username") || "";
    const currentUserId = localStorage.getItem("userId") || "";
    if (!currentUser || !currentUserId) {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    if (currentUser.toLowerCase() === key) return; // self-connect guard
    if (connectLoading) return;

    const wasConnected = connected;
    setConnectLoading(true);
    setConnected(!wasConnected); // optimistic flip

    try {
      if (wasConnected) {
        const { error } = await supabase
          .from("connections")
          .delete()
          .match({ connector_id: currentUserId, connected_to: key });
        if (error) {
          console.error("handleConnect delete error:", error);
          setConnected(true); // rollback
        } else {
          setConnectionCount((n) => Math.max(0, n - 1));
        }
      } else {
        const { error } = await supabase.from("connections").insert({
          connector_id: currentUserId,
          connector_username: currentUser,
          connected_to: key,
        });
        if (error) {
          console.error("handleConnect insert error:", error);
          setConnected(false); // rollback
        } else {
          setConnectionCount((n) => n + 1);
          notifyUser({
            recipientUsername: key,
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

  const handleSaveProfile = async () => {
    const newChannelName = editName.trim() || user.name;
    const newAbout       = editAbout.trim() || user.about;
    const newPic         = editPic.trim() || user.profilePic;
    const userId         = user.id || localStorage.getItem("userId");
    const rawUsername    = user.username || localStorage.getItem("username");

    localStorage.setItem("channelName", newChannelName);
    localStorage.setItem("about",       newAbout);
    localStorage.setItem("profilePic",  newPic);

    await supabase.from("profiles").upsert(
      { id: userId, username: rawUsername, channel_name: newChannelName, profile_pic: newPic, about: newAbout, banner_pic: user.bannerPic || null },
      { onConflict: "id" }
    );
    await supabase.auth.updateUser({ data: { channel_name: newChannelName, about: newAbout, profilePic: newPic } });
    setUser((prev) => ({ ...prev, name: newChannelName, about: newAbout, profilePic: newPic, handle: `@${prev.username}` }));
    setShowEditProfile(false); setEditName(""); setEditAbout(""); setEditPic("");
  };

  const confirmDelete = (type, id, dbId, title) => setDeleteTarget({ type, id, dbId, title });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { type, id, dbId } = deleteTarget;
    if (type === "video") { await supabase.from("videos").delete().eq("id", id); setDbVideos((prev) => prev.filter((v) => v.id !== id)); }
    else if (type === "reel") { await supabase.from("reels").delete().eq("id", dbId); setDbReels((prev) => prev.filter((r) => r.dbId !== dbId)); }
    setDeleteTarget(null);
  };

  const handleDeletePost = async (postId) => {
    await supabase.from("posts").delete().eq("id", postId).eq("username", key);
    setUserPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  // ── Post reaction / comment state updates (from ProfilePostCard) ──
  const handleReactionChange = (postId, updates) => {
    setUserPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...updates } : p)));
  };

  const handleAddComment = (postId, comment) => {
    setUserPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: [...(p.comments || []), comment] } : p)),
    );
  };

  // ── Edit Post handlers ──
  const openEditPost = (post) => {
    setEditPostTarget(post);
    setEditPostText(post.text || "");
    setEditPostFeeling(post.feeling || "");
    setEditPostPrivacy(post.privacy || "public");
    setEditPostError("");
  };

  const closeEditPost = () => {
    setEditPostTarget(null);
    setEditPostText("");
    setEditPostFeeling("");
    setEditPostPrivacy("public");
    setEditPostError("");
  };

  const handleSaveEditPost = async () => {
    if (!editPostTarget) return;
    const newText = editPostText.trim();

    // ── UPDATED: also treat an attached video as "has media" so clearing text on a
    // video-only post doesn't incorrectly report the post as empty ──
    const hasImages = editPostTarget.image_urls?.length > 0 || editPostTarget.image_url || editPostTarget.video_url;
    if (!newText && !hasImages && !editPostTarget.link) {
      setEditPostError("Post can't be empty.");
      return;
    }

    setEditPostSaving(true);
    setEditPostError("");
    try {
      const { error } = await supabase
        .from("posts")
        .update({
          text: newText || null,
          feeling: editPostFeeling || null,
          privacy: editPostPrivacy,
        })
        .eq("id", editPostTarget.id)
        .eq("username", key);

      if (error) throw error;

      setUserPosts((prev) =>
        prev.map((p) =>
          p.id === editPostTarget.id
            ? { ...p, text: newText || null, feeling: editPostFeeling || null, privacy: editPostPrivacy }
            : p
        )
      );
      closeEditPost();
    } catch (err) {
      setEditPostError(err.message || "Failed to save changes. Try again.");
    } finally {
      setEditPostSaving(false);
    }
  };

  // ── Edit Video/Reel content handlers ──
  const openEditContent = (type, item) => {
    setEditContentTarget({ type, id: item.id, dbId: item.dbId || null });
    setEditContentTitle(item.title || "");
    setEditContentDescription(item.description || "");
    setEditContentThumbnail(item.thumbnail || "");
  };

  const closeEditContent = () => {
    setEditContentTarget(null);
    setEditContentTitle("");
    setEditContentDescription("");
    setEditContentThumbnail("");
  };

  const handleSaveContentEdit = async () => {
    if (!editContentTarget) return;
    const { type, id, dbId } = editContentTarget;
    const newTitle = editContentTitle.trim();
    const newThumb = editContentThumbnail.trim();

    setEditContentSaving(true);
    try {
      if (type === "video") {
        const { error } = await supabase.from("videos").update({ title: newTitle, thumbnail_url: newThumb }).eq("id", id);
        if (!error) {
          setDbVideos((prev) => prev.map((v) => (v.id === id ? { ...v, title: newTitle, thumbnail: newThumb } : v)));
        } else {
          alert("Failed to save changes. Try again.");
          setEditContentSaving(false);
          return;
        }
      } else if (type === "reel") {
        const newDescription = editContentDescription.trim();
        const { error } = await supabase.from("reels").update({ title: newTitle, description: newDescription, thumbnail: newThumb }).eq("id", dbId);
        if (!error) {
          setDbReels((prev) => prev.map((r) => (r.dbId === dbId ? { ...r, title: newTitle, description: newDescription, thumbnail: newThumb } : r)));
        } else {
          alert("Failed to save changes. Try again.");
          setEditContentSaving(false);
          return;
        }
      }
      closeEditContent();
    } finally {
      setEditContentSaving(false);
    }
  };

  // ── Edit content thumbnail upload — now goes to R2 instead of Cloudinary ──
  const handleEditContentThumbnailUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setEditContentLoading(true);
    try {
      const { url } = await uploadToR2(file);
      const transformedUrl = buildTransformUrl(url, { width: 640, height: 360, fit: "cover" });
      setEditContentThumbnail(transformedUrl);
    } catch {
      alert("Thumbnail upload failed. Try again.");
    }
    setEditContentLoading(false);
  };

  if (loading) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh", color:"var(--zx-text)", flexDirection:"column", gap:"16px" }}>
        <div style={{ width:"40px", height:"40px", border:"4px solid #e0d4ff", borderTop:"4px solid #7c3aed", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ color:"var(--zx-text)", padding:"40px", textAlign:"center", marginTop:"56px" }}>
        <div style={{ fontSize:"48px", marginBottom:"16px" }}>👤</div>
        <h2>No profile exists for "@{username}"</h2>
        <p style={{ color:"var(--zx-text3)" }}>This user hasn't signed up yet.</p>
        <Link to="/" style={{ color:"var(--zx-primary)", textDecoration:"none", fontSize:"14px" }}>← Go Home</Link>
      </div>
    );
  }

  const tabStyle = (tab) => ({
    padding:"10px 20px", background:"none", border:"none",
    borderBottom: activeTab === tab ? "2px solid var(--zx-primary)" : "2px solid transparent",
    color: activeTab === tab ? "var(--zx-text)" : "var(--zx-text3)",
    fontWeight: activeTab === tab ? "700" : "400",
    fontSize:"14px", cursor:"pointer", transition:"all 0.2s", letterSpacing:"0.3px",
    fontFamily:"Nunito, sans-serif",
  });

  return (
    <div className="profile">
      <SideNavbar sideNavbar={sideNavbar} />
      <div className={sideNavbar ? "profile_page" : "profile_page_inactive"}>

        {/* ── Banner ── */}
        <div
          style={{ width:"100%", height:"180px", borderRadius:"12px", marginBottom:"20px", position:"relative", overflow:"hidden", background:"#111", cursor: user.isOwner ? "pointer" : "default" }}
          onClick={() => user.isOwner && document.getElementById("bannerInput").click()}
        >
          {user.bannerPic ? (
            <img src={user.bannerPic} alt="channel banner" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
          ) : (
            <>
              <div style={{ position:"absolute", top:0, left:0, right:0, bottom:0, background:getUserGradient(user.name) }} />
              <div style={{ position:"absolute", top:0, left:0, right:0, bottom:0, background:"radial-gradient(circle at 30% 50%, rgba(255,255,255,0.05), transparent 60%)" }} />
            </>
          )}
          {user.isOwner && (
            <div style={{ position:"absolute", bottom:"10px", right:"14px", background:"rgba(0,0,0,0.6)", color:"white", fontSize:"12px", padding:"5px 12px", borderRadius:"20px", display:"flex", alignItems:"center", gap:"6px" }}>
              🖼️ {user.bannerPic ? "Change Banner" : "Add Banner"}
            </div>
          )}
          {/* ── Banner upload — now goes to R2 instead of Cloudinary ── */}
          <input type="file" id="bannerInput" accept="image/*" style={{ display:"none" }}
            onChange={async (e) => {
              const file = e.target.files[0]; if (!file) return;
              try {
                const { url } = await uploadToR2(file);
                const bannerUrl = buildTransformUrl(url, { width: 1200, height: 300, fit: "cover" });
                await supabase.auth.updateUser({ data: { bannerPic: bannerUrl } });
                await supabase.from("profiles").upsert({ id: user.id || localStorage.getItem("userId"), username: user.username || localStorage.getItem("username"), banner_pic: bannerUrl, profile_pic: localStorage.getItem("profilePic") || user.profilePic, about: localStorage.getItem("about") || user.about }, { onConflict: "id" });
                setUser((prev) => ({ ...prev, bannerPic: bannerUrl }));
              } catch { alert("Banner upload failed. Try again."); }
            }}
          />
        </div>

        {/* ── Profile Top Section ── */}
        <div className="profile_top_section">
          <div className="profile_top_section_profile">
            <img className="profile_top_section_img" src={user.profilePic} alt={user.name}
              onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=7c3aed&color=fff&size=120&length=2`; }} />
          </div>
          <div className="profile_top_section_About">
            <div className="profile_top_section_About_Name">{user.name}</div>
            <div className="profile_top_section_info">
              {user.handle} ·{" "}
              <button onClick={() => setShowConnectionsModal(true)} title="View connections"
                style={{ background:"none", border:"none", padding:0, color:"inherit", fontSize:"inherit", cursor:"pointer", textDecoration:"underline", textDecorationStyle:"dotted", textUnderlineOffset:"3px" }}>
                {connectionCount.toLocaleString()} connection{connectionCount !== 1 ? "s" : ""}
              </button>
              {" "}· {allUserVideos.length} videos · {allUserReels.length} reels · {userPosts.length} posts
            </div>
            <div className="profile_top_section_info">{user.about}</div>
            <div style={{ display:"flex", gap:"10px", flexWrap:"wrap", marginTop:"8px" }}>
              {user.isOwner ? (
                <>
                  <Link to="/763/upload" style={{ background:"var(--zx-primary)", color:"white", border:"none", borderRadius:"20px", padding:"8px 20px", fontSize:"14px", fontWeight:"600", cursor:"pointer", textDecoration:"none", display:"inline-block" }}>
                    + Upload Video / Reel
                  </Link>
                  <button onClick={() => { setEditName(user.name); setEditAbout(user.about); setEditPic(user.profilePic); setShowEditProfile(true); }}
                    style={{ background:"#f0f4ff", color:"#1e1b4b", border:"2px solid #e0d4ff", borderRadius:"20px", padding:"8px 20px", fontSize:"14px", fontWeight:"600", cursor:"pointer" }}>
                    ✏️ Edit Profile
                  </button>
                  <button onClick={() => setShowConnectionsModal(true)}
                    style={{ background:"#f0f4ff", color:"#1e1b4b", border:"2px solid #e0d4ff", borderRadius:"20px", padding:"8px 20px", fontSize:"14px", fontWeight:"600", cursor:"pointer" }}>
                    👥 View Connections
                  </button>
                </>
              ) : (
                <button onClick={handleConnect} disabled={connectLoading}
                  style={{ background: connected ? "#f0f4ff" : "var(--zx-primary)", color: connected ? "#1e1b4b" : "white", border: connected ? "2px solid #e0d4ff" : "none", borderRadius:"20px", padding:"8px 24px", fontSize:"14px", fontWeight:"600", cursor: connectLoading ? "not-allowed" : "pointer", transition:"all 0.2s", opacity: connectLoading ? 0.7 : 1, display:"flex", alignItems:"center", gap:"6px" }}>
                  {connectLoading ? (
                    <span style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                      <span style={{ width:"14px", height:"14px", border:"2px solid rgba(255,255,255,0.4)", borderTop:"2px solid white", borderRadius:"50%", animation:"spin 0.7s linear infinite", display:"inline-block" }} />
                      {connected ? "Disconnecting..." : "Connecting..."}
                    </span>
                  ) : connected ? "✓ Connected" : "Connect"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Tab Switcher ── */}
        <div style={{ display:"flex", borderBottom:"1px solid var(--zx-border)", marginBottom:"24px", marginTop:"8px", gap:"4px" }}>
          <button style={tabStyle("videos")} onClick={() => setActiveTab("videos")}>🎬 Videos ({allUserVideos.length})</button>
          <button style={tabStyle("reels")}  onClick={() => setActiveTab("reels")}>📱 Reels ({allUserReels.length})</button>
          <button style={tabStyle("posts")}  onClick={() => setActiveTab("posts")}>📝 Posts ({userPosts.length})</button>
        </div>

        {/* ── Swipeable tab content (mobile: swipe left/right to switch tabs) ── */}
        <div onTouchStart={handleTabTouchStart} onTouchEnd={handleTabTouchEnd}>

        {/* ── Videos Tab ── */}
        {activeTab === "videos" && (
          allUserVideos.length === 0
            ? <div style={{ color:"var(--zx-text3)", textAlign:"center", marginTop:"40px" }}>No videos uploaded yet.</div>
            : <div className="profileVideos">
                {allUserVideos.map((video) => {
                  const isEditableVideo = user.isOwner && !String(video.id).startsWith("hard_") && typeof video.id === "number";
                  return (
                    <div key={video.id} style={{ position:"relative", minWidth:0 }}>
                      <Link to={`/video/${video.id}`} className="profileVideo_block">
                        <div className="profileVideo_block_thumbnail square-thumb" style={{ position:"relative" }}>
                          <img className="profileVideo_block_thumbnail_img" src={video.thumbnail} alt={video.title} />
                          <span style={{ position:"absolute", bottom:"6px", right:"6px", background:"rgba(0,0,0,0.75)", color:"white", fontSize:"11px", padding:"2px 5px", borderRadius:"4px" }}>{video.duration}</span>
                        </div>
                        <div className="profileVideo_block_detail">
                          <div className="profileVideo_block_detai_name">{video.title}</div>
                          <div className="profileVideo_block_detai_about">{video.channel}</div>
                          <div style={{ color:"var(--zx-text3)", fontSize:"12px", marginTop:"4px", display:"flex", gap:"10px" }}>
                            <span>👁 {videoCounts[String(video.id)]?.views ?? 0}</span>
                            <span>👍 {videoCounts[String(video.id)]?.likes ?? 0}</span>
                          </div>
                        </div>
                      </Link>
                      {isEditableVideo && (
                        <div style={{ position:"absolute", top:"6px", right:"6px", zIndex:10 }}>
                          <ActionMenu
                            variant="dark"
                            onEdit={() => openEditContent("video", video)}
                            onDelete={() => confirmDelete("video", video.id, null, video.title)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
        )}

        {/* ── Reels Tab ── */}
        {activeTab === "reels" && (
          allUserReels.length === 0
            ? <div style={{ color:"var(--zx-text3)", textAlign:"center", marginTop:"40px" }}>No reels uploaded yet.</div>
            : <div className="profileVideos">
                {allUserReels.map((reel) => {
                  const isEditableReel = user.isOwner && reel.id.startsWith("db_");
                  return (
                    <div key={reel.id} style={{ position:"relative", minWidth:0 }}>
                      <div className="profileVideo_block" style={{ cursor:"pointer" }}
                        onClick={() => navigate("/reels", { state: { clickedReel: { ...reel, user: reel.user || user.name, username: reel.username || key, profilePic: reel.profilePic || user.profilePic, likes: reel.likes || 0 } } })}>

                        <div
                          className="profileVideo_block_thumbnail reel-thumb"
                          style={{
                            position:    "relative",
                            width:       "100%",
                            overflow:    "hidden",
                            background:  "#1e1b4b",
                          }}
                        >
                          <img
                            src={reel.thumbnail}
                            alt={reel.title}
                            style={{
                              position:   "absolute",
                              top:         0,
                              left:        0,
                              width:       "100%",
                              height:      "100%",
                              objectFit:  "cover",
                              display:    "block",
                              transition: "transform 0.25s",
                            }}
                            onError={(e) => {
                              e.target.src = `https://picsum.photos/seed/${reel.dbId || reel.id}/200/350`;
                            }}
                          />
                          <span style={{ position:"absolute", top:"6px", left:"6px", background:"rgba(0,0,0,0.7)", color:"white", fontSize:"10px", padding:"2px 6px", borderRadius:"4px", fontWeight:"600", zIndex:1 }}>🎬 Reel</span>
                          <span style={{ position:"absolute", bottom:"6px", right:"6px", background:"rgba(0,0,0,0.7)", color:"white", fontSize:"11px", padding:"2px 5px", borderRadius:"4px", zIndex:1 }}>{reel.duration}</span>
                        </div>

                        <div className="profileVideo_block_detail">
                          <div className="profileVideo_block_detai_name">{reel.title}</div>
                          <div className="profileVideo_block_detai_about">{reel.description}</div>
                          <div style={{ color:"var(--zx-text3)", fontSize:"12px", marginTop:"4px", display:"flex", gap:"10px" }}>
                            <span>👁 {reelCounts[`db_${reel.dbId}`]?.views ?? 0}</span>
                            <span>👍 {reelCounts[`db_${reel.dbId}`]?.likes ?? 0}</span>
                          </div>
                        </div>
                      </div>
                      {isEditableReel && (
                        <div style={{ position:"absolute", top:"6px", right:"6px", zIndex:10 }}>
                          <ActionMenu
                            variant="dark"
                            onEdit={() => openEditContent("reel", reel)}
                            onDelete={() => confirmDelete("reel", reel.id, reel.dbId, reel.title)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
        )}

        {/* ── Posts Tab ── */}
        {activeTab === "posts" && (
          <div style={{ maxWidth:"680px", margin:"0 auto" }}>
            {userPosts.length === 0 ? (
              <div style={{ color:"var(--zx-text3)", textAlign:"center", marginTop:"40px" }}>
                <div style={{ fontSize:"40px", marginBottom:"12px" }}>📭</div>
                <p>No posts yet.</p>
              </div>
            ) : (
              userPosts.map((post) => (
                <ProfilePostCard
                  key={post.id}
                  post={post}
                  isOwner={user.isOwner}
                  onDelete={handleDeletePost}
                  onEdit={openEditPost}
                  onReactionChange={handleReactionChange}
                  onAddComment={handleAddComment}
                />
              ))
            )}
          </div>
        )}

        </div>
        {/* ── end swipeable tab content ── */}
      </div>

      {/* ── Connections Modal ── */}
      {showConnectionsModal && <ConnectionsModal channelUsername={key} onClose={() => setShowConnectionsModal(false)} />}

      {/* ── Edit Profile Modal ── */}
      {showEditProfile && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.85)", zIndex:999999, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={(e) => e.target === e.currentTarget && setShowEditProfile(false)}>
          <div style={{ background:"#ffffff", borderRadius:"16px", padding:"32px", width:"100%", maxWidth:"440px", border:"2px solid var(--zx-border)", display:"flex", flexDirection:"column", gap:"16px", boxShadow:"0 8px 40px rgba(124,58,237,0.15)" }}>
            <h2 style={{ color:"var(--zx-text)", margin:0, fontSize:"20px", fontFamily:"Nunito, sans-serif", fontWeight:900 }}>✏️ Edit Profile</h2>
            <div style={{ display:"flex", alignItems:"center", gap:"16px" }}>
              <img src={editPic || user.profilePic} alt="preview" style={{ width:"72px", height:"72px", borderRadius:"50%", objectFit:"cover", border:"3px solid var(--zx-primary)", boxShadow:"0 0 0 3px rgba(124,58,237,0.12)" }}
                onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(editName || user.name)}&background=7c3aed&color=fff&size=72`; }} />
              <div style={{ flex:1 }}>
                <p style={{ color:"var(--zx-text3)", fontSize:"13px", margin:"0 0 6px" }}>Paste Image URL</p>
                <input value={editPic} onChange={(e) => setEditPic(e.target.value)} placeholder="https://..." style={{ width:"100%", background:"var(--zx-bg)", border:"2px solid var(--zx-border)", borderRadius:"8px", color:"var(--zx-text)", padding:"8px 12px", fontSize:"13px", outline:"none", boxSizing:"border-box" }} />
              </div>
            </div>
            <div>
              <p style={{ color:"var(--zx-text3)", fontSize:"13px", margin:"0 0 6px" }}>Or upload a new photo:</p>
              {/* ── Profile photo upload — now goes to R2 instead of Cloudinary ── */}
              <input type="file" accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files[0]; if (!file) return;
                  setEditLoading(true);
                  try {
                    const { url } = await uploadToR2(file);
                    const transformedUrl = buildTransformUrl(url, { width: 150, height: 150, fit: "cover" });
                    setEditPic(transformedUrl);
                  }
                  catch { alert("Upload failed. Try again."); }
                  setEditLoading(false);
                }}
                style={{ color:"var(--zx-text2)", fontSize:"13px" }} />
              {editLoading && <p style={{ color:"var(--zx-primary)", fontSize:"12px", margin:"4px 0 0" }}>Uploading photo...</p>}
            </div>
            <div>
              <p style={{ color:"var(--zx-text3)", fontSize:"13px", margin:"0 0 6px" }}>Channel Name <span style={{ fontWeight:400 }}>(display name)</span></p>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={user.name}
                style={{ width:"100%", background:"var(--zx-bg)", border:"2px solid var(--zx-border)", borderRadius:"8px", color:"var(--zx-text)", padding:"10px 12px", fontSize:"14px", outline:"none", boxSizing:"border-box", fontFamily:"Outfit, sans-serif" }} />
              <p style={{ color:"var(--zx-text3)", fontSize:"11px", margin:"4px 0 0" }}>Your @username ({user.handle}) cannot be changed here.</p>
            </div>
            <div>
              <p style={{ color:"var(--zx-text3)", fontSize:"13px", margin:"0 0 6px" }}>About</p>
              <input value={editAbout} onChange={(e) => setEditAbout(e.target.value)} placeholder={user.about}
                style={{ width:"100%", background:"var(--zx-bg)", border:"2px solid var(--zx-border)", borderRadius:"8px", color:"var(--zx-text)", padding:"10px 12px", fontSize:"14px", outline:"none", boxSizing:"border-box", fontFamily:"Outfit, sans-serif" }} />
            </div>
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={handleSaveProfile} disabled={editLoading}
                style={{ flex:1, background: editLoading ? "#c4b5fd" : "var(--zx-primary)", color:"white", border:"none", borderRadius:"10px", padding:"12px", fontSize:"15px", fontWeight:"700", cursor: editLoading ? "not-allowed" : "pointer", fontFamily:"Nunito, sans-serif", transition:"background 0.2s" }}>
                {editLoading ? "Uploading..." : "Save Changes"}
              </button>
              <button onClick={() => { setShowEditProfile(false); setEditName(""); setEditAbout(""); setEditPic(""); }}
                style={{ flex:1, background:"none", border:"2px solid var(--zx-border)", color:"var(--zx-text2)", borderRadius:"10px", padding:"12px", fontSize:"14px", cursor:"pointer", fontFamily:"Nunito, sans-serif" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Video / Reel Content Modal ── */}
      {editContentTarget && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.85)", zIndex:999999, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={(e) => e.target === e.currentTarget && closeEditContent()}>
          <div style={{ background:"#ffffff", borderRadius:"16px", padding:"32px", width:"100%", maxWidth:"440px", border:"2px solid var(--zx-border)", display:"flex", flexDirection:"column", gap:"16px", boxShadow:"0 8px 40px rgba(124,58,237,0.15)" }}>
            <h2 style={{ color:"var(--zx-text)", margin:0, fontSize:"20px", fontFamily:"Nunito, sans-serif", fontWeight:900 }}>
              ✏️ Edit {editContentTarget.type === "video" ? "Video" : "Reel"}
            </h2>

            <div style={{ display:"flex", alignItems:"center", gap:"16px" }}>
              <img src={editContentThumbnail} alt="thumbnail preview"
                style={{ width:"64px", height: editContentTarget.type === "reel" ? "96px" : "64px", objectFit:"cover", borderRadius:"8px", border:"2px solid var(--zx-primary)", flexShrink:0, background:"#1e1b4b" }}
                onError={(e) => { e.target.style.opacity = 0.3; }} />
              <div style={{ flex:1 }}>
                <p style={{ color:"var(--zx-text3)", fontSize:"13px", margin:"0 0 6px" }}>Paste Thumbnail URL</p>
                <input value={editContentThumbnail} onChange={(e) => setEditContentThumbnail(e.target.value)} placeholder="https://..."
                  style={{ width:"100%", background:"var(--zx-bg)", border:"2px solid var(--zx-border)", borderRadius:"8px", color:"var(--zx-text)", padding:"8px 12px", fontSize:"13px", outline:"none", boxSizing:"border-box" }} />
              </div>
            </div>

            <div>
              <p style={{ color:"var(--zx-text3)", fontSize:"13px", margin:"0 0 6px" }}>Or upload a new thumbnail:</p>
              <input type="file" accept="image/*" onChange={handleEditContentThumbnailUpload} style={{ color:"var(--zx-text2)", fontSize:"13px" }} />
              {editContentLoading && <p style={{ color:"var(--zx-primary)", fontSize:"12px", margin:"4px 0 0" }}>Uploading thumbnail...</p>}
            </div>

            <div>
              <p style={{ color:"var(--zx-text3)", fontSize:"13px", margin:"0 0 6px" }}>Title</p>
              <input value={editContentTitle} onChange={(e) => setEditContentTitle(e.target.value)} placeholder="Title"
                style={{ width:"100%", background:"var(--zx-bg)", border:"2px solid var(--zx-border)", borderRadius:"8px", color:"var(--zx-text)", padding:"10px 12px", fontSize:"14px", outline:"none", boxSizing:"border-box", fontFamily:"Outfit, sans-serif" }} />
            </div>

            {editContentTarget.type === "reel" && (
              <div>
                <p style={{ color:"var(--zx-text3)", fontSize:"13px", margin:"0 0 6px" }}>Description</p>
                <input value={editContentDescription} onChange={(e) => setEditContentDescription(e.target.value)} placeholder="Description"
                  style={{ width:"100%", background:"var(--zx-bg)", border:"2px solid var(--zx-border)", borderRadius:"8px", color:"var(--zx-text)", padding:"10px 12px", fontSize:"14px", outline:"none", boxSizing:"border-box", fontFamily:"Outfit, sans-serif" }} />
              </div>
            )}

            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={handleSaveContentEdit} disabled={editContentSaving}
                style={{ flex:1, background: editContentSaving ? "#c4b5fd" : "var(--zx-primary)", color:"white", border:"none", borderRadius:"10px", padding:"12px", fontSize:"15px", fontWeight:"700", cursor: editContentSaving ? "not-allowed" : "pointer", fontFamily:"Nunito, sans-serif", transition:"background 0.2s" }}>
                {editContentSaving ? "Saving..." : "Save Changes"}
              </button>
              <button onClick={closeEditContent}
                style={{ flex:1, background:"none", border:"2px solid var(--zx-border)", color:"var(--zx-text2)", borderRadius:"10px", padding:"12px", fontSize:"14px", cursor:"pointer", fontFamily:"Nunito, sans-serif" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Post Modal ── */}
      {editPostTarget && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.85)", zIndex:999999, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={(e) => e.target === e.currentTarget && closeEditPost()}>
          <div style={{ background:"#ffffff", borderRadius:"16px", padding:"32px", width:"100%", maxWidth:"440px", border:"2px solid var(--zx-border)", display:"flex", flexDirection:"column", gap:"16px", boxShadow:"0 8px 40px rgba(124,58,237,0.15)" }}>
            <h2 style={{ color:"var(--zx-text)", margin:0, fontSize:"20px", fontFamily:"Nunito, sans-serif", fontWeight:900 }}>
              ✏️ Edit Post
            </h2>

            {(editPostTarget.image_urls?.length > 0 || editPostTarget.image_url) && (
              <div style={{ display:"flex", gap:"6px", overflowX:"auto" }}>
                {(editPostTarget.image_urls?.length > 0 ? editPostTarget.image_urls : [editPostTarget.image_url]).map((url, i) => (
                  <img key={i} src={url} alt={`attached ${i + 1}`} style={{ width:"64px", height:"64px", objectFit:"cover", borderRadius:"8px", border:"2px solid var(--zx-border)", flexShrink:0 }} />
                ))}
              </div>
            )}
            {(editPostTarget.image_urls?.length > 0 || editPostTarget.image_url) && (
              <p style={{ color:"var(--zx-text3)", fontSize:"11px", margin:"-10px 0 0" }}>Images can't be changed here — delete and repost to swap them.</p>
            )}

            {/* ── NEW: video preview + note in edit modal ── */}
            {editPostTarget.video_url && (
              <>
                <video
                  src={editPostTarget.video_url}
                  controls
                  style={{ width:"100%", maxHeight:"180px", borderRadius:"8px", border:"2px solid var(--zx-border)", background:"#000" }}
                />
                <p style={{ color:"var(--zx-text3)", fontSize:"11px", margin:"-10px 0 0" }}>Video can't be changed here — delete and repost to swap it.</p>
              </>
            )}

            <div>
              <p style={{ color:"var(--zx-text3)", fontSize:"13px", margin:"0 0 6px" }}>Text</p>
              <textarea
                value={editPostText}
                onChange={(e) => setEditPostText(e.target.value)}
                placeholder="What's on your mind?"
                rows={4}
                style={{ width:"100%", background:"var(--zx-bg)", border:"2px solid var(--zx-border)", borderRadius:"8px", color:"var(--zx-text)", padding:"10px 12px", fontSize:"14px", outline:"none", boxSizing:"border-box", fontFamily:"Outfit, sans-serif", resize:"vertical" }}
              />
            </div>

            <div>
              <p style={{ color:"var(--zx-text3)", fontSize:"13px", margin:"0 0 6px" }}>Feeling <span style={{ fontWeight:400 }}>(optional)</span></p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                <button
                  onClick={() => setEditPostFeeling("")}
                  style={{
                    background: editPostFeeling === "" ? "rgba(124,58,237,0.1)" : "var(--zx-bg)",
                    border: editPostFeeling === "" ? "2px solid var(--zx-primary)" : "2px solid var(--zx-border)",
                    color: editPostFeeling === "" ? "var(--zx-primary)" : "var(--zx-text3)",
                    borderRadius:"20px", padding:"5px 12px", fontSize:"12px", fontWeight:"700", cursor:"pointer",
                  }}
                >
                  None
                </button>
                {FEELINGS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setEditPostFeeling(editPostFeeling === f ? "" : f)}
                    style={{
                      background: editPostFeeling === f ? "rgba(124,58,237,0.1)" : "var(--zx-bg)",
                      border: editPostFeeling === f ? "2px solid var(--zx-primary)" : "2px solid var(--zx-border)",
                      color: editPostFeeling === f ? "var(--zx-primary)" : "var(--zx-text3)",
                      borderRadius:"20px", padding:"5px 12px", fontSize:"12px", fontWeight:"700", cursor:"pointer",
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p style={{ color:"var(--zx-text3)", fontSize:"13px", margin:"0 0 6px" }}>Privacy</p>
              <select
                value={editPostPrivacy}
                onChange={(e) => setEditPostPrivacy(e.target.value)}
                style={{ width:"100%", background:"var(--zx-bg)", border:"2px solid var(--zx-border)", borderRadius:"8px", color:"var(--zx-text)", padding:"10px 12px", fontSize:"14px", outline:"none", boxSizing:"border-box", fontFamily:"Outfit, sans-serif", cursor:"pointer" }}
              >
                {PRIVACY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.icon} {o.label}</option>
                ))}
              </select>
            </div>

            {editPostError && <p style={{ color:"#e11d48", fontSize:"13px", margin:0, fontWeight:600 }}>{editPostError}</p>}

            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={handleSaveEditPost} disabled={editPostSaving}
                style={{ flex:1, background: editPostSaving ? "#c4b5fd" : "var(--zx-primary)", color:"white", border:"none", borderRadius:"10px", padding:"12px", fontSize:"15px", fontWeight:"700", cursor: editPostSaving ? "not-allowed" : "pointer", fontFamily:"Nunito, sans-serif", transition:"background 0.2s" }}>
                {editPostSaving ? "Saving..." : "Save Changes"}
              </button>
              <button onClick={closeEditPost}
                style={{ flex:1, background:"none", border:"2px solid var(--zx-border)", color:"var(--zx-text2)", borderRadius:"10px", padding:"12px", fontSize:"14px", cursor:"pointer", fontFamily:"Nunito, sans-serif" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Modal ── */}
      {deleteTarget && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.85)", zIndex:999999, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div style={{ background:"#212121", borderRadius:"16px", padding:"32px", width:"100%", maxWidth:"380px", border:"1px solid #555", display:"flex", flexDirection:"column", gap:"16px", textAlign:"center" }}>
            <div style={{ fontSize:"40px" }}>🗑️</div>
            <h2 style={{ color:"white", margin:0, fontSize:"18px" }}>Delete {deleteTarget.type}?</h2>
            <p style={{ color:"#aaa", fontSize:"14px", margin:0 }}>"<strong style={{ color:"white" }}>{deleteTarget.title}</strong>" will be permanently removed.</p>
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={handleDelete} style={{ flex:1, background:"#cc0000", color:"white", border:"none", borderRadius:"8px", padding:"12px", fontSize:"15px", fontWeight:"700", cursor:"pointer" }}>Yes, Delete</button>
              <button onClick={() => setDeleteTarget(null)} style={{ flex:1, background:"none", border:"1px solid #555", color:"#aaa", borderRadius:"8px", padding:"12px", fontSize:"14px", cursor:"pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Profile;