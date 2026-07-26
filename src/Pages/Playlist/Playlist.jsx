import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { Link, useLocation } from "react-router-dom";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import PlaylistPlayIcon from "@mui/icons-material/PlaylistPlay";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";

// ─── design tokens (match homePage palette) ───────────────────────────────────
const C = {
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
  danger: "#ef4444",
};

const Playlist = ({ currentUser, sideNavbar }) => {
  // ── Always read from localStorage as the source of truth ──────────────────
  const username = currentUser || localStorage.getItem("username") || "";

  const location = useLocation();
  const [playlists, setPlaylists] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState("");

  // ── If navigated here from SaveMenuButton with a videoId, highlight it ────
  const pendingVideoId = location.state?.addVideoId ?? null;
  const [addedMap, setAddedMap] = useState({}); // playlistId → bool

  useEffect(() => {
    loadPlaylists();
  }, [username]);

  // ── If a videoId was passed, load which playlists already contain it ──────
  useEffect(() => {
    if (!pendingVideoId || !playlists.length) return;
    const ids = playlists.map((p) => p.id);
    supabase
      .from("playlist_items")
      .select("playlist_id")
      .eq("video_id", pendingVideoId)
      .in("playlist_id", ids)
      .then(({ data }) => {
        if (!data) return;
        const map = {};
        data.forEach((r) => {
          map[r.playlist_id] = true;
        });
        setAddedMap(map);
      });
  }, [pendingVideoId, playlists]);

  const loadPlaylists = async () => {
    setLoading(true);
    setError("");
    if (!username) {
      setLoading(false);
      setPlaylists([]);
      return;
    }
    const { data, error: err } = await supabase
      .from("playlists")
      .select("id, title, description, created_at")
      .eq("username", username)
      .order("created_at", { ascending: false });
    if (err) setError(`Could not load playlists: ${err.message}`);
    else setPlaylists(data || []);
    setLoading(false);
  };

  const openPlaylist = async (pl) => {
    const { data: itemRows, error: itemErr } = await supabase
      .from("playlist_items")
      .select("id, added_at, video_id")
      .eq("playlist_id", pl.id)
      .order("added_at", { ascending: false });

    if (itemErr || !itemRows || itemRows.length === 0) {
      setSelected({ playlist: pl, items: [] });
      return;
    }

    const videoIds = itemRows.map((r) => r.video_id);
    const { data: videoRows } = await supabase
      .from("videos")
      .select("id, title, thumbnail_url, username, channel")
      .in("id", videoIds);

    const videoMap = {};
    (videoRows || []).forEach((v) => {
      videoMap[v.id] = v;
    });

    const items = itemRows
      .filter((r) => videoMap[r.video_id])
      .map((r) => ({ ...r, video: videoMap[r.video_id] }));

    setSelected({ playlist: pl, items });
  };

  const createPlaylist = async () => {
    if (!newTitle.trim()) return;
    const { data, error: err } = await supabase
      .from("playlists")
      .insert({ username, title: newTitle.trim() })
      .select()
      .single();
    if (!err && data) {
      setPlaylists((prev) => [data, ...prev]);
      setNewTitle("");
      setCreating(false);
    }
  };

  const deletePlaylist = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this playlist? This cannot be undone.")) return;
    await supabase.from("playlists").delete().eq("id", id);
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    if (selected?.playlist?.id === id) setSelected(null);
  };

  const removeFromPlaylist = async (itemId) => {
    await supabase.from("playlist_items").delete().eq("id", itemId);
    setSelected((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.id !== itemId),
    }));
  };

  // ── Toggle video in/out of a playlist (used when pendingVideoId is set) ───
  const toggleVideoInPlaylist = async (e, playlistId) => {
    e.stopPropagation();
    if (!pendingVideoId) return;
    const inList = addedMap[playlistId];
    if (inList) {
      await supabase
        .from("playlist_items")
        .delete()
        .eq("playlist_id", playlistId)
        .eq("video_id", pendingVideoId);
      setAddedMap((prev) => {
        const n = { ...prev };
        delete n[playlistId];
        return n;
      });
    } else {
      await supabase
        .from("playlist_items")
        .insert({ playlist_id: playlistId, video_id: pendingVideoId });
      setAddedMap((prev) => ({ ...prev, [playlistId]: true }));
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // Shared layout shell
  // ════════════════════════════════════════════════════════════════════════════
  const isMobile = window.innerWidth <= 768;

  const Shell = ({ children }) => (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        fontFamily: "'Outfit', 'Nunito', sans-serif",
        paddingTop: "64px",
        paddingBottom: "80px",
        marginLeft: !isMobile && sideNavbar ? "275px" : 0,
        transition: "margin-left 0.3s",
        boxSizing: "border-box",
        width: "100%",
      }}
    >
      <div
        style={{
          maxWidth: "760px",
          margin: "0 auto",
          padding: "0 16px",
        }}
      >
        {children}
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // DETAIL VIEW — videos inside a playlist
  // ════════════════════════════════════════════════════════════════════════════
  if (selected) {
    return (
      <Shell>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <button
            onClick={() => setSelected(null)}
            style={{
              background: C.surface2,
              border: `1.5px solid ${C.border}`,
              color: C.primary,
              borderRadius: "20px",
              padding: "8px 16px",
              cursor: "pointer",
              fontWeight: "700",
              fontSize: "14px",
              fontFamily: "inherit",
            }}
          >
            ← Back
          </button>
          <PlaylistPlayIcon style={{ color: C.primary, fontSize: 28 }} />
          <div>
            <h1
              style={{
                margin: 0,
                color: C.text,
                fontSize: "20px",
                fontWeight: "800",
                fontFamily: "'Nunito', sans-serif",
              }}
            >
              {selected.playlist.title}
            </h1>
            <p
              style={{
                margin: 0,
                color: C.text3,
                fontSize: "13px",
                fontWeight: "600",
              }}
            >
              {selected.items.length} video
              {selected.items.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Empty state */}
        {selected.items.length === 0 && (
          <div
            style={{ textAlign: "center", padding: "60px 0", color: C.text3 }}
          >
            <PlaylistPlayIcon style={{ fontSize: 56, opacity: 0.25 }} />
            <p
              style={{ marginTop: "12px", fontWeight: "600", fontSize: "15px" }}
            >
              This playlist is empty.
            </p>
            <p style={{ fontSize: "13px", marginTop: "4px" }}>
              Go to a video and tap ⋮ → Add to Playlist.
            </p>
          </div>
        )}

        {/* Video list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {selected.items.map((item, idx) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                background: C.surface,
                borderRadius: "14px",
                border: `1.5px solid ${C.border}`,
                padding: "10px 14px",
                boxShadow: "0 2px 10px rgba(124,58,237,0.06)",
                transition: "box-shadow 0.2s",
              }}
            >
              <span
                style={{
                  minWidth: "24px",
                  textAlign: "center",
                  color: C.text3,
                  fontWeight: "800",
                  fontSize: "13px",
                  fontFamily: "'Nunito', sans-serif",
                }}
              >
                {idx + 1}
              </span>
              <Link
                to={`/video/${item.video.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  flex: 1,
                  textDecoration: "none",
                }}
              >
                <div
                  style={{
                    width: "120px",
                    height: "68px",
                    flexShrink: 0,
                    borderRadius: "10px",
                    overflow: "hidden",
                    background: C.surface2,
                    border: `1.5px solid ${C.border}`,
                  }}
                >
                  <img
                    src={
                      item.video.thumbnail_url ||
                      "https://via.placeholder.com/120x68?text=No+Thumb"
                    }
                    alt={item.video.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: "0 0 4px",
                      color: C.text,
                      fontWeight: "700",
                      fontSize: "14px",
                      lineHeight: "1.4",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {item.video.title}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      color: C.primary2,
                      fontSize: "12px",
                      fontWeight: "700",
                    }}
                  >
                    {item.video.channel || item.video.username}
                  </p>
                </div>
              </Link>
              <button
                onClick={() => removeFromPlaylist(item.id)}
                title="Remove from playlist"
                style={{
                  background: "none",
                  border: "none",
                  color: C.danger,
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#fff1f2")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "none")
                }
              >
                <DeleteOutlineIcon style={{ fontSize: 20 }} />
              </button>
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MAIN LIST VIEW
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <Shell>
      {/* ── Page header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        <PlaylistAddIcon style={{ color: C.primary, fontSize: 32 }} />
        <div style={{ flex: 1 }}>
          <h1
            style={{
              margin: 0,
              color: C.text,
              fontSize: "22px",
              fontWeight: "800",
              fontFamily: "'Nunito', sans-serif",
            }}
          >
            Playlists
          </h1>
          <p
            style={{
              margin: 0,
              color: C.text3,
              fontSize: "13px",
              fontWeight: "600",
            }}
          >
            {playlists.length} playlist{playlists.length !== 1 ? "s" : ""}
          </p>
        </div>
        {username && (
          <button
            onClick={() => setCreating(true)}
            style={{
              background: C.primary,
              border: "none",
              color: "#fff",
              borderRadius: "20px",
              padding: "10px 20px",
              cursor: "pointer",
              fontWeight: "700",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontFamily: "inherit",
              boxShadow: "0 4px 14px rgba(124,58,237,0.35)",
            }}
          >
            <AddIcon style={{ fontSize: 18 }} /> New Playlist
          </button>
        )}
      </div>

      {/* ── "Adding video to playlist" banner ── */}
      {pendingVideoId && (
        <div
          style={{
            background: "linear-gradient(135deg, #f7f0ff, #ede9fe)",
            border: `1.5px solid ${C.border}`,
            borderRadius: "14px",
            padding: "14px 18px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <PlaylistAddIcon style={{ color: C.primary, fontSize: 22 }} />
          <span style={{ color: C.text, fontWeight: "700", fontSize: "14px" }}>
            Select a playlist to add this video — or create a new one below.
          </span>
        </div>
      )}

      {/* ── Create new playlist form ── */}
      {creating && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "20px",
            background: C.surface,
            border: `1.5px solid ${C.border}`,
            borderRadius: "14px",
            padding: "12px 16px",
            boxShadow: "0 2px 12px rgba(124,58,237,0.08)",
          }}
        >
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createPlaylist()}
            placeholder="Playlist name..."
            style={{
              flex: 1,
              border: `1.5px solid ${C.border}`,
              borderRadius: "10px",
              padding: "10px 14px",
              fontSize: "14px",
              outline: "none",
              fontFamily: "inherit",
              color: C.text,
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.target.style.borderColor = C.primary)}
            onBlur={(e) => (e.target.style.borderColor = C.border)}
          />
          <button
            onClick={createPlaylist}
            style={{
              background: C.primary,
              border: "none",
              color: "#fff",
              borderRadius: "10px",
              padding: "0 18px",
              cursor: "pointer",
              fontWeight: "700",
              fontSize: "14px",
              fontFamily: "inherit",
            }}
          >
            Create
          </button>
          <button
            onClick={() => {
              setCreating(false);
              setNewTitle("");
            }}
            style={{
              background: C.surface2,
              border: `1.5px solid ${C.border}`,
              color: C.text3,
              borderRadius: "10px",
              padding: "0 12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <CloseIcon style={{ fontSize: 18 }} />
          </button>
        </div>
      )}

      {/* ── Not logged in ── */}
      {!username && (
        <div style={{ textAlign: "center", padding: "80px 0", color: C.text3 }}>
          <PlaylistAddIcon style={{ fontSize: 56, opacity: 0.25 }} />
          <p style={{ marginTop: "16px", fontSize: "16px", fontWeight: "600" }}>
            Sign in to create and manage playlists.
          </p>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div
          style={{
            background: "#fff1f2",
            border: "1.5px solid #fecdd3",
            borderRadius: "12px",
            padding: "14px 18px",
            color: C.danger,
            fontWeight: "600",
            fontSize: "14px",
            marginBottom: "16px",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* ── Loading spinner ── */}
      {username && loading && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              margin: "0 auto",
              border: `3px solid ${C.border}`,
              borderTop: `3px solid ${C.primary}`,
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── Empty state ── */}
      {username &&
        !loading &&
        !error &&
        playlists.length === 0 &&
        !creating && (
          <div
            style={{ textAlign: "center", padding: "80px 0", color: C.text3 }}
          >
            <PlaylistAddIcon style={{ fontSize: 56, opacity: 0.25 }} />
            <p
              style={{ marginTop: "16px", fontSize: "16px", fontWeight: "600" }}
            >
              No playlists yet.
            </p>
            <p style={{ fontSize: "13px", marginTop: "4px" }}>
              Click "New Playlist" to create your first one.
            </p>
          </div>
        )}

      {/* ── Playlist grid ── */}
      {!loading && playlists.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "14px",
          }}
        >
          {playlists.map((pl) => {
            const isAdded = !!addedMap[pl.id];
            return (
              <div
                key={pl.id}
                onClick={() => openPlaylist(pl)}
                style={{
                  background: C.surface,
                  border: `1.5px solid ${isAdded ? C.primary : C.border}`,
                  borderRadius: "16px",
                  padding: "16px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  cursor: "pointer",
                  boxShadow: isAdded
                    ? "0 4px 18px rgba(124,58,237,0.2)"
                    : "0 2px 10px rgba(124,58,237,0.06)",
                  transition:
                    "box-shadow 0.2s, border-color 0.2s, transform 0.15s",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 6px 24px rgba(124,58,237,0.18)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.borderColor = C.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = isAdded
                    ? "0 4px 18px rgba(124,58,237,0.2)"
                    : "0 2px 10px rgba(124,58,237,0.06)";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = isAdded
                    ? C.primary
                    : C.border;
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    flexShrink: 0,
                    background: isAdded ? C.primary : C.surface2,
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: `1.5px solid ${isAdded ? C.primary : C.border}`,
                    transition: "background 0.2s",
                  }}
                >
                  <PlaylistPlayIcon
                    style={{
                      fontSize: 26,
                      color: isAdded ? "#fff" : C.primary,
                    }}
                  />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: "0 0 2px",
                      color: C.text,
                      fontWeight: "700",
                      fontSize: "15px",
                      lineHeight: "1.3",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {pl.title}
                  </p>
                  {pl.description && (
                    <p
                      style={{
                        margin: 0,
                        color: C.text3,
                        fontSize: "12px",
                        fontWeight: "600",
                      }}
                    >
                      {pl.description}
                    </p>
                  )}
                  {pendingVideoId && isAdded && (
                    <p
                      style={{
                        margin: "2px 0 0",
                        color: C.primary,
                        fontSize: "11px",
                        fontWeight: "700",
                      }}
                    >
                      ✓ Video added
                    </p>
                  )}
                </div>

                {/* If adding a video — show toggle button */}
                {pendingVideoId ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVideoInPlaylist(e, pl.id);
                    }}
                    style={{
                      background: isAdded ? C.primary : C.surface2,
                      border: `1.5px solid ${isAdded ? C.primary : C.border}`,
                      color: isAdded ? "#fff" : C.primary,
                      borderRadius: "10px",
                      padding: "8px 14px",
                      cursor: "pointer",
                      fontWeight: "700",
                      fontSize: "13px",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      fontFamily: "inherit",
                      flexShrink: 0,
                      transition: "all 0.18s",
                    }}
                  >
                    {isAdded ? (
                      <>
                        <CheckIcon style={{ fontSize: 15 }} /> Added
                      </>
                    ) : (
                      <>
                        <AddIcon style={{ fontSize: 15 }} /> Add
                      </>
                    )}
                  </button>
                ) : (
                  /* Delete button */
                  <button
                    onClick={(e) => deletePlaylist(pl.id, e)}
                    title="Delete playlist"
                    style={{
                      background: "none",
                      border: "none",
                      color: C.text3,
                      cursor: "pointer",
                      padding: "6px",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      transition: "all 0.15s",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#fff1f2";
                      e.currentTarget.style.color = C.danger;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "none";
                      e.currentTarget.style.color = C.text3;
                    }}
                  >
                    <DeleteOutlineIcon style={{ fontSize: 20 }} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Done button when in add-video mode ── */}
      {pendingVideoId && !loading && (
        <div style={{ textAlign: "center", marginTop: "28px" }}>
          <button
            onClick={() => window.history.back()}
            style={{
              background: C.primary,
              border: "none",
              color: "#fff",
              borderRadius: "20px",
              padding: "12px 36px",
              cursor: "pointer",
              fontWeight: "700",
              fontSize: "15px",
              fontFamily: "inherit",
              boxShadow: "0 4px 16px rgba(124,58,237,0.35)",
            }}
          >
            ✓ Done
          </button>
        </div>
      )}
    </Shell>
  );
};

export default Playlist;
