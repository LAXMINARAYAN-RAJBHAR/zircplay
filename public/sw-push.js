/* eslint-disable no-restricted-globals */

// ── Zixplon push notification service worker ──
// Handles two events:
//   1. 'push'            → server sent a notification, show it
//   2. 'notificationclick' → user tapped it, focus/open the right page

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: "ZIXPLON", body: event.data.text() };
  }

  const {
    title = "ZIXPLON",
    body = "",
    icon = "/logo192.png",
    badge = "/logo192.png",
    url = "/",
    tag,
  } = payload;

  const options = {
    body,
    icon,
    badge,
    // 'tag' groups notifications — e.g. multiple messages from the same
    // person collapse into one instead of stacking up
    tag: tag || "zixplon-notification",
    renotify: true,
    vibrate: [100, 50, 100],
    data: { url },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If a Zixplon tab is already open, focus it and navigate there
        for (const client of clientList) {
          if ("focus" in client) {
            client.postMessage({ type: "PUSH_NAVIGATE", url: targetUrl });
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});