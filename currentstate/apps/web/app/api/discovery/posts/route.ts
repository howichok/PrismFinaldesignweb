import { NextRequest, NextResponse } from "next/server";
import { ContentStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  createExcerpt,
  decodeCursor,
  encodeCursor,
  getCursorFilter,
  normalizeQuery,
  parseLimit,
} from "@/lib/discovery/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = normalizeQuery(searchParams.get("query"));
  const limit = parseLimit(searchParams.get("limit"));
  const cursor = decodeCursor(searchParams.get("cursor"));
  const cursorFilter = getCursorFilter(cursor);

  const where = {
    status: ContentStatus.APPROVED,
    isHidden: false,
    ...(query
      ? {
          title: {
            contains: query,
            mode: "insensitive" as const,
          },
        }
      : {}),
    ...(cursorFilter ?? {}),
  };

  const posts = await prisma.post.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      title: true,
      content: true,
      ownerType: true,
      ownerUser: {
        select: {
          displayName: true,
        },
      },
      ownerCompany: {
        select: {
          name: true,
        },
      },
      updatedAt: true,
      publishedAt: true,
    },
  });

  const hasMore = posts.length > limit;
  const sliced = hasMore ? posts.slice(0, limit) : posts;
  const lastItem = sliced[sliced.length - 1];

  const items = sliced.map((post) => ({
    type: "post" as const,
    id: post.id,
    title: post.title,
    excerpt: createExcerpt(post.content),
    ownerDisplay:
      post.ownerType === "COMPANY"
        ? post.ownerCompany?.name ?? "Company"
        : post.ownerUser?.displayName ?? "User",
    updatedAt: post.updatedAt.toISOString(),
    publishedAt: post.publishedAt?.toISOString() ?? null,
  }));

  const response = NextResponse.json({
    items,
    nextCursor:
      hasMore && lastItem
        ? encodeCursor({
            updatedAt: lastItem.updatedAt.toISOString(),
            id: lastItem.id,
          })
        : null,
    fetchedAt: new Date().toISOString(),
  });
  response.headers.set(
    "Cache-Control",
    "public, max-age=60, stale-while-revalidate=60",
  );
  return response;
}
