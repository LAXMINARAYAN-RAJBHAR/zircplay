import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../../config/supabase";
import { Room, RoomEvent } from "livekit-client";

// ─────────────────────────────────────────────────────────────────────────────
// useLivePreview — mirrors the useHoverPreview pattern used for Videos/Reels
// on the HomePage, but for a genuinely LIVE source there's no static file to
// swap in. Instead, after a short hover delay, it opens a real subscribe-only
// LiveKit connection to THAT ONE stream, attaches the video track (muted),
// and tears the connection down again the moment the mouse leaves. Only ever
// one tile previews at a time (whichever is hovered), so this never opens
// more than one extra LiveKit connection at once.
// ─────────────────────────────────────────────────────────────────────────────
const LIVE_PREVIEW_HOVER_DELAY = 450; // ms — same feel as the video/reel hover delay

const useLivePreview = (roomName, canPreview) => {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewStatus, setPreviewStatus] = useState("idle"); // idle | connecting | connected | error
  const videoRef = useRef(null);
  const roomRef = useRef(null);
  const timeoutRef = useRef(null);
  const cancelledRef = useRef(false);

  const cancelTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const teardown = () => {
    cancelledRef.current = true;
    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch (_) {}
      roomRef.current = null;
    }
    setPreviewStatus("idle");
  };

  const startPreview = async () => {
    if (!canPreview || !roomName) return;
    cancelledRef.current = false;
    setPreviewStatus("connecting");
    try {
      const identity = `preview_${Date.now()}`;
      const res = await fetch(
        `/api/livekit-token?room=${encodeURIComponent(
          roomName,
        )}&identity=${encodeURIComponent(identity)}&canPublish=false`,
      );
      const { token, url } = await res.json();
      if (cancelledRef.current) return;

      const room = new Room();
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (cancelledRef.current) return;
        // Muted, silent preview — only the video track gets attached;
        // audio is intentionally left unattached so hovering tiles never
        // plays sound.
        if (track.kind === "video" && videoRef.current) {
          track.attach(videoRef.current);
        }
      });
      room.on(RoomEvent.Disconnected, () => {
        if (!cancelledRef.current) setPreviewStatus("idle");
      });

      await room.connect(url, token);
      if (cancelledRef.current) {
        room.disconnect();
        return;
      }
      roomRef.current = room;
      setPreviewStatus("connected");
    } catch (_) {
      if (!cancelledRef.current) setPreviewStatus("error");
    }
  };

  const onMouseEnter = () => {
    if (!canPreview) return;
    cancelTimer();
    timeoutRef.current = setTimeout(() => {
      setIsPreviewing(true);
      startPreview();
    }, LIVE_PREVIEW_HOVER_DELAY);
  };

  const onMouseLeave = () => {
    cancelTimer();
    setIsPreviewing(false);
    teardown();
  };

  useEffect(() => {
    return () => {
      cancelTimer();
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isPreviewing,
    previewStatus,
    videoRef,
    onMouseEnter,
    onMouseLeave,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// LiveCard — a single tile in the live grid. Extracted out so each tile owns
// its own useLivePreview instance/hover state independently.
// ─────────────────────────────────────────────────────────────────────────────
const LiveCard = ({ stream: s, onSelect }) => {
  const canPreview = !!s.room_name;
  const { isPreviewing, previewStatus, videoRef, onMouseEnter, onMouseLeave } =
    useLivePreview(s.room_name, canPreview);

  const showVideo = isPreviewing && previewStatus === "connected";

  return (
    <div
      onClick={() => onSelect(s.room_name)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        background: s.thumbnail_url
          ? `#000 url(${s.thumbnail_url}) center / cover no-repeat`
          : "linear-gradient(135deg,#3b2f63,#1a1a1a)",
        border: "1px solid #333",
        borderRadius: "10px",
        padding: "16px",
        width: "220px",
        height: "140px",
        boxSizing: "border-box",
        cursor: "pointer",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        overflow: "hidden",
      }}
    >
      {/* Live preview video — muted, silent, fills the tile. Only mounted
          once the connection is actually live so the thumbnail stays put
          (and visible) while connecting. */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: showVideo ? 1 : 0,
          transition: "opacity 0.25s",
          zIndex: 0,
        }}
      />

      {/* Dark gradient so text stays readable over any thumbnail or preview */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0) 100%)",
          zIndex: 1,
        }}
      />

      <span
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          background: "#ff0000",
          color: "white",
          fontSize: "10px",
          fontWeight: 700,
          padding: "2px 6px",
          borderRadius: "4px",
          zIndex: 2,
        }}
      >
        ● LIVE
      </span>

      {isPreviewing && previewStatus === "connecting" && (
        <span
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "rgba(0,0,0,0.6)",
            color: "white",
            fontSize: "9px",
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: "4px",
            zIndex: 2,
          }}
        >
          Loading preview...
        </span>
      )}

      <p
        style={{
          color: "white",
          fontWeight: 600,
          marginTop: "8px",
          marginBottom: "2px",
          position: "relative",
          zIndex: 2,
        }}
      >
        {s.title}
      </p>
      <p
        style={{
          color: "#ddd",
          fontSize: "12px",
          position: "relative",
          zIndex: 2,
        }}
      >
        {s.broadcaster_name}
      </p>
    </div>
  );
};

