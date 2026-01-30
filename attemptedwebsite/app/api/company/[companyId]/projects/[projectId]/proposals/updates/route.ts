import { NextResponse } from "next/server";
import {
  CompanyRole,
  ContentStatus,
  NotificationType,
  UpdateStatus,
} from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { apiError, rateLimitError } from "@/lib/api/errors";
import {
  buildRateLimitKey,
  rateLimit,
} from "@/lib/security/rateLimit";
import { parseBody } from "@/lib/validation/request";
import { updateCreateSchema } from "@/lib/validation/schemas";

export async function POST(
  request: Request,
  context: { params: { companyId: string; projectId: string } },
) {
  const params = context.params;
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1. Check membership and role
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
                name: true
            }
        }
    },
  });

  if (!membership || membership.companyRole !== CompanyRole.MEMBER) {
    return apiError(
      403,
      "FORBIDDEN",
      "Only members can create proposals.",
    );
  }

  // 2. Check if project belongs to company
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: { ownerCompanyId: true, name: true, moderationStatus: true },
  });

  if (!project || project.ownerCompanyId !== params.companyId) {
    return apiError(
      404,
      "NOT_FOUND",
      "Project not found or doesn't belong to this company.",
    );
  }

  if (project.moderationStatus !== ContentStatus.APPROVED) {
    return apiError(
      403,
      "FORBIDDEN",
      "Publish the project before submitting updates.",
    );
  }

  const rate = await rateLimit({
    key: buildRateLimitKey([
      "proposal",
      "update",
      params.companyId,
      session.userId,
    ]),
    limit: 20,
    windowSeconds: 3600,
  });
  if (!rate.allowed) {
    return rateLimitError(rate.retryAfter);
  }

  const { data, error } = await parseBody(request, updateCreateSchema);
  if (error) return error;

  // 4. Create ProjectUpdate with PENDING status
  const projectUpdate = await prisma.projectUpdate.create({
      data: {
          projectId: params.projectId,
          title: data.title,
          summary: data.summary,
          details: data.details || null,
          updateType: data.updateType,
          importance: data.importance,
          status: UpdateStatus.PENDING,
          createdByUserId: session.userId,
      },
      select: {
          id: true,
          title: true,
      }
  });

  // 5. Notify reviewers
  const reviewers = await prisma.companyMembership.findMany({
    where: {
        companyId: params.companyId,
        companyRole: {
            in: [CompanyRole.OWNER, CompanyRole.CO_OWNER, CompanyRole.TRUSTED],
        },
    },
    select: {
        userId: true,
    }
  });

  const notificationTitle = `New update proposal for ${project.name}`;
  const notificationLink = `/company/${params.companyId}/hub/proposals/updates/${projectUpdate.id}`;

  if (reviewers.length > 0) {
    await prisma.notification.createMany({
      data: reviewers.map((reviewer) => ({
        userId: reviewer.userId,
        type: NotificationType.SYSTEM,
        title: notificationTitle,
        body: `A new update proposal "${projectUpdate.title}" has been submitted for review.`,
        link: notificationLink,
      })),
    });
  }


  return NextResponse.json({ item: projectUpdate }, { status: 201 });
}
