import { NextResponse } from "next/server";
import { InviteStatus, InviteType } from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _request: Request,
  context: { params: { companyId: string } },
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
    select: { id: true },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invites = await prisma.invite.findMany({
    where: {
      type: InviteType.PARTNERSHIP,
      status: InviteStatus.PENDING,
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
    },
  });

  return NextResponse.json({
    items: invites.map((invite) => ({
      id: invite.id,
      createdAt: invite.createdAt.toISOString(),
      toCompany: invite.toCompany,
    })),
  });
}
