import React from "react";
import { Link, useLocation } from "react-router-dom";
import HomeIcon from "@mui/icons-material/Home";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";

const BottomNav = ({ currentUser }) => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  // ── Matched to the Navbar's dusk-maroon gradient (see navbar.css
  // .navbar background) — active items are solid white, inactive items
  // use the same translucent marigold tint the Navbar uses for its
  // placeholder/secondary text, so the two bars read as one connected
  // piece of chrome instead of two different themes. ──
  const activeColor = "#ffffff";
  const inactiveColor = "rgba(255, 233, 226, 0.65)";

  // FIX: Upload ("/videoUpload") and Posts ("/feed") used to be separate
  // items here. Both are now folded into the single "Home" tab — Posts
  // as an in-page sub-tab (see HomeHub.jsx, ?tab=posts) and Upload as a
  // button inside that same tab bar. Removing them here means Home is
  // the one, single entry point for all three, matching the merged-tab
  // request. "/" is considered active for any /?tab=... variant too, so
  // the Home icon still highlights while browsing the Posts sub-tab.
  const isHomeActive = location.pathname === "/";

  return (
    <>
      <style>{`
        .bottom-nav {
          display: none;
        }

        @media (max-width: 768px) {
          .bottom-nav {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 60px;
            background: radial-gradient(120% 220% at 15% 0%, #c81e34 0%, #9e1226 45%, #6e0a18 100%);
            border-top: none;
            box-shadow: 0 -2px 16px rgba(110, 10, 24, 0.25);
            z-index: 9999;
            align-items: center;
            justify-content: space-around;
            padding-bottom: env(safe-area-inset-bottom);
          }

          .bottom-nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            text-decoration: none;
            flex: 1;
            padding: 6px 0;
            cursor: pointer;
            position: relative;
            transition: transform 0.15s;
          }

          .bottom-nav-item:active {
            transform: scale(0.92);
          }

          .bottom-nav-item.active-item::before {
            content: '';
            position: absolute;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 28px;
            height: 3px;
            background: #ffffff;
            border-radius: 0 0 3px 3px;
          }

          .bottom-nav-label {
            font-size: 10px;
            font-weight: 700;
            font-family: 'Nunito', sans-serif;
            letter-spacing: 0.2px;
            transition: color 0.15s;
          }

          .bottom-nav-icon-wrap {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 26px;
            border-radius: 14px;
            transition: background 0.2s;
          }

          .bottom-nav-item.active-item .bottom-nav-icon-wrap {
            background: rgba(255, 255, 255, 0.16);
          }

          .homePage,
          .video,
          .reels_container,
          .videoUpload,
          .signUp,
          .footer {
            padding-bottom: 68px !important;
          }
        }
      `}</style>

      <nav className="bottom-nav">
        {/* Home — now the single entry point for Home feed, Posts
            (in-page sub-tab), and Upload (button inside that tab bar) */}
        <Link
          to="/"
          className={`bottom-nav-item${isHomeActive ? " active-item" : ""}`}
        >
          <div className="bottom-nav-icon-wrap">
            <HomeIcon sx={{ fontSize: "22px", color: isHomeActive ? activeColor : inactiveColor }} />
          </div>
          <span className="bottom-nav-label" style={{ color: isHomeActive ? activeColor : inactiveColor }}>
            Home
          </span>
        </Link>

        {/* Local Player */}
        <Link
          to="/local-player"
          className={`bottom-nav-item${isActive("/local-player") ? " active-item" : ""}`}
        >
          <div className="bottom-nav-icon-wrap">
            <FolderOpenIcon sx={{ fontSize: "22px", color: isActive("/local-player") ? activeColor : inactiveColor }} />
          </div>
          <span className="bottom-nav-label" style={{ color: isActive("/local-player") ? activeColor : inactiveColor }}>
            Player
          </span>
        </Link>

        {/* Profile / Sign In */}
        <Link
          to={currentUser ? `/user/${currentUser}` : "/signup"}
          className={`bottom-nav-item${isActive(`/user/${currentUser}`) ? " active-item" : ""}`}
        >
          <div className="bottom-nav-icon-wrap">
            <AccountCircleIcon
              sx={{
                fontSize: "22px",
                color: isActive(`/user/${currentUser}`) ? activeColor : inactiveColor,
              }}
            />
          </div>
          <span
            className="bottom-nav-label"
            style={{ color: isActive(`/user/${currentUser}`) ? activeColor : inactiveColor }}
          >
            {currentUser ? "Profile" : "Sign Up"}
          </span>
        </Link>
      </nav>
    </>
  );
};

export default BottomNav;