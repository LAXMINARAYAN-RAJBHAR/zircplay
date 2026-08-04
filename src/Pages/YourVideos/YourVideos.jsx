import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { Link } from "react-router-dom";
import SmartDisplayIcon from "@mui/icons-material/SmartDisplay";
import "../../styles/libraryPages.css";

const YourVideos = ({ currentUser, sideNavbar }) => {
  const username              = currentUser || "";
  const [videos, setVideos]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!username) { setLoading(false); setVideos([]); return; }

    const loadVideos = async () => {
      setLoading(true);
      setError("");

      // 1) Fetch the user's videos (no more relying on a stale `likes` column)
      const { data: videoRows, error: videosErr } = await supabase
        .from("videos")
        .select("id, title, thumbnail_url, created_at")
        .eq("username", username)
        .order("created_at", { ascending: false });

      if (videosErr) {
        setError(`Videos fetch error: ${videosErr.message}`);
        setLoading(false);
        return;
      }

      if (!videoRows || videoRows.length === 0) {
        setVideos([]);
        setLoading(false);
        return;
      }

      const videoIds = videoRows.map((v) => v.id);

      // 2) Fetch live likes for those video ids and compute counts manually
      const { data: likeRows, error: likesErr } = await supabase
        .from("likes")
        .select("content_id")
        .eq("content_type", "video")
        .in("content_id", videoIds);

      if (likesErr) {
        // Don't fully block the page on a likes error — just show 0s and surface the issue
        setError(`Likes fetch error: ${likesErr.message}`);
        setVideos(videoRows.map((v) => ({ ...v, likeCount: 0 })));
        setLoading(false);
        return;
      }

      const likeCountMap = {};
      (likeRows || []).forEach((l) => {
        likeCountMap[l.content_id] = (likeCountMap[l.content_id] || 0) + 1;
      });

      const merged = videoRows.map((v) => ({
        ...v,
        likeCount: likeCountMap[v.id] || 0,
      }));

      setVideos(merged);
      setLoading(false);
    };

    loadVideos();
  }, [username]);

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className={`lib-page ${sideNavbar ? "" : "sidebar-collapsed"}`}>
      <div className="lib-header">
        <SmartDisplayIcon className="lib-header-icon" />
        <div>
          <h1 className="lib-title">Your Videos</h1>
          <p className="lib-subtitle">{videos.length} upload{videos.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {!username && <div className="lib-empty"><p>Sign in to manage your videos.</p></div>}
      {error      && <div className="lib-empty" style={{ color: "#ef4444" }}><p>{error}</p></div>}
      {username && loading && <div className="lib-loading"><div className="lib-spinner" /></div>}
      {username && !loading && !error && videos.length === 0 && (
        <div className="lib-empty">
          <SmartDisplayIcon style={{ fontSize: 48, opacity: 0.3 }} />
          <p>You haven't uploaded any videos yet.</p>
          <Link to="/videoUpload" className="lib-cta-btn">Upload a video</Link>
        </div>
      )}

      {!loading && videos.length > 0 && (
        <div className="lib-list">
          {videos.map((v) => (
            <Link to={`/video/${v.id}`} key={v.id} className="lib-list-item">
              <div className="lib-list-thumb-wrap">
                <img
                  src={v.thumbnail_url || "https://via.placeholder.com/160x90?text=No+Thumbnail"}
                  alt={v.title}
                  className="lib-list-thumb"
                />
              </div>
              <div className="lib-list-info">
                <p className="lib-card-title">{v.title}</p>
                <p className="lib-card-meta">{formatDate(v.created_at)}</p>
                <p className="lib-card-meta">👍 {v.likeCount}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default YourVideos;