import type { NotificationItem } from "@/lib/notifications/types";
import { csrfFetch } from "@/lib/security/csrf-client";

type NotificationListResponse = {
  items: NotificationItem[];
  nextCursor: string | null;
};

export async function fetchNotifications(params?: {
  cursor?: string | null;
  limit?: number;
  unreadOnly?: boolean;
}) {
  const searchParams = new URLSearchParams();
  if (params?.cursor) {
    searchParams.set("cursor", params.cursor);
  }
  if (params?.limit) {
    searchParams.set("limit", String(params.limit));
  }
  if (params?.unreadOnly) {
    searchParams.set("unread", "1");
  }

  const response = await csrfFetch(
    `/api/notifications?${searchParams.toString()}`,
  );
  if (!response.ok) {
    throw new Error("Failed to load notifications.");
  }
  return (await response.json()) as NotificationListResponse;
}

export async function fetchUnreadCount() {
  const response = await csrfFetch("/api/notifications/unread-count");
  if (!response.ok) {
    throw new Error("Failed to load unread count.");
  }
  const data = (await response.json()) as { unreadCount: number };
  return data.unreadCount;
}

export async function markNotificationsRead(ids: string[]) {
  const response = await csrfFetch("/api/notifications/mark-read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error ?? "Failed to mark notifications read.");
  }
}

export async function markAllNotificationsRead() {
  const response = await csrfFetch("/api/notifications/mark-all-read", {
    method: "POST",
  });
  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error ?? "Failed to mark all notifications read.");
  }
}
