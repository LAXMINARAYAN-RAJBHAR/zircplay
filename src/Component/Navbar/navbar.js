import React, { useState, useRef, useEffect, useCallback } from "react";
import "./navbar.css";
import ListIcon from "@mui/icons-material/List";
import PublicIcon from "@mui/icons-material/Public";
import SearchIcon from "@mui/icons-material/Search";
import KeyboardVoiceIcon from "@mui/icons-material/KeyboardVoice";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import ForumIcon from "@mui/icons-material/Forum";
import HistoryIcon from "@mui/icons-material/History";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Login from "../Login/login";
import { supabase } from "../../config/supabase";

// ── Same admin check as AdminPanel.jsx — keep these two in sync ──────────────
const ADMIN_EMAILS = ["laxminarayan.rajbhar@gmail.com"];

// ─── Country Code Hook ─────────────────────────────────────────────────────────
const useCountry = () => {
  const [countryCode, setCountryCode] = useState("IN");
  useEffect(() => {
    const fetchCountry = async () => {
      const apis = [
        { url: "https://api.country.is/", parse: (d) => d.country },
      ];
      for (const api of apis) {
        try {
          const res = await fetch(api.url);
          if (!res.ok) continue;
          const data = await res.json();
          const code = api.parse(data);
          if (code && code.length === 2) {
            setCountryCode(code);
            return;
          }
        } catch {}
      }
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz.includes("Calcutta") || tz.includes("Kolkata"))
          setCountryCode("IN");
        else if (tz.includes("America")) setCountryCode("US");
        else if (tz.includes("London")) setCountryCode("GB");
        else if (tz.includes("Dubai")) setCountryCode("AE");
        else if (tz.includes("Tokyo")) setCountryCode("JP");
        else if (tz.includes("Sydney")) setCountryCode("AU");
      } catch {
        setCountryCode("IN");
      }
    };
    fetchCountry();
  }, []);
  return countryCode;
};

// ─── Category detection ────────────────────────────────────────────────────────
const CATEGORY_PATTERNS = {
  music: /song|music|album|playlist|remix|beat|audio|singer|artist|band/i,
  gaming: /game|gameplay|minecraft|roblox|gta|valorant|pubg|fortnite|esport/i,
  sports: /match|highlights|cricket|football|nba|ipl|goal|fifa|tennis|boxing/i,
  tech: /phone|laptop|review|unbox|tech|ai|coding|tutorial|programming|vs\s/i,
  news: /news|breaking|update|today|latest|2024|2025/i,
  comedy: /funny|meme|comedy|prank|roast|fail|try not to laugh/i,
  cooking: /recipe|cook|food|bake|chef|how to make|easy meal/i,
  travel: /travel|vlog|trip|tour|explore|city|country|place/i,
};

const CATEGORY_SUFFIXES = {
  music: [
    { suffix: "official music video", tag: "music" },
    { suffix: "2025", tag: "new" },
    { suffix: "full album", tag: null },
    { suffix: "live performance", tag: "live" },
    { suffix: "lyrics", tag: null },
    { suffix: "remix", tag: null },
  ],
  gaming: [
    { suffix: "gameplay 2025", tag: "new" },
    { suffix: "speedrun", tag: "trend" },
    { suffix: "tips and tricks", tag: null },
    { suffix: "walkthrough", tag: null },
    { suffix: "best moments", tag: null },
    { suffix: "live stream", tag: "live" },
  ],
  sports: [
    { suffix: "highlights 2025", tag: "new" },
    { suffix: "full match", tag: null },
    { suffix: "best moments", tag: "trend" },
    { suffix: "live", tag: "live" },
    { suffix: "analysis", tag: null },
    { suffix: "reaction", tag: null },
  ],
  tech: [
    { suffix: "review 2025", tag: "new" },
    { suffix: "unboxing", tag: null },
    { suffix: "vs comparison", tag: null },
    { suffix: "best settings", tag: null },
    { suffix: "explained", tag: null },
    { suffix: "shorts", tag: null },
  ],
  news: [
    { suffix: "today", tag: "live" },
    { suffix: "breaking news", tag: "trend" },
    { suffix: "explained", tag: null },
    { suffix: "live update", tag: "live" },
    { suffix: "2025", tag: "new" },
    { suffix: "documentary", tag: null },
  ],
  comedy: [
    { suffix: "compilation", tag: "trend" },
    { suffix: "best moments", tag: null },
    { suffix: "reaction", tag: null },
    { suffix: "shorts", tag: null },
    { suffix: "try not to laugh", tag: null },
    { suffix: "roast", tag: null },
  ],
  cooking: [
    { suffix: "easy recipe", tag: null },
    { suffix: "step by step", tag: null },
    { suffix: "5 minute recipe", tag: "trend" },
    { suffix: "for beginners", tag: null },
    { suffix: "restaurant style", tag: null },
    { suffix: "shorts", tag: null },
  ],
  travel: [
    { suffix: "travel vlog 2025", tag: "new" },
    { suffix: "best places", tag: "trend" },
    { suffix: "travel guide", tag: null },
    { suffix: "hidden gems", tag: null },
    { suffix: "budget travel", tag: null },
    { suffix: "4K", tag: null },
  ],
  default: [
    { suffix: "2025", tag: "new" },
    { suffix: "explained", tag: null },
    { suffix: "tutorial", tag: null },
    { suffix: "review", tag: null },
    { suffix: "highlights", tag: "trend" },
    { suffix: "shorts", tag: null },
  ],
};

