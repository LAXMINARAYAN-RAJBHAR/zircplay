import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { supabase } from "../../config/supabase";
import { Link } from "react-router-dom";

// Local videos data (copy from HomePage or import from a shared file)
const localVideos = [
  {
    id: 7679,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTu-l3JR0guZspKsBZkVoakjkQ-qxUCCpkQnw&s",
    title: "Big Buck Bunny open-source film",
    duration: "09:56",
    channel: "Gangeshwary",
    tags: ["Film Criticisms", "Live"],
  },
  {
    id: 2,
    thumbnail: "https://i.ytimg.com/vi/ScMzIvxBSi4/hqdefault.jpg",
    title: "Sample Video 2",
    duration: "30:00",
    channel: "Mummy",
    tags: ["Music"],
  },
  {
    id: 3,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTwyNTbTLzlbDj6RSQdV6imNyxNywT3pchKKg&s",
    title: "3d Lion Stock Photo",
    duration: "60:00",
    channel: "Papa",
    tags: ["AI"],
  },
  {
    id: 4,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQpWv_QvC-7P4_8Ubbg2rwn0Om4APOgf6B3yA&s",
    title: "Sample Video 4",
    duration: "10:00",
    channel: "Karthik",
    tags: ["News"],
  },
  {
    id: 5,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZleDiTkppd2k7GVmREMQRs8D8JBbNXuuxUA&s",
    title: "8k Wallpaper 3d Photos",
    duration: "18:00",
    channel: "Annu",
    tags: ["Astronomy"],
  },
  {
    id: 6,
    thumbnail:
      "https://damassets.autodesk.net/content/dam/autodesk/www/industry/3d-animation/create-beautiful-3d-animations-thumb-1204x677.jpg",
    title: "3D Animation Solutions",
    duration: "08:00",
    channel: "Jyoti",
    tags: ["AI", "Web Development"],
  },
  {
    id: 7,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTMxQZtpZz8NgMYzzNMiBm-n4h2oGYovjK2lQ&s",
    title: "3D Shapes | Types & Examples",
    duration: "28:00",
    channel: "Sarita",
    tags: ["Web Development"],
  },
  {
    id: 8,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSK5izd-jLAR_UjqnUULPW42Pv_LIpL0W60cQ&s",
    title: "3d Graphics Pictures",
    duration: "20:00",
    channel: "Jaynarayan",
    tags: ["AI"],
  },
  {
    id: 9,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQN6EQg2_-8zTqUk1YRvLpJinJk67VF0wEZfg&s",
    title: "Scenery 3d wallpaper",
    duration: "10:00",
    channel: "Shyamnarayan",
    tags: ["Astronomy"],
  },
  {
    id: 10,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRS5r-8k6FyUEN9OYQu5WgyyNqT8lrqgw7dCQ&s",
    title: "3D Nature Images",
    duration: "12:00",
    channel: "Rajbhar",
    tags: ["History"],
  },
  {
    id: 11,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQeUzhAtZL9ElXiENfplVjR5dCJsUQUG2NuXg&s",
    title: "5,364,800+ 3d Images",
    duration: "13:30",
    channel: "Narayan",
    tags: ["AI"],
  },
  {
    id: 12,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQdcK3NWfTM_cOjFOH6ArcBdUbu29e0AVjFZw&s",
    title: "Understanding 3D Computer Graphics",
    duration: "20:50",
    channel: "Laxminarayan",
    tags: ["Web Development", "AI"],
  },
  {
    id: 13,
    thumbnail: "https://picsum.photos/seed/lion1/320/180",
    title: "3D Lion Stock Photo",
    duration: "60:00",
    channel: "Papa",
    tags: ["Film Criticisms"],
  },
  {
    id: 14,
    thumbnail: "https://picsum.photos/seed/tiger2/320/180",
    title: "Tiger in Wild",
    duration: "45:00",
    channel: "NatureTV",
    tags: ["History"],
  },
  {
    id: 15,
    thumbnail: "https://picsum.photos/seed/forest3/320/180",
    title: "Forest Walk",
    duration: "30:00",
    channel: "EcoWorld",
    tags: ["Live"],
  },
  {
    id: 16,
    thumbnail: "https://picsum.photos/seed/ocean4/320/180",
    title: "Ocean Waves",
    duration: "15:00",
    channel: "SeaLife",
    tags: ["Live"],
  },
  {
    id: 17,
    thumbnail: "https://picsum.photos/seed/mountain5/320/180",
    title: "Mountain Trek",
    duration: "20:00",
    channel: "Adventures",
    tags: ["Live"],
  },
  {
    id: 18,
    thumbnail: "https://picsum.photos/seed/city6/320/180",
    title: "City Lights",
    duration: "10:00",
    channel: "UrbanVibe",
    tags: ["News"],
  },
  {
    id: 19,
    thumbnail: "https://picsum.photos/seed/sunset7/320/180",
    title: "Sunset Timelapse",
    duration: "05:00",
    channel: "SkyWatch",
    tags: ["Astronomy"],
  },
  {
    id: 20,
    thumbnail: "https://picsum.photos/seed/beach8/320/180",
    title: "Beach Day",
    duration: "12:00",
    channel: "SummerFun",
    tags: ["Live"],
  },
  {
    id: 21,
    thumbnail: "https://picsum.photos/seed/rain9/320/180",
    title: "Rainy Day",
    duration: "08:00",
    channel: "Chill",
    tags: ["Music"],
  },
  {
    id: 22,
    thumbnail: "https://picsum.photos/seed/snow10/320/180",
    title: "Snowfall",
    duration: "25:00",
    channel: "WinterMood",
    tags: ["Live"],
  },
  {
    id: 23,
    thumbnail: "https://picsum.photos/seed/car11/320/180",
    title: "Sports Car Review",
    duration: "18:00",
    channel: "AutoDrive",
    tags: ["News"],
  },
  {
    id: 24,
    thumbnail: "https://picsum.photos/seed/food12/320/180",
    title: "Pasta Recipe",
    duration: "22:00",
    channel: "ChefLife",
    tags: ["Mixes"],
  },
  {
    id: 25,
    thumbnail: "https://picsum.photos/seed/tech13/320/180",
    title: "Latest Gadgets",
    duration: "35:00",
    channel: "TechZone",
    tags: ["AI", "Web Development"],
  },
  {
    id: 26,
    thumbnail: "https://picsum.photos/seed/space14/320/180",
    title: "Space Exploration",
    duration: "40:00",
    channel: "NASAFan",
    tags: ["Astronomy"],
  },
  {
    id: 27,
    thumbnail: "https://picsum.photos/seed/dog15/320/180",
    title: "Cute Dogs Compilation",
    duration: "14:00",
    channel: "PetPals",
    tags: ["Comedy"],
  },
  {
    id: 28,
    thumbnail: "https://picsum.photos/seed/cat16/320/180",
    title: "Funny Cats",
    duration: "11:00",
    channel: "MeowTime",
    tags: ["Comedy"],
  },
  {
    id: 29,
    thumbnail: "https://picsum.photos/seed/workout17/320/180",
    title: "Morning Workout",
    duration: "28:00",
    channel: "FitLife",
    tags: ["Live"],
  },
  {
    id: 30,
    thumbnail: "https://picsum.photos/seed/yoga18/320/180",
    title: "Yoga for Beginners",
    duration: "45:00",
    channel: "ZenMode",
    tags: ["Live"],
  },
  {
    id: 31,
    thumbnail: "https://picsum.photos/seed/music19/320/180",
    title: "Lo-Fi Music Mix",
    duration: "60:00",
    channel: "LoFiBeats",
    tags: ["Music", "Mixes"],
  },
  {
    id: 32,
    thumbnail: "https://picsum.photos/seed/travel20/320/180",
    title: "Travel Vlog: Japan",
    duration: "55:00",
    channel: "GlobeTrotter",
    tags: ["Live"],
  },
  {
    id: 33,
    thumbnail: "https://picsum.photos/seed/art21/320/180",
    title: "Painting Tutorial",
    duration: "50:00",
    channel: "ArtStudio",
    tags: ["Mixes"],
  },
  {
    id: 34,
    thumbnail: "https://picsum.photos/seed/code22/320/180",
    title: "Learn JavaScript",
    duration: "90:00",
    channel: "DevHQ",
    tags: ["Web Development"],
  },
  {
    id: 35,
    thumbnail: "https://picsum.photos/seed/bird23/320/180",
    title: "Birds of Paradise",
    duration: "16:00",
    channel: "WildBirds",
    tags: ["History"],
  },
  {
    id: 36,
    thumbnail: "https://picsum.photos/seed/river24/320/180",
    title: "River Kayaking",
    duration: "32:00",
    channel: "OutdoorX",
    tags: ["Live"],
  },
  {
    id: 37,
    thumbnail: "https://picsum.photos/seed/night25/320/180",
    title: "Night Sky Photography",
    duration: "38:00",
    channel: "StarGazer",
    tags: ["Astronomy"],
  },
  {
    id: 38,
    thumbnail: "https://picsum.photos/seed/coffee26/320/180",
    title: "Coffee Art Tips",
    duration: "09:00",
    channel: "BrewMaster",
    tags: ["Mixes"],
  },
  {
    id: 39,
    thumbnail: "https://picsum.photos/seed/book27/320/180",
    title: "Book Review",
    duration: "20:00",
    channel: "ReadMore",
    tags: ["History"],
  },
  {
    id: 40,
    thumbnail: "https://picsum.photos/seed/game28/320/180",
    title: "Gaming Highlights",
    duration: "42:00",
    channel: "ProGamer",
    tags: ["Gaming"],
  },
  {
    id: 41,
    thumbnail: "https://picsum.photos/seed/drone29/320/180",
    title: "Drone Footage",
    duration: "17:00",
    channel: "SkyView",
    tags: ["Astronomy"],
  },
  {
    id: 42,
    thumbnail: "https://picsum.photos/seed/history30/320/180",
    title: "Ancient Civilizations",
    duration: "65:00",
    channel: "HistoryBuff",
    tags: ["History"],
  },
  {
    id: 43,
    thumbnail: "https://picsum.photos/seed/garden31/320/180",
    title: "Garden Tips",
    duration: "23:00",
    channel: "GreenThumb",
    tags: ["Live"],
  },
  {
    id: 44,
    thumbnail: "https://picsum.photos/seed/fish32/320/180",
    title: "Deep Sea Creatures",
    duration: "44:00",
    channel: "OceanDepth",
    tags: ["History"],
  },
  {
    id: 45,
    thumbnail: "https://picsum.photos/seed/bike33/320/180",
    title: "Mountain Biking",
    duration: "31:00",
    channel: "BikePro",
    tags: ["Live"],
  },
  {
    id: 46,
    thumbnail: "https://picsum.photos/seed/sky34/320/180",
    title: "Cloud Formations",
    duration: "07:00",
    channel: "WeatherNerd",
    tags: ["Astronomy"],
  },
  {
    id: 47,
    thumbnail: "https://picsum.photos/seed/market35/320/180",
    title: "Street Market Tour",
    duration: "27:00",
    channel: "FoodieWalks",
    tags: ["DD News"],
  },
  {
    id: 48,
    thumbnail: "https://picsum.photos/seed/dance36/320/180",
    title: "Dance Choreography",
    duration: "13:00",
    channel: "DanceFloor",
    tags: ["Indian Music", "Music"],
  },
  {
    id: 49,
    thumbnail: "https://picsum.photos/seed/photo37/320/180",
    title: "Photography Masterclass",
    duration: "75:00",
    channel: "LensCraft",
    tags: ["Mixes"],
  },
  {
    id: 50,
    thumbnail: "https://picsum.photos/seed/desk38/320/180",
    title: "Desk Setup Tour",
    duration: "19:00",
    channel: "SetupGoals",
    tags: ["Web Development"],
  },
  {
    id: 51,
    thumbnail: "https://picsum.photos/seed/swim39/320/180",
    title: "Swimming Tips",
    duration: "36:00",
    channel: "AquaLife",
    tags: ["Live"],
  },
  {
    id: 52,
    thumbnail: "https://picsum.photos/seed/volcano40/320/180",
    title: "Volcanic Eruption",
    duration: "48:00",
    channel: "GeoWatch",
    tags: ["Astronomy", "News"],
  },
  {
    id: 53,
    thumbnail: "https://picsum.photos/seed/farm41/320/180",
    title: "Farm Life Vlog",
    duration: "53:00",
    channel: "RuralDays",
    tags: ["DD News"],
  },
  {
    id: 54,
    thumbnail: "https://picsum.photos/seed/robot42/320/180",
    title: "AI & Robotics",
    duration: "58:00",
    channel: "FutureTech",
    tags: ["AI"],
  },
  {
    id: 55,
    thumbnail: "https://picsum.photos/seed/horse43/320/180",
    title: "Horse Riding Basics",
    duration: "41:00",
    channel: "EquineLife",
    tags: ["Live"],
  },
  {
    id: 56,
    thumbnail: "https://picsum.photos/seed/dessert44/320/180",
    title: "Chocolate Cake Recipe",
    duration: "26:00",
    channel: "SweetBakes",
    tags: ["Mixes"],
  },
  {
    id: 57,
    thumbnail: "https://picsum.photos/seed/waterfall45/320/180",
    title: "Waterfall Hike",
    duration: "33:00",
    channel: "NatureWalks",
    tags: ["Live"],
  },
  {
    id: 58,
    thumbnail: "https://picsum.photos/seed/candle46/320/180",
    title: "DIY Candle Making",
    duration: "21:00",
    channel: "CraftCorner",
    tags: ["Mixes"],
  },
  {
    id: 59,
    thumbnail: "https://picsum.photos/seed/castle47/320/180",
    title: "Castle Exploration",
    duration: "67:00",
    channel: "HistoricPlaces",
    tags: ["History"],
  },
  {
    id: 60,
    thumbnail: "https://picsum.photos/seed/surf48/320/180",
    title: "Surfing Lessons",
    duration: "29:00",
    channel: "WaveRider",
    tags: ["Live"],
  },
  {
    id: 61,
    thumbnail: "https://picsum.photos/seed/jungle49/320/180",
    title: "Jungle Safari",
    duration: "72:00",
    channel: "WildExplorer",
    tags: ["History"],
  },
  {
    id: 62,
    thumbnail: "https://picsum.photos/seed/aurora50/320/180",
    title: "Northern Lights",
    duration: "15:00",
    channel: "ArcticVision",
    tags: ["Astronomy"],
  },
];

