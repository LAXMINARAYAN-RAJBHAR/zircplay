import { useEffect, useState, useRef } from "react";

// Small test file for measuring real throughput on browsers
// that don't support the Network Information API (Safari/iOS)
const TEST_IMAGE_URL = "https://res.cloudinary.com/demo/image/upload/w_50,q_auto/sample.jpg";
const TEST_TIMEOUT_MS = 4000;

const classifyFromEffectiveType = (type) => {
  if (type === "slow-2g" || type === "2g") return "low";
  if (type === "3g") return "medium";
  return "high"; // 4g or unknown-but-fast
};

const measureThroughput = () =>
  new Promise((resolve) => {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      resolve("low"); // timed out — assume weak connection
    }, TEST_TIMEOUT_MS);

    fetch(`${TEST_IMAGE_URL}&_=${startTime}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => res.blob())
      .then((blob) => {
        clearTimeout(timeout);
        const durationSec = (Date.now() - startTime) / 1000;
        const kbps = (blob.size * 8) / 1024 / durationSec;
        if (kbps < 150) resolve("low");
        else if (kbps < 600) resolve("medium");
        else resolve("high");
      })
      .catch(() => {
        clearTimeout(timeout);
        resolve("high"); // fetch failed for unrelated reason — don't punish quality
      });
  });

/**
 * Returns 'low' | 'medium' | 'high' based on real-time network conditions.
 * Uses the Network Information API where available (Chrome, Android, Edge),
 * and falls back to an active throughput test on Safari/iOS where that API
 * doesn't exist.
 */
export default function useNetworkQuality() {
  const [quality, setQuality] = useState("high");
  const pollRef = useRef(null);

  useEffect(() => {
    const conn =
      navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    if (conn) {
      const update = () => setQuality(classifyFromEffectiveType(conn.effectiveType));
      update();
      conn.addEventListener("change", update);
      return () => conn.removeEventListener("change", update);
    }

    // Fallback path (Safari/iOS): measure once now, then re-check every 30s
    let cancelled = false;
    const run = async () => {
      const result = await measureThroughput();
      if (!cancelled) setQuality(result);
    };
    run();
    pollRef.current = setInterval(run, 30000);
    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
    };
  }, []);

  return quality;
}