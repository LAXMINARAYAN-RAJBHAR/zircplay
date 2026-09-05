// src/Component/Notifications/notifications.js
//
// Notifications page — lists rows from the `notifications` table for the
// logged-in user, lets them mark items read, and navigates to the
// relevant content on click. Rendered at the /notifications route.
//
// NEW: connection_request notifications (fired by the notify_on_subscribe
// DB trigger whenever someone sends a Connect request) now render inline
// Accept / Decline buttons, Facebook-style, instead of just navigating
// somewhere on click. Accepting flips the connections row's status to
// "accepted" (which also fires notify_on_connect_accept, notifying the
// original requester); declining deletes the row outright. Both remove
// the notification from the list immediately once actioned.
//
// FIX: accepting/declining now also deletes the notification row itself
// in the DB, not just the local React state. Previously only local state
// was updated, so a refetch (page reload, dropdown reopen) would pull the
// same connection_request row back from the DB — still with its original
// type — and the Accept/Decline buttons would reappear even though the
// connection had already been actioned.

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import "./notifications.css";

// NEW: "mention" — fired from PostFeed.jsx (post creation + comments)
// and HashtagPage.jsx (comments) whenever someone @mentions a user.
// NEW: "connection_request" / "connection_accepted" — fired by the
// notify_on_subscribe / notify_on_connect_accept DB triggers on the
// connections table (see connection_request_migration.sql).
const TYPE_ICON = {
  like: "❤️",
  comment: "💬",
  connection: "🔔",
  upload: "🎬",
  mention: "📣",
  connection_request: "🤝",
  connection_accepted: "✅",
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
      // connection_request / connection_accepted notifications have
      // content_type: "connection" — there's nowhere sensible to
      // navigate for those, so this intentionally falls through here.
      return null;
  }
};

export default function Notifications({ currentUser }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // NEW: tracks which connection_request notification currently has an
  // Accept/Decline request in flight, keyed by notification id — guards
  // against double-clicks firing two overlapping Supabase writes for
  // the same row, same pattern as connectLoading elsewhere in the app.
  const [connectionActionBusy, setConnectionActionBusy] = useState(null);
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

  // NEW: accept a pending connection request. n.content_id holds the
  // connections.id (set by the notify_on_subscribe trigger at insert
  // time), so this can update the row directly with no extra lookup.
  // Flipping status → "accepted" also fires notify_on_connect_accept
  // server-side, notifying the original requester automatically — no
  // client-side notification call needed here.
  const acceptConnection = async (n) => {
    if (connectionActionBusy) return;
    setConnectionActionBusy(n.id);
    const { error: updateErr } = await supabase
      .from("connections")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", n.content_id);

    if (updateErr) {
      console.error("[Notifications] Failed to accept connection:", updateErr);
      setConnectionActionBusy(null);
      return;
    }

    // FIX: delete the notification row itself, not just update local
    // state — otherwise a refetch (page reload, dropdown reopen) pulls
    // this same connection_request row back from the DB and the
    // Accept/Decline buttons reappear even though it's already been
    // actioned.
    await supabase.from("notifications").delete().eq("id", n.id);
    setConnectionActionBusy(null);
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
  };

  // NEW: decline a pending connection request — deletes the connections
  // row outright (same as withdrawing/disconnecting from the Connect
  // button elsewhere), rather than leaving a permanently-declined row
  // around. The requester simply sees "Connect" again if they check.
  const declineConnection = async (n) => {
    if (connectionActionBusy) return;
    setConnectionActionBusy(n.id);
    const { error: deleteErr } = await supabase
      .from("connections")
      .delete()
      .eq("id", n.content_id);

    if (deleteErr) {
      console.error("[Notifications] Failed to decline connection:", deleteErr);
      setConnectionActionBusy(null);
      return;
    }

    // FIX: same as acceptConnection above — delete the notification row
    // too, not just local state, so it doesn't come back on refetch.
    await supabase.from("notifications").delete().eq("id", n.id);
    setConnectionActionBusy(null);
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
  };

  const handleClick = (n) => {
    // connection_request notifications are actioned via the Accept/
    // Decline buttons below, not by clicking the row itself — clicking
    // elsewhere on the row just marks it read without navigating
    // anywhere (destinationFor returns null for these).
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
        {notifications.map((n) => {
          const isConnectionRequest = n.type === "connection_request";
          const isBusy = connectionActionBusy === n.id;

          return (
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

                {/* NEW: Facebook-style inline Accept / Decline row for a
                    pending connection request. stopPropagation keeps a
                    button click from also triggering handleClick on the
                    parent <li> (which would otherwise just mark it read
                    a second time — harmless, but redundant). */}
                {isConnectionRequest && (
                  <div
                    className="zx-notification-actions"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: "flex",
                      gap: "8px",
                      marginTop: "8px",
                    }}
                  >
                    <button
                      type="button"
                      className="zx-notification-decline-btn"
                      onClick={() => declineConnection(n)}
                      disabled={isBusy}
                      style={{
                        flex: 1,
                        maxWidth: "140px",
                        padding: "6px 14px",
                        borderRadius: "8px",
                        border: "1.5px solid #d1d5db",
                        background: "transparent",
                        color: "#4b5563",
                        fontWeight: 700,
                        fontSize: "13px",
                        cursor: isBusy ? "not-allowed" : "pointer",
                        opacity: isBusy ? 0.6 : 1,
                      }}
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      className="zx-notification-accept-btn"
                      onClick={() => acceptConnection(n)}
                      disabled={isBusy}
                      style={{
                        flex: 1,
                        maxWidth: "140px",
                        padding: "6px 14px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#1877f2",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: "13px",
                        cursor: isBusy ? "not-allowed" : "pointer",
                        opacity: isBusy ? 0.6 : 1,
                      }}
                    >
                      {isBusy ? "…" : "Accept"}
                    </button>
                  </div>
                )}
              </div>
              {!n.is_read && <span className="zx-notification-dot" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}