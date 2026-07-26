import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { supabase } from "../config/supabase";

const PresenceContext = createContext({
  onlineUsers: new Set(),
  lastSeenMap: {},
  getLastSeen: async () => null,
});

export const usePresence = () => useContext(PresenceContext);

// Accepts currentUser as a prop instead of reading localStorage directly,
// so it stays in sync with login/logout instead of only reading once on mount.
export const PresenceProvider = ({ currentUser, children }) => {
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  // Local cache of last-seen timestamps, keyed by username.
  // Populated either by a "leave" presence event or an on-demand DB fetch.
  const [lastSeenMap, setLastSeenMap] = useState({});

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

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineUsers(new Set(Object.keys(state)));
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        const nowIso = new Date().toISOString();

        // Optimistic local update so the UI reflects it immediately
        setLastSeenMap((prev) => ({ ...prev, [key]: nowIso }));

        // Persist so it survives refreshes / is visible to other users
        // opening the chat later. Any subscribed client can write this;
        // a small race between multiple writers is harmless since the
        // timestamps will all be within milliseconds of each other.
        supabase
          .from("profiles")
          .update({ last_seen_at: nowIso })
          .eq("username", key)
          .then(() => {});
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => supabase.removeChannel(channel);
  }, [currentUser]);

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