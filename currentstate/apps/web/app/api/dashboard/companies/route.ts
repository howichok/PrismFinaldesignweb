import { NextResponse } from "next/server";
import {
  CompanyRole,
  ContentStatus,
  ModerationRequestStatus,
  ModerationTargetType,
} from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { isModOrAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { apiError } from "@/lib/api/errors";
import { parseBody } from "@/lib/validation/request";
import { companyCreateSchema } from "@/lib/validation/schemas";

function normalizeCategories(value?: string[]) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => item.trim()).filter(Boolean);
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

export async function GET() {
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const createdCompanies = await prisma.company.findMany({
    where: {
      createdByUserId: session.userId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      visibilityStatus: true,
      rejectionReason: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  const memberships = await prisma.companyMembership.findMany({
    where: {
      userId: session.userId,
    },
    select: {
      companyRole: true,
      company: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          visibilityStatus: true,
        },
      },
    },
  });

  const createdIds = new Set(createdCompanies.map((company) => company.id));
  const memberCompanies = memberships
    .filter((membership) => !createdIds.has(membership.company.id))
    .map((membership) => ({
      id: membership.company.id,
      name: membership.company.name,
      logoUrl: membership.company.logoUrl,
      visibilityStatus: membership.company.visibilityStatus,
      companyRole: membership.companyRole,
    }));

  return NextResponse.json({
    created: createdCompanies,
    memberships: memberCompanies,
  });
}

export async function POST(request: Request) {
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await parseBody(request, companyCreateSchema);
  if (error) return error;

  const privileged = isModOrAdmin(session.siteRole);
  if (data.intent === "publish" && !privileged) {
    return apiError(403, "FORBIDDEN", "Insufficient permissions.");
  }
  const visibilityStatus = resolveStatus(data.intent, privileged);
  const publishedAt =
    visibilityStatus === ContentStatus.APPROVED ? new Date() : null;

  const company = await prisma.company.create({
    data: {
      name: data.name,
      description: data.description,
      logoUrl: data.logoUrl?.trim() || null,
      categories: normalizeCategories(data.categories),
      visibilityStatus,
      rejectionReason: null,
      publishedAt,
      createdByUserId: session.userId,
      ownerUserId: session.userId,
      memberships: {
        create: {
          userId: session.userId,
          companyRole: CompanyRole.OWNER,
        },
      },
    },
    select: {
      id: true,
      name: true,
      visibilityStatus: true,
      rejectionReason: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  if (!privileged && visibilityStatus === ContentStatus.PENDING) {
    await ensureModerationRequest({
      targetType: ModerationTargetType.COMPANY,
      targetId: company.id,
      submittedByUserId: session.userId,
    });
  }

  return NextResponse.json({ item: company });
}
