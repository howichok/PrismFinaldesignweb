import { NextResponse } from "next/server";
import {
  CompanyRole,
  InviteStatus,
  InviteType,
  NotificationType,
  PartnershipStatus,
} from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { MAX_PARTNERSHIPS } from "@/lib/company/partnerships";
import { apiError, rateLimitError } from "@/lib/api/errors";
import {
  buildRateLimitKey,
  rateLimit,
} from "@/lib/security/rateLimit";
import { parseBody } from "@/lib/validation/request";
import { partnershipInviteSchema } from "@/lib/validation/schemas";
import { requireCompanyRole } from "@/lib/auth/permissions";

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
      "partnership-invite",
      params.companyId,
      session.userId,
    ]),
    limit: 10,
    windowSeconds: 3600,
  });
  if (!rate.allowed) {
    return rateLimitError(rate.retryAfter);
  }

  const { data, error } = await parseBody(request, partnershipInviteSchema);
  if (error) return error;

  if (data.toCompanyId === params.companyId) {
    return apiError(400, "INVALID_INVITE", "You cannot invite your own company.");
  }

  const [toCompany, existingPartnership, existingInvite, activeA, activeB] =
    await Promise.all([
      prisma.company.findUnique({
        where: { id: data.toCompanyId },
        select: { id: true, name: true },
      }),
      prisma.partnership.findFirst({
        where: {
          OR: [
            { companyAId: params.companyId, companyBId: data.toCompanyId },
            { companyAId: data.toCompanyId, companyBId: params.companyId },
          ],
          status: { in: [PartnershipStatus.ACTIVE, PartnershipStatus.PENDING] },
        },
        select: { id: true, status: true },
      }),
      prisma.invite.findFirst({
        where: {
          type: InviteType.PARTNERSHIP,
          status: InviteStatus.PENDING,
          OR: [
            { fromCompanyId: params.companyId, toCompanyId: data.toCompanyId },
            { fromCompanyId: data.toCompanyId, toCompanyId: params.companyId },
          ],
        },
        select: { id: true },
      }),
      prisma.partnership.count({
        where: {
          status: PartnershipStatus.ACTIVE,
          OR: [
            { companyAId: params.companyId },
            { companyBId: params.companyId },
          ],
        },
      }),
      prisma.partnership.count({
        where: {
          status: PartnershipStatus.ACTIVE,
          OR: [
            { companyAId: data.toCompanyId },
            { companyBId: data.toCompanyId },
          ],
        },
      }),
    ]);

  if (!toCompany) {
    return apiError(404, "NOT_FOUND", "Company not found.");
  }

  if (activeA >= MAX_PARTNERSHIPS || activeB >= MAX_PARTNERSHIPS) {
    return apiError(409, "LIMIT_REACHED", "Partnership limit reached (5).");
  }

  if (existingPartnership) {
    return apiError(409, "PARTNERSHIP_EXISTS", "Partnership already exists.");
  }

  if (existingInvite) {
    return apiError(409, "INVITE_EXISTS", "Invite already pending.");
  }

  const invite = await prisma.$transaction(async (tx) => {
    const created = await tx.invite.create({
      data: {
        type: InviteType.PARTNERSHIP,
        status: InviteStatus.PENDING,
        createdByUserId: session.userId,
        fromCompanyId: params.companyId,
        toCompanyId: data.toCompanyId,
      },
      select: { id: true },
    });

    const recipients = await tx.companyMembership.findMany({
      where: {
        companyId: data.toCompanyId,
        companyRole: { in: ["OWNER", "CO_OWNER"] },
      },
      select: { userId: true },
    });

    if (recipients.length > 0) {
      await tx.notification.createMany({
        data: recipients.map((recipient) => ({
          userId: recipient.userId,
          type: NotificationType.INVITE,
          title: "Partnership invite",
          body: `${membership.company.name} invited your company to become partners.`,
          link: `/company/${data.toCompanyId}/hub/partnerships`,
        })),
      });
    }

    return created;
  });

  return NextResponse.json({ id: invite.id }, { status: 201 });
}