const API_KEYS = [
  process.env.REACT_APP_YOUTUBE_KEY_1,
  process.env.REACT_APP_YOUTUBE_KEY_2,
  process.env.REACT_APP_YOUTUBE_KEY_3,
  process.env.REACT_APP_YOUTUBE_KEY_4,
  process.env.REACT_APP_YOUTUBE_KEY_5,
  process.env.REACT_APP_YOUTUBE_KEY_6,
];

let currentKeyIndex = 0;

// ── Pagination cache per search query ──
// ytCache[query]              → last fetched items array
// ytCache[`_seen_${query}`]   → Set of all video IDs already shown
// ytCache[`_token_${query}`]  → YouTube nextPageToken for this query
const ytCache = {};

const SearchResults = () => {
  const location = useLocation();

  const [query, setQuery] = useState("");
  const [youtubeResults, setYoutubeResults] = useState([]);
  const [postResults, setPostResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [profileResults, setProfileResults] = useState([]);
  const [localVideoResults, setLocalVideoResults] = useState([]);
  const [reelResults, setReelResults] = useState([]);
  // ✅ ADDED: separate "still fetching YouTube/posts" flag from the
  // page-level `loading` skeleton. `loading` now only covers the brief
  // synchronous local-data pass (profiles/reels/local videos), so those
  // results render immediately instead of waiting on the YouTube API.
  const [ytPostsLoading, setYtPostsLoading] = useState(false);

  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(null);
  const [autoplay, setAutoplay] = useState(true);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [subscribedChannels, setSubscribedChannels] = useState(new Set());
  const [comment, setComment] = useState("");
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [comments, setComments] = useState([
    {
      id: 1,
      user: "Rahul",
      text: "Amazing video! 🔥",
      time: "2 days ago",
      likes: 24,
    },
    {
      id: 2,
      user: "Priya",
      text: "Loved this content!",
      time: "1 day ago",
      likes: 12,
    },
    {
      id: 3,
      user: "Amit",
      text: "Very informative, thanks!",
      time: "5 hours ago",
      likes: 5,
    },
  ]);

  const autoplayRef = useRef(autoplay);
  const playerRef = useRef(null);
  // NEW: dedicated ref for the actual DOM node the YT.Player mounts into.
  // React renders this element exactly once and never touches its
  // children again — the previous code manually cleared/rebuilt this
  // node with innerHTML + createElement, which fought with React's own
  // reconciliation of the same JSX node and caused the player to get
  // torn down and rebuilt (i.e. "restart") on unrelated re-renders.
  const playerContainerRef = useRef(null);
  // NEW: tracks whether the underlying YT.Player instance has fired
  // onReady, so we know it's safe to call methods like loadVideoById.
  const playerReadyRef = useRef(false);
  const resultsRef = useRef(youtubeResults);
  const indexRef = useRef(selectedVideoIndex);
  const lastSearchedQueryRef = useRef(null);
  const initializedVideoIdRef = useRef(null);

  useEffect(() => {
    autoplayRef.current = autoplay;
  }, [autoplay]);
  useEffect(() => {
    resultsRef.current = youtubeResults;
  }, [youtubeResults]);
  useEffect(() => {
    indexRef.current = selectedVideoIndex;
  }, [selectedVideoIndex]);

  // Load YouTube IFrame API script once
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
  }, []);

  // Init/reinit YT Player whenever selectedVideo changes.
  //
  // FIX: instead of destroying the player and rebuilding the DOM node by
  // hand every time selectedVideo changes (which caused the video to
  // visibly "refresh"/restart, especially when unrelated state like
  // comments/likes/showFullDesc changed and triggered a re-render), we:
  //   1. Mount the YT.Player exactly once into a ref'd div that React
  //      renders once and never re-touches.
  //   2. On subsequent video changes, reuse the existing player instance
  //      via loadVideoById() instead of destroying/recreating it.
  useEffect(() => {
    if (!selectedVideo) {
      initializedVideoIdRef.current = null;
      return;
    }

    // If a ready player instance already exists, just swap the video in
    // place — no teardown, no DOM rebuild, no restart flicker.
    if (playerRef.current && playerReadyRef.current) {
      if (initializedVideoIdRef.current !== selectedVideo) {
        playerRef.current.loadVideoById(selectedVideo);
        initializedVideoIdRef.current = selectedVideo;
      }
      return;
    }

    let cancelled = false;

    const initPlayer = () => {
      if (cancelled || !playerContainerRef.current) return;

      playerRef.current = new window.YT.Player(playerContainerRef.current, {
        height: window.innerWidth < 768 ? "220" : "500",
        width: "100%",
        videoId: selectedVideo,
        playerVars: {
          autoplay: 1,
          rel: 0,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            playerReadyRef.current = true;
            initializedVideoIdRef.current = selectedVideo;
          },
          // Rely solely on onStateChange for "ended" detection. Running a
          // second 1s-poll alongside it created a race where both paths
          // could fire close together and call openVideo() twice for the
          // same transition, which is what triggered the visible "restart".
          onStateChange: (event) => {
            if (event.data === 0 && autoplayRef.current) {
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
      cancelled = true;
    };
  }, [selectedVideo]);

  // Destroy the player only when the component actually unmounts (e.g.
  // user navigates away entirely), not on every selectedVideo change.
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
        playerReadyRef.current = false;
      }
    };
  }, []);

  // Re-run only when the actual search query text changes — not on every
  // location.key change. Previously this reset selectedVideo to null (and
  // refetched everything) any time location.key changed for any reason,
  // even while a video was open, which could interrupt/reset playback.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q") || "";
    if (!q) return;
    if (q === lastSearchedQueryRef.current) return;
    lastSearchedQueryRef.current = q;
    setQuery(q);
    setSelectedVideo(null);
    setSelectedVideoIndex(null);
    fetchAll(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, location.search]);

  // ✅ CHANGED: profiles/reels/local videos are all computed synchronously
  // from data already in memory (or a single fast Supabase call for
  // reels) — there's no reason to make the user wait on the slower
  // YouTube + posts network calls before seeing any of them. `loading`
  // now only spans that quick local pass, and flips off right after;
  // `ytPostsLoading` covers the YouTube/posts fetch separately so those
  // sections can show their own inline "searching..." state without
  // blocking everything else.
  const fetchAll = async (q) => {
    setLoading(true);
    setYoutubeResults([]);
    setPostResults([]);
    setProfileResults([]);
    setLocalVideoResults([]);
    setReelResults([]);

    const lowerQ = q.toLowerCase();

    // Fetch reels from Supabase (the hardcoded reelsData array no longer exists)
    const { data: dbReelsRaw } = await supabase
      .from("reels")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    const allReelsData = (dbReelsRaw || []).map((r) => ({
      id: `db_${r.id}`,
      video: r.video_url,
      thumbnail: r.thumbnail || "https://picsum.photos/200/350?random=99",
      caption: r.title || r.description || "Untitled",
      description: r.description || "",
      tags: r.tags || [],
      song: r.song || "",
      user: r.user || r.username || "Unknown",
      username: r.username || "unknown",
      profilePic: `https://api.dicebear.com/7.x/initials/svg?seed=${r.username || "user"}`,
    }));

    // Search profiles
    const matchedProfiles = allReelsData.filter(
      (r) =>
        r?.user?.toLowerCase().includes(lowerQ) ||
        r?.username?.toLowerCase().includes(lowerQ),
    );
    const uniqueProfiles = [
      ...new Map(matchedProfiles.map((p) => [p.username, p])).values(),
    ];
    setProfileResults(uniqueProfiles);

    // Search reels
    const matchedReels = allReelsData.filter(
      (r) =>
        r.caption?.toLowerCase().includes(lowerQ) ||
        r.tags?.some((tag) => tag.toLowerCase().includes(lowerQ)) ||
        r.description?.toLowerCase().includes(lowerQ) ||
        r.song?.toLowerCase().includes(lowerQ) ||
        r.user?.toLowerCase().includes(lowerQ) ||
        r.username?.toLowerCase().includes(lowerQ),
    );
    setReelResults(matchedReels);

    // Search local videos
    const matchedVideos = localVideos.filter(
      (v) =>
        v.title.toLowerCase().includes(lowerQ) ||
        v.channel.toLowerCase().includes(lowerQ),
    );
    setLocalVideoResults(matchedVideos);

    // ✅ CHANGED: local/synchronous results are ready — drop the full-page
    // skeleton now instead of waiting on YouTube + posts.
    setLoading(false);

    // ✅ CHANGED: YouTube + posts fetch independently in the background;
    // their own sections show a "searching..." state via ytPostsLoading
    // without blocking the sections above.
    setYtPostsLoading(true);
    await Promise.all([fetchYoutube(q), fetchPosts(q)]);
    setYtPostsLoading(false);
  };

  // ── FIXED: fetchYoutube with pagination + deduplication ──
  const fetchYoutube = async (q) => {
    // Initialize seen-IDs Set for this query if it doesn't exist yet
    if (!ytCache[`_seen_${q}`]) {
      ytCache[`_seen_${q}`] = new Set();
    }
    const seenIds = ytCache[`_seen_${q}`];

    // Get stored nextPageToken (empty string on first search)
    const pageToken = ytCache[`_token_${q}`] || "";

    for (let i = 0; i < API_KEYS.length; i++) {
      const keyIndex = (currentKeyIndex + i) % API_KEYS.length;
      try {
        const params = {
          part: "snippet",
          q,
          type: "video",
          maxResults: 50,
          order: "relevance",
          key: API_KEYS[keyIndex],
        };

        // Only include pageToken when we have one (avoids YouTube API error on first call)
        if (pageToken) {
          params.pageToken = pageToken;
        }

        const res = await axios.get(
          "https://www.googleapis.com/youtube/v3/search",
          { params },
        );

        currentKeyIndex = keyIndex;

        // Save next page token for the next search of the same query
        ytCache[`_token_${q}`] = res.data.nextPageToken || "";

        // Filter out videos already shown to the user
        const newItems = res.data.items.filter(
          (item) => !seenIds.has(item.id.videoId),
        );

        // Mark all returned videos as seen
        res.data.items.forEach((item) => seenIds.add(item.id.videoId));

        // If all were already seen (edge case), show them anyway to avoid empty screen
        const finalItems = newItems.length > 0 ? newItems : res.data.items;

        setYoutubeResults(finalItems);
        return;
      } catch (err) {
        if (err.response?.status === 403) {
          currentKeyIndex = (keyIndex + 1) % API_KEYS.length;
          continue;
        }
        console.error(
          "YouTube API error:",
          err.response?.data?.error?.message || err.message,
        );
        break;
      }
    }
  };

  const fetchPosts = async (q) => {
    try {
      const res = await axios.get(`/api/posts?search=${encodeURIComponent(q)}`);
      setPostResults(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPostResults([]);
    }
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
      next.has(channelTitle)
        ? next.delete(channelTitle)
        : next.add(channelTitle);
      return next;
    });
  };

  const goNext = () => {
    const n = selectedVideoIndex + 1;
    if (n < youtubeResults.length) openVideo(youtubeResults[n], n);
  };

  const goPrev = () => {
    const p = selectedVideoIndex - 1;
    if (p >= 0) openVideo(youtubeResults[p], p);
  };

  const currentItem = selectedVideo ? youtubeResults[selectedVideoIndex] : null;
  const relatedVideos = selectedVideo
    ? youtubeResults.filter((_, i) => i !== selectedVideoIndex)
    : [];
  const showVideos = activeTab === "all" || activeTab === "videos";
  const showPosts = activeTab === "all" || activeTab === "posts";
  const isMobile = window.innerWidth < 768;

  const TAB_LIST = [
    "all",
    "profiles",
    "reels",
    "localVideos",
    "videos",
    "posts",
  ];
  const TAB_LABELS = {
    all: "🔍 All",
    profiles: "👤 Profiles",
    reels: "🎞️ Reels",
    localVideos: "🎬 Videos",
    videos: "▶ YouTube",
    posts: "📱 Posts",
  };
  const TAB_COUNTS = {
    profiles: profileResults.length,
    reels: reelResults.length,
    localVideos: localVideoResults.length,
    videos: youtubeResults.length,
    posts: postResults.length,
  };

  const hasAnyResults =
    youtubeResults.length > 0 ||
    postResults.length > 0 ||
    profileResults.length > 0 ||
    localVideoResults.length > 0 ||
    reelResults.length > 0;

  return (
    <div
      style={{
        background: "#0f0f0f",
        minHeight: "100vh",
        paddingTop: "70px",
        fontFamily: "Roboto, Arial, sans-serif",
        color: "white",
      }}
    >
      {/* ── LOADING SKELETONS ── */}
      {loading && (
        <div style={{ padding: "20px" }}>
          <div
            style={{
              color: "#aaa",
              fontSize: "14px",
              marginBottom: "16px",
              textAlign: "center",
            }}
          >
            🔍 Searching for "
            <strong style={{ color: "white" }}>{query}</strong>"...
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "16px",
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
        </div>
      )}

      {!loading && (
        <>
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
              {/* LEFT: Player */}
              <div style={{ flex: "1 1 0", minWidth: 0, width: "100%" }}>
                <div
                  style={{
                    borderRadius: "12px",
                    overflow: "hidden",
                    background: "#000",
                  }}
                >
                  {/*
                    FIX: This container and its child are now rendered
                    ONCE by React and never manually cleared/replaced.
                    The YT.Player is mounted into playerContainerRef and
                    reused via loadVideoById() on subsequent video
                    changes, instead of being torn down and rebuilt.
                  */}
                  <div
                    id="yt-player-container"
                    style={{
                      width: "100%",
                      height: isMobile ? "220px" : "500px",
                    }}
                  >
                    <div
                      ref={playerContainerRef}
                      style={{ width: "100%", height: "100%" }}
                    />
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
                    onClick={goPrev}
                    disabled={selectedVideoIndex === 0}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      background:
                        selectedVideoIndex === 0 ? "#2a2a2a" : "#272727",
                      border: "none",
                      color: selectedVideoIndex === 0 ? "#555" : "white",
                      borderRadius: "20px",
                      padding: "8px 18px",
                      cursor:
                        selectedVideoIndex === 0 ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedVideoIndex !== 0)
                        e.currentTarget.style.background = "#3a3a3a";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        selectedVideoIndex === 0 ? "#2a2a2a" : "#272727";
                    }}
                  >
                    ⏮ Previous
                  </button>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span style={{ color: "#aaa", fontSize: "13px" }}>
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
                      }}
                    >
                      {autoplay ? "ON" : "OFF"}
                    </span>
                  </div>

                  <button
                    onClick={goNext}
                    disabled={selectedVideoIndex === youtubeResults.length - 1}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      background:
                        selectedVideoIndex === youtubeResults.length - 1
                          ? "#2a2a2a"
                          : "#ff0000",
                      border: "none",
                      color:
                        selectedVideoIndex === youtubeResults.length - 1
                          ? "#555"
                          : "white",
                      borderRadius: "20px",
                      padding: "8px 18px",
                      cursor:
                        selectedVideoIndex === youtubeResults.length - 1
                          ? "not-allowed"
                          : "pointer",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedVideoIndex !== youtubeResults.length - 1)
                        e.currentTarget.style.background = "#cc0000";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        selectedVideoIndex === youtubeResults.length - 1
                          ? "#2a2a2a"
                          : "#ff0000";
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
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <img
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(currentItem.snippet.channelTitle)}&background=random&size=40`}
                          alt="ch"
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                          }}
                        />
                        <div>
                          <div
                            style={{
                              color: "white",
                              fontWeight: "600",
                              fontSize: "15px",
                            }}
                          >
                            {currentItem.snippet.channelTitle}
                          </div>
                          <div style={{ color: "#aaa", fontSize: "12px" }}>
                            1.2M subscribers
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            handleSubscribe(currentItem.snippet.channelTitle)
                          }
                          style={{
                            background: subscribedChannels.has(
                              currentItem.snippet.channelTitle,
                            )
                              ? "#272727"
                              : "white",
                            color: subscribedChannels.has(
                              currentItem.snippet.channelTitle,
                            )
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
                          {subscribedChannels.has(
                            currentItem.snippet.channelTitle,
                          )
                            ? "✓ Subscribed"
                            : "Subscribe"}
                        </button>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
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
                              background: disliked
                                ? "#ff444422"
                                : "transparent",
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
                              `https://www.youtube.com/watch?v=${selectedVideo}`,
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
                      <div
                        style={{
                          color: "#aaa",
                          fontSize: "13px",
                          marginBottom: "6px",
                        }}
                      >
                        {new Date(
                          currentItem.snippet.publishedAt,
                        ).toLocaleDateString("en-US", {
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
                        {currentItem.snippet.description ||
                          "No description available."}
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
                      <div
                        style={{
                          display: "flex",
                          gap: "12px",
                          marginBottom: "24px",
                        }}
                      >
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
                          style={{
                            display: "flex",
                            gap: "12px",
                            marginBottom: "20px",
                          }}
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
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                alignItems: "center",
                              }}
                            >
                              <span
                                style={{
                                  color: "white",
                                  fontWeight: "600",
                                  fontSize: "13px",
                                }}
                              >
                                {c.user}
                              </span>
                              <span style={{ color: "#aaa", fontSize: "12px" }}>
                                {c.time}
                              </span>
                            </div>
                            <div
                              style={{
                                color: "#ccc",
                                fontSize: "14px",
                                marginTop: "4px",
                              }}
                            >
                              {c.text}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "12px",
                                marginTop: "6px",
                              }}
                            >
                              <span
                                style={{
                                  color: "#aaa",
                                  fontSize: "13px",
                                  cursor: "pointer",
                                }}
                              >
                                👍 {c.likes}
                              </span>
                              <span
                                style={{
                                  color: "#aaa",
                                  fontSize: "13px",
                                  cursor: "pointer",
                                }}
                              >
                                👎
                              </span>
                              <span
                                style={{
                                  color: "#aaa",
                                  fontSize: "13px",
                                  cursor: "pointer",
                                }}
                              >
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

              {/* RIGHT: Related sidebar */}
              <div
                style={{
                  width: isMobile ? "100%" : "402px",
                  flexShrink: 0,
                  position: isMobile ? "relative" : "sticky",
                  top: "70px",
                  height: isMobile ? "auto" : "calc(100vh - 90px)",
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
                  <span style={{ color: "#aaa", fontSize: "13px" }}>
                    Autoplay
                  </span>
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
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {relatedVideos.map((item) => {
                    const realIndex = youtubeResults.indexOf(item);
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
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "#1e1e1e")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
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
                        <div
                          style={{ flex: 1, minWidth: 0, paddingTop: "2px" }}
                        >
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
                          <div
                            style={{
                              color: "#aaa",
                              fontSize: "12px",
                              marginBottom: "2px",
                            }}
                          >
                            {item.snippet.channelTitle}
                          </div>
                          <div style={{ color: "#aaa", fontSize: "12px" }}>
                            {new Date(
                              item.snippet.publishedAt,
                            ).toLocaleDateString("en-US", {
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
            /* ── SEARCH RESULTS GRID ── */
            <div style={{ padding: "20px" }}>
              <div style={{ marginBottom: "20px" }}>
                <div
                  style={{
                    fontSize: "15px",
                    color: "#aaa",
                    marginBottom: "14px",
                  }}
                >
                  Results for{" "}
                  <strong style={{ color: "white" }}>"{query}"</strong>
                  {youtubeResults.length > 0 && (
                    <span
                      style={{
                        marginLeft: "8px",
                        color: "#555",
                        fontSize: "13px",
                      }}
                    >
                      — {youtubeResults.length} YouTube videos
                      {postResults.length > 0
                        ? `, ${postResults.length} posts`
                        : ""}
                    </span>
                  )}
                </div>

                {/* Tab bar */}
                {hasAnyResults && (
                  <div
                    style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
                  >
                    {TAB_LIST.map((tab) => {
                      if (tab !== "all" && TAB_COUNTS[tab] === 0) return null;
                      return (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          style={{
                            padding: "6px 16px",
                            borderRadius: "20px",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "13px",
                            fontWeight: "600",
                            background: activeTab === tab ? "white" : "#272727",
                            color: activeTab === tab ? "black" : "white",
                          }}
                        >
                          {TAB_LABELS[tab]}
                          {tab !== "all" && TAB_COUNTS[tab] > 0
                            ? ` (${TAB_COUNTS[tab]})`
                            : ""}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── PROFILES SECTION ── */}
              {(activeTab === "all" || activeTab === "profiles") &&
                profileResults.length > 0 && (
                  <div style={{ marginBottom: "40px" }}>
                    <h2
                      style={{
                        fontSize: "15px",
                        color: "#aaa",
                        marginBottom: "16px",
                        fontWeight: "600",
                      }}
                    >
                      👤 Profiles
                    </h2>
                    <div
                      style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}
                    >
                      {profileResults.map((profile) => (
                        <Link
                          key={profile.username}
                          to={`/user/${profile.username}`}
                          style={{ textDecoration: "none" }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: "8px",
                              background: "#1a1a1a",
                              borderRadius: "12px",
                              padding: "16px 24px",
                              cursor: "pointer",
                              transition: "background 0.2s",
                              minWidth: "120px",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background = "#272727")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = "#1a1a1a")
                            }
                          >
                            <img
                              src={profile.profilePic}
                              alt={profile.user}
                              style={{
                                width: "64px",
                                height: "64px",
                                borderRadius: "50%",
                                objectFit: "cover",
                                border: "2px solid #333",
                              }}
                            />
                            <div
                              style={{
                                color: "white",
                                fontWeight: "600",
                                fontSize: "14px",
                                textAlign: "center",
                              }}
                            >
                              {profile.user}
                            </div>
                            <div style={{ color: "#aaa", fontSize: "12px" }}>
                              @{profile.username}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

              {/* ── REELS SECTION ── */}
              {(activeTab === "all" || activeTab === "reels") &&
                reelResults.length > 0 && (
                  <div style={{ marginBottom: "40px" }}>
                    <h2
                      style={{
                        fontSize: "15px",
                        color: "#aaa",
                        marginBottom: "12px",
                        fontWeight: "600",
                      }}
                    >
                      🎞️ Reels
                    </h2>
                    <div
                      style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}
                    >
                      {reelResults.map((reel) => (
                        <Link
                          key={reel.id}
                          to={`/reels/${reel.id}`}
                          style={{ textDecoration: "none" }}
                        >
                          <div
                            style={{
                              width: "160px",
                              borderRadius: "12px",
                              overflow: "hidden",
                              background: "#1a1a1a",
                              cursor: "pointer",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background = "#272727")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = "#1a1a1a")
                            }
                          >
                            <video
                              src={reel.video}
                              poster={reel.thumbnail}
                              style={{
                                width: "100%",
                                height: "280px",
                                objectFit: "cover",
                                display: "block",
                              }}
                              muted
                              playsInline
                              onMouseEnter={(e) => e.target.play()}
                              onMouseLeave={(e) => {
                                e.target.pause();
                                e.target.currentTime = 0;
                              }}
                            />
                            <div style={{ padding: "8px" }}>
                              <div
                                style={{
                                  color: "white",
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  overflow: "hidden",
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                }}
                              >
                                {reel.caption}
                              </div>
                              <div
                                style={{
                                  color: "#aaa",
                                  fontSize: "11px",
                                  marginTop: "4px",
                                }}
                              >
                                @{reel.username}
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

              {/* ── LOCAL VIDEOS SECTION ── */}
              {(activeTab === "all" || activeTab === "localVideos") &&
                localVideoResults.length > 0 && (
                  <div style={{ marginBottom: "40px" }}>
                    <h2
                      style={{
                        fontSize: "15px",
                        color: "#aaa",
                        marginBottom: "12px",
                        fontWeight: "600",
                      }}
                    >
                      🎬 Videos
                    </h2>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(280px, 1fr))",
                        gap: "16px",
                      }}
                    >
                      {localVideoResults.map((video) => (
                        <Link
                          key={video.id}
                          to={`/video/${video.id}`}
                          style={{ textDecoration: "none" }}
                        >
                          <div
                            style={{ cursor: "pointer" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.querySelector(
                                ".lthumb",
                              ).style.transform = "scale(1.03)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.querySelector(
                                ".lthumb",
                              ).style.transform = "scale(1)")
                            }
                          >
                            <div
                              style={{
                                borderRadius: "12px",
                                overflow: "hidden",
                                position: "relative",
                              }}
                            >
                              <img
                                className="lthumb"
                                src={video.thumbnail}
                                alt={video.title}
                                style={{
                                  width: "100%",
                                  aspectRatio: "16/9",
                                  objectFit: "cover",
                                  display: "block",
                                  transition: "transform 0.3s",
                                }}
                              />
                              <div
                                style={{
                                  position: "absolute",
                                  bottom: "6px",
                                  right: "8px",
                                  background: "rgba(0,0,0,0.8)",
                                  color: "white",
                                  fontSize: "12px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                }}
                              >
                                {video.duration}
                              </div>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "10px",
                                padding: "10px 4px",
                              }}
                            >
                              <img
                                src={`https://api.dicebear.com/7.x/initials/svg?seed=${video.channel}`}
                                alt={video.channel}
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
                                    fontSize: "13px",
                                    lineHeight: "1.4",
                                    marginBottom: "4px",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                  }}
                                >
                                  {video.title}
                                </div>
                                <div
                                  style={{ color: "#aaa", fontSize: "12px" }}
                                >
                                  {video.channel}
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

              {/* ── POSTS SECTION ── */}
              {showPosts && postResults.length > 0 && (
                <div style={{ marginBottom: "40px" }}>
                  <h2
                    style={{
                      fontSize: "15px",
                      color: "#aaa",
                      marginBottom: "12px",
                      fontWeight: "600",
                    }}
                  >
                    📱 Posts
                  </h2>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(280px, 1fr))",
                      gap: "16px",
                    }}
                  >
                    {postResults.map((post, i) => (
                      <div
                        key={i}
                        style={{
                          background: "#272727",
                          borderRadius: "12px",
                          overflow: "hidden",
                          cursor: "pointer",
                          transition: "transform 0.2s",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.transform = "translateY(-2px)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.transform = "translateY(0)")
                        }
                      >
                        {post.image && (
                          <img
                            src={post.image}
                            alt={post.title}
                            style={{
                              width: "100%",
                              aspectRatio: "16/9",
                              objectFit: "cover",
                            }}
                          />
                        )}
                        <div style={{ padding: "12px" }}>
                          <div
                            style={{
                              fontWeight: "600",
                              fontSize: "14px",
                              color: "white",
                              marginBottom: "4px",
                            }}
                          >
                            {post.title}
                          </div>
                          <div style={{ color: "#aaa", fontSize: "12px" }}>
                            {post.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── YOUTUBE VIDEOS SECTION ── */}
              {/* ✅ CHANGED: now shows an inline "searching..." indicator
                  driven by ytPostsLoading while YouTube is still loading,
                  instead of relying on the page-level `loading` flag which
                  no longer covers this fetch. */}
              {showVideos && (youtubeResults.length > 0 || ytPostsLoading) && (
                <div>
                  {postResults.length > 0 && showPosts && (
                    <h2
                      style={{
                        fontSize: "15px",
                        color: "#aaa",
                        marginBottom: "12px",
                        fontWeight: "600",
                      }}
                    >
                      ▶ YouTube Videos
                      {ytPostsLoading && (
                        <span
                          style={{
                            marginLeft: "8px",
                            color: "#555",
                            fontSize: "12px",
                            fontWeight: "500",
                          }}
                        >
                          — searching...
                        </span>
                      )}
                    </h2>
                  )}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(280px, 1fr))",
                      gap: "16px",
                    }}
                  >
                    {youtubeResults.map((item, index) => (
                      <div
                        key={item.id.videoId}
                        onClick={() => openVideo(item, index)}
                        style={{ cursor: "pointer" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.querySelector(
                            ".thumb",
                          ).style.transform = "scale(1.03)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.querySelector(
                            ".thumb",
                          ).style.transform = "scale(1)")
                        }
                      >
                        <div
                          style={{ borderRadius: "12px", overflow: "hidden" }}
                        >
                          <img
                            className="thumb"
                            src={item.snippet.thumbnails.medium.url}
                            alt={item.snippet.title}
                            style={{
                              width: "100%",
                              aspectRatio: "16/9",
                              objectFit: "cover",
                              display: "block",
                              transition: "transform 0.3s",
                            }}
                          />
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            padding: "10px 4px",
                          }}
                        >
                          <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.snippet.channelTitle)}&background=random&size=36`}
                            alt="ch"
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
                                fontSize: "13px",
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
                            <div
                              style={{
                                color: "#aaa",
                                fontSize: "12px",
                                marginBottom: "2px",
                              }}
                            >
                              {item.snippet.channelTitle}
                            </div>
                            <div style={{ color: "#aaa", fontSize: "12px" }}>
                              {new Date(
                                item.snippet.publishedAt,
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── NO RESULTS ── */}
              {/* ✅ CHANGED: don't show "no results" while YouTube/posts
                  are still in flight — hasAnyResults could legitimately
                  be false for a moment even though results are coming. */}
              {!hasAnyResults && !ytPostsLoading && (
                <div style={{ textAlign: "center", marginTop: "80px" }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                    🔍
                  </div>
                  <p style={{ color: "#555", fontSize: "16px" }}>
                    No results found for "
                    <span style={{ color: "#aaa" }}>{query}</span>"
                  </p>
                  <p
                    style={{
                      color: "#444",
                      fontSize: "13px",
                      marginTop: "8px",
                    }}
                  >
                    Try different keywords or check your spelling
                  </p>
                </div>
              )}
            </div>
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

export default SearchResults;