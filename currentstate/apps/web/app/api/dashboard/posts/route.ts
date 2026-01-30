import { NextResponse } from "next/server";
import {
  ContentStatus,
  ModerationRequestStatus,
  ModerationTargetType,
  OwnerType,
} from "@prisma/client";
import { z } from "zod";

import { requireAuth } from "@/lib/auth/api";
import { isModOrAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { apiError } from "@/lib/api/errors";
import { parseBody } from "@/lib/validation/request";
import { postCreateSchema } from "@/lib/validation/schemas";

type PostPayload = z.infer<typeof postCreateSchema>;

function parseTags(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function resolveStatus(
  intent: PostPayload["intent"],
  privileged: boolean,
) {
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

  const posts = await prisma.post.findMany({
    where: {
      ownerType: OwnerType.USER,
      ownerUserId: session.userId,
      ...(status ? { status } : {}),
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      title: true,
      status: true,
      rejectionReason: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  return NextResponse.json({ items: posts });
}

export async function POST(request: Request) {
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await parseBody(request, postCreateSchema);
  if (error) return error;

  const privileged = isModOrAdmin(session.siteRole);
  if (data.intent === "publish" && !privileged) {
    return apiError(403, "FORBIDDEN", "Insufficient permissions.");
  }
  const status = resolveStatus(data.intent, privileged);
  const publishedAt = status === ContentStatus.APPROVED ? new Date() : null;

  const post = await prisma.post.create({
    data: {
      title: data.title,
      content: data.content,
      tags: parseTags(data.tags),
      ownerType: OwnerType.USER,
      ownerUserId: session.userId,
      createdByUserId: session.userId,
      status,
      rejectionReason: null,
      publishedAt,
    },
    select: {
      id: true,
      title: true,
      status: true,
      rejectionReason: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  if (!privileged && status === ContentStatus.PENDING) {
    await ensureModerationRequest({
      targetType: ModerationTargetType.POST,
      targetId: post.id,
      submittedByUserId: session.userId,
    });
  }

  return NextResponse.json({ item: post });
}
