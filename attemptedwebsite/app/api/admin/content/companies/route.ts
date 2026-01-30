import { NextRequest, NextResponse } from "next/server";
import { ContentStatus } from "@prisma/client";

import { requireModOrAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

function parseStatus(value: string | null) {
  const status = value?.toUpperCase();
  return status && ["DRAFT", "PENDING", "APPROVED", "REJECTED"].includes(status)
    ? (status as ContentStatus)
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

  const companies = await prisma.company.findMany({
    where: {
      ...(query
        ? {
            name: {
              contains: query,
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(status ? { visibilityStatus: status } : {}),
      ...(isHidden !== undefined ? { isHidden } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      visibilityStatus: true,
      updatedAt: true,
      publishedAt: true,
      isHidden: true,
      owner: {
        select: { displayName: true },
      },
    },
  });

  return NextResponse.json({
    items: companies.map((company: typeof companies[0]) => ({
      id: company.id,
      name: company.name,
      status: company.visibilityStatus,
      isHidden: company.isHidden,
      ownerDisplay: company.owner.displayName,
      updatedAt: company.updatedAt.toISOString(),
      publishedAt: company.publishedAt?.toISOString() ?? null,
    })),
  });
}
