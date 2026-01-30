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
import { projectUpdateSchema } from "@/lib/validation/schemas";

function parseTags(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
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

export async function GET(
  request: Request,
  context: { params: any },
) {
  const params = context.params;
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await prisma.project.findFirst({
    where: {
      id: params.projectId,
      ownerType: OwnerType.USER,
      ownerUserId: session.userId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      tags: true,
      projectStatus: true,
      coverAsset: {
        select: {
          id: true,
          publicUrl: true,
        },
      },
      moderationStatus: true,
      rejectionReason: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  if (!project) {
    return apiError(404, "NOT_FOUND", "Project not found.");
  }

  return NextResponse.json({ item: project });
}

export async function PATCH(
  request: Request,
  context: { params: any },
) {
  const params = context.params;
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await parseBody(request, projectUpdateSchema);
  if (error) return error;

  const existing = await prisma.project.findFirst({
    where: {
      id: params.projectId,
      ownerType: OwnerType.USER,
      ownerUserId: session.userId,
    },
    select: {
      id: true,
      moderationStatus: true,
      publishedAt: true,
      rejectionReason: true,
    },
  });

  if (!existing) {
    return apiError(404, "NOT_FOUND", "Project not found.");
  }

  const privileged = isModOrAdmin(session.siteRole);
  if (existing.moderationStatus === ContentStatus.APPROVED && !privileged) {
    return apiError(
      403,
      "FORBIDDEN",
      "Approved content cannot be edited.",
    );
  }

  const intent = data.intent ?? "save";
  let nextStatus = existing.moderationStatus;
  let publishedAt = existing.publishedAt;
  let rejectionReason = existing.rejectionReason;

  if (intent === "draft") {
    nextStatus = ContentStatus.DRAFT;
    publishedAt = null;
    rejectionReason = null;
  } else if (intent === "submit") {
    nextStatus = privileged ? ContentStatus.APPROVED : ContentStatus.PENDING;
    publishedAt = privileged ? publishedAt ?? new Date() : null;
    rejectionReason = null;
  } else if (intent === "publish") {
    if (!privileged) {
      return apiError(403, "FORBIDDEN", "Insufficient permissions.");
    }
    nextStatus = ContentStatus.APPROVED;
    publishedAt = publishedAt ?? new Date();
    rejectionReason = null;
  }

  const project = await prisma.project.update({
    where: { id: existing.id },
    data: {
      name: data.name,
      description: data.description,
      tags: parseTags(data.tags),
      projectStatus: data.projectStatus ?? ProjectStatus.IN_PROGRESS,
      moderationStatus: nextStatus,
      publishedAt,
      rejectionReason,
    },
    select: {
      id: true,
      name: true,
      moderationStatus: true,
      projectStatus: true,
      coverAsset: {
        select: {
          id: true,
          publicUrl: true,
        },
      },
      rejectionReason: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  if (!privileged && intent === "submit") {
    await ensureModerationRequest({
      targetType: ModerationTargetType.PROJECT,
      targetId: project.id,
      submittedByUserId: session.userId,
    });
  }

  return NextResponse.json({ item: project });
}
