import { NextResponse } from "next/server";
import {
  ContentStatus,
  OwnerType,
  ProjectStatus,
} from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { isCompanyEditor } from "@/lib/company/roles";
import { apiError } from "@/lib/api/errors";
import { parseBody } from "@/lib/validation/request";
import { projectCreateSchema } from "@/lib/validation/schemas";

function parseTags(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function GET(
  request: Request,
  context: { params: { companyId: string } },
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
  const moderationStatus =
    statusParam && statusParam !== "ALL" && allowedStatuses.has(statusParam)
      ? (statusParam as ContentStatus)
      : undefined;

  const projects = await prisma.project.findMany({
    where: {
      ownerType: OwnerType.COMPANY,
      ownerCompanyId: params.companyId,
      ...(moderationStatus ? { moderationStatus } : {}),
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      name: true,
      projectStatus: true,
      moderationStatus: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  return NextResponse.json({ items: projects });
}

export async function POST(
  request: Request,
  context: { params: { companyId: string } },
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

  const { data, error } = await parseBody(request, projectCreateSchema);
  if (error) return error;

  const shouldPublish = data.intent === "publish";
  const moderationStatus = shouldPublish
    ? ContentStatus.APPROVED
    : ContentStatus.DRAFT;
  const publishedAt = shouldPublish ? new Date() : null;

  const project = await prisma.project.create({
    data: {
      name: data.name,
      description: data.description,
      tags: parseTags(data.tags),
      projectStatus: data.projectStatus as ProjectStatus,
      ownerType: OwnerType.COMPANY,
      ownerCompanyId: params.companyId,
      createdByUserId: session.userId,
      moderationStatus,
      rejectionReason: null,
      publishedAt,
    },
    select: {
      id: true,
      name: true,
      description: true,
      tags: true,
      projectStatus: true,
      moderationStatus: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  return NextResponse.json({ item: project });
}
