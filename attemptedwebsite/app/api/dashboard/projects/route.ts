import { NextResponse } from "next/server";
import {
  ContentStatus,
  ModerationRequestStatus,
  ModerationTargetType,
  OwnerType,
  ProjectStatus,
} from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { isModOrAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
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

function resolveStatus(intent: string | undefined, privileged: boolean) {
  if (intent === "publish") {
    return privileged ? ContentStatus.APPROVED : ContentStatus.DRAFT;
  }
  if (intent === "submit") {
    return privileged ? ContentStatus.APPROVED : ContentStatus.PENDING;
  }
  return ContentStatus.DRAFT;
}

async function ensureModerationRequest(params: {
  targetType: ModerationTargetType;
  targetId: string;
  submittedByUserId: string;
}) {
  const existing = await prisma.moderationRequest.findFirst({
    where: {
      targetType: params.targetType,
      targetId: params.targetId,
      status: ModerationRequestStatus.PENDING,
    },
  });

  if (!existing) {
    await prisma.moderationRequest.create({
      data: {
        targetType: params.targetType,
        targetId: params.targetId,
        submittedByUserId: params.submittedByUserId,
        status: ModerationRequestStatus.PENDING,
      },
    });
  }
}

export async function GET(request: Request) {
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const projects = await prisma.project.findMany({
    where: {
      ownerType: OwnerType.USER,
      ownerUserId: session.userId,
      ...(status ? { moderationStatus: status } : {}),
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      name: true,
      moderationStatus: true,
      projectStatus: true,
      rejectionReason: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  return NextResponse.json({ items: projects });
}

export async function POST(request: Request) {
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await parseBody(request, projectCreateSchema);
  if (error) return error;

  const privileged = isModOrAdmin(session.siteRole);
  if (data.intent === "publish" && !privileged) {
    return apiError(403, "FORBIDDEN", "Insufficient permissions.");
  }
  const moderationStatus = resolveStatus(data.intent, privileged);
  const publishedAt =
    moderationStatus === ContentStatus.APPROVED ? new Date() : null;

  const project = await prisma.project.create({
    data: {
      name: data.name,
      description: data.description,
      tags: parseTags(data.tags),
      projectStatus: data.projectStatus ?? ProjectStatus.IN_PROGRESS,
      ownerType: OwnerType.USER,
      ownerUserId: session.userId,
      createdByUserId: session.userId,
      moderationStatus,
      rejectionReason: null,
      publishedAt,
    },
    select: {
      id: true,
      name: true,
      moderationStatus: true,
      projectStatus: true,
      rejectionReason: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  if (!privileged && moderationStatus === ContentStatus.PENDING) {
    await ensureModerationRequest({
      targetType: ModerationTargetType.PROJECT,
      targetId: project.id,
      submittedByUserId: session.userId,
    });
  }

  return NextResponse.json({ item: project });
}
