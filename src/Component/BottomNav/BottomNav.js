import React from "react";
import { Link, useLocation } from "react-router-dom";
import HomeIcon from "@mui/icons-material/Home";
import SearchIcon from "@mui/icons-material/Search";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import NewspaperIcon from "@mui/icons-material/Newspaper";

const BottomNav = ({ currentUser }) => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  const activeColor = "#9e1226";
  const inactiveColor = "#9c7a7c";

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
            background: #ffffff;
            border-top: 2px solid #f3d6d2;
            box-shadow: 0 -4px 20px rgba(158, 18, 38, 0.10);
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
            background: linear-gradient(90deg, #9e1226, #c81e34);
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
            background: rgba(158, 18, 38, 0.12);
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
        {/* Home */}
        <Link
          to="/"
          className={`bottom-nav-item${isActive("/") ? " active-item" : ""}`}
        >
          <div className="bottom-nav-icon-wrap">
            <HomeIcon sx={{ fontSize: "22px", color: isActive("/") ? activeColor : inactiveColor }} />
          </div>
          <span className="bottom-nav-label" style={{ color: isActive("/") ? activeColor : inactiveColor }}>
            Home
          </span>
        </Link>

        {/* Upload — fixed path to match router */}
        <Link
          to="/videoUpload"
          className={`bottom-nav-item${isActive("/videoUpload") ? " active-item" : ""}`}
        >
          <div className="bottom-nav-icon-wrap">
            <VideoCallIcon sx={{ fontSize: "22px", color: isActive("/videoUpload") ? activeColor : inactiveColor }} />
          </div>
          <span className="bottom-nav-label" style={{ color: isActive("/videoUpload") ? activeColor : inactiveColor }}>
            Upload
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

        {/* Posts */}
        <Link
          to="/feed"
          className={`bottom-nav-item${isActive("/feed") ? " active-item" : ""}`}
        >
          <div className="bottom-nav-icon-wrap">
            <NewspaperIcon sx={{ fontSize: "22px", color: isActive("/feed") ? activeColor : inactiveColor }} />
          </div>
          <span className="bottom-nav-label" style={{ color: isActive("/feed") ? activeColor : inactiveColor }}>
            Posts
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