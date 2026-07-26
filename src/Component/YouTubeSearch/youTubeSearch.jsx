import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";

const API_KEYS = [
  process.env.REACT_APP_YOUTUBE_KEY_1,
  process.env.REACT_APP_YOUTUBE_KEY_2,
  process.env.REACT_APP_YOUTUBE_KEY_3,
  process.env.REACT_APP_YOUTUBE_KEY_4,
  process.env.REACT_APP_YOUTUBE_KEY_5,
  process.env.REACT_APP_YOUTUBE_KEY_6,
];

let currentKeyIndex = 0;

// ── Cache structure ──
// cache[query]            → last fetched items array
// cache[`_seen_${query}`] → Set of all video IDs ever shown for this query
// cache[`_token_${query}`]→ nextPageToken from YouTube for this query
const cache = {};

const CATEGORIES = [
  { label: "All", query: "trending videos 2025" },
  { label: "Music", query: "latest music 2025" },
  { label: "Gaming", query: "gaming videos 2025" },
  { label: "News", query: "news today 2025" },
  { label: "Movies", query: "new movies 2025" },
  { label: "Comedy", query: "funny comedy videos 2025" },
  { label: "Education", query: "education learning 2025" },
  { label: "Sports", query: "sports highlights 2025" },
  { label: "Technology", query: "tech videos 2025" },
  { label: "Travel", query: "travel vlogs 2025" },
  { label: "Cooking", query: "cooking recipes 2025" },
  { label: "Fitness", query: "fitness workout 2025" },
  { label: "Live", query: "live stream 2025" },
  { label: "Shorts", query: "viral shorts 2025" },
  { label: "Podcasts", query: "podcast 2025" },
  { label: "Web Series", query: "web series hindi 2025" },
  { label: "Hindi Movies", query: "hindi movies 2025" },
  { label: "Bollywood", query: "bollywood songs 2025" },
];

