"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import Tabs from "@/components/ui/Tabs";
import { buttonStyles } from "@/components/ui/Button";
import NotificationItem from "@/components/notifications/NotificationItem";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
} from "@/lib/notifications/api";
import type { NotificationItem as NotificationItemType } from "@/lib/notifications/types";

const filters = ["All", "Unread"] as const;
type FilterKey = (typeof filters)[number];

export default function NotificationsPageClient() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("All");
  const [items, setItems] = useState<NotificationItemType[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unreadOnly = filter === "Unread";

  const loadNotifications = useCallback(
    async (cursor: string | null, replace: boolean) => {
      if (replace) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      try {
        const data = await fetchNotifications({
          cursor: cursor ?? undefined,
          limit: 20,
          unreadOnly,
        });
        setItems((prev) => (replace ? data.items : [...prev, ...data.items]));
        setNextCursor(data.nextCursor);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load notifications.",
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [unreadOnly],
  );

  useEffect(() => {
    loadNotifications(null, true);
  }, [loadNotifications]);

  const handleMarkRead = async (item: NotificationItemType) => {
    try {
      await markNotificationsRead([item.id]);
      setItems((prev) =>
        prev.map((prevItem) =>
          prevItem.id === item.id ? { ...prevItem, isRead: true } : prevItem,
        ),
      );
      if (unreadOnly) {
        setItems((prev) => prev.filter((prevItem) => prevItem.id !== item.id));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to mark notification read.",
      );
    }
  };

  const handleItemClick = async (item: NotificationItemType) => {
    if (!item.isRead) {
      await handleMarkRead(item);
    }
    router.push(item.link);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      if (unreadOnly) {
        setItems([]);
      } else {
        setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to mark all read.",
      );
    }
  };

  const emptyState = useMemo(() => {
    if (filter === "Unread") return "No unread notifications.";
    return "No notifications yet.";
  }, [filter]);

  const hasUnread = items.some((item) => !item.isRead);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={[...filters]}
          value={filter}
          onChange={(value) => setFilter(value as FilterKey)}
        />
        <button
          type="button"
          className={buttonStyles({ variant: "outline", size: "sm" })}
          onClick={handleMarkAllRead}
          disabled={!hasUnread}
        >
          Mark all read
        </button>
      </div>

      {error ? (
        <Card className="space-y-2 text-sm text-[color:var(--color-muted)]">
          <p>{error}</p>
          <button
            type="button"
            className={buttonStyles({ variant: "outline", size: "sm" })}
            onClick={() => loadNotifications(null, true)}
          >
            Retry
          </button>
        </Card>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <Card key={item} className="space-y-3">
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-[color:var(--color-line)]" />
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-[color:var(--color-line)]" />
            </Card>
          ))}
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <Card className="text-sm text-[color:var(--color-muted)]">
          {emptyState}
        </Card>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <NotificationItem
            key={item.id}
            item={item}
            compact
            onClick={handleItemClick}
            onMarkRead={item.isRead ? undefined : handleMarkRead}
          />
        ))}
      </div>

      {nextCursor ? (
        <button
          type="button"
          className={buttonStyles({ variant: "outline", size: "sm" })}
          onClick={() => loadNotifications(nextCursor, false)}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading..." : "Load more"}
        </button>
      ) : null}
    </div>
  );
}
