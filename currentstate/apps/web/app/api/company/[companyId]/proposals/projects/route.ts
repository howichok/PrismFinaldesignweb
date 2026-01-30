import { NextResponse } from "next/server";
import { CompanyRole, ContentStatus, NotificationType, OwnerType, ProjectStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { apiError, rateLimitError } from "@/lib/api/errors";
import {
  buildRateLimitKey,
  rateLimit,
} from "@/lib/security/rateLimit";
import { parseBody } from "@/lib/validation/request";
import { projectCreateSchema } from "@/lib/validation/schemas";

function parseTags(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function POST(
  request: Request,
  context: { params: any },
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

  const rate = await rateLimit({
    key: buildRateLimitKey([
      "proposal",
      "project",
      params.companyId,
      session.userId,
    ]),
    limit: 20,
    windowSeconds: 3600,
  });
  if (!rate.allowed) {
    return rateLimitError(rate.retryAfter);
  }

  const { data, error } = await parseBody(request, projectCreateSchema);
  if (error) return error;

  const project = await prisma.project.create({
    data: {
      name: data.name,
      description: data.description,
      tags: parseTags(data.tags),
      ownerType: OwnerType.COMPANY,
      ownerCompanyId: params.companyId,
      createdByUserId: session.userId,
      moderationStatus: ContentStatus.PENDING,
      projectStatus: data.projectStatus as ProjectStatus,
      rejectionReason: null,
      publishedAt: null,
    },
    select: {
      id: true,
      name: true,
      moderationStatus: true,
    },
  });

  // Notify reviewers
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

  const notificationTitle = `New project proposal in ${membership.company.name}`;
  const notificationLink = `/company/${params.companyId}/hub/proposals/projects/${project.id}`;

  if (reviewers.length > 0) {
    await prisma.notification.createMany({
      data: reviewers.map((reviewer) => ({
        userId: reviewer.userId,
        type: NotificationType.SYSTEM,
        title: notificationTitle,
        body: `A new project proposal "${project.name}" has been submitted for review.`,
        link: notificationLink,
      })),
    });
  }

  return NextResponse.json({ item: project }, { status: 201 });
}