// Shows a list of currently-live streams; click one to watch.
const LiveBrowser = ({ currentUser }) => {
  const [streams, setStreams] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);

  useEffect(() => {
    const fetchLive = async () => {
      const { data } = await supabase
        .from("live_streams")
        .select("*")
        .eq("is_live", true)
        .order("started_at", { ascending: false });
      setStreams(data || []);
    };
    fetchLive();
    const interval = setInterval(fetchLive, 8000);
    return () => clearInterval(interval);
  }, []);

  if (activeRoom) {
    return (
      <LiveWatch
        roomName={activeRoom}
        currentUser={currentUser}
        onLeave={() => setActiveRoom(null)}
      />
    );
  }

  return (
    <div style={{ padding: "0" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "14px",
        }}
      >
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
            flexShrink: 0,
          }}
        >
          Z
        </span>
        <span
          style={{
            fontSize: "15px",
            fontWeight: "900",
            fontFamily: "Nunito, sans-serif",
            letterSpacing: "0.5px",
            color: "#1e1b4b",
          }}
        >
          Live Now
        </span>
      </div>

      {streams.length === 0 && (
        <p style={{ color: "#8b84c4", fontSize: "13px" }}>
          No one is live right now.
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
        {streams.map((s) => (
          <LiveCard key={s.id} stream={s} onSelect={setActiveRoom} />
        ))}
      </div>
    </div>
  );
};

// Connects as a subscribe-only participant and renders the broadcaster's video
const LiveWatch = ({ roomName, currentUser, onLeave }) => {
  const videoRef = useRef(null);
  const roomRef = useRef(null);
  const [status, setStatus] = useState("connecting");

  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      try {
        const identity = currentUser || `viewer_${Date.now()}`;
        const res = await fetch(
          `/api/livekit-token?room=${encodeURIComponent(
            roomName,
          )}&identity=${encodeURIComponent(identity)}&canPublish=false`,
        );
        const { token, url } = await res.json();

        const room = new Room();

        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === "video" && videoRef.current) {
            track.attach(videoRef.current);
          } else if (track.kind === "audio") {
            track.attach();
          }
        });

        room.on(RoomEvent.Disconnected, () => {
          if (!cancelled) setStatus("ended");
        });

        await room.connect(url, token);
        roomRef.current = room;
        if (!cancelled) setStatus("connected");
      } catch (err) {
        if (!cancelled) setStatus("error");
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, [roomName, currentUser]);

  return (
    <div style={{ padding: "20px", maxWidth: "720px", margin: "0 auto" }}>
      <button
        onClick={onLeave}
        style={{
          background: "#272727",
          color: "white",
          border: "none",
          borderRadius: "8px",
          padding: "8px 14px",
          cursor: "pointer",
          marginBottom: "12px",
        }}
      >
        ← Back to live list
      </button>

      {status === "connecting" && (
        <p style={{ color: "#aaa" }}>Connecting to stream...</p>
      )}
      {status === "ended" && (
        <p style={{ color: "#aaa" }}>This stream has ended.</p>
      )}
      {status === "error" && (
        <p style={{ color: "#ff6666" }}>
          Couldn't connect to this stream. It may have ended.
        </p>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: "100%",
          aspectRatio: "16 / 9",
          background: "#000",
          borderRadius: "10px",
          objectFit: "cover",
          display: "block",
        }}
      />
    </div>
  );
};

export default LiveBrowser;