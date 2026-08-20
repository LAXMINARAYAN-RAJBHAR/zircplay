// /api/link-preview.js
// Vercel Edge Function — fetches Open Graph / oEmbed metadata for any
// pasted URL so post links show a real title/description/thumbnail.
//
// Strategy, in order:
//   1. Known-provider oEmbed fast path (YouTube, Vimeo, Dailymotion,
//      SoundCloud, TikTok, Reddit, Spotify, CodePen) — most reliable
//      source for these, and avoids bot-blocking entirely since these
//      are public, unauthenticated JSON APIs made for exactly this.
//   2. Generic fetch of the page + parse of Open Graph / Twitter meta
//      tags, PLUS oEmbed discovery via <link rel="alternate"
//      type="application/json+oembed"> if the page advertises one
//      (this covers many sites not in the hardcoded provider list).
//   3. Plain domain-card fallback if nothing else worked.
//
// Every response now also carries imageWidth/imageHeight (null if the
// source didn't provide them) so the client can reserve layout space
// for the preview image before it loads, instead of the image "popping
// in" and shifting content below it.
//
// Usage: GET /api/link-preview?url=<encoded url>

export const config = { runtime: "edge" };

// ── Known oEmbed providers ──────────────────────────────────────────────
// Each entry: hosts to match, and a function building the oEmbed request
// URL. All of these are public, no-auth-required oEmbed endpoints.
const OEMBED_PROVIDERS = [
  {
    name: "youtube",
    hosts: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
    endpoint: (url) => `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
  },
  {
    name: "vimeo",
    hosts: ["vimeo.com", "www.vimeo.com", "player.vimeo.com"],
    endpoint: (url) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
  },
  {
    name: "dailymotion",
    hosts: ["dailymotion.com", "www.dailymotion.com", "dai.ly"],
    endpoint: (url) => `https://www.dailymotion.com/services/oembed?url=${encodeURIComponent(url)}&format=json`,
  },
  {
    name: "soundcloud",
    hosts: ["soundcloud.com", "www.soundcloud.com"],
    endpoint: (url) => `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  },
  {
    name: "tiktok",
    hosts: ["tiktok.com", "www.tiktok.com"],
    endpoint: (url) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
  },
  {
    name: "reddit",
    hosts: ["reddit.com", "www.reddit.com", "old.reddit.com"],
    endpoint: (url) => `https://www.reddit.com/oembed?url=${encodeURIComponent(url)}`,
  },
  {
    name: "spotify",
    hosts: ["open.spotify.com"],
    endpoint: (url) => `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
  },
  {
    name: "codepen",
    hosts: ["codepen.io"],
    endpoint: (url) => `https://codepen.io/api/oembed?url=${encodeURIComponent(url)}&format=json`,
  },
];

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// ── Fetch timeout wrapper ──────────────────────────────────────────────
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

function resolveUrl(maybeRelative, baseUrl) {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return null;
  }
}

// Parses a meta tag's content as a positive integer, returning null for
// anything non-numeric/zero/negative — a malformed or absent dimension
// should behave the same as "not provided" to the client.
function parseDimension(str) {
  if (!str) return null;
  const n = parseInt(str, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractMeta(html, baseUrl) {
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
      result.image = resolveUrl(content, baseUrl);
    }
    // NEW: capture declared image dimensions when the page provides
    // them, so the client can reserve layout space up front instead of
    // the preview image popping in and shifting content below it.
    if (key === "og:image:width" && !result.imageWidth) {
      result.imageWidth = parseDimension(content);
    }
    if (key === "og:image:height" && !result.imageHeight) {
      result.imageHeight = parseDimension(content);
    }
    if (key === "og:site_name" && !result.siteName) {
      result.siteName = decodeEntities(content);
    }
  }

  if (!result.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) result.title = decodeEntities(titleMatch[1].trim());
  }

  // ── oEmbed discovery: many sites (not just the hardcoded providers
  // above) advertise an oEmbed endpoint via a <link> tag. If present,
  // the caller can fetch it as a secondary pass to fill in gaps
  // (especially thumbnail_url, which some sites omit from og:image). ──
  const oembedLinkMatch = html.match(
    /<link[^>]+type=["']application\/json\+oembed["'][^>]*>/i
  );
  if (oembedLinkMatch) {
    result.oembedUrl = resolveUrl(getAttr(oembedLinkMatch[0], "href"), baseUrl);
  }

  return result;
}

function findProvider(hostname) {
  const host = hostname.toLowerCase();
  return OEMBED_PROVIDERS.find((p) => p.hosts.includes(host));
}

async function tryOembed(endpointUrl) {
  try {
    const res = await fetchWithTimeout(endpointUrl, { headers: BROWSER_HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
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
    imageWidth: null,
    imageHeight: null,
  };

  // ── 1) Known-provider oEmbed fast path ──
  const provider = findProvider(parsed.hostname);
  if (provider) {
    const data = await tryOembed(provider.endpoint(parsed.toString()));
    if (data) {
      return jsonResponse({
        url: parsed.toString(),
        domain,
        title: data.title || fallback.title,
        desc: data.author_name ? `by ${data.author_name}` : parsed.toString(),
        image: data.thumbnail_url || null,
        // oEmbed responses commonly include these directly — no need to
        // guess or fetch anything extra to get accurate dimensions.
        imageWidth: parseDimension(data.thumbnail_width),
        imageHeight: parseDimension(data.thumbnail_height),
      });
    }
    // fall through to generic path if the provider's oEmbed call failed
  }

  // ── 2) Generic fetch + OG parsing (+ oEmbed discovery) ──
  try {
    const res = await fetchWithTimeout(parsed.toString(), {
      headers: BROWSER_HEADERS,
      redirect: "follow",
    });

    const contentType = res.headers.get("content-type") || "";
    if (!res.ok || !contentType.includes("html")) {
      return jsonResponse(fallback);
    }

    const html = await res.text();
    const meta = extractMeta(html.slice(0, 200000), parsed.toString()); // cap for performance

    let image = meta.image || null;
    let title = meta.title || fallback.title;
    let desc = meta.description || fallback.desc;
    let imageWidth = meta.imageWidth || null;
    let imageHeight = meta.imageHeight || null;

    // If the page advertises an oEmbed endpoint and we're still missing
    // an image, try it — this fills in a lot of the "site not in our
    // provider list" gaps (WordPress sites, Flickr, many blogs, etc.)
    if (!image && meta.oembedUrl) {
      const oembedData = await tryOembed(meta.oembedUrl);
      if (oembedData) {
        image = oembedData.thumbnail_url || image;
        title = oembedData.title || title;
        imageWidth = parseDimension(oembedData.thumbnail_width) || imageWidth;
        imageHeight = parseDimension(oembedData.thumbnail_height) || imageHeight;
      }
    }

    return jsonResponse({
      url: parsed.toString(),
      domain,
      title,
      desc,
      image,
      imageWidth,
      imageHeight,
    });
  } catch {
    return jsonResponse(fallback);
  }
}