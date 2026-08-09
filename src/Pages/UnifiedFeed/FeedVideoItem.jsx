import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ReplyIcon from "@mui/icons-material/Reply";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";

// One video slide in the unified TikTok-style feed. `isActive` drives
// play/pause; `shouldMount` (active ± 1 neighbor) drives whether a real
// <video> element exists at all — everything further away just shows a
// static poster image, which is what keeps this feed from trying to
// decode a dozen videos at once and crashing mobile browsers.
const FeedVideoItem = ({ video, isActive, shouldMount, currentUser }) => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [muted, setMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let active = true;
    const loadCounts = async () => {
      const { count: lCount } = await supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .match({ content_id: String(video.id), content_type: "video" });

      const { count: cCount } = await supabase
        .from("comments")
        .select("*", { count: "exact", head: true })
        .match({ content_id: String(video.id), content_type: "video" });

      if (!active) return;
      setLikeCount(lCount || 0);
      setCommentCount(cCount || 0);

      const userId = localStorage.getItem("userId");
      if (userId) {
        const { data } = await supabase
          .from("likes")
          .select("id")
          .match({ user_id: userId, content_id: String(video.id), content_type: "video" })
          .maybeSingle();
        if (active) setLiked(!!data);
      }
    };
    loadCounts();
    return () => { active = false; };
  }, [video.id]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isActive) {
      el.muted = muted;
      el.play().catch(() => {});
      setIsPlaying(true);
      // Track a view once this slide becomes active
      const userId = localStorage.getItem("userId");
      if (userId) {
        supabase
          .from("views")
          .upsert(
            { user_id: userId, content_id: String(video.id), content_type: "video", viewed_at: new Date().toISOString() },
            { onConflict: "user_id,content_id,content_type" },
          )
          .then(() => {})
          .catch(() => {});
      }
    } else {
      el.pause();
      setIsPlaying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const toggleLike = async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) { window.dispatchEvent(new CustomEvent("openLogin")); return; }
    if (liked) {
      await supabase.from("likes").delete().match({ user_id: userId, content_id: String(video.id), content_type: "video" });
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from("likes").insert({ user_id: userId, content_id: String(video.id), content_type: "video" });
      setLiked(true);
      setLikeCount((c) => c + 1);
    }
  };

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) { el.play().catch(() => {}); setIsPlaying(true); }
    else { el.pause(); setIsPlaying(false); }
  };

  const handleShare = () => {
    const shareId = video.short_id || video.id;
    const url = `https://zixplon.in/api/og?type=video&id=${shareId}`;
    navigator.clipboard?.writeText(url).catch(() => {});
  };

  return (
    <div className="uf-media-wrap" onClick={togglePlay}>
      {shouldMount ? (
        <video
          ref={videoRef}
          src={video.video_url}
          poster={video.thumbnail_url}
          loop
          playsInline
          className="uf-video"
          onContextMenu={(e) => e.preventDefault()}
        />
      ) : (
        <img src={video.thumbnail_url} alt={video.title} className="uf-poster" />
      )}

      {!isPlaying && shouldMount && <div className="uf-play-icon">▶</div>}

      <button
        className="uf-mute-btn"
        onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeOffIcon /> : <VolumeUpIcon />}
      </button>

      <div className="uf-actions">
        <button className="uf-action-btn" onClick={(e) => { e.stopPropagation(); toggleLike(); }}>
          <ThumbUpOutlinedIcon style={{ color: liked ? "#ff0000" : "#fff" }} />
          <span>{likeCount}</span>
        </button>
        <button className="uf-action-btn" onClick={(e) => { e.stopPropagation(); navigate(`/video/${video.id}`); }}>
          <ChatBubbleOutlineIcon style={{ color: "#fff" }} />
          <span>{commentCount}</span>
        </button>
        <button className="uf-action-btn" onClick={(e) => { e.stopPropagation(); handleShare(); }}>
          <ReplyIcon style={{ color: "#fff", transform: "scaleX(-1)" }} />
          <span>Share</span>
        </button>
      </div>

      <div className="uf-info">
        <p className="uf-badge">🎬 Video</p>
        <p className="uf-title">{video.title}</p>
        <p className="uf-channel">@{video.username || video.channel}</p>
      </div>
    </div>
  );
};

export default FeedVideoItem;