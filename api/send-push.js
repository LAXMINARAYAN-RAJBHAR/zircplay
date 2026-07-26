// api/send-push.js
//
// Configured as the target of TWO Supabase Database Webhooks:
//   1. INSERT on direct_messages
//   2. INSERT on notifications   (likes, comments, follows, etc.)
//
// Supabase sends a payload shaped like:
//   { type: "INSERT", table: "notifications", record: {...}, schema: "public" }
//
// Required Vercel env vars:
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT              e.g. "mailto:you@zixplon.app"
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  (service role — bypasses RLS, server-only, NEVER exposed to client)

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Maps a notifications.content_type value to a route in your app.
// Adjust these paths if your routes differ.
function urlForContent(contentType, contentId) {
  switch (contentType) {
    case "reel":
      return `/reels/${contentId}`;
    case "video":
      return `/video/${contentId}`;
    case "post":
      return `/feed?post=${contentId}`;
    default:
      return "/notifications";
  }
}

// Builds the { title, body, url, tag } payload for each event type.
function buildNotificationPayload(table, record) {
  if (table === "direct_messages") {
    return {
      title: `New message from ${record.sender_username}`,
      body: record.text
        ? record.text.slice(0, 120)
        : record.attachment_type === "image"
          ? "📷 Sent a photo"
          : record.attachment_type === "video"
            ? "🎥 Sent a video"
            : "📎 Sent an attachment",
      url: `/?openMessages=${record.sender_username}`,
      tag: `dm-${record.conversation_id}`,
    };
  }

  if (table === "notifications") {
    return {
      title: "ZIXPLON",
      // Your notifications table already stores a ready-made message —
      // use it directly instead of reconstructing one.
      body: record.message || `${record.sender_username} sent you a notification`,
      url: urlForContent(record.content_type, record.content_id),
      tag: `notif-${record.type}-${record.sender_username}-${record.content_id || ""}`,
    };
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { table, record } = req.body;

    let recipientUsername = null;

    if (table === "direct_messages") {
      // direct_messages has no recipient_username column — resolve it
      // via the conversations table (user_a / user_b).
      const { data: convo } = await supabaseAdmin
        .from("conversations")
        .select("user_a, user_b")
        .eq("id", record.conversation_id)
        .maybeSingle();

      if (convo) {
        recipientUsername =
          convo.user_a === record.sender_username ? convo.user_b : convo.user_a;
      }
    } else if (table === "notifications") {
      recipientUsername = record.recipient_username;
    }

    if (!recipientUsername) {
      return res.status(200).json({ skipped: "no recipient resolved" });
    }

    // Don't push a notification to yourself (e.g. liking your own post,
    // if that ever inserts a row)
    if (
      table === "notifications" &&
      recipientUsername === record.sender_username
    ) {
      return res.status(200).json({ skipped: "self-notification" });
    }

    const payload = buildNotificationPayload(table, record);
    if (!payload) {
      return res.status(200).json({ skipped: "unhandled table" });
    }

    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .eq("username", recipientUsername);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return res.status(200).json({ skipped: "no subscriptions for user" });
    }

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            url: payload.url,
            tag: payload.tag,
          }),
        ),
      ),
    );

    // Clean up subscriptions that are no longer valid (expired/revoked)
    const deadEndpoints = [];
    results.forEach((r, i) => {
      if (
        r.status === "rejected" &&
        (r.reason?.statusCode === 404 || r.reason?.statusCode === 410)
      ) {
        deadEndpoints.push(subs[i].endpoint);
      }
    });
    if (deadEndpoints.length > 0) {
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .in("endpoint", deadEndpoints);
    }

    return res.status(200).json({
      sent: results.filter((r) => r.status === "fulfilled").length,
      failed: results.filter((r) => r.status === "rejected").length,
    });
  } catch (err) {
    console.error("send-push error:", err);
    return res.status(500).json({ error: err.message });
  }
}