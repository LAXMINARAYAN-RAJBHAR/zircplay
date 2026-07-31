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

  useEffect(() => {
    const channel = supabase
      .channel(`group-messages-${group.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${group.id}` },
        (payload) => setMessages((prev) => [...prev, payload.new]),
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

      await sendGroupMessage({
        groupId: group.id,
        senderUsername: currentUser,
        text: trimmed,
        attachmentUrl: attachment_url,
        attachmentType: attachment_type,
        attachmentName: attachment_name,
        attachmentSize: attachment_size,
      });

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

  return (
    <div className="gcw-window">
      <div className="gcw-header">
        <button className="gcw-back-btn" onClick={onBack}>←</button>
        <div className="gcw-avatar">{group.name.slice(0, 2).toUpperCase()}</div>
        <div className="gcw-title" ref={membersTriggerRef} onClick={() => setShowMembers((v) => !v)}>
          <span className="gcw-name">{group.name}</span>
          <span className="gcw-member-count">{members.length} members</span>
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
        ) : messages.length === 0 ? (
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
          onChange={(e) => setText(e.target.value)}
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