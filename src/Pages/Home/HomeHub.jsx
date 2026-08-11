import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import NewspaperOutlinedIcon from "@mui/icons-material/NewspaperOutlined";
import "./homeHub.css";

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
const HomeHub = ({ sideNavbar, currentUser }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "posts" ? "posts" : "home";

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
      <div className={"hh-tabbar" + (sideNavbar ? " sidebar-open" : "")}>
        <button
          className={"hh-tab-btn" + (activeTab === "home" ? " hh-tab-active" : "")}
          onClick={() => setTab("home")}
        >
          <HomeOutlinedIcon sx={{ fontSize: 18 }} />
          <span>Home</span>
        </button>
        <button
          className={"hh-tab-btn" + (activeTab === "posts" ? " hh-tab-active" : "")}
          onClick={() => setTab("posts")}
        >
          <NewspaperOutlinedIcon sx={{ fontSize: 18 }} />
          <span>Posts</span>
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
          <PostFeed sideNavbar={sideNavbar} />
        )}
      </div>
    </div>
  );
};

export default HomeHub;