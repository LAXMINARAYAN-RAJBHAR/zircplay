import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { Link, useNavigate } from "react-router-dom";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import "../../styles/libraryPages.css";

const LikedVideos = ({ currentUser, sideNavbar }) => {
  const username = currentUser || "";
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("videos");
  const [videos, setVideos]       = useState([]);
  const [reels, setReels]         = useState([]);
  const [videoLikeCounts, setVideoLikeCounts] = useState({});
  const [reelLikeCounts, setReelLikeCounts]   = useState({});
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  useEffect(() => {
    const userId = localStorage.getItem("userId") || "";
    if (!username || !userId) { setLoading(false); setVideos([]); setReels([]); return; }
    loadLiked(userId);
  }, [username]);

  const loadLiked = async (userId) => {
    setLoading(true);
    setError("");

    // ── Step 1: fetch like rows for this user (videos + reels) ──
    const { data: likeRows, error: likeErr } = await supabase
      .from("likes")
      .select("content_id, content_type")
      .eq("user_id", userId)
      .eq("reaction_type", "like")
      .in("content_type", ["video", "reel"]);

    if (likeErr) { setError(`Likes fetch error: ${likeErr.message}`); setLoading(false); return; }
    if (!likeRows || likeRows.length === 0) { setVideos([]); setReels([]); setLoading(false); return; }

    const videoIds = likeRows.filter((r) => r.content_type === "video").map((r) => r.content_id);
    const reelIds  = likeRows
      .filter((r) => r.content_type === "reel")
      .map((r) => r.content_id.replace("db_", "")); // reels stored as "db_<id>" content_id

    // ── Step 2: fetch matching videos ──
    if (videoIds.length > 0) {
      const { data, error: vidErr } = await supabase
        .from("videos")
        .select("id, title, thumbnail_url, username, created_at")
        .in("id", videoIds)
        .order("created_at", { ascending: false });

      if (vidErr) {
        setError((prev) => prev || `Videos fetch error: ${vidErr.message}`);
      } else if (data) {
        setVideos(data);

        // ── Real like counts come from the `likes` table, NOT the stale
        // `videos.likes` column (which is never incremented anywhere) ──
        const ids = data.map((v) => String(v.id));
        const { data: likeCountRows, error: countErr } = await supabase
          .from("likes")
          .select("content_id")
          .eq("content_type", "video")
          .eq("reaction_type", "like")
          .in("content_id", ids);

        if (!countErr && likeCountRows) {
          const counts = {};
          ids.forEach((vid) => {
            counts[vid] = likeCountRows.filter((l) => l.content_id === vid).length;
          });
          setVideoLikeCounts(counts);
        }
      }
    } else {
      setVideos([]);
      setVideoLikeCounts({});
    }

    // ── Step 3: fetch matching reels ──
    if (reelIds.length > 0) {
      const { data, error: reelErr } = await supabase
        .from("reels")
        .select("id, title, thumbnail, description, user, username, video_url, created_at")
        .in("id", reelIds)
        .order("created_at", { ascending: false });

      if (reelErr) {
        setError((prev) => prev || `Reels fetch error: ${reelErr.message}`);
      } else if (data) {
        setReels(data);

        // ── Real like counts for reels, same approach ──
        const ids = data.map((r) => `db_${r.id}`);
        const { data: likeCountRows, error: countErr } = await supabase
          .from("likes")
          .select("content_id")
          .eq("content_type", "reel")
          .eq("reaction_type", "like")
          .in("content_id", ids);

        if (!countErr && likeCountRows) {
          const counts = {};
          ids.forEach((rid) => {
            counts[rid] = likeCountRows.filter((l) => l.content_id === rid).length;
          });
          setReelLikeCounts(counts);
        }
      }
    } else {
      setReels([]);
      setReelLikeCounts({});
    }

    setLoading(false);
  };

  const totalCount = videos.length + reels.length;

  const tabStyle = (tab) => ({
    padding: "8px 18px", background: "none", border: "none",
    borderBottom: activeTab === tab ? "2px solid #ff0000" : "2px solid transparent",
    color: activeTab === tab ? "white" : "#aaa",
    fontWeight: activeTab === tab ? "700" : "400",
    fontSize: "14px", cursor: "pointer",
  });

  return (
    <div className={`lib-page ${sideNavbar ? "" : "sidebar-collapsed"}`}>
      <div className="lib-header">
        <ThumbUpIcon className="lib-header-icon" />
        <div>
          <h1 className="lib-title">Liked Videos</h1>
          <p className="lib-subtitle">{totalCount} item{totalCount !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {!username && <div className="lib-empty"><p>Sign in to see content you've liked.</p></div>}
      {error      && <div className="lib-empty" style={{ color: "#ef4444" }}><p>{error}</p></div>}
      {username && loading && <div className="lib-loading"><div className="lib-spinner" /></div>}

      {username && !loading && !error && (
        <>
          <div style={{ display: "flex", borderBottom: "1px solid #2a2a2a", marginBottom: "16px" }}>
            <button style={tabStyle("videos")} onClick={() => setActiveTab("videos")}>🎬 Videos ({videos.length})</button>
            <button style={tabStyle("reels")} onClick={() => setActiveTab("reels")}>📱 Reels ({reels.length})</button>
          </div>

          {activeTab === "videos" && (
            videos.length === 0 ? (
              <div className="lib-empty">
                <ThumbUpIcon style={{ fontSize: 48, opacity: 0.3 }} />
                <p>Videos you like will appear here.</p>
              </div>
            ) : (
              <div className="lib-grid">
                {videos.map((v) => (
                  <Link to={`/video/${v.id}`} key={v.id} className="lib-card">
                    <div className="lib-thumb-wrap">
                      <img
                        src={v.thumbnail_url || "https://via.placeholder.com/320x180?text=No+Thumbnail"}
                        alt={v.title}
                        className="lib-thumb"
                      />
                    </div>
                    <div className="lib-card-info">
                      <p className="lib-card-title">{v.title}</p>
                      <p className="lib-card-meta">
                        {v.username} · 👍 {videoLikeCounts[String(v.id)] ?? 0}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}

          {activeTab === "reels" && (
            reels.length === 0 ? (
              <div className="lib-empty">
                <ThumbUpIcon style={{ fontSize: 48, opacity: 0.3 }} />
                <p>Reels you like will appear here.</p>
              </div>
            ) : (
              <div className="lib-grid">
                {reels.map((r) => (
                  <div
                    key={r.id}
                    className="lib-card"
                    style={{ cursor: "pointer" }}
                    onClick={() =>
                      navigate("/reels", {
                        state: {
                          clickedReel: {
                            id: `db_${r.id}`,
                            src: r.video_url,
                            thumbnail: r.thumbnail,
                            title: r.title,
                            description: r.description,
                            user: r.user,
                            username: r.username,
                            profilePic: `https://api.dicebear.com/7.x/initials/svg?seed=${r.username}`,
                            likes: 0,
                          },
                        },
                      })
                    }
                  >
                    <div className="lib-thumb-wrap">
                      <img src={r.thumbnail} alt={r.title} className="lib-thumb" />
                    </div>
                    <div className="lib-card-info">
                      <p className="lib-card-title">{r.title}</p>
                      <p className="lib-card-meta">
                        {r.username} · 👍 {reelLikeCounts[`db_${r.id}`] ?? 0}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
};

export default LikedVideos;