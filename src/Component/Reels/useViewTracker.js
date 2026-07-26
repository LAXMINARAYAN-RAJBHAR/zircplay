import { useEffect, useRef } from "react";
import { supabase } from "../../config/supabase";

const useViewTracker = ({ contentId, contentType, isPlaying }) => {
  const timerRef  = useRef(null);
  const viewedRef = useRef(false);

  useEffect(() => {
    viewedRef.current = false;
  }, [contentId]);

  useEffect(() => {
    if (!isPlaying || viewedRef.current) return;

    timerRef.current = setTimeout(async () => {
      if (viewedRef.current) return;
      const userId = localStorage.getItem("userId");
      if (!userId) return;

      const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      const { data: existing } = await supabase
        .from("views")
        .select("viewed_at")
        .match({ user_id: userId, content_id: String(contentId), content_type: contentType })
        .maybeSingle();

      if (existing) {
        const lastViewed = new Date(existing.viewed_at).getTime();
        if (now - lastViewed < FIFTEEN_DAYS_MS) {
          viewedRef.current = true;
          return;
        }
        await supabase
          .from("views")
          .update({ viewed_at: new Date().toISOString() })
          .match({ user_id: userId, content_id: String(contentId), content_type: contentType });
      } else {
        await supabase.from("views").insert({
          user_id:      userId,
          content_id:   String(contentId),
          content_type: contentType,
          viewed_at:    new Date().toISOString(),
        });
      }

      // ── Mark in localStorage so homepage "New" tag disappears immediately ──
      localStorage.setItem(`viewed_${contentType}_${contentId}`, "true");

      viewedRef.current = true;
    }, 10000); // 10 seconds

    return () => clearTimeout(timerRef.current);
  }, [isPlaying, contentId, contentType]);
};

export default useViewTracker;