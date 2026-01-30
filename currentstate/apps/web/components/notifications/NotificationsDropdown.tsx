"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import NotificationItem from "@/components/notifications/NotificationItem";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
} from "@/lib/notifications/api";
import type { NotificationItem as NotificationItemType } from "@/lib/notifications/types";

type NotificationsDropdownProps = {
  open: boolean;
  onClose: () => void;
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
};

export default function NotificationsDropdown({
  open,
  onClose,
  unreadCount,
  setUnreadCount,
}: NotificationsDropdownProps) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItemType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastRefreshRef = useRef(0);

  const loadNotifications = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNotifications({ limit: 10 });
      setItems(data.items);
      lastRefreshRef.current = Date.now();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load notifications.",
      );
    } finally {
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open, loadNotifications]);

  useEffect(() => {
    if (!open) return;
    const handleFocus = () => {
      if (document.hidden) return;
      if (Date.now() - lastRefreshRef.current > 3000) {
        loadNotifications();
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [open, loadNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to mark all read.",
      );
    }
  };

  const handleItemClick = async (item: NotificationItemType) => {
    try {
      if (!item.isRead) {
        await markNotificationsRead([item.id]);
        setItems((prev) =>
          prev.map((prevItem) =>
            prevItem.id === item.id
              ? { ...prevItem, isRead: true }
              : prevItem,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } finally {
      onClose();
      router.push(item.link);
    }
  };

  if (!open) return null;

  return (
    <div className="notifications__panel open">
      <div className="notifications__header">
        <div className="notifications__header-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        </div>
        <div className="notifications__header-text">
          <h3>Notifications</h3>
          <div className="notifications__count">{unreadCount} unread</div>
        </div>
        <button
          type="button"
          className="notifications__mark-read"
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Mark all read
        </button>
      </div>

      <div className="notifications__list">
        {error ? (
          <div className="p-4 text-xs text-red-600">
            {error}
            <button className="ml-2 font-bold underline" onClick={loadNotifications}>Retry</button>
          </div>
        ) : null}

        {loading ? (
          <div className="p-4 text-center text-xs text-gray-500">Loading...</div>
        ) : null}

        {!loading && items.length === 0 ? (
          <div className="notifications__empty">
            <div className="notifications__empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            </div>
            <div className="notifications__empty-title">All caught up!</div>
            <div className="notifications__empty-desc">No new notifications at the moment.</div>
          </div>
        ) : null}

        {!loading && items.length > 0 && (
          <div className="flex flex-col">
            {items.map((item) => (
              <NotificationItem
                key={item.id}
                item={item}
                compact
                onClick={handleItemClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
