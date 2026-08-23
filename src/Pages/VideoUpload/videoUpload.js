import React, { useState, useRef, useEffect } from "react";
import "./videoUpload.css";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { Link, useNavigate, useLocation } from "react-router-dom";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { supabase } from "../../config/supabase";
import RecordModal from "../RecordModal/RecordModal";
import { checkContent } from "../../Component/Moderation/useModerationFilter";
import { notifySubscribers } from "../../utils/notifications";
import { uploadToR2, buildTransformUrl, uploadVideoToR2 } from "../../utils/mediaUpload";

const INITIAL_FIELDS = {
  title: "",
  description: "",
  videoLink: "",
  thumbnail: "",
  videoType: "",
};

const resolveFeature = (state) => {
  if (!state) return { mode: null, data: null };
  if (state.remixData)       return { mode: "remix",       data: state.remixData };
  if (state.soundData)       return { mode: "sound",       data: state.soundData };
  if (state.collabData)      return { mode: "collab",      data: state.collabData };
  if (state.greenScreenData) return { mode: "greenscreen", data: state.greenScreenData };
  if (state.cutData)         return { mode: "cut",         data: state.cutData };
  return { mode: null, data: null };
};

const featureDefaults = (mode, data) => {
  switch (mode) {
    case "remix":       return { title: `Remix of "${data.remixed_from_title}"`,        description: `🎬 Remixed from @${data.remixed_from_username}` };
    case "sound":       return { title: `Using sound from "${data.sound_from_title}"`,  description: `🎵 Sound by @${data.sound_from_username}` };
    case "collab":      return { title: `Collab with @${data.collab_with_username}`,    description: `🤝 Collab response to "${data.collab_with_title}"` };
    case "greenscreen": return { title: `Green Screen — "${data.bg_reel_title}"`,       description: `💚 Using background from @${data.bg_reel_username}` };
    case "cut":         return { title: `Cut from "${data.cut_from_title}"`,            description: `✂️ Cut by @${data.cut_from_username}` };
    default:            return { title: "", description: "" };
  }
};

const featureBanner = (mode, data) => {
  switch (mode) {
    case "remix":       return { emoji: "🎬", label: "Remixing",        title: `"${data.remixed_from_title}"`, by: `@${data.remixed_from_username}`, thumb: data.remixed_from_thumbnail, color: "#a855f7", hint: "Upload your own video response. Your remix will credit the original creator." };
    case "sound":       return { emoji: "🎵", label: "Using Sound From", title: `"${data.sound_from_title}"`,  by: `@${data.sound_from_username}`,    thumb: data.sound_from_thumbnail,    color: "#f97316", hint: "Upload your video. The original sound will be credited automatically." };
    case "collab":      return { emoji: "🤝", label: "Collabing With",   title: `"${data.collab_with_title}"`, by: `@${data.collab_with_username}`,   thumb: data.collab_with_thumbnail,   color: "#06b6d4", hint: "Upload your side of the collab. Both creators will be credited." };
    case "greenscreen": return { emoji: "💚", label: "Green Screen BG",  title: `"${data.bg_reel_title}"`,     by: `@${data.bg_reel_username}`,       thumb: data.bg_reel_thumbnail,       color: "#22c55e", hint: "Upload your video recorded against the green screen background." };
    case "cut":         return { emoji: "✂️", label: "Cutting From",     title: `"${data.cut_from_title}"`,    by: `@${data.cut_from_username}`,      thumb: data.cut_from_thumbnail,      color: "#f43f5e", hint: "Upload your edited cut. Original creator will be credited." };
    default:            return null;
  }
};

