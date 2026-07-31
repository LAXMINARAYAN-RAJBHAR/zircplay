import { supabase } from "../config/supabase";

export const createBroadcastList = async ({ name, createdBy, recipientUsernames }) => {
  const { data: list, error: listError } = await supabase
    .from("broadcast_lists")
    .insert({ name, created_by: createdBy })
    .select()
    .single();

  if (listError || !list) throw listError || new Error("Failed to create broadcast list");

  const rows = recipientUsernames.map((username) => ({
    broadcast_id: list.id,
    username,
  }));

  const { error: recipientsError } = await supabase.from("broadcast_recipients").insert(rows);
  if (recipientsError) throw recipientsError;

  return list;
};

export const fetchUserBroadcastLists = async (username) => {
  const { data } = await supabase
    .from("broadcast_lists")
    .select("*, broadcast_recipients(username)")
    .eq("created_by", username)
    .order("created_at", { ascending: false });
  return data || [];
};

// Sends `text` (and/or an already-uploaded attachment) to every recipient
// on the broadcast list as a NORMAL 1:1 direct message — each recipient
// gets it in their regular inbox with no indication it was a broadcast,
// and recipients never see each other. Reuses the same
// find-or-create-conversation logic as a regular 1:1 send.
export const sendBroadcastMessage = async ({
  broadcastId,
  senderUsername,
  recipientUsernames,
  text,
  attachmentUrl,
  attachmentType,
  attachmentName,
  attachmentSize,
}) => {
  const results = await Promise.allSettled(
    recipientUsernames.map(async (recipient) => {
      const [user_a, user_b] = [senderUsername, recipient].sort();

      let { data: convo } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_a", user_a)
        .eq("user_b", user_b)
        .maybeSingle();

      if (!convo) {
        const { data: created } = await supabase
          .from("conversations")
          .insert({ user_a, user_b })
          .select()
          .single();
        convo = created;
      }
      if (!convo) throw new Error(`Could not resolve conversation with ${recipient}`);

      const { error: msgError } = await supabase.from("direct_messages").insert({
        conversation_id: convo.id,
        sender_username: senderUsername,
        text: text || null,
        attachment_url: attachmentUrl || null,
        attachment_type: attachmentType || null,
        attachment_name: attachmentName || null,
        attachment_size: attachmentSize || null,
        broadcast_id: broadcastId,
      });
      if (msgError) throw msgError;

      const previewText =
        text ||
        (attachmentType === "image"
          ? "📷 Photo"
          : attachmentType === "video"
            ? "🎥 Video"
            : attachmentType === "voice"
              ? "🎤 Voice message"
              : `📎 ${attachmentName || "Attachment"}`);

      await supabase
        .from("conversations")
        .update({
          last_message: previewText,
          last_message_at: new Date().toISOString(),
          last_message_sender: senderUsername,
        })
        .eq("id", convo.id);

      return recipient;
    }),
  );

  const failed = results
    .map((r, i) => (r.status === "rejected" ? recipientUsernames[i] : null))
    .filter(Boolean);

  return { sentCount: recipientUsernames.length - failed.length, failed };
};