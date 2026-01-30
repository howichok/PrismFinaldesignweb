import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { TicketStatus } from "@prisma/client";

import { requireModOrAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

type CursorPayload = {
  updatedAt: string;
  id: string;
};

const statusValues = new Set(["OPEN", "ANSWERED", "CLOSED"]);

function encodeCursor(cursor: CursorPayload) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64");
}

function decodeCursor(value: string | null): CursorPayload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64").toString("utf8"),
    ) as CursorPayload;
    if (!parsed?.updatedAt || !parsed?.id) return null;
    return parsed;
  } catch (error) {
    console.error("Failed to decode ticket cursor", error);
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
  const limit = parseLimit(searchParams.get("limit"));
  const cursor = decodeCursor(searchParams.get("cursor"));
  const statusParam = searchParams.get("status")?.toUpperCase() ?? "";
  const searchParam = searchParams.get("search")?.trim() ?? "";

  const status = statusValues.has(statusParam)
    ? (statusParam as TicketStatus)
    : undefined;

  const where: Prisma.TicketWhereInput = {
    ...(status ? { status } : {}),
    ...(searchParam.length >= 2
      ? { subject: { contains: searchParam, mode: Prisma.QueryMode.insensitive } }
      : {}),
    ...(cursor
      ? {
        OR: [
          { updatedAt: { lt: new Date(cursor.updatedAt) } },
          {
            updatedAt: new Date(cursor.updatedAt),
            id: { lt: cursor.id },
          },
        ],
      }
      : {}),
  };

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      subject: true,
      category: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: {
          displayName: true,
        },
      },
    },
  });

  const hasMore = tickets.length > limit;
  const sliced = hasMore ? tickets.slice(0, limit) : tickets;
  const lastItem = sliced[sliced.length - 1];

  return NextResponse.json({
    items: sliced.map((ticket: typeof sliced[0]) => ({
      id: ticket.id,
      subject: ticket.subject,
      category: ticket.category,
      status: ticket.status,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      createdBy: ticket.createdBy.displayName,
    })),
    nextCursor:
      hasMore && lastItem
        ? encodeCursor({
          updatedAt: lastItem.updatedAt.toISOString(),
          id: lastItem.id,
        })
        : null,
  });
}
