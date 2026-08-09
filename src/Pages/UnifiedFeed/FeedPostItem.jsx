import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ReplyIcon from "@mui/icons-material/Reply";

// Posts use a different data model than videos/reels (post_reactions /
// post_comments, not the shared likes/comments tables), so this stays
// self-contained rather than reusing FeedVideoItem/FeedReelItem's
// helpers — same interaction pattern as PostFeed.jsx's handleReaction,
// just triggered from a full-screen slide instead of a card in a list.
const FeedPostItem = ({ post: initialPost, currentUser }) => {
  const navigate = useNavigate();
  const [post, setPost] = useState(initialPost);

  const totalReactions = Object.values(post.reactionCounts || {}).reduce(
    (a, b) => a + b,
    0,
  );

  const toggleLike = async () => {
    if (!currentUser || currentUser === "anonymous") {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    const prevReaction = post.myReaction;
    const nextReaction = prevReaction ? null : "like";

    setPost((p) => {
      const counts = { ...p.reactionCounts };
      if (prevReaction) counts[prevReaction] = Math.max(0, (counts[prevReaction] || 1) - 1);
      if (nextReaction) counts[nextReaction] = (counts[nextReaction] || 0) + 1;
      return { ...p, myReaction: nextReaction, reactionCounts: counts };
    });

    if (prevReaction) {
      await supabase.from("post_reactions").delete().eq("post_id", post.id).eq("username", currentUser);
    }
    if (nextReaction) {
      await supabase.from("post_reactions").insert({ post_id: post.id, username: currentUser, type: nextReaction });
    }
  };

  const handleShare = () => {
    const url = `https://zixplon.in/api/og?type=post&id=${post.id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
  };

  const goToComments = () => {
    // Posts don't have a dedicated full-screen page like video/reel do —
    // the existing feed already handles comment threads well, so jump
    // there with the post pre-highlighted rather than rebuilding a
    // separate comment UI inside this slide.
    navigate(`/feed?post=${post.id}`);
  };

  const media = post.image_urls?.[0] || post.image_url || null;

  return (
    <div className="uf-media-wrap uf-post-wrap">
      {media ? (
        <img src={media} alt="" className="uf-post-image" />
      ) : post.video_url ? (
        <video src={post.video_url} className="uf-video" muted loop playsInline autoPlay />
      ) : (
        <div className="uf-post-text-bg">
          <p className="uf-post-text-only">{post.text}</p>
        </div>
      )}

      <div className="uf-actions">
        <button className="uf-action-btn" onClick={toggleLike}>
          <ThumbUpOutlinedIcon style={{ color: post.myReaction ? "#ff0000" : "#fff" }} />
          <span>{totalReactions}</span>
        </button>
        <button className="uf-action-btn" onClick={goToComments}>
          <ChatBubbleOutlineIcon style={{ color: "#fff" }} />
          <span>{post.comments?.length || 0}</span>
        </button>
        <button className="uf-action-btn" onClick={handleShare}>
          <ReplyIcon style={{ color: "#fff", transform: "scaleX(-1)" }} />
          <span>Share</span>
        </button>
      </div>

      <div className="uf-info">
        <p className="uf-badge">📝 Post</p>
        {media && post.text && <p className="uf-title">{post.text}</p>}
        <p className="uf-channel">@{post.username}</p>
      </div>
    </div>
  );
};

export default FeedPostItem;