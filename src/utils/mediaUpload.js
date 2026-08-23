/**
 * ZIXPLON — shared R2 media helper
 *
 * Every upload flow should go through one of these instead of calling
 * Cloudinary directly:
 *
 *   uploadToR2()          — small files streamed through a Vercel
 *                            function body (profile pics, post images,
 *                            video thumbnails). Not suitable for large
 *                            files — Vercel's function body size limit
 *                            applies.
 *
 *   uploadVideoToR2()      — video specifically, via presigned URL.
 *
 *   uploadAttachmentToR2() — any Messages/chat attachment (image,
 *                            video, voice note, document) via the same
 *                            presigned-URL pattern, since attachments
 *                            can be any type/size up to 25MB and can't
 *                            reliably go through a Vercel function body.
 *
 * buildTransformUrl() replaces Cloudinary's transformation URL builder.
 */

/**
 * Uploads a File or Blob to R2 via the /api/upload endpoint.
 * Small files only (images/thumbnails) — see uploadVideoToR2 /
 * uploadAttachmentToR2 for anything that might exceed a few MB.
 *
 * @param {File|Blob} file
 * @param {(percent: number) => void} [onProgress]
 * @returns {Promise<{ key: string, url: string }>}
 */
export async function uploadToR2(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (err) {
          reject(new Error("Invalid response from upload endpoint"));
        }
      } else {
        try {
          const errBody = JSON.parse(xhr.responseText);
          reject(new Error(errBody.error || `Upload failed (${xhr.status})`));
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

/**
 * Shared implementation behind uploadVideoToR2 and uploadAttachmentToR2:
 * gets a presigned PUT URL from /api/upload-url, then PUTs the file
 * bytes straight to R2, bypassing the Vercel function body entirely.
 *
 * @param {File} file
 * @param {(percent: number) => void} [onProgress]
 * @returns {Promise<{ key: string, url: string }>}
 */
async function presignAndUpload(file, onProgress) {
  const presignRes = await fetch("/api/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contentType: file.type || "application/octet-stream",
      fileSize: file.size,
      fileName: file.name,
    }),
  });

  if (!presignRes.ok) {
    let message = `Failed to get upload URL (${presignRes.status})`;
    try {
      const body = await presignRes.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore — non-JSON error body
    }
    throw new Error(message);
  }

  const { uploadUrl, key, url } = await presignRes.json();

  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload to R2 failed (${xhr.status})`));
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });

  return { key, url };
}

/**
 * Uploads a video File directly to R2 via a presigned URL.
 * @param {File} file
 * @param {(percent: number) => void} [onProgress]
 * @returns {Promise<{ key: string, url: string }>}
 */
export async function uploadVideoToR2(file, onProgress) {
  return presignAndUpload(file, onProgress);
}

/**
 * Uploads any Messages/chat attachment (image, video, voice note, or
 * document) directly to R2 via a presigned URL. Use this in place of
 * Cloudinary for MessagesPanel / GroupChatWindow / BroadcastComposeWindow.
 * @param {File} file
 * @param {(percent: number) => void} [onProgress]
 * @returns {Promise<{ key: string, url: string }>}
 */
export async function uploadAttachmentToR2(file, onProgress) {
  return presignAndUpload(file, onProgress);
}

/**
 * Builds a transformed image URL from a base R2 media URL.
 *
 * NOTE on `format`: this defaults to "webp" for general-purpose image
 * use (avatars, banners, post images), since webp is smaller and every
 * modern browser renders it fine as a normal <img>. BUT: anything that
 * will be used as an og:image for shared links (video/reel thumbnails
 * in particular) must explicitly pass format: "jpeg" — WhatsApp's
 * link-preview crawler does not render webp og:image and will just
 * show no image at all (title/description still show up fine, which
 * makes this bug easy to miss). See PRESETS.videoThumbnail below.
 *
 * @param {string} baseUrl
 * @param {object} opts
 * @param {number} [opts.width]
 * @param {number} [opts.height]
 * @param {"cover"|"contain"} [opts.fit="cover"]
 * @param {"webp"|"jpeg"|"png"} [opts.format="webp"]
 * @param {number} [opts.quality=80]
 * @returns {string}
 */
export function buildTransformUrl(baseUrl, opts = {}) {
  const { width, height, fit = "cover", format = "webp", quality = 80 } = opts;
  const url = new URL(baseUrl);

  if (width) url.searchParams.set("w", width);
  if (height) url.searchParams.set("h", height);
  if (fit) url.searchParams.set("fit", fit);
  if (format) url.searchParams.set("format", format);
  if (quality) url.searchParams.set("q", quality);

  return url.toString();
}

// Common presets so components don't repeat the same width/height everywhere.
// NOTE: videoThumbnail is intentionally "jpeg", not "webp". These
// thumbnails get used as og:image for shared links, and WhatsApp's
// link-preview crawler does not render webp — it silently shows no
// image at all (title/description still work, image doesn't). jpeg
// is safe across WhatsApp, Facebook, Twitter, etc.
export const PRESETS = {
  avatar: { width: 150, height: 150, fit: "cover", format: "webp" },
  banner: { width: 1200, height: 300, fit: "cover", format: "webp" },
  postImage: { width: 800, format: "webp", quality: 85 },
  videoThumbnail: { width: 400, height: 225, fit: "cover", format: "jpeg" },
};