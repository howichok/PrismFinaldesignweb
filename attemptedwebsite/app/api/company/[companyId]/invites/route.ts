import { NextRequest, NextResponse } from "next/server";
import {
  CompanyInviteRole,
  CompanyRole,
  InviteStatus,
  InviteType,
  NotificationType,
} from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { canAssignCoOwner } from "@/lib/company/roles";
import { apiError, rateLimitError } from "@/lib/api/errors";
import {
  buildRateLimitKey,
  rateLimit,
} from "@/lib/security/rateLimit";
import { parseBody } from "@/lib/validation/request";
import { inviteCompanySchema } from "@/lib/validation/schemas";
import {
  requireCompanyMembership,
  requireCompanyRole,
} from "@/lib/auth/permissions";

const roleLabels: Record<CompanyInviteRole, string> = {
  MEMBER: "Member",
  TRUSTED: "Trusted",
  CO_OWNER: "Co-owner",
};

export async function GET(
  request: NextRequest,
  context: { params: { companyId: string } },
) {
  const params = context.params;
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membershipResult = await requireCompanyMembership({
    companyId: params.companyId,
    userId: session.userId,
  });
  if (membershipResult.response) return membershipResult.response;
  const membership = membershipResult.data;

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status")?.toUpperCase();
  const status =
    statusParam === "PENDING" ? InviteStatus.PENDING : InviteStatus.PENDING;

  const invites = await prisma.invite.findMany({
    where: {
      type: InviteType.COMPANY_MEMBERSHIP,
      status,
      companyId: params.companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      offeredCompanyRole: true,
      createdAt: true,
      toUser: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
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
      offeredRole: invite.offeredCompanyRole,
      createdAt: invite.createdAt.toISOString(),
      toUser: invite.toUser,
      invitedBy: invite.createdBy.displayName,
    })),
  });
}

export async function POST(
  request: Request,
  context: { params: { companyId: string } },
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
      "company-invite",
      params.companyId,
      session.userId,
    ]),
    limit: 20,
    windowSeconds: 3600,
  });
  if (!rate.allowed) {
    return rateLimitError(rate.retryAfter);
  }

  const { data, error } = await parseBody(request, inviteCompanySchema);
  if (error) return error;

  if (data.toUserId === session.userId) {
    return apiError(400, "INVALID_INVITE", "You cannot invite yourself.");
  }

  const offeredRole = data.offeredRole as CompanyInviteRole;
  if (offeredRole === "CO_OWNER" && !canAssignCoOwner(membership.companyRole)) {
    return apiError(
      403,
      "FORBIDDEN",
      "Only owners can assign co-owner.",
    );
  }

  const company = await prisma.company.findUnique({
    where: { id: params.companyId },
    select: { id: true, name: true },
  });

  if (!company) {
    return apiError(404, "NOT_FOUND", "Company not found.");
  }

  const [user, existingMember, existingInvite] = await Promise.all([
    prisma.user.findUnique({
      where: { id: data.toUserId },
      select: { id: true },
    }),
    prisma.companyMembership.findUnique({
      where: {
        companyId_userId: {
        companyId: params.companyId,
        userId: data.toUserId,
        },
      },
      select: { id: true },
    }),
    prisma.invite.findFirst({
      where: {
        type: InviteType.COMPANY_MEMBERSHIP,
        status: InviteStatus.PENDING,
        companyId: params.companyId,
        toUserId: data.toUserId,
      },
      select: { id: true },
    }),
  ]);

  if (!user) {
    return apiError(404, "NOT_FOUND", "User not found.");
  }

  if (existingMember) {
    return apiError(409, "INVITE_EXISTS", "User is already a member.");
  }

  if (existingInvite) {
    return apiError(409, "INVITE_EXISTS", "Invite already pending.");
  }

  const invite = await prisma.$transaction(async (tx) => {
    const created = await tx.invite.create({
      data: {
        type: InviteType.COMPANY_MEMBERSHIP,
        status: InviteStatus.PENDING,
        createdByUserId: session.userId,
        toUserId: data.toUserId,
        companyId: params.companyId,
        offeredCompanyRole: offeredRole,
      },
      select: { id: true },
    });

    await tx.notification.create({
      data: {
        userId: data.toUserId,
        type: NotificationType.INVITE,
        title: `Company invite: ${company.name}`,
        body: `Role: ${roleLabels[offeredRole]}`,
        link: "/dashboard/invites",
      },
    });

    return created;
  });

  return NextResponse.json({ id: invite.id });
}
