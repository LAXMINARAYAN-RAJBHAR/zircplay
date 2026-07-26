import React, { useState } from "react";
import { liveTVChannels } from "../../data/liveTVData";
import "./liveTVPage.css";

const categories = ["All Channels", "News", "Entertainment", "Sports", "Music", "Regional"];

const LiveTVPage = ({ sideNavbar }) => {
  const [activeChannel, setActiveChannel] = useState(liveTVChannels[0]);
  const [activeCategory, setActiveCategory] = useState("All Channels");

  const filteredChannels =
    activeCategory === "All Channels"
      ? liveTVChannels
      : liveTVChannels.filter((c) => c.category === activeCategory);

  return (
    <div className={`liveTVPage ${sideNavbar ? "sidebar-open" : "sidebar-closed"}`}>

      {/* Player */}
      <div className="liveTV_player">
        {activeChannel.streamUrl ? (
          <video
            src={activeChannel.streamUrl}
            controls
            autoPlay
            className="liveTV_video"
          />
        ) : (
          <div className="liveTV_noStream">
            <img src={activeChannel.thumbnail} alt={activeChannel.name} className="liveTV_noStreamThumb" />
            <div className="liveTV_noStreamOverlay">
              <span className="liveTV_liveBadge">● LIVE</span>
              <h2 className="liveTV_channelTitle">{activeChannel.name}</h2>
              <p className="liveTV_channelDesc">{activeChannel.description}</p>
              <p className="liveTV_viewers">👁 {activeChannel.viewers} watching</p>
            </div>
          </div>
        )}
      </div>

      {/* Category Tabs */}
      <div className="liveTV_tabs">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`liveTV_tab ${activeCategory === cat ? "active" : ""}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Channel Grid */}
      <p className="liveTV_sectionTitle">📡 Live Channels</p>
      <div className="liveTV_grid">
        {filteredChannels.map((channel) => (
          <div
            key={channel.id}
            className={`liveTV_card ${activeChannel.id === channel.id ? "active" : ""}`}
            onClick={() => setActiveChannel(channel)}
          >
            <div className="liveTV_cardThumb">
              <img src={channel.thumbnail} alt={channel.name} />
              <span className="liveTV_liveBadge liveTV_cardBadge">● LIVE</span>
            </div>
            <div className="liveTV_cardInfo">
              <p className="liveTV_cardName">{channel.name}</p>
              <p className="liveTV_cardViewers">👁 {channel.viewers}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LiveTVPage;