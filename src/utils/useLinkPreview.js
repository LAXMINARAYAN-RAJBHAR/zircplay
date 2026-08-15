import { useEffect, useState } from "react";
import {
  fetchLinkPreview,
  getCachedPreview,
  subscribeToPreview,
} from "./linkPreview";

// Subscribes a component to the shared preview cache for one URL.
// Triggers a fetch the first time a given URL is seen anywhere in the
// app; every subsequent component asking for the same URL just reads
// the cached/in-flight result instead of firing its own request.
export const useLinkPreview = (url) => {
  const [entry, setEntry] = useState(() => (url ? getCachedPreview(url) : null));

  useEffect(() => {
    if (!url) {
      setEntry(null);
      return;
    }

    // FIXED: subscribe BEFORE triggering the fetch. fetchLinkPreview()
    // synchronously sets the cache to { status: 'loading' } and notifies
    // listeners immediately — if we called it first (as before), the
    // very first component anywhere in the app to request a brand-new
    // (never-cached) URL would miss that notification, since it hadn't
    // subscribed yet, and would stay stuck on `null` until the fetch
    // resolved instead of showing a loading state in between.
    const unsubscribe = subscribeToPreview(url, setEntry);

    const cached = getCachedPreview(url);
    if (cached) setEntry(cached);
    else fetchLinkPreview(url);

    return unsubscribe;
  }, [url]);

  return entry; // null | { status: 'loading' | 'done' | 'error', data }
};