import { useCallback, useEffect, useRef, useState } from "react";

import { fetchUnreadCount } from "@/lib/notifications/api";

type UseUnreadCountOptions = {
  enabled?: boolean;
  intervalMs?: number;
};

export function useUnreadCountPolling({
  enabled = true,
  intervalMs = 45000,
}: UseUnreadCountOptions) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!enabled) return;
    try {
      const count = await fetchUnreadCount();
      setUnreadCount(count);
      setError(null);
      lastFetchRef.current = Date.now();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch unread count.",
      );
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    refreshUnreadCount();

    const interval = setInterval(() => {
      if (document.hidden) return;
      refreshUnreadCount();
    }, intervalMs);

    const handleFocus = () => {
      if (document.hidden) return;
      if (Date.now() - lastFetchRef.current > 3000) {
        refreshUnreadCount();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [enabled, intervalMs, refreshUnreadCount]);

  return {
    unreadCount,
    setUnreadCount,
    refreshUnreadCount,
    error,
  };
}
