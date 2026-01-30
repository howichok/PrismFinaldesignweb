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

function compareByUpdatedAt(a: { updatedAt: string; id: string }, b: { updatedAt: string; id: string }) {
  const dateDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  if (dateDiff !== 0) return dateDiff;
  return b.id.localeCompare(a.id);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = normalizeQuery(searchParams.get("query"));
  const limit = parseLimit(searchParams.get("limit"));
  const cursor = decodeCursor(searchParams.get("cursor"));
  const cursorFilter = getCursorFilter(cursor);

  const [posts, projects, companies] = await Promise.all([
    prisma.post.findMany({
      where: {
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
      },
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
    }),
    prisma.project.findMany({
      where: {
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
      },
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
    }),
    prisma.company.findMany({
      where: {
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
      },
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
    }),
  ]);

  const combined = [
    ...posts.map((post) => ({
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
    })),
    ...projects.map((project) => ({
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
    })),
    ...companies.map((company) => ({
      type: "company" as const,
      id: company.id,
      name: company.name,
      excerpt: createExcerpt(company.description),
      logoUrl: company.logoUrl,
      categories: company.categories,
      updatedAt: company.updatedAt.toISOString(),
    })),
  ].sort(compareByUpdatedAt);

  const hasMore = combined.length > limit;
  const sliced = hasMore ? combined.slice(0, limit) : combined;
  const lastItem = sliced[sliced.length - 1];

  const response = NextResponse.json({
    items: sliced,
    nextCursor:
      hasMore && lastItem
        ? encodeCursor({
            updatedAt: lastItem.updatedAt,
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
