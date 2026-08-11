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