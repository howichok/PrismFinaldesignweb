import { NextResponse } from "next/server";
import { CompanyRole, InviteStatus, InviteType } from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { logInfo } from "@/lib/security/logger";
import { getRequestId } from "@/lib/security/request";

export async function POST(
  request: Request,
  context: { params: { inviteId: string } },
) {
  const params = context.params;
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invite = await prisma.invite.findFirst({
    where: {
      id: params.inviteId,
      toUserId: session.userId,
      type: InviteType.COMPANY_MEMBERSHIP,
    },
    select: {
      id: true,
      status: true,
      companyId: true,
      offeredCompanyRole: true,
      createdByUserId: true,
    },
  });

  if (!invite || !invite.companyId || !invite.offeredCompanyRole) {
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

  const existingMember = await prisma.companyMembership.findUnique({
    where: {
      companyId_userId: {
        companyId: invite.companyId,
        userId: session.userId,
      },
    },
    select: { id: true },
  });

  if (existingMember) {
    return NextResponse.json(
      {
        error: {
          code: "ALREADY_MEMBER",
          message: "You are already a member.",
        },
      },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    // Double-check status in transaction for race condition protection
    const currentInvite = await tx.invite.findUnique({
      where: { id: invite.id },
      select: { status: true },
    });

    if (!currentInvite || currentInvite.status !== InviteStatus.PENDING) {
      throw new Error("Invite status changed");
    }

    await tx.companyMembership.create({
      data: {
        companyId: invite.companyId!,
        userId: session.userId,
        companyRole: invite.offeredCompanyRole as CompanyRole,
        invitedByUserId: invite.createdByUserId,
      },
    });

    await tx.invite.update({
      where: { id: invite.id },
      data: {
        status: InviteStatus.ACCEPTED,
        respondedAt: new Date(),
      },
    });
  });

  logInfo(
    "company_invite_accept",
    {
      inviteId: invite.id,
      userId: session.userId,
      companyId: invite.companyId,
    },
    request,
  );

  return NextResponse.json({ ok: true });
}
