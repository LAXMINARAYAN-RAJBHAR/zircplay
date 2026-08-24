import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../config/supabase";
import {
  fetchGroupMembers,
  sendGroupMessage,
  markGroupRead,
  leaveGroup,
} from "../../utils/groupChat";
import { URL_SPLIT_REGEX, isUrlToken, extractFirstUrl, truncateUrlDisplay } from "../../utils/linkPreview";
import LinkPreviewCard from "./LinkPreviewCard";
import AddMembersModal from "./AddMembersModal";
import "./GroupChatWindow.css";
import { playSendSound, playReceiveSound } from "../../utils/soundEffects";
import { uploadAttachmentToR2 } from "../../utils/mediaUpload";

// ── Typing indicator tuning (mirrors MessagesPanel's 1:1 chat) ──
const TYPING_STOP_DELAY_MS = 1500;
const TYPING_AUTO_CLEAR_MS = 4000;

// ── Report reasons (mirrors MessagesPanel's 1:1 report modal) ──
const REPORT_REASONS = [
  "Nudity or sexual content",
  "Involves a minor",
  "Harassment or threats",
  "Spam",
  "Other",
];

const timeShort = (dateStr) =>
  new Date(dateStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

// Short label used for a reply/forward preview when the source message
// has no text (e.g. it's an attachment-only message). Mirrors the same
// helper in MessagesPanel.jsx.
const attachmentPreviewLabel = (type, name) => {
  if (type === "image") return "📷 Photo";
  if (type === "video") return "🎥 Video";
  if (type === "voice") return "🎤 Voice message";
  if (type === "file") return `📎 ${name || "Attachment"}`;
  return "Message";
};

// Splits group message text into URL / plain-text segments so links are
// clickable, mirroring MessagesPanel's renderMessageText but without the
// emoji-halo styling (group bubbles don't currently have that treatment).
const renderGroupMessageText = (str, mine) => {
  if (!str) return null;

  const parts = str.split(URL_SPLIT_REGEX).filter((p) => p !== undefined && p !== "");

  return parts.map((part, i) =>
    isUrlToken(part) ? (
      <a
        key={i}
        href={part.startsWith("www.") ? `https://${part}` : part}
        target="_blank"
        rel="noopener noreferrer"
        className={`gcw-inline-link${mine ? " mine" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        🔗 {truncateUrlDisplay(part)}
      </a>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
};

// Formats the set of currently-typing member usernames into a readable
// line, WhatsApp-group style: "Alice is typing…", "Alice and Bob are
// typing…", or "3 people are typing…" once it gets crowded.
const formatTypingLabel = (usernames) => {
  const names = Array.from(usernames);
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names.length} people are typing…`;
};

const TypingBubble = () => (
  <div className="gcw-bubble-row">
    <div className="gcw-typing-bubble" aria-label="typing">
      <span />
      <span />
      <span />
    </div>
  </div>
);

let optimisticCounter = 0;
const makeTempId = () => `temp-${Date.now()}-${++optimisticCounter}`;

const GroupChatWindow = ({ group, currentUser, onBack, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [members, setMembers] = useState([]);
  const [showMembers, setShowMembers] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);

  // ── Reply ──
  const [replyTarget, setReplyTarget] = useState(null);

  // ── Forward (targets a 1:1 conversation, searched by username) ──
  const [forwardTarget, setForwardTarget] = useState(null);
  const [forwardQuery, setForwardQuery] = useState("");
  const [forwardResults, setForwardResults] = useState([]);
  const [searchingForward, setSearchingForward] = useState(false);
  const [forwarding, setForwarding] = useState(false);
  const [forwardedTo, setForwardedTo] = useState(null); // username, briefly shown as confirmation

  // ── Inline editing ──
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  // ── Per-message "⋮" action menu (Reply / Forward / Edit / Report / Delete) ──
  const [openMenuFor, setOpenMenuFor] = useState(null);

  // ── Reporting ──
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  // ── Optimistic send tracking ──
  const pendingOptimisticIdRef = useRef(null);

  // ── Typing indicator state ──
  const [typingUsers, setTypingUsers] = useState(new Set());
  const typingChannelRef = useRef(null);
  const stopTypingTimeoutRef = useRef(null);
  const autoClearTimersRef = useRef({});

  const fileInputRef = useRef();
  const bottomRef = useRef();
  const inputRef = useRef();
  const membersPanelRef = useRef();
  const membersTriggerRef = useRef();

  const loadMembers = useCallback(() => {
    fetchGroupMembers(group.id).then(setMembers);
  }, [group.id]);

  useEffect(() => {
    // Switching groups invalidates any in-progress reply — the quoted
    // message belongs to the group we're leaving.
    setReplyTarget(null);

    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("group_messages")
        .select("*")
        .eq("group_id", group.id)
        .order("created_at", { ascending: true });
      setMessages(data || []);
      setLoading(false);
      markGroupRead(group.id, currentUser);
    };
    load();
    loadMembers();
  }, [group.id, currentUser, loadMembers]);

  // ── Realtime listener ──
  useEffect(() => {
    const channel = supabase
      .channel(`group-messages-${group.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${group.id}` },
        (payload) => {
          const incoming = payload.new;
          let wasAppended = false;
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;

            const pendingId = pendingOptimisticIdRef.current;
            if (
              pendingId &&
              incoming.sender_username === currentUser &&
              prev.some((m) => m.id === pendingId)
            ) {
              pendingOptimisticIdRef.current = null;
              return prev.map((m) => (m.id === pendingId ? incoming : m));
            }

            wasAppended = true;
            return [...prev, incoming];
          });
          if (wasAppended && incoming.sender_username !== currentUser) {
            playReceiveSound();
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "group_messages", filter: `group_id=eq.${group.id}` },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === payload.new.id ? payload.new : m)),
          );
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [group.id, currentUser]);

  // Keep the member list live if someone else adds/removes people while
  // this window is open (e.g. another admin adding members concurrently).
  useEffect(() => {
    const channel = supabase
      .channel(`group-members-${group.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members", filter: `group_id=eq.${group.id}` },
        () => loadMembers(),
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [group.id, loadMembers]);

  // ── Typing indicator: broadcast channel scoped to this group ──
  useEffect(() => {
    setTypingUsers(new Set());
    Object.values(autoClearTimersRef.current).forEach(clearTimeout);
    autoClearTimersRef.current = {};
    clearTimeout(stopTypingTimeoutRef.current);

    const channel = supabase.channel(`typing:group:${group.id}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload || payload.username === currentUser) return;
        const { username, typing } = payload;

        setTypingUsers((prev) => {
          const next = new Set(prev);
          if (typing) next.add(username);
          else next.delete(username);
          return next;
        });

        clearTimeout(autoClearTimersRef.current[username]);
        if (typing) {
          autoClearTimersRef.current[username] = setTimeout(() => {
            setTypingUsers((prev) => {
              const next = new Set(prev);
              next.delete(username);
              return next;
            });
          }, TYPING_AUTO_CLEAR_MS);
        }
      })
      .subscribe();

    typingChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
      Object.values(autoClearTimersRef.current).forEach(clearTimeout);
      autoClearTimersRef.current = {};
      clearTimeout(stopTypingTimeoutRef.current);
    };
  }, [group.id, currentUser]);

  const handleTypingInput = () => {
    const channel = typingChannelRef.current;
    if (!channel) return;

    channel.send({
      type: "broadcast",
      event: "typing",
      payload: { username: currentUser, typing: true },
    });

    clearTimeout(stopTypingTimeoutRef.current);
    stopTypingTimeoutRef.current = setTimeout(() => {
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: { username: currentUser, typing: false },
      });
    }, TYPING_STOP_DELAY_MS);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  // Close the members panel when tapping/clicking anywhere outside it.
  useEffect(() => {
    if (!showMembers) return;
    const handleClickOutside = (e) => {
      if (
        membersPanelRef.current &&
        !membersPanelRef.current.contains(e.target) &&
        membersTriggerRef.current &&
        !membersTriggerRef.current.contains(e.target)
      ) {
        setShowMembers(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMembers]);

  // Close the "⋮" action menu when tapping/clicking anywhere outside it.
  useEffect(() => {
    if (!openMenuFor) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest(".gcw-menu") && !e.target.closest(".gcw-menu-trigger")) {
        setOpenMenuFor(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuFor]);

  // ── Forward: search profiles by username while the picker is open ──
  useEffect(() => {
    if (!forwardTarget) return;
    const query = forwardQuery.trim();
    if (!query) {
      setForwardResults([]);
      setSearchingForward(false);
      return;
    }

    setSearchingForward(true);
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .ilike("username", `%${query}%`)
        .neq("username", currentUser)
        .limit(8);

      if (!error) setForwardResults(data || []);
      setSearchingForward(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [forwardQuery, forwardTarget, currentUser]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      alert("File too large. Max size is 25MB.");
      return;
    }
    const type = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file";
    const previewUrl = type !== "file" ? URL.createObjectURL(file) : null;
    setPendingAttachment({ file, previewUrl, type, name: file.name, size: file.size });
  };

  const handleSend = async () => {
    if ((!text.trim() && !pendingAttachment) || sending || uploading) return;
    setSending(true);
    const trimmed = text.trim();
    setText("");

    // Snapshot the reply target now — it gets cleared right after the
    // optimistic bubble is appended, same as pendingAttachment below.
    const replyTargetSnapshot = replyTarget;
    const reply_to_id = replyTargetSnapshot?.id || null;
    const reply_to_sender = replyTargetSnapshot?.sender_username || null;
    const reply_to_text = replyTargetSnapshot
      ? replyTargetSnapshot.text
        ? replyTargetSnapshot.text.slice(0, 120)
        : attachmentPreviewLabel(
            replyTargetSnapshot.attachment_type,
            replyTargetSnapshot.attachment_name,
          )
      : null;

    // ── Optimistic append happens FIRST, before anything else that could
    // possibly throw (e.g. the typing-stop broadcast below, which has
    // been known to throw if the realtime channel isn't fully joined
    // yet). If any later step fails, the worst case is the message gets
    // removed again in the catch block — but it's never simply invisible
    // with no feedback, which is what "blank until refresh" looked like
    // before this reordering. For messages WITH an attachment, the
    // attachment_url starts null and gets filled in once the upload
    // finishes (see below) — the text/bubble itself still shows instantly. ──
    const pendingAttachmentSnapshot = pendingAttachment;
    const tempId = makeTempId();
    pendingOptimisticIdRef.current = tempId;
    const optimisticMessage = {
      id: tempId,
      group_id: group.id,
      sender_username: currentUser,
      text: trimmed || null,
      attachment_url: null,
      attachment_type: pendingAttachmentSnapshot?.type || null,
      attachment_name: pendingAttachmentSnapshot?.name || null,
      attachment_size: pendingAttachmentSnapshot?.size || null,
      reply_to_id,
      reply_to_text,
      reply_to_sender,
      forwarded: false,
      created_at: new Date().toISOString(),
      deleted_at: null,
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    playSendSound();
    setReplyTarget(null);

    if (pendingAttachmentSnapshot?.previewUrl) URL.revokeObjectURL(pendingAttachmentSnapshot.previewUrl);
    setPendingAttachment(null);

    // Sending counts as "done typing" — clear the debounce and notify
    // the group right away instead of waiting out the delay. Wrapped in
    // its own try/catch: this is a nice-to-have side effect, and must
    // never be allowed to block or break the actual message send above.
    try {
      clearTimeout(stopTypingTimeoutRef.current);
      typingChannelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { username: currentUser, typing: false },
      });
    } catch {
      /* no-op — typing indicator is best-effort, never critical */
    }

    let attachment_url = null;
    let attachment_type = null;
    let attachment_name = null;
    let attachment_size = null;

    try {
      if (pendingAttachmentSnapshot) {
        setUploading(true);
        const { url } = await uploadAttachmentToR2(pendingAttachmentSnapshot.file);
        attachment_url = url;
        attachment_type = pendingAttachmentSnapshot.type;
        attachment_name = pendingAttachmentSnapshot.name;
        attachment_size = pendingAttachmentSnapshot.size;
        setUploading(false);

        // Fill in the real attachment URL on the optimistic bubble now
        // that the upload has finished, so image/video/file previews
        // render even before the server row comes back.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, attachment_url, attachment_type } : m,
          ),
        );
      }

      const sentMessage = await sendGroupMessage({
        groupId: group.id,
        senderUsername: currentUser,
        text: trimmed,
        attachmentUrl: attachment_url,
        attachmentType: attachment_type,
        attachmentName: attachment_name,
        attachmentSize: attachment_size,
        replyToId: reply_to_id,
        replyToText: reply_to_text,
        replyToSender: reply_to_sender,
      });

      // Happy path: the insert's .select() came back with a real row —
      // swap the placeholder for it right away. If it DIDN'T come back
      // (RLS denies the select, or any other reason sentMessage is
      // falsy), we leave the optimistic bubble as-is; the realtime
      // listener above will reconcile it with the real row once that
      // event arrives, using pendingOptimisticIdRef as the match key.
      if (sentMessage && sentMessage.id) {
        pendingOptimisticIdRef.current = null;
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? sentMessage : m)),
        );
      }
    } catch (err) {
      // The insert itself failed (not just the select-after-insert) —
      // remove the optimistic bubble since it was never actually sent,
      // and give the user their text back to retry.
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      pendingOptimisticIdRef.current = null;
      setText(trimmed);
      alert(`Failed to send: ${err?.message || "please try again."}`);
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm(`Leave "${group.name}"?`)) return;
    await leaveGroup(group.id, currentUser);
    onBack();
  };

  // ── Reply ──
  const startReply = (m) => {
    setReplyTarget(m);
    inputRef.current?.focus();
  };

  const cancelReply = () => setReplyTarget(null);

  // ── Forward ──
  const openForward = (message) => {
    setForwardTarget(message);
    setForwardQuery("");
    setForwardResults([]);
    setForwardedTo(null);
  };

  const closeForward = () => {
    if (forwarding) return;
    setForwardTarget(null);
    setForwardQuery("");
    setForwardResults([]);
    setForwardedTo(null);
  };

  // Forwards forwardTarget out of the group and into a 1:1 conversation
  // with targetUsername, creating that conversation first if it doesn't
  // exist yet.
  const forwardToUser = async (targetUsername) => {
    if (!forwardTarget || forwarding) return;
    setForwarding(true);

    const [user_a, user_b] = [currentUser, targetUsername].sort();

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

    if (!convo) {
      setForwarding(false);
      alert("Couldn't start that conversation. Please try again.");
      return;
    }

    const { error } = await supabase.from("direct_messages").insert({
      conversation_id: convo.id,
      sender_username: currentUser,
      text: forwardTarget.text || null,
      attachment_url: forwardTarget.attachment_url || null,
      attachment_type: forwardTarget.attachment_type || null,
      attachment_name: forwardTarget.attachment_name || null,
      attachment_size: forwardTarget.attachment_size || null,
      forwarded: true,
    });

    if (error) {
      setForwarding(false);
      alert(`Failed to forward message: ${error.message || "please try again."}`);
      return;
    }

    const previewText =
      forwardTarget.text ||
      attachmentPreviewLabel(forwardTarget.attachment_type, forwardTarget.attachment_name);
    await supabase
      .from("conversations")
      .update({
        last_message: previewText,
        last_message_at: new Date().toISOString(),
        last_message_sender: currentUser,
      })
      .eq("id", convo.id);

    setForwarding(false);
    setForwardedTo(targetUsername);
    // Brief confirmation, then close the picker.
    setTimeout(() => {
      setForwardTarget(null);
      setForwardQuery("");
      setForwardResults([]);
      setForwardedTo(null);
    }, 900);
  };

  // ── Inline editing ──
  const startEdit = (m) => {
    setEditingId(m.id);
    setEditText(m.text || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEdit = async (message) => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === message.text) {
      cancelEdit();
      return;
    }

    const editedAt = new Date().toISOString();
    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id ? { ...m, text: trimmed, edited_at: editedAt } : m,
      ),
    );
    setEditingId(null);
    setEditText("");

    await supabase
      .from("group_messages")
      .update({ text: trimmed, edited_at: editedAt })
      .eq("id", message.id);
  };

  // ── Delete message (delete for everyone) ──
  const deleteMessage = async (message) => {
    const confirmed = window.confirm("Delete this message for everyone?");
    if (!confirmed) return;

    const deletedAt = new Date().toISOString();
    if (editingId === message.id) cancelEdit();

    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id
          ? {
              ...m,
              deleted_at: deletedAt,
              text: null,
              attachment_url: null,
              attachment_type: null,
              attachment_name: null,
              attachment_size: null,
            }
          : m,
      ),
    );

    await supabase
      .from("group_messages")
      .update({
        deleted_at: deletedAt,
        text: null,
        attachment_url: null,
        attachment_type: null,
        attachment_name: null,
        attachment_size: null,
      })
      .eq("id", message.id);
  };

  // ── Reporting ──
  const openReport = (message) => {
    setReportTarget(message);
    setReportReason("");
    setReportSubmitted(false);
  };

  const closeReport = () => {
    if (reportSubmitting) return;
    setReportTarget(null);
    setReportReason("");
    setReportSubmitting(false);
    setReportSubmitted(false);
  };

  // Mirrors MessagesPanel's submitReport — inserts into the shared
  // "reports" table that AdminPanel already reads, tagged content_type
  // "group_message" so moderation can tell the two apart.
  const submitReport = async () => {
    if (!reportTarget || !reportReason || reportSubmitting) return;
    setReportSubmitting(true);

    const { error } = await supabase.from("reports").insert({
      content_type: "group_message",
      content_id: String(reportTarget.id),
      content_title: reportTarget.text?.slice(0, 80) || "Message",
      content_owner: reportTarget.sender_username,
      reporter_username: currentUser,
      reason: reportReason,
      details: reportTarget.attachment_url
        ? `Attachment: ${reportTarget.attachment_type || "file"} (group: ${group.name})`
        : `Group: ${group.name}`,
      status: "pending",
    });

    setReportSubmitting(false);

    if (error) {
      console.error("Group message report submission failed:", error);
      alert(`Failed to submit report: ${error.message || "please try again."}`);
      return;
    }

    setReportSubmitted(true);
  };

  const typingLabel = formatTypingLabel(typingUsers);

  return (
    <div className="gcw-window">
      <div className="gcw-header">
        <button className="gcw-back-btn" onClick={onBack}>←</button>
        <div className="gcw-avatar">{group.name.slice(0, 2).toUpperCase()}</div>
        <div className="gcw-title" ref={membersTriggerRef} onClick={() => setShowMembers((v) => !v)}>
          <span className="gcw-name">{group.name}</span>
          <span className="gcw-member-count">
            {typingLabel || `${members.length} members`}
          </span>
        </div>
        <button
          className="gcw-header-add-btn"
          onClick={() => setShowAddMembers(true)}
          aria-label="Add members"
          title="Add members"
        >
          👤＋
        </button>
        <button className="gcw-close-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>

      {showMembers && (
        <div className="gcw-members-panel" ref={membersPanelRef}>
          <div className="gcw-members-panel-header">
            <span>Members</span>
            <button className="gcw-add-member-btn" onClick={() => setShowAddMembers(true)}>
              ＋ Add
            </button>
          </div>
          {members.map((m) => (
            <div key={m.username} className="gcw-member-row">
              <div className="gcw-avatar-sm">{m.username.slice(0, 2).toUpperCase()}</div>
              <span>{m.username}</span>
              {m.is_admin && <span className="gcw-admin-tag">Admin</span>}
            </div>
          ))}
          <button className="gcw-leave-btn" onClick={handleLeaveGroup}>Leave group</button>
        </div>
      )}

      {showAddMembers && (
        <AddMembersModal
          group={group}
          currentUser={currentUser}
          existingUsernames={members.map((m) => m.username)}
          onClose={() => setShowAddMembers(false)}
          onAdded={() => {
            setShowAddMembers(false);
            loadMembers();
          }}
        />
      )}

      <div className="gcw-body">
        {loading ? (
          <p className="gcw-empty">Loading messages…</p>
        ) : messages.length === 0 && typingUsers.size === 0 ? (
          <p className="gcw-empty">No messages yet. Say hello!</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_username === currentUser;
            const hasContent = !!(m.text || m.attachment_url);
            return (
              <div key={m.id} className={`gcw-bubble-row ${mine ? "mine" : ""}`}>
                <div className="gcw-bubble-stack">
                  {editingId !== m.id && !m.deleted_at && hasContent && (
                    <div className="gcw-bubble-actions">
                      <div className="gcw-menu-wrap">
                        <button
                          type="button"
                          className="gcw-bubble-action-btn gcw-menu-trigger"
                          onClick={() => setOpenMenuFor(openMenuFor === m.id ? null : m.id)}
                          aria-label="More options"
                          title="More"
                        >
                          ⋮
                        </button>

                        {openMenuFor === m.id && (
                          <div className={`gcw-menu ${mine ? "mine" : ""}`}>
                            <button
                              type="button"
                              className="gcw-menu-item"
                              onClick={() => {
                                startReply(m);
                                setOpenMenuFor(null);
                              }}
                            >
                              ↩ Reply
                            </button>
                            <button
                              type="button"
                              className="gcw-menu-item"
                              onClick={() => {
                                openForward(m);
                                setOpenMenuFor(null);
                              }}
                            >
                              ➡ Forward
                            </button>
                            {mine && m.text && !m.attachment_url && (
                              <button
                                type="button"
                                className="gcw-menu-item"
                                onClick={() => {
                                  startEdit(m);
                                  setOpenMenuFor(null);
                                }}
                              >
                                ✎ Edit
                              </button>
                            )}
                            {!mine && (
                              <button
                                type="button"
                                className="gcw-menu-item"
                                onClick={() => {
                                  openReport(m);
                                  setOpenMenuFor(null);
                                }}
                              >
                                🚩 Report
                              </button>
                            )}
                            {mine && (
                              <button
                                type="button"
                                className="gcw-menu-item danger"
                                onClick={() => {
                                  deleteMessage(m);
                                  setOpenMenuFor(null);
                                }}
                              >
                                🗑 Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="gcw-bubble">
                    {!mine && <div className="gcw-sender-name">{m.sender_username}</div>}
                    {m.deleted_at ? (
                      <span className="gcw-deleted-text">🚫 This message was deleted</span>
                    ) : editingId === m.id ? (
                      <div className="gcw-edit-box">
                        <input
                          className="gcw-edit-input"
                          value={editText}
                          autoFocus
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveEdit(m);
                            }
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                        <div className="gcw-edit-actions">
                          <button onClick={() => saveEdit(m)}>Save</button>
                          <button onClick={cancelEdit}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {m.forwarded && <div className="gcw-forwarded-tag">↪ Forwarded</div>}

                        {m.reply_to_id && (
                          <div className={`gcw-reply-quote ${mine ? "mine" : ""}`}>
                            <span className="gcw-reply-quote-sender">
                              {m.reply_to_sender === currentUser ? "You" : m.reply_to_sender}
                            </span>
                            <span className="gcw-reply-quote-text">{m.reply_to_text}</span>
                          </div>
                        )}

                        {m.attachment_url && m.attachment_type === "image" && (
                          <img
                            src={m.attachment_url}
                            alt="attachment"
                            className="gcw-bubble-image"
                            onClick={() => window.open(m.attachment_url, "_blank")}
                          />
                        )}
                        {m.attachment_url && m.attachment_type === "video" && (
                          <video src={m.attachment_url} controls className="gcw-bubble-video" />
                        )}
                        {m.attachment_url && m.attachment_type === "file" && (
                          <a href={m.attachment_url} target="_blank" rel="noopener noreferrer" className="gcw-bubble-file">
                            📎 {m.attachment_name || "Attachment"}
                          </a>
                        )}
                        {m.text && <span>{renderGroupMessageText(m.text, mine)}</span>}
                        {m.text && extractFirstUrl(m.text) && (
                          <LinkPreviewCard url={extractFirstUrl(m.text)} mine={mine} classPrefix="gcw" />
                        )}
                        <span className="gcw-bubble-time">
                          {m.edited_at && <span className="gcw-edited-tag">edited </span>}
                          {timeShort(m.created_at)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        {typingUsers.size > 0 && <TypingBubble />}
        <div ref={bottomRef} />
      </div>

      {replyTarget && (
        <div className="gcw-reply-preview">
          <div className="gcw-reply-preview-bar" />
          <div className="gcw-reply-preview-content">
            <span className="gcw-reply-preview-sender">
              Replying to {replyTarget.sender_username === currentUser ? "yourself" : replyTarget.sender_username}
            </span>
            <span className="gcw-reply-preview-text">
              {replyTarget.text
                ? replyTarget.text.slice(0, 80)
                : attachmentPreviewLabel(replyTarget.attachment_type, replyTarget.attachment_name)}
            </span>
          </div>
          <button
            type="button"
            className="gcw-reply-preview-close"
            onClick={cancelReply}
            aria-label="Cancel reply"
          >
            ✕
          </button>
        </div>
      )}

      {pendingAttachment && (
        <div className="gcw-pending-attachment">
          {pendingAttachment.type === "image" && <img src={pendingAttachment.previewUrl} alt="preview" />}
          {pendingAttachment.type === "video" && <video src={pendingAttachment.previewUrl} />}
          {pendingAttachment.type === "file" && <span>📎 {pendingAttachment.name}</span>}
          <button onClick={() => setPendingAttachment(null)}>✕</button>
          {uploading && <span className="gcw-uploading">Uploading…</span>}
        </div>
      )}

      <div className="gcw-input-row">
        <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileSelect} />
        <button className="gcw-icon-btn" onClick={() => fileInputRef.current?.click()}>📎</button>
        <input
          ref={inputRef}
          className="gcw-text-input"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            handleTypingInput();
          }}
          onKeyDown={handleKeyDown}
        />
        <button className="gcw-send-btn" onClick={handleSend} disabled={sending || uploading || (!text.trim() && !pendingAttachment)}>
          ➤
        </button>
      </div>

      {forwardTarget && (
        <div className="gcw-overlay" onClick={closeForward}>
          <div className="gcw-forward-panel" onClick={(e) => e.stopPropagation()}>
            <h3 className="gcw-forward-title">Forward message</h3>
            <p className="gcw-forward-preview">
              {forwardTarget.text
                ? `"${forwardTarget.text.slice(0, 80)}"`
                : attachmentPreviewLabel(forwardTarget.attachment_type, forwardTarget.attachment_name)}
            </p>

            {forwardedTo ? (
              <p className="gcw-forward-success">✓ Forwarded to {forwardedTo}</p>
            ) : (
              <>
                <input
                  type="text"
                  className="gcw-forward-search"
                  placeholder="Search people…"
                  value={forwardQuery}
                  onChange={(e) => setForwardQuery(e.target.value)}
                  autoFocus
                />
                <div className="gcw-forward-results">
                  {searchingForward ? (
                    <p className="gcw-empty gcw-empty-small">Searching…</p>
                  ) : forwardQuery.trim() && forwardResults.length === 0 ? (
                    <p className="gcw-empty gcw-empty-small">No matches</p>
                  ) : (
                    forwardResults.map((p) => (
                      <div
                        key={p.username}
                        className="gcw-forward-result-row"
                        onClick={() => !forwarding && forwardToUser(p.username)}
                        style={{ opacity: forwarding ? 0.6 : 1, cursor: forwarding ? "default" : "pointer" }}
                      >
                        <div className="gcw-avatar-sm">{p.username.slice(0, 2).toUpperCase()}</div>
                        <span>{p.username}</span>
                      </div>
                    ))
                  )}
                </div>
                <button className="gcw-forward-cancel" onClick={closeForward} disabled={forwarding}>
                  {forwarding ? "Forwarding…" : "Cancel"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {reportTarget && (
        <div className="gcw-overlay" onClick={closeReport}>
          <div className="gcw-forward-panel" onClick={(e) => e.stopPropagation()}>
            {reportSubmitted ? (
              <>
                <h3 className="gcw-forward-title">Report submitted</h3>
                <p className="gcw-forward-preview">
                  Thanks — our team will review this. You can close this now.
                </p>
                <button className="gcw-forward-cancel" onClick={closeReport}>
                  Close
                </button>
              </>
            ) : (
              <>
                <h3 className="gcw-forward-title">Report this message</h3>
                <p className="gcw-forward-preview">
                  From {reportTarget.sender_username}. This will be sent to our moderation team.
                </p>
                {REPORT_REASONS.map((r) => (
                  <label
                    key={r}
                    style={{ display: "block", padding: "6px 0", fontSize: 13 }}
                  >
                    <input
                      type="radio"
                      name="gcwReportReason"
                      checked={reportReason === r}
                      onChange={() => setReportReason(r)}
                    />{" "}
                    {r}
                  </label>
                ))}
                <button
                  className="gcw-forward-cancel"
                  style={{ marginTop: 10 }}
                  onClick={submitReport}
                  disabled={!reportReason || reportSubmitting}
                >
                  {reportSubmitting ? "Submitting…" : "Submit Report"}
                </button>
                <button
                  className="gcw-forward-cancel"
                  style={{ marginTop: 8 }}
                  onClick={closeReport}
                  disabled={reportSubmitting}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupChatWindow;