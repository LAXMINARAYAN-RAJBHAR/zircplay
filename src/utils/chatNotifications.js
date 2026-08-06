// Thin wrapper around the browser Notification API for chat alerts.
// Kept deliberately simple: request permission once per session, and
// silently no-op everywhere the API isn't available/granted rather than
// ever throwing — a notification failing should never break the chat.

let permissionRequested = false;

export const ensureNotificationPermission = () => {
  if (!("Notification" in window)) return;
  if (permissionRequested) return;
  permissionRequested = true;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
};

export const showChatNotification = (title, body) => {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    // eslint-disable-next-line no-new
    new Notification(title, { body, icon: "/logo192.png" });
  } catch {
    /* no-op */
  }
};