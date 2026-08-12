import React, { useState, useRef, useEffect } from "react";
import "./video.css";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import ReplyIcon from "@mui/icons-material/Reply";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../config/supabase";
import useViewTracker from "../../Component/Reels/useViewTracker";
import { logHistory } from "../History/History";
import useNetworkQuality from "../../hooks/useNetworkQuality";
import { getAdaptiveVideoSrc } from "../../utils/videoQuality";
import ReportModal from "../../Component/Moderation/ReportModal";
import ExpandableText from "../../Component/ExpandableText/ExpandableText";
import AdSlot from "../../Component/Ads/AdSlot";
// NEW: shared notification helper — see src/utils/notifications.js
import { notifyUser } from "../../utils/notifications";

const timeAgo = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date)) return dateStr;
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
};

const getCloudinaryThumbnail = (videoUrl) => {
  if (!videoUrl || !videoUrl.includes("cloudinary.com")) return null;
  return videoUrl
    .replace("/video/upload/", "/video/upload/so_0/")
    .replace(/\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i, ".jpg");
};

const getVideoType = (src) => {
  if (!src) return "video/mp4";
  const ext = src.split(".").pop().split("?")[0].toLowerCase();
  const types = {
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    mkv: "video/x-matroska",
    avi: "video/x-msvideo",
    wmv: "video/x-ms-wmv",
    flv: "video/x-flv",
    ogg: "video/ogg",
    ogv: "video/ogg",
  };
  return types[ext] || "video/mp4";
};

const isUnsupportedFormat = (src) => {
  if (!src) return false;
  if (src.includes("cloudinary.com") || src.includes("supabase")) return false;
  const ext = src.split(".").pop().split("?")[0].toLowerCase();
  return ["avi", "wmv", "mkv", "flv"].includes(ext);
};

const QUALITY_LABELS = {
  low: "240p",
  medium: "360p",
  high: "720p HD",
};

const scrollToTopInstant = () => {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  let el = document.getElementById("root");
  while (el) {
    el.scrollTop = 0;
    el = el.parentElement;
  }
};

const scrollToTopDeferred = () => {
  scrollToTopInstant();
  requestAnimationFrame(() => {
    scrollToTopInstant();
    setTimeout(scrollToTopInstant, 0);
    setTimeout(scrollToTopInstant, 100);
  });
};

const isMobileDevice = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(max-width: 768px)").matches ||
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0);

