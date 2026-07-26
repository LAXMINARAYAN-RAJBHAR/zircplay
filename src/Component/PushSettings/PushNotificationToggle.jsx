import React from "react";
import { usePushNotifications } from "../../hooks/usePushNotifications";

// Drop this anywhere sensible — Navbar dropdown, Profile settings, a
// banner on first login, etc. It needs `currentUser` (the username
// string), same prop pattern used elsewhere in the app.
const PushNotificationToggle = ({ currentUser }) => {
  const { isSupported, permission, isSubscribed, subscribing, subscribe, unsubscribe } =
    usePushNotifications(currentUser);

  if (!isSupported) return null; // e.g. desktop Safari, unsupported browsers
  if (!currentUser) return null;

  if (permission === "denied") {
    return (
      <div style={{ fontSize: 12, color: "var(--zx-text3, #7a3a3a)" }}>
        Notifications blocked — enable them in your browser's site settings to
        get alerts.
      </div>
    );
  }

  return (
    <button
      onClick={isSubscribed ? unsubscribe : subscribe}
      disabled={subscribing}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: isSubscribed ? "var(--zx-surface2, #fef2f2)" : "var(--zx-primary, #dc2626)",
        color: isSubscribed ? "var(--zx-text, #1a1414)" : "#fff",
        border: isSubscribed ? "2px solid var(--zx-border, #fbd5d5)" : "none",
        borderRadius: 20,
        padding: "8px 16px",
        fontWeight: 700,
        fontFamily: "'Outfit', sans-serif",
        fontSize: 13,
        cursor: subscribing ? "wait" : "pointer",
        opacity: subscribing ? 0.7 : 1,
      }}
    >
      {subscribing
        ? "Setting up…"
        : isSubscribed
          ? "🔔 Notifications on"
          : "🔕 Enable notifications"}
    </button>
  );
};

export default PushNotificationToggle;