"use client";

import type { ComponentPropsWithoutRef } from "react";
import { useEffect, useRef, useState } from "react";

import NotificationsDropdown from "@/components/notifications/NotificationsDropdown";
import { useUnreadCountPolling } from "@/lib/notifications/polling";
import { useNotificationsRealtime } from "@/lib/notifications/realtime";
import { cn } from "@/lib/cn"; // Kept for BellIcon if needed, but unused in trigger refactor

type NotificationsBellProps = {
  userId?: string | null;
};

export default function NotificationsBell({ userId }: NotificationsBellProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const { unreadCount, setUnreadCount, refreshUnreadCount } =
    useUnreadCountPolling({ enabled: true, intervalMs: 45000 });

  useNotificationsRealtime({
    userId,
    enabled: Boolean(userId),
    onChange: refreshUnreadCount,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (open) {
      refreshUnreadCount();
    }
  }, [open, refreshUnreadCount]);

  return (
    <div className="notifications" ref={wrapperRef}>
      <div
        className="notifications__trigger"
        onClick={() => setOpen((prev) => !prev)}
      >
        <BellIcon />

        {unreadCount > 0 && (
          <span className="notifications__badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>

      <NotificationsDropdown
        open={open}
        onClose={() => setOpen(false)}
        unreadCount={unreadCount}
        setUnreadCount={setUnreadCount}
      />
    </div>
  );
}

type IconProps = ComponentPropsWithoutRef<"svg">;

function BellIcon({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-5 w-5", className)}
      aria-hidden="true"
      {...props}
    >
      <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
      <path d="M9 17a3 3 0 0 0 6 0" />
    </svg>
  );
}
