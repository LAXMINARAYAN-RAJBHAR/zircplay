/**
 * ZIXPLON media pipeline — Cloudflare Worker
 *
 * Serves images stored in R2, transforming them on-the-fly using query
 * params (mirrors what Cloudinary URLs used to do):
 *
 *   https://media.zixplon.in/uploads/abc123.jpg?w=400&h=225&fit=cover&format=webp&q=80
 *
 * Supported params:
 *   w        target width in px
 *   h        target height in px
 *   fit      "cover" (crop to fill) | "contain" (fit within, no crop)
 *   format   "webp" | "jpeg" | "png"  (default: webp)
 *   q        quality 1-100 for webp/jpeg (default: 80)
 *
 * Uses @cf-wasm/photon for image processing (pure Workers runtime, no
 * external service, no Cloudflare Images subscription needed).
 * Results are cached at the edge via the Cache API, so repeat requests
 * for the same transform are served without re-processing.
 */

import { PhotonImage, resize, SamplingFilter } from "@cf-wasm/photon";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.slice(1)); // strip leading "/"

    if (!key) {
      return new Response("Not found", { status: 404 });
    }

    // Only GET is supported — this Worker is read/serve only.
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Edge cache lookup first — avoids re-running the transform for
    // identical URLs (same key + same query params).
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    // Fetch the original from R2.
    const object = await env.MEDIA_BUCKET.get(key);
    if (!object) {
      return new Response("Image not found", { status: 404 });
    }

    // No transform params requested — stream the original back as-is.
    const hasTransform = ["w", "h", "format", "q", "fit"].some((p) =>
      url.searchParams.has(p)
    );
    if (!hasTransform) {
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      const response = new Response(object.body, { headers });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }

    const width = parseInt(url.searchParams.get("w") || "", 10) || null;
    const height = parseInt(url.searchParams.get("h") || "", 10) || null;
    const quality = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("q") || "80", 10))
    );
    const format = (url.searchParams.get("format") || "webp").toLowerCase();
    const fit = (url.searchParams.get("fit") || "cover").toLowerCase();

    let inputBytes;
    try {
      inputBytes = new Uint8Array(await object.arrayBuffer());
    } catch (err) {
      return new Response("Failed to read source image", { status: 500 });
    }

    let photonImage;
    try {
      photonImage = PhotonImage.new_from_byteslice(inputBytes);

      if (width || height) {
        const originalW = photonImage.get_width();
        const originalH = photonImage.get_height();
        const targetW = width || Math.round((height / originalH) * originalW);
        const targetH = height || Math.round((width / originalW) * originalH);

        const filter =
          fit === "contain" ? SamplingFilter.Triangle : SamplingFilter.Lanczos3;

        const resized = resize(photonImage, targetW, targetH, filter);
        photonImage.free();
        photonImage = resized;
      }

      let outputBytes;
      let contentType;
      switch (format) {
        case "jpeg":
        case "jpg":
          outputBytes = photonImage.get_bytes_jpeg(quality);
          contentType = "image/jpeg";
          break;
        case "png":
          outputBytes = photonImage.get_bytes();
          contentType = "image/png";
          break;
        case "webp":
        default:
          outputBytes = photonImage.get_bytes_webp();
          contentType = "image/webp";
          break;
      }

      const response = new Response(outputBytes, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Pipeline": "r2-photon",
        },
      });

      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (err) {
      return new Response(`Image processing failed: ${err.message}`, {
        status: 500,
      });
    } finally {
      photonImage?.free?.();
    }
  },
};