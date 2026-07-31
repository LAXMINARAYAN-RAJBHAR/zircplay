import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import "./MessagesPanel.css";
import { usePresence } from "../../context/PresenceContext";
import { fetchUserGroups } from "../../utils/groupChat";
import { fetchUserBroadcastLists } from "../../utils/broadcast";
import NewGroupOrBroadcastModal from "../../Component/Messages/NewGroupOrBroadcastModal";
import GroupChatWindow from "../../Component/Messages/GroupChatWindow";
import BroadcastComposeWindow from "../../Component/Messages/BroadcastComposeWindow";

const EMOJI_ONLY_REGEX = /^(\p{Extended_Pictographic}|\u200d|\ufe0f|\s)+$/u;

const isEmojiOnlyMessage = (str) => {
  if (!str) return false;
  const trimmed = str.trim();
  if (!trimmed) return false;
  return EMOJI_ONLY_REGEX.test(trimmed) && Array.from(trimmed).length <= 6;
};

const EMOJI_SPLIT_REGEX =
  /(\p{Extended_Pictographic}(?:\u200d\p{Extended_Pictographic})*\ufe0f?)/gu;
const EMOJI_TEST_REGEX =
  /^\p{Extended_Pictographic}(?:\u200d\p{Extended_Pictographic})*\ufe0f?$/u;

