import { NextResponse } from "next/server";
import {
  ContentStatus,
  OwnerType,
  UpdateImportance,
  UpdateStatus,
} from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { isCompanyEditor } from "@/lib/company/roles";
import { checkMajorUpdateLimit, majorLimitMessage } from "@/lib/projects/updates";
import { apiError } from "@/lib/api/errors";
import { parseBody } from "@/lib/validation/request";
import { companyUpdateEditSchema } from "@/lib/validation/schemas";

async function getCompanyProject(companyId: string, projectId: string) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      ownerType: OwnerType.COMPANY,
      ownerCompanyId: companyId,
    },
    select: {
      id: true,
      moderationStatus: true,
    },
  });
}

export async function GET(
  request: Request,
  context: { params: { companyId: string; projectId: string; updateId: string } },
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

  const project = await getCompanyProject(params.companyId, params.projectId);
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

  const update = await prisma.projectUpdate.findFirst({
    where: {
      id: params.updateId,
      projectId: project.id,
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
      createdByUserId: true,
    },
  });

  if (!update) {
    return apiError(404, "NOT_FOUND", "Update not found.");
  }

  return NextResponse.json({ item: update });
}

export async function PATCH(
  request: Request,
  context: { params: { companyId: string; projectId: string; updateId: string } },
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

  const project = await getCompanyProject(params.companyId, params.projectId);
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

  const existing = await prisma.projectUpdate.findFirst({
    where: {
      id: params.updateId,
      projectId: project.id,
    },
    select: {
      id: true,
      status: true,
      title: true,
      summary: true,
      details: true,
      updateType: true,
      importance: true,
      createdByUserId: true,
    },
  });

  if (!existing) {
    return apiError(404, "NOT_FOUND", "Update not found.");
  }

  const isReviewer = isCompanyEditor(membership.companyRole);
  const isAuthor = existing.createdByUserId === session.userId;

  if (!isReviewer) {
    const canEditPending =
      isAuthor && existing.status === UpdateStatus.PENDING;
    const canEditRejected =
      isAuthor && existing.status === UpdateStatus.REJECTED;

    if (!canEditPending && !canEditRejected) {
      return apiError(
        403,
        "FORBIDDEN",
        "Insufficient permissions to edit this update.",
      );
    }
  }

  const { data, error } = await parseBody(request, companyUpdateEditSchema);
  if (error) return error;

  if (existing.status === UpdateStatus.PUBLISHED && !isReviewer) {
    return apiError(
      403,
      "FORBIDDEN",
      "Only reviewers can edit published updates.",
    );
  }

  if (
    existing.status === UpdateStatus.PUBLISHED &&
    data.importance === UpdateImportance.MAJOR &&
    existing.importance !== UpdateImportance.MAJOR
  ) {
    const limit = await checkMajorUpdateLimit({
      projectId: project.id,
      excludeUpdateId: existing.id,
    });
    if (!limit.allowed) {
      return apiError(409, "LIMIT_REACHED", majorLimitMessage);
    }
  }

  const shouldResubmit =
    data.intent === "resubmit" && existing.status === UpdateStatus.REJECTED;

  const update = await prisma.projectUpdate.update({
    where: { id: existing.id },
    data: {
      title: data.title,
      summary: data.summary,
      details: data.details && data.details.length > 0 ? data.details : null,
      updateType: data.updateType,
      importance: data.importance,
      ...(shouldResubmit
        ? {
            status: UpdateStatus.PENDING,
            rejectionReason: null,
            reviewedByUserId: null,
            reviewedAt: null,
          }
        : {}),
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
      createdByUserId: true,
    },
  });

  return NextResponse.json({ item: update });
}
