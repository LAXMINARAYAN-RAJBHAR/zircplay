import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../../config/supabase";
import axios from "axios";
import EmojiPicker from "./EmojiPicker";
import { uploadToR2, buildTransformUrl, uploadVideoToR2 } from "../../utils/mediaUpload";

// NOTE: no cap on image count anymore — ImageGrid/HomeImageGrid already
// render any number of images fine (4 visible tiles + a "+N" overlay for
// the rest, and PhotoViewer swipes through the full array). Uploads now
// go out sequentially regardless of count; a very large batch will just
// take proportionally longer and move the progress bar more slowly.
const MAX_VIDEO_MB = 100; // adjust as needed — R2 has no per-request size ceiling like Vercel's function body did
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

// ─────────────────────────────────────────────────────────────────────────────
// captureThumbnail — v2: seeked-timeout fallback. Ports the same fixed
// approach from VideoUpload.jsx over to post-video uploads.
//
// v1 root cause (black thumbnail): a video element that's never attached
// to the DOM can report a "successful" seek without actually decoding a
// real frame at that position, so ctx.drawImage() grabs whatever's left
// in the decode buffer (usually black) instead of the real frame. v1 fix:
// attach off-screen (not display:none — some browsers skip decoding those
// too), force a decode by briefly play()-ing then pause()-ing after the
// seek, and always clean up the element whether capture succeeds or fails.
//
// v2 root cause ("Thumbnail capture timed out."): confirmed in production
// via console log on a recently-uploaded, longer-form video. That error
// can only fire once a seek was actually attempted (video.currentTime was
// set) — meaning duration resolved fine, but the browser's `seeked` event
// never arrived within the full 10s window. This matches MP4 files where
// the moov atom (metadata index) sits at the END of the file rather than
// the beginning ("not fast-start" encoded) — the browser has to fetch/
// parse a large chunk of the Blob just to resolve ANY seek target, which
// can stall past the old fallback windows (the only earlier fallback, at
// 3s, explicitly skips when a seek WAS attempted). v2 fix: seek closer to
// the very start of the file (cheaper once the index is available), and
// add a NEW 5s fallback that grabs whatever frame is currently decoded if
// a seek was attempted but `seeked` never fired, rather than waiting out
// the full 10s and losing the thumbnail entirely.
// ─────────────────────────────────────────────────────────────────────────────
const captureThumbnail = (file) => new Promise((resolve, reject) => {
  const video = document.createElement("video");
  const canvas = document.createElement("canvas");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;

  video.style.position = "fixed";
  video.style.top = "-9999px";
  video.style.left = "-9999px";
  video.style.width = "1px";
  video.style.height = "1px";
  video.setAttribute("aria-hidden", "true");
  document.body.appendChild(video);

  let settled = false;
  let seekAttempted = false;

  const cleanup = () => {
    URL.revokeObjectURL(video.src);
    if (video.parentNode) video.parentNode.removeChild(video);
  };
  const finish = (result, err) => {
    if (settled) return;
    settled = true; cleanup();
    if (err) reject(err); else resolve(result);
  };

  const grabFrame = () => {
    try {
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 180;
      if (canvas.width === 0 || canvas.height === 0) {
        finish(null, new Error("Video has no dimensions yet."));
        return;
      }
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) { finish(null, new Error("Thumbnail capture failed.")); return; }
        finish(blob, null);
      }, "image/jpeg", 0.85);
    } catch (err) { finish(null, err); }
  };

  const trySeek = () => {
    if (seekAttempted || settled) return;
    const dur = video.duration;
    if (!isFinite(dur) || dur <= 0) return; // not ready yet — wait for next event
    seekAttempted = true;
    // v2 CHANGE: seek closer to the start (was: dur > 2 ? 1 : dur / 2).
    // For MP4s with the moov atom at the end of the file, the browser
    // needs to fetch/parse a large chunk of the file just to resolve
    // ANY seek target at all — keeping the target itself modest avoids
    // also over-requesting once that index is available.
    const seekTo = Math.min(0.5, dur / 2);
    try {
      video.currentTime = seekTo || 0.1;
    } catch (_) {
      grabFrame();
    }
  };

  video.onloadedmetadata = trySeek;
  video.ondurationchange = trySeek;
  video.onloadeddata = trySeek;

  video.onseeked = () => {
    const grabAfterDecode = () => {
      if ("requestVideoFrameCallback" in video) {
        video.requestVideoFrameCallback(() => grabFrame());
      } else {
        setTimeout(grabFrame, 200);
      }
    };

    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.then === "function") {
      playAttempt
        .then(() => {
          setTimeout(() => {
            try { video.pause(); } catch (_) {}
            grabAfterDecode();
          }, 50);
        })
        .catch(() => {
          grabAfterDecode();
        });
    } else {
      grabAfterDecode();
    }
  };

  video.onerror = () => finish(null, new Error("Failed to load video for thumbnail."));

  // Existing safety net: nothing seeked yet at all — grab whatever's loaded.
  setTimeout(() => {
    if (!settled && !seekAttempted && video.readyState >= 2) grabFrame();
  }, 3000);

  // v2 NEW: a seek WAS attempted (currentTime was set) but the `seeked`
  // event never fired — this is the "moov atom at the end" / large-file
  // stall case. Rather than waiting the full 10s and giving up entirely,
  // grab whatever frame is currently decoded once readyState allows it.
  setTimeout(() => {
    if (!settled && seekAttempted && video.readyState >= 2) {
      console.warn("seeked event never fired — grabbing current frame as fallback");
      grabFrame();
    }
  }, 5000);

  // Final fallback if truly nothing worked.
  setTimeout(() => { if (!settled) finish(null, new Error("Thumbnail capture timed out.")); }, 10000);

  video.src = URL.createObjectURL(file);
  video.load();
});

