import "./App.css";
import Navbar from "./Component/Navbar/navbar";
import Home from "./Pages/Home/home";
import { useState, useEffect, useRef, useCallback } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Video from "./Pages/Video/video";
import Profile from "./Pages/Profile/profile";
import VideoUpload from "./Pages/VideoUpload/videoUpload";
import SignUp from "./Pages/SignUp/signUp";
import Reels from "./Component/Reels/reels";
import Footer from "./Component/Footer/footer";
import YouTubeSearch from "./Component/YouTubeSearch/youTubeSearch";
import SearchResults from "./Component/SearchResults/searchResults";
import Notifications from "./Component/Notifications/notifications";
import ComingSoon from "./Pages/ComingSoon/comingSoon";
import ScrollToTop from "./ScrollToTop";
import LiveTVPage from "./Pages/LiveTV/LiveTVPage";
import LocalMediaPlayer from "./Pages/LocalMediaPlayer/LocalMediaPlayer";
import TermsAndConditions from "./Pages/TermsAndConditions/termsAndConditions";
import Feedback from "./Pages/Feedback/feedback";
import Help from "./Pages/Help/help";
import ContactSupport from "./Pages/ContactSupport/contactSupport";
import ReportProblem from "./Pages/ReportProblem/reportProblem";
import { supabase } from "./config/supabase";
import BottomNav from "./Component/BottomNav/BottomNav";
import PostFeed from "./Pages/PostFeed/PostFeed";
import {
  AboutPage,
  PrivacyPolicyPage,
  DmcaPage,
  CommunityGuidelinesPage,
  AdvertisePage,
} from "./Pages/ZixplonPages";
import LikedVideos      from "./Pages/LikedVideos/LikedVideos";
import YourVideos       from "./Pages/YourVideos/YourVideos";
import WatchLater       from "./Pages/WatchLater/WatchLater";
import History          from "./Pages/History/History";
import SubscriptionFeed from "./Pages/SubscriptionFeed/SubscriptionFeed";
import Playlist         from "./Pages/Playlist/Playlist";
import YourClips        from "./Pages/YourClips/YourClips";
import SideNavbar       from "./Component/SideNavbar/sideNavbar";
import LoginOptionsModal from "./Component/LoginOptionsModal/LoginOptionsModal";
import AdminPanel       from "./Pages/AdminPanel/AdminPanel";
import LiveBrowser      from "./Component/Live/LiveViewer";
import MessagesPanel    from "./Pages/Messages/MessagesPanel";
import { PresenceProvider } from "./context/PresenceContext";

// ── Google Identity Services (One Tap) config ──────────────────────────────
// TODO: replace with the SAME OAuth Client ID configured under
// Supabase → Authentication → Providers → Google → "Client ID".
// Also add your ZIXPLON origin(s) (e.g. https://zixplon-tawny.vercel.app)
// to "Authorized JavaScript origins" in the Google Cloud Console for this
// Client ID, or One Tap will silently refuse to display.
const GOOGLE_CLIENT_ID = "578212794302-0pbugtvmlfo5k0pq1ph9fki82nnj9srl.apps.googleusercontent.com";

// Generates a nonce pair for the OIDC sign-in, as recommended by Supabase
// when using signInWithIdToken — protects against token replay.
async function generateNonce() {
  const rawNonce =
    (crypto.randomUUID && crypto.randomUUID()) ||
    `${Date.now()}-${Math.random()}`;
  const encoder = new TextEncoder();
  const encodedNonce = encoder.encode(rawNonce);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encodedNonce);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashedNonce = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return { rawNonce, hashedNonce };
}

