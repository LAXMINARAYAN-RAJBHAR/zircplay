import React from "react";
import "./sideNavbar.css";
import { Link, useLocation } from "react-router-dom";
import AdSlot from "../../Component/Ads/AdSlot";

// ─── Zixplon Custom Icons ───────────────────────────────────────────────────
const ic = {
  width: 24,
  height: 24,
  display: "inline-block",
  verticalAlign: "middle",
  flexShrink: 0,
};
const s = {
  stroke: "#dc2626",
  strokeWidth: 2,
  fill: "none",
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" style={ic}>
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" {...s} />
    <path d="M9 21V12h6v9" {...s} />
  </svg>
);

const PostsIcon = () => (
  <svg viewBox="0 0 24 24" style={ic}>
    <rect x="3" y="4" width="18" height="3" rx="1" {...s} />
    <rect x="3" y="10" width="18" height="3" rx="1" {...s} />
    <rect x="3" y="16" width="12" height="3" rx="1" {...s} />
  </svg>
);

const ShortsIcon = () => (
  <svg viewBox="0 0 24 24" style={ic}>
    <rect x="6" y="2" width="12" height="20" rx="3" {...s} />
    <polygon points="10,8 16,12 10,16" fill="#534AB7" stroke="none" />
  </svg>
);

const SubsIcon = () => (
  <svg viewBox="0 0 24 24" style={ic}>
    <rect x="2" y="7" width="20" height="13" rx="2" {...s} />
    <path d="M16 2H8" {...s} />
    <polygon points="10,10 10,17 17,13.5" fill="#534AB7" stroke="none" />
  </svg>
);

const ChevronRight = () => (
  <svg viewBox="0 0 24 24" style={ic}>
    <path d="M9 6l6 6-6 6" {...s} />
  </svg>
);

const ChannelIcon = () => (
  <svg viewBox="0 0 24 24" style={ic}>
    <circle cx="12" cy="8" r="4" {...s} />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" {...s} />
  </svg>
);

const HistoryIcon = () => (
  <svg viewBox="0 0 24 24" style={ic}>
    <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.4 2.6L3 3" {...s} />
    <path d="M3 3v5h5" {...s} />
    <path d="M12 7v5l3 3" {...s} />
  </svg>
);

const PlaylistIcon = () => (
  <svg viewBox="0 0 24 24" style={ic}>
    <line x1="3" y1="6" x2="16" y2="6" {...s} />
    <line x1="3" y1="12" x2="16" y2="12" {...s} />
    <line x1="3" y1="18" x2="12" y2="18" {...s} />
    <polygon points="17,10 23,14 17,18" fill="#534AB7" stroke="none" />
  </svg>
);

const YourVideosIcon = () => (
  <svg viewBox="0 0 24 24" style={ic}>
    <rect x="2" y="5" width="15" height="14" rx="2" {...s} />
    <path d="M17 9l5-3v12l-5-3V9z" {...s} />
  </svg>
);

const WatchLaterIcon = () => (
  <svg viewBox="0 0 24 24" style={ic}>
    <circle cx="12" cy="12" r="9" {...s} />
    <path d="M12 7v5l3.5 3.5" {...s} />
  </svg>
);

const ThumbUpIcon = () => (
  <svg viewBox="0 0 24 24" style={ic}>
    <path
      d="M7 22V11M2 13v7a2 2 0 002 2h11.7a2 2 0 001.97-1.67l1.18-7A2 2 0 0016.87 11H13V6a3 3 0 00-3-3L7 11"
      {...s}
    />
  </svg>
);

const ClipsIcon = () => (
  <svg viewBox="0 0 24 24" style={ic}>
    <path d="M6 3v10M18 3v10" {...s} />
    <line x1="3" y1="6" x2="9" y2="6" {...s} />
    <line x1="15" y1="6" x2="21" y2="6" {...s} />
    <path d="M4 20h16a1 1 0 001-1v-4H3v4a1 1 0 001 1z" {...s} />
  </svg>
);
// ────────────────────────────────────────────────────────────────────────────

