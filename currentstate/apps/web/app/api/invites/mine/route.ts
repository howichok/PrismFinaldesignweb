import { NextRequest, NextResponse } from "next/server";
import { InviteStatus, InviteType } from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get("type")?.toLowerCase();
  const statusParam = searchParams.get("status")?.toUpperCase();

  const type =
    typeParam === "company_membership"
      ? InviteType.COMPANY_MEMBERSHIP
      : InviteType.COMPANY_MEMBERSHIP;
  const status =
    statusParam === "PENDING" ? InviteStatus.PENDING : InviteStatus.PENDING;

  const invites = await prisma.invite.findMany({
    where: {
      toUserId: session.userId,
      type,
      status,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      offeredCompanyRole: true,
      createdAt: true,
      company: {
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
      offeredRole: invite.offeredCompanyRole,
      createdAt: invite.createdAt.toISOString(),
      company: invite.company,
      invitedBy: invite.createdBy.displayName,
    })),
  });
}