const CATEGORY_LABELS = {
  music: "Music",
  gaming: "Gaming",
  sports: "Sports",
  tech: "Tech",
  news: "News",
  comedy: "Comedy",
  cooking: "Cooking",
  travel: "Travel",
  default: null,
};

// ─── Search history (persisted to localStorage, per-device) ───────────────────
const HISTORY_KEY = "zx_search_history";
const HISTORY_MAX_STORED = 20; // how many we keep in storage
const HISTORY_DISPLAY_LIMIT = 10; // how many we show when the bar is clicked empty

const loadHistory = () => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveHistory = (arr) => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — fail silently
  }
};

let _searchHistory = loadHistory();

const getSuggestions = (q) => {
  if (!q.trim())
    return {
      items: [],
      category: null,
      history: _searchHistory.slice(0, HISTORY_DISPLAY_LIMIT),
    };
  let category = "default";
  for (const [cat, pattern] of Object.entries(CATEGORY_PATTERNS)) {
    if (pattern.test(q)) {
      category = cat;
      break;
    }
  }
  const suffixes = CATEGORY_SUFFIXES[category];
  const items = suffixes.slice(0, 5).map(({ suffix, tag }) => ({
    text: `${q} ${suffix}`,
    displayQuery: q,
    displaySuffix: suffix,
    tag,
    type: "suggestion",
  }));
  const historyMatches = _searchHistory
    .filter((h) => h.toLowerCase().includes(q.toLowerCase()) && h !== q)
    .slice(0, 2);
  return { items, category, history: historyMatches };
};

const addToHistory = (q) => {
  if (!q.trim()) return;
  _searchHistory = [q, ..._searchHistory.filter((h) => h !== q)].slice(
    0,
    HISTORY_MAX_STORED,
  );
  saveHistory(_searchHistory);
};

const removeFromHistory = (q) => {
  _searchHistory = _searchHistory.filter((x) => x !== q);
  saveHistory(_searchHistory);
};

const clearHistory = () => {
  _searchHistory = [];
  saveHistory(_searchHistory);
};

// ─── Tag badge ─────────────────────────────────────────────────────────────────
const TagBadge = ({ tag }) => {
  if (!tag) return null;
  const styles = {
    live: {
      bg: "rgba(251,146,60,0.15)",
      color: "#fb923c",
      border: "1px solid rgba(124,51,0,0.4)",
      text: "LIVE",
    },
    new: {
      bg: "rgba(74,222,128,0.12)",
      color: "#4ade80",
      border: "none",
      text: "NEW",
    },
    trend: {
      bg: "rgba(230,57,70,0.14)",
      color: "#ff7066",
      border: "none",
      text: "TRENDING",
    },
    music: {
      bg: "rgba(167,139,250,0.12)",
      color: "#a78bfa",
      border: "none",
      text: "MUSIC",
    },
  };
  const s = styles[tag];
  if (!s) return null;
  return (
    <span
      style={{
        marginLeft: "auto",
        flexShrink: 0,
        fontSize: "10px",
        fontWeight: "700",
        letterSpacing: "0.04em",
        padding: "2px 7px",
        borderRadius: "10px",
        background: s.bg,
        color: s.color,
        border: s.border || "none",
      }}
    >
      {s.text}
    </span>
  );
};

