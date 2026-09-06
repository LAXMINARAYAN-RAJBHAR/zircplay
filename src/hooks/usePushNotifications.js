import { useState, useEffect, useCallback } from "react";
import { supabase } from "../config/supabase";

// Set this after generating VAPID keys (step in the setup guide).
// This is the PUBLIC key only — safe to ship in client code.
const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;

// Converts the VAPID public key from base64url (as generated) into the
// Uint8Array format the Push API's subscribe() call expects.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(currentUser) {
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );
  const [subscribing, setSubscribing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined";

  // Check on mount whether this device already has an active subscription.
  //
  // FIX: getRegistration() takes a SCOPE url, not a script path.
  // register("/sw.js") with no scope option defaults the registration's
  // scope to "/" (the directory the script lives in) — so looking up
  // getRegistration("/sw.js") was asking "is there a registration whose
  // scope covers /sw.js?", which never matches a registration actually
  // scoped to "/". That meant this always came back undefined, so
  // isSubscribed never reflected a real existing subscription on reload.
  // Calling getRegistration() with no argument returns the registration
  // controlling the current page, which is what we actually want.
  //
  // CHANGED: also now points at the single merged "/sw.js" (which
  // handles caching AND push) instead of the separate "/sw-push.js" —
  // registering two different service worker scripts at the same scope
  // was causing the second one to silently replace the first as the
  // active controller, dropping sw.js's fetch/cache logic. See sw.js's
  // top-of-file comment for the full explanation.
  useEffect(() => {
    if (!isSupported) return;

    navigator.serviceWorker.getRegistration().then(async (reg) => {
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    });
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !currentUser || !VAPID_PUBLIC_KEY) return;

    setSubscribing(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setSubscribing(false);
        return;
      }

      // CHANGED: registers the merged "/sw.js" instead of the removed
      // "/sw-push.js" — see the comment above and sw.js's own header
      // comment for why having two separate service worker scripts at
      // the same scope was a problem.
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const json = subscription.toJSON();

      await supabase.from("push_subscriptions").upsert(
        {
          username: currentUser,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          user_agent: navigator.userAgent,
        },
        { onConflict: "endpoint" },
      );

      setIsSubscribed(true);
    } catch (err) {
      console.error("Push subscription failed:", err);
    } finally {
      setSubscribing(false);
    }
  }, [isSupported, currentUser]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;
    // FIX: same getRegistration() scope-vs-path issue as the mount
    // effect above — this was returning undefined and silently no-op'ing
    // the whole unsubscribe flow (never calling subscription.unsubscribe()
    // or deleting the DB row, and never even updating isSubscribed).
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", subscription.endpoint);
      await subscription.unsubscribe();
    }
    setIsSubscribed(false);
  }, [isSupported]);

  return { isSupported, permission, isSubscribed, subscribing, subscribe, unsubscribe };
}