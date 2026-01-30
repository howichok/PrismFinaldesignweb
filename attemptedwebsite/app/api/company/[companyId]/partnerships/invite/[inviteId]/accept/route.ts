import { NextResponse } from "next/server";
import {
  InviteStatus,
  InviteType,
  NotificationType,
  PartnershipStatus,
} from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { isCompanyOwner } from "@/lib/company/roles";
import { MAX_PARTNERSHIPS, normalizeCompanyPair } from "@/lib/company/partnerships";
import { logInfo } from "@/lib/security/logger";
import { getRequestId } from "@/lib/security/request";

export async function POST(
  request: Request,
  context: { params: { companyId: string; inviteId: string } },
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
    select: { companyRole: true },
  });

  if (!membership || !isCompanyOwner(membership.companyRole)) {
    return NextResponse.json(
      { error: "Insufficient permissions." },
      { status: 403 },
    );
  }

  const invite = await prisma.invite.findFirst({
    where: {
      id: params.inviteId,
      type: InviteType.PARTNERSHIP,
      toCompanyId: params.companyId,
    },
    select: {
      id: true,
      status: true,
      fromCompanyId: true,
      toCompanyId: true,
      createdByUserId: true,
    },
  });

  if (!invite || !invite.fromCompanyId || !invite.toCompanyId) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Invite not found." } },
      { status: 404 },
    );
  }

  // Idempotency: if already accepted, return success
  if (invite.status === InviteStatus.ACCEPTED) {
    return NextResponse.json({ ok: true, alreadyAccepted: true });
  }

  if (invite.status !== InviteStatus.PENDING) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_STATUS",
          message: "Invite is no longer available.",
        },
      },
      { status: 409 },
    );
  }

  const [activeA, activeB, existingPartnership] = await Promise.all([
    prisma.partnership.count({
      where: {
        status: PartnershipStatus.ACTIVE,
        OR: [
          { companyAId: invite.fromCompanyId },
          { companyBId: invite.fromCompanyId },
        ],
      },
    }),
    prisma.partnership.count({
      where: {
        status: PartnershipStatus.ACTIVE,
        OR: [
          { companyAId: invite.toCompanyId },
          { companyBId: invite.toCompanyId },
        ],
      },
    }),
    prisma.partnership.findFirst({
      where: {
        OR: [
          { companyAId: invite.fromCompanyId, companyBId: invite.toCompanyId },
          { companyAId: invite.toCompanyId, companyBId: invite.fromCompanyId },
        ],
      },
      select: { id: true, status: true, createdByUserId: true },
    }),
  ]);

  if (activeA >= MAX_PARTNERSHIPS || activeB >= MAX_PARTNERSHIPS) {
    return NextResponse.json(
      { error: "Partnership limit reached (5)." },
      { status: 409 },
    );
  }

  if (existingPartnership?.status === PartnershipStatus.ACTIVE) {
    return NextResponse.json(
      { error: "Partnership already active." },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    // Double-check status in transaction
    const currentInvite = await tx.invite.findUnique({
      where: { id: invite.id },
      select: { status: true },
    });

    if (!currentInvite || currentInvite.status !== InviteStatus.PENDING) {
      throw new Error("Invite status changed");
    }

    if (existingPartnership && existingPartnership.status !== PartnershipStatus.ACTIVE) {
      await tx.partnership.update({
        where: { id: existingPartnership.id },
        data: {
          status: PartnershipStatus.ACTIVE,
        },
      });
    } else if (!existingPartnership) {
      // Use ! because we verified they are not null above
      const pair = normalizeCompanyPair(invite.fromCompanyId!, invite.toCompanyId!);
      await tx.partnership.create({
        data: {
          ...pair,
          status: PartnershipStatus.ACTIVE,
          createdByUserId: invite.createdByUserId ?? session.userId,
        },
      });
    }

    await tx.invite.update({
      where: { id: invite.id },
      data: {
        status: InviteStatus.ACCEPTED,
        respondedAt: new Date(),
      },
    });

    const [fromCompany, toCompany, recipients] = await Promise.all([
      tx.company.findUnique({
        where: { id: invite.fromCompanyId! },
        select: { name: true },
      }),
      tx.company.findUnique({
        where: { id: invite.toCompanyId! },
        select: { name: true },
      }),
      tx.companyMembership.findMany({
        where: {
          companyId: invite.fromCompanyId!,
          companyRole: { in: ["OWNER", "CO_OWNER"] },
        },
        select: { userId: true },
      }),
    ]);

    if (recipients.length > 0) {
      await tx.notification.createMany({
        data: recipients.map((recipient) => ({
          userId: recipient.userId,
          type: NotificationType.INVITE,
          title: "Partnership accepted",
          body: `${toCompany?.name ?? "A company"} accepted the partnership invite from ${fromCompany?.name ?? "your company"}.`,
          link: `/company/${invite.fromCompanyId}/hub/partnerships`,
        })),
      });
    }
  });

  logInfo(
    "partnership_invite_accept",
    {
      inviteId: invite.id,
      companyId: params.companyId,
      userId: session.userId,
    },
    request,
  );

  return NextResponse.json({ ok: true });
}
