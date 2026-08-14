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

    const cached = getCachedPreview(url);
    if (cached) setEntry(cached);
    else fetchLinkPreview(url);

    const unsubscribe = subscribeToPreview(url, setEntry);
    return unsubscribe;
  }, [url]);

  return entry; // null | { status: 'loading' | 'done' | 'error', data }
};