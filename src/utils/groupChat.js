import { supabase } from "../config/supabase";

// Creates a new group with the creator as admin plus the selected members.
export const createGroup = async ({ name, createdBy, memberUsernames }) => {
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .insert({ name, created_by: createdBy })
    .select()
    .single();

  if (groupError || !group) throw groupError || new Error("Failed to create group");

  const rows = [
    { group_id: group.id, username: createdBy, is_admin: true },
    ...memberUsernames
      .filter((u) => u !== createdBy)
      .map((username) => ({ group_id: group.id, username, is_admin: false })),
  ];

  const { error: membersError } = await supabase.from("group_members").insert(rows);
  if (membersError) throw membersError;

  return group;
};

// Fetches every group the given user belongs to, with member count and
// last message preview (mirrors the conversations list shape).
//
// FIX: results are now sorted by most-recent activity (latest group
// message, falling back to the group's own created_at if it has no
// messages yet) — descending, most recent first. Previously this just
// returned rows in whatever order Supabase's implicit join order
// produced (effectively insertion order), so a group with brand new
// messages could sit anywhere in the list instead of bubbling to the
// top like the 1:1 conversations list already does.
export const fetchUserGroups = async (username) => {
  const { data: memberships } = await supabase
    .from("group_members")
    .select("group_id, last_read_at, groups(id, name, avatar_url, created_by, created_at)")
    .eq("username", username);

  if (!memberships || memberships.length === 0) return [];

  const groupIds = memberships.map((m) => m.group_id);

  // Latest message per group (for preview + unread calculation)
  const { data: latestMsgs } = await supabase
    .from("group_messages")
    .select("group_id, text, sender_username, created_at, attachment_type")
    .in("group_id", groupIds)
    .order("created_at", { ascending: false });

  const latestByGroup = {};
  (latestMsgs || []).forEach((m) => {
    if (!latestByGroup[m.group_id]) latestByGroup[m.group_id] = m;
  });

  const groups = memberships.map((m) => ({
    ...m.groups,
    lastMessage: latestByGroup[m.group_id] || null,
    lastReadAt: m.last_read_at,
  }));

  // Sort by most recent activity: latest message time if there is one,
  // otherwise fall back to when the group itself was created.
  const activityTime = (g) =>
    new Date(g.lastMessage?.created_at || g.created_at || 0).getTime();

  return groups.sort((a, b) => activityTime(b) - activityTime(a));
};

export const fetchGroupMembers = async (groupId) => {
  const { data } = await supabase
    .from("group_members")
    .select("username, is_admin, joined_at")
    .eq("group_id", groupId);
  return data || [];
};

export const addGroupMembers = async (groupId, usernames) => {
  const rows = usernames.map((username) => ({ group_id: groupId, username, is_admin: false }));
  const { error } = await supabase.from("group_members").insert(rows);
  if (error) throw error;
};

export const leaveGroup = async (groupId, username) => {
  const { error } = await supabase
    .from("group_members")
    .delete()
    .match({ group_id: groupId, username });
  if (error) throw error;
};

export const markGroupRead = async (groupId, username) => {
  await supabase
    .from("group_members")
    .update({ last_read_at: new Date().toISOString() })
    .match({ group_id: groupId, username });
};

// FIX: this previously did a plain `.insert(...)` with no `.select()`,
// so it always returned `undefined` — the caller (GroupChatWindow's
// handleSend) had no row to optimistically append to local state, which
// is why sent messages only ever showed up after a refresh or whenever
// the realtime event happened to arrive. Now returns the inserted row
// so the UI can show the message immediately.
//
// Reply support: replyToId/replyToText/replyToSender are optional and
// map to the reply_to_id / reply_to_text / reply_to_sender columns on
// group_messages, mirroring the same pattern used for direct_messages
// in MessagesPanel.jsx. All three are omitted (stored as null) for a
// message that isn't a reply.
export const sendGroupMessage = async ({
  groupId,
  senderUsername,
  text,
  attachmentUrl,
  attachmentType,
  attachmentName,
  attachmentSize,
  replyToId,
  replyToText,
  replyToSender,
}) => {
  const { data, error } = await supabase
    .from("group_messages")
    .insert({
      group_id: groupId,
      sender_username: senderUsername,
      text: text || null,
      attachment_url: attachmentUrl || null,
      attachment_type: attachmentType || null,
      attachment_name: attachmentName || null,
      attachment_size: attachmentSize || null,
      reply_to_id: replyToId || null,
      reply_to_text: replyToText || null,
      reply_to_sender: replyToSender || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};