// ── Loading Screen ────────────────────────────────────────────────────────────
const LoadingScreen = ({ onFinish }) => {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFade(true), 1800);
    const doneTimer = setTimeout(() => onFinish && onFinish(), 2300);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onFinish]);

  return (
    <div
      style={{
        // ── FIX: use fixed + explicit 100vw/100vh instead of inset:0
        // so TV browsers (which mishandle inset + height:100% on #root)
        // still stretch this overlay to the full screen correctly ──
        position: "fixed",
        top: "0px",
        left: "0px",
        right: "0px",
        bottom: "0px",
        width: "100vw",
        height: "100vh",
        background: "#000000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        margin: "0px",
        padding: "0px",
        zIndex: 9999,
        opacity: fade ? 0 : 1,
        transition: "opacity 0.5s ease",
      }}
    >
      {/* ── Crisp inline SVG logo — no image file, never blurs ── */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        style={{ width: "180px", height: "180px", display: "block" }}
      >
        {/* Red rounded square */}
        <rect x="0" y="0" width="512" height="512" rx="110" ry="110" fill="#CC0000" />
        {/* Top shine */}
        <rect x="0" y="0" width="512" height="260" rx="110" ry="110" fill="#E81515" opacity="0.55" />
        {/* Bold white Z */}
        <polygon
          points="108,108 404,108 404,178 220,334 404,334 404,404 108,404 108,334 292,178 108,178"
          fill="#FFFFFF"
        />
      </svg>

      {/* ── App name ── */}
      <p
        style={{
          marginTop: "24px",
          color: "#ffffff",
          fontSize: "26px",
          fontWeight: "800",
          fontFamily: "'Outfit', 'Nunito', sans-serif",
          letterSpacing: "6px",
          textTransform: "uppercase",
          opacity: 0.92,
          margin: "24px 0 0",
        }}
      >
        ZIXPLON
      </p>

      {/* ── Subtle loading dots ── */}
      <div style={{ display: "flex", gap: "8px", marginTop: "40px" }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: "#CC0000",
              animation: `bounce 1s ease-in-out ${i * 0.18}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%            { transform: scale(1.2); opacity: 1;   }
        }
      `}</style>
    </div>
  );
};

