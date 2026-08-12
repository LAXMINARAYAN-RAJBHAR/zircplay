// src/Component/Notifications/notifications.js
//
// Notifications page — lists rows from the `notifications` table for the
// logged-in user, lets them mark items read, and navigates to the
// relevant content on click. Rendered at the /notifications route.

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import "./notifications.css";
import { notifyUser, notifySubscribers } from "../../utils/notifications";

const TYPE_ICON = {
  like: "❤️",
  comment: "💬",
  subscriber: "🔔",
  upload: "🎬",
};

const timeAgo = (iso) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

const destinationFor = (n) => {
  switch (n.content_type) {
    case "video":
      return `/video/${n.content_id}`;
    case "reel":
      return `/reels/${n.content_id}`;
    case "post":
      return `/?tab=posts&post=${n.content_id}`;
    default:
      return null;
  }
};

export default function Notifications({ currentUser }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: fetchErr } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_username", currentUser)
      .order("created_at", { ascending: false })
      .limit(100);

    if (fetchErr) {
      console.error("[Notifications] Failed to load notifications:", fetchErr);
      setError("Couldn't load notifications. Please try again.");
    } else {
      setNotifications(data || []);
      setError(null);
    }
    setLoading(false);
  }, [currentUser]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    const { error: updateErr } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
    if (updateErr) {
      console.error("[Notifications] Failed to mark as read:", updateErr);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    const { error: updateErr } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", unreadIds);
    if (updateErr) {
      console.error("[Notifications] Failed to mark all as read:", updateErr);
    }
  };

  const handleClick = (n) => {
    if (!n.is_read) markAsRead(n.id);
    const dest = destinationFor(n);
    if (dest) navigate(dest);
  };

  if (!currentUser) {
    return (
      <div className="zx-notifications-page">
        <p className="zx-notifications-empty">Log in to see your notifications.</p>
      </div>
    );
  }

  return (
    <div className="zx-notifications-page">
      <div className="zx-notifications-header">
        <h2>Notifications</h2>
        {notifications.some((n) => !n.is_read) && (
          <button className="zx-notifications-markall" onClick={markAllAsRead}>
            Mark all as read
          </button>
        )}
      </div>

      {loading && <p className="zx-notifications-status">Loading…</p>}
      {error && <p className="zx-notifications-status zx-notifications-error">{error}</p>}
      {!loading && !error && notifications.length === 0 && (
        <p className="zx-notifications-empty">You're all caught up — no notifications yet.</p>
      )}

      <ul className="zx-notifications-list">
        {notifications.map((n) => (
          <li
            key={n.id}
            className={`zx-notification-item${n.is_read ? "" : " zx-notification-unread"}`}
            onClick={() => handleClick(n)}
          >
            <span className="zx-notification-icon">{TYPE_ICON[n.type] || "🔔"}</span>
            <div className="zx-notification-body">
              <p className="zx-notification-message">
                <strong>{n.sender_username}</strong> {n.message}
              </p>
              <span className="zx-notification-time">{timeAgo(n.created_at)}</span>
            </div>
            {!n.is_read && <span className="zx-notification-dot" />}
          </li>
        ))}
      </ul>
    </div>
  );
}