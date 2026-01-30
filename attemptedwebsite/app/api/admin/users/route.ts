import { NextRequest, NextResponse } from "next/server";
import { SiteRole, UserStatus } from "@prisma/client";

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
    console.error("Failed to decode user cursor", error);
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
  const query = searchParams.get("query")?.trim();
  const roleParam = searchParams.get("role")?.toUpperCase();
  const statusParam = searchParams.get("status")?.toUpperCase();
  const limit = parseLimit(searchParams.get("limit"));
  const cursor = decodeCursor(searchParams.get("cursor"));

  const role =
    roleParam && ["USER", "MOD", "ADMIN"].includes(roleParam)
      ? (roleParam as SiteRole)
      : undefined;
  const status =
    statusParam && ["ACTIVE", "SUSPENDED", "BANNED"].includes(statusParam)
      ? (statusParam as UserStatus)
      : undefined;

  const where = {
    ...(query
      ? {
          OR: [
            {
              displayName: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              discordId: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
    ...(role ? { siteRole: role } : {}),
    ...(status ? { status } : {}),
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

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      displayName: true,
      discordId: true,
      avatarUrl: true,
      siteRole: true,
      status: true,
      createdAt: true,
    },
  });

  const hasMore = users.length > limit;
  const sliced = hasMore ? users.slice(0, limit) : users;
  const lastItem = sliced[sliced.length - 1];

  return NextResponse.json({
    items: sliced.map((user) => ({
      id: user.id,
      displayName: user.displayName,
      discordId: user.discordId,
      avatarUrl: user.avatarUrl,
      siteRole: user.siteRole,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
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
