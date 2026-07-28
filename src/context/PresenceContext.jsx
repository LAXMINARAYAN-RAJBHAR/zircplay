import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { supabase } from "../config/supabase";

const PresenceContext = createContext({
  onlineUsers: new Set(),
  lastSeenMap: {},
  getLastSeen: async () => null,
});

export const usePresence = () => useContext(PresenceContext);

// How often an online client "checks in" with its own last_seen_at.
// Keeps the value fresh even if the tab is later closed uncleanly
// (crash, force-quit, network drop) and no clean "leave" is ever caught.
const HEARTBEAT_MS = 60 * 1000;

// Accepts currentUser as a prop instead of reading localStorage directly,
// so it stays in sync with login/logout instead of only reading once on mount.
export const PresenceProvider = ({ currentUser, children }) => {
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  // Local cache of last-seen timestamps, keyed by username.
  // Populated either by a "leave" presence event or an on-demand DB fetch.
  const [lastSeenMap, setLastSeenMap] = useState({});

  const channelRef = useRef(null);

  // Writes last_seen_at for the CURRENT user (never for someone else —
  // this is what fixes the old "only updates if another client is
  // watching you leave" bug). Safe to call often; failures are silent
  // since this is best-effort freshness, not critical data.
  const touchOwnLastSeen = useCallback(() => {
    if (!currentUser) return;
    const nowIso = new Date().toISOString();
    supabase
      .from("profiles")
      .update({ last_seen_at: nowIso })
      .eq("username", currentUser)
      .then(() => {});
  }, [currentUser]);

  // ── Presence: tracks this user as "online" for as long as the site
  //    tab is open, regardless of whether the Messages panel is open ──
  useEffect(() => {
    if (!currentUser) {
      setOnlineUsers(new Set());
      return;
    }

    const channel = supabase.channel("online-users", {
      config: { presence: { key: currentUser } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineUsers(new Set(Object.keys(state)));
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        // Kept as a nice-to-have: if we happen to witness someone else's
        // clean leave, update our local cache immediately so their status
        // flips to "Last seen just now" without waiting for a refetch.
        // NOTE: we intentionally no longer WRITE to the DB on someone
        // else's behalf here — each user now maintains their own
        // last_seen_at via touchOwnLastSeen() below, which is reliable
        // even when nobody else is around to see them leave.
        const nowIso = new Date().toISOString();
        setLastSeenMap((prev) => ({ ...prev, [key]: nowIso }));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
          // Mark ourselves seen the moment we come online, so a brand-new
          // user (or one whose last_seen_at was never set) immediately
          // has a real value instead of staying NULL forever.
          touchOwnLastSeen();
        }
      });

    return () => {
      // Best-effort: record our own last_seen_at as we disconnect.
      // Not guaranteed to complete (tab close can race the request),
      // which is exactly why the heartbeat below exists as a backstop.
      touchOwnLastSeen();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [currentUser, touchOwnLastSeen]);

  // ── Heartbeat: periodically refresh our own last_seen_at while online,
  //    so even an unclean disconnect (crash, force-quit, lost network,
  //    killed mobile app) leaves a recent, accurate timestamp behind
  //    instead of one that's stale or missing. ──
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(touchOwnLastSeen, HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [currentUser, touchOwnLastSeen]);

  // ── Best-effort write on tab close / app backgrounding. beforeunload
  //    and visibilitychange aren't 100% guaranteed to complete a network
  //    request, but combined with the heartbeat above, last_seen_at will
  //    never be more than ~60s stale for a user who goes offline. ──
  useEffect(() => {
    if (!currentUser) return;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") touchOwnLastSeen();
    };
    window.addEventListener("beforeunload", touchOwnLastSeen);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("beforeunload", touchOwnLastSeen);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [currentUser, touchOwnLastSeen]);

  // On-demand fetch + cache for users we haven't seen leave this session
  // (e.g. someone who was already offline before this client connected).
  const getLastSeen = useCallback(
    async (username) => {
      if (lastSeenMap[username] !== undefined) return lastSeenMap[username];

      const { data } = await supabase
        .from("profiles")
        .select("last_seen_at")
        .eq("username", username)
        .maybeSingle();

      const value = data?.last_seen_at || null;
      setLastSeenMap((prev) => ({ ...prev, [username]: value }));
      return value;
    },
    [lastSeenMap],
  );

  // ── Global delivery marking: fires the instant this client receives
  //    ANY message, whether or not the Messages panel is open ──
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel(`dm-global-delivery-${currentUser}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        async (payload) => {
          const msg = payload.new;
          if (msg.sender_username !== currentUser && !msg.delivered_at) {
            await supabase
              .from("direct_messages")
              .update({ delivered_at: new Date().toISOString() })
              .eq("id", msg.id)
              .is("delivered_at", null);
          }
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUser]);

  return (
    <PresenceContext.Provider value={{ onlineUsers, lastSeenMap, getLastSeen }}>
      {children}
    </PresenceContext.Provider>
  );
};