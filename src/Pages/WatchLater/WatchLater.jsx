import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { Link } from "react-router-dom";
import WatchLaterIcon from "@mui/icons-material/WatchLater";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import "../../styles/libraryPages.css";

const WatchLater = ({ currentUser, sideNavbar }) => {
  const username              = currentUser || "";
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!username) { setLoading(false); setItems([]); return; }
    loadItems();
  }, [username]);

  const loadItems = async () => {
    setLoading(true);
    setError("");

    // ── Step 1: fetch watch_later rows ──────────────────────────────────
    const { data: wlRows, error: wlErr } = await supabase
      .from("watch_later")
      .select("id, added_at, video_id")
      .eq("username", username)
      .order("added_at", { ascending: false });

    if (wlErr) { setError(`Watch Later fetch error: ${wlErr.message}`); setLoading(false); return; }
    if (!wlRows || wlRows.length === 0) { setItems([]); setLoading(false); return; }

    // ── Step 2: fetch matching videos ───────────────────────────────────
    const videoIds = wlRows.map((r) => r.video_id);
    const { data: videoRows, error: vidErr } = await supabase
      .from("videos")
      .select("id, title, thumbnail_url, likes, username")
      .in("id", videoIds);

    if (vidErr) { setError(`Videos fetch error: ${vidErr.message}`); setLoading(false); return; }

    // ── Step 3: merge ───────────────────────────────────────────────────
    const videoMap = {};
    (videoRows || []).forEach((v) => { videoMap[v.id] = v; });

    setItems(
      wlRows
        .filter((r) => videoMap[r.video_id])
        .map((r) => ({ ...r, video: videoMap[r.video_id] }))
    );
    setLoading(false);
  };

  const removeItem = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    await supabase.from("watch_later").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className={`lib-page ${sideNavbar ? "" : "sidebar-collapsed"}`}>
      <div className="lib-header">
        <WatchLaterIcon className="lib-header-icon" />
        <div>
          <h1 className="lib-title">Watch Later</h1>
          <p className="lib-subtitle">{items.length} saved</p>
        </div>
      </div>

      {!username && <div className="lib-empty"><p>Sign in to save videos for later.</p></div>}
      {error      && <div className="lib-empty" style={{ color: "#ef4444" }}><p>{error}</p></div>}
      {username && loading && <div className="lib-loading"><div className="lib-spinner" /></div>}
      {username && !loading && !error && items.length === 0 && (
        <div className="lib-empty">
          <WatchLaterIcon style={{ fontSize: 48, opacity: 0.3 }} />
          <p>Save videos to watch them later.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="lib-list">
          {items.map((item) => (
            <Link to={`/video/${item.video.id}`} key={item.id} className="lib-list-item">
              <div className="lib-list-thumb-wrap">
                <img
                  src={item.video.thumbnail_url || "https://via.placeholder.com/160x90?text=No+Thumbnail"}
                  alt={item.video.title}
                  className="lib-list-thumb"
                />
              </div>
              <div className="lib-list-info">
                <p className="lib-card-title">{item.video.title}</p>
                <p className="lib-card-meta">{item.video.username}</p>
              </div>
              <button className="lib-remove-btn" onClick={(e) => removeItem(item.id, e)} title="Remove">
                <DeleteOutlineIcon />
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default WatchLater;