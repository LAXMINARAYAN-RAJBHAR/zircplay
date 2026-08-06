import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../config/supabase";
import {
  fetchGroupMembers,
  sendGroupMessage,
  markGroupRead,
  leaveGroup,
} from "../../utils/groupChat";
import AddMembersModal from "./AddMembersModal";
import "./GroupChatWindow.css";

const CLOUDINARY_CLOUD_NAME = "uaa756bj";
const CLOUDINARY_UPLOAD_PRESET = "zixplon-data";

// ── Typing indicator tuning (mirrors MessagesPanel's 1:1 chat) ──
const TYPING_STOP_DELAY_MS = 1500;
const TYPING_AUTO_CLEAR_MS = 4000;

const uploadToCloudinary = async (file, resourceType) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;
  const res = await fetch(endpoint, { method: "POST", body: formData });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.secure_url;
};

const timeShort = (dateStr) =>
  new Date(dateStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

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

  // ── Typing indicator state ──
  // typingUsers: Set of usernames (excluding self) currently typing.
  // typingChannelRef: broadcast channel scoped to this group.
  // stopTypingTimeoutRef: debounce timer for OUR OWN "stopped typing".
  // autoClearTimersRef: map of username -> timeout id, so each group
  // member's indicator auto-expires independently if their "stopped"
  // broadcast is ever lost.
  const [typingUsers, setTypingUsers] = useState(new Set());
  const typingChannelRef = useRef(null);
  const stopTypingTimeoutRef = useRef(null);
  const autoClearTimersRef = useRef({});

  const fileInputRef = useRef();
  const bottomRef = useRef();
  const membersPanelRef = useRef();
  const membersTriggerRef = useRef();

  const loadMembers = useCallback(() => {
    fetchGroupMembers(group.id).then(setMembers);
  }, [group.id]);

  useEffect(() => {
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
  // FIX: this used to blindly append every INSERT event, including the
  // one that echoes back the message THIS client just sent — but since
  // handleSend now appends the sent message locally right away (see
  // below), we need to dedupe here by id so the realtime echo doesn't
  // add a second copy of the same message.
  useEffect(() => {
    const channel = supabase
      .channel(`group-messages-${group.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${group.id}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [group.id]);

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
  // Same ephemeral broadcast approach as the 1:1 DM panel, but tracks a
  // Set of usernames instead of a single boolean, since multiple group
  // members can be typing at once.
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

  // Close the members panel when tapping/clicking anywhere outside it
  // (mirrors the emoji-picker / reaction-picker click-outside pattern
  // used in MessagesPanel). Skips the panel itself and the group-name
  // trigger so opening/toggling still works normally.
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

    // Sending counts as "done typing" — clear the debounce and notify
    // the group right away instead of waiting out the delay.
    clearTimeout(stopTypingTimeoutRef.current);
    typingChannelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { username: currentUser, typing: false },
    });

    let attachment_url = null;
    let attachment_type = null;
    let attachment_name = null;
    let attachment_size = null;

    try {
      if (pendingAttachment) {
        setUploading(true);
        const resourceType = pendingAttachment.type === "image" ? "image" : pendingAttachment.type === "video" ? "video" : "raw";
        attachment_url = await uploadToCloudinary(pendingAttachment.file, resourceType);
        attachment_type = pendingAttachment.type;
        attachment_name = pendingAttachment.name;
        attachment_size = pendingAttachment.size;
        setUploading(false);
      }

      const sentMessage = await sendGroupMessage({
        groupId: group.id,
        senderUsername: currentUser,
        text: trimmed,
        attachmentUrl: attachment_url,
        attachmentType: attachment_type,
        attachmentName: attachment_name,
        attachmentSize: attachment_size,
      });

      // ── FIX: append the message locally right away instead of waiting
      // for the realtime INSERT event to come back around. This is what
      // was causing "need to refresh every time" — the UI previously had
      // no source of truth for the just-sent message other than realtime,
      // which can lag or, in some Supabase project configs, not reliably
      // echo back to the very client that triggered the insert. ──
      if (sentMessage && sentMessage.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === sentMessage.id)) return prev;
          return [...prev, sentMessage];
        });
      }

      if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl);
      setPendingAttachment(null);
    } catch (err) {
      setText(trimmed);
      alert("Failed to send. Please try again.");
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
            return (
              <div key={m.id} className={`gcw-bubble-row ${mine ? "mine" : ""}`}>
                <div className="gcw-bubble">
                  {!mine && <div className="gcw-sender-name">{m.sender_username}</div>}
                  {m.deleted_at ? (
                    <span className="gcw-deleted-text">🚫 This message was deleted</span>
                  ) : (
                    <>
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
                      {m.text && <span>{m.text}</span>}
                      <span className="gcw-bubble-time">{timeShort(m.created_at)}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
        {typingUsers.size > 0 && <TypingBubble />}
        <div ref={bottomRef} />
      </div>

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
    </div>
  );
};

export default GroupChatWindow;