const YouTubeSearch = () => {
  const [activeCategory, setActiveCategory] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(null);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [subscribedChannels, setSubscribedChannels] = useState(new Set());
  const [comment, setComment] = useState("");
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [comments, setComments] = useState([
    { id: 1, user: "Rahul", text: "Amazing video! 🔥", time: "2 days ago", likes: 24 },
    { id: 2, user: "Priya", text: "Loved this content!", time: "1 day ago", likes: 12 },
    { id: 3, user: "Amit", text: "Very informative, thanks!", time: "5 hours ago", likes: 5 },
  ]);

  const location = useLocation();

  // ── Refs ──
  const autoplayRef = useRef(autoplay);
  const chipsRef = useRef(null);
  const playerRef = useRef(null);
  const resultsRef = useRef(results);
  const indexRef = useRef(selectedVideoIndex);

  // ── Keep refs in sync ──
  useEffect(() => { autoplayRef.current = autoplay; }, [autoplay]);
  useEffect(() => { resultsRef.current = results; }, [results]);
  useEffect(() => { indexRef.current = selectedVideoIndex; }, [selectedVideoIndex]);

  // ── Load YouTube IFrame API once ──
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
  }, []);

  // ── Init/reinit YT Player on video change ──
  useEffect(() => {
    if (!selectedVideo) return;

    let pollInterval = null;

    const initPlayer = () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (e) {}
        playerRef.current = null;
      }

      const container = document.getElementById("yt-player-container");
      if (container) {
        container.innerHTML = "";
        const div = document.createElement("div");
        div.id = "yt-player";
        container.appendChild(div);
      }

      playerRef.current = new window.YT.Player("yt-player", {
        height: window.innerWidth < 768 ? "220" : "500",
        width: "100%",
        videoId: selectedVideo,
        playerVars: { autoplay: 1, rel: 0, enablejsapi: 1 },
        events: {
          onReady: () => {
            pollInterval = setInterval(() => {
              if (!playerRef.current) return;
              try {
                const state = playerRef.current.getPlayerState();
                if (state === 0 && autoplayRef.current) {
                  clearInterval(pollInterval);
                  const n = indexRef.current + 1;
                  if (n < resultsRef.current.length) {
                    openVideo(resultsRef.current[n], n);
                  }
                }
              } catch (e) {}
            }, 1000);
          },
          onStateChange: (event) => {
            if (event.data === 0 && autoplayRef.current) {
              clearInterval(pollInterval);
              const n = indexRef.current + 1;
              if (n < resultsRef.current.length) {
                openVideo(resultsRef.current[n], n);
              }
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      clearInterval(pollInterval);
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (e) {}
        playerRef.current = null;
      }
    };
  }, [selectedVideo]);

  // ── Handle reload event from navbar ──
  useEffect(() => {
    const handleReload = () => {
      setSelectedVideo(null);
      setSelectedVideoIndex(null);
      searchWithQuery(CATEGORIES[activeCategory].query, true);
    };
    window.addEventListener("youtube-reload", handleReload);
    return () => window.removeEventListener("youtube-reload", handleReload);
  }, [activeCategory]);

  // ── Handle search from URL / navigation ──
  useEffect(() => {
    const hashSearch = window.location.hash.includes("?")
      ? window.location.hash.split("?")[1]
      : "";
    const params = new URLSearchParams(hashSearch || location.search);
    const searchFromNav = params.get("search") || params.get("q");

    if (searchFromNav) {
      setSelectedVideo(null);
      setSelectedVideoIndex(null);
      searchWithQuery(searchFromNav, true);
    } else {
      searchWithQuery(CATEGORIES[activeCategory].query, true);
    }
  }, [location.hash, location.search, location.pathname, location.state]);

  // ── FIXED: searchWithQuery with pagination + deduplication ──
  const searchWithQuery = async (q, forceRefresh = false) => {
    // Return cached results only when NOT forcing a refresh
    if (cache[q] && !forceRefresh) {
      setResults(cache[q]);
      return;
    }

    setLoading(true);
    setError("");

    // Initialize the seen-IDs Set for this query if it doesn't exist yet
    if (!cache[`_seen_${q}`]) {
      cache[`_seen_${q}`] = new Set();
    }
    const seenIds = cache[`_seen_${q}`];

    // Get the stored nextPageToken (empty string on first load)
    const pageToken = cache[`_token_${q}`] || "";

    let allFailed = true;

    for (let i = 0; i < API_KEYS.length; i++) {
      const keyIndex = (currentKeyIndex + i) % API_KEYS.length;
      try {
        const params = {
          part: "snippet",
          q: q,
          type: "video",
          maxResults: 50,
          order: "relevance",
          key: API_KEYS[keyIndex],
        };

        // Only add pageToken when we actually have one (avoids YouTube API error)
        if (pageToken) {
          params.pageToken = pageToken;
        }

        const res = await axios.get(
          "https://www.googleapis.com/youtube/v3/search",
          { params }
        );

        currentKeyIndex = keyIndex;

        // Save the next page token for future refreshes
        cache[`_token_${q}`] = res.data.nextPageToken || "";

        // Filter out videos already shown to the user
        const newItems = res.data.items.filter(
          (item) => !seenIds.has(item.id.videoId)
        );

        // Mark all returned videos as seen (whether we show them or not)
        res.data.items.forEach((item) => seenIds.add(item.id.videoId));

        // If all videos on this page were already seen, use them anyway
        // (handles edge case where YouTube returns overlapping pages)
        const finalItems = newItems.length > 0 ? newItems : res.data.items;

        cache[q] = finalItems;
        setResults(finalItems);

        allFailed = false;
        setLoading(false);
        return;
      } catch (err) {
        if (err.response?.status === 403) {
          currentKeyIndex = (keyIndex + 1) % API_KEYS.length;
          continue;
        }
        setError(err.response?.data?.error?.message || "Something went wrong");
        allFailed = false;
        break;
      }
    }

    if (allFailed) {
      setError("All API keys exhausted for today 😔 Please try again tomorrow.");
    }
    setLoading(false);
  };

  const handleCategoryClick = (index) => {
    setActiveCategory(index);
    setSelectedVideo(null);
    setSelectedVideoIndex(null);
    // Pass true so each category click fetches the next page of fresh videos
    searchWithQuery(CATEGORIES[index].query, true);
  };

  const openVideo = (item, index) => {
    setSelectedVideo(item.id.videoId);
    setSelectedVideoIndex(index);
    setLiked(false);
    setDisliked(false);
    setComment("");
    setShowFullDesc(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubscribe = (channelTitle) => {
    setSubscribedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channelTitle)) {
        next.delete(channelTitle);
      } else {
        next.add(channelTitle);
      }
      return next;
    });
  };

  const scrollChips = (dir) => {
    if (chipsRef.current)
      chipsRef.current.scrollBy({ left: dir * 200, behavior: "smooth" });
  };

  const currentItem = selectedVideo && results[selectedVideoIndex];
  const relatedVideos = selectedVideo
    ? results.filter((_, i) => i !== selectedVideoIndex)
    : [];

  return (
    <div
      style={{
        background: "#0f0f0f",
        minHeight: "100vh",
        paddingTop: "56px",
        fontFamily: "Roboto, Arial, sans-serif",
      }}
    >
      {/* ── CATEGORY CHIPS BAR ── */}
      {!selectedVideo && (
        <div
          style={{
            position: "sticky",
            top: "56px",
            zIndex: 100,
            background: "#0f0f0f",
            borderBottom: "1px solid #1a1a1a",
            display: "flex",
            alignItems: "center",
          }}
        >
          <button
            onClick={() => scrollChips(-1)}
            style={{
              background: "none",
              border: "none",
              color: "white",
              cursor: "pointer",
              padding: "0 8px",
              fontSize: "20px",
              flexShrink: 0,
              height: "56px",
              display: "flex",
              alignItems: "center",
            }}
          >
            ‹
          </button>

          <div
            ref={chipsRef}
            style={{
              display: "flex",
              gap: "12px",
              overflowX: "hidden",
              padding: "10px 4px",
              flex: 1,
              scrollbarWidth: "none",
            }}
          >
            {CATEGORIES.map((cat, i) => (
              <button
                key={i}
                onClick={() => handleCategoryClick(i)}
                style={{
                  flexShrink: 0,
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  whiteSpace: "nowrap",
                  background: activeCategory === i ? "white" : "#272727",
                  color: activeCategory === i ? "black" : "white",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => scrollChips(1)}
            style={{
              background: "none",
              border: "none",
              color: "white",
              cursor: "pointer",
              padding: "0 8px",
              fontSize: "20px",
              flexShrink: 0,
              height: "56px",
              display: "flex",
              alignItems: "center",
            }}
          >
            ›
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            background: "#ff4444",
            color: "white",
            padding: "12px 20px",
            margin: "10px 20px",
            borderRadius: "6px",
            fontSize: "14px",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* ── WATCH PAGE ── */}
      {selectedVideo ? (
        <div
          style={{
            display: "flex",
            gap: "24px",
            padding: "20px 24px",
            maxWidth: "1600px",
            margin: "0 auto",
            flexWrap: "wrap",
          }}
        >
          {/* LEFT */}
          <div style={{ flex: "1 1 0", minWidth: 0, width: "100%" }}>
            <div
              style={{
                borderRadius: "12px",
                overflow: "hidden",
                background: "#000",
              }}
            >
              <div
                id="yt-player-container"
                style={{
                  width: "100%",
                  height: window.innerWidth < 768 ? "220px" : "500px",
                }}
              >
                <div id="yt-player" />
              </div>
            </div>

            {/* Prev / Autoplay / Next */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#181818",
                borderRadius: "10px",
                padding: "10px 16px",
                marginTop: "10px",
              }}
            >
              <button
                onClick={() => {
                  const p = selectedVideoIndex - 1;
                  if (p >= 0) openVideo(results[p], p);
                }}
                disabled={selectedVideoIndex === 0}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background: selectedVideoIndex === 0 ? "#2a2a2a" : "#272727",
                  border: "none",
                  color: selectedVideoIndex === 0 ? "#555" : "white",
                  borderRadius: "20px",
                  padding: "8px 18px",
                  cursor: selectedVideoIndex === 0 ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                }}
              >
                ⏮ Previous
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ color: "#aaa", fontSize: "13px", fontWeight: "500" }}>
                  Autoplay
                </span>
                <div
                  onClick={() => setAutoplay(!autoplay)}
                  style={{
                    width: "44px",
                    height: "24px",
                    background: autoplay ? "#ff0000" : "#555",
                    borderRadius: "12px",
                    cursor: "pointer",
                    position: "relative",
                    transition: "background 0.3s",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: "18px",
                      height: "18px",
                      background: "white",
                      borderRadius: "50%",
                      position: "absolute",
                      top: "3px",
                      left: autoplay ? "23px" : "3px",
                      transition: "left 0.3s",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                    }}
                  />
                </div>
                <span
                  style={{
                    color: autoplay ? "#ff0000" : "#555",
                    fontSize: "12px",
                    fontWeight: "600",
                    minWidth: "24px",
                  }}
                >
                  {autoplay ? "ON" : "OFF"}
                </span>
              </div>

              <button
                onClick={() => {
                  const n = selectedVideoIndex + 1;
                  if (n < results.length) openVideo(results[n], n);
                }}
                disabled={selectedVideoIndex === results.length - 1}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background:
                    selectedVideoIndex === results.length - 1 ? "#2a2a2a" : "#ff0000",
                  border: "none",
                  color: selectedVideoIndex === results.length - 1 ? "#555" : "white",
                  borderRadius: "20px",
                  padding: "8px 18px",
                  cursor:
                    selectedVideoIndex === results.length - 1 ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                }}
              >
                Next ⏭
              </button>
            </div>

            {currentItem && (
              <>
                <div
                  style={{
                    color: "white",
                    fontWeight: "700",
                    fontSize: "18px",
                    lineHeight: "1.4",
                    marginTop: "14px",
                  }}
                >
                  {currentItem.snippet.title}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginTop: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(currentItem.snippet.channelTitle)}&background=random&size=40`}
                      alt="channel"
                      style={{ width: "40px", height: "40px", borderRadius: "50%" }}
                    />
                    <div>
                      <div style={{ color: "white", fontWeight: "600", fontSize: "15px" }}>
                        {currentItem.snippet.channelTitle}
                      </div>
                      <div style={{ color: "#aaa", fontSize: "12px" }}>1.2M subscribers</div>
                    </div>

                    <button
                      onClick={() => handleSubscribe(currentItem.snippet.channelTitle)}
                      style={{
                        background: subscribedChannels.has(currentItem.snippet.channelTitle)
                          ? "#272727"
                          : "white",
                        color: subscribedChannels.has(currentItem.snippet.channelTitle)
                          ? "white"
                          : "black",
                        border: "none",
                        borderRadius: "20px",
                        padding: "8px 18px",
                        fontWeight: "700",
                        cursor: "pointer",
                        fontSize: "14px",
                        marginLeft: "8px",
                      }}
                    >
                      {subscribedChannels.has(currentItem.snippet.channelTitle)
                        ? "✓ Subscribed"
                        : "Subscribe"}
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <div
                      style={{
                        display: "flex",
                        background: "#272727",
                        borderRadius: "20px",
                        overflow: "hidden",
                      }}
                    >
                      <button
                        onClick={() => {
                          setLiked(!liked);
                          if (disliked) setDisliked(false);
                        }}
                        style={{
                          background: liked ? "#3ea6ff22" : "transparent",
                          border: "none",
                          color: liked ? "#3ea6ff" : "white",
                          padding: "8px 16px",
                          cursor: "pointer",
                          fontSize: "14px",
                          borderRight: "1px solid #3a3a3a",
                        }}
                      >
                        👍 1.1K
                      </button>
                      <button
                        onClick={() => {
                          setDisliked(!disliked);
                          if (liked) setLiked(false);
                        }}
                        style={{
                          background: disliked ? "#ff444422" : "transparent",
                          border: "none",
                          color: disliked ? "#ff4444" : "white",
                          padding: "8px 16px",
                          cursor: "pointer",
                          fontSize: "14px",
                        }}
                      >
                        👎
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `https://www.youtube.com/watch?v=${selectedVideo}`
                        );
                        alert("Link copied!");
                      }}
                      style={{
                        background: "#272727",
                        border: "none",
                        color: "white",
                        borderRadius: "20px",
                        padding: "8px 16px",
                        cursor: "pointer",
                        fontSize: "14px",
                      }}
                    >
                      🔗 Share
                    </button>
                    <button
                      onClick={() => {
                        setSelectedVideo(null);
                        setSelectedVideoIndex(null);
                      }}
                      style={{
                        background: "#272727",
                        border: "none",
                        color: "#aaa",
                        borderRadius: "20px",
                        padding: "8px 16px",
                        cursor: "pointer",
                        fontSize: "13px",
                      }}
                    >
                      ✕ Close
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div
                  style={{
                    background: "#272727",
                    borderRadius: "12px",
                    padding: "14px 16px",
                    marginTop: "14px",
                    color: "#ccc",
                    fontSize: "14px",
                    lineHeight: "1.6",
                    cursor: "pointer",
                  }}
                  onClick={() => setShowFullDesc(!showFullDesc)}
                >
                  <div style={{ color: "#aaa", fontSize: "13px", marginBottom: "6px" }}>
                    {new Date(currentItem.snippet.publishedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                  <p
                    style={{
                      margin: 0,
                      display: showFullDesc ? "block" : "-webkit-box",
                      WebkitLineClamp: showFullDesc ? "unset" : 2,
                      WebkitBoxOrient: "vertical",
                      overflow: showFullDesc ? "visible" : "hidden",
                    }}
                  >
                    {currentItem.snippet.description || "No description available."}
                  </p>
                  <span
                    style={{
                      color: "white",
                      fontWeight: "600",
                      fontSize: "13px",
                      marginTop: "6px",
                      display: "block",
                    }}
                  >
                    {showFullDesc ? "Show less" : "...more"}
                  </span>
                </div>

                {/* Comments */}
                <div style={{ marginTop: "28px" }}>
                  <div
                    style={{
                      color: "white",
                      fontWeight: "600",
                      fontSize: "16px",
                      marginBottom: "20px",
                    }}
                  >
                    {comments.length} Comments
                  </div>
                  <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
                    <img
                      src="https://athenabpo.com/wp-content/uploads/2016/09/Headshot-Blank-Person-Circle-300x300.gif"
                      alt="user"
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && comment.trim()) {
                            setComments([
                              {
                                id: Date.now(),
                                text: comment,
                                user: "You",
                                time: "Just now",
                                likes: 0,
                              },
                              ...comments,
                            ]);
                            setComment("");
                          }
                        }}
                        placeholder="Add a comment..."
                        style={{
                          width: "100%",
                          background: "transparent",
                          border: "none",
                          borderBottom: "1px solid #555",
                          color: "white",
                          fontSize: "14px",
                          padding: "8px 0",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      {comment.trim() && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: "8px",
                            marginTop: "8px",
                          }}
                        >
                          <button
                            onClick={() => setComment("")}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#aaa",
                              cursor: "pointer",
                              fontSize: "14px",
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              setComments([
                                {
                                  id: Date.now(),
                                  text: comment,
                                  user: "You",
                                  time: "Just now",
                                  likes: 0,
                                },
                                ...comments,
                              ]);
                              setComment("");
                            }}
                            style={{
                              background: "#3ea6ff",
                              border: "none",
                              color: "black",
                              borderRadius: "20px",
                              padding: "6px 16px",
                              cursor: "pointer",
                              fontWeight: "700",
                              fontSize: "14px",
                            }}
                          >
                            Comment
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {comments.map((c) => (
                    <div
                      key={c.id}
                      style={{ display: "flex", gap: "12px", marginBottom: "20px" }}
                    >
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(c.user)}&background=random&size=36`}
                        alt={c.user}
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <span style={{ color: "white", fontWeight: "600", fontSize: "13px" }}>
                            {c.user}
                          </span>
                          <span style={{ color: "#aaa", fontSize: "12px" }}>{c.time}</span>
                        </div>
                        <div style={{ color: "#ccc", fontSize: "14px", marginTop: "4px" }}>
                          {c.text}
                        </div>
                        <div style={{ display: "flex", gap: "12px", marginTop: "6px" }}>
                          <span style={{ color: "#aaa", fontSize: "13px", cursor: "pointer" }}>
                            👍 {c.likes}
                          </span>
                          <span style={{ color: "#aaa", fontSize: "13px", cursor: "pointer" }}>
                            👎
                          </span>
                          <span style={{ color: "#aaa", fontSize: "13px", cursor: "pointer" }}>
                            Reply
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* RIGHT: Sidebar */}
          <div
            style={{
              width: window.innerWidth < 768 ? "100%" : "402px",
              flexShrink: 0,
              position: window.innerWidth < 768 ? "relative" : "sticky",
              top: "70px",
              height: window.innerWidth < 768 ? "auto" : "calc(100vh - 90px)",
              overflowY: "auto",
              scrollbarWidth: "thin",
              scrollbarColor: "#555 transparent",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              <span style={{ color: "#aaa", fontSize: "13px" }}>Autoplay</span>
              <div
                onClick={() => setAutoplay(!autoplay)}
                style={{
                  width: "42px",
                  height: "24px",
                  background: autoplay ? "#ff0000" : "#555",
                  borderRadius: "12px",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.3s",
                }}
              >
                <div
                  style={{
                    width: "18px",
                    height: "18px",
                    background: "white",
                    borderRadius: "50%",
                    position: "absolute",
                    top: "3px",
                    left: autoplay ? "21px" : "3px",
                    transition: "left 0.3s",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {relatedVideos.map((item) => {
                const realIndex = results.indexOf(item);
                return (
                  <div
                    key={item.id.videoId}
                    onClick={() => openVideo(item, realIndex)}
                    style={{
                      display: "flex",
                      gap: "8px",
                      cursor: "pointer",
                      borderRadius: "8px",
                      padding: "4px",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#1e1e1e")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div
                      style={{
                        position: "relative",
                        flexShrink: 0,
                        width: "168px",
                        height: "94px",
                        borderRadius: "8px",
                        overflow: "hidden",
                      }}
                    >
                      <img
                        src={item.snippet.thumbnails.medium.url}
                        alt={item.snippet.title}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingTop: "2px" }}>
                      <div
                        style={{
                          color: "white",
                          fontSize: "13px",
                          fontWeight: "600",
                          lineHeight: "1.4",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          marginBottom: "4px",
                        }}
                      >
                        {item.snippet.title}
                      </div>
                      <div style={{ color: "#aaa", fontSize: "12px", marginBottom: "2px" }}>
                        {item.snippet.channelTitle}
                      </div>
                      <div style={{ color: "#aaa", fontSize: "12px" }}>
                        {new Date(item.snippet.publishedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ── HOME GRID ── */
        <>
          {loading && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "16px",
                padding: "20px",
              }}
            >
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    background: "#272727",
                    borderRadius: "12px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      paddingTop: "56.25%",
                      background: "#3a3a3a",
                      animation: "pulse 1.5s infinite",
                    }}
                  />
                  <div style={{ padding: "12px", display: "flex", gap: "10px" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "#3a3a3a",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          height: "14px",
                          background: "#3a3a3a",
                          borderRadius: "4px",
                          marginBottom: "8px",
                        }}
                      />
                      <div
                        style={{
                          height: "12px",
                          background: "#3a3a3a",
                          borderRadius: "4px",
                          width: "60%",
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "16px",
                padding: "16px",
              }}
            >
              {results.map((item) => (
                <div
                  key={item.id.videoId}
                  onClick={() => openVideo(item, results.indexOf(item))}
                  style={{ cursor: "pointer" }}
                >
                  <div
                    style={{
                      position: "relative",
                      borderRadius: "12px",
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={item.snippet.thumbnails.medium.url}
                      alt={item.snippet.title}
                      style={{
                        width: "100%",
                        display: "block",
                        aspectRatio: "16/9",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "12px", padding: "12px 4px" }}>
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.snippet.channelTitle)}&background=random&size=36`}
                      alt="channel"
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          color: "white",
                          fontWeight: "600",
                          fontSize: "14px",
                          lineHeight: "1.4",
                          marginBottom: "4px",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {item.snippet.title}
                      </div>
                      <div style={{ color: "#aaa", fontSize: "13px", marginBottom: "2px" }}>
                        {item.snippet.channelTitle}
                      </div>
                      <div style={{ color: "#aaa", fontSize: "12px" }}>
                        {new Date(item.snippet.publishedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && results.length === 0 && !error && (
            <p
              style={{
                color: "#888",
                textAlign: "center",
                marginTop: "100px",
                fontSize: "16px",
              }}
            >
              🔍 No videos found
            </p>
          )}
        </>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        ::-webkit-scrollbar { height: 4px; width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }
      `}</style>
    </div>
  );
};

export default YouTubeSearch;