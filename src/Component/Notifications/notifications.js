import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";

// ── ZIXPLON light theme palette (matches PostFeed.css :root) ──
const THEME = {
  bg: "#f0f4ff",
  surface: "#ffffff",
  surface2: "#f7f0ff",
  border: "#e0d4ff",
  primary: "#7c3aed",
  primary2: "#a855f7",
  text: "#1e1b4b",
  text2: "#4c4589",
  text3: "#8b84c4",
};

const getNotifStyle = (type) => {
  switch (type) {
    case "upload":     return { color: "#ef4444", icon: "🎬" };
    case "like":       return { color: "#f97316", icon: "❤️" };
    case "comment":    return { color: "#3b82f6", icon: "💬" };
    case "subscriber": return { color: "#10b981", icon: "🔔" };
    case "post":       return { color: "#a78bfa", icon: "📝" };
    default:           return { color: THEME.text3, icon: "📢" };
  }
};

const timeAgo = (timestamp) => {
  const diff = Math.floor((Date.now() - new Date(timestamp)) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const PAGE_SIZE = 25;

const Notifications = ({ currentUser }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const mapRow = (n) => ({
    id: n.id,
    type: n.type,
    message: n.message,
    avatar: n.sender_username?.[0]?.toUpperCase() || "?",
    time: timeAgo(n.created_at),
    read: n.is_read,
    contentId: n.content_id ?? null,
    contentType: n.content_type ?? null,
  });

  // ── Initial load ──
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .from("notifications")
      .select("*")
      .eq("recipient_username", currentUser)
      .order("created_at", { ascending: false })
      .range(0, PAGE_SIZE - 1)
      .then(({ data, error }) => {
        if (!error && data) {
          setNotifications(data.map(mapRow));
          setHasMore(data.length === PAGE_SIZE);
        }
        setLoading(false);
      });

    // ── Realtime: new notifications land at the top instantly ──
    const channel = supabase
      .channel("notifications-page-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_username=eq.${currentUser}`,
        },
        (payload) => {
          setNotifications((prev) => [mapRow(payload.new), ...prev]);
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUser]);

  const loadMore = async () => {
    if (!currentUser || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_username", currentUser)
      .order("created_at", { ascending: false })
      .range(notifications.length, notifications.length + PAGE_SIZE - 1);
    if (!error && data) {
      setNotifications((prev) => [...prev, ...data.map(mapRow)]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoadingMore(false);
  };

  const markOneRead = async (id) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const markAllRead = async () => {
    if (!currentUser) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_username", currentUser)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotifClick = (n) => {
    markOneRead(n.id);
    if (!n.contentId || !n.contentType) return;
    if (n.contentType === "reel") navigate(`/reels/${n.contentId}`);
    else if (n.contentType === "video") navigate(`/video/${n.contentId}`);
    else if (n.contentType === "post") navigate(`/feed?post=${n.contentId}`);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div
      style={{
        paddingTop: "80px",
        maxWidth: "700px",
        margin: "0 auto",
        padding: "80px 24px 24px",
        background: THEME.bg,
        minHeight: "100vh",
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <h2 style={{ color: THEME.text, margin: 0 }}>All Notifications</h2>
        {unreadCount > 0 && (
          <span
            onClick={markAllRead}
            style={{ color: THEME.primary, fontSize: "14px", cursor: "pointer", fontWeight: "600" }}
          >
            Mark all as read
          </span>
        )}
      </div>

      {!currentUser ? (
        <p style={{ color: THEME.text3 }}>Log in to see your notifications.</p>
      ) : loading ? (
        <p style={{ color: THEME.text3 }}>Loading...</p>
      ) : notifications.length === 0 ? (
        <p style={{ color: THEME.text3 }}>No notifications yet.</p>
      ) : (
        <>
          {notifications.map((n) => {
            const { color, icon } = getNotifStyle(n.type);
            return (
              <div
                key={n.id}
                onClick={() => handleNotifClick(n)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: "14px",
                  padding: "14px 16px", marginBottom: "8px",
                  background: n.read ? THEME.surface : THEME.surface2,
                  borderRadius: "10px",
                  border: n.read ? `2px solid ${THEME.border}` : `2px solid ${THEME.primary2}`,
                  cursor: "pointer",
                  boxShadow: n.read ? "none" : "0 2px 12px rgba(124,58,237,0.08)",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
              >
                <div style={{
                  width: "44px", height: "44px", borderRadius: "50%",
                  background: color, display: "flex", alignItems: "center",
                  justifyContent: "center", fontWeight: "700",
                  fontSize: "16px", color: "white", flexShrink: 0,
                }}>
                  {n.avatar}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, color: n.read ? THEME.text2 : THEME.text, fontSize: "14px", lineHeight: "1.5", fontWeight: n.read ? 400 : 600 }}>
                    <span style={{ marginRight: "6px" }}>{icon}</span>
                    {n.message}
                  </p>
                  <span style={{ color: THEME.text3, fontSize: "12px" }}>{n.time}</span>
                </div>
                {!n.read && (
                  <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: THEME.primary, flexShrink: 0, marginTop: "6px" }} />
                )}
              </div>
            );
          })}

          {hasMore && (
            <div style={{ textAlign: "center", marginTop: "16px" }}>
              <button
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  padding: "8px 20px", borderRadius: "20px", border: `2px solid ${THEME.border}`,
                  background: THEME.surface, color: THEME.primary, cursor: "pointer", fontSize: "13px",
                  fontWeight: 700, fontFamily: "'Outfit', sans-serif",
                }}
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Notifications;