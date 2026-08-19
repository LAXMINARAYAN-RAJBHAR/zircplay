/**
 * ZIXPLON — Vercel serverless endpoint: presigned R2 upload URL
 *
 * For large files (video) that can't be streamed through a Vercel
 * serverless function body, the client asks this endpoint for a
 * short-lived, authorized PUT URL, then uploads directly to R2.
 *
 * Required env vars (same R2 credentials already used by api/upload.js):
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   R2_PUBLIC_HOST   e.g. media.zixplon.in
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "video/x-m4v",
]);

const EXT_BY_TYPE = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
  "video/x-m4v": "m4v",
};

// R2 supports single-PUT objects up to 5GiB. Keep this at/under your
// existing client-side video size cap.
const MAX_VIDEO_BYTES = 4 * 1024 * 1024 * 1024; // 4GB
const URL_EXPIRY_SECONDS = 60 * 30; // 30 min — generous for slow uploads

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // TODO: this is also the right place to check the caller is an
  // authenticated ZIXPLON user (e.g. verify a Supabase session/JWT
  // passed in the Authorization header) before issuing a signed URL —
  // otherwise anyone who finds this endpoint can get a valid R2 PUT URL.
  // Wire that check in here once your auth token format is settled.

  const { contentType, fileSize } = req.body || {};

  if (!contentType || !ALLOWED_VIDEO_TYPES.has(contentType)) {
    return res.status(400).json({
      error: `Unsupported video content type: ${contentType}`,
    });
  }

  if (!fileSize || typeof fileSize !== "number") {
    return res.status(400).json({ error: "fileSize is required" });
  }

  if (fileSize > MAX_VIDEO_BYTES) {
    return res.status(413).json({
      error: `File too large (max ${MAX_VIDEO_BYTES / (1024 * 1024 * 1024)}GB)`,
    });
  }

  try {
    const ext = EXT_BY_TYPE[contentType] || "mp4";
    const key = `videos/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: URL_EXPIRY_SECONDS,
    });

    const publicUrl = `https://${process.env.R2_PUBLIC_HOST}/${key}`;

    return res.status(200).json({ uploadUrl, key, url: publicUrl });
  } catch (err) {
    console.error("R2 presign error:", err);
    return res.status(500).json({ error: "Failed to create upload URL" });
  }
}