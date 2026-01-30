import { NextRequest, NextResponse } from "next/server";
import { ContentStatus, OwnerType } from "@prisma/client";

import { requireModOrAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

function parseStatus(value: string | null) {
  const status = value?.toUpperCase();
  return status && ["DRAFT", "PENDING", "APPROVED", "REJECTED"].includes(status)
    ? (status as ContentStatus)
    : undefined;
}

function parseOwnerType(value: string | null) {
  const ownerType = value?.toUpperCase();
  return ownerType && ["USER", "COMPANY"].includes(ownerType)
    ? (ownerType as OwnerType)
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
  const ownerType = parseOwnerType(searchParams.get("ownerType"));
  const isHidden = parseHidden(searchParams.get("hidden"));

  const projects = await prisma.project.findMany({
    where: {
      ...(query
        ? {
            name: {
              contains: query,
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(status ? { moderationStatus: status } : {}),
      ...(ownerType ? { ownerType } : {}),
      ...(isHidden !== undefined ? { isHidden } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      moderationStatus: true,
      updatedAt: true,
      publishedAt: true,
      ownerType: true,
      isHidden: true,
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
    },
  });

  return NextResponse.json({
    items: projects.map((project) => ({
      id: project.id,
      name: project.name,
      status: project.moderationStatus,
      isHidden: project.isHidden,
      ownerDisplay:
        project.ownerType === OwnerType.COMPANY
          ? project.ownerCompany?.name ?? "Company"
          : project.ownerUser?.displayName ?? "User",
      updatedAt: project.updatedAt.toISOString(),
      publishedAt: project.publishedAt?.toISOString() ?? null,
    })),
  });
}
