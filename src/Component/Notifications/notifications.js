// src/utils/notifications.js
//
// Shared helper for writing rows into the `notifications` table.
// Previously only PostFeed.jsx's local `notifySubscribers()` did this —
// likes, comments, subscribes, and video/reel uploads never wrote a
// notification row anywhere, which is why the bell only ever showed
// (or was supposed to show) new-post notifications and nothing else.
//
// Both helpers below now log any Supabase error instead of swallowing it
// silently, so an RLS problem or bad column name shows up in the console
// instead of just "nothing happens."

import { supabase } from "../config/supabase";

/**
 * Notify a single recipient (e.g. "someone liked/commented on your video").
 * No-ops if there's no recipient, or if the recipient is the actor
 * themselves (you don't need a notification for your own like/comment).
 */
export const notifyUser = async ({
  recipientUsername,
  senderUsername,
  type, // "like" | "comment" | "subscriber" | "upload" | ...
  message,
  contentId = null,
  contentType = null,
}) => {
  if (!recipientUsername) return;
  if (recipientUsername === senderUsername) return;

  // FIX: different call sites passed contentId as different types —
  // video.jsx/reels.jsx pass it as a string (from useParams / reel.id),
  // homePage.jsx was passing the raw (sometimes numeric) `id` straight
  // from Supabase. Stored inconsistently, this can make the destination
  // page's `String(v.id) === String(id)` match fail unpredictably,
  // which is exactly the "opens the wrong content" symptom. Coercing
  // once here, at the single place every notification gets written,
  // guarantees every content_id in the table is a plain string from now
  // on regardless of what the caller passed in.
  const normalizedContentId = contentId == null ? null : String(contentId);

  const { error } = await supabase.from("notifications").insert({
    recipient_username: recipientUsername,
    sender_username: senderUsername,
    type,
    message,
    is_read: false,
    content_id: normalizedContentId,
    content_type: contentType,
  });

  if (error) {
    console.error(`[notifications] Failed to insert "${type}" notification:`, error);
  }
};

/**
 * Notify every subscriber of `uploaderUsername` (e.g. "X uploaded a new
 * video/reel/post"). Mirrors the uuid-vs-username resolution that used to
 * live only inside PostFeed.jsx, now shared so video/reel uploads and
 * posts all use the same logic.
 */
export const notifySubscribers = async (
  uploaderUsername,
  { type, message, contentId = null, contentType = null },
) => {
  if (!uploaderUsername) return;

  const { data: subRows, error: subErr } = await supabase
    .from("subscriptions")
    .select("subscriber_id")
    .eq("subscribed_to", uploaderUsername);

  if (subErr) {
    console.error("[notifications] Failed to load subscribers:", subErr);
    return;
  }
  if (!subRows || subRows.length === 0) return;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const uuidIds = [
    ...new Set(
      subRows.filter((s) => uuidRegex.test(s.subscriber_id)).map((s) => s.subscriber_id),
    ),
  ];

  let idToUsername = {};
  if (uuidIds.length > 0) {
    const { data: profilesData, error: profErr } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", uuidIds);
    if (profErr) {
      console.error("[notifications] Failed to resolve subscriber usernames:", profErr);
    }
    profilesData?.forEach((p) => {
      if (p.username && p.username.trim()) idToUsername[p.id] = p.username;
    });
  }

  const recipientUsernames = [
    ...new Set(
      subRows
        .map((s) =>
          uuidRegex.test(s.subscriber_id) ? idToUsername[s.subscriber_id] : s.subscriber_id,
        )
        .filter(Boolean)
        .filter((u) => u !== uploaderUsername),
    ),
  ];

  if (recipientUsernames.length === 0) return;

  const normalizedContentId = contentId == null ? null : String(contentId);

  const notifications = recipientUsernames.map((recipient) => ({
    recipient_username: recipient,
    sender_username: uploaderUsername,
    type,
    message,
    is_read: false,
    content_id: normalizedContentId,
    content_type: contentType,
  }));

  const { error } = await supabase.from("notifications").insert(notifications);
  if (error) {
    console.error(`[notifications] Failed to notify subscribers ("${type}"):`, error);
  }
};