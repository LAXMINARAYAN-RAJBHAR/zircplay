/**
 * ZIXPLON — Vercel serverless upload endpoint
 *
 * Receives a raw file upload and pushes it to Cloudflare R2 as the
 * original (untransformed) asset. The media Worker (worker.js) then
 * serves resized/converted versions of this file on request.
 *
 * Required env vars (set in Vercel project settings):
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   R2_PUBLIC_HOST   e.g. media.zixplon.in (the Worker's custom domain)
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 25 * 1024 * 1024; // 25MB per image upload

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const contentType = req.headers["content-type"] || "";
  if (!ALLOWED_TYPES.has(contentType)) {
    return res.status(400).json({
      error: `Unsupported content type: ${contentType}`,
    });
  }

  try {
    const chunks = [];
    let totalBytes = 0;

    for await (const chunk of req) {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BYTES) {
        return res.status(413).json({ error: "File too large (max 25MB)" });
      }
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    const ext = contentType.split("/")[1] === "jpeg" ? "jpg" : contentType.split("/")[1];
    const key = `uploads/${randomUUID()}.${ext}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    const publicUrl = `https://${process.env.R2_PUBLIC_HOST}/${key}`;

    return res.status(200).json({ key, url: publicUrl });
  } catch (err) {
    console.error("R2 upload error:", err);
    return res.status(500).json({ error: "Upload failed" });
  }
}