"use client";

import { useEffect } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type RealtimeOptions = {
  userId?: string | null;
  enabled?: boolean;
  onChange: () => void;
};

export function useNotificationsRealtime({
  userId,
  enabled = true,
  onChange,
}: RealtimeOptions) {
  useEffect(() => {
    if (!enabled || !userId) return;

    let supabase: ReturnType<typeof getSupabaseBrowserClient>;
    try {
      supabase = getSupabaseBrowserClient();
    } catch (error) {
      console.warn("Supabase realtime disabled:", error);
      return;
    }
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `userId=eq.${userId}`,
        },
        () => {
          onChange();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, onChange, userId]);
}
