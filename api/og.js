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

  const headers = {
    "content-type": "text/html",
    "cache-control": "public, max-age=3600, s-maxage=3600",
  };

  // Generic fallback redirect target — used only if lookup fails entirely.
  const genericFallbackUrl = "https://zixplon.in";

  if (!id || !type) {
    return new Response(fallbackHtml(type || "post", genericFallbackUrl), { headers });
  }

  try {
    let title, description, image, url;

    if (type === "post") {
      // Posts use real uuid ids — unchanged.
      const res = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(id)}&select=*`,
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
        return new Response(fallbackHtml(type, `https://zixplon.in/feed`), { headers });
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
      // Video/reel: match on EITHER the real internal id or short_id,
      // since our live URLs (/video/:id, /reels/db_:id) use the real
      // id, but some rows may only have short_id populated.
      const table = type === "reel" ? "reels" : "videos";
      const res = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/${table}?or=(id.eq.${encodeURIComponent(id)},short_id.eq.${encodeURIComponent(id)})&select=*`,
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
        return new Response(fallbackHtml(type, genericFallbackUrl), { headers });
      }

      title = item?.title || "Watch on ZIXPLON";
      description = item?.description || item?.channel || "Watch videos and reels on ZIXPLON";
      image =
        item?.thumbnail_url ||
        item?.thumbnail ||
        getVideoThumbnail(item?.video_url) ||
        "https://zixplon.in/logo192.png";

      // Internal route still uses the REAL id — reels keep their existing
      // `db_<id>` convention, videos keep their plain numeric id.
      url =
        type === "reel"
          ? `https://zixplon.in/reels/db_${item.id}`
          : `https://zixplon.in/video/${item.id}`;
    }

    return new Response(renderHtml({ type, title, description, image, url }), { headers });
  } catch (err) {
    console.error("og handler error:", err);
    return new Response(fallbackHtml(type, genericFallbackUrl), { headers });
  }
}