import React, { useState, useEffect, useRef } from "react";
import "./homePage.css";
import { reelsData } from "../Reels/reels";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { supabase } from "../../config/supabase";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import CheckIcon from "@mui/icons-material/Check";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import { createPortal } from "react-dom";
// LiveBrowser shows currently-live LiveKit streams (reads the
// "live_streams" Supabase table). Adjust the path below if your
// LiveBrowser component lives in a different folder.
import LiveBrowser from "../Live/LiveViewer";

const API_KEYS = [
  process.env.REACT_APP_YOUTUBE_KEY_1,
  process.env.REACT_APP_YOUTUBE_KEY_2,
  process.env.REACT_APP_YOUTUBE_KEY_3,
  process.env.REACT_APP_YOUTUBE_KEY_4,
  process.env.REACT_APP_YOUTUBE_KEY_5,
  process.env.REACT_APP_YOUTUBE_KEY_6,
];
let currentKeyIndex = 0;

const MOCK_COMMENTS = [
  {
    id: 1,
    user: "Ravi Kumar",
    avatar: "RK",
    text: "This is absolutely amazing content! Keep it up 🔥",
    likes: 142,
    time: "2 days ago",
  },
  {
    id: 2,
    user: "Priya Sharma",
    avatar: "PS",
    text: "Really informative, learned so much from this video.",
    likes: 87,
    time: "1 day ago",
  },
  {
    id: 3,
    user: "Arjun Mehta",
    avatar: "AM",
    text: "The editing on this is top notch. Subscribed!",
    likes: 56,
    time: "5 hours ago",
  },
  {
    id: 4,
    user: "Sneha Patel",
    avatar: "SP",
    text: "Been waiting for a video like this!",
    likes: 34,
    time: "3 hours ago",
  },
  {
    id: 5,
    user: "Dev_Codes",
    avatar: "DC",
    text: "Bookmarked this. Will rewatch multiple times 📌",
    likes: 29,
    time: "1 hour ago",
  },
  {
    id: 6,
    user: "NatureLover99",
    avatar: "NL",
    text: "The visuals are stunning. What camera do you use?",
    likes: 18,
    time: "45 mins ago",
  },
  {
    id: 7,
    user: "TechWithVik",
    avatar: "TV",
    text: "Explained in the simplest way possible. Respect 🙏",
    likes: 11,
    time: "20 mins ago",
  },
];

const avatarColors = [
  "#7c3aed",
  "#f43f5e",
  "#f97316",
  "#06b6d4",
  "#10b981",
  "#eab308",
  "#a855f7",
  "#3b82f6",
  "#ec4899",
  "#14b8a6",
];
const getColor = (str) =>
  avatarColors[(str || "A").charCodeAt(0) % avatarColors.length];

const formatViews = (n) => {
  if (!n || n === 0) return "0 views";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M views";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K views";
  return n + " views";
};

const formatTimeAgo = (dateString) => {
  if (!dateString) return null;
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);
  if (diffSec < 60) return "Just now";
  if (diffMin < 60)
    return diffMin + (diffMin === 1 ? " minute ago" : " minutes ago");
  if (diffHour < 24)
    return diffHour + (diffHour === 1 ? " hour ago" : " hours ago");
  if (diffDay < 30) return diffDay + (diffDay === 1 ? " day ago" : " days ago");
  if (diffMonth < 12)
    return diffMonth + (diffMonth === 1 ? " month ago" : " months ago");
  return diffYear + (diffYear === 1 ? " year ago" : " years ago");
};

const isWatched = (contentType, contentId, watchedContentIds) => {
  const localKey = `viewed_${contentType}_${contentId}`;
  if (localStorage.getItem(localKey) === "true") return true;
  return watchedContentIds.has(`${contentType}_${String(contentId)}`);
};

const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth <= 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
};

// ─────────────────────────────────────────────────────────────────────────────
// useHoverPreview — after a short delay, swap the thumbnail image for a
// muted, looping <video> of the actual clip. Mirrors the YouTube/Instagram
// "hover to preview" behaviour. Callers pass `canPreview` (e.g. false on
// mobile, or when there's no real video URL) to disable it entirely.
// ─────────────────────────────────────────────────────────────────────────────
const HOVER_PREVIEW_DELAY = 450; // ms — avoids firing on quick mouse passes

const useHoverPreview = (canPreview) => {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const timeoutRef = useRef(null);
  const videoRef = useRef(null);

  const cancelTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const onMouseEnter = () => {
    if (!canPreview) return;
    cancelTimer();
    timeoutRef.current = setTimeout(() => setIsPreviewing(true), HOVER_PREVIEW_DELAY);
  };

  const onMouseLeave = () => {
    cancelTimer();
    setIsPreviewing(false);
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      } catch (_) {}
    }
  };

  useEffect(() => () => cancelTimer(), []);

  return { isPreviewing, videoRef, onMouseEnter, onMouseLeave };
};

const MOBILE_TABS = [
  { id: "shorts", label: "Shorts", icon: "📱" },
  { id: "videos", label: "Videos", icon: "🎬" },
  { id: "movies", label: "Movies", icon: "🎥" },
  { id: "live", label: "Live", icon: "🔴" },
];

const useSwipeTabs = (
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  verticalLimit = 80,
) => {
  const touchStart = useRef(null);
  const onTouchStart = (e) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = Math.abs(t.clientY - touchStart.current.y);
    touchStart.current = null;
    if (dy > verticalLimit) return;
    if (dx < -threshold) onSwipeLeft();
    if (dx > threshold) onSwipeRight();
  };
  return { onTouchStart, onTouchEnd };
};

