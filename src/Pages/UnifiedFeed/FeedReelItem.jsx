import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ReplyIcon from "@mui/icons-material/Reply";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";

// Reels keep their existing `content_id` convention from Reels.jsx:
// "db_" + the reel's uuid. Keeping this consistent means likes/views
// recorded here are the exact same rows your standalone /reels page
// already reads and writes — nothing gets fragmented into a second
// parallel dataset.
const FeedReelItem = ({ reel, isActive, shouldMount, currentUser }) => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [muted, setMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  const contentId = `db_${reel.id}`;

  useEffect(() => {
    let active = true;
    const loadCounts = async () => {
      const { count: lCount } = await supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .match({ content_id: contentId, content_type: "reel" });

      const { count: cCount } = await supabase
        .from("comments")
        .select("*", { count: "exact", head: true })
        .match({ content_id: contentId, content_type: "reel" });

      if (!active) return;
      setLikeCount(lCount || 0);
      setCommentCount(cCount || 0);

      const userId = localStorage.getItem("userId");
      if (userId) {
        const { data } = await supabase
          .from("likes")
          .select("id")
          .match({ user_id: userId, content_id: contentId, content_type: "reel" })
          .maybeSingle();
        if (active) setLiked(!!data);
      }
    };
    loadCounts();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reel.id]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isActive) {
      el.muted = muted;
      el.play().catch(() => {});
      setIsPlaying(true);
      const userId = localStorage.getItem("userId");
      if (userId) {
        supabase
          .from("views")
          .upsert(
            { user_id: userId, content_id: contentId, content_type: "reel", viewed_at: new Date().toISOString() },
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
      await supabase.from("likes").delete().match({ user_id: userId, content_id: contentId, content_type: "reel" });
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from("likes").insert({ user_id: userId, content_id: contentId, content_type: "reel" });
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
    const shareId = reel.short_id || reel.id;
    const url = `https://zixplon.in/api/og?type=reel&id=${shareId}`;
    navigator.clipboard?.writeText(url).catch(() => {});
  };

  return (
    <div className="uf-media-wrap" onClick={togglePlay}>
      {shouldMount ? (
        <video
          ref={videoRef}
          src={reel.video_url}
          poster={reel.thumbnail}
          loop
          playsInline
          className="uf-video"
          onContextMenu={(e) => e.preventDefault()}
        />
      ) : (
        <img src={reel.thumbnail} alt={reel.title} className="uf-poster" />
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
        <button className="uf-action-btn" onClick={(e) => { e.stopPropagation(); navigate(`/reels/${contentId}`); }}>
          <ChatBubbleOutlineIcon style={{ color: "#fff" }} />
          <span>{commentCount}</span>
        </button>
        <button className="uf-action-btn" onClick={(e) => { e.stopPropagation(); handleShare(); }}>
          <ReplyIcon style={{ color: "#fff", transform: "scaleX(-1)" }} />
          <span>Share</span>
        </button>
      </div>

      <div className="uf-info">
        <p className="uf-badge">📱 Reel</p>
        <p className="uf-title">{reel.title}</p>
        <p className="uf-channel">@{reel.username || reel.user}</p>
      </div>
    </div>
  );
};

export default FeedReelItem;