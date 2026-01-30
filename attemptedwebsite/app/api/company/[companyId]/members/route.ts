import { NextResponse } from "next/server";

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

  const members = await prisma.companyMembership.findMany({
    where: {
      companyId: params.companyId,
    },
    orderBy: {
      joinedAt: "asc",
    },
    select: {
      user: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      companyRole: true,
      joinedAt: true,
    },
  });

  return NextResponse.json({
    items: members.map((member) => ({
      id: member.user.id,
      displayName: member.user.displayName,
      avatarUrl: member.user.avatarUrl,
      companyRole: member.companyRole,
      joinedAt: member.joinedAt.toISOString(),
    })),
  });
}