// ─────────────────────────────────────────────────────────────────────────────
// ShortCard
// ─────────────────────────────────────────────────────────────────────────────
const ShortCard = ({
  short,
  incrementView,
  viewCounts,
  handleDeleteReel,
  navigate,
  watchedContentIds,
}) => {
  const cardRef = useRef(null);
  const firedRef = useRef(false);

  // ── Hover-preview setup ──
  const isMobile = useIsMobile();
  const canPreview = !isMobile && !!short.src;
  const { isPreviewing, videoRef, onMouseEnter, onMouseLeave } = useHoverPreview(canPreview);

  const [showNew, setShowNew] = useState(() => {
    if (!short.dbId) return false;
    if (isWatched("reel", short.dbId, watchedContentIds)) return false;
    if (short.created_at) {
      const age = Date.now() - new Date(short.created_at).getTime();
      return age <= 7 * 24 * 60 * 60 * 1000;
    }
    const fresh = (() => {
      try {
        return JSON.parse(
          sessionStorage.getItem("zixplon_fresh_reels") || "[]",
        );
      } catch {
        return [];
      }
    })();
    return fresh.includes(String("db_" + short.dbId));
  });

  useEffect(() => {
    if (!short.dbId) return;
    firedRef.current = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          entry.isIntersecting &&
          entry.intersectionRatio >= 0.6 &&
          !firedRef.current
        ) {
          firedRef.current = true;
          localStorage.setItem(`viewed_reel_${short.dbId}`, "true");
          localStorage.setItem(
            `lastViewed_reel_${short.dbId}`,
            String(Date.now()),
          );
          setShowNew(false);
          incrementView(String(short.dbId), "reel");
        }
      },
      { threshold: 0.6 },
    );
    const el = cardRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [short.dbId, incrementView]);

  useEffect(() => {
    if (!short.dbId) return;
    if (isWatched("reel", short.dbId, watchedContentIds)) {
      setShowNew(false);
      return;
    }
    if (short.created_at) {
      const age = Date.now() - new Date(short.created_at).getTime();
      setShowNew(age <= 7 * 24 * 60 * 60 * 1000);
    }
  }, [watchedContentIds, short.dbId]);

  const vcKey = short.id ? "reel_" + short.id : null;

  return (
    <div
      ref={cardRef}
      className="homePage_shortCard"
      style={{ cursor: "pointer", position: "relative" }}
      onClick={() => {
        if (short.dbId) {
          localStorage.setItem(`viewed_reel_${short.dbId}`, "true");
          localStorage.setItem(
            `lastViewed_reel_${short.dbId}`,
            String(Date.now()),
          );
          setShowNew(false);
          incrementView(String(short.dbId), "reel");
        }
        navigate("/reels/" + short.id, { state: { clickedReel: short } });
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="homePage_shortThumbnail">
        <img
          src={short.thumbnail}
          alt={short.title || short.user}
          className="homePage_shortImg"
          style={{ opacity: isPreviewing ? 0 : 1, transition: "opacity 0.25s" }}
        />
        {canPreview && isPreviewing && (
          <video
            ref={videoRef}
            src={short.src}
            className="homePage_shortImg"
            muted
            autoPlay
            loop
            playsInline
            preload="metadata"
            style={{ position: "absolute", inset: 0, objectFit: "cover" }}
            onCanPlay={(e) => e.target.play().catch(() => {})}
          />
        )}
        <div className="homePage_shortPlay">▶</div>
        <div className="homePage_shortDuration">{short.duration}</div>
        {showNew && (
          <div
            style={{
              position: "absolute",
              top: "8px",
              left: "8px",
              background: "linear-gradient(135deg,#f43f5e,#f97316)",
              color: "white",
              fontSize: "10px",
              fontWeight: "800",
              padding: "2px 7px",
              borderRadius: "5px",
              zIndex: 2,
            }}
          >
            New
          </div>
        )}
        {short.dbId && (
          <div
            style={{
              position: "absolute",
              bottom: "4px",
              left: "4px",
              background: "rgba(30,27,75,0.82)",
              color: "white",
              fontSize: "10px",
              fontWeight: "700",
              padding: "2px 6px",
              borderRadius: "5px",
            }}
          >
            👁 {formatViews(vcKey ? (viewCounts[vcKey] ?? 0) : 0)}
          </div>
        )}
      </div>
      <div className="homePage_shortTitle">{short.title}</div>
      <Link
        to={"/user/" + short.username}
        onClick={(e) => e.stopPropagation()}
        style={{ textDecoration: "none", color: "#a855f7", fontSize: "13px" }}
      >
        <div className="homePage_shortUser">{short.user}</div>
      </Link>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ShortsRow — hoisted to module scope (was previously redefined on every
// HomePage render as `const ShortsRow = (...) => (...)` inside the
// component body, which meant React treated it as a brand-new component
// type on every re-render and remounted the whole shorts row — including
// every <ShortCard>'s IntersectionObserver — any time HomePage re-rendered
// for an unrelated reason (e.g. viewCounts ticking up). All the data it
// needs now comes in as props instead of being closed over.
// ─────────────────────────────────────────────────────────────────────────────
const ShortsRow = ({
  data,
  title,
  incrementView,
  viewCounts,
  handleDeleteReel,
  navigate,
  watchedContentIds,
}) => (
  <div className="homePage_shortsSection">
    <div className="homePage_shortsHeader">
      <span className="homePage_shortsTitle">
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "24px",
            height: "24px",
            background: "linear-gradient(135deg,#e53935,#f97316)",
            color: "white",
            fontWeight: "900",
            fontSize: "15px",
            fontFamily: "Arial Black, sans-serif",
            borderRadius: "6px",
            marginRight: "0px",
            flexShrink: 0,
            verticalAlign: "middle",
          }}
        >
          Z
        </span>
        {title}
      </span>
    </div>
    <div className="homePage_shortsRow">
      {data.map((short) => (
        <ShortCard
          key={short.id}
          short={short}
          incrementView={incrementView}
          viewCounts={viewCounts}
          handleDeleteReel={handleDeleteReel}
          navigate={navigate}
          watchedContentIds={watchedContentIds}
        />
      ))}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// VideoCard — hoisted to module scope for the same reason as ShortsRow
// above: it was previously defined inside HomePage's function body, so
// every uploaded-video grid remounted (losing hover/scroll state, and
// re-triggering image loads) whenever HomePage re-rendered for any
// reason. All previously-closed-over values now arrive as props.
// ─────────────────────────────────────────────────────────────────────────────
const VideoCard = ({
  video,
  isUploaded = false,
  viewCounts,
  watchLaterIds,
  loggedInUsername,
  handleToggleWatchLater,
  handleDeleteVideo,
  handleLikeVideo,
  watchedContentIds,
  incrementView,
}) => {
  const showNew =
    isUploaded && !isWatched("video", video.id, watchedContentIds);
  const isSaved = watchLaterIds.has(String(video.id));

  // ── Hover-preview setup ──
  const isMobile = useIsMobile();
  const canPreview = isUploaded && !isMobile && !!video.src;
  const { isPreviewing, videoRef, onMouseEnter, onMouseLeave } = useHoverPreview(canPreview);

  return (
    <div
      className="youtube_thumbnailBox"
      style={{ position: "relative" }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Three-dots menu with full dropdown — only for uploaded videos */}
      {isUploaded && (
        <SaveMenuButton
          videoId={video.id}
          isSaved={isSaved}
          onToggleWatchLater={handleToggleWatchLater}
          video={video}
          loggedInUsername={loggedInUsername}
          onDelete={handleDeleteVideo}
        />
      )}

      <Link
        to={"/video/" + video.id}
        className="youtube_thumbnailWrapper"
        onClick={() => {
          if (isUploaded) incrementView(video.id, "video");
        }}
      >
        <img
          src={video.thumbnail}
          alt={video.title}
          className="youtube_thumbnailPic"
          style={{ opacity: isPreviewing ? 0 : 1, transition: "opacity 0.25s" }}
        />
        {canPreview && isPreviewing && (
          <video
            ref={videoRef}
            src={video.src}
            className="youtube_thumbnailPic"
            muted
            autoPlay
            loop
            playsInline
            preload="metadata"
            style={{ position: "absolute", inset: 0, objectFit: "cover" }}
            onCanPlay={(e) => e.target.play().catch(() => {})}
          />
        )}
        <div className="youtube_timingThumbnail">{video.duration}</div>
        {showNew && (
          <div
            style={{
              position: "absolute",
              top: "8px",
              left: "8px",
              background: "linear-gradient(135deg,#f43f5e,#f97316)",
              color: "white",
              fontSize: "10px",
              fontWeight: "800",
              padding: "2px 7px",
              borderRadius: "5px",
              zIndex: 2,
            }}
          >
            New
          </div>
        )}
        <div className="youtube_playOverlay">
          <div className="youtube_playButton">▶</div>
        </div>
      </Link>
      <div className="youtubeTitleBox">
        <div className="youtubeBoxProfile">
          <img
            src={
              "https://api.dicebear.com/7.x/initials/svg?seed=" +
              video.channel
            }
            alt={video.channel}
            className="youtube_thumbnail_Profile"
          />
          <Link
            to={"/user/" + (video.username || video.channel.toLowerCase())}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <p className="youtube_ChannelName">{video.channel}</p>
          </Link>
        </div>
        <div className="youtubeVideoInfo">
          <p className="youtube_videoTitle">{video.title}</p>
          <p
            className="youtubeVideo_Views"
            style={{ display: "flex", gap: "10px", alignItems: "center" }}
          >
            {isUploaded && (
              <>
                <span>
                  👁 {formatViews(viewCounts["video_" + video.id] ?? 0)}
                </span>
                <span style={{ color: "#d1d5db", fontSize: "11px" }}>•</span>
                <button
                  onClick={(e) => handleLikeVideo(e, video.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#8b84c4",
                    cursor: "pointer",
                    fontSize: "inherit",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                    fontWeight: "600",
                  }}
                >
                  👍 {video.likes ?? 0} Likes
                </button>
              </>
            )}
            {/* Note: previously showed a hardcoded "👍 3 Likes" for
               non-uploaded (YouTube) cards regardless of the actual
               video — removed since it was fabricated data, not a
               real like count we have access to. */}
          </p>
          {isUploaded && video.created_at && (
            <p
              className="youtubeVideo_UploadDate"
              style={{
                color: "#a8a3d6",
                fontSize: "12px",
                margin: "3px 0 0",
                fontWeight: "500",
              }}
            >
              {formatTimeAgo(video.created_at)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// YouTubeVideoCard — hoisted to module scope; takes onSelect instead of
// closing over openWatchPage.
// ─────────────────────────────────────────────────────────────────────────────
const YouTubeVideoCard = ({ item, onSelect }) => (
  <div
    className="youtube_thumbnailBox"
    style={{ cursor: "pointer" }}
    onClick={() =>
      onSelect(
        item.id.videoId,
        item.snippet.title,
        item.snippet.channelTitle,
      )
    }
  >
    <div
      className="youtube_thumbnailWrapper"
      style={{ position: "relative", display: "block" }}
    >
      <img
        src={item.snippet.thumbnails.medium.url}
        alt={item.snippet.title}
        className="youtube_thumbnailPic"
      />
      <div
        style={{
          position: "absolute",
          top: "8px",
          left: "8px",
          background: "#ef4444",
          color: "white",
          fontSize: "10px",
          fontWeight: "800",
          padding: "2px 7px",
          borderRadius: "5px",
        }}
      >
        ▶ YouTube
      </div>
    </div>
    <div className="youtubeTitleBox">
      <div className="youtubeBoxProfile">
        <img
          src={
            "https://ui-avatars.com/api/?name=" +
            encodeURIComponent(item.snippet.channelTitle) +
            "&background=random&size=36"
          }
          alt={item.snippet.channelTitle}
          className="youtube_thumbnail_Profile"
        />
        <p className="youtube_ChannelName">{item.snippet.channelTitle}</p>
      </div>
      <div className="youtubeVideoInfo">
        <p className="youtube_videoTitle">{item.snippet.title}</p>
        <p className="youtubeVideo_Views">
          {new Date(item.snippet.publishedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SkeletonCard / SectionLabel — hoisted; neither closed over any HomePage
// state to begin with, so this is a pure "stop recreating the function
// every render" cleanup.
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div
    className="youtube_thumbnailBox"
    style={{ border: "2px solid #e0d4ff" }}
  >
    <div
      style={{
        width: "100%",
        paddingTop: "56.25%",
        background:
          "linear-gradient(90deg,#e8e0ff 25%,#f3eeff 50%,#e8e0ff 75%)",
        backgroundSize: "400px 100%",
        borderRadius: "0",
        animation: "shimmer 1.4s infinite",
      }}
    />
    <div
      style={{
        padding: "10px 12px",
        display: "flex",
        gap: "10px",
        background: "#fff",
      }}
    >
      <div
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "50%",
          background:
            "linear-gradient(90deg,#e8e0ff 25%,#f3eeff 50%,#e8e0ff 75%)",
          backgroundSize: "400px 100%",
          flexShrink: 0,
          animation: "shimmer 1.4s infinite",
        }}
      />
      <div style={{ flex: 1 }}>
        <div
          style={{
            height: "13px",
            background:
              "linear-gradient(90deg,#e8e0ff 25%,#f3eeff 50%,#e8e0ff 75%)",
            backgroundSize: "400px 100%",
            borderRadius: "6px",
            marginBottom: "8px",
            animation: "shimmer 1.4s infinite",
          }}
        />
        <div
          style={{
            height: "12px",
            background:
              "linear-gradient(90deg,#e8e0ff 25%,#f3eeff 50%,#e8e0ff 75%)",
            backgroundSize: "400px 100%",
            borderRadius: "6px",
            width: "60%",
            animation: "shimmer 1.4s infinite",
          }}
        />
      </div>
    </div>
  </div>
);

const SectionLabel = ({ color, bg, text, count }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      marginBottom: "14px",
    }}
  >
    <span
      style={{
        background: bg,
        color: color,
        fontSize: "11px",
        fontWeight: "800",
        padding: "4px 12px",
        borderRadius: "20px",
        fontFamily: "Nunito, sans-serif",
        letterSpacing: "0.3px",
      }}
    >
      {text}
    </span>
    {count !== undefined && (
      <span style={{ color: "#8b84c4", fontSize: "12px", fontWeight: "600" }}>
        {count} video{count !== 1 ? "s" : ""}
      </span>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SearchResultsPanel — hoisted to module scope. Previously redefined
// inside HomePage on every render (and closed over searchQuery,
// searchedReels, etc. directly); now takes them as props. This also
// means it now shares the hoisted VideoCard/YouTubeVideoCard/ShortCard
// components rather than duplicating markup.
// ─────────────────────────────────────────────────────────────────────────────
const SearchResultsPanel = ({
  searchQuery,
  searchedReels,
  searchedLocalVideos,
  ytLoading,
  ytVideos,
  shortCardProps,
  videoCardProps,
  openWatchPage,
}) => (
  <div className="search-results-panel">
    <div style={{ marginBottom: "20px" }}>
      <h2
        style={{
          color: "#1e1b4b",
          fontSize: "18px",
          fontWeight: "800",
          margin: "0 0 6px",
          fontFamily: "Nunito, sans-serif",
        }}
      >
        🔍 Results for "{searchQuery}"
      </h2>
      <span style={{ color: "#8b84c4", fontSize: "13px", fontWeight: "600" }}>
        {searchedLocalVideos.length} local videos · {searchedReels.length}{" "}
        reels · {ytVideos.length} YouTube
      </span>
    </div>
    {searchedReels.length > 0 && (
      <div style={{ marginBottom: "40px" }}>
        <SectionLabel
          color="#f97316"
          bg="#fff7ed"
          text="🎬 REELS"
          count={searchedReels.length}
        />
        <div className="homePage_shortsRow">
          {searchedReels.map((short) => (
            <ShortCard key={short.id} short={short} {...shortCardProps} />
          ))}
        </div>
      </div>
    )}
    {searchedLocalVideos.length > 0 && (
      <div style={{ marginBottom: "40px" }}>
        <SectionLabel
          color="#4c4589"
          bg="#f0f4ff"
          text="🎬 UPLOADED VIDEOS"
          count={searchedLocalVideos.length}
        />
        <div className="youtube_VideoGrid">
          {searchedLocalVideos.map((v) => (
            <VideoCard
              key={v.id}
              video={v}
              isUploaded={v.isUploaded || false}
              {...videoCardProps}
            />
          ))}
        </div>
      </div>
    )}
    {ytLoading && (
      <div style={{ marginBottom: "40px" }}>
        <SectionLabel
          color="#ef4444"
          bg="#fff1f2"
          text="▶ YOUTUBE — searching..."
        />
        <div className="youtube_VideoGrid">
          {[...Array(8)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )}
    {!ytLoading && ytVideos.length > 0 && (
      <div style={{ marginBottom: "40px" }}>
        <SectionLabel
          color="#ef4444"
          bg="#fff1f2"
          text="▶ YOUTUBE"
          count={ytVideos.length}
        />
        <div className="youtube_VideoGrid">
          {ytVideos.map((item) => (
            <YouTubeVideoCard
              key={item.id.videoId}
              item={item}
              onSelect={openWatchPage}
            />
          ))}
        </div>
      </div>
    )}
    {!ytLoading &&
      searchedLocalVideos.length === 0 &&
      searchedReels.length === 0 &&
      ytVideos.length === 0 && (
        <div style={{ textAlign: "center", marginTop: "80px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔍</div>
          <p
            style={{ color: "#8b84c4", fontSize: "16px", fontWeight: "600" }}
          >
            No results for "
            <span style={{ color: "#7c3aed" }}>{searchQuery}</span>"
          </p>
          <p style={{ color: "#c4bfdf", fontSize: "13px", marginTop: "8px" }}>
            Try different keywords
          </p>
        </div>
      )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// DropdownPortal — renders dropdown via portal so it's never clipped by
// overflow:hidden on parent cards. Positions itself relative to the trigger.
// Accepts `menuRef` and attaches it to the portaled DOM node, so the
// outside-click handler in SaveMenuButton can correctly detect clicks
// that land *inside* the portaled menu (which lives in document.body, not
// inside wrapperRef in the real DOM tree).
// FIX: previously only recalculated position once (on mount / when
// wrapperRef changed), so scrolling the page or resizing the window while
// the menu was open left it glued to stale coordinates. Now recalculates
// on scroll (capture phase, so it catches scrolling on any ancestor, not
// just window) and on resize while open.
// ─────────────────────────────────────────────────────────────────────────────
const DropdownPortal = ({ wrapperRef, menuRef, children }) => {
  const [style, setStyle] = React.useState({});

  React.useLayoutEffect(() => {
    if (!wrapperRef.current) return;

    const recalc = () => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const menuWidth = 230;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Prefer opening to the LEFT of the button (so text is never clipped)
      let left = rect.right - menuWidth;
      if (left < 8) left = 8; // clamp left edge
      if (left + menuWidth > viewportWidth - 8)
        // clamp right edge
        left = viewportWidth - menuWidth - 8;

      // Open below; if not enough space flip above
      let top = rect.bottom + 6;
      const estimatedHeight = 220;
      if (top + estimatedHeight > viewportHeight - 8)
        top = rect.top - estimatedHeight - 6;

      setStyle({
        position: "fixed",
        top: top + "px",
        left: left + "px",
        width: menuWidth + "px",
        zIndex: 99999,
      });
    };

    recalc();
    window.addEventListener("scroll", recalc, true);
    window.addEventListener("resize", recalc);
    return () => {
      window.removeEventListener("scroll", recalc, true);
      window.removeEventListener("resize", recalc);
    };
  }, [wrapperRef]);

  return createPortal(
    <div ref={menuRef} style={style}>
      {children}
    </div>,
    document.body,
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SaveMenuButton — three-dots dropdown with direct navigation
// ─────────────────────────────────────────────────────────────────────────────
const SaveMenuButton = ({
  videoId,
  isSaved,
  onToggleWatchLater,
  video,
  loggedInUsername,
  onDelete,
}) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const menuRef = useRef(null); // ref to the portaled menu's DOM node
  const navigate = useNavigate();

  // Close on outside click / touch — checks BOTH the trigger wrapper AND
  // the portaled menu content, since the portal renders into document.body
  // and is therefore not a DOM descendant of wrapperRef.
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      const clickedWrapper =
        wrapperRef.current && wrapperRef.current.contains(e.target);
      const clickedMenu = menuRef.current && menuRef.current.contains(e.target);
      if (!clickedWrapper && !clickedMenu) {
        setOpen(false);
      }
    };
    const t = setTimeout(() => {
      document.addEventListener("mousedown", close);
      document.addEventListener("touchstart", close);
    }, 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  // Lock body scroll while open on mobile
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const isOwner =
    loggedInUsername && video?.username && video.username === loggedInUsername;

  const MENU_ITEMS = [
    {
      id: "watch-later",
      icon: isSaved ? (
        <BookmarkIcon style={{ fontSize: 17, color: "#7c3aed" }} />
      ) : (
        <BookmarkBorderIcon style={{ fontSize: 17, color: "#7c3aed" }} />
      ),
      label: isSaved ? "Saved to Watch Later" : "Save to Watch Later",
      active: isSaved,
      onClick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggleWatchLater(e, videoId);
        setOpen(false);
      },
    },
    {
      id: "playlist",
      icon: <PlaylistAddIcon style={{ fontSize: 17, color: "#7c3aed" }} />,
      label: "Add to Playlist",
      onClick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        navigate("/playlist", { state: { addVideoId: videoId } });
        setOpen(false);
      },
    },
    {
      id: "channel",
      icon: <span style={{ fontSize: 15 }}>👤</span>,
      label: "Go to Channel",
      onClick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        const slug =
          video?.username || video?.channel?.toLowerCase() || "unknown";
        navigate("/user/" + slug);
        setOpen(false);
      },
    },
    {
      id: "share",
      icon: <span style={{ fontSize: 15 }}>🔗</span>,
      label: "Share",
      onClick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Use og URL so WhatsApp shows thumbnail preview
        const url = `https://zixplon-tawny.vercel.app/api/og?type=video&id=${videoId}`;

        if (navigator.share) {
          navigator
            .share({
              title: video?.title || "Video",
              text: `Watch "${video?.title}" on Zixplon`,
              url,
            })
            .catch(() => {});
        } else {
          navigator.clipboard.writeText(url);
          alert("Link copied!");
        }
        setOpen(false);
      },
    },
    ...(isOwner
      ? [
          {
            id: "delete",
            icon: <span style={{ fontSize: 15 }}>🗑️</span>,
            label: "Delete video",
            danger: true,
            onClick: (e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete && onDelete(e, videoId);
              setOpen(false);
            },
          },
        ]
      : []),
  ];

  return (
    <>
      <div
        ref={wrapperRef}
        className="save-menu-wrapper"
        style={{ position: "absolute", top: "8px", right: "8px", zIndex: 11 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Trigger button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          title="More options"
          style={{
            background: open ? "rgba(124,58,237,0.22)" : "rgba(0,0,0,0.55)",
            border: "none",
            color: "white",
            borderRadius: "8px",
            padding: "5px 6px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            transition: "background 0.18s",
          }}
        >
          <MoreVertIcon style={{ fontSize: 17 }} />
        </button>

        {/* Dropdown menu — uses fixed positioning so it never gets clipped */}
        {open && (
          <DropdownPortal wrapperRef={wrapperRef} menuRef={menuRef}>
            <div
              style={{
                minWidth: "230px",
                background: "#ffffff",
                borderRadius: "14px",
                boxShadow:
                  "0 8px 32px rgba(76,69,137,0.28), 0 2px 8px rgba(0,0,0,0.14)",
                border: "1.5px solid #e0d4ff",
                overflow: "hidden",
                animation: "ddFadeSlide 0.16s cubic-bezier(0.32,0.72,0,1)",
              }}
            >
              {MENU_ITEMS.map((item, idx) => (
                <button
                  key={item.id}
                  onMouseDown={(e) => {
                    // Stop the document-level mousedown listener from
                    // ever treating this click as "outside" in the first
                    // place — belt-and-braces alongside the menuRef check.
                    e.stopPropagation();
                  }}
                  onClick={item.onClick}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "11px 16px",
                    background: item.active ? "#f7f0ff" : "transparent",
                    border: "none",
                    borderTop:
                      idx === MENU_ITEMS.length - 1 && item.danger
                        ? "1px solid #fee2e2"
                        : idx > 0
                          ? "1px solid #f5f0ff"
                          : "none",
                    color: item.danger ? "#ef4444" : "#1e1b4b",
                    fontSize: "14px",
                    fontWeight: item.active ? "700" : "600",
                    fontFamily: "Outfit, sans-serif",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.14s",
                    letterSpacing: "0.1px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = item.danger
                      ? "#fff1f2"
                      : "#f7f0ff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = item.active
                      ? "#f7f0ff"
                      : "transparent";
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              ))}
            </div>
          </DropdownPortal>
        )}
      </div>

      <style>{`
        @keyframes ddFadeSlide {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DRAMATIC TRENDING CAROUSEL — cinematic coverflow slideshow.
// 3D coverflow cards, Ken Burns zoom on the active slide, animated title
// reveal, progress bar, dot navigation, chevron buttons, keyboard support
// (arrow keys + Enter/Space), and pause-on-interact with a short resume
// grace period.
// ─────────────────────────────────────────────────────────────────────────────
const DRAMATIC_AUTOPLAY_MS = 4200;

const MOVIE_TAG_LIST = [
  "Hindi Movies",
  "Hollywood Movies",
  "Bhojpuri Cinema",
  "Superhero Movies",
  "Pakistani Movies",
];

// TYPE_BADGE lives at module scope (not inside DramaticTrendingCarousel
// anymore) so the hoisted <TrendingCard> component below can read it too.
const TYPE_BADGE = {
  video: { label: "🎬", bg: "#7c3aed" },
  reel: { label: "📱", bg: "#f97316" },
  movie: { label: "🎥", bg: "#f43f5e" },
  live: { label: "🔴", bg: "#ef4444" },
};

// ─────────────────────────────────────────────────────────────────────────────
// TrendingCard — a single slide of the Trending Now coverflow, hoisted to
// module scope so each card owns its own hover-preview state via
// useHoverPreview (mirrors ShortCard/VideoCard). Preview only ever
// activates on the ACTIVE (centered) slide — hovering a side slide just
// nudges it into focus the way it already did, it doesn't preview.
// ─────────────────────────────────────────────────────────────────────────────
const TrendingCard = ({
  item,
  index,
  isActive,
  offset,
  cardOffset,
  cycleKey,
  isMobile,
  onActivate,
  onJump,
}) => {
  const canPreview = isActive && !isMobile && !!item.src;
  const { isPreviewing, videoRef, onMouseEnter, onMouseLeave } =
    useHoverPreview(canPreview);

  const abs = Math.abs(offset);
  const translateX = offset * cardOffset;
  const scale = isActive ? 1 : Math.max(0.62, 1 - abs * 0.16);
  const rotateY = offset * -16;
  const zIndex = 10 - abs;
  const opacity = 1 - abs * 0.24;
  const blurPx = isActive ? 0 : Math.min(abs * 1.4, 4);
  const badge = TYPE_BADGE[item._type] || TYPE_BADGE.video;

  return (
    <div
      className={"zx-dramatic-card" + (isActive ? " active" : "")}
      style={{
        transform: `translate(-50%, -50%) translateX(${translateX}px) scale(${scale}) rotateY(${rotateY}deg)`,
        zIndex,
        opacity,
        filter: blurPx ? `blur(${blurPx}px)` : "none",
      }}
      onClick={() => (isActive ? onActivate(item) : onJump())}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      tabIndex={isActive ? 0 : -1}
      role="button"
      aria-label={`${item.title}, ${item.channel || item.user}`}
      aria-current={isActive || undefined}
    >
      <span
        className="zx-dramatic-card-badge"
        style={{ background: badge.bg }}
      >
        {badge.label}
      </span>
      <span className="zx-dramatic-card-rank">#{index + 1}</span>
      <div className="zx-dramatic-card-imgwrap">
        <img
          key={isActive ? `active-img-${cycleKey}` : "img"}
          src={item.thumbnail}
          alt={item.title}
          className={
            "zx-dramatic-card-img" +
            (isActive && !isPreviewing ? " kenburns" : "")
          }
          style={{
            opacity: canPreview && isPreviewing ? 0 : 1,
            transition: "opacity 0.25s",
          }}
        />
        {canPreview && isPreviewing && (
          <video
            ref={videoRef}
            src={item.src}
            className="zx-dramatic-card-img"
            muted
            autoPlay
            loop
            playsInline
            preload="metadata"
            style={{ position: "absolute", inset: 0, objectFit: "cover" }}
            onCanPlay={(e) => e.target.play().catch(() => {})}
          />
        )}
        <div className="zx-dramatic-card-gradient" />
      </div>
      {isActive && (
        <div className="zx-dramatic-card-info" key={`info-${cycleKey}`}>
          <div className="zx-dramatic-card-title">{item.title}</div>
          <div className="zx-dramatic-card-channel">
            {item.channel || item.user}
          </div>
        </div>
      )}
    </div>
  );
};

const DramaticTrendingCarousel = ({
  dbVideos,
  dbReels = [],
  onVideoClick,
  onReelClick,
}) => {
  const isMobile = useIsMobile();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [cycleKey, setCycleKey] = useState(0); // remounts progress bar + text reveal each slide
  const resumeTimeoutRef = useRef(null);
  const autoplayTimeoutRef = useRef(null);

  const items = React.useMemo(() => {
    const videoLimit = isMobile ? 6 : 8;
    const reelLimit = isMobile ? 5 : 6;
    const movieLimit = isMobile ? 3 : 4;
    return [
      ...dbVideos.slice(0, videoLimit).map((v) => ({ ...v, _type: "video" })),
      ...dbReels.slice(0, reelLimit).map((r) => ({
        ...r,
        _type: "reel",
        thumbnail: r.thumbnail,
        title: r.title,
        channel: r.user,
      })),
      ...dbVideos
        .filter((v) => v.tags?.some((t) => MOVIE_TAG_LIST.includes(t)))
        .slice(0, movieLimit)
        .map((v) => ({ ...v, _type: "movie" })),
    ].slice(0, isMobile ? 12 : 16);
  }, [dbVideos, dbReels, isMobile]);

  const total = items.length;

  const goTo = (idx) => {
    if (total === 0) return;
    const next = ((idx % total) + total) % total;
    setActiveIndex(next);
    setCycleKey((k) => k + 1);
  };
  const goNext = () => goTo(activeIndex + 1);
  const goPrev = () => goTo(activeIndex - 1);

  const pause = () => {
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    setIsPaused(true);
  };
  const resume = (delay = 0) => {
    const doResume = () => setIsPaused(false);
    if (delay > 0) resumeTimeoutRef.current = setTimeout(doResume, delay);
    else doResume();
  };

  // Autoplay loop — advances one slide every DRAMATIC_AUTOPLAY_MS unless paused
  useEffect(() => {
    if (total === 0 || isPaused) return;
    autoplayTimeoutRef.current = setTimeout(() => {
      goNext();
    }, DRAMATIC_AUTOPLAY_MS);
    return () => clearTimeout(autoplayTimeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, isPaused, total]);

  useEffect(() => {
    return () => {
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    };
  }, []);

  if (total === 0) return null;

  const handleSelect = (item) => {
    if (item._type === "reel") onReelClick && onReelClick(item, items);
    else onVideoClick && onVideoClick(item, items);
  };

  const cardOffset = isMobile ? 130 : 230;

  return (
    <div
      className="zx-dramatic-trending"
      onMouseEnter={pause}
      onMouseLeave={() => resume(0)}
      onTouchStart={pause}
      onTouchEnd={() => resume(900)}
    >
      <div className="zx-dramatic-trending-label">
        <span className="zx-dramatic-z-badge">Z</span>
        <span>Trending Now</span>
        {isPaused && (
          <span className="zx-trending-pause-indicator" aria-hidden="true">
            ⏸ Paused
          </span>
        )}
      </div>

      <div
        className="zx-dramatic-stage"
        role="region"
        aria-label="Trending now — use left and right arrow keys to browse, Enter to open"
        tabIndex={0}
        onFocus={pause}
        onBlur={() => resume(0)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            pause();
            goNext();
            resume(2500);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            pause();
            goPrev();
            resume(2500);
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleSelect(items[activeIndex]);
          }
        }}
      >
        {items.map((item, i) => {
          let offset = i - activeIndex;
          if (offset > total / 2) offset -= total;
          if (offset < -total / 2) offset += total;
          const abs = Math.abs(offset);
          if (abs > 3) return null; // don't render far-off cards, keeps it light

          const isActive = offset === 0;

          return (
            <TrendingCard
              key={`dramatic_${item._type}_${item.id}_${i}`}
              item={item}
              index={i}
              isActive={isActive}
              offset={offset}
              cardOffset={cardOffset}
              cycleKey={cycleKey}
              isMobile={isMobile}
              onActivate={handleSelect}
              onJump={() => {
                pause();
                goTo(i);
                resume(2500);
              }}
            />
          );
        })}

        <button
          className="zx-dramatic-nav prev"
          onClick={() => {
            pause();
            goPrev();
            resume(2500);
          }}
          aria-label="Previous slide"
        >
          ‹
        </button>
        <button
          className="zx-dramatic-nav next"
          onClick={() => {
            pause();
            goNext();
            resume(2500);
          }}
          aria-label="Next slide"
        >
          ›
        </button>
      </div>

      <div className="zx-dramatic-controls">
        <div className="zx-dramatic-dots">
          {items.map((_, i) => (
            <button
              key={i}
              className={
                "zx-dramatic-dot" + (i === activeIndex ? " active" : "")
              }
              onClick={() => {
                pause();
                goTo(i);
                resume(2500);
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
        {!isPaused && (
          <div className="zx-dramatic-progress-track" key={cycleKey}>
            <div
              className="zx-dramatic-progress-bar"
              style={{ animationDuration: DRAMATIC_AUTOPLAY_MS + "ms" }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// WP_THEME + VideoPlayer, AutoplayToggle, WatchNavBar, MetaSection,
// CommentSection, RelatedSidebar — stable, top-level components (data
// passed in as props) so React keeps the same component identity across
// WatchPage re-renders. The <iframe> is only unmounted/remounted when
// `videoId` itself actually changes (via its `key={videoId}`), which is
// the only time we actually want that to happen.
// ─────────────────────────────────────────────────────────────────────────────

const WP_THEME = {
  bg: "#f0f4ff",
  surface: "#ffffff",
  surface2: "#f7f0ff",
  border: "#e0d4ff",
  primary: "#7c3aed",
  primary2: "#a855f7",
  text: "#1e1b4b",
  text2: "#4c4589",
  text3: "#8b84c4",
  accent: "#f43f5e",
};

const VideoPlayer = ({ videoId, videoTitle, isMobile }) => (
  <div
    style={{
      width: "100%",
      position: "relative",
      paddingBottom: "56.25%",
      height: 0,
      overflow: "hidden",
      background: "#1e1b4b",
      borderRadius: isMobile ? "0" : "16px",
      flexShrink: 0,
    }}
  >
    <iframe
      key={videoId}
      src={
        "https://www.youtube.com/embed/" +
        videoId +
        "?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1"
      }
      title={videoTitle}
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        border: "none",
        display: "block",
      }}
    />
  </div>
);

const AutoplayToggle = ({ autoplay, setAutoplay }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
    <span style={{ color: WP_THEME.text3, fontSize: "13px" }}>Autoplay</span>
    <div
      onClick={() => setAutoplay((a) => !a)}
      style={{
        width: "44px",
        height: "24px",
        background: autoplay ? WP_THEME.primary : "#d1d5db",
        borderRadius: "12px",
        cursor: "pointer",
        position: "relative",
        transition: "background 0.3s",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: "18px",
          height: "18px",
          background: "white",
          borderRadius: "50%",
          position: "absolute",
          top: "3px",
          left: autoplay ? "23px" : "3px",
          transition: "left 0.3s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        }}
      />
    </div>
    <span
      style={{
        color: autoplay ? WP_THEME.primary : "#9ca3af",
        fontSize: "12px",
        fontWeight: "700",
      }}
    >
      {autoplay ? "ON" : "OFF"}
    </span>
  </div>
);

const WatchNavBar = ({
  goPrev,
  hasPrev,
  goNext,
  hasNext,
  autoplay,
  setAutoplay,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: WP_THEME.surface2,
      borderRadius: "12px",
      padding: "10px 16px",
      marginTop: "10px",
      gap: "8px",
      border: "1px solid " + WP_THEME.border,
    }}
  >
    <button
      onClick={goPrev}
      disabled={!hasPrev}
      style={{
        background: hasPrev ? WP_THEME.surface : "#f3f4f6",
        border: "1.5px solid " + (hasPrev ? WP_THEME.border : "#e5e7eb"),
        color: hasPrev ? WP_THEME.text : "#9ca3af",
        borderRadius: "20px",
        padding: "8px 18px",
        cursor: hasPrev ? "pointer" : "not-allowed",
        fontSize: "14px",
        fontWeight: "700",
        whiteSpace: "nowrap",
      }}
    >
      ⏮ Previous
    </button>
    <AutoplayToggle autoplay={autoplay} setAutoplay={setAutoplay} />
    <button
      onClick={goNext}
      disabled={!hasNext}
      style={{
        background: hasNext ? WP_THEME.primary : "#f3f4f6",
        border: "none",
        color: hasNext ? "white" : "#9ca3af",
        borderRadius: "20px",
        padding: "8px 18px",
        cursor: hasNext ? "pointer" : "not-allowed",
        fontSize: "14px",
        fontWeight: "700",
        whiteSpace: "nowrap",
      }}
    >
      Next ⏭
    </button>
  </div>
);

const MetaSection = ({
  videoTitle,
  isMobile,
  channelName,
  subscribedChannels,
  handleSubscribe,
  isLiked,
  setIsLiked,
  isDisliked,
  setIsDisliked,
  likeCount,
  videoId,
  description,
  publishedAt,
  showFullDesc,
  setShowFullDesc,
  onClose,
}) => (
  <div style={{ padding: isMobile ? "0 12px" : "0" }}>
    <div
      style={{
        color: WP_THEME.text,
        fontWeight: "700",
        fontSize: isMobile ? "15px" : "18px",
        lineHeight: "1.4",
        marginTop: "14px",
      }}
    >
      {videoTitle}
    </div>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "12px",
        marginTop: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <img
          src={
            "https://ui-avatars.com/api/?name=" +
            encodeURIComponent(channelName) +
            "&background=random&size=40"
          }
          alt={channelName}
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            flexShrink: 0,
          }}
        />
        <div>
          <div
            style={{ color: WP_THEME.text, fontWeight: "700", fontSize: "15px" }}
          >
            {channelName}
          </div>
          <div style={{ color: WP_THEME.text3, fontSize: "12px" }}>
            1.2M subscribers
          </div>
        </div>
        <button
          onClick={() => handleSubscribe(channelName)}
          style={{
            background: subscribedChannels.has(channelName)
              ? WP_THEME.surface2
              : WP_THEME.primary,
            color: subscribedChannels.has(channelName)
              ? WP_THEME.primary
              : "white",
            border: "1.5px solid " + WP_THEME.primary,
            borderRadius: "20px",
            padding: "8px 18px",
            fontWeight: "700",
            cursor: "pointer",
            fontSize: "14px",
            marginLeft: "4px",
            whiteSpace: "nowrap",
          }}
        >
          {subscribedChannels.has(channelName) ? "✓ Subscribed" : "Subscribe"}
        </button>
      </div>
    </div>
    <div
      style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        marginTop: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          background: WP_THEME.surface2,
          borderRadius: "20px",
          overflow: "hidden",
          border: "1.5px solid " + WP_THEME.border,
        }}
      >
        <button
          onClick={() => {
            setIsLiked((l) => !l);
            if (isDisliked) setIsDisliked(false);
          }}
          style={{
            background: isLiked ? "#ede9fe" : "transparent",
            border: "none",
            color: isLiked ? WP_THEME.primary : WP_THEME.text2,
            padding: "8px 16px",
            cursor: "pointer",
            fontSize: "14px",
            borderRight: "1px solid " + WP_THEME.border,
            fontWeight: "600",
          }}
        >
          👍 {(likeCount + (isLiked ? 1 : 0)).toLocaleString()}
        </button>
        <button
          onClick={() => {
            setIsDisliked((d) => !d);
            if (isLiked) setIsLiked(false);
          }}
          style={{
            background: isDisliked ? "#fff1f2" : "transparent",
            border: "none",
            color: isDisliked ? WP_THEME.accent : WP_THEME.text2,
            padding: "8px 16px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "600",
          }}
        >
          👎
        </button>
      </div>
      <button
        onClick={() => {
          navigator.clipboard.writeText(
            "https://www.youtube.com/watch?v=" + videoId,
          );
          alert("Link copied!");
        }}
        style={{
          background: WP_THEME.surface2,
          border: "1.5px solid " + WP_THEME.border,
          color: WP_THEME.text2,
          borderRadius: "20px",
          padding: "8px 16px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "600",
        }}
      >
        🔗 Share
      </button>
      <button
        onClick={onClose}
        style={{
          background: WP_THEME.surface2,
          border: "1.5px solid " + WP_THEME.border,
          color: WP_THEME.text3,
          borderRadius: "20px",
          padding: "8px 16px",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: "600",
        }}
      >
        ✕ Close
      </button>
    </div>
    {description !== null && (
      <div
        onClick={() => setShowFullDesc((s) => !s)}
        style={{
          background: WP_THEME.surface2,
          borderRadius: "12px",
          padding: "14px 16px",
          marginTop: "14px",
          color: WP_THEME.text2,
          fontSize: "14px",
          lineHeight: "1.6",
          cursor: "pointer",
          border: "1px solid " + WP_THEME.border,
        }}
      >
        {publishedAt && (
          <div
            style={{ color: WP_THEME.text3, fontSize: "13px", marginBottom: "6px" }}
          >
            {new Date(publishedAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        )}
        <p
          style={{
            margin: 0,
            display: showFullDesc ? "block" : "-webkit-box",
            WebkitLineClamp: showFullDesc ? "unset" : 2,
            WebkitBoxOrient: "vertical",
            overflow: showFullDesc ? "visible" : "hidden",
          }}
        >
          {description || "No description available."}
        </p>
        <span
          style={{
            color: WP_THEME.primary,
            fontWeight: "700",
            fontSize: "13px",
            marginTop: "6px",
            display: "block",
          }}
        >
          {showFullDesc ? "Show less" : "...more"}
        </span>
      </div>
    )}
  </div>
);

const CommentSection = ({
  isMobile,
  comments,
  newComment,
  setNewComment,
  likedComments,
  addComment,
  toggleCommentLike,
}) => (
  <div style={{ padding: isMobile ? "0 12px 40px" : "0 0 40px" }}>
    <div
      style={{
        color: WP_THEME.text,
        fontWeight: "700",
        fontSize: "16px",
        margin: "28px 0 20px",
      }}
    >
      {comments.length} Comments
    </div>
    <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          flexShrink: 0,
          background: WP_THEME.primary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: "800",
          fontSize: "12px",
        }}
      >
        YO
      </div>
      <div style={{ flex: 1 }}>
        <input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addComment()}
          placeholder="Add a comment..."
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            borderBottom: "2px solid " + WP_THEME.border,
            color: WP_THEME.text,
            fontSize: "14px",
            padding: "8px 0",
            outline: "none",
            boxSizing: "border-box",
            fontFamily: "Outfit, sans-serif",
          }}
          onFocus={(e) => (e.target.style.borderBottomColor = WP_THEME.primary)}
          onBlur={(e) => (e.target.style.borderBottomColor = WP_THEME.border)}
        />
        {newComment.trim() && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
              marginTop: "8px",
            }}
          >
            <button
              onClick={() => setNewComment("")}
              style={{
                background: "none",
                border: "none",
                color: WP_THEME.text3,
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              Cancel
            </button>
            <button
              onClick={addComment}
              style={{
                background: WP_THEME.primary,
                border: "none",
                color: "white",
                borderRadius: "20px",
                padding: "6px 16px",
                cursor: "pointer",
                fontWeight: "700",
                fontSize: "14px",
              }}
            >
              Comment
            </button>
          </div>
        )}
      </div>
    </div>
    {comments.map((c) => (
      <div
        key={c.id}
        style={{ display: "flex", gap: "12px", marginBottom: "20px" }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            flexShrink: 0,
            background: getColor(c.avatar),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: "800",
            fontSize: "11px",
          }}
        >
          {c.avatar}
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              marginBottom: "4px",
            }}
          >
            <span
              style={{ color: WP_THEME.text, fontWeight: "700", fontSize: "13px" }}
            >
              {c.user}
            </span>
            <span style={{ color: WP_THEME.text3, fontSize: "12px" }}>
              {c.time}
            </span>
          </div>
          <p
            style={{
              color: WP_THEME.text2,
              fontSize: "14px",
              margin: "0 0 6px",
              lineHeight: "1.5",
            }}
          >
            {c.text}
          </p>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={() => toggleCommentLike(c.id)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                color: likedComments.has(c.id) ? WP_THEME.primary : WP_THEME.text3,
                fontSize: "13px",
                fontWeight: "600",
              }}
            >
              👍 {c.likes}
            </button>
            <span
              style={{ color: WP_THEME.text3, fontSize: "13px", cursor: "pointer" }}
            >
              👎
            </span>
            <span
              style={{
                color: WP_THEME.text3,
                fontSize: "13px",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              Reply
            </span>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const RelatedSidebar = ({
  suggestions,
  currentIndex,
  goTo,
  isMobile,
  autoplay,
  setAutoplay,
}) => {
  const relatedList = suggestions.filter((_, i) => i !== currentIndex);
  return (
    <div
      style={{
        width: isMobile ? "100%" : "402px",
        flexShrink: 0,
        overflowY: isMobile ? "visible" : "auto",
        scrollbarWidth: "thin",
        scrollbarColor: WP_THEME.border + " transparent",
        background: WP_THEME.surface,
        borderLeft: isMobile ? "none" : "2px solid " + WP_THEME.border,
        padding: "12px 10px 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "14px",
        }}
      >
        <span style={{ color: WP_THEME.text, fontWeight: "800", fontSize: "14px" }}>
          Up Next
        </span>
        <AutoplayToggle autoplay={autoplay} setAutoplay={setAutoplay} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {relatedList.map((s) => {
          const realIdx = suggestions.indexOf(s);
          const isYTItem = !!s.snippet;
          const thumb = isYTItem
            ? s.snippet.thumbnails.medium.url
            : s.thumbnail;
          const title = isYTItem ? s.snippet.title : s.title;
          const channel = isYTItem ? s.snippet.channelTitle : s.channel;
          const hasVid =
            (isYTItem && !!s.id?.videoId) || (!isYTItem && !!s.src);
          return (
            <div
              key={s.id?.videoId || s.id || realIdx}
              onClick={() => hasVid && goTo(realIdx)}
              style={{
                display: "flex",
                gap: "8px",
                cursor: hasVid ? "pointer" : "default",
                borderRadius: "10px",
                padding: "6px",
                transition: "background 0.2s",
                opacity: hasVid ? 1 : 0.5,
                border: "1px solid transparent",
              }}
              onMouseEnter={(e) => {
                if (hasVid) {
                  e.currentTarget.style.background = WP_THEME.surface2;
                  e.currentTarget.style.borderColor = WP_THEME.border;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "transparent";
              }}
            >
              <div
                style={{
                  position: "relative",
                  flexShrink: 0,
                  width: "168px",
                  height: "94px",
                  borderRadius: "10px",
                  overflow: "hidden",
                  background: "#e8e0ff",
                }}
              >
                <img
                  src={thumb}
                  alt={title}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                {isYTItem && (
                  <div
                    style={{
                      position: "absolute",
                      top: "4px",
                      left: "4px",
                      background: "#ef4444",
                      color: "#fff",
                      fontSize: "9px",
                      fontWeight: "800",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    ▶ YT
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingTop: "2px" }}>
                <div
                  style={{
                    color: WP_THEME.text,
                    fontSize: "13px",
                    fontWeight: "600",
                    lineHeight: "1.4",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    marginBottom: "4px",
                  }}
                >
                  {title}
                </div>
                <div
                  style={{
                    color: WP_THEME.text3,
                    fontSize: "12px",
                    marginBottom: "2px",
                    fontWeight: "600",
                  }}
                >
                  {channel}
                </div>
                {isYTItem && s.snippet?.publishedAt && (
                  <div style={{ color: WP_THEME.text3, fontSize: "12px" }}>
                    {new Date(s.snippet.publishedAt).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" },
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const WatchPage = ({
  initialVideoId,
  initialTitle,
  initialChannel,
  onClose,
  suggestions,
  onIncrementView,
}) => {
  const isMobile = useIsMobile();
  const [currentIndex, setCurrentIndex] = useState(() => {
    const i = suggestions.findIndex((s) => s.id?.videoId === initialVideoId);
    return i >= 0 ? i : 0;
  });
  const [autoplay, setAutoplay] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [likeCount] = useState(() => Math.floor(Math.random() * 50000) + 1000);
  const [comments, setComments] = useState(MOCK_COMMENTS);
  const [newComment, setNewComment] = useState("");
  const [likedComments, setLikedComments] = useState(new Set());
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [subscribedChannels, setSubscribedChannels] = useState(new Set());

  const item = suggestions[currentIndex] || null;
  const isYT = item && !!item.snippet;
  const videoId = isYT && item.id?.videoId ? item.id.videoId : initialVideoId;
  const videoTitle = isYT ? item.snippet.title : (item?.title ?? initialTitle);
  const channelName = isYT
    ? item.snippet.channelTitle
    : (item?.channel ?? initialChannel);
  const publishedAt = isYT ? item.snippet.publishedAt : null;
  const description = isYT ? item.snippet.description : null;

  const goTo = (idx) => {
    const clampedIdx = Math.max(0, Math.min(idx, suggestions.length - 1));
    const target = suggestions[clampedIdx];
    if (target && onIncrementView) {
      const isYTItem = !!target.snippet;
      if (!isYTItem && target.src && target.id)
        onIncrementView(String(target.id), "video");
    }
    setCurrentIndex(clampedIdx);
    setIsLiked(false);
    setIsDisliked(false);
    setShowFullDesc(false);
  };

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < suggestions.length - 1;
  const goPrev = () => {
    if (hasPrev) goTo(currentIndex - 1);
  };
  const goNext = () => {
    if (hasNext) goTo(currentIndex + 1);
  };

  const autoplayRef = useRef(autoplay);
  useEffect(() => {
    autoplayRef.current = autoplay;
  }, [autoplay]);
  const hasNextRef = useRef(hasNext);
  useEffect(() => {
    hasNextRef.current = hasNext;
  }, [hasNext]);
  const goNextRef = useRef(goNext);
  useEffect(() => {
    goNextRef.current = goNext;
  });

  useEffect(() => {
    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (
          data.event === "infoDelivery" &&
          data.info &&
          data.info.playerState === 0
        ) {
          if (autoplayRef.current && hasNextRef.current) goNextRef.current();
        }
      } catch (_) {}
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleSubscribe = (ch) => {
    setSubscribedChannels((prev) => {
      const next = new Set(prev);
      next.has(ch) ? next.delete(ch) : next.add(ch);
      return next;
    });
  };

  const addComment = () => {
    if (!newComment.trim()) return;
    setComments((prev) => [
      {
        id: Date.now(),
        user: "You",
        avatar: "YO",
        text: newComment.trim(),
        likes: 0,
        time: "Just now",
      },
      ...prev,
    ]);
    setNewComment("");
  };

  const toggleCommentLike = (id) => {
    setLikedComments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setComments((c) =>
          c.map((x) => (x.id === id ? { ...x, likes: x.likes - 1 } : x)),
        );
      } else {
        next.add(id);
        setComments((c) =>
          c.map((x) => (x.id === id ? { ...x, likes: x.likes + 1 } : x)),
        );
      }
      return next;
    });
  };

  if (isMobile) {
    return (
      <>
        <style>
          {".hp-watch-root{-webkit-overflow-scrolling:touch;}.hp-watch-root *{-webkit-transform:none !important;}"}
        </style>
        <div className="hp-watch-root">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              background: "#ffffff",
              borderBottom: "2px solid #e0d4ff",
              flexShrink: 0,
            }}
          >
            <button
              onClick={onClose}
              style={{
                background: "#f7f0ff",
                border: "1.5px solid #e0d4ff",
                color: "#7c3aed",
                fontSize: "13px",
                cursor: "pointer",
                padding: "6px 12px",
                borderRadius: "20px",
                fontWeight: "700",
              }}
            >
              ← Back
            </button>
            <span
              style={{
                color: "#1e1b4b",
                fontWeight: "700",
                fontSize: "13px",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {videoTitle}
            </span>
            <span
              style={{
                background: "#ef4444",
                color: "#fff",
                fontSize: "10px",
                fontWeight: "800",
                padding: "2px 8px",
                borderRadius: "5px",
              }}
            >
              ▶ YT
            </span>
          </div>
          <VideoPlayer videoId={videoId} videoTitle={videoTitle} isMobile={isMobile} />
          <div style={{ padding: "0 12px" }}>
            <WatchNavBar
              goPrev={goPrev}
              hasPrev={hasPrev}
              goNext={goNext}
              hasNext={hasNext}
              autoplay={autoplay}
              setAutoplay={setAutoplay}
            />
          </div>
          <MetaSection
            videoTitle={videoTitle}
            isMobile={isMobile}
            channelName={channelName}
            subscribedChannels={subscribedChannels}
            handleSubscribe={handleSubscribe}
            isLiked={isLiked}
            setIsLiked={setIsLiked}
            isDisliked={isDisliked}
            setIsDisliked={setIsDisliked}
            likeCount={likeCount}
            videoId={videoId}
            description={description}
            publishedAt={publishedAt}
            showFullDesc={showFullDesc}
            setShowFullDesc={setShowFullDesc}
            onClose={onClose}
          />
          <CommentSection
            isMobile={isMobile}
            comments={comments}
            newComment={newComment}
            setNewComment={setNewComment}
            likedComments={likedComments}
            addComment={addComment}
            toggleCommentLike={toggleCommentLike}
          />
          <div style={{ borderTop: "8px solid #f0f4ff", marginTop: "8px" }}>
            <RelatedSidebar
              suggestions={suggestions}
              currentIndex={currentIndex}
              goTo={goTo}
              isMobile={isMobile}
              autoplay={autoplay}
              setAutoplay={setAutoplay}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>
        {"::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-thumb{background:#e0d4ff;border-radius:4px;}"}
      </style>
      <div
        style={{
          position: "fixed",
          top: "55px",
          left: "0",
          right: "0",
          bottom: "0",
          zIndex: 999,
          background: "#f0f4ff",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Outfit', sans-serif",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "52px",
            flexShrink: 0,
            background: "#ffffff",
            borderBottom: "2px solid #e0d4ff",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            gap: "10px",
            boxShadow: "0 2px 12px rgba(124,58,237,0.06)",
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#8b84c4",
              cursor: "pointer",
              fontSize: "22px",
              lineHeight: 1,
              padding: "4px 10px",
              borderRadius: "8px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f7f0ff";
              e.currentTarget.style.color = "#7c3aed";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none";
              e.currentTarget.style.color = "#8b84c4";
            }}
          >
            ←
          </button>
          <div
            style={{ width: "1px", height: "20px", background: "#e0d4ff" }}
          />
          <span
            style={{
              color: "#1e1b4b",
              fontWeight: "700",
              fontSize: "14px",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {videoTitle}
          </span>
          <span
            style={{
              background: "#ef4444",
              color: "#fff",
              fontSize: "11px",
              fontWeight: "800",
              padding: "3px 10px",
              borderRadius: "5px",
              flexShrink: 0,
            }}
          >
            ▶ YouTube
          </span>
        </div>
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px 24px",
              minWidth: 0,
              scrollbarWidth: "thin",
              scrollbarColor: "#e0d4ff transparent",
            }}
          >
            <VideoPlayer videoId={videoId} videoTitle={videoTitle} isMobile={isMobile} />
            <WatchNavBar
              goPrev={goPrev}
              hasPrev={hasPrev}
              goNext={goNext}
              hasNext={hasNext}
              autoplay={autoplay}
              setAutoplay={setAutoplay}
            />
            <MetaSection
              videoTitle={videoTitle}
              isMobile={isMobile}
              channelName={channelName}
              subscribedChannels={subscribedChannels}
              handleSubscribe={handleSubscribe}
              isLiked={isLiked}
              setIsLiked={setIsLiked}
              isDisliked={isDisliked}
              setIsDisliked={setIsDisliked}
              likeCount={likeCount}
              videoId={videoId}
              description={description}
              publishedAt={publishedAt}
              showFullDesc={showFullDesc}
              setShowFullDesc={setShowFullDesc}
              onClose={onClose}
            />
            <CommentSection
              isMobile={isMobile}
              comments={comments}
              newComment={newComment}
              setNewComment={setNewComment}
              likedComments={likedComments}
              addComment={addComment}
              toggleCommentLike={toggleCommentLike}
            />
          </div>
          <div
            style={{
              width: "402px",
              flexShrink: 0,
              overflowY: "auto",
              scrollbarWidth: "thin",
              scrollbarColor: "#e0d4ff transparent",
            }}
          >
            <RelatedSidebar
              suggestions={suggestions}
              currentIndex={currentIndex}
              goTo={goTo}
              isMobile={isMobile}
              autoplay={autoplay}
              setAutoplay={setAutoplay}
            />
          </div>
        </div>
      </div>
    </>
  );
};

const HomePage = ({ sideNavbar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [selectedOption, setSelectedOption] = useState("All");
  const [mobileTab, setMobileTab] = useState("shorts");

  // Ref for the desktop LiveBrowser section, so the dedicated "Live" pill
  // in the category strip can smooth-scroll straight to it.
  const liveBrowserRef = useRef(null);

  const TAB_IDS = MOBILE_TABS.map((t) => t.id);
  const goNextTab = () => {
    setMobileTab((cur) => {
      const idx = TAB_IDS.indexOf(cur);
      return idx < TAB_IDS.length - 1 ? TAB_IDS[idx + 1] : cur;
    });
  };
  const goPrevTab = () => {
    setMobileTab((cur) => {
      const idx = TAB_IDS.indexOf(cur);
      return idx > 0 ? TAB_IDS[idx - 1] : cur;
    });
  };
  const swipeHandlers = useSwipeTabs(goNextTab, goPrevTab);

  const searchQuery = (() => {
    const params = new URLSearchParams(location.search);
    return (params.get("q") || "").trim().toLowerCase();
  })();

  const optionsTrackRef = useRef(null);
  const autoScrollRef = useRef(null);
  const isPausedRef = useRef(false);
  const [ytVideos, setYtVideos] = useState([]);
  const [ytLoading, setYtLoading] = useState(false);
  const [watchVideo, setWatchVideo] = useState(null);
  const [dbVideos, setDbVideos] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbReels, setDbReels] = useState([]);
  const [viewCounts, setViewCounts] = useState({});
  const [watchedContentIds, setWatchedContentIds] = useState(new Set());
  const [watchLaterIds, setWatchLaterIds] = useState(new Set());
  const [playlistsCache, setPlaylistsCache] = useState(null);
  const loggedInUsername = localStorage.getItem("username") || "";

  const loadWatchedIds = React.useCallback(async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) return;
    const { data } = await supabase
      .from("views")
      .select("content_id, content_type")
      .eq("user_id", userId);
    if (data) {
      const ids = new Set(data.map((r) => `${r.content_type}_${r.content_id}`));
      setWatchedContentIds(ids);
    }
  }, []);

  useEffect(() => {
    const loadWatchLater = async () => {
      const username = localStorage.getItem("username");
      if (!username) return;
      const { data } = await supabase
        .from("watch_later")
        .select("video_id")
        .eq("username", username);
      if (data) setWatchLaterIds(new Set(data.map((r) => String(r.video_id))));
    };
    loadWatchLater();
  }, []);

  useEffect(() => {
    loadWatchedIds();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") loadWatchedIds();
    };
    const handleFocus = () => loadWatchedIds();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    const interval = setInterval(loadWatchedIds, 30000);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, [loadWatchedIds]);

  const incrementView = async (contentId, contentType) => {
    const storageKey = `lastViewed_${contentType}_${contentId}`;
    const lastViewed = localStorage.getItem(storageKey);
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    if (lastViewed && now - parseInt(lastViewed, 10) < TWENTY_FOUR_HOURS)
      return;
    localStorage.setItem(storageKey, String(now));
    localStorage.setItem(`viewed_${contentType}_${contentId}`, "true");
    const key = `${contentType}_${contentId}`;
    setViewCounts((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
    try {
      const userId = localStorage.getItem("userId");
      if (!userId) return;
      await supabase.from("views").upsert(
        {
          user_id: userId,
          content_id: String(contentId),
          content_type: contentType,
          viewed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,content_id,content_type" },
      );
    } catch (_) {}
  };

  const fetchViewCounts = async (ids, contentType) => {
    if (!ids || !ids.length) return;
    try {
      const { data, error } = await supabase
        .from("views")
        .select("content_id")
        .eq("content_type", contentType)
        .in("content_id", ids.map(String));
      const map = {};
      ids.forEach((id) => {
        map[contentType + "_" + id] = 0;
      });
      if (!error && data) {
        data.forEach((r) => {
          const k = contentType + "_" + r.content_id;
          map[k] = (map[k] || 0) + 1;
        });
      }
      setViewCounts((prev) => ({ ...prev, ...map }));
    } catch (_) {}
  };

  // "Live" removed from this filterable options array — it now has its own
  // dedicated pill (rendered separately below) that scrolls to / switches
  // to the real LiveKit LiveBrowser section instead of filtering uploaded
  // videos tagged "Live".
  const options = [
    "All",
    "DD News",
    "Kapil Sharma Show",
    "Hindi Movies",
    "Hindi News",
    "English News",
    "Film Criticisms",
    "Twenty20 Cricket",
    "Music",
    "Mixes",
    "Gaming",
    "Debates",
    "Coke Studio India",
    "Democracy",
    "Pakistani Dramas",
    "Pakistani Movies",
    "Comedy",
    "Podcasts",
    "WWE",
    "Superhero Movies",
    "Dramedy",
    "Web Development",
    "Hollywood Movies",
    "Dubbed Hollywood Movies",
    "Web Series",
    "Professional Wrestling",
    "Bhojpuri Cinema",
    "Bhojpuri Songs",
    "Astronomy",
    "AI",
    "History",
    "Geographical Videos",
    "National Geography",
    "Indian Music",
    "Indian Movies",
    "Recently Uploaded",
    "Watched",
  ];

  useEffect(() => {
    const fetchDbVideos = async () => {
      setDbLoading(true);
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) {
        const formatted = data.map((v) => ({
          id: v.id,
          src: v.video_url,
          thumbnail: v.thumbnail_url,
          title: v.title,
          duration: v.duration || "00:00",
          channel: v.channel,
          username: v.username || v.channel?.toLowerCase() || "unknown",
          tags: [v.category || "All"],
          likes: v.likes ?? 0,
          created_at: v.created_at || null,
        }));
        const videoIds = formatted.map((v) => String(v.id));
        const { data: likesData } = await supabase
          .from("likes")
          .select("content_id")
          .eq("content_type", "video")
          .in("content_id", videoIds);
        if (likesData) {
          const likesMap = {};
          likesData.forEach((row) => {
            likesMap[row.content_id] = (likesMap[row.content_id] || 0) + 1;
          });
          setDbVideos(
            formatted.map((v) => ({
              ...v,
              likes: likesMap[String(v.id)] ?? v.likes ?? 0,
            })),
          );
        } else {
          setDbVideos(formatted);
        }
        fetchViewCounts(
          formatted.map((v) => v.id),
          "video",
        );
      }
      setDbLoading(false);
    };
    fetchDbVideos();

    const subscription = supabase
      .channel("videos-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "videos" },
        (payload) => {
          const v = payload.new;
          const newVideo = {
            id: v.id,
            src: v.video_url,
            thumbnail: v.thumbnail_url,
            title: v.title,
            duration: v.duration || "00:00",
            channel: v.channel,
            username: v.username || v.channel?.toLowerCase() || "unknown",
            tags: [v.category || "All"],
            likes: v.likes ?? 0,
            created_at: v.created_at || null,
          };
          setDbVideos((prev) => [newVideo, ...prev]);
          fetchViewCounts([v.id], "video");
          loadWatchedIds();
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "videos" },
        (payload) => {
          setDbVideos((prev) => prev.filter((v) => v.id !== payload.old.id));
        },
      )
      .subscribe();
    return () => supabase.removeChannel(subscription);
  }, [loadWatchedIds]);

  useEffect(() => {
    const fetchDbReels = async () => {
      const { data, error } = await supabase
        .from("reels")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) {
        const formatted = data.map((r) => ({
          id: "db_" + r.id,
          dbId: r.id,
          src: r.video_url,
          thumbnail: r.thumbnail || "https://picsum.photos/200/350?random=99",
          title: r.title || "Untitled",
          duration: r.duration || "00:00",
          user: r.user || r.username || "Unknown",
          username: r.username || "unknown",
          profilePic:
            "https://api.dicebear.com/7.x/initials/svg?seed=" +
            (r.username || "user"),
          description: r.description || "",
          likes: r.likes ?? 0,
          created_at: r.created_at || null,
        }));
        setDbReels(formatted);
        fetchViewCounts(
          formatted.map((r) => r.id),
          "reel",
        );
      }
    };
    fetchDbReels();

    const reelsSub = supabase
      .channel("reels-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reels" },
        (payload) => {
          const r = payload.new;
          const newReel = {
            id: "db_" + r.id,
            dbId: r.id,
            src: r.video_url,
            thumbnail: r.thumbnail || "https://picsum.photos/200/350?random=99",
            title: r.title || "Untitled",
            duration: r.duration || "00:00",
            user: r.user || r.username || "Unknown",
            username: r.username || "unknown",
            profilePic:
              "https://api.dicebear.com/7.x/initials/svg?seed=" +
              (r.username || "user"),
            description: r.description || "",
            likes: r.likes || 0,
            created_at: r.created_at || null,
          };
          setDbReels((prev) => [newReel, ...prev]);
          fetchViewCounts([r.id], "reel");
          loadWatchedIds();
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "reels" },
        (payload) => {
          setDbReels((prev) => prev.filter((r) => r.dbId !== payload.old.id));
        },
      )
      .subscribe();
    return () => supabase.removeChannel(reelsSub);
  }, [loadWatchedIds]);

  // Only uploaded content (from Supabase) is shown — no hardcoded/static
  // demo videos or reels are merged in anymore.
  const allVideos = dbVideos;
  const allReels = dbReels;

  useEffect(() => {
    if (searchQuery) fetchYouTubeByTopic(searchQuery);
    else fetchYouTubeByTopic(selectedOption);
  }, [selectedOption, searchQuery]);

  useEffect(() => {
    const track = optionsTrackRef.current;
    if (!track) return;
    let pos = 0;
    const speed = 0.6;
    const step = () => {
      if (!isPausedRef.current) {
        pos += speed;
        if (pos >= track.scrollWidth - track.clientWidth) pos = 0;
        track.scrollLeft = pos;
      }
      autoScrollRef.current = requestAnimationFrame(step);
    };
    autoScrollRef.current = requestAnimationFrame(step);
    return () => {
      if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current);
    };
  }, []);

  // FIX: previously, any non-403 error (a network blip, a 500, a timeout)
  // caused an immediate `break` — giving up on the whole search even
  // though there were still unused keys left to try. Now only a genuine
  // client error (4xx that isn't a quota/rate-limit code) stops the loop;
  // quota errors (403/429) and network-level failures (no `err.response`
  // at all) both advance to the next key and retry.
  const fetchYouTubeByTopic = async (topic) => {
    if (["All", "Recently Uploaded", "Watched"].includes(topic)) {
      setYtVideos([]);
      return;
    }
    setYtLoading(true);
    setYtVideos([]);
    for (let i = 0; i < API_KEYS.length; i++) {
      const keyIndex = (currentKeyIndex + i) % API_KEYS.length;
      try {
        const res = await axios.get(
          "https://www.googleapis.com/youtube/v3/search",
          {
            params: {
              part: "snippet",
              q: topic,
              type: "video",
              maxResults: 50,
              order: "relevance",
              key: API_KEYS[keyIndex],
            },
          },
        );
        currentKeyIndex = keyIndex;
        setYtVideos(res.data.items || []);
        break;
      } catch (err) {
        const status = err.response?.status;
        const isQuotaOrNetworkIssue =
          status === 403 || status === 429 || !err.response;
        if (isQuotaOrNetworkIssue) {
          currentKeyIndex = (keyIndex + 1) % API_KEYS.length;
          continue;
        }
        break; // genuine client error (e.g. bad request) — no point retrying
      }
    }
    setYtLoading(false);
  };

  const openWatchPage = (videoId, title, channel, dbVideoId = null) => {
    if (dbVideoId) incrementView(String(dbVideoId), "video");
    setWatchVideo({ videoId, title, channel });
  };
  const closeWatchPage = () => setWatchVideo(null);
  const getSuggestions = () => [
    ...ytVideos.slice(0, 20),
    ...allVideos.slice(0, 12),
  ];
  const filteredVideos =
    selectedOption === "All"
      ? allVideos
      : allVideos.filter((v) => v.tags?.includes(selectedOption));
  const searchActive = searchQuery.length > 0;

  const scoreVideo = (v) => {
    let score = 0;
    const words = searchQuery.split(/\s+/).filter(Boolean);
    const title = (v.title || "").toLowerCase();
    const channel = (v.channel || "").toLowerCase();
    const tags = (v.tags || []).map((t) => t.toLowerCase());
    const description = (v.description || "").toLowerCase();
    for (const w of words) {
      if (title.includes(w)) score += 4;
      if (tags.some((t) => t.includes(w))) score += 3;
      if (channel.includes(w)) score += 2;
      if (description.includes(w)) score += 1;
    }
    return score;
  };

  const searchedLocalVideos = searchActive
    ? dbVideos
        .map((v) => ({ ...v, isUploaded: true }))
        .map((v) => ({ ...v, _score: scoreVideo(v) }))
        .filter((v) => v._score > 0)
        .sort((a, b) => b._score - a._score)
    : [];

  const searchedReels = searchActive
    ? allReels.filter((r) => {
        const q = searchQuery;
        return (
          (r.title || "").toLowerCase().includes(q) ||
          (r.user || "").toLowerCase().includes(q) ||
          (r.username || "").toLowerCase().includes(q) ||
          (r.description || "").toLowerCase().includes(q)
        );
      })
    : [];

  const handleLikeVideo = async (e, videoId) => {
    e.preventDefault();
    e.stopPropagation();
    const userId = localStorage.getItem("userId");
    if (!userId) {
      alert("Please login to like");
      return;
    }
    try {
      const { data: existing } = await supabase
        .from("likes")
        .select("id")
        .match({
          user_id: userId,
          content_id: String(videoId),
          content_type: "video",
        })
        .maybeSingle();
      if (existing) {
        await supabase
          .from("likes")
          .delete()
          .match({
            user_id: userId,
            content_id: String(videoId),
            content_type: "video",
          });
        await supabase.rpc("decrement_likes", {
          p_table: "videos",
          p_id: videoId,
        });
        setDbVideos((prev) =>
          prev.map((v) =>
            v.id === videoId
              ? { ...v, likes: Math.max(0, (v.likes || 0) - 1) }
              : v,
          ),
        );
      } else {
        await supabase.from("likes").insert({
          user_id: userId,
          content_id: String(videoId),
          content_type: "video",
        });
        await supabase.rpc("increment_likes", {
          p_table: "videos",
          p_id: videoId,
        });
        setDbVideos((prev) =>
          prev.map((v) =>
            v.id === videoId ? { ...v, likes: (v.likes || 0) + 1 } : v,
          ),
        );
      }
    } catch (_) {}
  };

  const handleDeleteVideo = async (e, videoId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Delete this video? This cannot be undone.")) return;
    const { error } = await supabase.from("videos").delete().eq("id", videoId);
    if (!error) setDbVideos((prev) => prev.filter((v) => v.id !== videoId));
    else alert("Failed to delete video.");
  };

  const handleDeleteReel = async (e, dbId) => {
    e.stopPropagation();
    if (!window.confirm("Delete this reel? This cannot be undone.")) return;
    const { error } = await supabase.from("reels").delete().eq("id", dbId);
    if (!error) setDbReels((prev) => prev.filter((r) => r.dbId !== dbId));
    else alert("Failed to delete reel.");
  };

  const handleToggleWatchLater = async (e, videoId) => {
    e.preventDefault();
    e.stopPropagation();
    const username = localStorage.getItem("username");
    if (!username) {
      alert("Please login to save videos");
      return;
    }
    const idStr = String(videoId);
    if (watchLaterIds.has(idStr)) {
      await supabase
        .from("watch_later")
        .delete()
        .eq("username", username)
        .eq("video_id", videoId);
      setWatchLaterIds((prev) => {
        const next = new Set(prev);
        next.delete(idStr);
        return next;
      });
    } else {
      await supabase
        .from("watch_later")
        .insert({ username, video_id: videoId });
      setWatchLaterIds((prev) => new Set(prev).add(idStr));
    }
  };

  // Shared prop bags so VideoCard / ShortsRow / ShortCard / SearchResultsPanel
  // (all module-level components now) get identical, up-to-date props at
  // every call site without repeating the same seven-prop list six times.
  const videoCardProps = {
    viewCounts,
    watchLaterIds,
    loggedInUsername,
    handleToggleWatchLater,
    handleDeleteVideo,
    handleLikeVideo,
    watchedContentIds,
    incrementView,
  };
  const shortCardProps = {
    incrementView,
    viewCounts,
    handleDeleteReel,
    navigate,
    watchedContentIds,
  };

  const movieTags = [
    "Hindi Movies",
    "Hollywood Movies",
    "Dubbed Hollywood Movies",
    "Pakistani Movies",
    "Bhojpuri Cinema",
    "Film Criticisms",
    "Superhero Movies",
    "Indian Movies",
  ];
  const movieVideos = allVideos.filter((v) =>
    v.tags?.some((t) => movieTags.includes(t)),
  );
  const liveVideos = allVideos.filter((v) => v.tags?.includes("Live"));

  const renderMobileTabContent = () => {
    switch (mobileTab) {
      case "shorts":
        return (
          <div className="mobile-tab-content" {...swipeHandlers}>
            {allReels.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 0",
                  color: "#8b84c4",
                }}
              >
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>📱</div>
                <p style={{ margin: 0, fontWeight: "600" }}>No shorts yet</p>
              </div>
            ) : (
              <>
                <div className="mobile-tab-section-head">
                  All Shorts ({allReels.length})
                </div>
                <div className="homePage_shortsRow">
                  {allReels.map((short) => (
                    <ShortCard key={short.id} short={short} {...shortCardProps} />
                  ))}
                </div>
              </>
            )}
          </div>
        );
      case "videos":
        return (
          <div className="mobile-tab-content" {...swipeHandlers}>
            <div className="mobile-tab-section-head">
              Uploaded Videos ({dbVideos.length})
            </div>
            <div className="youtube_VideoGrid">
              {dbLoading &&
                [...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
              {dbVideos.map((v) => (
                <VideoCard key={v.id} video={v} isUploaded={true} {...videoCardProps} />
              ))}
            </div>
            {!dbLoading && dbVideos.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 0",
                  color: "#8b84c4",
                }}
              >
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>🎬</div>
                <p style={{ margin: 0, fontWeight: "600" }}>
                  No videos uploaded yet
                </p>
              </div>
            )}
          </div>
        );
      case "movies":
        return (
          <div className="mobile-tab-content" {...swipeHandlers}>
            <div className="mobile-tab-section-head">
              Movies ({movieVideos.length})
            </div>
            {movieVideos.length > 0 ? (
              <div className="youtube_VideoGrid">
                {movieVideos.map((v) => (
                  <VideoCard key={v.id} video={v} isUploaded={true} {...videoCardProps} />
                ))}
              </div>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 0",
                  color: "#8b84c4",
                }}
              >
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>🎥</div>
                <p style={{ margin: 0, fontWeight: "600" }}>
                  No movies uploaded yet
                </p>
              </div>
            )}
          </div>
        );
      case "live":
        // This tab renders the real LiveKit LiveBrowser (reads is_live
        // rows from the Supabase "live_streams" table) instead of an old
        // "videos tagged Live" filter that had nothing to do with actual
        // live streaming.
        return (
          <div className="mobile-tab-content" {...swipeHandlers}>
            <LiveBrowser currentUser={loggedInUsername} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="homePage">
      <div className={"homePage_options" + (sideNavbar ? " sidebar-open" : "")}>
        <div
          className="homePage_options_track"
          ref={optionsTrackRef}
          onMouseEnter={() => {
            isPausedRef.current = true;
          }}
          onMouseLeave={() => {
            isPausedRef.current = false;
          }}
          onTouchStart={() => {
            isPausedRef.current = true;
          }}
          onTouchEnd={() => {
            setTimeout(() => {
              isPausedRef.current = false;
            }, 1500);
          }}
          onMouseDown={(e) => {
            isPausedRef.current = true;
            const startX = e.pageX - optionsTrackRef.current.offsetLeft;
            const startScroll = optionsTrackRef.current.scrollLeft;
            const onMove = (ev) => {
              const x = ev.pageX - optionsTrackRef.current.offsetLeft;
              optionsTrackRef.current.scrollLeft = startScroll - (x - startX);
            };
            const onUp = () => {
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
              setTimeout(() => {
                isPausedRef.current = false;
              }, 1500);
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          }}
          style={{ cursor: "grab", userSelect: "none" }}
        >
          {/* Dedicated Live pill — separate from the filterable options
              list. Scrolls to the desktop LiveBrowser section, or
              switches to the mobile Live tab, instead of filtering videos
              tagged "Live". */}
          <div
            className="homePage_option"
            onClick={() => {
              if (isMobile) {
                setMobileTab("live");
              } else {
                liveBrowserRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }
            }}
            style={{
              cursor: "pointer",
              color: "#ef4444",
              padding: "6px 14px",
              fontWeight: "800",
              whiteSpace: "nowrap",
              userSelect: "none",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            🔴 Live
          </div>

          {/* Category pills use a plain "active" className instead of a
              large inline style block recomputed every render — the CSS
              rule .homePage_option.active carries the same accent so the
              highlighted pill still reads clearly, but the DOM stays
              lighter. */}
          {options.map((item) => (
            <div
              key={item}
              className={
                "homePage_option" + (selectedOption === item ? " active" : "")
              }
              onClick={() => setSelectedOption(item)}
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <div
        className={
          "home_mainPage" + (sideNavbar ? " sidebar-open" : " sidebar-closed")
        }
      >
        {searchActive && (
          <SearchResultsPanel
            searchQuery={searchQuery}
            searchedReels={searchedReels}
            searchedLocalVideos={searchedLocalVideos}
            ytLoading={ytLoading}
            ytVideos={ytVideos}
            shortCardProps={shortCardProps}
            videoCardProps={videoCardProps}
            openWatchPage={openWatchPage}
          />
        )}

        {!searchActive && (
          <DramaticTrendingCarousel
            dbVideos={allVideos}
            dbReels={allReels}
            onVideoClick={(v, trendingList) => {
              incrementView(String(v.id), "video");
              const trendingVideoIds = trendingList
                .filter((t) => t._type !== "reel")
                .map((t) => String(t.id));
              navigate(`/video/${v.id}`, {
                state: { trendingIds: trendingVideoIds, fromTrending: true },
              });
            }}
            onReelClick={(r, trendingList) => {
              const trendingReelIds = trendingList
                .filter((t) => t._type === "reel")
                .map((t) => String(t.id));
              navigate("/reels/" + r.id, {
                state: {
                  clickedReel: r,
                  trendingIds: trendingReelIds,
                  fromTrending: true,
                },
              });
            }}
          />
        )}

        {/* Desktop-visible Live section — shows real LiveKit streams from
            the "live_streams" table. Sits above the mobile tab bar /
            category grid, hidden automatically on mobile since it's
            inside the desktop-only render path (mobile CSS hides
            everything except .mobile-trending-strip / .mobile-tab-bar /
            .mobile-tab-content / .search-results-panel — so on mobile this
            block simply won't render; the "live" mobile tab above handles
            phones instead). The ref lets the dedicated Live pill above
            smooth-scroll straight here on desktop. */}
        {!searchActive && !isMobile && (
          <div ref={liveBrowserRef} style={{ marginBottom: "28px" }}>
            <LiveBrowser currentUser={loggedInUsername} />
          </div>
        )}

        {!searchActive && (
          <div className="mobile-tab-bar">
            {MOBILE_TABS.map((tab) => (
              <button
                key={tab.id}
                className={
                  "mobile-tab-btn" + (mobileTab === tab.id ? " active" : "")
                }
                onClick={() => setMobileTab(tab.id)}
              >
                <span className="mobile-tab-icon">{tab.icon}</span>
                <span className="mobile-tab-label">{tab.label}</span>
              </button>
            ))}
          </div>
        )}

        {!searchActive && renderMobileTabContent()}

        {!searchActive &&
          (selectedOption === "All" ? (
            <>
              {(() => {
                const allVids = dbVideos.map((v) => ({
                  ...v,
                  isUploaded: true,
                }));
                const rows = [];
                const totalRows = Math.ceil(allVids.length / 12);
                if (totalRows === 0) {
                  return (
                    <div
                      style={{
                        textAlign: "center",
                        marginTop: "60px",
                        color: "#8b84c4",
                      }}
                    >
                      <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                        📭
                      </div>
                      <p style={{ fontSize: "16px", fontWeight: "600" }}>
                        No videos uploaded yet
                      </p>
                      <p style={{ fontSize: "13px", marginTop: "8px" }}>
                        Upload your first video to see it here
                      </p>
                    </div>
                  );
                }
                for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
                  const rowReels = allReels.slice(
                    rowIndex * 9,
                    rowIndex * 9 + 9,
                  );
                  rows.push(
                    <React.Fragment key={rowIndex}>
                      {rowReels.length > 0 && (
                        <ShortsRow
                          data={rowReels}
                          title={rowIndex === 0 ? "Shorts" : "More Shorts"}
                          {...shortCardProps}
                        />
                      )}
                      <div className="youtube_VideoGrid">
                        {rowIndex === 0 &&
                          dbLoading &&
                          [...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
                        {allVids
                          .slice(rowIndex * 12, rowIndex * 12 + 12)
                          .map((v) => (
                            <VideoCard
                              key={v.id}
                              video={v}
                              isUploaded={v.isUploaded || false}
                              {...videoCardProps}
                            />
                          ))}
                      </div>
                    </React.Fragment>,
                  );
                }
                return rows;
              })()}
            </>
          ) : (
            <div style={{ padding: "16px 0" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "20px",
                }}
              >
                <span style={{ fontSize: "22px" }}>
                  {ytLoading ? "⏳" : "🔎"}
                </span>
                <h2
                  style={{
                    color: "#1e1b4b",
                    fontSize: "18px",
                    fontWeight: "800",
                    margin: 0,
                    fontFamily: "Nunito, sans-serif",
                  }}
                >
                  {selectedOption}
                </h2>
                {ytLoading && (
                  <span
                    style={{
                      color: "#8b84c4",
                      fontSize: "13px",
                      fontWeight: "600",
                    }}
                  >
                    — loading YouTube results...
                  </span>
                )}
              </div>
              {dbVideos.filter((v) => v.tags?.includes(selectedOption)).length >
                0 && (
                <div style={{ marginBottom: "40px" }}>
                  <SectionLabel
                    color="#f97316"
                    bg="#fff7ed"
                    text="⬆ UPLOADED VIDEOS"
                    count={
                      dbVideos.filter((v) => v.tags?.includes(selectedOption))
                        .length
                    }
                  />
                  <div className="youtube_VideoGrid">
                    {dbVideos
                      .filter((v) => v.tags?.includes(selectedOption))
                      .map((v) => (
                        <VideoCard key={v.id} video={v} isUploaded={true} {...videoCardProps} />
                      ))}
                  </div>
                </div>
              )}
              {ytLoading && (
                <div style={{ marginBottom: "40px" }}>
                  <SectionLabel color="#ef4444" bg="#fff1f2" text="▶ YOUTUBE" />
                  <div className="youtube_VideoGrid">
                    {[...Array(8)].map((_, i) => (
                      <SkeletonCard key={i} />
                    ))}
                  </div>
                </div>
              )}
              {!ytLoading && ytVideos.length > 0 && (
                <div>
                  <SectionLabel
                    color="#ef4444"
                    bg="#fff1f2"
                    text="▶ YOUTUBE"
                    count={ytVideos.length}
                  />
                  <div className="youtube_VideoGrid">
                    {ytVideos.map((item) => (
                      <YouTubeVideoCard
                        key={item.id.videoId}
                        item={item}
                        onSelect={openWatchPage}
                      />
                    ))}
                  </div>
                </div>
              )}
              {!ytLoading &&
                filteredVideos.length === 0 &&
                ytVideos.length === 0 && (
                  <div style={{ textAlign: "center", marginTop: "80px" }}>
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                      📭
                    </div>
                    <p
                      style={{
                        color: "#8b84c4",
                        fontSize: "16px",
                        fontWeight: "600",
                      }}
                    >
                      No videos found for "
                      <span style={{ color: "#7c3aed" }}>{selectedOption}</span>
                      "
                    </p>
                    <p
                      style={{
                        color: "#c4bfdf",
                        fontSize: "13px",
                        marginTop: "8px",
                      }}
                    >
                      Try selecting a different category
                    </p>
                  </div>
                )}
            </div>
          ))}
      </div>

      {watchVideo && (
        <WatchPage
          initialVideoId={watchVideo.videoId}
          initialTitle={watchVideo.title}
          initialChannel={watchVideo.channel}
          onClose={closeWatchPage}
          suggestions={getSuggestions()}
          onIncrementView={incrementView}
        />
      )}
    </div>
  );
};

export default HomePage;