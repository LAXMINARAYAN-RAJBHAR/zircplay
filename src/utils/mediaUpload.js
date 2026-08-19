/**
 * ZIXPLON — shared R2 media helper
 *
 * Drop this in src/utils/mediaUpload.js. Every upload flow (profile
 * picture, post images, video thumbnails) should go through
 * uploadToR2() instead of calling Cloudinary directly, and use
 * buildTransformUrl() instead of Cloudinary's transformation URL
 * builder.
 */

/**
 * Uploads a File or Blob to R2 via the /api/upload endpoint.
 * Mirrors what Cloudinary's upload widget used to return.
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