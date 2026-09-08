import React, { useState, useRef, useEffect } from "react";
import { sendBroadcastMessage } from "../../utils/broadcast";
import EmojiGifStickerPicker from "./EmojiGifStickerPicker";
import "./BroadcastComposeWindow.css";
import { uploadAttachmentToR2 } from "../../utils/mediaUpload";

const BroadcastComposeWindow = ({ list, currentUser, onBack, onClose }) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [result, setResult] = useState(null); // { sentCount, failed }
  const fileInputRef = useRef();
  const inputRef = useRef();

  // ── Emoji / GIF / Sticker picker ──
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef();
  const emojiBtnRef = useRef();

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (e) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target) &&
        emojiBtnRef.current &&
        !emojiBtnRef.current.contains(e.target)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  const recipients = (list.broadcast_recipients || []).map((r) => r.username);

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

  const insertEmoji = (emoji) => {
    setText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    if ((!text.trim() && !pendingAttachment) || sending || uploading) return;
    setSending(true);
    setResult(null);

    let attachment_url = null;
    let attachment_type = null;
    let attachment_name = null;
    let attachment_size = null;

    try {
      if (pendingAttachment) {
        setUploading(true);
        const { url } = await uploadAttachmentToR2(pendingAttachment.file);
        attachment_url = url;
        attachment_type = pendingAttachment.type;
        attachment_name = pendingAttachment.name;
        attachment_size = pendingAttachment.size;
        setUploading(false);
      }

      const res = await sendBroadcastMessage({
        broadcastId: list.id,
        senderUsername: currentUser,
        recipientUsernames: recipients,
        text: text.trim(),
        attachmentUrl: attachment_url,
        attachmentType: attachment_type,
        attachmentName: attachment_name,
        attachmentSize: attachment_size,
      });

      setResult(res);
      setText("");
      if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl);
      setPendingAttachment(null);
    } catch (err) {
      alert(`Failed to send broadcast: ${err?.message || "please try again."}`);
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  // Sends a GIF or sticker to every recipient immediately — no upload
  // needed since Giphy already hosts the media, mirrors handleSend but
  // skips the attachment-upload branch.
  const sendMedia = async (url, type) => {
    if (!url || sending) return;
    setSending(true);
    setResult(null);
    try {
      const res = await sendBroadcastMessage({
        broadcastId: list.id,
        senderUsername: currentUser,
        recipientUsernames: recipients,
        text: "",
        attachmentUrl: url,
        attachmentType: type, // "gif" | "sticker"
        attachmentName: null,
        attachmentSize: null,
      });
      setResult(res);
    } catch (err) {
      alert(`Failed to send broadcast: ${err?.message || "please try again."}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bcw-window">
      <div className="bcw-header">
        <button className="bcw-back-btn" onClick={onBack}>←</button>
        <div className="bcw-avatar">📢</div>
        <div className="bcw-title">
          <span className="bcw-name">{list.name}</span>
          <span className="bcw-recipient-count">{recipients.length} recipients</span>
        </div>
        <button className="bcw-close-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="bcw-body">
        <div className="bcw-info-banner">
          Messages sent here go to each person individually — they won't see
          each other or know this was a broadcast.
        </div>

        <div className="bcw-recipients-list">
          {recipients.map((r) => (
            <span key={r} className="bcw-recipient-chip">{r}</span>
          ))}
        </div>

        {result && (
          <div className="bcw-result">
            ✓ Sent to {result.sentCount} of {recipients.length}
            {result.failed.length > 0 && (
              <div className="bcw-result-failed">Failed: {result.failed.join(", ")}</div>
            )}
          </div>
        )}
      </div>

      {pendingAttachment && (
        <div className="bcw-pending-attachment">
          {pendingAttachment.type === "image" && <img src={pendingAttachment.previewUrl} alt="preview" />}
          {pendingAttachment.type === "video" && <video src={pendingAttachment.previewUrl} />}
          {pendingAttachment.type === "file" && <span>📎 {pendingAttachment.name}</span>}
          <button onClick={() => setPendingAttachment(null)}>✕</button>
          {uploading && <span className="bcw-uploading">Uploading…</span>}
        </div>
      )}

      <div className="bcw-input-row">
        <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileSelect} />
        <button className="bcw-icon-btn" onClick={() => fileInputRef.current?.click()}>📎</button>

        <button
          type="button"
          ref={emojiBtnRef}
          className="bcw-icon-btn"
          onClick={() => setShowEmojiPicker((v) => !v)}
          aria-label="Emoji, GIFs and stickers"
        >
          😀
        </button>

        {showEmojiPicker && (
          <EmojiGifStickerPicker
            ref={emojiPickerRef}
            onEmojiSelect={(emoji) => insertEmoji(emoji)}
            onMediaSelect={({ url, type }) => {
              setShowEmojiPicker(false);
              sendMedia(url, type);
            }}
          />
        )}

        <input
          ref={inputRef}
          className="bcw-text-input"
          placeholder="Compose broadcast message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="bcw-send-btn"
          onClick={handleSend}
          disabled={sending || uploading || (!text.trim() && !pendingAttachment)}
        >
          {sending ? "…" : "➤"}
        </button>
      </div>
    </div>
  );
};

export default BroadcastComposeWindow;