import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { Link } from "react-router-dom";
import HistoryIcon from "@mui/icons-material/History";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import "../../styles/libraryPages.css";

export const logHistory = async (username, videoId) => {
  if (!username || !videoId) return;
  // videoId is now a uuid string (post-migration) — do NOT wrap in Number(),
  // that would produce NaN and fail the insert against the uuid column.
  await supabase.from("history").insert({ username, video_id: videoId });
};

const History = ({ currentUser, sideNavbar }) => {
  const username = currentUser || "";
  const [groups, setGroups]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!username) { setLoading(false); setGroups([]); return; }
    loadHistory();
  }, [username]);

  const loadHistory = async () => {
    setLoading(true);
    setError("");

    // ── Step 1: fetch history rows ──────────────────────────────────────
    const { data: histRows, error: histErr } = await supabase
      .from("history")
      .select("id, watched_at, video_id")
      .eq("username", username)
      .order("watched_at", { ascending: false })
      .limit(200);

    if (histErr) { setError(`History fetch error: ${histErr.message}`); setLoading(false); return; }
    if (!histRows || histRows.length === 0) { setGroups([]); setLoading(false); return; }

    // ── Step 2: fetch matching videos ───────────────────────────────────
    const videoIds = [...new Set(histRows.map((h) => h.video_id))];
    const { data: videoRows, error: vidErr } = await supabase
      .from("videos")
      .select("id, title, thumbnail_url, username")
      .in("id", videoIds);

    if (vidErr) { setError(`Videos fetch error: ${vidErr.message}`); setLoading(false); return; }

    // ── Step 3: merge and group by date ─────────────────────────────────
    const videoMap = {};
    (videoRows || []).forEach((v) => { videoMap[v.id] = v; });

    const byDate = {};
    histRows.forEach((h) => {
      const vid = videoMap[h.video_id];
      if (!vid) return;
      const label = getDateLabel(h.watched_at);
      if (!byDate[label]) byDate[label] = [];
      byDate[label].push({ ...h, video: vid });
    });

    setGroups(Object.entries(byDate));
    setLoading(false);
  };

  const getDateLabel = (dateStr) => {
    const d         = new Date(dateStr);
    const today     = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString())     return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  };

  const clearHistory = async () => {
    if (!window.confirm("Clear all watch history?")) return;
    await supabase.from("history").delete().eq("username", username);
    setGroups([]);
  };

  const totalCount = groups.reduce((acc, [, items]) => acc + items.length, 0);

  return (
    <div className={`lib-page ${sideNavbar ? "" : "sidebar-collapsed"}`}>
      <div className="lib-header">
        <HistoryIcon className="lib-header-icon" />
        <div style={{ flex: 1 }}>
          <h1 className="lib-title">Watch History</h1>
          <p className="lib-subtitle">{totalCount} video{totalCount !== 1 ? "s" : ""} watched</p>
        </div>
        {totalCount > 0 && (
          <button className="lib-danger-btn" onClick={clearHistory}>
            <DeleteSweepIcon /> Clear all
          </button>
        )}
      </div>

      {!username && <div className="lib-empty"><p>Sign in to see your watch history.</p></div>}
      {error      && <div className="lib-empty" style={{ color: "#ef4444" }}><p>{error}</p></div>}
      {username && loading && <div className="lib-loading"><div className="lib-spinner" /></div>}
      {username && !loading && !error && groups.length === 0 && (
        <div className="lib-empty">
          <HistoryIcon style={{ fontSize: 48, opacity: 0.3 }} />
          <p>Videos you watch will appear here.</p>
        </div>
      )}

      {!loading && groups.map(([label, items]) => (
        <div key={label} className="lib-group">
          <p className="lib-group-label">{label}</p>
          <div className="lib-list">
            {items.map((h) => (
              <Link to={`/video/${h.video.id}`} key={h.id} className="lib-list-item">
                <div className="lib-list-thumb-wrap">
                  <img
                    src={h.video.thumbnail_url || "https://via.placeholder.com/160x90?text=No+Thumbnail"}
                    alt={h.video.title}
                    className="lib-list-thumb"
                  />
                </div>
                <div className="lib-list-info">
                  <p className="lib-card-title">{h.video.title}</p>
                  <p className="lib-card-meta">{h.video.username}</p>
                  <p className="lib-card-meta" style={{ fontSize: 11 }}>
                    {new Date(h.watched_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default History;