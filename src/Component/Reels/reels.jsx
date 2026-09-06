import React, { useState, useRef, useEffect } from "react";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ReplyIcon from "@mui/icons-material/Reply";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import GrassOutlinedIcon from "@mui/icons-material/GrassOutlined";
import ContentCutOutlinedIcon from "@mui/icons-material/ContentCutOutlined";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
// CHANGED: CheckIcon removed — the Connect button now shows a plain
// text label ("Connect" / "Requested" / "✓ Connected"), same as
// PostCard.jsx and Video.jsx, instead of a separate MUI check icon.
import "./reels.css";
import { Link, useLocation, useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import useViewTracker from "./useViewTracker";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ReportModal from "../Moderation/ReportModal";
import useNetworkQuality from "../../hooks/useNetworkQuality";
import { getAdaptiveVideoSrc } from "../../utils/videoQuality";
import ExpandableText from "../ExpandableText/ExpandableText";
import AdUnit from "../../Component/Ads/AdUnit";
// NOTE: notifyUser() is no longer imported/used anywhere in this file.
// Like/comment notifications are owned by the notify_on_like /
// notify_on_comment DB triggers, and Connect requests/accepts are owned
// by the notify_on_subscribe / notify_on_connect_accept DB triggers —
// client-side calls for all of these were removed since they duplicated
// the triggers' own notifications. See connection_request_migration.sql.

const getVideoType = (src) => {
  if (!src) return "video/mp4";
  if (src.includes(".mp4")) return "video/mp4";
  if (src.includes(".webm")) return "video/webm";
  if (src.includes(".mov")) return "video/quicktime";
  if (src.includes(".mkv")) return "video/x-matroska";
  if (src.includes(".avi")) return "video/x-msvideo";
  if (src.includes(".wmv")) return "video/x-ms-wmv";
  if (src.includes(".flv")) return "video/x-flv";
  return "video/mp4";
};

const fetchCount = async (contentId, contentType, reactionType) => {
  const { count } = await supabase
    .from("likes")
    .select("id", { count: "exact", head: true })
    .match({ content_id: String(contentId), content_type: contentType, reaction_type: reactionType });
  return Math.max(0, count ?? 0);
};

let globalMuted = false;
const muteListeners = new Set();
const setGlobalMuted = (val) => {
  globalMuted = val;
  muteListeners.forEach((fn) => fn(val));
};

const QUALITY_LABELS = {
  low: "240p",
  medium: "360p",
  high: "720p HD",
};

const timeAgo = (dateStr) => {
  if (!dateStr) return "";

  let normalized = dateStr;
  if (typeof normalized === "string" && !/[zZ]|[+-]\d\d:?\d\d$/.test(normalized)) {
    normalized = normalized.replace(" ", "T") + "Z";
  }

  const date = new Date(normalized);
  if (isNaN(date)) return dateStr;
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
};

const VIEWED_KEY  = "zixplon_viewed_reels";
const FRESH_KEY   = "zixplon_fresh_reels";

const getViewedReels = () => {
  try { return JSON.parse(localStorage.getItem(VIEWED_KEY) || "[]"); }
  catch { return []; }
};

const getFreshReels = () => {
  try { return JSON.parse(sessionStorage.getItem(FRESH_KEY) || "[]"); }
  catch { return []; }
};

export const markReelFresh = (id) => {
  const fresh = getFreshReels();
  if (!fresh.includes(String(id))) {
    fresh.push(String(id));
    sessionStorage.setItem(FRESH_KEY, JSON.stringify(fresh));
  }
};

const markReelViewed = (id) => {
  const fresh = getFreshReels().filter((f) => f !== String(id));
  sessionStorage.setItem(FRESH_KEY, JSON.stringify(fresh));
  const viewed = getViewedReels();
  if (!viewed.includes(String(id))) {
    viewed.push(String(id));
    localStorage.setItem(VIEWED_KEY, JSON.stringify(viewed));
  }
};

const isNewReel = (reel) => {
  const id = String(reel.id);
  if (!id.startsWith("db_")) return false;
  if (getViewedReels().includes(id)) return false;
  if (getFreshReels().includes(id)) return true;
  if (reel.created_at) {
    const age = Date.now() - new Date(reel.created_at).getTime();
    return age <= 7 * 24 * 60 * 60 * 1000;
  }
  return false;
};

const MoreDropdown = ({ onRemix, onSound, onCollab, onGreenScreen, onCut, onReport, onClose }) => {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [onClose]);

  const items = [
    { icon: <MusicNoteIcon style={{ fontSize: 18 }} />,         label: "Remix",        color: "#a855f7", onClick: onRemix },
    { icon: <span style={{ fontSize: 17 }}>🎵</span>,           label: "Use Sound",    color: "#f97316", onClick: onSound },
    { icon: <PeopleAltOutlinedIcon style={{ fontSize: 18 }} />,  label: "Collab",       color: "#06b6d4", onClick: onCollab },
    { icon: <GrassOutlinedIcon style={{ fontSize: 18 }} />,      label: "Green Screen", color: "#22c55e", onClick: onGreenScreen },
    { icon: <ContentCutOutlinedIcon style={{ fontSize: 18 }} />, label: "Cut Video",    color: "#f43f5e", onClick: onCut },
    { icon: <span style={{ fontSize: 18 }}>🚩</span>,            label: "Report",       color: "#f43f5e", onClick: onReport },
  ];

  return (
    <div className="reel_more_dropdown" ref={ref}>
      {items.map((item) => (
        <div
          key={item.label}
          className="reel_more_dropdown_item"
          onClick={() => { onClose(); item.onClick(); }}
          style={{ "--item-color": item.color }}
        >
          <span className="reel_more_dropdown_icon" style={{ color: item.color }}>{item.icon}</span>
          <span className="reel_more_dropdown_label">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

const ReelAdSlide = () => (
  <div className="reel_item" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
    <div style={{ width: "100%", maxWidth: "420px", padding: "0 16px" }}>
      <div style={{ color: "#8b84c4", fontSize: "12px", fontWeight: "700", textAlign: "center", marginBottom: "10px", letterSpacing: "0.5px" }}>
        SPONSORED
      </div>
      <AdUnit slot="9284710365" style={{ display: "block", minHeight: "250px" }} />
    </div>
  </div>
);

const ReelItem = ({ reel, allReels }) => {
  const navigate = useNavigate();
  const videoRef        = useRef(null);
  const containerRef    = useRef(null);
  const isMounted       = useRef(true);
  const observerRef     = useRef(null);
  const iconTimeoutRef  = useRef(null);
  const commentPanelRef = useRef(null);
  const commentBtnRef   = useRef(null);
  const lastTapRef      = useRef(0);
  const tapTimeoutRef   = useRef(null);
  const muteBtnTimerRef = useRef(null);
  const progressBarRef  = useRef(null);

  const loggedInUser = localStorage.getItem("username") || "Guest";

  // CHANGED: connected (boolean) → connectionStatus (null | "pending" |
  // "accepted"), same three-state model as PostCard.jsx / Video.jsx.
  const [connectionStatus, setConnectionStatus] = useState(null);
  // NEW: connectLoading — same debounce/disable guard PostCard.jsx uses,
  // so a double-click (or double-tap on mobile) can't fire two
  // overlapping Supabase requests and desync the optimistic UI state.
  const [connectLoading, setConnectLoading]     = useState(false);
  const [liked, setLiked]                       = useState(false);
  const [disliked, setDisliked]                 = useState(false);
  const [likeCount, setLikeCount]               = useState(0);
  const [dislikeCount, setDislikeCount]         = useState(0);
  const [likeCountLoading, setLikeCountLoading] = useState(true);
  const [isActing, setIsActing]                 = useState(false);
  const [muted, setMuted]                       = useState(globalMuted);
  const [isPlaying, setIsPlaying]               = useState(false);
  const [showIcon, setShowIcon]                 = useState(false);
  const [showComments, setShowComments]         = useState(false);
  const [commentText, setCommentText]           = useState("");
  const [comments, setComments]                 = useState([]);
  const [shareToast, setShareToast]             = useState(false);
  const [actionToast, setActionToast]           = useState({ show: false, msg: "", type: "" });
  const [showMoreMenu, setShowMoreMenu]         = useState(false);
  const [viewCount, setViewCount]               = useState(0);
  const [showHeartBurst, setShowHeartBurst]     = useState(false);
  const [showMuteBtn, setShowMuteBtn]           = useState(true);
  const [showNewBadge, setShowNewBadge]         = useState(false);
  const [showReportModal, setShowReportModal]   = useState(false);
  const [progress, setProgress]                 = useState(0);

  const quality = useNetworkQuality();

  useEffect(() => {
    setShowNewBadge(isNewReel(reel));
  }, [reel.id]);

  const showToast = (msg, type = "") => {
    setActionToast({ show: true, msg, type });
    setTimeout(() => setActionToast({ show: false, msg: "", type: "" }), 950);
  };

  const requireLogin = () => {
    if (!localStorage.getItem("username")) {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return false;
    }
    return true;
  };

  const goToUpload = (state) => {
    if (videoRef.current) videoRef.current.pause();
    setTimeout(() => navigate("/763/upload", { state }), 900);
  };

  useEffect(() => {
    const listener = (val) => { setMuted(val); if (videoRef.current) videoRef.current.muted = val; };
    muteListeners.add(listener);
    return () => muteListeners.delete(listener);
  }, []);

  useEffect(() => {
    if (!showComments) return;
    const handleOutsideClick = (e) => {
      if (
        commentPanelRef.current &&
        !commentPanelRef.current.contains(e.target) &&
        commentBtnRef.current &&
        !commentBtnRef.current.contains(e.target)
      ) {
        setShowComments(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showComments]);

  useEffect(() => {
    const loadReactions = async () => {
      const userId = localStorage.getItem("userId");
      const lCount = await fetchCount(reel.id, "reel", "like");
      const dCount = await fetchCount(reel.id, "reel", "dislike");
      setLikeCount(lCount);
      setDislikeCount(dCount);
      setLikeCountLoading(false);
      if (!userId) return;
      const { data: likeData }    = await supabase.from("likes").select("id").match({ user_id: userId, content_id: String(reel.id), content_type: "reel", reaction_type: "like" }).maybeSingle();
      setLiked(!!likeData);
      const { data: dislikeData } = await supabase.from("likes").select("id").match({ user_id: userId, content_id: String(reel.id), content_type: "reel", reaction_type: "dislike" }).maybeSingle();
      setDisliked(!!dislikeData);
    };
    loadReactions();
  }, [reel.id]);

  useEffect(() => {
    const loadViewCount = async () => {
      const { count } = await supabase.from("views").select("id", { count: "exact", head: true }).match({ content_id: String(reel.id), content_type: "reel" });
      setViewCount(count ?? 0);
    };
    loadViewCount();
  }, [reel.id]);

  // CHANGED: this loader now also runs for the current user's own reels
  // and simply skips setting state when username === reel.username — but
  // to keep behavior identical to before (button never renders on own
  // reels anyway) it still returns early. Now also reads `status` so the
  // button can render its three states (Connect / Requested / ✓
  // Connected) instead of just on/off.
  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    const loadConnection = async () => {
      const { data, error } = await supabase
        .from("connections")
        .select("id, status")
        .match({ connector_id: userId, connected_to: reel.username })
        .maybeSingle();
      if (error) console.error("loadConnection error:", error);
      setConnectionStatus(data?.status || null);
    };
    loadConnection();

    // FIX: keep connectionStatus in sync when the other person accepts
    // or declines from elsewhere (the bell dropdown or /notifications
    // page) while this reel is already mounted. Previously this only
    // ever fetched once on mount, so the button stayed stuck on
    // "Requested" indefinitely — nothing here ever re-queried the
    // connections table until the reel remounted or the page reloaded.
    //
    // Realtime filters can only match a single column server-side, so
    // this subscribes on connector_id (always this viewer's own userId
    // — set at insert time in handleConnect below) and narrows to this
    // specific reel's uploader client-side. Same per-user
    // channel-scoping pattern already used for the notifications/
    // DM-badge channels in Navbar.jsx and the connection-status channel
    // in PostCard.jsx / Video.jsx.
    const channel = supabase
      .channel(`reel-connection-${userId}-${reel.username}`)
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
          if (row?.connected_to !== reel.username) return;
          setConnectionStatus(
            payload.eventType === "DELETE" ? null : payload.new?.status || null,
          );
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [reel.username]);

  useEffect(() => {
    const loadComments = async () => {
      const { data } = await supabase.from("comments").select("*").match({ content_id: String(reel.id), content_type: "reel" }).order("created_at", { ascending: false });
      if (data && data.length > 0) {
        setComments(data.map((c) => ({ id: c.id, user: c.username, text: c.text, date: c.created_at })));
      }
    };
    loadComments();
  }, [reel.id]);

  useViewTracker({ contentId: reel.id, contentType: "reel", isPlaying });

  useEffect(() => {
    if (isYouTube(reel.src)) return;
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reel.src]);

  // ── Connect / Withdraw-Disconnect — now wired identically to
  //    PostCard.jsx and Video.jsx: dispatch "openLogin" instead of
  //    alert() when logged out, a self-connect guard, a connectLoading
  //    guard against double-fires, optimistic status transitions with
  //    rollback + console.error logging on failure. A fresh Connect
  //    click inserts as status: "pending" instead of connecting
  //    instantly — the other person has to accept it (from the
  //    Notifications page) before the connection is "accepted". No
  //    notifyUser() call on insert anymore — the notify_on_subscribe DB
  //    trigger owns that notification now, so a client-side call here
  //    would duplicate it.
  const handleConnect = async (e) => {
    if (e) e.preventDefault();
    if (!localStorage.getItem("username")) {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    const userId = localStorage.getItem("userId");
    if (!userId) {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    if (userId === reel.username) return; // self-connect guard
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
          .match({ connector_id: userId, connected_to: reel.username });
        if (error) {
          console.error("handleConnect delete error:", error);
          setConnectionStatus(wasStatus); // rollback
        }
      } else {
        setConnectionStatus("pending");
        const { error } = await supabase.from("connections").insert({
          connector_id: userId,
          connector_username: loggedInUser,
          connected_to: reel.username,
          status: "pending",
        });
        if (error) {
          console.error("handleConnect insert error:", error);
          setConnectionStatus(null); // rollback
        }
      }
    } finally {
      setConnectLoading(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (!commentText.trim()) return;
    const userId = localStorage.getItem("userId");
    if (!userId) { alert("Please login to comment"); return; }
    const { data, error } = await supabase.from("comments").insert({ user_id: userId, username: loggedInUser, content_id: String(reel.id), content_type: "reel", text: commentText }).select().single();
    if (!error && data) {
      setComments((prev) => [{ id: data.id, user: data.username, text: data.text, date: data.created_at }, ...prev]);
      // Comment notifications are handled by the notify_on_comment DB
      // trigger on the comments table — no client-side notifyUser()
      // call here.
    }
    setCommentText("");
  };

  const handleShare = () => {
    const isDbReel = String(reel.id).startsWith("db_");
    const shareId = reel.short_id || String(reel.id).replace("db_", "");
    const url = isDbReel
      ? `https://zixplon.in/api/og?type=reel&id=${shareId}`
      : `https://zixplon.in/reels/${reel.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2500);
  };

  const handleRemix = () => {
    if (!requireLogin()) return;
    const currentUser = localStorage.getItem("username");
    if (currentUser === reel.username) { alert("You cannot remix your own reel"); return; }
    showToast("🎬 Opening remix editor...", "remix");
    goToUpload({
      remixData: {
        remixed_from_id:        String(reel.id).replace("db_", ""),
        remixed_from_username:  reel.username,
        remixed_from_user:      reel.user,
        remixed_from_title:     reel.title,
        remixed_from_thumbnail: reel.thumbnail,
      },
    });
  };

  const handleUseSound = () => {
    if (!requireLogin()) return;
    showToast("🎵 Loading sound...", "sound");
    goToUpload({
      soundData: {
        sound_from_id:        String(reel.id).replace("db_", ""),
        sound_from_username:  reel.username,
        sound_from_title:     reel.title,
        sound_from_thumbnail: reel.thumbnail,
        sound_video_url:      reel.src,
      },
    });
  };

  const handleCollab = () => {
    if (!requireLogin()) return;
    const currentUser = localStorage.getItem("username");
    if (currentUser === reel.username) { alert("You cannot collab with yourself"); return; }
    showToast("🤝 Setting up collab...", "collab");
    goToUpload({
      collabData: {
        collab_with_id:        String(reel.id).replace("db_", ""),
        collab_with_username:  reel.username,
        collab_with_user:      reel.user,
        collab_with_title:     reel.title,
        collab_with_thumbnail: reel.thumbnail,
        collab_video_url:      reel.src,
      },
    });
  };

  const handleGreenScreen = () => {
    if (!requireLogin()) return;
    showToast("💚 Opening green screen...", "greenscreen");
    goToUpload({
      greenScreenData: {
        bg_reel_id:        String(reel.id).replace("db_", ""),
        bg_reel_username:  reel.username,
        bg_reel_title:     reel.title,
        bg_reel_thumbnail: reel.thumbnail,
        bg_video_url:      reel.src,
      },
    });
  };

  const handleCut = () => {
    if (!requireLogin()) return;
    showToast("✂️ Opening cut editor...", "cut");
    goToUpload({
      cutData: {
        cut_from_id:        String(reel.id).replace("db_", ""),
        cut_from_username:  reel.username,
        cut_from_title:     reel.title,
        cut_from_thumbnail: reel.thumbnail,
        cut_video_url:      reel.src,
      },
    });
  };

  const handleReport = () => {
    if (!localStorage.getItem("username")) {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    setShowReportModal(true);
  };

  const isYouTube = (url) => url && (url.includes("youtube.com") || url.includes("youtu.be"));
  const getEmbedUrl = (url) => {
    if (url.includes("youtube.com/shorts/")) { const id = url.split("/shorts/")[1].split("?")[0]; return `https://www.youtube.com/embed/${id}?autoplay=1&loop=1`; }
    if (url.includes("watch?v="))            { const id = url.split("watch?v=")[1].split("&")[0]; return `https://www.youtube.com/embed/${id}?autoplay=1&loop=1`; }
    if (url.includes("youtu.be/"))           { const id = url.split("youtu.be/")[1].split("?")[0]; return `https://www.youtube.com/embed/${id}?autoplay=1&loop=1`; }
    return url;
  };

  useEffect(() => {
    if (isYouTube(reel.src)) return;
    isMounted.current = true;
    const video     = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (!isMounted.current) return;
        if (entry.isIntersecting) {
          window.history.replaceState(null, "", `/reels/${reel.id}`);
          document.querySelectorAll("video").forEach((v) => { if (v !== video) v.pause(); });
          video.muted = globalMuted;
          video.play().catch(() => {});
          setIsPlaying(true);
          setShowMuteBtn(true);
          clearTimeout(muteBtnTimerRef.current);
          muteBtnTimerRef.current = setTimeout(() => setShowMuteBtn(false), 3000);
          setTimeout(() => {
            markReelViewed(reel.id);
            setShowNewBadge(false);
          }, 2000);
        } else {
          video.pause();
          setIsPlaying(false);
        }
      },
      { threshold: 0.7 },
    );
    observerRef.current.observe(container);
    return () => {
      isMounted.current = false;
      observerRef.current?.disconnect();
      clearTimeout(iconTimeoutRef.current);
      clearTimeout(tapTimeoutRef.current);
      clearTimeout(muteBtnTimerRef.current);
      if (videoRef.current) { videoRef.current.pause(); videoRef.current.src = ""; }
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !reel.src?.includes("cloudinary.com")) return;
    const wasPlaying = !video.paused;
    const resumeTime = video.currentTime;
    video.load();
    video.currentTime = resumeTime;
    video.muted = globalMuted;
    if (wasPlaying) video.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality]);

  const flashIcon = () => {
    setShowIcon(true);
    clearTimeout(iconTimeoutRef.current);
    iconTimeoutRef.current = setTimeout(() => setShowIcon(false), 800);
  };

  const triggerHeartBurst = () => {
    setShowHeartBurst(true);
    setTimeout(() => setShowHeartBurst(false), 1000);
  };

  const likeReel = async () => {
    const userId = localStorage.getItem("userId");
    if (!userId || liked || isActing) return;
    setIsActing(true);
    try {
      if (disliked) {
        await supabase.from("likes").delete().match({ user_id: userId, content_id: String(reel.id), content_type: "reel", reaction_type: "dislike" });
        setDisliked(false);
      }
      await supabase.from("likes").upsert({ user_id: userId, content_id: String(reel.id), content_type: "reel", reaction_type: "like" }, { onConflict: "user_id,content_id,content_type,reaction_type" });
      setLiked(true);
      setLikeCount(await fetchCount(reel.id, "reel", "like"));
      setDislikeCount(await fetchCount(reel.id, "reel", "dislike"));
      // Like notifications are handled by the notify_on_like DB trigger
      // on the likes table — no client-side notifyUser() call here.
    } finally { setIsActing(false); }
  };

  const handleVideoClick = () => {
    const now = Date.now();
    const isDoubleTap = now - lastTapRef.current < 300;
    lastTapRef.current = now;
    if (isDoubleTap) {
      clearTimeout(tapTimeoutRef.current);
      triggerHeartBurst();
      likeReel();
      return;
    }
    tapTimeoutRef.current = setTimeout(() => {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) { video.play().catch(() => {}); setIsPlaying(true); }
      else { video.pause(); setIsPlaying(false); }
      flashIcon();
    }, 250);
  };

  const handleToggleMute = (e) => {
    e.stopPropagation();
    const newMuted = !globalMuted;
    setGlobalMuted(newMuted);
    if (videoRef.current) videoRef.current.muted = newMuted;
    setShowMuteBtn(true);
    clearTimeout(muteBtnTimerRef.current);
    muteBtnTimerRef.current = setTimeout(() => setShowMuteBtn(false), 3000);
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    const bar = progressBarRef.current;
    const video = videoRef.current;
    if (!bar || !video || !video.duration) return;
    const rect = bar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.min(Math.max(clickX / rect.width, 0), 1);
    video.currentTime = pct * video.duration;
    setProgress(pct * 100);
  };

  const handleLike = async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) { alert("Please login to like"); return; }
    if (isActing) return;
    setIsActing(true);
    try {
      if (liked) {
        await supabase.from("likes").delete().match({ user_id: userId, content_id: String(reel.id), content_type: "reel", reaction_type: "like" });
        setLiked(false);
      } else {
        if (disliked) {
          await supabase.from("likes").delete().match({ user_id: userId, content_id: String(reel.id), content_type: "reel", reaction_type: "dislike" });
          setDisliked(false);
        }
        await supabase.from("likes").upsert({ user_id: userId, content_id: String(reel.id), content_type: "reel", reaction_type: "like" }, { onConflict: "user_id,content_id,content_type,reaction_type" });
        setLiked(true);
        // Like notifications are handled by the notify_on_like DB
        // trigger on the likes table — no client-side notifyUser()
        // call here.
      }
      setLikeCount(await fetchCount(reel.id, "reel", "like"));
      setDislikeCount(await fetchCount(reel.id, "reel", "dislike"));
    } finally { setIsActing(false); }
  };

  const handleDislike = async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) { alert("Please login to react"); return; }
    if (isActing) return;
    setIsActing(true);
    try {
      if (disliked) {
        await supabase.from("likes").delete().match({ user_id: userId, content_id: String(reel.id), content_type: "reel", reaction_type: "dislike" });
        setDisliked(false);
      } else {
        if (liked) {
          await supabase.from("likes").delete().match({ user_id: userId, content_id: String(reel.id), content_type: "reel", reaction_type: "like" });
          setLiked(false);
        }
        await supabase.from("likes").upsert({ user_id: userId, content_id: String(reel.id), content_type: "reel", reaction_type: "dislike" }, { onConflict: "user_id,content_id,content_type,reaction_type" });
        setDisliked(true);
      }
      setLikeCount(await fetchCount(reel.id, "reel", "like"));
      setDislikeCount(await fetchCount(reel.id, "reel", "dislike"));
    } finally { setIsActing(false); }
  };

  const connectLabel =
    connectionStatus === "accepted"
      ? "✓ Connected"
      : connectionStatus === "pending"
        ? "Requested"
        : "Connect";

  return (
    <div className="reel_item" id={`reel-${reel.id}`} ref={containerRef}>
      <div className="reel_video_wrapper">

        {isYouTube(reel.src) ? (
          <iframe className="reel_video" src={getEmbedUrl(reel.src)} frameBorder="0" allow="autoplay; fullscreen" allowFullScreen title={reel.title} />
        ) : (
          <video ref={videoRef} className="reel_video" loop muted={muted} playsInline poster={reel.thumbnail} controlsList="nodownload" onContextMenu={(e) => e.preventDefault()} onClick={handleVideoClick}>
            <source src={getAdaptiveVideoSrc(reel.src, quality)} type={getVideoType(reel.src)} />
            Your browser does not support this video.
          </video>
        )}

        {!isYouTube(reel.src) && showIcon       && <div className="reel_play_icon">{isPlaying ? "▶" : "⏸"}</div>}
        {!isYouTube(reel.src) && showHeartBurst && <div className="reel_heart_burst">❤️</div>}

        {!isYouTube(reel.src) && showMuteBtn && (
          <button
            key={muted ? "muted" : "unmuted"}
            className="reel_mute_btn"
            onClick={handleToggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeOffIcon sx={{ fontSize: 26 }} /> : <VolumeUpIcon sx={{ fontSize: 26 }} />}
            <span className="reel_mute_btn_label">{muted ? "Tap to unmute" : "Tap to mute"}</span>
          </button>
        )}

        {!isYouTube(reel.src) && reel.src?.includes("cloudinary.com") && (
          <div
            style={{
              position: "absolute",
              top: "16px",
              left: "16px",
              background: "rgba(0,0,0,0.65)",
              color: "#fff",
              fontSize: "12px",
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: "999px",
              zIndex: 5,
              opacity: showMuteBtn ? 1 : 0,
              transition: "opacity 0.3s ease",
              pointerEvents: "none",
              fontFamily: "'Nunito', sans-serif",
              letterSpacing: "0.3px",
            }}
          >
            {QUALITY_LABELS[quality]}
          </div>
        )}

        {reel.remixed_from_username && (
          <div className="reel_remix_origin_badge" onClick={() => navigate(`/reels/db_${reel.remixed_from_id}`)}>
            <MusicNoteIcon style={{ fontSize: "12px" }} />
            🎬 Remixed from @{reel.remixed_from_username}
          </div>
        )}

        {showNewBadge && (
          <div className="reel_new_badge">✨ New</div>
        )}

        {!isYouTube(reel.src) && (
          <div
            className="reel_progress_track"
            ref={progressBarRef}
            onClick={handleSeek}
          >
            <div className="reel_progress_fill" style={{ width: `${progress}%` }} />
          </div>
        )}

        <div className="reel_actions">

          <div
            className={`reel_action_btn reel_like_btn ${liked ? "reel_liked" : ""}`}
            onClick={handleLike}
            style={{ opacity: isActing ? 0.6 : 1, pointerEvents: isActing ? "none" : "auto" }}
          >
            <span className="reel_like_inner">
              <ThumbUpOutlinedIcon style={{ color: liked ? "#ff0000" : "white" }} />
              <span className="reel_like_count">{likeCountLoading ? "..." : likeCount}</span>
            </span>
            <span className="reel_like_emoji">😊</span>
          </div>

          <div
            className={`reel_action_btn ${disliked ? "reel_disliked" : ""}`}
            onClick={handleDislike}
            style={{ opacity: isActing ? 0.6 : 1, pointerEvents: isActing ? "none" : "auto" }}
          >
            <ThumbDownAltOutlinedIcon style={{ color: disliked ? "#ff0000" : "white" }} />
          </div>

          <div
            ref={commentBtnRef}
            className="reel_action_btn"
            onClick={() => setShowComments((v) => !v)}
          >
            <ChatBubbleOutlineIcon style={{ color: showComments ? "#ff0000" : "white" }} />
            <span>{comments.length > 0 ? comments.length : "Comment"}</span>
          </div>

          <div className="reel_action_btn" onClick={handleShare}>
            <ReplyIcon style={{ color: "white", transform: "scaleX(-1)" }} />
            <span>Share</span>
          </div>

          <div
            className={`reel_action_btn reel_more_btn ${showMoreMenu ? "reel_more_btn--open" : ""}`}
            onClick={(e) => { e.stopPropagation(); setShowMoreMenu((v) => !v); }}
          >
            <MoreHorizIcon style={{ color: "white" }} />
            <span>More</span>
            {showMoreMenu && (
              <MoreDropdown
                onRemix={handleRemix}
                onSound={handleUseSound}
                onCollab={handleCollab}
                onGreenScreen={handleGreenScreen}
                onCut={handleCut}
                onReport={handleReport}
                onClose={() => setShowMoreMenu(false)}
              />
            )}
          </div>

        </div>

        {showComments && (
          <div className="reel_comment_panel" ref={commentPanelRef}>
            <div className="reel_comment_input_row">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCommentSubmit()}
                placeholder="Add a comment..."
                className="reel_comment_input"
              />
              <button className="reel_comment_submit" onClick={handleCommentSubmit}>Post</button>
            </div>
            <div className="reel_comment_list">
              {comments.length === 0 ? (
                <div className="reel_comment_item" style={{ color: "#aaa", fontSize: "13px" }}>No comments yet. Be the first!</div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="reel_comment_item">
                    <div className="reel_comment_item_header">
                      <span className="reel_comment_user">{c.user}</span>
                      {c.date && <span className="reel_comment_time">{timeAgo(c.date)}</span>}
                    </div>
                    <span className="reel_comment_text">{c.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {shareToast && <div className="reel_share_toast">Link copied to clipboard ✓</div>}

        {actionToast.show && (
          <div className={`reel_share_toast reel_action_toast reel_action_toast--${actionToast.type}`}>
            {actionToast.msg}
          </div>
        )}

        {showReportModal && (
          <ReportModal
            contentType="reel"
            contentId={reel.id}
            contentTitle={reel.title}
            contentOwner={reel.username}
            onClose={() => setShowReportModal(false)}
          />
        )}

        {/* Bottom user info */}
        <div className="reel_info">
          <div className="reel_user">
            <Link to={`/user/${reel.username}`}>
              <img src={reel.profilePic} alt="profile" className="reel_profile_pic" />
            </Link>
            <Link to={`/user/${reel.username}`} style={{ textDecoration: "none", color: "white" }}>
              <span className="reel_username">{reel.user}</span>
            </Link>
            {/* CHANGED: three-state label (Connect / Requested / ✓
                Connected), same as PostCard.jsx and Video.jsx. */}
            {loggedInUser !== reel.username && (
              <button
                className={`reel_connect_btn ${
                  connectionStatus === "accepted" ? "reel_connect_btn--connected" : ""
                } ${connectionStatus === "pending" ? "reel_connect_btn--pending" : ""}`}
                onClick={handleConnect}
                disabled={connectLoading}
              >
                {connectLabel}
              </button>
            )}
          </div>
          <div className="reel_description">
  <ExpandableText
    text={reel.description}
    maxChars={90}
    toggleClassName="reel_description_toggle"
  />
</div>
        </div>

      </div>
    </div>
  );
};

const Reels = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [dbReels, setDbReels]     = useState([]);
  const [dbLoading, setDbLoading] = useState(true);

  const handleBack = () => {
    if (window.history.length > 2) navigate(-1);
    else navigate("/");
  };

  useEffect(() => {
    document.body.classList.add("reels-open");
    return () => { document.body.classList.remove("reels-open"); };
  }, []);

  useEffect(() => {
    const fetchDbReels = async () => {
      setDbLoading(true);
      const { data, error } = await supabase.from("reels").select("*").order("created_at", { ascending: false });
      if (!error && data) {
        setDbReels(
          data.map((r) => ({
            id:                    `db_${r.id}`,
            short_id:               r.short_id,
            src:                   r.video_url,
            thumbnail:             r.thumbnail || "https://picsum.photos/200/350?random=99",
            title:                 r.title    || "Untitled",
            duration:              r.duration || "00:00",
            user:                  r.user     || r.username || "Unknown",
            username:              r.username || "unknown",
            profilePic:            `https://api.dicebear.com/7.x/initials/svg?seed=${r.username || "user"}`,
            description:           r.description || "",
            likes:                 0,
            created_at:            r.created_at  || null,
            remixed_from_id:       r.remixed_from_id       || null,
            remixed_from_username: r.remixed_from_username || null,
          }))
        );
      }
      setDbLoading(false);
    };
    fetchDbReels();

    const reelsSub = supabase
      .channel("reels-page-channel")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reels" }, (payload) => {
        const r = payload.new;
        markReelFresh(`db_${r.id}`);
        setDbReels((prev) => [{
          id:                    `db_${r.id}`,
          short_id:               r.short_id,
          src:                   r.video_url,
          thumbnail:             r.thumbnail || "https://picsum.photos/200/350?random=99",
          title:                 r.title    || "Untitled",
          duration:              r.duration || "00:00",
          user:                  r.user     || r.username || "Unknown",
          username:              r.username || "unknown",
          profilePic:            `https://api.dicebear.com/7.x/initials/svg?seed=${r.username || "user"}`,
          description:           r.description || "",
          likes:                 0,
          created_at:            r.created_at  || null,
          remixed_from_id:       r.remixed_from_id       || null,
          remixed_from_username: r.remixed_from_username || null,
        }, ...prev]);
      })
      .subscribe();

    return () => supabase.removeChannel(reelsSub);
  }, []);

  const baseReels = React.useMemo(() => dbReels, [dbReels]);

  const fromTrending = location.state?.fromTrending || false;
  const trendingIds = location.state?.trendingIds || null;

  const normalizeReelId = (value) => {
    const str = String(value);
    return str.startsWith("db_") ? str : `db_${str}`;
  };

  const allReels = React.useMemo(() => {
    let pool = baseReels;

    if (fromTrending && trendingIds) {
      const clickedId = location.state?.clickedReel?.id;
      pool = baseReels.filter(
        (r) =>
          trendingIds.includes(String(r.id)) ||
          String(r.id) === String(id) ||
          String(r.id) === String(clickedId),
      );
    }

    if (id) {
      const normalizedId = normalizeReelId(id);
      const target = pool.find(
        (r) => String(r.id) === String(id) || String(r.id) === normalizedId,
      );
      if (target) return [target, ...pool.filter((r) => String(r.id) !== String(target.id))];
    }
    const clickedReel = location.state?.clickedReel;
    if (clickedReel) {
      const rest = pool.filter((r) => String(r.id) !== String(clickedReel.id));
      return [clickedReel, ...rest];
    }
    return pool;
  }, [baseReels, id, location.state, fromTrending, trendingIds]);

  const requestedReelMissing =
    Boolean(id) &&
    !location.state?.clickedReel &&
    !baseReels.some(
      (r) => String(r.id) === String(id) || String(r.id) === normalizeReelId(id),
    );

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) { e.preventDefault(); e.stopPropagation(); }
      if (e.code === "ArrowDown") {
        const items = document.querySelectorAll(".reel_item");
        for (let i = 0; i < items.length; i++) { const r = items[i].getBoundingClientRect(); if (r.top >= 10) { items[i].scrollIntoView({ behavior: "smooth" }); break; } }
      }
      if (e.code === "ArrowUp") {
        const items = document.querySelectorAll(".reel_item");
        for (let i = items.length - 1; i >= 0; i--) { const r = items[i].getBoundingClientRect(); if (r.top < -10) { items[i].scrollIntoView({ behavior: "smooth" }); break; } }
      }
      if (e.code === "Space") {
        document.querySelectorAll(".reel_video").forEach((vid) => { const r = vid.getBoundingClientRect(); if (r.top >= 0 && r.bottom <= window.innerHeight) { vid.paused ? vid.play() : vid.pause(); } });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (dbLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "white", flexDirection: "column", gap: "16px" }}>
        <div style={{ width: "48px", height: "48px", border: "4px solid #333", borderTop: "4px solid #dc2626", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p style={{ color: "#aaa", fontSize: "14px" }}>Loading reels...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (requestedReelMissing) {
    return (
      <>
        <button className="reels_back_btn" onClick={handleBack} aria-label="Go back">
          <ArrowBackIosNewIcon style={{ fontSize: 18 }} />
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "60vh",
            color: "#8b84c4",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ fontSize: "40px" }}>🚫</div>
          <p style={{ fontSize: "15px", fontWeight: "600" }}>
            This reel isn't available
          </p>
          <p style={{ fontSize: "13px", color: "#c4bfdf" }}>
            It may have been deleted, or the link is incorrect.
          </p>
        </div>
      </>
    );
  }

  if (allReels.length === 0) {
    return (
      <>
        <button className="reels_back_btn" onClick={handleBack} aria-label="Go back">
          <ArrowBackIosNewIcon style={{ fontSize: 18 }} />
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "60vh",
            color: "#8b84c4",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ fontSize: "40px" }}>📱</div>
          <p style={{ fontSize: "15px", fontWeight: "600" }}>No reels uploaded yet</p>
        </div>
      </>
    );
  }

  return (
  <>
    <button className="reels_back_btn" onClick={handleBack} aria-label="Go back">
      <ArrowBackIosNewIcon style={{ fontSize: 18 }} />
    </button>

    <div className="reels_container">
      {allReels.map((reel, index) => (
        <React.Fragment key={reel.id}>
          <ReelItem reel={reel} allReels={allReels} />
          {(index + 1) % 5 === 0 && index !== allReels.length - 1 && (
            <ReelAdSlide key={`ad-${index}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  </>
);
};

export default Reels;