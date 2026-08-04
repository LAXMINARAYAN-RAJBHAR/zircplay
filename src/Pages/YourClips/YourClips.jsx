import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import "../../styles/libraryPages.css";

const YourClips = ({ currentUser, sideNavbar }) => {
  const [clips, setClips]           = useState([]);
  const [likeCounts, setLikeCounts] = useState({});
  const [loading, setLoading]       = useState(true);
  const [playing, setPlaying]       = useState(null);
  const username = currentUser || "";

  useEffect(() => {
    if (!username) { setLoading(false); setClips([]); return; }
    loadClips();
  }, [username]);

  const loadClips = async () => {
    setLoading(true);

    // 1) Fetch the user's clips
    const { data, error } = await supabase
      .from("clips")
      .select("*")
      .eq("username", username)
      .order("created_at", { ascending: false });

    if (error || !data) {
      setClips([]);
      setLoading(false);
      return;
    }

    setClips(data);

    // 2) Fetch live like counts from the `likes` table instead of trusting
    // any stale count column on `clips` (same fix as YourVideos/LikedVideos)
    if (data.length > 0) {
      const ids = data.map((c) => String(c.id));
      const { data: likeRows, error: likeErr } = await supabase
        .from("likes")
        .select("content_id")
        .eq("content_type", "clip")
        .eq("reaction_type", "like")
        .in("content_id", ids);

      if (!likeErr && likeRows) {
        const counts = {};
        ids.forEach((id) => {
          counts[id] = likeRows.filter((l) => l.content_id === id).length;
        });
        setLikeCounts(counts);
      }
    } else {
      setLikeCounts({});
    }

    setLoading(false);
  };

  const deleteClip = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this clip?")) return;
    await supabase.from("clips").delete().eq("id", id);
    setClips((prev) => prev.filter((c) => c.id !== id));
    if (playing?.id === id) setPlaying(null);
  };

  const formatDuration = (start, end) => {
    const secs = Math.round(end - start);
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className={`lib-page ${sideNavbar ? "" : "sidebar-collapsed"}`}>
      <div className="lib-header">
        <ContentCutIcon className="lib-header-icon" />
        <div>
          <h1 className="lib-title">Your Clips</h1>
          <p className="lib-subtitle">{clips.length} clip{clips.length !== 1 ? "s" : ""}</p>
        </div>
      </div>
      {!username && <div className="lib-empty"><p>Sign in to see your clips.</p></div>}
      {username && loading && <div className="lib-loading"><div className="lib-spinner" /></div>}
      {username && !loading && clips.length === 0 && (
        <div className="lib-empty">
          <ContentCutIcon style={{ fontSize: 48, opacity: 0.3 }} />
          <p>You haven't created any clips yet.</p>
        </div>
      )}
      {!loading && clips.length > 0 && (
        <div className="lib-grid">
          {clips.map((clip) => (
            <div key={clip.id} className="lib-card lib-card-clickable" onClick={() => setPlaying(clip)}>
              <div className="lib-thumb-wrap lib-clip-thumb">
                {clip.thumbnail_url ? (
                  <img src={clip.thumbnail_url} alt={clip.title} className="lib-thumb" />
                ) : (
                  <div className="lib-clip-placeholder"><ContentCutIcon style={{ fontSize: 32, color: "var(--zx-primary)" }} /></div>
                )}
                <div className="lib-play-overlay"><PlayArrowIcon style={{ color: "#fff", fontSize: 36 }} /></div>
                {clip.start_time != null && clip.end_time != null && (
                  <span className="lib-duration-badge">{formatDuration(clip.start_time, clip.end_time)}</span>
                )}
              </div>
              <div className="lib-card-info">
                <p className="lib-card-title">{clip.title}</p>
                <p className="lib-card-meta">
                  {formatDate(clip.created_at)} · 👍 {likeCounts[String(clip.id)] ?? 0}
                </p>
              </div>
              <button className="lib-remove-btn lib-clip-delete" onClick={(e) => deleteClip(clip.id, e)}><DeleteOutlineIcon /></button>
            </div>
          ))}
        </div>
      )}
      {playing && (
        <div className="lib-modal-backdrop" onClick={() => setPlaying(null)}>
          <div className="lib-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lib-modal-header">
              <p className="lib-card-title">{playing.title}</p>
              <button className="lib-remove-btn" onClick={() => setPlaying(null)}><CloseIcon /></button>
            </div>
            {playing.description && <p className="lib-card-meta" style={{ padding: "0 16px 8px" }}>{playing.description}</p>}
            <video src={`${playing.video_url}#t=${playing.start_time ?? 0},${playing.end_time ?? ""}`} controls autoPlay className="lib-modal-video" />
          </div>
        </div>
      )}
    </div>
  );
};

export default YourClips;