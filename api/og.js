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
  // Cloudinary: grab a frame at 0s and serve it as a jpg
  if (videoUrl.includes("/upload/")) {
    return videoUrl
      .replace("/upload/", "/upload/so_0/")
      .replace(/\.\w+(\?.*)?$/, ".jpg");
  }
  return null;
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  try {
    let title, description, image, url;

    if (type === "post") {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/posts?id=eq.${id}&select=*`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await res.json();
      const item = data?.[0];

      title = item?.username ? `${item.username} on ZIXPLON` : "Post on ZIXPLON";
      description = item?.text?.slice(0, 200) || "Check out this post on ZIXPLON";
      image =
        item?.image_url ||
        item?.image_urls?.[0] ||
        getVideoThumbnail(item?.video_url) || // adjust field name if your video column is named differently
        "https://zixplon.in/logo192.png";
      url = `https://zixplon.in/feed?post=${id}`;
    } else {
      const table = type === "reel" ? "reels" : "videos";
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}&select=*`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await res.json();
      const item = data?.[0];

      title = item?.title || "Watch on ZIXPLON";
      description = item?.description || item?.channel || "Watch videos and reels on ZIXPLON";
      image =
        item?.thumbnail_url ||
        item?.thumbnail ||
        getVideoThumbnail(item?.video_url) ||
        "https://zixplon.in/logo192.png";
      url = `https://zixplon.in/${type === "reel" ? `reels/db_${id}` : `video/${id}`}`;
    }

    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description);
    const safeImage = escapeHtml(image);
    const safeUrl = escapeHtml(url);

    const html = `<!DOCTYPE html>
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

    return new Response(html, { headers: { "content-type": "text/html" } });

  } catch (err) {
    return new Response(`<p>Error: ${escapeHtml(err.message)}</p>`, {
      headers: { "content-type": "text/html" },
    });
  }
}