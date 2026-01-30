import { NextResponse } from "next/server";
import {
  CompanyRole,
  InviteStatus,
  InviteType,
  NotificationType,
  OwnerType,
} from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { apiError, rateLimitError } from "@/lib/api/errors";
import {
  buildRateLimitKey,
  rateLimit,
} from "@/lib/security/rateLimit";
import { parseBody } from "@/lib/validation/request";
import { collabInviteSchema } from "@/lib/validation/schemas";
import { requireCompanyRole } from "@/lib/auth/permissions";

const MAX_COLLABORATORS = 10;

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
    return apiError(403, "FORBIDDEN", "Forbidden");
  }

  const project = await prisma.project.findFirst({
    where: {
      id: params.projectId,
      ownerType: OwnerType.COMPANY,
      ownerCompanyId: params.companyId,
    },
    select: { id: true },
  });

  if (!project) {
    return apiError(404, "NOT_FOUND", "Project not found.");
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status")?.toUpperCase();
  const status =
    statusParam === "PENDING" ? InviteStatus.PENDING : InviteStatus.PENDING;

  const invites = await prisma.invite.findMany({
    where: {
      type: InviteType.PROJECT_COLLAB,
      status,
      projectId: params.projectId,
      fromCompanyId: params.companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      createdAt: true,
      toCompany: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
        },
      },
      createdBy: {
        select: {
          displayName: true,
        },
      },
    },
  });

  return NextResponse.json({
    items: invites.map((invite) => ({
      id: invite.id,
      createdAt: invite.createdAt.toISOString(),
      toCompany: invite.toCompany,
      createdBy: invite.createdBy.displayName,
    })),
  });
}

export async function POST(
  request: Request,
  context: { params: { companyId: string; projectId: string } },
) {
  const params = context.params;
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membershipResult = await requireCompanyRole({
    companyId: params.companyId,
    userId: session.userId,
    roles: [CompanyRole.OWNER, CompanyRole.CO_OWNER],
  });
  if (membershipResult.response) return membershipResult.response;
  const membership = membershipResult.data;

  const rate = await rateLimit({
    key: buildRateLimitKey([
      "collab-invite",
      params.companyId,
      session.userId,
    ]),
    limit: 20,
    windowSeconds: 3600,
  });
  if (!rate.allowed) {
    return rateLimitError(rate.retryAfter);
  }

  const { data, error } = await parseBody(request, collabInviteSchema);
  if (error) return error;

  if (data.toCompanyId === params.companyId) {
    return apiError(400, "INVALID_INVITE", "You cannot invite your own company.");
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
    },
  });

  if (!project) {
    return apiError(404, "NOT_FOUND", "Project not found.");
  }

  const [toCompany, existingInvite, existingLink, collaboratorCount] =
    await Promise.all([
      prisma.company.findUnique({
        where: { id: data.toCompanyId },
        select: { id: true },
      }),
      prisma.invite.findFirst({
        where: {
          type: InviteType.PROJECT_COLLAB,
          status: InviteStatus.PENDING,
          projectId: params.projectId,
          toCompanyId: data.toCompanyId,
          fromCompanyId: params.companyId,
        },
        select: { id: true },
      }),
      prisma.projectCollaboratorCompany.findUnique({
        where: {
          projectId_companyId: {
            projectId: params.projectId,
            companyId: data.toCompanyId,
          },
        },
        select: { id: true },
      }),
      prisma.projectCollaboratorCompany.count({
        where: { projectId: params.projectId },
      }),
    ]);

  if (!toCompany) {
    return apiError(404, "NOT_FOUND", "Company not found.");
  }

  if (collaboratorCount >= MAX_COLLABORATORS) {
    return apiError(409, "LIMIT_REACHED", "Collaboration limit reached (10).");
  }

  if (existingLink) {
    return apiError(409, "ALREADY_COLLABORATOR", "Company is already a collaborator.");
  }

  if (existingInvite) {
    return apiError(409, "INVITE_EXISTS", "Invite already pending.");
  }

  const invite = await prisma.$transaction(async (tx) => {
    const created = await tx.invite.create({
      data: {
        type: InviteType.PROJECT_COLLAB,
        status: InviteStatus.PENDING,
        createdByUserId: session.userId,
        fromCompanyId: params.companyId,
        toCompanyId: data.toCompanyId,
        projectId: params.projectId,
      },
      select: { id: true },
    });

    const recipients = await tx.companyMembership.findMany({
      where: {
        companyId: data.toCompanyId,
        companyRole: {
          in: [CompanyRole.OWNER, CompanyRole.CO_OWNER],
        },
      },
      select: {
        userId: true,
      },
    });

    if (recipients.length > 0) {
      await tx.notification.createMany({
        data: recipients.map((recipient) => ({
          userId: recipient.userId,
          type: NotificationType.INVITE,
          title: "Collaboration invite",
          body: `${membership.company.name} invited your company to collaborate on ${project.name}.`,
          link: `/company/${data.toCompanyId}/hub/collaborations`,
        })),
      });
    }

    return created;
  });

  return NextResponse.json({ id: invite.id }, { status: 201 });
}
