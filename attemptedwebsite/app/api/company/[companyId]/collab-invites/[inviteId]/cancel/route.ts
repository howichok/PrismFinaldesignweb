import { NextResponse } from "next/server";
import { InviteStatus, InviteType } from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { isCompanyOwner } from "@/lib/company/roles";

export async function POST(
  _request: Request,
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
    select: {
      companyRole: true,
    },
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
      type: InviteType.PROJECT_COLLAB,
      fromCompanyId: params.companyId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  if (invite.status !== InviteStatus.PENDING) {
    return NextResponse.json(
      { error: "Invite already resolved." },
      { status: 409 },
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
