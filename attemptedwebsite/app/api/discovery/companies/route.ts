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
    visibilityStatus: ContentStatus.APPROVED,
    isHidden: false,
    ...(query
      ? {
          name: {
            contains: query,
            mode: "insensitive" as const,
          },
        }
      : {}),
    ...(cursorFilter ?? {}),
  };

  const companies = await prisma.company.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      name: true,
      description: true,
      logoUrl: true,
      categories: true,
      updatedAt: true,
    },
  });

  const hasMore = companies.length > limit;
  const sliced = hasMore ? companies.slice(0, limit) : companies;
  const lastItem = sliced[sliced.length - 1];

  const items = sliced.map((company) => ({
    type: "company" as const,
    id: company.id,
    name: company.name,
    excerpt: createExcerpt(company.description),
    logoUrl: company.logoUrl,
    categories: company.categories,
    updatedAt: company.updatedAt.toISOString(),
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
