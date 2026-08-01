export const config = { runtime: "edge" };

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getVideoThumbnail(videoUrl) {
  if (!videoUrl) return null;
  if (videoUrl.includes("/upload/")) {
    return videoUrl
      .replace("/upload/", "/upload/so_0/")
      .replace(/\.\w+(\?.*)?$/, ".jpg");
  }
  return null;
}

// Supabase can occasionally be slow to respond from an edge function's cold
// start. WhatsApp/Facebook's crawler has a short timeout of its own — if we
// don't answer in time, the crawler treats it as a failure and CACHES that
// failure against this exact URL, often for days. This wraps the fetch so a
// slow response degrades to the fallback branding instead of the whole
// request hanging past the crawler's patience.
const FETCH_TIMEOUT_MS = 4000;

async function fetchWithTimeout(url, options, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function renderHtml({ type, title, description, image, url }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeUrl = escapeHtml(url);

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>${safeTitle} — ZIXPLON</title>
    <meta property="og:type" content="${type === "post" ? "article" : "video.other"}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:width" content="1280" />
    <meta property="og:image:height" content="720" />
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:site_name" content="ZIXPLON" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${safeImage}" />
    <script>window.location.replace("${safeUrl}");</script>
  </head>
  <body>
    <p>Redirecting... <a href="${safeUrl}">Click here if not redirected</a></p>
  </body>
</html>`;
}

// FIX: this used to be the fallback INSIDE the try block's og image chain,
// but a total fetch failure (timeout, network error, Supabase down) skipped
// straight to the catch block below and returned a page with NO og: tags
// at all — the worst possible outcome, since Meta caches that "no preview"
// result against the URL for a long time. Every code path now returns full,
// valid OG tags — worst case it's generic ZIXPLON branding instead of the
// real post, which is recoverable (a re-share/re-scrape fixes it) instead
// of poisoning the cache with nothing.
function fallbackHtml(type, url) {
  return renderHtml({
    type,
    title: "ZIXPLON",
    description: "Watch videos, reels, and posts on ZIXPLON",
    image: "https://zixplon.in/logo192.png",
    url,
  });
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  // Cache-Control tells Meta/WhatsApp to treat this as fresh for a bounded
  // window and then re-check, rather than caching indefinitely. Combined
  // with the fallback above, even a bad scrape self-heals within an hour
  // instead of needing a manual "Scrape Again" forever.
  const headers = {
    "content-type": "text/html",
    "cache-control": "public, max-age=3600, s-maxage=3600",
  };

  const fallbackUrl =
    type === "post"
      ? `https://zixplon.in/feed?post=${id}`
      : `https://zixplon.in/${type === "reel" ? `reels/db_${id}` : `video/${id}`}`;

  if (!id || !type) {
    return new Response(fallbackHtml(type || "post", fallbackUrl), { headers });
  }

  try {
    let title, description, image, url;

    if (type === "post") {
      const res = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/posts?id=eq.${id}&select=*`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) throw new Error(`Supabase responded ${res.status}`);
      const data = await res.json();
      const item = data?.[0];

      if (!item) {
        return new Response(fallbackHtml(type, fallbackUrl), { headers });
      }

      title = item?.username ? `${item.username} on ZIXPLON` : "Post on ZIXPLON";
      description = item?.text?.slice(0, 200) || "Check out this post on ZIXPLON";
      image =
        item?.image_url ||
        item?.image_urls?.[0] ||
        getVideoThumbnail(item?.video_url) ||
        "https://zixplon.in/logo192.png";
      url = `https://zixplon.in/feed?post=${id}`;
    } else {
      const table = type === "reel" ? "reels" : "videos";
      const res = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}&select=*`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) throw new Error(`Supabase responded ${res.status}`);
      const data = await res.json();
      const item = data?.[0];

      if (!item) {
        return new Response(fallbackHtml(type, fallbackUrl), { headers });
      }

      title = item?.title || "Watch on ZIXPLON";
      description = item?.description || item?.channel || "Watch videos and reels on ZIXPLON";
      image =
        item?.thumbnail_url ||
        item?.thumbnail ||
        getVideoThumbnail(item?.video_url) ||
        "https://zixplon.in/logo192.png";
      url = `https://zixplon.in/${type === "reel" ? `reels/db_${id}` : `video/${id}`}`;
    }

    return new Response(renderHtml({ type, title, description, image, url }), { headers });
  } catch (err) {
    // Previously returned a bare error page with no og: tags at all —
    // now falls back to valid generic branding instead, so a transient
    // Supabase/network failure can never get a "no preview" result
    // cached against this URL.
    console.error("og handler error:", err);
    return new Response(fallbackHtml(type, fallbackUrl), { headers });
  }
}