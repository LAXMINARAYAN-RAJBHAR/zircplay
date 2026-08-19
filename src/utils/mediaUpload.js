/**
 * ZIXPLON — shared R2 media helper
 *
 * Drop this in src/utils/mediaUpload.js. Every upload flow (profile
 * picture, post images, video thumbnails) should go through
 * uploadToR2() instead of calling Cloudinary directly, and use
 * buildTransformUrl() instead of Cloudinary's transformation URL
 * builder.
 *
 * Video files (too large to stream through a Vercel function body)
 * go through uploadVideoToR2() instead — it fetches a presigned PUT
 * URL from /api/upload-url, then uploads directly to R2.
 */

/**
 * Uploads a File or Blob to R2 via the /api/upload endpoint.
 * Mirrors what Cloudinary's upload widget used to return.
 * Use for small files only (images/thumbnails) — see uploadVideoToR2
 * for video.
 *
 * @param {File|Blob} file - the image file/blob to upload
 * @param {(percent: number) => void} [onProgress] - optional progress callback (0-100)
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
 * Uploads a video File directly to R2 via a presigned URL, bypassing
 * the Vercel function body entirely (Vercel's request size limit is
 * far smaller than typical video files).
 *
 * Two-step flow:
 *   1. POST /api/upload-url with { contentType, fileSize } to get a
 *      short-lived signed PUT URL + the eventual public URL.
 *   2. PUT the raw file bytes straight to that signed URL.
 *
 * @param {File} file - the video file to upload
 * @param {(percent: number) => void} [onProgress] - optional progress callback (0-100)
 * @returns {Promise<{ key: string, url: string }>}
 */
export async function uploadVideoToR2(file, onProgress) {
  // Step 1: get a presigned upload URL
  const presignRes = await fetch("/api/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contentType: file.type || "video/mp4",
      fileSize: file.size,
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

  // Step 2: PUT the file straight to R2
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Video upload to R2 failed (${xhr.status})`));
    };

    xhr.onerror = () => reject(new Error("Network error during video upload"));
    xhr.send(file);
  });

  return { key, url };
}

/**
 * Builds a transformed image URL from a base R2 media URL.
 * Replaces Cloudinary's transformation URL syntax.
 *
 * @param {string} baseUrl - the url returned by uploadToR2()
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
export const PRESETS = {
  avatar: { width: 150, height: 150, fit: "cover", format: "webp" },
  banner: { width: 1200, height: 300, fit: "cover", format: "webp" },
  postImage: { width: 800, format: "webp", quality: 85 },
  videoThumbnail: { width: 400, height: 225, fit: "cover", format: "webp" },
};