import { NextResponse } from "next/server";
import {
  ContentStatus,
  ModerationRequestStatus,
  ModerationTargetType,
} from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { isModOrAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { apiError } from "@/lib/api/errors";
import { parseBody } from "@/lib/validation/request";
import { companyUpdateSchema } from "@/lib/validation/schemas";

function normalizeCategories(value?: string[]) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => item.trim()).filter(Boolean);
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

  const company = await prisma.company.findFirst({
    where: {
      id: params.companyId,
      createdByUserId: session.userId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      logoUrl: true,
      logoAsset: {
        select: {
          id: true,
          publicUrl: true,
        },
      },
      categories: true,
      visibilityStatus: true,
      rejectionReason: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  if (!company) {
    return apiError(404, "NOT_FOUND", "Company not found.");
  }

  return NextResponse.json({ item: company });
}

export async function PATCH(
  request: Request,
  context: { params: any },
) {
  const params = context.params;
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await parseBody(request, companyUpdateSchema);
  if (error) return error;

  const existing = await prisma.company.findFirst({
    where: {
      id: params.companyId,
      createdByUserId: session.userId,
    },
    select: {
      id: true,
      visibilityStatus: true,
      publishedAt: true,
      rejectionReason: true,
    },
  });

  if (!existing) {
    return apiError(404, "NOT_FOUND", "Company not found.");
  }

  const privileged = isModOrAdmin(session.siteRole);
  if (existing.visibilityStatus === ContentStatus.APPROVED && !privileged) {
    return apiError(
      403,
      "FORBIDDEN",
      "Approved content cannot be edited.",
    );
  }

  const intent = data.intent ?? "save";
  let nextStatus = existing.visibilityStatus;
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

  const company = await prisma.company.update({
    where: { id: existing.id },
    data: {
      name: data.name,
      description: data.description,
      logoUrl: data.logoUrl?.trim() || null,
      categories: normalizeCategories(data.categories),
      visibilityStatus: nextStatus,
      publishedAt,
      rejectionReason,
    },
    select: {
      id: true,
      name: true,
      logoAsset: {
        select: {
          id: true,
          publicUrl: true,
        },
      },
      visibilityStatus: true,
      rejectionReason: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  if (!privileged && intent === "submit") {
    await ensureModerationRequest({
      targetType: ModerationTargetType.COMPANY,
      targetId: company.id,
      submittedByUserId: session.userId,
    });
  }

  return NextResponse.json({ item: company });
}