// sideNavbar === true  -> expanded (icons + labels)
// sideNavbar === false -> collapsed (icons only, still visible)
const SideNavbar = ({ sideNavbar }) => {
  const location = useLocation();
  const loggedInUsername = localStorage.getItem("username") || "";
  const expanded = sideNavbar;

  const hiddenRoutes = ["/videoUpload", "/signup", "/reels"];
  if (hiddenRoutes.some((route) => location.pathname.startsWith(route)))
    return null;

  const isActive = (path) => location.pathname === path;

  const activeStyle = {
    background: "rgba(255,255,255,0.1)",
    borderRadius: "10px",
  };

  const Title = ({ children }) =>
    expanded ? (
      <div className="home_sideNavbarTopOptionTitle">{children}</div>
    ) : null;

  return (
    <div
      className={`home-sideNavbar ${expanded ? "expanded" : "collapsed"}`}
      title={!expanded ? "" : undefined}
    >
      {/* ── TOP SECTION ── */}
      <div className="home_sideNavbarTop">
        <Link to="/" className="home_sideNavbar_link" title={!expanded ? "Home" : undefined}>
          <div
            className="home_sideNavbarTopOption"
            style={isActive("/") ? activeStyle : {}}
          >
            <HomeIcon />
            <Title>Home</Title>
          </div>
        </Link>

        <Link to="/feed" className="home_sideNavbar_link" title={!expanded ? "Posts" : undefined}>
          <div
            className="home_sideNavbarTopOption"
            style={isActive("/feed") ? activeStyle : {}}
          >
            <PostsIcon />
            <Title>Posts</Title>
          </div>
        </Link>

        <Link to="/reels" className="home_sideNavbar_link" title={!expanded ? "Shorts" : undefined}>
          <div
            className="home_sideNavbarTopOption"
            style={isActive("/reels") ? activeStyle : {}}
          >
            <ShortsIcon />
            <Title>Shorts</Title>
          </div>
        </Link>

        <Link
          to="/subscription"
          className="home_sideNavbar_link"
          title={!expanded ? "Subscription" : undefined}
        >
          <div
            className="home_sideNavbarTopOption"
            style={isActive("/subscription") ? activeStyle : {}}
          >
            <img
              src="/mylogo1.png"
              alt="Zixplon"
              style={{ width: 24, height: 24, objectFit: "contain", flexShrink: 0 }}
            />
            <Title>Subscription</Title>
          </div>
        </Link>
      </div>

      {/* ── MIDDLE SECTION ── */}
      <div className="home_sideNavbarMiddle">
        {expanded && (
          <div className="home_sideNavbarTopOption">
            <div className="home_sideNavbarTopOptionTitle">You</div>
            <ChevronRight />
          </div>
        )}

        {loggedInUsername ? (
          <Link
            to={`/user/${loggedInUsername}`}
            className="home_sideNavbar_link"
            title={!expanded ? "Your Channel" : undefined}
          >
            <div
              className="home_sideNavbarTopOption"
              style={isActive(`/user/${loggedInUsername}`) ? activeStyle : {}}
            >
              <ChannelIcon />
              <Title>Your Channel</Title>
            </div>
          </Link>
        ) : (
          <div
            className="home_sideNavbar_link"
            style={{ cursor: "pointer" }}
            title={!expanded ? "Your Channel" : undefined}
            onClick={() => window.dispatchEvent(new Event("openLogin"))}
          >
            <div className="home_sideNavbarTopOption">
              <ChannelIcon />
              <Title>Your Channel</Title>
            </div>
          </div>
        )}

        <Link to="/history" className="home_sideNavbar_link" title={!expanded ? "History" : undefined}>
          <div
            className="home_sideNavbarTopOption"
            style={isActive("/history") ? activeStyle : {}}
          >
            <HistoryIcon />
            <Title>History</Title>
          </div>
        </Link>

        <Link to="/playlist" className="home_sideNavbar_link" title={!expanded ? "Playlist" : undefined}>
          <div
            className="home_sideNavbarTopOption"
            style={isActive("/playlist") ? activeStyle : {}}
          >
            <PlaylistIcon />
            <Title>Playlist</Title>
          </div>
        </Link>

        <Link to="/your-videos" className="home_sideNavbar_link" title={!expanded ? "Your videos" : undefined}>
          <div
            className="home_sideNavbarTopOption"
            style={isActive("/your-videos") ? activeStyle : {}}
          >
            <YourVideosIcon />
            <Title>Your videos</Title>
          </div>
        </Link>

        <Link to="/watch-later" className="home_sideNavbar_link" title={!expanded ? "Watch later" : undefined}>
          <div
            className="home_sideNavbarTopOption"
            style={isActive("/watch-later") ? activeStyle : {}}
          >
            <WatchLaterIcon />
            <Title>Watch later</Title>
          </div>
        </Link>

        <Link to="/liked-videos" className="home_sideNavbar_link" title={!expanded ? "Liked videos" : undefined}>
          <div
            className="home_sideNavbarTopOption"
            style={isActive("/liked-videos") ? activeStyle : {}}
          >
            <ThumbUpIcon />
            <Title>Liked videos</Title>
          </div>
        </Link>

        <Link to="/your-clips" className="home_sideNavbar_link" title={!expanded ? "Your clips" : undefined}>
          <div
            className="home_sideNavbarTopOption"
            style={isActive("/your-clips") ? activeStyle : {}}
          >
            <ClipsIcon />
            <Title>Your clips</Title>
          </div>
        </Link>
      </div>

      {/* ── SUBSCRIPTIONS SECTION ── */}
      {expanded && (
        <div className="home_sideNavbarMiddle">
          <div className="home_sideNavbarTopOption">
            <div className="home_sideNavbarTopOptionTitleHeader">
              Subscription
            </div>
          </div>

          <Link to="/user/aajtak" className="home_sideNavbar_link">
            <div
              className="home_sideNavbarTopOption"
              style={isActive("/user/aajtak") ? activeStyle : {}}
            >
              <img
                className="home_sideNavbar_ImgLogo"
                src="https://tse4.mm.bing.net/th/id/OIP.Auy5e_yPpkpidVF_ZRz7aQAAAA?w=404&h=316&rs=1&pid=ImgDetMain&o=7&rm=3"
                alt="Aaj Tak"
              />
              <div className="home_sideNavbarTopOptionTitle">Aaj Tak</div>
            </div>
          </Link>

          <Link to="/user/lallantop" className="home_sideNavbar_link">
            <div
              className="home_sideNavbarTopOption"
              style={isActive("/user/lallantop") ? activeStyle : {}}
            >
              <img
                className="home_sideNavbar_ImgLogo"
                src="https://tse1.mm.bing.net/th/id/OIP.At5eXfjQ0jLiO7tRFBjI_QAAAA?rs=1&pid=ImgDetMain&o=7&rm=3"
                alt="The LallanTop"
              />
              <div className="home_sideNavbarTopOptionTitle">The LallanTop</div>
            </div>
          </Link>

          <Link to="/user/ndtvindia" className="home_sideNavbar_link">
            <div
              className="home_sideNavbarTopOption"
              style={isActive("/user/ndtvindia") ? activeStyle : {}}
            >
              <img
                className="home_sideNavbar_ImgLogo"
                src="https://logodix.com/logo/2131933.jpg"
                alt="NDTV India"
              />
              <div className="home_sideNavbarTopOptionTitle">NDTV India</div>
            </div>
          </Link>
        </div>
      )}

      {/* ── Google AdSense — sidebar display ──
          Only shown in the expanded sidebar; the icon-only collapsed
          state has no room for it and would just clip the ad. */}
      {expanded && (
        <div className="home_sideNavbarMiddle">
          <AdSlot slot="7511704211" variant="sidebar" />
        </div>
      )}
    </div>
  );
};

export default SideNavbar;