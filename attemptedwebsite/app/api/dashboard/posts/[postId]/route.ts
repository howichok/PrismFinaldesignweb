import { NextResponse } from "next/server";
import {
  ContentStatus,
  ModerationRequestStatus,
  ModerationTargetType,
  OwnerType,
} from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { isModOrAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { apiError } from "@/lib/api/errors";
import { parseBody } from "@/lib/validation/request";
import { postUpdateSchema } from "@/lib/validation/schemas";

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
  context: { params: { postId: string } },
) {
  const params = context.params;
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const post = await prisma.post.findFirst({
    where: {
      id: params.postId,
      ownerType: OwnerType.USER,
      ownerUserId: session.userId,
    },
    select: {
      id: true,
      title: true,
      content: true,
      tags: true,
      coverAsset: {
        select: {
          id: true,
          publicUrl: true,
        },
      },
      status: true,
      rejectionReason: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  if (!post) {
    return apiError(404, "NOT_FOUND", "Post not found.");
  }

  return NextResponse.json({ item: post });
}

export async function PATCH(
  request: Request,
  context: { params: { postId: string } },
) {
  const params = context.params;
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await parseBody(request, postUpdateSchema);
  if (error) return error;

  const existing = await prisma.post.findFirst({
    where: {
      id: params.postId,
      ownerType: OwnerType.USER,
      ownerUserId: session.userId,
    },
    select: {
      id: true,
      status: true,
      publishedAt: true,
      rejectionReason: true,
    },
  });

  if (!existing) {
    return apiError(404, "NOT_FOUND", "Post not found.");
  }

  const privileged = isModOrAdmin(session.siteRole);
  if (existing.status === ContentStatus.APPROVED && !privileged) {
    return apiError(
      403,
      "FORBIDDEN",
      "Approved content cannot be edited.",
    );
  }

  const intent = data.intent ?? "save";
  let nextStatus = existing.status;
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

  const post = await prisma.post.update({
    where: { id: existing.id },
    data: {
      title: data.title,
      content: data.content,
      tags: parseTags(data.tags),
      status: nextStatus,
      publishedAt,
      rejectionReason,
    },
    select: {
      id: true,
      title: true,
      coverAsset: {
        select: {
          id: true,
          publicUrl: true,
        },
      },
      status: true,
      rejectionReason: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  if (!privileged && intent === "submit") {
    await ensureModerationRequest({
      targetType: ModerationTargetType.POST,
      targetId: post.id,
      submittedByUserId: session.userId,
    });
  }

  return NextResponse.json({ item: post });
}