const VideoUpload = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { mode: featureMode, data: featureData } = resolveFeature(location.state);
  const isFeatureMode = !!featureMode;
  const banner        = featureBanner(featureMode, featureData);
  const defaults      = featureDefaults(featureMode, featureData);
  const remixData     = featureMode === "remix" ? featureData : null;

  useEffect(() => {
    const user = localStorage.getItem("username");
    if (!user) navigate("/signup");
  }, []);

  const [uploadMode,      setUploadMode]      = useState(isFeatureMode ? "reel" : "video");
  const [showRecordModal, setShowRecordModal] = useState(false);
  const currentUser = localStorage.getItem("username") || "";

  const [inputField, setInputField] = useState({
    ...INITIAL_FIELDS,
    title:       defaults.title,
    description: defaults.description,
  });

  const [loader,          setLoader]          = useState(false);
  const [thumbLoader,     setThumbLoader]     = useState(false);
  const [videoUploaded,   setVideoUploaded]   = useState(false);
  const [imageUploaded,   setImageUploaded]   = useState(false);
  const [submitted,       setSubmitted]       = useState(false);
  const [error,           setError]           = useState("");
  const [saving,          setSaving]          = useState(false);
  const [thumbSource,     setThumbSource]     = useState("");
  const [uploadProgress,  setUploadProgress]  = useState(0);
  const [uploadSpeed,     setUploadSpeed]     = useState(0);
  const [timeRemaining,   setTimeRemaining]   = useState("");
  // ── Local, client-side preview of the picked video file. This is
  // independent of server-side thumbnail capture/upload, so the user
  // always gets a visual "your video is in" confirmation the moment
  // it finishes uploading — even if auto thumbnail capture fails. ──
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");

  const uploadStartTime  = useRef(null);
  const uploadedBytesRef = useRef(0);
  const durationRef      = useRef("00:00");
  const wakeLockRef      = useRef(null);
  const localPreviewRef  = useRef(""); // mirrors localPreviewUrl for safe cleanup

  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch (err) { console.warn("Wake Lock not available:", err.message); }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null; }
  };

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && loader && wakeLockRef.current === null)
        await requestWakeLock();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [loader]);

  // Revoke any local blob preview URL on unmount to avoid leaking memory.
  useEffect(() => {
    return () => {
      if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    };
  }, []);

  const clearLocalPreview = () => {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    localPreviewRef.current = "";
    setLocalPreviewUrl("");
  };

  const resetState = () => {
    setInputField({ ...INITIAL_FIELDS });
    setVideoUploaded(false);
    setImageUploaded(false);
    setThumbSource("");
    setError("");
    setUploadProgress(0);
    setUploadSpeed(0);
    setTimeRemaining("");
    uploadStartTime.current  = null;
    uploadedBytesRef.current = 0;
    durationRef.current      = "00:00";
    clearLocalPreview();
  };

  const switchMode = (mode) => { setUploadMode(mode); resetState(); };

  const updateSpeedAndETA = (loadedBytes, totalBytes) => {
    if (!uploadStartTime.current) return;
    const elapsed    = (Date.now() - uploadStartTime.current) / 1000;
    if (elapsed < 1) return;
    const speedBps   = loadedBytes / elapsed;
    const speedMBps  = speedBps / (1024 * 1024);
    const remaining  = totalBytes - loadedBytes;
    const remainSecs = remaining / speedBps;
    setUploadSpeed(speedMBps.toFixed(1));
    if (remainSecs > 3600)    setTimeRemaining(`~${Math.ceil(remainSecs / 3600)}h remaining`);
    else if (remainSecs > 60) setTimeRemaining(`~${Math.ceil(remainSecs / 60)} min remaining`);
    else                       setTimeRemaining(`~${Math.ceil(remainSecs)} sec remaining`);
  };

  const getVideoDuration = (file) => new Promise((resolve) => {
    const videoEl = document.createElement("video");
    videoEl.preload = "metadata";
    videoEl.onloadedmetadata = () => {
      window.URL.revokeObjectURL(videoEl.src);
      const totalSec = Math.floor(videoEl.duration);
      const hrs  = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      durationRef.current = hrs > 0
        ? `${String(hrs).padStart(2,"0")}:${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`
        : `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
      resolve(durationRef.current);
    };
    videoEl.src = URL.createObjectURL(file);
  });

  const captureThumbnail = (file) => new Promise((resolve, reject) => {
    const video  = document.createElement("video");
    const canvas = document.createElement("canvas");
    video.preload    = "auto";
    video.muted      = true;
    video.playsInline = true;
    let settled = false;
    const cleanup = () => URL.revokeObjectURL(video.src);
    const finish  = (result, err) => {
      if (settled) return;
      settled = true; cleanup();
      if (err) reject(err); else resolve(result);
    };
    const grabFrame = () => {
      try {
        canvas.width  = video.videoWidth  || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) { finish(null, new Error("Thumbnail capture failed.")); return; }
          finish(blob, null);
        }, "image/jpeg", 0.85);
      } catch (err) { finish(null, err); }
    };
    video.onloadedmetadata = () => {
      const dur    = video.duration || 0;
      const seekTo = dur > 2 ? 1 : dur / 2;
      try { video.currentTime = seekTo || 0.1; } catch (_) { grabFrame(); }
    };
    video.onseeked = () => {
      if ("requestVideoFrameCallback" in video) video.requestVideoFrameCallback(() => grabFrame());
      else setTimeout(grabFrame, 200);
    };
    video.onerror = () => finish(null, new Error("Failed to load video for thumbnail."));
    // Slightly shorter timeout so the UI doesn't feel stuck waiting on a
    // capture that's going to fail on this browser anyway — the local
    // preview (set immediately on file pick) already covers the user-facing
    // confirmation regardless of how this resolves.
    setTimeout(() => { if (!settled) finish(null, new Error("Thumbnail capture timed out.")); }, 6000);
    video.src = URL.createObjectURL(file);
    video.load();
  });

  // ── Thumbnail upload — goes through R2 (small file, fine for /api/upload) ──
  const uploadThumbnail = async (blob) => {
    const file = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
    const { url } = await uploadToR2(file);
    const transformedUrl = buildTransformUrl(url, { width: 640, height: 360, fit: "cover" });
    return transformedUrl;
  };

  const handleOnChangeInput = (event, name) => {
    setInputField((prev) => ({ ...prev, [name]: event.target.value }));
    setError("");
  };

  const uploadVideo = async (e) => {
    setLoader(true); setError(""); setUploadProgress(0); setUploadSpeed(0); setTimeRemaining("");
    uploadStartTime.current  = Date.now();
    uploadedBytesRef.current = 0;
    await requestWakeLock();
    const files = e.target.files;
    if (!files || files.length === 0) { setLoader(false); return; }
    const file = files[0];
    if (file.size > 4 * 1024 * 1024 * 1024) { setError("File too large. Maximum size is 4GB."); setLoader(false); return; }

    // Show a confirmation preview immediately from the local file — this
    // does not depend on captureThumbnail() or any network call, so it
    // always shows up the moment the upload finishes.
    clearLocalPreview();
    const localUrl = URL.createObjectURL(file);
    localPreviewRef.current = localUrl;
    setLocalPreviewUrl(localUrl);

    try {
      const [, thumbnailBlob] = await Promise.all([
        getVideoDuration(file),
        captureThumbnail(file).catch((err) => { console.warn("Client-side thumbnail capture failed:", err.message); return null; }),
      ]);

      const { url: videoUrl } = await uploadVideoToR2(file, (pct) => {
        setUploadProgress(pct);
        updateSpeedAndETA((pct / 100) * file.size, file.size);
      });

      let thumbnailUrl = inputField.thumbnail;
      if (!imageUploaded) {
        if (thumbnailBlob) {
          thumbnailUrl = await uploadThumbnail(thumbnailBlob);
          setThumbSource("auto");
        } else {
          // Server-side auto thumbnail capture failed (no Cloudinary
          // fallback since the move to R2). We still have localPreviewUrl
          // to show the user their video, so the confirmation preview
          // isn't lost — it just won't be the DB thumbnail_url yet.
          console.warn("Auto thumbnail capture failed; showing local preview instead.");
        }
      }

      setInputField((prev) => ({ ...prev, videoLink: videoUrl, thumbnail: thumbnailUrl }));
      setVideoUploaded(true); setUploadProgress(100); setLoader(false); releaseWakeLock();
    } catch (err) {
      setLoader(false); setUploadProgress(0); setTimeRemaining("");
      setError(err.message || "Upload failed. Please try again.");
      console.error("Upload error:", err); releaseWakeLock();
    }
  };

  // ── Manual thumbnail upload — goes to R2 ──
  const uploadManualThumbnail = async (e) => {
    setThumbLoader(true); setError("");
    const files = e.target.files;
    if (!files || files.length === 0) { setThumbLoader(false); return; }
    try {
      const { url } = await uploadToR2(files[0]);
      const transformedUrl = buildTransformUrl(url, { width: 640, height: 360, fit: "cover" });
      setInputField((prev) => ({ ...prev, thumbnail: transformedUrl }));
      setImageUploaded(true); setThumbSource("manual"); setThumbLoader(false);
    } catch (err) {
      setThumbLoader(false);
      setError("Thumbnail upload failed. Please try again.");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Subscriber notifications on upload now go through the SHARED helper
  // (src/utils/notifications.js) instead of a locally duplicated copy —
  // see notifySubscribers(...) calls inside handleSubmit below. This keeps
  // the UUID-vs-username subscriber resolution logic in exactly one place
  // so future fixes (RLS issues, resolution edge cases, etc.) don't have
  // to be made twice and can't silently drift apart between call sites.
  // ─────────────────────────────────────────────────────────────────────────

  const notifyRemixedCreator = async (title, contentId) => {
    if (!remixData) return;
    const remixerUsername = localStorage.getItem("username");
    await supabase.from("notifications").insert({
      recipient_username: remixData.remixed_from_username,
      sender_username:    remixerUsername,
      type:               "upload",
      message:            `@${remixerUsername} remixed your reel "${remixData.remixed_from_title}" with "${title}" 🎬`,
      is_read:            false,
      content_id:         contentId,
      content_type:       "reel",
    });
  };

  const notifyFeatureCreator = async (title, contentId) => {
    const senderUsername = localStorage.getItem("username");
    const notifMap = {
      sound:       { to: featureData?.sound_from_username,  msg: `@${senderUsername} used your sound in "${title}" 🎵` },
      collab:      { to: featureData?.collab_with_username, msg: `@${senderUsername} posted a collab response to "${featureData?.collab_with_title}": "${title}" 🤝` },
      greenscreen: { to: featureData?.bg_reel_username,     msg: `@${senderUsername} used your reel as a green screen background in "${title}" 💚` },
      cut:         { to: featureData?.cut_from_username,    msg: `@${senderUsername} cut your reel into "${title}" ✂️` },
    };
    const notif = notifMap[featureMode];
    if (!notif || !notif.to || notif.to === senderUsername) return;
    await supabase.from("notifications").insert({
      recipient_username: notif.to,
      sender_username:    senderUsername,
      type:               "upload",
      message:            notif.msg,
      is_read:            false,
      content_id:         contentId,
      content_type:       "reel",
    });
  };

  // ── handleSubmit — with moderation check INSIDE the function ──────────────
  const handleSubmit = async () => {
    if (!inputField.title)       return setError("Please enter a title.");
    if (!inputField.description) return setError("Please enter a description.");
    if (!inputField.videoLink)   return setError("Please upload a video first.");
    if (uploadMode === "video" && !isFeatureMode && !inputField.videoType)
      return setError("Please enter a category.");

    setSaving(true);
    setError("");

    try {
      const { isClean, violatingWord } = await checkContent(
        inputField.title,
        inputField.description,
        inputField.videoType || ""
      );
      if (!isClean) {
        setSaving(false);
        setError(`❌ Content violates community guidelines (contains "${violatingWord}"). Please review our Community Guidelines before uploading.`);
        return;
      }
    } catch (moderationErr) {
      console.warn("Moderation check failed, proceeding:", moderationErr);
    }

    try {
      const uploaderUsername = localStorage.getItem("username") || "anonymous";

      if (uploadMode === "video" && !isFeatureMode) {
        const videoPayload = {
          title:         inputField.title,
          description:   inputField.description,
          video_url:     inputField.videoLink,
          thumbnail_url: inputField.thumbnail,
          category:      inputField.videoType,
          channel:       localStorage.getItem("username") || "Anonymous",
          username:      uploaderUsername,
          duration:      durationRef.current,
        };

        const { data: newVideo, error: videoError } = await supabase
          .from("videos")
          .insert([videoPayload])
          .select()
          .single();
        if (videoError) throw new Error(videoError.message);

        await notifySubscribers(uploaderUsername, {
          type: "video",
          message: `${uploaderUsername} uploaded a new video: "${inputField.title}"`,
          contentId: newVideo.id,
          contentType: "video",
        });
      } else {
        const reelPayload = {
          title:       inputField.title,
          description: inputField.description,
          video_url:   inputField.videoLink,
          thumbnail:   inputField.thumbnail,
          uploaded_by: localStorage.getItem("username") || "Anonymous",
          username:    uploaderUsername.toLowerCase().replace(/\s+/g, ""),
          duration:    durationRef.current,
          likes:       0,
          comments:    0,
        };

        if (featureMode === "remix" && featureData) {
          reelPayload.remixed_from_id       = featureData.remixed_from_id;
          reelPayload.remixed_from_username = featureData.remixed_from_username;
        }

        const { data: newReel, error: reelError } = await supabase
          .from("reels")
          .insert([reelPayload])
          .select()
          .single();
        if (reelError) throw new Error(reelError.message);

        if (featureMode === "remix") await notifyRemixedCreator(inputField.title, newReel.id);
        else if (featureMode)        await notifyFeatureCreator(inputField.title, newReel.id);

        await notifySubscribers(uploaderUsername, {
          type: "reel",
          message: `${uploaderUsername} uploaded a new reel: "${inputField.title}"`,
          contentId: newReel.id,
          contentType: "reel",
        });
      }

      setSaving(false);
      setSubmitted(true);
    } catch (err) {
      setSaving(false);
      setError(err.message || "Failed to save. Please try again.");
      console.error("Save error:", err);
    }
  };

  const uploadLabel = isFeatureMode
    ? (banner?.emoji + " " + banner?.label)
    : uploadMode === "reel" ? "Upload Reel" : "Upload Video";

  const submitLabel = saving
    ? "Saving..."
    : loader
      ? `Uploading... ${uploadProgress}%`
      : isFeatureMode
        ? `Post ${banner?.emoji}`
        : `Upload ${uploadMode === "reel" ? "Reel" : "Video"}`;

  // The image shown to the user for confirmation: prefer the real
  // (server) thumbnail once it's ready, otherwise fall back to the
  // local blob preview so a preview is ALWAYS shown post-upload.
  const displayThumb = inputField.thumbnail || localPreviewUrl;

  if (submitted) return (
    <div className="videoUpload">
      <div className="uploadBox">
        <div className="upload_success_screen">
          <CheckCircleOutlineIcon sx={{ fontSize: "64px", color: "#4caf50" }} />
          <h2>{isFeatureMode ? banner?.label : uploadMode === "reel" ? "Reel" : "Video"} Uploaded Successfully!</h2>
          <p>Your {isFeatureMode ? featureMode : uploadMode === "reel" ? "reel" : "video"} is now live on ZIXPLON&reg;</p>
          {isFeatureMode && (
            <p style={{ fontSize: "13px", color: "#7c3aed", fontWeight: 700 }}>
              {banner?.emoji} {banner?.label} {banner?.by}
            </p>
          )}
          <video src={inputField.videoLink} poster={displayThumb} controls className="upload_success_preview" />
          <h3>{inputField.title}</h3>
          <p className="upload_success_meta">
            {uploadMode === "video" && !isFeatureMode ? `${inputField.videoType} • ` : ""}
            {inputField.description}
          </p>
          <div className="uploadBtns">
            <div className="uploadBtns-form" onClick={() => { setSubmitted(false); resetState(); }}>Upload Another</div>
            <div className="uploadBtns-form" onClick={() => navigate(isFeatureMode || uploadMode === "reel" ? "/reels" : "/")}>
              {isFeatureMode || uploadMode === "reel" ? "Go to Reels" : "Go Home"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="videoUpload">
      <div className="uploadBox">

        <div className="uploadVideoTitle">
          <CloudUploadIcon sx={{ fontSize: "54px", color: "orange" }} />
          {isFeatureMode ? `${banner?.emoji} ${banner?.label}` : "Upload"}
        </div>

        {isFeatureMode && banner && (
          <div className="upload_feature_banner" style={{ "--feature-color": banner.color }}>
            <img src={banner.thumb} alt="source" className="upload_feature_thumb" />
            <div className="upload_feature_banner_text">
              <span className="upload_feature_label" style={{ color: banner.color }}>
                {banner.emoji} {banner.label}
              </span>
              <span className="upload_feature_title">{banner.title}</span>
              <span className="upload_feature_by">by {banner.by}</span>
            </div>
          </div>
        )}

        {!isFeatureMode && (
          <div className="upload_mode_toggle">
            <div className={`upload_mode_btn ${uploadMode === "video" ? "active" : ""}`} onClick={() => switchMode("video")}>🎬 Video</div>
            <div className={`upload_mode_btn ${uploadMode === "reel"  ? "active" : ""}`} onClick={() => switchMode("reel")}>📱 Shorts</div>
            <div className="upload_mode_btn" onClick={() => setShowRecordModal(true)} style={{ position:"relative", cursor:"pointer" }}>
              <span style={{ position:"absolute", top:"-4px", right:"-4px", width:"8px", height:"8px", borderRadius:"50%", background:"#ff0000", animation:"recordPulse 1.2s infinite" }} />
              🔴 Record / Live
            </div>
          </div>
        )}

        {showRecordModal && <RecordModal onClose={() => setShowRecordModal(false)} currentUser={currentUser} />}

        <style>{`
          @keyframes recordPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50%       { opacity: 0.4; transform: scale(1.3); }
          }
        `}</style>

        {isFeatureMode && banner?.hint && <p className="upload_mode_hint">{banner.hint}</p>}
        {!isFeatureMode && uploadMode === "reel" && (
          <p className="upload_mode_hint">Reels are short vertical videos — they appear in the Reels / Shorts section.</p>
        )}

        <div className="uploadForm">
          <input
            type="text"
            value={inputField.title}
            onChange={(e) => handleOnChangeInput(e, "title")}
            placeholder={isFeatureMode ? `${banner?.emoji} Title` : uploadMode === "reel" ? "Reel Title" : "Title of Video"}
            className="uploadFormInputs"
          />
          <input
            type="text"
            value={inputField.description}
            onChange={(e) => handleOnChangeInput(e, "description")}
            placeholder="Description"
            className="uploadFormInputs"
          />
          {uploadMode === "video" && !isFeatureMode && (
            <input
              type="text"
              value={inputField.videoType}
              onChange={(e) => handleOnChangeInput(e, "videoType")}
              placeholder="Category (e.g. Music, Gaming, News)"
              className="uploadFormInputs"
            />
          )}

          <div className="upload_file_row">
            <span className="upload_file_label">
              {isFeatureMode ? `${banner?.emoji} Your Video` : uploadMode === "reel" ? "Reel Video" : "Video"}
            </span>
            <input type="file" accept="video/mp4,video/webm,video/*" onChange={uploadVideo} style={{ display:"none" }} id="videoInput" />
            <span className="upload_file_btn" onClick={() => document.getElementById("videoInput").click()}>
              {videoUploaded ? "✅ Change Video" : "🎬 Choose Video"}
            </span>
          </div>

          <div className="upload_file_row">
            <span className="upload_file_label">
              Thumbnail
              <span style={{ color:"#888", fontSize:"0.75rem", marginLeft:"6px" }}>(optional)</span>
            </span>
            <input type="file" accept="image/*" onChange={uploadManualThumbnail} style={{ display:"none" }} id="thumbnailInput" />
            <span className="upload_file_btn" onClick={() => document.getElementById("thumbnailInput").click()}>
              {imageUploaded ? "✅ Change Thumbnail" : "📷 Choose Image"}
            </span>
            {thumbLoader && <CircularProgress size={20} sx={{ color:"orange", ml:1 }} />}
          </div>

          {displayThumb && (
            <div className="upload_thumb_row">
              <img src={displayThumb} alt="Thumbnail preview" className="upload_thumb_preview" />
              <span style={{ color:"#888", fontSize:"0.78rem", marginTop:"4px" }}>
                {thumbSource === "manual"
                  ? "✏️ Custom thumbnail"
                  : inputField.thumbnail
                    ? "🎞️ Auto-captured from video"
                    : "📼 Preview (auto thumbnail pending/unavailable)"}
              </span>
            </div>
          )}

          {loader && (
            <Box sx={{ display:"flex", flexDirection:"column", gap:"8px", width:"100%" }}>
              <Box sx={{ display:"flex", alignItems:"center", gap:"12px" }}>
                <CircularProgress size={28} sx={{ color:"orange" }} />
                <span style={{ color:"#aaa", fontSize:"0.9rem" }}>☁️ Uploading to Zixplon...</span>
              </Box>
              <div style={{ width:"100%", background:"#333", borderRadius:"8px", height:"8px" }}>
                <div style={{ width:`${uploadProgress}%`, background:"orange", height:"100%", borderRadius:"8px", transition:"width 0.3s" }} />
              </div>
              <Box sx={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ color:"#666", fontSize:"0.8rem" }}>
                  {uploadProgress}% complete{uploadSpeed > 0 ? ` • ${uploadSpeed} MB/s` : ""}
                </span>
                {timeRemaining && <span style={{ color:"orange", fontSize:"0.8rem", fontWeight:500 }}>⏱ {timeRemaining}</span>}
              </Box>
            </Box>
          )}

          {error && <p className="upload_error_msg">{error}</p>}
        </div>

        <div className="uploadBtns">
          <div
            className={`uploadBtns-form ${loader || saving || thumbLoader ? "uploadBtns-disabled" : ""}`}
            onClick={!loader && !saving && !thumbLoader ? handleSubmit : undefined}
          >
            {submitLabel}
          </div>
          {isFeatureMode ? (
            <div className="uploadBtns-form" onClick={() => navigate(-1)}>Cancel</div>
          ) : (
            <Link to={"/"} className="uploadBtns-form">Home</Link>
          )}
        </div>

      </div>
    </div>
  );
};

export default VideoUpload;