import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../../config/supabase";
import axios from "axios";
import EmojiPicker from "./EmojiPicker";

const CLOUDINARY_CLOUD = "uaa756bj";
const CLOUDINARY_PRESET = "zixplon-data";

const MAX_IMAGES = 6;
const MAX_VIDEO_MB = 100; // adjust to your Cloudinary plan's limit
const LINK_PREVIEW_DEBOUNCE_MS = 600;

const PRIVACY_OPTIONS = [
  { value: "public", label: "Public", icon: "🌐" },
  { value: "friends", label: "Friends", icon: "👥" },
  { value: "only_me", label: "Only me", icon: "🔒" },
];

const FEELINGS = [
  "Happy 😊", "Excited 🤩", "Grateful 🙏", "Blessed ✨",
  "Motivated 💪", "Tired 😴", "Loved ❤️", "Proud 🎉",
];

const PostComposer = ({ currentUser, onPost }) => {
  const [text, setText] = useState("");
  const [imageFiles, setImageFiles] = useState([]);
  const [videoFile, setVideoFile] = useState(null); // ← NEW: { file, preview }
  const [linkUrl, setLinkUrl] = useState("");
  const [linkPreview, setLinkPreview] = useState(null);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showFeelings, setShowFeelings] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [feeling, setFeeling] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const fileRef = useRef();
  const videoRef = useRef(); // ← NEW
  const linkDebounceRef = useRef(null);

  useEffect(() => {
    return () => {
      if (linkDebounceRef.current) clearTimeout(linkDebounceRef.current);
    };
  }, []);

  const initials = currentUser.slice(0, 2).toUpperCase();
  const canPost = text.trim() || imageFiles.length > 0 || videoFile || linkUrl;

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setError("");

    if (videoFile) {
      setError("A post can have images or a video, not both. Remove the video first.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    const remainingSlots = MAX_IMAGES - imageFiles.length;
    if (remainingSlots <= 0) {
      setError(`You can attach up to ${MAX_IMAGES} images.`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    const filesToAdd = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      setError(`Only ${remainingSlots} more image(s) can be added (max ${MAX_IMAGES}).`);
    }

    filesToAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImageFiles((prev) => [...prev, { file, preview: ev.target.result }]);
      };
      reader.readAsDataURL(file);
    });

    if (fileRef.current) fileRef.current.value = "";
  };

  // ── NEW: video select ──
  const handleVideoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");

    if (imageFiles.length > 0) {
      setError("A post can have images or a video, not both. Remove the images first.");
      if (videoRef.current) videoRef.current.value = "";
      return;
    }

    if (!file.type.startsWith("video/")) {
      setError("Please select a valid video file.");
      if (videoRef.current) videoRef.current.value = "";
      return;
    }

    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_VIDEO_MB) {
      setError(`Video is too large. Max size is ${MAX_VIDEO_MB}MB.`);
      if (videoRef.current) videoRef.current.value = "";
      return;
    }

    setVideoFile({ file, preview: URL.createObjectURL(file) });
    if (videoRef.current) videoRef.current.value = "";
  };

  const removeVideo = () => {
    if (videoFile?.preview) URL.revokeObjectURL(videoFile.preview);
    setVideoFile(null);
  };

  const removeImage = (index) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllImages = () => {
    setImageFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Real link preview: fetches Open Graph metadata (title, description,
  // thumbnail image) from /api/link-preview instead of faking a card from
  // just the domain name. Debounced so we don't hit the API on every
  // keystroke while the user is still typing/pasting the URL. ──
  const fetchLinkPreview = async (rawUrl) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      setLinkPreview(null);
      setFetchingPreview(false);
      return;
    }

    setFetchingPreview(true);
    try {
      const res = await axios.get("/api/link-preview", {
        params: { url: parsedUrl.toString() },
      });
      setLinkPreview(res.data);
    } catch {
      // API failed — fall back to a plain domain card rather than nothing
      const domain = parsedUrl.hostname.replace(/^www\./, "");
      setLinkPreview({
        url: parsedUrl.toString(),
        domain,
        title: `Link from ${domain}`,
        desc: parsedUrl.toString(),
        image: null,
      });
    } finally {
      setFetchingPreview(false);
    }
  };

  const handleLinkInput = (val) => {
    setLinkUrl(val);

    if (linkDebounceRef.current) clearTimeout(linkDebounceRef.current);

    if (!val.trim()) {
      setLinkPreview(null);
      setFetchingPreview(false);
      return;
    }

    linkDebounceRef.current = setTimeout(() => {
      fetchLinkPreview(val.trim());
    }, LINK_PREVIEW_DEBOUNCE_MS);
  };

  const uploadImageToCloudinary = async (file, onProgress) => {
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", CLOUDINARY_PRESET);
    const res = await axios.post(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
      data,
      {
        onUploadProgress: (e) => onProgress(Math.round((e.loaded * 100) / e.total)),
      }
    );
    return res.data.secure_url;
  };

  // ── NEW: video upload uses Cloudinary's /video/upload endpoint ──
  const uploadVideoToCloudinary = async (file, onProgress) => {
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", CLOUDINARY_PRESET);
    data.append("resource_type", "video");
    const res = await axios.post(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/video/upload`,
      data,
      {
        onUploadProgress: (e) => onProgress(Math.round((e.loaded * 100) / e.total)),
      }
    );
    return res.data.secure_url;
  };

  const handleSubmit = async () => {
    if (!canPost || posting) return;
    setPosting(true);
    setError("");
    setUploadProgress(0);

    try {
      let imageUrls = [];
      let videoUrl = null;

      if (imageFiles.length > 0) {
        const total = imageFiles.length;
        for (let i = 0; i < total; i++) {
          const url = await uploadImageToCloudinary(imageFiles[i].file, (pct) => {
            const overall = Math.round(((i + pct / 100) / total) * 100);
            setUploadProgress(overall);
          });
          imageUrls.push(url);
        }
      } else if (videoFile) {
        videoUrl = await uploadVideoToCloudinary(videoFile.file, (pct) => {
          setUploadProgress(pct);
        });
      }

      const payload = {
        username: currentUser,
        text: text.trim() || null,
        image_url: imageUrls[0] || null,
        image_urls: imageUrls.length > 0 ? imageUrls : null,
        video_url: videoUrl, // ← NEW
        link: linkPreview || null,
        feeling: feeling || null,
        privacy,
      };

      const { data, error: insertErr } = await supabase
        .from("posts")
        .insert(payload)
        .select()
        .single();

      if (insertErr) throw insertErr;

      onPost({
        ...data,
        myReaction: null,
        reactionCounts: {},
        comments: [],
        showComments: false,
      });

      setText("");
      clearAllImages();
      removeVideo();
      setLinkUrl("");
      setLinkPreview(null);
      setFetchingPreview(false);
      setShowLinkInput(false);
      setFeeling("");
      setShowFeelings(false);
      setUploadProgress(0);
    } catch (err) {
      setError(err.message || "Failed to post. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="pf-composer">
      <div className="pf-composer-top">
        <div className="pf-avatar">{initials}</div>
        <div className="pf-composer-body">
          <textarea
            className="pf-composer-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`What's on your mind, ${currentUser}?`}
            rows={3}
          />

          {feeling && (
            <p className="pf-feeling-badge">— feeling {feeling}</p>
          )}

          {imageFiles.length > 0 && (
            <div className="pf-img-preview-grid">
              {imageFiles.map((img, idx) => (
                <div className="pf-img-preview-wrap" key={idx}>
                  <img src={img.preview} alt={`Preview ${idx + 1}`} className="pf-img-preview" />
                  <button
                    className="pf-img-clear"
                    onClick={() => removeImage(idx)}
                    aria-label="Remove image"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── NEW: video preview ── */}
          {videoFile && (
            <div className="pf-video-preview-wrap">
              <video
                src={videoFile.preview}
                controls
                className="pf-video-preview"
              />
              <button
                className="pf-img-clear"
                onClick={removeVideo}
                aria-label="Remove video"
              >
                ✕
              </button>
            </div>
          )}

          {showLinkInput && (
            <input
              type="url"
              className="pf-link-input"
              placeholder="Paste a URL…"
              value={linkUrl}
              onChange={(e) => handleLinkInput(e.target.value)}
            />
          )}

          {fetchingPreview && (
            <div className="pf-link-loading">Fetching link preview…</div>
          )}

          {!fetchingPreview && linkPreview && (
            <div className="pf-link-preview">
              {linkPreview.image && (
                <img
                  src={linkPreview.image}
                  alt=""
                  className="pf-link-image"
                  loading="lazy"
                />
              )}
              <div className="pf-link-bar" />
              <div className="pf-link-body">
                <p className="pf-link-domain">{linkPreview.domain}</p>
                <p className="pf-link-title">{linkPreview.title}</p>
                <p className="pf-link-desc">{linkPreview.desc}</p>
              </div>
            </div>
          )}

          {posting && uploadProgress > 0 && (
            <div className="pf-progress-wrap">
              <div className="pf-progress-bar-track">
                <div className="pf-progress-bar" style={{ width: `${uploadProgress}%` }} />
              </div>
              <span className="pf-progress-label">{uploadProgress}%</span>
            </div>
          )}

          {error && <p className="pf-error">{error}</p>}
        </div>
      </div>

      {showFeelings && (
        <div className="pf-feelings-grid">
          {FEELINGS.map((f) => (
            <button
              key={f}
              className={`pf-feeling-btn ${feeling === f ? "active" : ""}`}
              onClick={() => { setFeeling(feeling === f ? "" : f); setShowFeelings(false); }}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      <div className="pf-composer-footer">
        <div className="pf-attach-row">
          <label
            className="pf-attach-btn"
            title="Photo"
            style={videoFile ? { opacity: 0.4, cursor: "not-allowed" } : {}}
          >
            📷
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={handleImageSelect}
              disabled={imageFiles.length >= MAX_IMAGES || !!videoFile}
            />
          </label>

          {/* ── NEW: video attach button ── */}
          <label
            className="pf-attach-btn"
            title="Video"
            style={imageFiles.length > 0 ? { opacity: 0.4, cursor: "not-allowed" } : {}}
          >
            🎥
            <input
              ref={videoRef}
              type="file"
              accept="video/*"
              style={{ display: "none" }}
              onChange={handleVideoSelect}
              disabled={imageFiles.length > 0 || !!videoFile}
            />
          </label>

          <button
            className="pf-attach-btn"
            title="Link"
            onClick={() => setShowLinkInput((v) => !v)}
          >🔗</button>
          <button
            className="pf-attach-btn"
            title="Feeling"
            onClick={() => setShowFeelings((v) => !v)}
          >😊</button>

          <div className="pf-attach-wrap">
            <button
              className="pf-attach-btn"
              title="Emoji"
              type="button"
              onClick={() => setShowEmojiPicker((v) => !v)}
            >
              🙂
            </button>
            {showEmojiPicker && (
              <EmojiPicker
                onSelect={(emoji) => setText((t) => t + emoji)}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </div>

          {imageFiles.length > 0 && (
            <span className="pf-image-count">{imageFiles.length}/{MAX_IMAGES}</span>
          )}
        </div>

        <div className="pf-composer-actions">
          <select
            className="pf-privacy-select"
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value)}
          >
            {PRIVACY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.icon} {o.label}
              </option>
            ))}
          </select>

          <button
            className="pf-post-btn"
            onClick={handleSubmit}
            disabled={!canPost || posting}
          >
            {posting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostComposer;