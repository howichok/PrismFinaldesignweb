import { NextResponse } from "next/server";
import { InviteStatus, InviteType } from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { isCompanyOwner } from "@/lib/company/roles";
import { logInfo } from "@/lib/security/logger";
import { getRequestId } from "@/lib/security/request";

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
      status: InviteStatus.PENDING,
      toCompanyId: params.companyId,
    },
    select: {
      id: true,
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  await prisma.invite.update({
    where: { id: invite.id },
    data: {
      status: InviteStatus.DECLINED,
      respondedAt: new Date(),
    },
  });

  logInfo("collab_invite_decline", {
    requestId: getRequestId(request),
    inviteId: invite.id,
    companyId: params.companyId,
    userId: session.userId,
  });

  return NextResponse.json({ ok: true });
}
