import { NextResponse } from "next/server";
import { PartnershipStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { isCompanyOwner } from "@/lib/company/roles";

export async function POST(
  _request: Request,
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
    select: { companyRole: true },
  });

  if (!membership || !isCompanyOwner(membership.companyRole)) {
    return NextResponse.json(
      { error: "Insufficient permissions." },
      { status: 403 },
    );
  }

  const partnership = await prisma.partnership.findFirst({
    where: {
      id: params.partnershipId,
      status: PartnershipStatus.ACTIVE,
      OR: [
        { companyAId: params.companyId },
        { companyBId: params.companyId },
      ],
    },
    select: { id: true },
  });

  if (!partnership) {
    return NextResponse.json({ error: "Partnership not found." }, { status: 404 });
  }

  await prisma.partnership.update({
    where: { id: partnership.id },
    data: { status: PartnershipStatus.ENDED },
  });

  return NextResponse.json({ ok: true });
}
