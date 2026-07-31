import React, { useState, useRef } from "react";
import { sendBroadcastMessage } from "../../utils/broadcast";
import "./BroadcastComposeWindow.css";

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

const BroadcastComposeWindow = ({ list, currentUser, onBack, onClose }) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [result, setResult] = useState(null); // { sentCount, failed }
  const fileInputRef = useRef();

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
        const resourceType = pendingAttachment.type === "image" ? "image" : pendingAttachment.type === "video" ? "video" : "raw";
        attachment_url = await uploadToCloudinary(pendingAttachment.file, resourceType);
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
      alert("Failed to send broadcast. Please try again.");
    } finally {
      setSending(false);
      setUploading(false);
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
        <input
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