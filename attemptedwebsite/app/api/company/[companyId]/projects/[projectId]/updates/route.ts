import { NextResponse } from "next/server";
import {
  CompanyRole,
  ContentStatus,
  NotificationType,
  OwnerType,
  ProjectUpdateType,
  UpdateImportance,
  UpdateStatus,
} from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { isCompanyEditor } from "@/lib/company/roles";
import { checkMajorUpdateLimit, majorLimitMessage } from "@/lib/projects/updates";
import { apiError } from "@/lib/api/errors";
import { parseBody } from "@/lib/validation/request";
import { updateCreateSchema } from "@/lib/validation/schemas";

function normalizeStatus(value?: string | null) {
  const normalized = value?.toUpperCase();
  const allowed = new Set(["PUBLISHED", "PENDING", "REJECTED"]);
  if (!normalized || normalized === "ALL" || !allowed.has(normalized)) {
    return undefined;
  }
  return normalized as UpdateStatus;
}

export async function GET(
  request: Request,
  context: { params: { companyId: string; projectId: string } },
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
    return apiError(403, "FORBIDDEN", "Access denied.");
  }

  const project = await prisma.project.findFirst({
    where: {
      id: params.projectId,
      ownerType: OwnerType.COMPANY,
      ownerCompanyId: params.companyId,
    },
    select: {
      id: true,
      moderationStatus: true,
    },
  });

  if (!project) {
    return apiError(404, "NOT_FOUND", "Project not found.");
  }

  if (project.moderationStatus !== ContentStatus.APPROVED) {
    return apiError(
      403,
      "FORBIDDEN",
      "Updates are available after the project is published.",
    );
  }

  const { searchParams } = new URL(request.url);
  const status = normalizeStatus(searchParams.get("status"));

  const updates = await prisma.projectUpdate.findMany({
    where: {
      projectId: project.id,
      ...(status ? { status } : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      title: true,
      summary: true,
      details: true,
      updateType: true,
      importance: true,
      status: true,
      rejectionReason: true,
      createdAt: true,
      publishedAt: true,
      createdBy: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  return NextResponse.json({ items: updates });
}

export async function POST(
  request: Request,
  context: { params: { companyId: string; projectId: string } },
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
      company: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!membership) {
    return apiError(403, "FORBIDDEN", "Access denied.");
  }

  const project = await prisma.project.findFirst({
    where: {
      id: params.projectId,
      ownerType: OwnerType.COMPANY,
      ownerCompanyId: params.companyId,
    },
    select: {
      id: true,
      name: true,
      moderationStatus: true,
    },
  });

  if (!project) {
    return apiError(404, "NOT_FOUND", "Project not found.");
  }

  if (project.moderationStatus !== ContentStatus.APPROVED) {
    return apiError(
      403,
      "FORBIDDEN",
      "Publish the project before posting updates.",
    );
  }

  const { data, error } = await parseBody(request, updateCreateSchema);
  if (error) return error;

  const canPublish = isCompanyEditor(membership.companyRole);

  if (canPublish && data.importance === UpdateImportance.MAJOR) {
    const limit = await checkMajorUpdateLimit({ projectId: project.id });
    if (!limit.allowed) {
      return apiError(409, "LIMIT_REACHED", majorLimitMessage);
    }
  }

  const status = canPublish ? UpdateStatus.PUBLISHED : UpdateStatus.PENDING;
  const publishedAt = canPublish ? new Date() : null;

  const update = await prisma.projectUpdate.create({
    data: {
      projectId: project.id,
      title: data.title,
      summary: data.summary,
      details: data.details || null,
      updateType: data.updateType,
      importance: data.importance,
      status,
      createdByUserId: session.userId,
      publishedAt,
      rejectionReason: null,
      reviewedByUserId: null,
      reviewedAt: null,
    },
    select: {
      id: true,
      title: true,
      summary: true,
      details: true,
      updateType: true,
      importance: true,
      status: true,
      rejectionReason: true,
      createdAt: true,
      publishedAt: true,
      createdBy: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!canPublish) {
    const reviewers = await prisma.companyMembership.findMany({
      where: {
        companyId: params.companyId,
        companyRole: {
          in: [CompanyRole.OWNER, CompanyRole.CO_OWNER, CompanyRole.TRUSTED],
        },
      },
      select: {
        userId: true,
      },
    });

    if (reviewers.length > 0) {
      await prisma.notification.createMany({
        data: reviewers.map((reviewer) => ({
          userId: reviewer.userId,
          type: NotificationType.SYSTEM,
          title: `New update proposal for ${project.name}`,
          body: `A new update proposal "${update.title}" has been submitted for review.`,
          link: `/company/${params.companyId}/hub/proposals/updates/${update.id}`,
        })),
      });
    }
  }

  return NextResponse.json({ item: update }, { status: 201 });
}