// ─── Notification helpers ──────────────────────────────────────────────────────
const getNotifStyle = (type) => {
  switch (type) {
    case "upload":
      return { color: "#c81e34", icon: "🎬" };
    case "like":
      return { color: "#ff9800", icon: "❤️" };
    case "comment":
      return { color: "#2196f3", icon: "💬" };
    case "subscriber":
      return { color: "#4caf50", icon: "🔔" };
    case "post":
      return { color: "#a78bfa", icon: "📝" };
    default:
      return { color: "#aaa", icon: "📢" };
  }
};

const timeAgo = (timestamp) => {
  const diff = Math.floor((Date.now() - new Date(timestamp)) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// ─── Main Navbar ───────────────────────────────────────────────────────────────
const Navbar = ({
  currentUser,
  setCurrentUser,
  setSideNavbarFunc,
  sideNavbar,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const countryCode = useCountry();

  const [userPic, setUserPic] = useState(
    "https://ui-avatars.com/api/?name=User&background=444&color=fff&size=40",
  );
  const [notifications, setNotifications] = useState([]);
  const [navbarModal, setNavbarModal] = useState(false);
  const [login, setLogin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestionData, setSuggestionData] = useState({
    items: [],
    category: null,
    history: [],
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isListening, setIsListening] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [logoKey, setLogoKey] = useState(0);
  const [searchBarActive, setSearchBarActive] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const dropdownRef = useRef(null);
  const notifRef = useRef(null);
  const profileModalRef = useRef(null);
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // ── Admin check: only true when the logged-in account's stored email
  //    matches ADMIN_EMAILS. Drives whether the "Admin Panel" link shows
  //    up in the profile dropdown below — same rule AdminPanel.jsx uses,
  //    so this link only ever appears for someone who can actually get in. ──
  const isAdmin =
    !!currentUser &&
    ADMIN_EMAILS.includes(
      (localStorage.getItem("email") || "").trim().toLowerCase(),
    );

  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    const handler = () => setLogin(true);
    window.addEventListener("openLogin", handler);
    return () => window.removeEventListener("openLogin", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setShowInstall(false);
      if (window.gtag) {
        window.gtag('event', 'pwa_install_accepted', {
          event_category: 'PWA',
          event_label: 'User accepted install prompt',
        });
      }
    } else {
      if (window.gtag) {
        window.gtag('event', 'pwa_install_dismissed', {
          event_category: 'PWA',
          event_label: 'User dismissed install prompt',
        });
      }
    }
    setInstallPrompt(null);
  };

  // ── Load profile picture ──
  useEffect(() => {
    const loadPic = async () => {
      if (currentUser) {
        const savedPic = localStorage.getItem("profilePic");
        if (savedPic) {
          setUserPic(savedPic);
        } else {
          const { data: { session } } = await supabase.auth.getSession();
          const pic =
            session?.user?.user_metadata?.profilePic ||
            session?.user?.user_metadata?.avatar_url ||
            session?.user?.user_metadata?.picture;
          if (pic) {
            localStorage.setItem("profilePic", pic);
            setUserPic(pic);
          } else {
            setUserPic(
              `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser)}&background=9e1226&color=fff&size=40`,
            );
          }
        }
      } else {
        setUserPic(
          "https://athenabpo.com/wp-content/uploads/2016/09/Headshot-Blank-Person-Circle-300x300.gif",
        );
      }
    };
    loadPic();
  }, [currentUser]);

  // ── Load notifications ──
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }
    const loadNotifications = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_username", currentUser)
        .order("created_at", { ascending: false })
        .limit(30);
      if (!error && data) {
        setNotifications(
          data.map((n) => ({
            id: n.id,
            type: n.type,
            message: n.message,
            avatar: n.sender_username?.[0]?.toUpperCase() || "?",
            time: timeAgo(n.created_at),
            read: n.is_read,
            contentId: n.content_id ?? null,
            contentType: n.content_type ?? null,
          })),
        );
      }
    };
    loadNotifications();

    const channel = supabase
      .channel("notifications-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_username=eq.${currentUser}`,
        },
        (payload) => {
          const n = payload.new;
          setNotifications((prev) => [
            {
              id: n.id,
              type: n.type,
              message: n.message,
              avatar: n.sender_username?.[0]?.toUpperCase() || "?",
              time: "just now",
              read: false,
              contentId: n.content_id ?? null,
              contentType: n.content_type ?? null,
            },
            ...prev,
          ]);
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUser]);

  // ── Load + track unread DM count ──
  useEffect(() => {
    if (!currentUser) {
      setUnreadMessages(0);
      return;
    }

    const fetchUnreadMessages = async () => {
      const { data: convos } = await supabase
        .from("conversations")
        .select("id")
        .or(`user_a.eq.${currentUser},user_b.eq.${currentUser}`);

      const ids = (convos || []).map((c) => c.id);
      if (ids.length === 0) {
        setUnreadMessages(0);
        return;
      }

      const { count } = await supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", ids)
        .neq("sender_username", currentUser)
        .is("seen_at", null);

      setUnreadMessages(count || 0);
    };

    fetchUnreadMessages();

    const channel = supabase
      .channel(`navbar-dm-badge-${currentUser}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages" },
        () => fetchUnreadMessages(),
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUser]);

  // ── Close search dropdown on outside click ──
  useEffect(() => {
    const h = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
        setSearchBarActive(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Close notifications on outside click ──
  useEffect(() => {
    const h = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target))
        setShowNotifications(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Close profile dropdown on outside click ──
  useEffect(() => {
    const h = (e) => {
      if (profileModalRef.current && !profileModalRef.current.contains(e.target))
        setNavbarModal(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Close modals on route change ──
  useEffect(() => {
    setShowNotifications(false);
    setNavbarModal(false);
  }, [location.pathname]);

  // ── Logo animation ──
  useEffect(() => {
    const interval = setInterval(() => setLogoKey((prev) => prev + 1), 3000);
    return () => clearInterval(interval);
  }, []);

  const sideNavbarFunc = () => setSideNavbarFunc(!sideNavbar);

  const handleprofile = () => {
    if (currentUser) navigate(`/user/${currentUser}`);
    else setLogin(true);
    setNavbarModal(false);
  };

  const handleGoToAdmin = () => {
    navigate("/admin");
    setNavbarModal(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("username");
    localStorage.removeItem("email");
    localStorage.removeItem("userId");
    localStorage.removeItem("profilePic");
    localStorage.removeItem("about");
    setCurrentUser(null);
    setNavbarModal(false);
    navigate("/");
  };

  // ── FIXED: stable callbacks so Login never remounts ──
  const setLoginModal = useCallback(() => setLogin(false), []);
  const handleLoginSuccess = useCallback((name) => {
    setCurrentUser(name);
    setLogin(false);
  }, [setCurrentUser]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setActiveIndex(-1);
    if (val.trim()) {
      setSuggestionData(getSuggestions(val));
      setShowDropdown(true);
    } else {
      setSuggestionData({
        items: [],
        category: null,
        history: _searchHistory.slice(0, HISTORY_DISPLAY_LIMIT),
      });
      setShowDropdown(true);
    }
  };

  const doSearch = (q) => {
    if (!q.trim()) return;
    addToHistory(q);
    setShowDropdown(false);
    setSearchBarActive(false);
    setSearchQuery(q);
    setIsSearchFocused(true);
    navigate({ pathname: "/", search: `?q=${encodeURIComponent(q)}` });
    setTimeout(() => setIsSearchFocused(false), 1500);
  };

  const allNavItems = [
    ...suggestionData.history.map((h) => ({ text: h, type: "history" })),
    ...suggestionData.items,
  ];

  const handleKeyDown = (e) => {
    if (!showDropdown) {
      if (e.key === "Enter") doSearch(searchQuery);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((p) => Math.min(p + 1, allNavItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((p) => Math.max(p - 1, -1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && allNavItems[activeIndex])
        doSearch(allNavItems[activeIndex].text);
      else doSearch(searchQuery);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setSearchBarActive(false);
      inputRef.current?.blur();
    } else if (e.key === "Tab" && activeIndex >= 0 && allNavItems[activeIndex]) {
      e.preventDefault();
      setSearchQuery(allNavItems[activeIndex].text);
      setSuggestionData(getSuggestions(allNavItems[activeIndex].text));
    }
  };

  const speak = (text, callback) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-IN";
    utter.rate = 1.1;
    utter.onend = callback;
    window.speechSynthesis.speak(utter);
  };

  const startVoiceSearch = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("Voice search not supported. Try Chrome.");
      return;
    }
    setIsListening(true);
    let gotResult = false;
    speak("Please speak now", () => {
      const recognition = new SR();
      recognitionRef.current = recognition;
      recognition.lang = "en-IN";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        gotResult = true;
        const transcript = event.results[0][0].transcript;
        recognition.stop();
        setIsListening(false);
        doSearch(transcript);
      };
      recognition.onerror = (e) => {
        if (e.error === "not-allowed") {
          setIsListening(false);
          alert("Mic blocked. Allow mic in Chrome settings.");
        }
      };
      recognition.onend = () => {
        if (!gotResult) {
          try { recognition.start(); } catch (e) {}
        }
      };
      recognition.start();
    });
  };

  const stopVoiceSearch = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const markAllRead = async () => {
    if (!currentUser) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_username", currentUser)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markOneRead = async (id) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const handleNotificationClick = (n) => {
    markOneRead(n.id);
    setShowNotifications(false);
    if (!n.contentId || !n.contentType) return;
    if (n.contentType === "reel") navigate(`/reels/${n.contentId}`);
    else if (n.contentType === "video") navigate(`/video/${n.contentId}`);
    else if (n.contentType === "post") navigate(`/feed?post=${n.contentId}`);
  };

  const historyCount = suggestionData.history.length;

  return (
    <div className="navbar">
      {/* ── LEFT ── */}
      <div className="navbar-left">
        <div className="navbarHamberger" onClick={sideNavbarFunc}>
          <ListIcon sx={{ color: "white" }} />
        </div>

        <Link
          to="/"
          className="navbar-logo-link"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
            textDecoration: "none",
            padding: "5px",
            borderRadius: "12px",
            transition: "border-color 0.25s, background 0.25s, box-shadow 0.25s",
            border: logoHovered
              ? "2px solid rgba(255,233,226,0.9)"
              : "1px solid rgba(255, 255, 255, 0.35)",
            background: logoHovered
              ? "rgba(255,233,226,0.14)"
              : "rgba(255,255,255,0.05)",
          }}
          onMouseEnter={() => setLogoHovered(true)}
          onMouseLeave={() => setLogoHovered(false)}
          onClick={() => {
            setSearchQuery("");
            window.location.href = "/";
          }}
        >
          <svg width="38" height="38" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="42" height="42" rx="8" fill="#9e1226" />
            <text x="50%" y="42%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="22" fontWeight="bold" fontFamily="Fraunces, serif">
              Z
              <animate attributeName="opacity" values="1;0.2;1;0.5;1" dur="2s" repeatCount="indefinite" />
            </text>
            <text x="50%" y="79%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="7.7" fontWeight="700" fontFamily="Inter, sans-serif" letterSpacing="1.2" opacity="1">
              ZIXPLON
            </text>
          </svg>
          <div style={{ display: "flex", alignItems: "flex-start", position: "relative" }}>
            <span key={logoKey} className="logoText" style={{ display: "inline-flex", alignItems: "center" }}>
              {"ZIXPLON".split("").map((char, i) => (
                <span key={i} className="logoChar" style={{ animationDelay: `${i * 0.08}s` }}>
                  {char}
                </span>
              ))}
            </span>
            {countryCode && (
              <span
                className="navbar-country-badge"
                style={{
                  fontSize: "9px",
                  fontWeight: "800",
                  color: "#ffffff",
                  background: "#6e0a18",
                  border: "1.5px solid rgba(255,255,255,0.7)",
                  borderRadius: "3px",
                  padding: "1px 3px",
                  marginLeft: "2px",
                  marginTop: "1px",
                  letterSpacing: "0.04em",
                  lineHeight: 1.2,
                  flexShrink: 0,
                }}
              >
                {countryCode}
              </span>
            )}
          </div>
        </Link>
      </div>

      {/* ── MIDDLE ── */}
      <div className="navbar-middle" ref={dropdownRef} style={{ position: "relative" }}>
        <div
          className="navbar_searchBox"
          style={{
            position: "relative",
            transition: "box-shadow 0.2s",
            boxShadow: searchBarActive ? "0 0 0 2px rgba(255,233,226,0.45)" : "none",
            borderRadius: searchBarActive && showDropdown ? "20px 20px 0 0" : "20px",
          }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Search"
            className="navbar_searchBoxInput"
            value={searchQuery}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setSearchBarActive(true);
              if (searchQuery.trim())
                setSuggestionData(getSuggestions(searchQuery));
              else
                setSuggestionData({
                  items: [],
                  category: null,
                  history: _searchHistory.slice(0, HISTORY_DISPLAY_LIMIT),
                });
              setShowDropdown(true);
            }}
            onBlur={() => setIsSearchFocused(false)}
            autoComplete="off"
          />

          {searchQuery && (
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setSearchQuery("");
                setSuggestionData({
                  items: [],
                  category: null,
                  history: _searchHistory.slice(0, HISTORY_DISPLAY_LIMIT),
                });
                setShowDropdown(true);
                inputRef.current?.focus();
              }}
              title="Clear search"
              style={{
                position: "absolute",
                right: window.innerWidth <= 768 ? "46px" : "64px",
                top: "50%",
                transform: "translateY(-50%)",
                cursor: "pointer",
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.2s",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.35)";
                e.currentTarget.style.transform = "translateY(-50%) scale(1.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.2)";
                e.currentTarget.style.transform = "translateY(-50%) scale(1)";
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1L9 9M9 1L1 9" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
          )}

          <div className="navbar_searchIconBox" onClick={() => doSearch(searchQuery)}>
            <PublicIcon
              sx={{
                fontSize: "28px",
                animation: isSearchFocused ? "spinIcon 0.8s linear infinite" : "none",
              }}
            />
          </div>
        </div>

        <div className="navbar_mike" onClick={startVoiceSearch} title="Voice Search" style={{ cursor: "pointer" }}>
          <KeyboardVoiceIcon sx={{ color: isListening ? "#ffe9e2" : "white", transition: "color 0.2s" }} />
        </div>

        {/* ── Suggestions Dropdown ── */}
        {showDropdown &&
          (suggestionData.history.length > 0 ||
            suggestionData.items.length > 0) && (
            <div
              style={{
                position: "absolute",
                top: "48px",
                left: 0,
                width: "calc(100% - 52px)",
                background: "#1e1e1e",
                borderRadius: "0 0 14px 14px",
                boxShadow: "0 12px 32px rgba(0,0,0,0.7)",
                zIndex: 9999,
                overflow: "hidden",
                border: "1px solid #333",
                borderTop: "none",
              }}
            >
              {suggestionData.category && CATEGORY_LABELS[suggestionData.category] && (
                <div style={{ padding: "8px 14px 4px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{
                    fontSize: "11px",
                    color: "#aaa",
                    background: "#2a2a2a",
                    border: "1px solid #3a3a3a",
                    borderRadius: "12px",
                    padding: "2px 10px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}>
                    {CATEGORY_LABELS[suggestionData.category]}
                    <span style={{ color: "#666" }}>suggestions</span>
                  </span>
                  <span style={{ fontSize: "11px", color: "#555" }}>Tab to autocomplete</span>
                </div>
              )}

              {suggestionData.history.length > 0 && (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px 4px" }}>
                    <span style={{ fontSize: "11px", color: "#555", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Recent
                    </span>
                    {!searchQuery.trim() && suggestionData.history.length > 0 && (
                      <span
                        onMouseDown={(e) => {
                          e.preventDefault();
                          clearHistory();
                          setSuggestionData((prev) => ({ ...prev, history: [] }));
                        }}
                        style={{ fontSize: "11px", color: "#ff8a80", cursor: "pointer" }}
                        title="Clear all recent searches"
                      >
                        Clear all
                      </span>
                    )}
                  </div>
                  {suggestionData.history.map((h, i) => (
                    <div
                      key={`hist-${i}`}
                      onMouseDown={() => doSearch(h)}
                      onMouseEnter={() => setActiveIndex(i)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "9px 14px",
                        cursor: "pointer",
                        background: activeIndex === i ? "#2a2a2a" : "transparent",
                        transition: "background 0.15s",
                        color: "#ccc",
                        fontSize: "14px",
                      }}
                    >
                      <HistoryIcon sx={{ fontSize: "17px", color: "#555" }} />
                      <span>{h}</span>
                      <span
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          removeFromHistory(h);
                          setSuggestionData(getSuggestions(searchQuery));
                        }}
                        style={{ marginLeft: "auto", color: "#444", fontSize: "16px", lineHeight: 1, cursor: "pointer", padding: "0 4px" }}
                        title="Remove"
                      >
                        x
                      </span>
                    </div>
                  ))}
                  {suggestionData.items.length > 0 && (
                    <div style={{ height: "0.5px", background: "#2a2a2a", margin: "2px 0" }} />
                  )}
                </>
              )}

              {suggestionData.items.length > 0 && (
                <>
                  {!suggestionData.category && (
                    <div style={{ fontSize: "11px", color: "#555", padding: "8px 14px 4px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Suggestions
                    </div>
                  )}
                  {suggestionData.items.map((item, i) => {
                    const flatIdx = historyCount + i;
                    return (
                      <div
                        key={`sugg-${i}`}
                        onMouseDown={() => doSearch(item.text)}
                        onMouseEnter={() => setActiveIndex(flatIdx)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "9px 14px",
                          cursor: "pointer",
                          background: activeIndex === flatIdx ? "#2a2a2a" : "transparent",
                          transition: "background 0.15s",
                          color: "#ccc",
                          fontSize: "14px",
                        }}
                      >
                        <SearchIcon sx={{ fontSize: "17px", color: "#555" }} />
                        <span>
                          <span style={{ color: "white", fontWeight: "500" }}>{item.displayQuery}</span>{" "}
                          <span style={{ color: "#aaa" }}>{item.displaySuffix}</span>
                        </span>
                        <TagBadge tag={item.tag} />
                      </div>
                    );
                  })}
                </>
              )}

              {searchQuery.trim() && (
                <>
                  <div style={{ height: "0.5px", background: "#2a2a2a" }} />
                  <div
                    onMouseDown={() => doSearch(searchQuery)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 14px",
                      cursor: "pointer",
                      color: "#ff8a80",
                      fontSize: "13px",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <PublicIcon sx={{ fontSize: "17px" }} />
                    Search for&nbsp;<strong>"{searchQuery}"</strong>&nbsp;across all categories
                  </div>
                </>
              )}
            </div>
          )}
      </div>

      {/* ── RIGHT ── */}
      <div className="navbar-right">
        <span onClick={() => navigate("/local-player")} title="Local Player" className="navbar-local-player" style={{ cursor: "pointer" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#ffffff">
            <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
          </svg>
        </span>

        {showInstall && (
          <span
            onClick={handleInstall}
            title="Install Zixplon App"
            style={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: "#ffffff",
              color: "#9e1226",
              fontSize: "12px",
              fontWeight: "700",
              padding: "4px 10px",
              borderRadius: "20px",
            }}
          >
            Install App
          </span>
        )}

        <span
          className="navbar-upload-btn"
          onClick={() => {
            if (!currentUser) { setLogin(true); return; }
            navigate("/763/upload");
          }}
          style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
          title="Upload Video / Short"
        >
          <VideoCallIcon sx={{ fontSize: "30px", color: "white" }} />
        </span>

        {/* Messages — envelope icon; switches to the filled variant
            whenever there's at least one unread DM, so the icon itself
            doubles as a subtle "you've got messages" cue (mirrors the
            filled/outline pattern already used elsewhere in the app,
            e.g. liked-state icons). */}
        <span
          className="navbar-messages-btn"
          onClick={() => {
            if (!currentUser) { setLogin(true); return; }
            window.dispatchEvent(
              new CustomEvent("openMessages", { detail: { username: null } })
            );
          }}
          style={{ position: "relative", cursor: "pointer", display: "flex" }}
          title="Messages"
        >
          {unreadMessages > 0 ? (
            <MailIcon sx={{ fontSize: "26px", color: "white" }} />
          ) : (
            <MailOutlineIcon sx={{ fontSize: "26px", color: "white" }} />
          )}
          {unreadMessages > 0 && (
            <span style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              background: "#e63946",
              color: "white",
              borderRadius: "50%",
              fontSize: "10px",
              fontWeight: "700",
              width: "18px",
              height: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #6e0a18",
              animation: "badgePop 0.3s ease",
            }}>
              {unreadMessages > 9 ? "9+" : unreadMessages}
            </span>
          )}
        </span>

        {/* Notifications */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <div onClick={() => setShowNotifications((prev) => !prev)} style={{ position: "relative", cursor: "pointer", display: "flex" }}>
            <NotificationsActiveIcon
              sx={{
                fontSize: "30px",
                color: showNotifications ? "#ffe9e2" : "white",
                transition: "color 0.2s",
                animation: unreadCount > 0 ? "bellShake 1.5s infinite" : "none",
              }}
            />
            {unreadCount > 0 && (
              <span style={{
                position: "absolute",
                top: "-4px",
                right: "-4px",
                background: "#e63946",
                color: "white",
                borderRadius: "50%",
                fontSize: "10px",
                fontWeight: "700",
                width: "18px",
                height: "18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #6e0a18",
                animation: "badgePop 0.3s ease",
              }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>

          {showNotifications && (
            <div
              className="navbar-notif-dropdown"
              style={{
                position: "absolute",
                top: "42px",
                right: "-10px",
                width: "360px",
                background: "#212121",
                borderRadius: "12px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
                zIndex: 99999,
                border: "1px solid #333",
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #333" }}>
                <span style={{ color: "white", fontWeight: "600", fontSize: "16px" }}>Notifications</span>
                {unreadCount > 0 && (
                  <span onClick={markAllRead} style={{ color: "#ff8a80", fontSize: "13px", cursor: "pointer", fontWeight: "500" }}>
                    Mark all as read
                  </span>
                )}
              </div>

              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: "32px 16px", textAlign: "center", color: "#555", fontSize: "14px" }}>
                    <div style={{ fontSize: "32px", marginBottom: "8px" }}>🔔</div>
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((n) => {
                    const { color, icon } = getNotifStyle(n.type);
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "12px",
                          padding: "12px 16px",
                          background: n.read ? "transparent" : "rgba(255,255,255,0.05)",
                          borderBottom: "1px solid #2a2a2a",
                          cursor: "pointer",
                          transition: "background 0.2s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? "transparent" : "rgba(255,255,255,0.05)")}
                      >
                        <div style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          background: color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "700",
                          fontSize: "15px",
                          color: "white",
                          flexShrink: 0,
                        }}>
                          {n.avatar}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, color: n.read ? "#aaa" : "white", fontSize: "13px", lineHeight: "1.4" }}>
                            <span style={{ marginRight: "5px" }}>{icon}</span>
                            {n.message}
                          </p>
                          <span style={{ color: "#666", fontSize: "11px" }}>{n.time}</span>
                        </div>
                        {!n.read && (
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ff8a80", flexShrink: 0, marginTop: "4px" }} />
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{ padding: "12px", textAlign: "center", borderTop: "1px solid #333" }}>
                <span
                  style={{ color: "#ff8a80", fontSize: "13px", cursor: "pointer" }}
                  onClick={() => { setShowNotifications(false); navigate("/notifications"); }}
                >
                  See all notifications
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div ref={profileModalRef} style={{ position: "relative" }}>
          <img
            onClick={() => setNavbarModal((prev) => !prev)}
            src={userPic}
            alt="User"
            className="navbar-right-logo"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "https://ui-avatars.com/api/?name=User&background=444&color=fff&size=40";
            }}
          />
          {navbarModal && (
            <div className="navbar-modal">
              {currentUser && (
                <div style={{ padding: "10px 16px", color: "#aaa", fontSize: "12px", borderBottom: "1px solid #333", pointerEvents: "none" }}>
                  @{currentUser}
                </div>
              )}
              <div className="navbar-modal-option" onClick={handleprofile}>Profile</div>

              {/* ── Admin Panel — only rendered for the admin account, on both
                  desktop and mobile, since this dropdown markup and its CSS
                  are shared across breakpoints (no separate mobile version
                  of .navbar-modal exists in navbar.css). ── */}
              {isAdmin && (
                <div
                  className="navbar-modal-option"
                  onClick={handleGoToAdmin}
                  style={{ color: "#9e1226", fontWeight: 800 }}
                >
                  🛡️ Admin Panel
                </div>
              )}

              {currentUser ? (
                <div className="navbar-modal-option" onClick={handleLogout} style={{ color: "#e63946" }}>
                  Logout
                </div>
              ) : (
                <div className="navbar-modal-option" onClick={() => { setLogin(true); setNavbarModal(false); }}>
                  Login
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── LOGIN MODAL — no key prop, stable callbacks ── */}
      {login && (
        <Login
          setLoginModal={setLoginModal}
          onLoginSuccess={handleLoginSuccess}
        />
      )}

      {/* Voice listening overlay */}
      {isListening && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)", zIndex: 99999,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: "20px",
        }}>
          <div style={{
            background: "#212121", borderRadius: "16px", padding: "40px 60px",
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: "20px", boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
          }}>
            <div style={{
              width: "80px", height: "80px", borderRadius: "50%", background: "#9e1226",
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: "pulse 1.2s infinite",
            }}>
              <KeyboardVoiceIcon sx={{ fontSize: "40px", color: "white" }} />
            </div>
            <p style={{ color: "white", fontSize: "20px", fontWeight: "600" }}>Listening...</p>
            <p style={{ color: "#aaa", fontSize: "14px" }}>Speak now to search</p>
            <button
              onClick={stopVoiceSearch}
              style={{
                marginTop: "10px", padding: "8px 24px", borderRadius: "8px",
                border: "1px solid #555", background: "transparent",
                color: "white", cursor: "pointer", fontSize: "14px",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes bellShake {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-15deg); }
          40% { transform: rotate(15deg); }
          60% { transform: rotate(-10deg); }
          80% { transform: rotate(10deg); }
        }
        @keyframes badgePop {
          0% { transform: scale(0); }
          70% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @keyframes spinIcon {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 480px) {
          .navbar-notif-dropdown {
            position: fixed !important;
            top: 60px !important;
            left: 4px !important;
            right: 4px !important;
            width: auto !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Navbar;