import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { Link } from "react-router-dom";
import SubscriptionsIcon from "@mui/icons-material/Subscriptions";
import logo from "../../assests/mylogo.png";
import "../../styles/libraryPages.css";

const SubscriptionFeed = ({ currentUser, sideNavbar }) => {
  const [videos, setVideos] = useState([]);
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState("all");
  const [loading, setLoading] = useState(true);
  const username = currentUser || "";

  useEffect(() => {
    if (!username) { setLoading(false); setChannels([]); setVideos([]); return; }
    loadFeed();
  }, [username]);

  const loadFeed = async () => {
    setLoading(true);
    const userId = localStorage.getItem("userId") || "";

    // ── Subscriptions are stored inconsistently across the app:
    // Profile.jsx writes subscriber_id as the username, while Video.jsx /
    // Reels.jsx write it as the UUID (userId). Until that's unified, we
    // check both so subscriptions made from either place show up here. ──
    const { data: subsByUsername } = await supabase
      .from("subscriptions")
      .select("subscribed_to")
      .eq("subscriber_id", username);

    const { data: subsByUserId } = userId
      ? await supabase
          .from("subscriptions")
          .select("subscribed_to")
          .eq("subscriber_id", userId)
      : { data: [] };

    const subs = [...(subsByUsername || []), ...(subsByUserId || [])];

    if (subs.length === 0) {
      setChannels([]);
      setVideos([]);
      setLoading(false);
      return;
    }

    const channelNames = [...new Set(subs.map((s) => s.subscribed_to))];
    setChannels(channelNames);

    const { data, error } = await supabase
      .from("videos")
      .select("id, title, thumbnail_url, likes, username, created_at")
      .in("username", channelNames)
      .order("created_at", { ascending: false })
      .limit(60);

    if (!error && data) setVideos(data);
    setLoading(false);
  };

  const formatDate = (d) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  const filtered = activeChannel === "all"
    ? videos
    : videos.filter((v) => v.username === activeChannel);

  return (
    <div className={`lib-page ${sideNavbar ? "" : "sidebar-collapsed"}`}>
      <div className="lib-header">
        {/* ✅ Zixplon logo */}
        <img src={logo} alt="Zixplon" className="lib-header-icon" />
        <div>
          <h1 className="lib-title">Subscriptions</h1>
          <p className="lib-subtitle">Latest from channels you follow</p>
        </div>
      </div>

      {!username && <div className="lib-empty"><p>Sign in to see videos from channels you subscribe to.</p></div>}
      {username && loading && <div className="lib-loading"><div className="lib-spinner" /></div>}
      {username && !loading && channels.length === 0 && (
        <div className="lib-empty">
          <SubscriptionsIcon style={{ fontSize: 48, opacity: 0.3 }} />
          <p>Subscribe to channels to see their latest videos here.</p>
        </div>
      )}

      {!loading && channels.length > 0 && (
        <>
          <div className="lib-pills">
            <button className={`lib-pill ${activeChannel === "all" ? "lib-pill-active" : ""}`} onClick={() => setActiveChannel("all")}>All</button>
            {channels.map((ch) => (
              <button key={ch} className={`lib-pill ${activeChannel === ch ? "lib-pill-active" : ""}`} onClick={() => setActiveChannel(ch)}>{ch}</button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div className="lib-empty"><p>No videos from this channel yet.</p></div>
          ) : (
            <div className="lib-grid">
              {filtered.map((v) => (
                <Link to={`/video/${v.id}`} key={v.id} className="lib-card">
                  <div className="lib-thumb-wrap">
                    <img
                      src={v.thumbnail_url || "https://via.placeholder.com/320x180?text=No+Thumbnail"}
                      alt={v.title}
                      className="lib-thumb"
                    />
                  </div>
                  <div className="lib-card-info">
                    <p className="lib-card-title">{v.title}</p>
                    <p className="lib-card-meta">{v.username} · {formatDate(v.created_at)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SubscriptionFeed;