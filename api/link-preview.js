// /api/link-preview.js
// Vercel Edge Function — fetches Open Graph metadata for any pasted URL
// so post links show a real title/description/thumbnail instead of a
// generic "Link from <domain>" card.
//
// Usage: GET /api/link-preview?url=<encoded url>

export const config = { runtime: "edge" };

const YOUTUBE_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"];

function stripWww(hostname) {
  return hostname.replace(/^www\./, "");
}

function getAttr(tag, attr) {
  const re = new RegExp(attr + '\\s*=\\s*["\']([^"\']*)["\']', "i");
  const match = tag.match(re);
  return match ? match[1] : null;
}

function decodeEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractMeta(html) {
  const metaTags = [...html.matchAll(/<meta\s+[^>]*>/gi)].map((m) => m[0]);
  const result = {};

  for (const tag of metaTags) {
    const property = getAttr(tag, "property") || getAttr(tag, "name");
    const content = getAttr(tag, "content");
    if (!property || !content) continue;

    const key = property.toLowerCase();
    if ((key === "og:title" || key === "twitter:title") && !result.title) {
      result.title = decodeEntities(content);
    }
    if ((key === "og:description" || key === "twitter:description" || key === "description") && !result.description) {
      result.description = decodeEntities(content);
    }
    if ((key === "og:image" || key === "og:image:secure_url" || key === "twitter:image") && !result.image) {
      result.image = content;
    }
    if (key === "og:site_name" && !result.siteName) {
      result.siteName = decodeEntities(content);
    }
  }

  if (!result.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) result.title = decodeEntities(titleMatch[1].trim());
  }

  return result;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return jsonResponse({ error: "Missing url parameter" }, 400);
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad protocol");
  } catch {
    return jsonResponse({ error: "Invalid URL" }, 400);
  }

  const domain = stripWww(parsed.hostname);
  const fallback = {
    url: parsed.toString(),
    domain,
    title: `Link from ${domain}`,
    desc: parsed.toString(),
    image: null,
  };

  // ── YouTube fast path: their oEmbed endpoint is public, fast, and far
  // more reliable than scraping the watch page for meta tags. ──
  if (YOUTUBE_HOSTS.includes(parsed.hostname.toLowerCase())) {
    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.toString())}&format=json`
      );
      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        return jsonResponse({
          url: parsed.toString(),
          domain,
          title: oembed.title || fallback.title,
          desc: oembed.author_name ? `by ${oembed.author_name}` : parsed.toString(),
          image: oembed.thumbnail_url || null,
        });
      }
    } catch {
      // fall through to generic OG scraping below
    }
  }

  // ── Generic path: fetch the page and parse Open Graph / Twitter meta tags.
  // Note: some sites (Instagram, Facebook, X/Twitter) actively block
  // server-side scraping without login, so those may fall back to a plain
  // domain card even though the request itself succeeds. ──
  try {
    const res = await fetch(parsed.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ZixplonLinkPreview/1.0; +https://zixplon.in)",
      },
      redirect: "follow",
    });

    const contentType = res.headers.get("content-type") || "";
    if (!res.ok || !contentType.includes("text/html")) {
      return jsonResponse(fallback);
    }

    const html = await res.text();
    const meta = extractMeta(html.slice(0, 150000)); // cap for performance

    return jsonResponse({
      url: parsed.toString(),
      domain,
      title: meta.title || fallback.title,
      desc: meta.description || fallback.desc,
      image: meta.image || null,
    });
  } catch {
    return jsonResponse(fallback);
  }
}