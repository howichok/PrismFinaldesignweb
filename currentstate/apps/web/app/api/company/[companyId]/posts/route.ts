import { NextResponse } from "next/server";
import { ContentStatus, OwnerType } from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { isCompanyEditor } from "@/lib/company/roles";
import { apiError } from "@/lib/api/errors";
import { parseBody } from "@/lib/validation/request";
import { postCreateSchema } from "@/lib/validation/schemas";

function parseTags(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function GET(
  request: Request,
  context: { params: any },
) {
  const params = context.params;
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await prisma.companyMembership.findUnique({
    where: {
      companyId_userId: {
        companyId: params.companyId,
        userId: session.userId,
      },
    },
    select: {
      companyRole: true,
    },
  });

  if (!membership) {
    return apiError(403, "FORBIDDEN", "Forbidden");
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status")?.toUpperCase();
  const allowedStatuses = new Set([
    "DRAFT",
    "PENDING",
    "APPROVED",
    "REJECTED",
  ]);
  const status =
    statusParam && statusParam !== "ALL" && allowedStatuses.has(statusParam)
      ? (statusParam as ContentStatus)
      : undefined;

  const posts = await prisma.post.findMany({
    where: {
      ownerType: OwnerType.COMPANY,
      ownerCompanyId: params.companyId,
      ...(status ? { status } : {}),
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  return NextResponse.json({ items: posts });
}

export async function POST(
  request: Request,
  context: { params: any },
) {
  const params = context.params;
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await prisma.companyMembership.findUnique({
    where: {
      companyId_userId: {
        companyId: params.companyId,
        userId: session.userId,
      },
    },
    select: {
      companyRole: true,
    },
  });

  if (!membership || !isCompanyEditor(membership.companyRole)) {
    return apiError(403, "FORBIDDEN", "Insufficient permissions.");
  }

  const { data, error } = await parseBody(request, postCreateSchema);
  if (error) return error;

  const shouldPublish = data.intent === "publish";
  const status = shouldPublish ? ContentStatus.APPROVED : ContentStatus.DRAFT;
  const publishedAt = shouldPublish ? new Date() : null;

  const post = await prisma.post.create({
    data: {
      title: data.title,
      content: data.content,
      tags: parseTags(data.tags),
      ownerType: OwnerType.COMPANY,
      ownerCompanyId: params.companyId,
      createdByUserId: session.userId,
      status,
      rejectionReason: null,
      publishedAt,
    },
    select: {
      id: true,
      title: true,
      content: true,
      tags: true,
      status: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  return NextResponse.json({ item: post });
}