// ── URL detection ──
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
const isUrl = (str) => /^(https?:\/\/[^\s]+|www\.[^\s]+)$/i.test(str);
const truncateUrl = (url, max = 40) => {
  const clean = url.replace(/^https?:\/\//, "").replace(/^www\./, "");
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
};

// Splits text into URL / emoji / plain-text segments and renders each
// appropriately — URLs become clickable links, emoji get a contrast halo.
const renderMessageText = (str, mine) => {
  if (!str) return null;

  const urlParts = str
    .split(URL_REGEX)
    .filter((p) => p !== undefined && p !== "");

  return urlParts.map((part, i) => {
    if (isUrl(part)) {
      const href = part.startsWith("www.") ? `https://${part}` : part;
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`mp-inline-link ${mine ? "mine" : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          🔗 {truncateUrl(part)}
        </a>
      );
    }

    const emojiParts = part.split(EMOJI_SPLIT_REGEX).filter((p) => p !== "");
    return emojiParts.map((sub, j) =>
      EMOJI_TEST_REGEX.test(sub) ? (
        <span key={`${i}-${j}`} className={mine ? "mp-inline-emoji-halo" : ""}>
          {sub}
        </span>
      ) : (
        <React.Fragment key={`${i}-${j}`}>{sub}</React.Fragment>
      ),
    );
  });
};

// ── Maps a filename's extension to an icon + label + brand color ──
const getFileTypeInfo = (filename) => {
  const ext = (filename || "").split(".").pop()?.toLowerCase() || "";
  const map = {
    pdf: { icon: "📕", label: "PDF", color: "#e11d48" },
    doc: { icon: "📘", label: "DOC", color: "#2563eb" },
    docx: { icon: "📘", label: "DOCX", color: "#2563eb" },
    xls: { icon: "📗", label: "XLS", color: "#15803d" },
    xlsx: { icon: "📗", label: "XLSX", color: "#15803d" },
    ppt: { icon: "📙", label: "PPT", color: "#ea580c" },
    pptx: { icon: "📙", label: "PPTX", color: "#ea580c" },
    txt: { icon: "📄", label: "TXT", color: "#64748b" },
    zip: { icon: "🗜️", label: "ZIP", color: "#7c3aed" },
    rar: { icon: "🗜️", label: "RAR", color: "#7c3aed" },
    csv: { icon: "📊", label: "CSV", color: "#15803d" },
  };
  return (
    map[ext] || {
      icon: "📎",
      label: ext ? ext.toUpperCase() : "FILE",
      color: "#9e1226",
    }
  );
};

const formatFileSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ── Formats a whole number of seconds as m:ss (used by both the
// recording timer and the voice-message player) ──
const formatDuration = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const CLOUDINARY_CLOUD_NAME = "uaa756bj";
const CLOUDINARY_UPLOAD_PRESET = "zixplon-data";

// Hard cap on recording length so a stray open mic can't produce a
// huge upload. Auto-stops and hands off to the preview stage.
const MAX_VOICE_SECONDS = 180;

const EMOJI_LIST = [
  "😀",
  "😁",
  "😂",
  "🤣",
  "😊",
  "😍",
  "😘",
  "😜",
  "🤔",
  "🙄",
  "😴",
  "🤗",
  "🥳",
  "😎",
  "🤩",
  "🥺",
  "😭",
  "😡",
  "🤯",
  "🤝",
  "👍",
  "👎",
  "👏",
  "🙏",
  "💪",
  "🔥",
  "✨",
  "🎉",
  "❤️",
  "💔",
  "💯",
  "👀",
  "🙌",
  "🤷",
  "😅",
  "😇",
  "🤤",
  "😬",
  "🥶",
  "🤒",
  "🎂",
  "🎁",
  "☕",
  "🍕",
  "🍔",
  "🍿",
  "⚽",
  "🏀",
  "🎮",
  "📸",
];

// ── Quick-reaction emoji set for message/attachment reactions ──
const REACTION_EMOJIS = ["❤️", "😂", "👍", "😮", "😢", "🙏"];

const timeAgo = (dateStr) => {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

const timeShort = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const attachmentTypeFromFile = (file) => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
};

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

// ── Compact custom audio player used for both the pre-send preview and
// the sent voice-message bubble. Built instead of native <audio controls>
// so it matches the bubble styling and works consistently across browsers. ──
const VoiceMessagePlayer = ({ src, mine, initialDuration }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [currentTime, setCurrentTime] = useState(0);

  // Chrome (and some other browsers) report Infinity for the duration of
  // MediaRecorder-produced webm blobs until you seek near the end once.
  // This nudges the browser into calculating the real duration.
  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!isFinite(audio.duration)) {
      const onTimeUpdate = () => {
        audio.removeEventListener("timeupdate", onTimeUpdate);
        audio.currentTime = 0;
        setDuration(isFinite(audio.duration) ? audio.duration : 0);
      };
      audio.addEventListener("timeupdate", onTimeUpdate);
      audio.currentTime = 1e101;
    } else {
      setDuration(audio.duration);
    }
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.pause();
    else audio.play().catch(() => {});
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  };

  const displaySeconds = currentTime > 0 ? currentTime : duration;

  return (
    <div className={`mp-voice-player ${mine ? "mine" : ""}`}>
      <button
        type="button"
        className="mp-voice-play-btn"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>
      <div className="mp-voice-track" onClick={handleSeek}>
        <div
          className="mp-voice-track-fill"
          style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
        />
      </div>
      <span className="mp-voice-time">{formatDuration(displaySeconds)}</span>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        style={{ display: "none" }}
      />
    </div>
  );
};

const MessagesPanel = ({ initialUsername, onClose }) => {
  const currentUser = localStorage.getItem("username") || "";

  const [activeUsername, setActiveUsername] = useState(initialUsername || null);
  const [conversations, setConversations] = useState([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [inboxSearch, setInboxSearch] = useState("");
  const [profileResults, setProfileResults] = useState([]);
  const [searchingProfiles, setSearchingProfiles] = useState(false);

  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef();
  const emojiBtnRef = useRef();

  const fileInputRef = useRef();
  const [pendingAttachment, setPendingAttachment] = useState(null); // { file, previewUrl, type, name, size, duration? }
  const [uploading, setUploading] = useState(false);

  // ── Voice message recording ──
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recordingSecondsRef = useRef(0);
  const streamRef = useRef(null);

  // ── Reactions / inline editing ──
  const [openReactionFor, setOpenReactionFor] = useState(null); // message id
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  // ── Presence / last-seen ──
  const { onlineUsers, getLastSeen } = usePresence();
  const [activeUserLastSeen, setActiveUserLastSeen] = useState(null);

  // ── Group chat + Broadcast lists ──
  const [groups, setGroups] = useState([]);
  const [broadcastLists, setBroadcastLists] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null); // group object, or null
  const [activeBroadcast, setActiveBroadcast] = useState(null); // broadcast list object, or null
  const [showNewModal, setShowNewModal] = useState(null); // "group" | "broadcast" | null
  const [showNewMenu, setShowNewMenu] = useState(false);
  const newMenuRef = useRef();
  const newMenuBtnRef = useRef();

  useEffect(() => {
    if (!activeUsername || onlineUsers.has(activeUsername)) {
      setActiveUserLastSeen(null);
      return;
    }
    let active = true;
    getLastSeen(activeUsername).then((val) => {
      if (active) setActiveUserLastSeen(val);
    });
    return () => {
      active = false;
    };
  }, [activeUsername, onlineUsers, getLastSeen]);

  const bottomRef = useRef();
  const panelRef = useRef();
  const inputRef = useRef();

  const [position, setPosition] = useState(null);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const isMobile = () => window.innerWidth <= 768;

  // ── Mobile back-button: pressing back should step out ONE level at a
  // time — first press closes an open chat/group/broadcast (back to the
  // inbox), a second press then closes the whole Messages panel. We
  // mirror this with a history-depth model: depth 0 = whatever page was
  // showing before the panel opened, depth 1 = panel open (inbox), depth
  // 2 = a chat/group/broadcast open on top of the panel. Every close
  // action — hardware back, the on-screen back arrow, or any ✕ button —
  // goes through this same depth so the history stack and UI state never
  // drift out of sync with each other.
  const historyDepthRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Push a base history entry (depth 1) the moment the panel mounts on
  // mobile, so there's always one "level" to consume before the panel
  // actually closes.
  useEffect(() => {
    if (!isMobile()) return;

    console.log("[MP-DEBUG] mount: pushing depth 1, history.length before =", window.history.length);
    window.history.pushState({ mpDepth: 1 }, "");
    historyDepthRef.current = 1;
    console.log("[MP-DEBUG] mount: history.length after =", window.history.length);

    return () => {
      console.log("[MP-DEBUG] unmount: resetting historyDepthRef (was", historyDepthRef.current, ")");
      historyDepthRef.current = 0;
    };
  }, []);

  // Push a second history entry (depth 2) the moment a chat/group/
  // broadcast opens on mobile. We only ever push here — closing is
  // always done by popping via closeDetail()/closePanel() below, which
  // keeps historyDepthRef and the real browser history stack in sync.
  useEffect(() => {
    if (!isMobile()) return;

    const anyDetailOpen = !!(activeUsername || activeGroup || activeBroadcast);

    console.log("[MP-DEBUG] detail-effect fired: anyDetailOpen =", anyDetailOpen, "historyDepthRef =", historyDepthRef.current, "history.length =", window.history.length);

    if (anyDetailOpen && historyDepthRef.current < 2) {
      console.log("[MP-DEBUG] pushing depth 2");
      window.history.pushState({ mpDepth: 2 }, "");
      historyDepthRef.current = 2;
      console.log("[MP-DEBUG] after push depth 2: history.length =", window.history.length);
    }
  }, [activeUsername, activeGroup, activeBroadcast]);

  // Intercept the back button (hardware or gesture) one level at a time,
  // driven entirely by the depth stored in history.state rather than by
  // separate boolean flags — this is what keeps repeated open/close
  // cycles from ever getting out of sync.
  useEffect(() => {
    if (!isMobile()) return;

    const handlePopState = (e) => {
      console.log("[MP-DEBUG] popstate fired. e.state =", e.state, "isMounted =", isMountedRef.current, "historyDepthRef (before) =", historyDepthRef.current, "history.length =", window.history.length);

      if (!isMountedRef.current) return;

      const depth = e.state?.mpDepth ?? 0;
      console.log("[MP-DEBUG] resolved depth =", depth);

      if (depth < 2 && historyDepthRef.current >= 2) {
        console.log("[MP-DEBUG] closing detail (chat/group/broadcast)");
        setActiveUsername(null);
        setActiveGroup(null);
        setActiveBroadcast(null);
      }

      if (depth < 1) {
        console.log("[MP-DEBUG] calling onClose() -- panel closing!");
        onClose();
      }

      historyDepthRef.current = depth;
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [onClose]);

  // Close just the open chat/group/broadcast, back to the inbox list.
  // On mobile this pops the depth-2 history entry (triggering the same
  // popstate handler the hardware back button uses); on desktop there's
  // no history entry to pop, so it just updates state directly.
  const closeDetail = () => {
    if (isMobile() && historyDepthRef.current >= 2) {
      window.history.back();
    } else {
      setActiveUsername(null);
      setActiveGroup(null);
      setActiveBroadcast(null);
    }
  };

  // Close the whole Messages panel. On mobile this jumps back past
  // however many history entries the panel pushed (1 or 2) in a single
  // hop, so the popstate handler fires once with depth 0 and calls
  // onClose() — never leaving an orphaned history entry behind.
  const closePanel = () => {
    if (isMobile() && historyDepthRef.current >= 1) {
      window.history.go(-historyDepthRef.current);
    } else {
      onClose();
    }
  };

  const handleDragStart = (e) => {
    if (isMobile()) return;
    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    dragOffset.current = { x: clientX - rect.left, y: clientY - rect.top };
    setPosition({ x: rect.left, y: rect.top });
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const panel = panelRef.current;
      const w = panel?.offsetWidth || 700;
      const h = panel?.offsetHeight || 560;

      let x = clientX - dragOffset.current.x;
      let y = clientY - dragOffset.current.y;

      x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
      y = Math.max(8, Math.min(y, window.innerHeight - h - 8));

      setPosition({ x, y });
    };

    const handleUp = () => setDragging(false);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [dragging]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (e) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target) &&
        !emojiBtnRef.current.contains(e.target)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  // Close the reaction picker when clicking outside it
  useEffect(() => {
    if (!openReactionFor) return;
    const handleClickOutside = (e) => {
      if (
        !e.target.closest(".mp-reaction-picker") &&
        !e.target.closest(".mp-react-trigger")
      ) {
        setOpenReactionFor(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openReactionFor]);

  // Close the "New" menu (New Group / New Broadcast) when clicking outside it
  useEffect(() => {
    if (!showNewMenu) return;
    const handleClickOutside = (e) => {
      if (
        newMenuRef.current &&
        !newMenuRef.current.contains(e.target) &&
        newMenuBtnRef.current &&
        !newMenuBtnRef.current.contains(e.target)
      ) {
        setShowNewMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNewMenu]);

  // Safety net: if the panel unmounts (or the user navigates away) while
  // a recording is in progress, make sure the mic is released.
  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        try {
          mediaRecorderRef.current.onstop = null;
          mediaRecorderRef.current.stop();
        } catch {
          /* no-op */
        }
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      clearInterval(recordingTimerRef.current);
    };
  }, []);

  const insertEmoji = (emoji) => {
    setText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const getOtherUser = (conv) =>
    conv.user_a === currentUser ? conv.user_b : conv.user_a;

  const getTickStatus = (m) => {
    if (m.seen_at) return "seen";
    if (m.delivered_at) return "delivered";
    return "sent";
  };

  const isConvoUnread = (conv) => {
    if (!conv.last_message_at) return false;
    if (!conv.last_message_sender || conv.last_message_sender === currentUser)
      return false;
    const myLastRead =
      conv.user_a === currentUser ? conv.last_read_a : conv.last_read_b;
    if (!myLastRead) return true;
    return new Date(conv.last_message_at) > new Date(myLastRead);
  };

  const fetchConversations = useCallback(async () => {
    if (!currentUser) return;
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .or(`user_a.eq.${currentUser},user_b.eq.${currentUser}`)
      .order("last_message_at", { ascending: false });
    setConversations(data || []);
    setLoadingConvos(false);
  }, [currentUser]);

  useEffect(() => {
    fetchConversations();

    const channel = supabase
      .channel("conversations-realtime-panel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => fetchConversations(),
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchConversations]);

  // ── Fetch groups + broadcast lists the user belongs to / created ──
  const fetchGroupsAndBroadcasts = useCallback(async () => {
    if (!currentUser) return;
    const [g, b] = await Promise.all([
      fetchUserGroups(currentUser),
      fetchUserBroadcastLists(currentUser),
    ]);
    setGroups(g);
    setBroadcastLists(b);
  }, [currentUser]);

  useEffect(() => {
    fetchGroupsAndBroadcasts();
  }, [fetchGroupsAndBroadcasts]);

  useEffect(() => {
    const query = inboxSearch.trim();
    if (!query || !currentUser) {
      setProfileResults([]);
      setSearchingProfiles(false);
      return;
    }

    setSearchingProfiles(true);
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .ilike("username", `%${query}%`)
        .neq("username", currentUser)
        .limit(8);

      if (!error) setProfileResults(data || []);
      setSearchingProfiles(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [inboxSearch, currentUser]);

  useEffect(() => {
    if (!activeUsername || !currentUser) {
      setActiveConvo(null);
      setMessages([]);
      return;
    }

    let active = true;

    const loadOrCreate = async () => {
      setLoadingMessages(true);
      const [user_a, user_b] = [currentUser, activeUsername].sort();

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

      if (!active || !convo) return;
      setActiveConvo(convo);

      const myReadKey =
        convo.user_a === currentUser ? "last_read_a" : "last_read_b";
      const nowIso = new Date().toISOString();
      supabase
        .from("conversations")
        .update({ [myReadKey]: nowIso })
        .eq("id", convo.id)
        .then(() => {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convo.id ? { ...c, [myReadKey]: nowIso } : c,
            ),
          );
        });

      const { data: msgs } = await supabase
        .from("direct_messages")
        .select("*")
        .eq("conversation_id", convo.id)
        .order("created_at", { ascending: true });

      if (active) {
        setMessages(msgs || []);
        setLoadingMessages(false);
      }
    };

    loadOrCreate();

    return () => {
      active = false;
    };
  }, [activeUsername, currentUser]);

  useEffect(() => {
    if (!activeConvo) return;

    const channel = supabase
      .channel(`dm-panel-${activeConvo.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `conversation_id=eq.${activeConvo.id}`,
        },
        (payload) => {
          // Guard against duplicates: the sender already appends their own
          // message optimistically in handleSend, so this same row can
          // arrive again here once Supabase Realtime broadcasts the INSERT.
          setMessages((prev) =>
            prev.some((m) => m.id === payload.new.id)
              ? prev
              : [...prev, payload.new],
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "direct_messages",
          filter: `conversation_id=eq.${activeConvo.id}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === payload.new.id ? payload.new : m)),
          );
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [activeConvo]);

  useEffect(() => {
    if (!activeConvo || !currentUser) return;

    const unseen = messages.filter(
      (m) => m.sender_username !== currentUser && !m.seen_at,
    );
    if (unseen.length === 0) return;

    const ids = unseen.map((m) => m.id);
    const nowIso = new Date().toISOString();

    supabase
      .from("direct_messages")
      .update({ seen_at: nowIso, delivered_at: nowIso })
      .in("id", ids)
      .then(() => {
        setMessages((prev) =>
          prev.map((m) =>
            ids.includes(m.id)
              ? {
                  ...m,
                  seen_at: m.seen_at || nowIso,
                  delivered_at: m.delivered_at || nowIso,
                }
              : m,
          ),
        );
      });
  }, [messages, activeConvo, currentUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert("File too large. Max size is 25MB.");
      return;
    }

    const type = attachmentTypeFromFile(file);
    const previewUrl =
      type === "image" || type === "video" ? URL.createObjectURL(file) : null;
    setPendingAttachment({
      file,
      previewUrl,
      type,
      name: file.name,
      size: file.size,
    });
  };

  const clearPendingAttachment = () => {
    if (pendingAttachment?.previewUrl)
      URL.revokeObjectURL(pendingAttachment.previewUrl);
    setPendingAttachment(null);
  };

  // ── Voice message recording ──
  const startRecording = async () => {
    if (pendingAttachment || recording) return;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      alert("Voice messages aren't supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const ext = (recorder.mimeType || "audio/webm").includes("mp4")
          ? "m4a"
          : "webm";
        const file = new File([blob], `voice-${Date.now()}.${ext}`, {
          type: blob.type,
        });
        const previewUrl = URL.createObjectURL(blob);

        setPendingAttachment({
          file,
          previewUrl,
          type: "voice",
          name: file.name,
          size: file.size,
          duration: recordingSecondsRef.current,
        });

        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      mediaRecorderRef.current = recorder;
      recorder.start();

      recordingSecondsRef.current = 0;
      setRecordingSeconds(0);
      setRecording(true);

      recordingTimerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
        if (recordingSecondsRef.current >= MAX_VOICE_SECONDS) {
          stopRecording();
        }
      }, 1000);
    } catch (err) {
      alert("Couldn't access your microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    clearInterval(recordingTimerRef.current);
    setRecording(false);
  };

  const cancelRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      // Prevent onstop from turning this into a pending attachment.
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    clearInterval(recordingTimerRef.current);
    audioChunksRef.current = [];
    setRecording(false);
    setRecordingSeconds(0);
  };

  const handleSend = async () => {
    if (
      (!text.trim() && !pendingAttachment) ||
      !activeConvo ||
      sending ||
      uploading
    )
      return;
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
        const resourceType =
          pendingAttachment.type === "image"
            ? "image"
            : pendingAttachment.type === "video" ||
                pendingAttachment.type === "voice"
              ? "video"
              : "raw";
        attachment_url = await uploadToCloudinary(
          pendingAttachment.file,
          resourceType,
        );
        attachment_type = pendingAttachment.type;
        attachment_name = pendingAttachment.name;
        attachment_size = pendingAttachment.size;
        setUploading(false);
      }
    } catch (err) {
      setUploading(false);
      setSending(false);
      setText(trimmed);
      alert("Attachment upload failed. Please try again.");
      return;
    }

    // .select().single() hands back the inserted row so we can show it
    // immediately instead of waiting on the Realtime broadcast to echo
    // it back — that round trip is what made sent messages feel delayed.
    const { data: inserted, error } = await supabase
      .from("direct_messages")
      .insert({
        conversation_id: activeConvo.id,
        sender_username: currentUser,
        text: trimmed || null,
        attachment_url,
        attachment_type,
        attachment_name,
        attachment_size,
      })
      .select()
      .single();

    if (!error && inserted) {
      setMessages((prev) =>
        prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted],
      );

      const previewText =
        trimmed ||
        (attachment_type === "image"
          ? "📷 Photo"
          : attachment_type === "video"
            ? "🎥 Video"
            : attachment_type === "voice"
              ? "🎤 Voice message"
              : `📎 ${attachment_name || "Attachment"}`);
      await supabase
        .from("conversations")
        .update({
          last_message: previewText,
          last_message_at: new Date().toISOString(),
          last_message_sender: currentUser,
        })
        .eq("id", activeConvo.id);
      clearPendingAttachment();
    } else {
      setText(trimmed);
    }
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Reactions ──
  const toggleReaction = async (message, emoji) => {
    const current = message.reactions || {};
    const alreadyThisEmoji = (current[emoji] || []).includes(currentUser);

    // One reaction per user: strip currentUser from every emoji first,
    // then re-add them to the picked emoji unless they were toggling it off.
    const updated = {};
    Object.entries(current).forEach(([em, users]) => {
      const filtered = users.filter((u) => u !== currentUser);
      if (filtered.length) updated[em] = filtered;
    });
    if (!alreadyThisEmoji) {
      updated[emoji] = [...(updated[emoji] || []), currentUser];
    }

    setOpenReactionFor(null);
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, reactions: updated } : m)),
    );

    await supabase
      .from("direct_messages")
      .update({ reactions: updated })
      .eq("id", message.id);
  };

  // ── Inline editing ──
  const startEdit = (m) => {
    setEditingId(m.id);
    setEditText(m.text || "");
    setOpenReactionFor(null);
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
      .from("direct_messages")
      .update({ text: trimmed, edited_at: editedAt })
      .eq("id", message.id);
  };

  // ── Delete message (delete for everyone) ──
  const deleteMessage = async (message) => {
    const confirmed = window.confirm("Delete this message for everyone?");
    if (!confirmed) return;

    const deletedAt = new Date().toISOString();
    setOpenReactionFor(null);
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
              reactions: {},
            }
          : m,
      ),
    );

    await supabase
      .from("direct_messages")
      .update({
        deleted_at: deletedAt,
        text: null,
        attachment_url: null,
        attachment_type: null,
        attachment_name: null,
        attachment_size: null,
        reactions: {},
      })
      .eq("id", message.id);
  };

  const panelStyle = position
    ? {
        position: "fixed",
        left: position.x,
        top: position.y,
        right: "auto",
        bottom: "auto",
        margin: 0,
      }
    : undefined;

  const normalizedSearch = inboxSearch.trim().toLowerCase();
  const filteredConversations = normalizedSearch
    ? conversations.filter((conv) => {
        const other = getOtherUser(conv).toLowerCase();
        const lastMsg = (conv.last_message || "").toLowerCase();
        return (
          other.includes(normalizedSearch) || lastMsg.includes(normalizedSearch)
        );
      })
    : conversations;

  const existingUsernames = new Set(conversations.map((c) => getOtherUser(c)));
  const newProfileResults = profileResults.filter(
    (p) => !existingUsernames.has(p.username),
  );

  const startChatWith = (username) => {
    setInboxSearch("");
    setActiveUsername(username);
  };

  // Used by the on-screen "←" arrow: routes through closeDetail() so it
  // behaves identically to the hardware/gesture back button (pops the
  // depth-2 history entry on mobile, keeping the stack in sync).
  const handleBackFromChat = (e) => {
    e.stopPropagation();
    closeDetail();
  };

  const openConversation = (username) => {
    setActiveGroup(null);
    setActiveBroadcast(null);
    setActiveUsername(username);
  };

  const openGroup = (group) => {
    setActiveUsername(null);
    setActiveBroadcast(null);
    setActiveGroup(group);
  };

  const openBroadcast = (list) => {
    setActiveUsername(null);
    setActiveGroup(null);
    setActiveBroadcast(list);
  };

  const anyDetailOpen = !!(activeUsername || activeGroup || activeBroadcast);

  return (
    <div
      className={`mp-overlay ${!currentUser ? "mp-overlay-center" : ""}`}
      onClick={(e) => {
        if (!dragging) closePanel();
      }}
    >
      <div
        ref={panelRef}
        className={`mp-panel ${dragging ? "mp-dragging" : ""} ${!currentUser ? "mp-panel-login" : ""}`}
        style={currentUser ? panelStyle : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {!currentUser ? (
          <div className="mp-login-prompt">
            <p>🔒 Please log in to use Messages</p>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("openLogin"))}
            >
              Login
            </button>
            <button className="mp-close-btn-alt" onClick={closePanel}>
              Close
            </button>
          </div>
        ) : (
          <>
            <div
              className={`mp-inbox ${anyDetailOpen ? "mp-inbox-hidden-mobile" : ""}`}
            >
              <div
                className="mp-inbox-header mp-drag-handle"
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
              >
                <span>Messages</span>
                <div style={{ display: "flex", alignItems: "center", gap: 2, position: "relative" }}>
                  <button
                    ref={newMenuBtnRef}
                    className="mp-close-btn"
                    onClick={() => setShowNewMenu((v) => !v)}
                    aria-label="New"
                  >
                    ＋
                  </button>
                  {showNewMenu && (
                    <div className="mp-new-menu" ref={newMenuRef}>
                      <div
                        onClick={() => {
                          setShowNewMenu(false);
                          setShowNewModal("group");
                        }}
                      >
                        👥 New Group
                      </div>
                      <div
                        onClick={() => {
                          setShowNewMenu(false);
                          setShowNewModal("broadcast");
                        }}
                      >
                        📢 New Broadcast List
                      </div>
                    </div>
                  )}
                  <button
                    className="mp-close-btn"
                    onClick={closePanel}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="mp-inbox-search-row">
                <svg
                  className="mp-inbox-search-icon"
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="7"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <line
                    x1="21"
                    y1="21"
                    x2="16.65"
                    y2="16.65"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  type="text"
                  className="mp-inbox-search-input"
                  placeholder="Search people or messages"
                  value={inboxSearch}
                  onChange={(e) => setInboxSearch(e.target.value)}
                />
                {inboxSearch && (
                  <button
                    type="button"
                    className="mp-inbox-search-clear"
                    onClick={() => setInboxSearch("")}
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {loadingConvos ? (
                <p className="mp-empty">Loading…</p>
              ) : conversations.length === 0 &&
                groups.length === 0 &&
                broadcastLists.length === 0 &&
                !normalizedSearch ? (
                <p className="mp-empty">No conversations yet.</p>
              ) : (
                <>
                  {filteredConversations.length === 0 &&
                  groups.length === 0 &&
                  broadcastLists.length === 0 &&
                  newProfileResults.length === 0 &&
                  !searchingProfiles &&
                  normalizedSearch ? (
                    <p className="mp-empty">No matches for "{inboxSearch}"</p>
                  ) : (
                    <>
                      {filteredConversations.map((conv) => {
                        const other = getOtherUser(conv);
                        const isActive = other === activeUsername;
                        const isOnline = onlineUsers.has(other);
                        const unread = isConvoUnread(conv);
                        return (
                          <div
                            key={conv.id}
                            className={`mp-convo-item ${isActive ? "active" : ""} ${unread ? "mp-convo-unread" : ""}`}
                            onClick={() => openConversation(other)}
                          >
                            <div className="mp-convo-avatar">
                              {other.slice(0, 2).toUpperCase()}
                              <span
                                className={`mp-status-dot ${isOnline ? "online" : "offline"}`}
                              />
                            </div>
                            <div className="mp-convo-meta">
                              <div className="mp-convo-name">{other}</div>
                              <div className="mp-convo-last">
                                {conv.last_message || "No messages yet"}
                              </div>
                            </div>
                            <div className="mp-convo-right">
                              <div className="mp-convo-time">
                                {timeAgo(conv.last_message_at)}
                              </div>
                              {unread && <span className="mp-unread-dot" />}
                            </div>
                          </div>
                        );
                      })}

                      {!normalizedSearch &&
                        groups.map((g) => (
                          <div
                            key={g.id}
                            className={`mp-convo-item ${activeGroup?.id === g.id ? "active" : ""}`}
                            onClick={() => openGroup(g)}
                          >
                            <div className="mp-convo-avatar">
                              {g.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="mp-convo-meta">
                              <div className="mp-convo-name">{g.name} 👥</div>
                              <div className="mp-convo-last">
                                {g.lastMessage
                                  ? `${g.lastMessage.sender_username}: ${g.lastMessage.text || "📎 Attachment"}`
                                  : "No messages yet"}
                              </div>
                            </div>
                          </div>
                        ))}

                      {!normalizedSearch &&
                        broadcastLists.map((b) => (
                          <div
                            key={b.id}
                            className={`mp-convo-item ${activeBroadcast?.id === b.id ? "active" : ""}`}
                            onClick={() => openBroadcast(b)}
                          >
                            <div
                              className="mp-convo-avatar"
                              style={{ background: "linear-gradient(135deg, #f97316, #eab308)" }}
                            >
                              📢
                            </div>
                            <div className="mp-convo-meta">
                              <div className="mp-convo-name">{b.name}</div>
                              <div className="mp-convo-last">
                                {(b.broadcast_recipients || []).length} recipients
                              </div>
                            </div>
                          </div>
                        ))}
                    </>
                  )}

                  {normalizedSearch &&
                    (searchingProfiles || newProfileResults.length > 0) && (
                      <>
                        <div className="mp-inbox-section-label">
                          Start new chat
                        </div>
                        {searchingProfiles ? (
                          <p className="mp-empty mp-empty-small">Searching…</p>
                        ) : (
                          newProfileResults.map((p) => (
                            <div
                              key={p.username}
                              className="mp-convo-item mp-profile-result"
                              onClick={() => startChatWith(p.username)}
                            >
                              <div className="mp-convo-avatar">
                                {p.username.slice(0, 2).toUpperCase()}
                                <span
                                  className={`mp-status-dot ${onlineUsers.has(p.username) ? "online" : "offline"}`}
                                />
                              </div>
                              <div className="mp-convo-meta">
                                <div className="mp-convo-name">
                                  {p.username}
                                </div>
                                <div className="mp-convo-last">
                                  Tap to start chatting
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </>
                    )}
                </>
              )}
            </div>

            <div
              className={`mp-chat-window ${!anyDetailOpen ? "mp-chat-hidden-mobile" : ""}`}
            >
              {activeGroup ? (
                <GroupChatWindow
                  group={activeGroup}
                  currentUser={currentUser}
                  onBack={closeDetail}
                  onClose={closePanel}
                />
              ) : activeBroadcast ? (
                <BroadcastComposeWindow
                  list={activeBroadcast}
                  currentUser={currentUser}
                  onBack={closeDetail}
                  onClose={closePanel}
                />
              ) : !activeUsername ? (
                <div className="mp-placeholder">
                  <span>Select a conversation to start chatting</span>
                  <button
                    className="mp-close-btn-desktop"
                    onClick={closePanel}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="mp-chat-header mp-drag-handle"
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                  >
                    <button className="mp-back-btn" onClick={handleBackFromChat}>
                      ←
                    </button>
                    <div className="mp-convo-avatar">
                      {activeUsername.slice(0, 2).toUpperCase()}
                      <span
                        className={`mp-status-dot ${onlineUsers.has(activeUsername) ? "online" : "offline"}`}
                      />
                    </div>
                    <div className="mp-chat-username">
                      <span className="mp-chat-username-text">
                        {activeUsername}
                      </span>
                      <span
                        className={`mp-chat-status ${onlineUsers.has(activeUsername) ? "online" : "offline"}`}
                      >
                        {onlineUsers.has(activeUsername)
                          ? "Online"
                          : activeUserLastSeen
                            ? `Last seen ${timeAgo(activeUserLastSeen)} ago`
                            : "Offline"}
                      </span>
                    </div>
                    <button
                      className="mp-close-btn"
                      onClick={closePanel}
                      aria-label="Close"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mp-chat-body">
                    {loadingMessages ? (
                      <p className="mp-empty">Loading messages…</p>
                    ) : messages.length === 0 ? (
                      <p className="mp-empty">No messages yet. Say hello!</p>
                    ) : (
                      messages.map((m) => {
                        const mine = m.sender_username === currentUser;
                        const fileInfo =
                          m.attachment_type === "file"
                            ? getFileTypeInfo(m.attachment_name)
                            : null;
                        const reactionEntries = Object.entries(
                          m.reactions || {},
                        ).filter(([, users]) => users.length > 0);

                        return (
                          <div
                            key={m.id}
                            className={`mp-bubble-row ${mine ? "mine" : ""}`}
                          >
                            <div className="mp-bubble-stack">
                              {editingId !== m.id && !m.deleted_at && (
                                <div className="mp-bubble-actions">
                                  <button
                                    type="button"
                                    className="mp-bubble-action-btn mp-react-trigger"
                                    onClick={() =>
                                      setOpenReactionFor(
                                        openReactionFor === m.id ? null : m.id,
                                      )
                                    }
                                    aria-label="React"
                                  >
                                    🙂
                                  </button>
                                  {mine && m.text && !m.attachment_url && (
                                    <button
                                      type="button"
                                      className="mp-bubble-action-btn"
                                      onClick={() => startEdit(m)}
                                      aria-label="Edit message"
                                    >
                                      ✎
                                    </button>
                                  )}
                                  {mine && (
                                    <button
                                      type="button"
                                      className="mp-bubble-action-btn mp-delete-action-btn"
                                      onClick={() => deleteMessage(m)}
                                      aria-label="Delete message"
                                    >
                                      🗑
                                    </button>
                                  )}
                                </div>
                              )}

                              {openReactionFor === m.id && !m.deleted_at && (
                                <div
                                  className={`mp-reaction-picker ${mine ? "mine" : ""}`}
                                >
                                  {REACTION_EMOJIS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      className="mp-reaction-picker-btn"
                                      onClick={() => toggleReaction(m, emoji)}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              )}

                              <div
                                className={`mp-bubble ${m.attachment_url ? "mp-bubble-has-attachment" : ""} ${
                                  m.attachment_type === "voice"
                                    ? "mp-bubble-has-voice"
                                    : ""
                                } ${
                                  m.text &&
                                  !m.attachment_url &&
                                  isEmojiOnlyMessage(m.text)
                                    ? "mp-bubble-emoji-only"
                                    : ""
                                } ${m.deleted_at ? "mp-bubble-deleted" : ""}`}
                              >
                                {m.deleted_at ? (
                                  <span className="mp-deleted-text">
                                    🚫 This message was deleted
                                  </span>
                                ) : editingId === m.id ? (
                                  <div className="mp-edit-box">
                                    <input
                                      className="mp-edit-input"
                                      value={editText}
                                      autoFocus
                                      onChange={(e) =>
                                        setEditText(e.target.value)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          saveEdit(m);
                                        }
                                        if (e.key === "Escape") cancelEdit();
                                      }}
                                    />
                                    <div className="mp-edit-actions">
                                      <button onClick={() => saveEdit(m)}>
                                        Save
                                      </button>
                                      <button onClick={cancelEdit}>
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    {m.attachment_url &&
                                      m.attachment_type === "image" && (
                                        <img
                                          src={m.attachment_url}
                                          alt="attachment"
                                          className="mp-bubble-image"
                                          onClick={() =>
                                            window.open(
                                              m.attachment_url,
                                              "_blank",
                                            )
                                          }
                                          onDoubleClick={() =>
                                            toggleReaction(m, "❤️")
                                          }
                                        />
                                      )}

                                    {m.attachment_url &&
                                      m.attachment_type === "video" && (
                                        <video
                                          src={m.attachment_url}
                                          controls
                                          className="mp-bubble-video"
                                        />
                                      )}

                                    {m.attachment_url &&
                                      m.attachment_type === "voice" && (
                                        <VoiceMessagePlayer
                                          src={m.attachment_url}
                                          mine={mine}
                                        />
                                      )}

                                    {m.attachment_url &&
                                      m.attachment_type === "file" && (
                                        <a
                                          href={m.attachment_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="mp-bubble-file"
                                          style={{
                                            "--file-color": fileInfo.color,
                                          }}
                                        >
                                          <span className="mp-file-icon">
                                            {fileInfo.icon}
                                          </span>
                                          <span className="mp-file-meta">
                                            <span
                                              className="mp-file-name"
                                              title={m.attachment_name}
                                            >
                                              {m.attachment_name ||
                                                "Attachment"}
                                            </span>
                                            <span className="mp-file-sub">
                                              {fileInfo.label}
                                              {m.attachment_size
                                                ? ` · ${formatFileSize(m.attachment_size)}`
                                                : ""}
                                            </span>
                                          </span>
                                          <span className="mp-file-download">
                                            ⬇
                                          </span>
                                        </a>
                                      )}

                                    {m.text &&
                                      (isEmojiOnlyMessage(m.text) ? (
                                        <span className="mp-emoji-only-text">
                                          {m.text}
                                        </span>
                                      ) : (
                                        <span>
                                          {renderMessageText(m.text, mine)}
                                        </span>
                                      ))}

                                    <span className="mp-bubble-footer">
                                      {m.edited_at && (
                                        <span className="mp-edited-tag">
                                          edited
                                        </span>
                                      )}
                                      <span className="mp-bubble-time">
                                        {timeShort(m.created_at)}
                                      </span>
                                      {mine && (
                                        <span
                                          className={`mp-ticks mp-ticks-${getTickStatus(m)}`}
                                        >
                                          {getTickStatus(m) === "sent"
                                            ? "✓"
                                            : "✓✓"}
                                        </span>
                                      )}
                                    </span>
                                  </>
                                )}
                              </div>

                              {reactionEntries.length > 0 && !m.deleted_at && (
                                <div
                                  className={`mp-reactions-row ${mine ? "mine" : ""}`}
                                >
                                  {reactionEntries.map(([emoji, users]) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      className={`mp-reaction-pill ${
                                        users.includes(currentUser)
                                          ? "mine-reacted"
                                          : ""
                                      }`}
                                      onClick={() => toggleReaction(m, emoji)}
                                      title={users.join(", ")}
                                    >
                                      {emoji}{" "}
                                      {users.length > 1 ? users.length : ""}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {pendingAttachment && (
                    <div className="mp-pending-attachment">
                      {pendingAttachment.type === "image" && (
                        <img src={pendingAttachment.previewUrl} alt="preview" />
                      )}
                      {pendingAttachment.type === "video" && (
                        <video src={pendingAttachment.previewUrl} />
                      )}
                      {pendingAttachment.type === "voice" && (
                        <div className="mp-pending-voice">
                          <VoiceMessagePlayer
                            src={pendingAttachment.previewUrl}
                            mine={false}
                            initialDuration={pendingAttachment.duration}
                          />
                          <span className="mp-pending-voice-label">
                            🎤 Voice message
                          </span>
                        </div>
                      )}
                      {pendingAttachment.type === "file" &&
                        (() => {
                          const info = getFileTypeInfo(pendingAttachment.name);
                          return (
                            <span
                              className="mp-pending-file-name"
                              style={{ "--file-color": info.color }}
                            >
                              <span className="mp-file-icon">{info.icon}</span>
                              {pendingAttachment.name}
                              <span className="mp-file-sub">
                                {" "}
                                · {info.label} ·{" "}
                                {formatFileSize(pendingAttachment.size)}
                              </span>
                            </span>
                          );
                        })()}
                      <button
                        className="mp-pending-remove"
                        onClick={clearPendingAttachment}
                        aria-label="Remove attachment"
                      >
                        ✕
                      </button>
                      {uploading && (
                        <span className="mp-pending-uploading">Uploading…</span>
                      )}
                    </div>
                  )}

                  <div className="mp-chat-input-row">
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: "none" }}
                      onChange={handleFileSelect}
                      accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.csv"
                    />

                    {recording ? (
                      <div className="mp-recording-row">
                        <span className="mp-recording-dot" />
                        <span className="mp-recording-time">
                          {formatDuration(recordingSeconds)}
                        </span>
                        <span className="mp-recording-label">Recording…</span>
                        <button
                          type="button"
                          className="mp-icon-btn mp-recording-cancel"
                          onClick={cancelRecording}
                          aria-label="Cancel recording"
                        >
                          🗑
                        </button>
                        <button
                          className="mp-send-btn"
                          onClick={stopRecording}
                          aria-label="Stop and preview recording"
                        >
                          ⏹
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="mp-icon-btn"
                          onClick={() => fileInputRef.current?.click()}
                          aria-label="Attach file"
                        >
                          📎
                        </button>

                        <button
                          type="button"
                          ref={emojiBtnRef}
                          className="mp-icon-btn"
                          onClick={() => setShowEmojiPicker((v) => !v)}
                          aria-label="Emoji"
                        >
                          😀
                        </button>

                        {showEmojiPicker && (
                          <div className="mp-emoji-picker" ref={emojiPickerRef}>
                            {EMOJI_LIST.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                className="mp-emoji-btn"
                                onClick={() => insertEmoji(emoji)}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}

                        <input
                          ref={inputRef}
                          className="mp-chat-input"
                          placeholder="Type a message…"
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                          onKeyDown={handleKeyDown}
                        />

                        {text.trim() || pendingAttachment ? (
                          <button
                            className="mp-send-btn"
                            onClick={handleSend}
                            disabled={sending || uploading}
                          >
                            ➤
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="mp-icon-btn mp-mic-btn"
                            onClick={startRecording}
                            aria-label="Record voice message"
                          >
                            🎤
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {showNewModal && (
        <NewGroupOrBroadcastModal
          mode={showNewModal}
          currentUser={currentUser}
          onClose={() => setShowNewModal(null)}
          onCreated={({ type, data }) => {
            setShowNewModal(false);
            fetchGroupsAndBroadcasts();
            if (type === "group") openGroup({ ...data, lastMessage: null });
            else openBroadcast({ ...data, broadcast_recipients: [] });
          }}
        />
      )}
    </div>
  );
};

export default MessagesPanel;