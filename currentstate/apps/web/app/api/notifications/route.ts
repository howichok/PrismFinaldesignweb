import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

type CursorPayload = {
  createdAt: string;
  id: string;
};

function encodeCursor(cursor: CursorPayload) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64");
}

function decodeCursor(value: string | null): CursorPayload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64").toString("utf8"),
    ) as CursorPayload;
    if (!parsed?.createdAt || !parsed?.id) return null;
    return parsed;
  } catch (error) {
    console.error("Failed to decode notification cursor", error);
    return null;
  }
}

function parseLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(50, Math.floor(parsed));
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams.get("limit"));
  const cursor = decodeCursor(searchParams.get("cursor"));
  const unreadOnly = searchParams.get("unread") === "1";

  const where = {
    userId: auth.session!.userId,
    ...(unreadOnly ? { isRead: false } : {}),
    ...(cursor
      ? {
          OR: [
            { createdAt: { lt: new Date(cursor.createdAt) } },
            {
              createdAt: new Date(cursor.createdAt),
              id: { lt: cursor.id },
            },
          ],
        }
      : {}),
  };

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      link: true,
      isRead: true,
      createdAt: true,
    },
  });

  const hasMore = notifications.length > limit;
  const sliced = hasMore ? notifications.slice(0, limit) : notifications;
  const lastItem = sliced[sliced.length - 1];

  const items = sliced.map((item: typeof sliced[0]) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    body: item.body,
    link: item.link,
    isRead: item.isRead,
    createdAt: item.createdAt.toISOString(),
  }));

  return NextResponse.json({
    items,
    nextCursor:
      hasMore && lastItem
        ? encodeCursor({
            createdAt: lastItem.createdAt.toISOString(),
            id: lastItem.id,
          })
        : null,
  });
}