// ── Exit Toast ────────────────────────────────────────────────────────────────
const ExitToast = ({ visible }) => (
  <div
    style={{
      position: "fixed",
      bottom: "80px",
      left: "50%",
      transform: `translateX(-50%) translateY(${visible ? "0" : "20px"})`,
      background: "rgba(30, 30, 40, 0.92)",
      color: "#fff",
      padding: "12px 24px",
      borderRadius: "24px",
      fontSize: "14px",
      fontWeight: "500",
      fontFamily: "'Outfit', 'Nunito', sans-serif",
      letterSpacing: "0.3px",
      zIndex: 99999,
      opacity: visible ? 1 : 0,
      transition: "opacity 0.25s ease, transform 0.25s ease",
      pointerEvents: "none",
      whiteSpace: "nowrap",
      boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
    }}
  >
    Press back again to exit
  </div>
);

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const location = useLocation();
  const [appReady, setAppReady] = useState(false);
  const [sideNavbar, setSideNavbar] = useState(false);
  const [currentUser, setCurrentUser] = useState(
    localStorage.getItem("username") || null,
  );

  // ── Auto-login-detect: session check + login options modal ──
  const [sessionChecked, setSessionChecked] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // ── Google One Tap state ──
  const [oneTapAttempted, setOneTapAttempted] = useState(false);
  const oneTapCancelledRef = useRef(false);

  // ── Exit-on-back state ──
  const [showExitToast, setShowExitToast] = useState(false);
  const exitToastTimer = useRef(null);
  const backPressedOnce = useRef(false);

  // ── Messages floating panel state ──
  const [showMessagesPanel, setShowMessagesPanel] = useState(false);
  const [messagesActiveUser, setMessagesActiveUser] = useState(null);

  // ── Supabase warmup ──
  useEffect(() => {
    supabase.from("videos").select("id").limit(1).then(() => {});
  }, []);

  // ── Global listener: opens the Messages panel from anywhere (sidebar,
  // a post's kebab menu, etc) without navigating/unmounting the current
  // page. Optional detail.username opens directly into that conversation. ──
  useEffect(() => {
    const handler = (e) => {
      setMessagesActiveUser(e.detail?.username || null);
      setShowMessagesPanel(true);
    };
    window.addEventListener("openMessages", handler);
    return () => window.removeEventListener("openMessages", handler);
  }, []);

  // ── Shared: resolve/create the profile row for a Supabase auth user ──
  // Used by both the session-restore effect and the Google One Tap callback.
  const resolveUsername = useCallback(async (u) => {
    try {
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("username, profile_pic, about")
        .eq("id", u.id)
        .maybeSingle();

      // ── Auto-create profile for Google OAuth / One Tap users who have none ──
      if (!profileRow) {
        const autoName =
          u.user_metadata?.name ||
          u.user_metadata?.full_name ||
          u.user_metadata?.channelName ||
          u.user_metadata?.username ||
          u.email?.split("@")[0];

        const autoPic =
          u.user_metadata?.avatar_url ||
          u.user_metadata?.picture ||
          "";

        await supabase.from("profiles").upsert(
          [{
            id: u.id,
            username: autoName,
            profile_pic: autoPic,
            about: "",
            banner_pic: "",
          }],
          { onConflict: "id" }
        );

        localStorage.setItem("username", autoName);
        localStorage.setItem("userId", u.id);
        localStorage.setItem("email", u.email || "");
        if (autoPic) localStorage.setItem("profilePic", autoPic);
        return autoName;
      }

      const name =
        profileRow?.username ||
        localStorage.getItem("username") ||
        u.user_metadata?.channelName ||
        u.user_metadata?.username ||
        u.user_metadata?.full_name ||
        u.email?.split("@")[0];

      const pic =
        profileRow?.profile_pic ||
        localStorage.getItem("profilePic") ||
        u.user_metadata?.profilePic ||
        u.user_metadata?.avatar_url ||
        u.user_metadata?.picture ||
        "";

      const about =
        profileRow?.about ||
        localStorage.getItem("about") ||
        u.user_metadata?.about ||
        "";

      localStorage.setItem("username", name);
      localStorage.setItem("userId", u.id);
      localStorage.setItem("email", u.email || "");
      if (pic) localStorage.setItem("profilePic", pic);
      if (about) localStorage.setItem("about", about);

      return name;
    } catch (e) {
      return (
        localStorage.getItem("username") ||
        u.user_metadata?.channelName ||
        u.email?.split("@")[0]
      );
    }
  }, []);

  // ── Single auth effect — profiles table is always source of truth ──
  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        alert(`getSession error: ${error.message}`);
      }

      // ── Check for OAuth error returned in the URL (hash or query) ──
      const hashParams = new URLSearchParams(window.location.hash.replace("#", "?"));
      const queryParams = new URLSearchParams(window.location.search);
      const oauthError =
        hashParams.get("error_description") || queryParams.get("error_description");
      if (oauthError) {
        alert(`OAuth redirect error: ${decodeURIComponent(oauthError)}`);
      }

      if (session?.user) {
        const name = await resolveUsername(session.user);
        setCurrentUser(name);
        setShowLoginModal(false);
        if (window.location.hash?.includes("access_token")) {
          window.history.replaceState({}, document.title, "/");
        }
      } else if (oauthError && !error) {
        alert("No session was created after Google redirect.");
      }
      // NOTE: we no longer decide showLoginModal here. When there's no
      // session, the Google One Tap effect below runs next and only falls
      // back to the manual LoginOptionsModal if One Tap can't be shown.
      setSessionChecked(true);
    });

    // Listen for login/logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          setCurrentUser(null);
          localStorage.removeItem("username");
          localStorage.removeItem("email");
          localStorage.removeItem("userId");
          localStorage.removeItem("profilePic");
          localStorage.removeItem("about");
          localStorage.removeItem("channelName");
          localStorage.removeItem("userName");
          return;
        }
        resolveUsername(session.user).then((name) => {
          setCurrentUser(name);
          setShowLoginModal(false);
        });
      }
    );

    return () => subscription.unsubscribe();
  }, [resolveUsername]);

  // ── Load the Google Identity Services script once ──
  useEffect(() => {
    if (document.getElementById("google-identity-script")) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.id = "google-identity-script";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  // ── Google One Tap: silently detect a Google account already signed
  // into the browser and log the user straight in. Falls back to the
  // existing LoginOptionsModal if One Tap can't be displayed (no Google
  // session in the browser, user opted out, FedCM blocked, etc). ──
  const suppressAutoModalRoutes = ["/signup"];

  useEffect(() => {
    if (!sessionChecked || currentUser) return;
    if (oneTapAttempted) return;
    if (suppressAutoModalRoutes.includes(location.pathname)) return;

    // Don't race with an in-flight OAuth redirect that's still resolving
    // its own #access_token hash (this is the exact race you're chasing
    // on mobile PWA — One Tap must not touch it).
    const hasAuthPayload =
      window.location.hash.includes("access_token") ||
      window.location.hash.includes("error") ||
      new URLSearchParams(window.location.search).has("code");
    if (hasAuthPayload) return;

    oneTapCancelledRef.current = false;

    const fallbackToModal = () => {
      const dismissed = sessionStorage.getItem("zixplon_login_dismissed") === "1";
      setShowLoginModal(!dismissed);
    };

    const tryOneTap = async () => {
      // GIS script loads async — wait up to ~4s for it to be ready.
      let attempts = 0;
      while (!window.google?.accounts?.id && attempts < 40) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 100));
        attempts++;
      }

      if (oneTapCancelledRef.current) return;

      if (!window.google?.accounts?.id) {
        setOneTapAttempted(true);
        fallbackToModal();
        return;
      }

      const { rawNonce, hashedNonce } = await generateNonce();

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            const { data, error } = await supabase.auth.signInWithIdToken({
              provider: "google",
              token: response.credential,
              nonce: rawNonce,
            });
            if (error) {
              console.error("One Tap sign-in error:", error.message);
              fallbackToModal();
              return;
            }
            if (data?.user) {
              const name = await resolveUsername(data.user);
              setCurrentUser(name);
              setShowLoginModal(false);
            }
          } catch (e) {
            console.error("One Tap sign-in exception:", e);
            fallbackToModal();
          }
        },
        nonce: hashedNonce,
        auto_select: true,
        cancel_on_tap_outside: false,
        use_fedcm_for_prompt: true,
      });

      window.google.accounts.id.prompt((notification) => {
        setOneTapAttempted(true);
        const wasShown =
          typeof notification.isDisplayed === "function"
            ? notification.isDisplayed()
            : false;
        if (!wasShown) {
          // No Google session in this browser, user previously dismissed
          // One Tap too many times, FedCM disabled, etc — use our modal.
          fallbackToModal();
        }
      });
    };

    tryOneTap();

    return () => {
      oneTapCancelledRef.current = true;
      if (window.google?.accounts?.id?.cancel) {
        window.google.accounts.id.cancel();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionChecked, currentUser, location.pathname]);

  // ── Mobile back-button exit logic ─────────────────────────────────────────
  useEffect(() => {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isMobile) return;

  // ── Don't touch history if an OAuth redirect hash/code is still present ──
  const hasAuthPayload =
    window.location.hash.includes("access_token") ||
    window.location.hash.includes("error") ||
    new URLSearchParams(window.location.search).has("code");
  if (hasAuthPayload) return;

  const isHome = location.pathname === "/";
  if (!isHome) {
    backPressedOnce.current = false;
    setShowExitToast(false);
    clearTimeout(exitToastTimer.current);
    return;
  }

  window.history.pushState({ zixplonExit: true }, "", "/");

    const handlePopState = () => {
      if (backPressedOnce.current) {
        clearTimeout(exitToastTimer.current);
        setShowExitToast(false);
        backPressedOnce.current = false;
        window.history.pushState({ zixplonExit: true }, "", "/");
        setTimeout(() => {
          window.location.href = "about:blank";
        }, 50);
        return;
      }

      backPressedOnce.current = true;
      setShowExitToast(true);
      window.history.pushState({ zixplonExit: true }, "", "/");

      clearTimeout(exitToastTimer.current);
      exitToastTimer.current = setTimeout(() => {
        backPressedOnce.current = false;
        setShowExitToast(false);
      }, 2000);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      clearTimeout(exitToastTimer.current);
    };
  }, [location.pathname]);
  // ──────────────────────────────────────────────────────────────────────────

  const hideFooter =
    ["/youtube", "/local-player", "/videoUpload"].includes(location.pathname) ||
    location.pathname.startsWith("/reels") ||
    location.pathname.endsWith("/upload");

  // Don't stack the auto-login modal on top of the dedicated signup/login page
  const shouldShowLoginModal =
    sessionChecked &&
    showLoginModal &&
    !currentUser &&
    !suppressAutoModalRoutes.includes(location.pathname);

  const handleDismissLoginModal = () => {
    sessionStorage.setItem("zixplon_login_dismissed", "1");
    setShowLoginModal(false);
  };

  // ── FIX: render LoadingScreen BEFORE the main App div so it is a direct
  // child of <body> via the React root — this bypasses any height/overflow
  // constraints on #root that confuse TV browser fixed positioning ──
  if (!appReady) {
    return <LoadingScreen onFinish={() => setAppReady(true)} />;
  }

  return (
    <PresenceProvider currentUser={currentUser}>
      <div
        className="App"
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          backgroundColor: "#f0f4ff",
          width: "100%",
        }}
      >
        <ScrollToTop />

        {/* Mobile exit toast */}
        <ExitToast visible={showExitToast} />

        {/* Auto login detect: Google One Tap tries first (silent, no click
            needed); if it can't be shown, this modal is the fallback */}
        {shouldShowLoginModal && (
          <LoginOptionsModal onDismiss={handleDismissLoginModal} />
        )}

        {/* Floating Messages panel — opened via the "openMessages" custom
            event (sidebar click, a post's "Message" option, etc). Renders
            on top of whatever page is currently active, without navigating
            away or unmounting it. */}
        {showMessagesPanel && (
          <MessagesPanel
            initialUsername={messagesActiveUser}
            onClose={() => setShowMessagesPanel(false)}
          />
        )}

        <Navbar
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          setSideNavbarFunc={setSideNavbar}
          sideNavbar={sideNavbar}
        />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#f0f4ff" }}>
          <SideNavbar sideNavbar={sideNavbar} />

          {/* ── FIX: content-shift wrapper ──
              Reserves left space for the sidebar so page content never
              renders underneath it. Sidebar is now ALWAYS visible on
              desktop (275px expanded / 72px collapsed icon-only strip),
              so this must never be 0 except on mobile, where the sidebar
              itself is display:none (handled by the .zx-content-shift
              media query in App.css). */}
          <div
            className="zx-content-shift"
            style={{
              marginLeft: sideNavbar ? "275px" : "72px",
              transition: "margin-left 0.2s ease",
              minHeight: "calc(100vh - 56px)",
            }}
          >
            <Routes>
              <Route path="/"               element={<Home sideNavbar={sideNavbar} />} />
              <Route path="/video/:id"      element={<Video sideNavbar={sideNavbar} />} />
              <Route path="/user/:username" element={<Profile sideNavbar={sideNavbar} />} />
              <Route path="/videoUpload"    element={<VideoUpload />} />
              <Route path="/:id/upload"     element={<VideoUpload />} />
              <Route path="/signup"         element={<SignUp />} />
              <Route path="/reels"          element={<Reels />} />
              <Route path="/reels/:id"      element={<Reels />} />
              <Route path="/search"         element={<SearchResults />} />
              <Route path="/youtube"        element={<YouTubeSearch />} />
              <Route path="/notifications"  element={<Notifications currentUser={currentUser} />} />

              <Route path="/history"        element={<History      currentUser={currentUser} sideNavbar={sideNavbar} />} />
              <Route path="/playlist"       element={<Playlist     currentUser={currentUser} sideNavbar={sideNavbar} />} />
              <Route path="/your-videos"    element={<YourVideos   currentUser={currentUser} sideNavbar={sideNavbar} />} />
              <Route path="/watch-later"    element={<WatchLater   currentUser={currentUser} sideNavbar={sideNavbar} />} />
              <Route path="/liked-videos"   element={<LikedVideos  currentUser={currentUser} sideNavbar={sideNavbar} />} />
              <Route path="/your-clips"     element={<YourClips    currentUser={currentUser} sideNavbar={sideNavbar} />} />
              <Route path="/subscription"   element={<SubscriptionFeed currentUser={currentUser} sideNavbar={sideNavbar} />} />

              <Route path="/live-tv"        element={<LiveTVPage sideNavbar={sideNavbar} />} />
              <Route path="/local-player"   element={<LocalMediaPlayer sideNavbar={sideNavbar} />} />
              <Route path="/terms-and-conditions"  element={<TermsAndConditions />} />
              <Route path="/feedback"              element={<Feedback />} />
              <Route path="/help"                  element={<Help />} />
              <Route path="/contact"               element={<ContactSupport />} />
              <Route path="/report"                element={<ReportProblem />} />
              <Route path="/about"                 element={<AboutPage />} />
              <Route path="/privacy-policy"        element={<PrivacyPolicyPage />} />
              <Route path="/dmca"                  element={<DmcaPage />} />
              <Route path="/community-guidelines"  element={<CommunityGuidelinesPage />} />
              <Route path="/advertise"             element={<AdvertisePage />} />
              <Route path="/feed"                  element={<PostFeed sideNavbar={sideNavbar} />} />
              <Route path="/admin"                 element={<AdminPanel />} />
              <Route path="/live"                  element={<LiveBrowser currentUser={currentUser} />} />
            </Routes>
          </div>
        </div>

        <BottomNav currentUser={currentUser} />
        {!hideFooter && <Footer sideNavbar={sideNavbar} />}
      </div>
    </PresenceProvider>
  );
}

export default App;