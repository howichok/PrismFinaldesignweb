import { NextRequest, NextResponse } from "next/server";

import { requireModOrAdmin } from "@/lib/auth/api";
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
    console.error("Failed to decode audit cursor", error);
    return null;
  }
}

function parseLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(50, Math.floor(parsed));
}

export async function GET(request: NextRequest) {
  const auth = await requireModOrAdmin();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const actorId = searchParams.get("actorId")?.trim();
  const actionType = searchParams.get("actionType")?.trim();
  const targetType = searchParams.get("targetType")?.trim();
  const limit = parseLimit(searchParams.get("limit"));
  const cursor = decodeCursor(searchParams.get("cursor"));

  const where = {
    ...(actorId ? { actorUserId: actorId } : {}),
    ...(actionType ? { actionType } : {}),
    ...(targetType ? { targetType } : {}),
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

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      createdAt: true,
      actionType: true,
      targetType: true,
      targetId: true,
      meta: true,
      actor: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  const hasMore = logs.length > limit;
  const sliced = hasMore ? logs.slice(0, limit) : logs;
  const lastItem = sliced[sliced.length - 1];

  return NextResponse.json({
    items: sliced.map((log: typeof logs[0]) => ({
      id: log.id,
      createdAt: log.createdAt.toISOString(),
      actionType: log.actionType,
      targetType: log.targetType,
      targetId: log.targetId,
      meta: log.meta,
      actor: log.actor,
    })),
    nextCursor:
      hasMore && lastItem
        ? encodeCursor({
            createdAt: lastItem.createdAt.toISOString(),
            id: lastItem.id,
          })
        : null,
  });
}
