import { NextRequest, NextResponse } from "next/server";
import { UpdateStatus } from "@prisma/client";

import { requireModOrAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

function parseStatus(value: string | null) {
  const status = value?.toUpperCase();
  return status && ["PUBLISHED", "PENDING", "REJECTED"].includes(status)
    ? (status as UpdateStatus)
    : undefined;
}

function parseHidden(value: string | null) {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export async function GET(request: NextRequest) {
  const auth = await requireModOrAdmin();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();
  const status = parseStatus(searchParams.get("status"));
  const isHidden = parseHidden(searchParams.get("hidden"));

  const updates = await prisma.projectUpdate.findMany({
    where: {
      ...(query
        ? {
            title: {
              contains: query,
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(status ? { status } : {}),
      ...(isHidden !== undefined ? { isHidden } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      publishedAt: true,
      isHidden: true,
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return NextResponse.json({
    items: updates.map((update) => ({
      id: update.id,
      title: update.title,
      status: update.status,
      isHidden: update.isHidden,
      project: update.project,
      createdAt: update.createdAt.toISOString(),
      publishedAt: update.publishedAt?.toISOString() ?? null,
    })),
  });
}
