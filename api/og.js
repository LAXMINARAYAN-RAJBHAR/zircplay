export const config = { runtime: "edge" };

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// CHANGED: this used to attempt a Cloudinary-only URL transform
// (`/upload/so_0/....jpg`) to pull a frame out of a video URL when no
// stored thumbnail existed. Since the app migrated video/reel/post-video
// uploads to Cloudflare R2 (uploadVideoToR2 in utils/mediaUpload.js),
// video_url values no longer contain "/upload/" and never matched — this
// was silently dead code for every content type. R2 (plain object
// storage) has no equivalent built-in "grab me a frame" URL transform,
// so there is currently no way to derive a thumbnail from the video URL
// alone at request time. Kept as a named no-op (rather than deleted
// outright) so it's obvious where to plug in a real transform if/when
// one becomes available (e.g. a Cloudflare Stream thumbnail endpoint, or
// a dedicated thumbnail-generation worker) — see the comment at each
// call site below for what would need to change.
function getVideoThumbnailFromCloudinaryUrl(videoUrl) {
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

// Explicit allow-list — a typo or a future new content type fails loudly
// (fallback card) instead of silently matching whatever the `else`
// branch happened to do.
const ALLOWED_TYPES = ["post", "reel", "video"];

// CHANGED: was a bare string repeated in three places. Pulled into one
// constant so there's a single source of truth, and documented here
// rather than left implicit: logo192.png is a square PWA icon, NOT a
// proper Open Graph image. Most platforms (WhatsApp, Facebook, iMessage,
// Discord) expect roughly a 1200x630 landscape image and will crop or
// awkwardly letterbox a square icon. If share-preview quality matters
// beyond "an image shows up at all", replace this with a real branded
// 1200x630 asset hosted at a stable URL, e.g.
// "https://zixplon.in/og-fallback.jpg".
const FALLBACK_OG_IMAGE = "https://zixplon.in/logo192.png";

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
    image: FALLBACK_OG_IMAGE,
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

  // Much shorter cache for anything that ISN'T a confirmed content hit
  // (missing params, unknown type, row not found, lookup error) — lets
  // a freshly-created/shared item self-correct within a minute instead
  // of serving the fallback card for up to an hour.
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
      // CHANGED: added item?.thumbnail_url ahead of the dead Cloudinary
      // fallback. PostComposer.jsx now captures and uploads a real
      // thumbnail for video posts at upload time (same approach
      // VideoUpload.jsx already used for videos/reels) and stores it in
      // posts.thumbnail_url — see PostComposer.jsx changes. Requires the
      // migration: alter table posts add column thumbnail_url text;
      image =
        item?.image_url ||
        item?.image_urls?.[0] ||
        item?.thumbnail_url ||
        getVideoThumbnailFromCloudinaryUrl(item?.video_url) ||
        FALLBACK_OG_IMAGE;
      url = `https://zixplon.in/feed?post=${id}`;
    } else {
      // Video/reel: match on EITHER the real internal id or short_id,
      // since our live URLs (/video/:id, /reels/db_:id) use the real
      // id, but some rows may only have short_id populated.
      //
      // `id` is a uuid column, so trying `id.eq.<value>` with a value
      // that isn't a valid UUID (e.g. an alphanumeric short_id like
      // "b1bZGDMmzY") makes Postgres throw a type-cast error — which
      // fails the WHOLE OR query, even though `short_id.eq.` alone would
      // have matched fine. So: only include the id.eq. comparison when
      // the requested id actually looks like a UUID.
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
      // CHANGED: the Cloudinary URL transform never matches post-R2-
      // migration video_url values (see getVideoThumbnailFromCloudinaryUrl
      // above) — it's kept as a documented no-op rather than silently
      // dead code. The real fix for videos/reels landing here is making
      // sure thumbnail_url/thumbnail gets reliably populated at upload
      // time (VideoUpload.jsx's captureThumbnail) — this handler can
      // only display what's already stored, it can't generate a frame
      // from an R2 URL on its own.
      image =
        item?.thumbnail_url ||
        item?.thumbnail ||
        getVideoThumbnailFromCloudinaryUrl(item?.video_url) ||
        FALLBACK_OG_IMAGE;

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