const PostComposer = ({ currentUser, onPost }) => {
  const [text, setText] = useState("");
  const [imageFiles, setImageFiles] = useState([]);
  const [videoFile, setVideoFile] = useState(null);
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
  const videoRef = useRef();
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

    // No cap — every selected file gets added.
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImageFiles((prev) => [...prev, { file, preview: ev.target.result }]);
      };
      reader.readAsDataURL(file);
    });

    if (fileRef.current) fileRef.current.value = "";
  };

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

  // ── Image upload — R2 ──
  const uploadImage = async (file, onProgress) => {
    const { url } = await uploadToR2(file, onProgress);
    return buildTransformUrl(url, { width: 800, quality: 85 });
  };

  // ── Thumbnail upload — mirrors VideoUpload.jsx's uploadThumbnail:
  // small file, goes through R2 directly (no progress callback needed).
  // format: "jpeg" (not the default "webp") because this becomes the
  // og:image for shared post links, and WhatsApp's link-preview crawler
  // does not render webp images.
  const uploadThumbnail = async (blob) => {
    const file = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
    const { url } = await uploadToR2(file);
    return buildTransformUrl(url, { width: 640, height: 360, fit: "cover", format: "jpeg" });
  };

  const handleSubmit = async () => {
    if (!canPost || posting) return;
    setPosting(true);
    setError("");
    setUploadProgress(0);

    try {
      let imageUrls = [];
      let videoUrl = null;
      let thumbnailUrl = null;

      if (imageFiles.length > 0) {
        const total = imageFiles.length;
        for (let i = 0; i < total; i++) {
          const url = await uploadImage(imageFiles[i].file, (pct) => {
            const overall = Math.round(((i + pct / 100) / total) * 100);
            setUploadProgress(overall);
          });
          imageUrls.push(url);
        }
      } else if (videoFile) {
        // Capture a thumbnail in parallel with the video upload itself,
        // same as VideoUpload.jsx does. If capture fails (client decode
        // issue, unsupported codec, etc.) we log it and continue — the
        // post still goes out with video_url set, it just won't have a
        // thumbnail_url until this succeeds on a retry/edit. This never
        // blocks or fails the actual post submission.
        const [{ url }, thumbnailBlob] = await Promise.all([
          uploadVideoToR2(videoFile.file, (pct) => {
            setUploadProgress(pct);
          }),
          captureThumbnail(videoFile.file).catch((err) => {
            console.warn("Post video thumbnail capture failed:", err.message);
            return null;
          }),
        ]);
        videoUrl = url;
        if (thumbnailBlob) {
          thumbnailUrl = await uploadThumbnail(thumbnailBlob);
        }
      }

      const payload = {
        username: currentUser,
        text: text.trim() || null,
        image_url: imageUrls[0] || null,
        image_urls: imageUrls.length > 0 ? imageUrls : null,
        video_url: videoUrl,
        // Requires a migration —
        //   alter table posts add column thumbnail_url text;
        // Used by /api/og.js as the shared-link preview image for video
        // posts, and could also be surfaced as a static poster image in
        // PostVideo.jsx later if wanted (currently PostVideo relies on
        // the <video preload="metadata"> tag's own native first frame
        // instead, which still works fine in-app — this column is purely
        // for the share-link crawler case, which can't do that).
        thumbnail_url: thumbnailUrl,
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
              disabled={!!videoFile}
            />
          </label>

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
            <span className="pf-image-count">{imageFiles.length} selected</span>
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