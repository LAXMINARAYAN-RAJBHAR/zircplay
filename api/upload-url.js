/**
 * ZIXPLON — Vercel serverless endpoint: presigned R2 upload URL
 *
 * Generic presign endpoint for any attachment that's too large (or too
 * variable in type) to stream through a Vercel function body — video,
 * voice notes, and chat/message file attachments all go through here.
 * The client asks for a short-lived, authorized PUT URL, then uploads
 * directly to R2.
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

// R2 supports single-PUT objects up to 5GiB. This is a shared ceiling
// across video, voice notes, and file attachments.
const MAX_BYTES = 4 * 1024 * 1024 * 1024; // 4GB
const URL_EXPIRY_SECONDS = 60 * 30; // 30 min — generous for slow uploads

// Used only to pick a sensible stored filename extension — this is NOT
// an allow-list. We accept any contentType; this just prefers the
// original file's extension when we recognize it, and falls back to
// deriving one from contentType otherwise.
const KNOWN_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "gif",
  "mp4", "webm", "mov", "mkv", "m4v",
  "m4a", "mp3", "ogg", "wav",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "zip", "rar", "csv",
]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // TODO: verify the caller is an authenticated ZIXPLON user (e.g. a
  // Supabase session/JWT in the Authorization header) before issuing a
  // signed URL — right now anyone who finds this endpoint can get a
  // valid R2 PUT URL. This got more urgent now that this endpoint also
  // accepts arbitrary attachment types, not just video.

  const { contentType, fileSize, fileName } = req.body || {};

  if (!contentType || typeof contentType !== "string") {
    return res.status(400).json({ error: "contentType is required" });
  }

  if (!fileSize || typeof fileSize !== "number") {
    return res.status(400).json({ error: "fileSize is required" });
  }

  if (fileSize > MAX_BYTES) {
    return res.status(413).json({
      error: `File too large (max ${MAX_BYTES / (1024 * 1024 * 1024)}GB)`,
    });
  }

  try {
    const rawExt = (fileName || "").split(".").pop()?.toLowerCase();
    const ext =
      rawExt && KNOWN_EXTENSIONS.has(rawExt)
        ? rawExt
        : (contentType.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "") || "bin";

    const key = `attachments/${randomUUID()}.${ext}`;

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