// Fallback avatar generator — used whenever a real avatar_url is missing or fails to load
const getFallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "U"
  )}&background=7c3aed&color=fff&size=42`;

// ─────────────────────────────────────────────────────────────────────────────
// Fullscreen API helpers — cross-browser (standard + webkit/moz/ms prefixes),
// plus the iOS Safari fallback (webkitEnterFullscreen/webkitExitFullscreen,
// which live on the <video> element itself rather than requestFullscreen on
// a wrapper, since iOS Safari doesn't support fullscreening arbitrary
// elements — only the video element's own native player chrome).
// ─────────────────────────────────────────────────────────────────────────────
const getFullscreenElement = () =>
  document.fullscreenElement ||
  document.webkitFullscreenElement ||
  document.mozFullScreenElement ||
  document.msFullscreenElement ||
  null;

const requestFullscreenOn = (el) => {
  if (!el) return;
  if (el.requestFullscreen) el.requestFullscreen();
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  else if (el.webkitEnterFullscreen) el.webkitEnterFullscreen(); // iOS Safari <video>
  else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
  else if (el.msRequestFullscreen) el.msRequestFullscreen();
};

// NEW: checks whether an element actually supports being the fullscreen
// target (arbitrary-element fullscreen isn't available everywhere — e.g.
// iOS Safari only supports it on <video> itself), so we know whether to
// fullscreen our wrapper <div> (keeps our custom overlay controls visible)
// or fall back to fullscreening the bare <video> (native controls only).
const supportsElementFullscreen = (el) =>
  !!(
    el &&
    (el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.mozRequestFullScreen ||
      el.msRequestFullscreen)
  );

const exitFullscreen = () => {
  if (document.exitFullscreen) document.exitFullscreen();
  else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
  else if (document.msExitFullscreen) document.msExitFullscreen();
};

const Video = ({ sideNavbar }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // ── Trending mode: if we arrived here via the homepage "Trending Now"
  //    strip, location.state carries the ID whitelist of trending items.
  //    We keep re-passing this same state on every Prev/Next/suggestion
  //    navigation so trending mode stays "sticky" while browsing.
  const fromTrending = location.state?.fromTrending || false;
  const trendingIds = location.state?.trendingIds || null;
  const navState = fromTrending ? { trendingIds, fromTrending: true } : undefined;

  const [dbVideos, setDbVideos] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [message, setMessage] = useState("");
  const [autoPlay, setAutoPlay] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [disliked, setDisliked] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [allComments, setAllComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoMeta, setVideoMeta] = useState(null);
  const [channelAvatar, setChannelAvatar] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const moreMenuRef = useRef(null);

  const quality = useNetworkQuality();

  const [isMobile, setIsMobile] = useState(false);
  const [mobileOverlayVisible, setMobileOverlayVisible] = useState(true);
  const mobileOverlayTimer = useRef(null);

  // ── Double-tap-to-like ──
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [heartBurstPos, setHeartBurstPos] = useState({ x: 0, y: 0 });
  const [heartBurstKey, setHeartBurstKey] = useState(0);
  const lastClickRef = useRef({ time: 0, x: 0, y: 0 });
  const singleClickTimer = useRef(null);
  const heartBurstTimer = useRef(null);

  useEffect(() => {
    const check = () => setIsMobile(isMobileDevice());
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const resetMobileOverlayTimer = () => {
    setMobileOverlayVisible(true);
    clearTimeout(mobileOverlayTimer.current);
    mobileOverlayTimer.current = setTimeout(
      () => setMobileOverlayVisible(false),
      3500,
    );
  };

  const handleVideoAreaTap = () => {
    if (!isMobile) return;
    resetMobileOverlayTimer();
  };

  useEffect(() => {
    if (isMobile) resetMobileOverlayTimer();
    return () => clearTimeout(mobileOverlayTimer.current);
  }, [isMobile]);

  useEffect(() => {
    return () => {
      clearTimeout(singleClickTimer.current);
      clearTimeout(heartBurstTimer.current);
    };
  }, []);

  const loggedInUser = localStorage.getItem("username") || "Guest";
  const controlsTimer = useRef(null);
  const videoRef = useRef(null);
  // NEW: ref on the wrapper that contains BOTH the <video> and all of our
  // custom overlay controls (Prev/Autoplay/Next bar, Like/Dislike/Share/
  // Fullscreen/More stack). Fullscreening THIS element instead of the bare
  // <video> is what keeps our custom controls visible once fullscreen —
  // fullscreening the <video> alone only shows the video and native chrome.
  const playerWrapperRef = useRef(null);

  useViewTracker({
    contentId: id,
    contentType: "video",
    isPlaying: isVideoPlaying,
  });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Track fullscreen state across all vendor-prefixed events, so the
  //    button icon (Fullscreen / FullscreenExit) always reflects reality —
  //    including when the user exits via Esc or the native video chrome
  //    instead of our button.
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!getFullscreenElement());
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, []);

  // CHANGED: fullscreens the wrapper <div> (playerWrapperRef) instead of the
  // bare <video> element, so our custom overlay controls (Prev/Autoplay/
  // Next + Like/Dislike/Share/Fullscreen/More) stay mounted and visible in
  // fullscreen — see video.css ":fullscreen" rules for the horizontal
  // layout applied while in this state. Falls back to fullscreening the
  // <video> itself only on browsers (iOS Safari) that don't support
  // arbitrary-element fullscreen at all.
  const handleFullscreenToggle = (e) => {
    e.stopPropagation();
    if (getFullscreenElement()) {
      exitFullscreen();
      return;
    }
    const wrapper = playerWrapperRef.current;
    if (supportsElementFullscreen(wrapper)) {
      requestFullscreenOn(wrapper);
    } else if (videoRef.current) {
      requestFullscreenOn(videoRef.current);
    }
  };

  useEffect(() => {
    const fetchDbVideos = async () => {
      setDbLoading(true);
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) {
        setDbVideos(
          data.map((v) => ({
            id: String(v.id),
            short_id: v.short_id, // alphanumeric alias used only for the share link
            src: v.video_url,
            thumbnail: v.thumbnail_url || getCloudinaryThumbnail(v.video_url),
            title: v.title,
            duration: v.duration || "00:00",
            channel: v.channel,
            username: v.username || v.channel?.toLowerCase() || "unknown",
            tags: [v.category || "All"],
            description: v.description || "",
            created_at: v.created_at,
            isDb: true,
          })),
        );
      }
      setDbLoading(false);
    };
    fetchDbVideos();
  }, []);

  useEffect(() => {
    const loadViewCount = async () => {
      const { count } = await supabase
        .from("views")
        .select("id", { count: "exact", head: true })
        .match({ content_id: String(id), content_type: "video" });
      setViewCount(count ?? 0);
    };
    loadViewCount();
  }, [id]);

  // ── If we came from "Trending Now", restrict the working pool to only
  //    the trending IDs (always keeping the current video included so it
  //    never 404s if it somehow fell outside the whitelist). Otherwise the
  //    full uploaded catalogue is used, same as before.
  const allVideos = React.useMemo(() => {
    if (fromTrending && trendingIds) {
      return dbVideos.filter(
        (v) => trendingIds.includes(String(v.id)) || String(v.id) === String(id),
      );
    }
    return dbVideos;
  }, [dbVideos, fromTrending, trendingIds, id]);

  const currentIndex = allVideos.findIndex((v) => String(v.id) === String(id));
  const video = allVideos[currentIndex];
  const nextVideo = allVideos[currentIndex + 1] || allVideos[0];
  const prevVideo =
    allVideos[currentIndex - 1] || allVideos[allVideos.length - 1];

  useEffect(() => {
    if (!video?.isDb) {
      setVideoMeta(null);
      return;
    }
    supabase
      .from("videos")
      .select("description, created_at")
      .eq("id", video.id)
      .maybeSingle()
      .then(({ data }) => setVideoMeta(data || null));
  }, [video?.id, video?.isDb]);

  useEffect(() => {
    if (loggedInUser !== "Guest" && video?.isDb && video?.id) {
      logHistory(loggedInUser, video.id);
    }
  }, [video?.id, video?.isDb, loggedInUser]);

  useEffect(() => {
    const loadSubscription = async () => {
      const userId = localStorage.getItem("userId");
      if (!userId || !video) return;
      const channelUsername = video.username || video.channel?.toLowerCase();
      const { data } = await supabase
        .from("subscriptions")
        .select("id")
        .match({ subscriber_id: userId, subscribed_to: channelUsername })
        .single();
      setIsSubscribed(!!data);
    };
    loadSubscription();
  }, [id, video?.username]);

  // ── Fetch the channel/uploader's real avatar from the profiles table.
  //    Falls back to null (handled at render time + onError) if missing or on error.
  useEffect(() => {
    const loadChannelAvatar = async () => {
      if (!video) return;
      const channelUsername = video.username || video.channel?.toLowerCase();
      if (!channelUsername) {
        setChannelAvatar(null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("username", channelUsername) // change to .eq("id", channelUsername) if your key column is id
        .maybeSingle();

      if (!error && data?.avatar_url) {
        setChannelAvatar(data.avatar_url);
      } else {
        setChannelAvatar(null);
      }
    };
    loadChannelAvatar();
  }, [video?.id, video?.username, video?.channel]);

  const handleSubscribe = async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      alert("Please login to subscribe");
      return;
    }
    const channelUsername = video.username || video.channel?.toLowerCase();
    if (userId === channelUsername) {
      alert("You cannot subscribe to yourself");
      return;
    }
    if (isSubscribed) {
      await supabase
        .from("subscriptions")
        .delete()
        .match({ subscriber_id: userId, subscribed_to: channelUsername });
      setIsSubscribed(false);
    } else {
      const { error } = await supabase
        .from("subscriptions")
        .insert({ subscriber_id: userId, subscribed_to: channelUsername });
      if (!error) {
        setIsSubscribed(true);
        // NEW: notify the channel owner that they got a new subscriber.
        notifyUser({
          recipientUsername: channelUsername,
          senderUsername: loggedInUser,
          type: "subscriber",
          message: `${loggedInUser} subscribed to your channel`,
        });
      }
    }
  };

  const handleMouseMove = () => {
    if (isMobile) return;
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 2500);
  };

  const handleVideoEnd = () => {
    if (autoPlay) navigate(`/video/${nextVideo.id}`, { state: navState });
  };
  const handleVideoError = () => setVideoError(true);

  const handleLike = async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      alert("Please login to like");
      return;
    }
    if (liked) {
      await supabase
        .from("likes")
        .delete()
        .match({
          user_id: userId,
          content_id: String(id),
          content_type: "video",
        });
      setLiked(false);
      setLikeCount((c) => c - 1);
    } else {
      await supabase
        .from("likes")
        .insert({
          user_id: userId,
          content_id: String(id),
          content_type: "video",
        });
      setLiked(true);
      setLikeCount((c) => c + 1);
      if (disliked) setDisliked(false);
      // NEW: notify the video owner about the like (not on unlike).
      const channelUsername = video?.username || video?.channel?.toLowerCase();
      notifyUser({
        recipientUsername: channelUsername,
        senderUsername: loggedInUser,
        type: "like",
        message: `${loggedInUser} liked your video "${video?.title || ""}"`,
        contentId: id,
        contentType: "video",
      });
    }
  };

  const handleDislike = () => {
    if (disliked) {
      setDisliked(false);
    } else {
      setDisliked(true);
      if (liked) {
        setLiked(false);
        setLikeCount((c) => c - 1);
      }
    }
  };

  // FIX: use the video's alphanumeric short_id in the shared link instead
  // of the raw numeric id, so links pasted into WhatsApp/etc. show
  // something like ?id=aB3xY9kLm2 instead of ?id=76. Falls back to the
  // numeric id if short_id isn't available for some reason (e.g. a row
  // created before the short_id migration ran), so this never breaks.
  const handleShare = () => {
    const shareId = video?.short_id || id;
    const ogUrl = `https://zixplon.in/api/og?type=video&id=${shareId}`;
    if (navigator.share) {
      navigator
        .share({
          title: video?.title || "Watch on Zixplon",
          text: `Watch "${video?.title}" on Zixplon`,
          url: ogUrl,
        })
        .catch(() => navigator.clipboard.writeText(ogUrl).catch(() => {}));
    } else {
      navigator.clipboard.writeText(ogUrl).catch(() => {});
    }
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2500);
  };

  const handleCommentSubmit = async () => {
    if (!message.trim()) return;
    const userId = localStorage.getItem("userId");
    if (!userId) {
      alert("Please login to comment");
      return;
    }
    const { data, error } = await supabase
      .from("comments")
      .insert({
        user_id: userId,
        username: loggedInUser,
        content_id: String(id),
        content_type: "video",
        text: message,
      })
      .select()
      .single();
    if (!error && data) {
      setAllComments((prev) => [
        {
          id: data.id,
          user: data.username,
          text: data.text,
          date: data.created_at,
        },
        ...prev,
      ]);
      // NEW: notify the video owner about the comment.
      const channelUsername = video?.username || video?.channel?.toLowerCase();
      notifyUser({
        recipientUsername: channelUsername,
        senderUsername: loggedInUser,
        type: "comment",
        message: `${loggedInUser} commented on your video: "${message.slice(0, 60)}"`,
        contentId: id,
        contentType: "video",
      });
    }
    setMessage("");
  };

  // ── Double-tap-to-like: fires a heart burst at the tap point and
  //    likes the video (never unlikes — matches IG/YT behavior). A
  //    single tap/click falls back to toggling play/pause, after a
  //    short delay so we can tell it apart from the first half of a
  //    double-tap.
  const triggerDoubleTapLike = async (x, y) => {
    setHeartBurstKey((k) => k + 1);
    setHeartBurstPos({ x, y });
    setShowHeartBurst(true);
    clearTimeout(heartBurstTimer.current);
    heartBurstTimer.current = setTimeout(() => setShowHeartBurst(false), 700);

    if (liked) return;

    const userId = localStorage.getItem("userId");
    if (!userId) {
      alert("Please login to like");
      return;
    }
    const { error } = await supabase.from("likes").insert({
      user_id: userId,
      content_id: String(id),
      content_type: "video",
    });
    if (!error) {
      setLiked(true);
      setLikeCount((c) => c + 1);
      if (disliked) setDisliked(false);
      // NEW: notify the video owner about the double-tap like.
      const channelUsername = video?.username || video?.channel?.toLowerCase();
      notifyUser({
        recipientUsername: channelUsername,
        senderUsername: loggedInUser,
        type: "like",
        message: `${loggedInUser} liked your video "${video?.title || ""}"`,
        contentId: id,
        contentType: "video",
      });
    }
  };

  const handleOverlayClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const now = Date.now();
    const { time: lastTime, x: lastX, y: lastY } = lastClickRef.current;

    const isDoubleTap =
      now - lastTime < 300 &&
      Math.abs(x - lastX) < 80 &&
      Math.abs(y - lastY) < 80;

    if (isDoubleTap) {
      clearTimeout(singleClickTimer.current);
      lastClickRef.current = { time: 0, x: 0, y: 0 };
      triggerDoubleTapLike(x, y);
    } else {
      lastClickRef.current = { time: now, x, y };
      clearTimeout(singleClickTimer.current);
      singleClickTimer.current = setTimeout(() => {
        const vid = videoRef.current;
        if (vid) {
          vid.paused ? vid.play().catch(() => {}) : vid.pause();
        }
      }, 260);
    }
  };

  useEffect(() => {
    const handleSpacebar = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        const vid = videoRef.current;
        if (!vid) return;
        vid.paused ? vid.play() : vid.pause();
      }
    };
    window.addEventListener("keydown", handleSpacebar);
    return () => window.removeEventListener("keydown", handleSpacebar);
  }, []);

  useEffect(() => {
    const loadLikes = async () => {
      const userId = localStorage.getItem("userId");
      const { count } = await supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .match({ content_id: String(id), content_type: "video" });
      setLikeCount(count || 0);
      if (userId) {
        const { data } = await supabase
          .from("likes")
          .select("id")
          .match({
            user_id: userId,
            content_id: String(id),
            content_type: "video",
          })
          .single();
        setLiked(!!data);
      }
    };
    loadLikes();
  }, [id]);

  useEffect(() => {
    const loadComments = async () => {
      setCommentsLoading(true);
      const { data } = await supabase
        .from("comments")
        .select("*")
        .match({ content_id: String(id), content_type: "video" })
        .order("created_at", { ascending: false });
      if (data && data.length > 0) {
        setAllComments(
          data.map((c) => ({
            id: c.id,
            user: c.username,
            text: c.text,
            date: c.created_at,
          })),
        );
      } else {
        setAllComments([]);
      }
      setCommentsLoading(false);
    };
    loadComments();
  }, [id]);

  useEffect(() => {
    setDisliked(false);
    setVideoError(false);
    setIsVideoPlaying(false);
    setShowMoreMenu(false);
    scrollToTopDeferred();
  }, [id]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !video?.src?.includes("cloudinary.com")) return;
    const wasPlaying = !vid.paused;
    const resumeTime = vid.currentTime;
    vid.load();
    vid.currentTime = resumeTime;
    if (wasPlaying) vid.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality]);

  if (dbLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
          color: "white",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            border: "4px solid #333",
            borderTop: "4px solid #7c3aed",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p style={{ color: "#aaa", fontSize: "14px" }}>Loading video...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!video) {
    return (
      <div style={{ color: "white", padding: "40px", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>📭</div>
        <p style={{ fontSize: "18px", marginBottom: "8px" }}>Video not found</p>
        <p style={{ color: "#aaa", fontSize: "14px" }}>
          This video may have been removed, not yet uploaded, or the link is
          incorrect.
        </p>
        <button
          onClick={() => navigate("/")}
          style={{
            marginTop: "20px",
            background: "#7c3aed",
            color: "white",
            border: "none",
            padding: "10px 24px",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          ← Go Home
        </button>
      </div>
    );
  }

  const suggestions = allVideos.filter((v) => String(v.id) !== String(id));
  const formatName = video.src?.split(".").pop().split("?")[0].toUpperCase();
  const uploadedAt = videoMeta?.created_at || video.created_at || null;
  const description = videoMeta?.description || video.description || "";
  const channelUsername = video.username || video.channel?.toLowerCase();

  const overlayVisible = isMobile ? mobileOverlayVisible : showControls;

  return (
    <div className="video">
      <div className="videoPostSection">
        <div
          className="video_player_wrapper"
          ref={playerWrapperRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseMove}
          onTouchStart={handleVideoAreaTap}
        >
          <div
            className={`video_controls_bar ${overlayVisible ? "visible" : "hidden"}`}
          >
            <button
              className="video_nav_btn"
              onClick={() => navigate(`/video/${prevVideo.id}`, { state: navState })}
            >
              ⏮ Prev
            </button>
            <div className="video_autoplay_toggle">
              <span>Autoplay</span>
              <div
                className={`toggle_switch ${autoPlay ? "on" : "off"}`}
                onClick={() => setAutoPlay(!autoPlay)}
              >
                <div className="toggle_knob" />
              </div>
            </div>
            <button
              className="video_nav_btn"
              onClick={() => navigate(`/video/${nextVideo.id}`, { state: navState })}
            >
              Next ⏭
            </button>
          </div>

          {video.src?.includes("cloudinary.com") && (
            <div
              style={{
                position: "absolute",
                top: "12px",
                left: "12px",
                background: "rgba(0,0,0,0.65)",
                color: "#fff",
                fontSize: "12px",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "999px",
                zIndex: 5,
                opacity: overlayVisible ? 1 : 0,
                transition: "opacity 0.3s ease",
                pointerEvents: "none",
                fontFamily: "'Nunito', sans-serif",
                letterSpacing: "0.3px",
              }}
            >
              {QUALITY_LABELS[quality]}
            </div>
          )}

          {isUnsupportedFormat(video.src) && !videoError && (
            <div
              style={{
                background: "#ff4444",
                color: "white",
                padding: "10px 16px",
                borderRadius: "6px",
                marginBottom: "8px",
                fontSize: "14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>
                ⚠️ <strong>{formatName}</strong> format may not be supported.
              </span>
              <button
                onClick={() => setVideoError(false)}
                style={{
                  background: "none",
                  border: "1px solid white",
                  color: "white",
                  cursor: "pointer",
                  borderRadius: "4px",
                  padding: "2px 10px",
                  marginLeft: "12px",
                }}
              >
                ✕
              </button>
            </div>
          )}

          {videoError && (
            <div
              style={{
                background: "#ff8800",
                color: "white",
                padding: "10px 16px",
                borderRadius: "6px",
                marginBottom: "8px",
                fontSize: "14px",
              }}
            >
              ⚠️ This video could not be played. Please try a different format.
            </div>
          )}

          <video
            ref={videoRef}
            key={video.id}
            controls
            autoPlay
            muted={false}
            playsInline
            crossOrigin="anonymous"
            controlsList="nodownload noplaybackrate"
            onContextMenu={(e) => e.preventDefault()}
            className="video_youtube_video"
            onPlay={() => setIsVideoPlaying(true)}
            onPause={() => setIsVideoPlaying(false)}
            onEnded={handleVideoEnd}
            onError={handleVideoError}
            preload="metadata"
            poster={video.thumbnail}
          >
            <source
              src={getAdaptiveVideoSrc(
                video.src && video.src.includes("cloudinary.com")
                  ? video.src.replace(/\.(webm|mov|avi|mkv)(\?.*)?$/i, ".mp4")
                  : video.src,
                quality,
              )}
              type="video/mp4"
            />
            Your browser does not support the video tag.
          </video>

          {/* Double-tap-to-like overlay — sits above the video, below the
              controls bar & floating action buttons. A single tap/click
              toggles play/pause; a double tap/click likes the video and
              pops a heart animation at the tap point. */}
          <div className="video_tap_overlay" onClick={handleOverlayClick} />

          {showHeartBurst && (
            <div
              key={heartBurstKey}
              className="video_heart_burst"
              style={{ left: heartBurstPos.x, top: heartBurstPos.y }}
            >
              ❤️
            </div>
          )}

          <div
            className={`video_frame_actions${isMobile ? " mobile-visible" : ""}`}
          >
            <div
              className={`video_frame_btn video_like_btn ${liked ? "video_liked" : ""}`}
              onClick={handleLike}
              title="Like"
            >
              <span className="video_like_inner">
                <ThumbUpOutlinedIcon
                  fontSize="small"
                  style={{ color: liked ? "#ff0000" : "white" }}
                />
                <span>{likeCount}</span>
              </span>
              <span className="video_like_emoji">😊</span>
            </div>

            <div
              className={`video_frame_btn ${disliked ? "active" : ""}`}
              onClick={handleDislike}
              title="Dislike"
            >
              <ThumbDownAltOutlinedIcon fontSize="small" />
            </div>

            <div
              className="video_frame_btn"
              onClick={handleShare}
              title="Share"
            >
              <ReplyIcon fontSize="small" style={{ transform: "scaleX(-1)" }} />
              <span>Share</span>
            </div>

            <div
              className={`video_frame_btn ${isFullscreen ? "active" : ""}`}
              onClick={handleFullscreenToggle}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <FullscreenExitIcon fontSize="small" />
              ) : (
                <FullscreenIcon fontSize="small" />
              )}
            </div>

            <div
              className="video_frame_more_wrap"
              ref={moreMenuRef}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="video_frame_btn"
                onClick={() => setShowMoreMenu((v) => !v)}
                title="More"
              >
                <MoreVertIcon fontSize="small" />
              </div>

              {showMoreMenu && (
                <div className="video_more_dropdown">
                  <div
                    className="video_more_dropdown_item"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowReportModal(true);
                    }}
                  >
                    🚩 Report
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="video_youtubeAbout">
          <div className="video_uTubeTitle">{video.title}</div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginTop: "6px",
              marginBottom: "8px",
            }}
          >
            <span
              style={{
                color: "#8b84c4",
                fontSize: "13px",
                fontWeight: "600",
                fontFamily: "'Nunito', sans-serif",
              }}
            >
              👁 {viewCount} {viewCount === 1 ? "view" : "views"}
            </span>
            {uploadedAt && (
              <span
                style={{
                  color: "#8b84c4",
                  fontSize: "13px",
                  fontWeight: "600",
                  fontFamily: "'Nunito', sans-serif",
                }}
              >
                · {timeAgo(uploadedAt)}
              </span>
            )}
          </div>

          <div className="youtube_video_ProfileBlock">
            <div className="youtube_video_ProfileBlock_left">
              <Link
                to={`/user/${channelUsername}`}
                className="youtube_video_ProfileBlock_left_img"
              >
                <img
                  className="youtube_video_ProfileBlock_left_image"
                  src={channelAvatar || getFallbackAvatar(video.channel || channelUsername)}
                  alt="profile"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = getFallbackAvatar(video.channel || channelUsername);
                  }}
                />
              </Link>
              <div className="youtubeVideo_subsView">
                <Link
                  to={`/user/${channelUsername}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="youtubePostProfileName">
                    {video.channel || video.username}
                  </div>
                </Link>
                <div className="youtubePostProfileSubs">
                  {uploadedAt ? timeAgo(uploadedAt) : ""}
                </div>
              </div>
              {loggedInUser !== channelUsername && (
                <div
                  className="subscribeBtnYoutube"
                  onClick={handleSubscribe}
                  style={{
                    background: isSubscribed ? "#e0d4ff" : "#7c3aed",
                    color: isSubscribed ? "#7c3aed" : "#ffffff",
                    border: isSubscribed ? "2px solid #7c3aed" : "none",
                    cursor: "pointer",
                  }}
                >
                  {isSubscribed ? "✓ Subscribed" : "Subscribe"}
                </div>
              )}
            </div>
          </div>

          {shareToast && (
            <div
              style={{
                position: "fixed",
                bottom: 24,
                left: "50%",
                transform: "translateX(-50%)",
                background: "#333",
                color: "#fff",
                padding: "8px 18px",
                borderRadius: "999px",
                fontSize: "13px",
                zIndex: 999,
              }}
            >
              🔗 Link copied! Share on WhatsApp to see thumbnail preview
            </div>
          )}

          {description ? (
            <div>
  <ExpandableText text={description} maxChars={200} />
</div>
          ) : uploadedAt ? (
            <div className="youtube_video_About">
              <div
                style={{
                  fontSize: "12px",
                  color: "#8b84c4",
                  fontWeight: "700",
                  fontFamily: "'Nunito', sans-serif",
                }}
              >
                {new Date(uploadedAt).toLocaleDateString("en-IN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              <div style={{ color: "#8b84c4", fontSize: "13px" }}>
                No description provided.
              </div>
            </div>
          ) : null}

          {/* ── Google AdSense — display banner ──
              Placed below the description/about block, above the comment
              section. Deliberately not touching the player or its controls. */}
          <AdSlot slot="5967522405" variant="banner" />

          <div className="youtubeCommentSection">
            <div className="youtubeCommentSectionTitle">
              {allComments.length} Comments
            </div>
            <div className="youtubeSelfComment">
              <img
                className="video_youtubeSelfCommentProfile"
                src={
                  localStorage.getItem("profilePic") ||
                  getFallbackAvatar(loggedInUser)
                }
                alt="self"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = getFallbackAvatar(loggedInUser);
                }}
              />
              <div className="addAComment">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="addACommentInput"
                  placeholder="Add a comment"
                  onKeyDown={(e) => e.key === "Enter" && handleCommentSubmit()}
                />
                <div className="cancelSubmitComment">
                  <div className="cancelcomment" onClick={() => setMessage("")}>
                    Cancel
                  </div>
                  <div className="cancelcomment" onClick={handleCommentSubmit}>
                    Comment
                  </div>
                </div>
              </div>
            </div>
            <div className="youtubeothersComments">
              {commentsLoading ? (
                <p style={{ color: "#aaa", fontSize: "13px" }}>
                  Loading comments...
                </p>
              ) : allComments.length === 0 ? (
                <p
                  style={{
                    color: "#8b84c4",
                    fontSize: "13px",
                    fontFamily: "'Nunito', sans-serif",
                    fontWeight: "600",
                  }}
                >
                  No comments yet. Be the first to comment!
                </p>
              ) : (
                allComments.map((c) => (
                  <div className="youtubeSelfComment" key={c.id}>
                    <img
                      className="video_youtubeSelfCommentProfile"
                      src={getFallbackAvatar(c.user)}
                      alt="commenter"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = getFallbackAvatar(c.user);
                      }}
                    />
                    <div className="others_commentSection">
                      <div className="others_commentSectionHeader">
                        <div className="channelName_comment">{c.user}</div>
                        <div className="commentTimingOthers">
                          {timeAgo(c.date)}
                        </div>
                      </div>
                      <div className="otherCommentSectionComment">{c.text}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        className="videoSuggestions"
        style={{ overflowY: "scroll", scrollbarWidth: "none" }}
      >
        {suggestions.map((suggestion) => (
          <Link
            to={`/video/${suggestion.id}`}
            key={suggestion.id}
            state={navState}
            className="videoSuggestionsBlock"
            style={{ textDecoration: "none", color: "inherit" }}
            onClick={scrollToTopDeferred}
          >
            <div className="video_suggestion_thumbnail">
              <img
                src={suggestion.thumbnail}
                className="video_suggestion_thumbnail_img"
                alt={suggestion.title}
              />
            </div>
            <div className="video_suggestions_About">
              <div className="video_suggestions_About_title">
                {suggestion.title}
              </div>
              <div className="video_suggestions_About_Profile">
                {suggestion.channel || suggestion.username}
              </div>
              <div className="video_suggestions_About_Profile">
                {suggestion.duration}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {showReportModal && (
        <ReportModal
          contentType="video"
          contentId={id}
          contentTitle={video.title}
          contentOwner={channelUsername}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
};

export default Video;