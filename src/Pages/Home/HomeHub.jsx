import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import NewspaperOutlinedIcon from "@mui/icons-material/NewspaperOutlined";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ChatBubbleIcon from "@mui/icons-material/ChatBubble";
import "./homeHub.css";
import { supabase } from "../../config/supabase";

// HomePageContent is the component App.js originally imported as `Home`
// from "./Pages/Home/home" (the home feed / trending carousel / grid).
// PostFeed is the same file already used by App.js's old "/feed" route.
import HomePageContent from "./home";
import PostFeed from "../PostFeed/PostFeed";

// ── HomeHub ──────────────────────────────────────────────────────────────
// Single merged tab: a small segmented control (Home / Posts) plus an
// Upload button, replacing what used to be three separate nav entries
// (Home, Upload, Posts) in BottomNav.jsx and SideNavbar.jsx.
//
// Active sub-tab is stored in the URL as ?tab=posts so back/forward and
// shared links still work (default, no param, is the Home feed).
// Switching tabs unmounts the inactive one — each tab owns its own
// Supabase queries/realtime subscriptions, so keeping both mounted at
// once would double up on network calls and background video playback
// for no benefit.
//
// currentUser is passed down from App.js (the single source of truth for
// auth state, kept in sync with the real Supabase session) and forwarded
// to PostFeed below, rather than PostFeed reading localStorage on its
// own — that split used to let the Posts tab and the rest of the app
// (e.g. the navbar's Upload button) disagree about whether you were
// logged in.
//
// STACKING ORDER: HomePageContent renders its own fixed category-chip
// bar (.homePage_options, in homePage.css) only when the Home sub-tab
// is active — Posts has no equivalent bar. Home/Posts/Upload should
// always render BELOW that chip row when it's present, but flush under
// the Navbar when it's not (i.e. on the Posts tab). Since only this
// component knows which tab is active, it passes that down as a class
// so homeHub.css can pick the right `top` offset for .hh-tabbar.
const HomeHub = ({ sideNavbar, currentUser }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "posts" ? "posts" : "home";

  // NEW: aggregate like/comment totals across ALL posts, shown as a small
  // badge on the Posts tab button so you can see at a glance whether
  // there's fresh activity before even switching tabs. This is a
  // lightweight running total independent of PostFeed.jsx's own
  // per-post state — HomeHub and PostFeed don't share state, and
  // PostFeed unmounts whenever you're on the Home tab, so this keeps
  // its own count via a separate realtime subscription rather than
  // reading anything from PostFeed.
  const [likesTotal, setLikesTotal] = useState(0);
  const [commentsTotal, setCommentsTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadCounts = async () => {
      const [{ count: likes }, { count: comments }] = await Promise.all([
        supabase
          .from("post_reactions")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("post_comments")
          .select("*", { count: "exact", head: true }),
      ]);
      if (cancelled) return;
      setLikesTotal(likes || 0);
      setCommentsTotal(comments || 0);
    };
    loadCounts();

    // Realtime keeps the badge live as people like/comment elsewhere in
    // the app (e.g. from a shared-post link, or another tab), without
    // needing a full re-fetch — just nudge the running total.
    const channel = supabase
      .channel("homehub-posts-stats")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "post_reactions" },
        () => setLikesTotal((c) => c + 1),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "post_reactions" },
        () => setLikesTotal((c) => Math.max(0, c - 1)),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "post_comments" },
        () => setCommentsTotal((c) => c + 1),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "post_comments" },
        () => setCommentsTotal((c) => Math.max(0, c - 1)),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // Keeps badge numbers compact (1.2k instead of 1234) so they never
  // blow out the tab button's width once activity picks up.
  const formatCount = (n) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}m`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
    return String(n);
  };

  const setTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === "home") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: false });
  };

  const goToUpload = () => {
    if (!currentUser) {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    navigate("/videoUpload");
  };

  return (
    <div className="hh-wrap">
      <div
        className={
          "hh-tabbar" +
          (sideNavbar ? " sidebar-open" : "") +
          // Home tab renders homePage_options above this bar — push down.
          // Posts tab has no chip row — sit right under the Navbar.
          (activeTab === "home" ? " hh-tabbar-below-options" : "")
        }
      >
        <button
          className={"hh-tab-btn" + (activeTab === "home" ? " hh-tab-active" : "")}
          onClick={() => setTab("home")}
        >
          <HomeOutlinedIcon sx={{ fontSize: 18 }} />
          <span className="hh-tab-label">Home</span>
        </button>
        <button
          className={"hh-tab-btn" + (activeTab === "posts" ? " hh-tab-active" : "")}
          onClick={() => setTab("posts")}
        >
          <NewspaperOutlinedIcon sx={{ fontSize: 18 }} />
          <span className="hh-tab-label">Posts</span>
          <span className="hh-tab-stats">
            <span className="hh-tab-stat" title={`${likesTotal} likes`}>
              <ThumbUpIcon sx={{ fontSize: 12 }} />
              {formatCount(likesTotal)}
            </span>
            <span className="hh-tab-stat" title={`${commentsTotal} comments`}>
              <ChatBubbleIcon sx={{ fontSize: 12 }} />
              {formatCount(commentsTotal)}
            </span>
          </span>
        </button>
        <button className="hh-upload-btn" onClick={goToUpload} title="Upload">
          <AddCircleOutlineIcon sx={{ fontSize: 20 }} />
          <span>Upload</span>
        </button>
      </div>

      <div className="hh-tab-content">
        {activeTab === "home" ? (
          <HomePageContent sideNavbar={sideNavbar} />
        ) : (
          <PostFeed sideNavbar={sideNavbar} currentUser={currentUser} />
        )}
      </div>
    </div>
  );
};

export default HomeHub;