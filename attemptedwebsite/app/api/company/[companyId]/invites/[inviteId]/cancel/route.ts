import { NextRequest, NextResponse } from "next/server";
import { InviteStatus, InviteType } from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { isCompanyManager, canAssignCoOwner } from "@/lib/company/roles";

export async function POST(
  _request: NextRequest,
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

  if (!membership || !isCompanyManager(membership.companyRole)) {
    return NextResponse.json(
      { error: "Insufficient permissions." },
      { status: 403 },
    );
  }

  const invite = await prisma.invite.findFirst({
    where: {
      id: params.inviteId,
      companyId: params.companyId,
      type: InviteType.COMPANY_MEMBERSHIP,
    },
    select: {
      id: true,
      status: true,
      offeredCompanyRole: true,
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (invite.status !== InviteStatus.PENDING) {
    return NextResponse.json(
      { error: "Invite already resolved." },
      { status: 409 },
    );
  }

  if (
    invite.offeredCompanyRole === "CO_OWNER" &&
    !canAssignCoOwner(membership.companyRole)
  ) {
    return NextResponse.json(
      { error: "Only owners can cancel co-owner invites." },
      { status: 403 },
    );
  }

  await prisma.invite.update({
    where: { id: invite.id },
    data: {
      status: InviteStatus.CANCELED,
      respondedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
