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
    moderationStatus: ContentStatus.APPROVED,
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

  const projects = await prisma.project.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      name: true,
      description: true,
      projectStatus: true,
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

  const hasMore = projects.length > limit;
  const sliced = hasMore ? projects.slice(0, limit) : projects;
  const lastItem = sliced[sliced.length - 1];

  const items = sliced.map((project) => ({
    type: "project" as const,
    id: project.id,
    name: project.name,
    excerpt: createExcerpt(project.description),
    projectStatus: project.projectStatus,
    ownerDisplay:
      project.ownerType === "COMPANY"
        ? project.ownerCompany?.name ?? "Company"
        : project.ownerUser?.displayName ?? "User",
    updatedAt: project.updatedAt.toISOString(),
    publishedAt: project.publishedAt?.toISOString() ?? null,
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
