import { NextResponse } from "next/server";
import { PartnershipStatus } from "@prisma/client";

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

  const partnerships = await prisma.partnership.findMany({
    where: {
      status: PartnershipStatus.ACTIVE,
      OR: [
        { companyAId: params.companyId },
        { companyBId: params.companyId },
      ],
    },
    select: {
      id: true,
      companyA: {
        select: { id: true, name: true, logoUrl: true },
      },
      companyB: {
        select: { id: true, name: true, logoUrl: true },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return NextResponse.json({
    items: partnerships.map((partnership) => ({
      partnershipId: partnership.id,
      company:
        partnership.companyA.id === params.companyId
          ? partnership.companyB
          : partnership.companyA,
    })),
  });
}
