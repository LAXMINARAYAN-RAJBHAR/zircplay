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

// NEW: explicit allow-list. Previously any `type` that wasn't "post" or
// "reel" silently fell through to the `videos` table lookup — harmless
// today since nothing calls this with a bogus type, but it meant a typo
// or a future new content type would fail silently instead of loudly.
const ALLOWED_TYPES = ["post", "reel", "video"];

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

  // Normal cache — used for genuine content hits, where the underlying
  // row isn't expected to disappear or change identity within the hour.
  const headers = {
    "content-type": "text/html",
    "cache-control": "public, max-age=3600, s-maxage=3600",
  };

  // NEW: much shorter cache for anything that ISN'T a confirmed content
  // hit (missing params, unknown type, row not found, lookup error).
  // Previously these shared the same 1-hour cache as real hits, so a
  // freshly-created/shared video whose OG request raced ahead of the
  // DB write (or hit a transient error) could keep serving the generic
  // fallback card for up to an hour afterwards. 60s lets it self-correct
  // quickly while still absorbing repeat-crawler traffic.
  const notFoundHeaders = {
    "content-type": "text/html",
    "cache-control": "public, max-age=60, s-maxage=60",
  };

  // Generic fallback redirect target — used only if lookup fails entirely.
  const genericFallbackUrl = "https://zixplon.in";

  if (!id || !type) {
    return new Response(fallbackHtml(type || "post", genericFallbackUrl), {
      headers: notFoundHeaders,
    });
  }

  if (!ALLOWED_TYPES.includes(type)) {
    console.warn(`og handler: unknown type "${type}" for id "${id}"`);
    return new Response(fallbackHtml("post", genericFallbackUrl), {
      headers: notFoundHeaders,
    });
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
        return new Response(fallbackHtml(type, `https://zixplon.in/feed`), {
          headers: notFoundHeaders,
        });
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
      //
      // FIX: `id` is a uuid column, so trying `id.eq.<value>` with a
      // value that isn't a valid UUID (e.g. an alphanumeric short_id
      // like "b1bZGDMmzY") makes Postgres throw a type-cast error —
      // which fails the WHOLE OR query, even though `short_id.eq.`
      // alone would have matched fine. So: only include the id.eq.
      // comparison when the requested id actually looks like a UUID.
      //
      // Also note the standalone (non-OR) filter below uses
      // `short_id=eq.value` (an "=" separating column and operator) —
      // NOT `short_id.eq.value` (a "."). The dot form is only valid
      // *inside* an or(...) wrapper; used bare as a top-level query
      // param it isn't recognized by PostgREST and silently applies no
      // filter at all, which is what caused the wrong reel to be
      // returned in testing.
      const table = type === "reel" ? "reels" : "videos";
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUuid = UUID_RE.test(id);
      const filter = isUuid
        ? `or=(id.eq.${encodeURIComponent(id)},short_id.eq.${encodeURIComponent(id)})`
        : `short_id=eq.${encodeURIComponent(id)}`;

      const res = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/${table}?${filter}&select=*`,
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
        return new Response(fallbackHtml(type, genericFallbackUrl), {
          headers: notFoundHeaders,
        });
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
    return new Response(fallbackHtml(type, genericFallbackUrl), {
      headers: notFoundHeaders,
    });
  }
}