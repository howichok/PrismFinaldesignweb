import { NextResponse } from "next/server";
import { CompanyRole } from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { canAssignCoOwner, isCompanyManager } from "@/lib/company/roles";

export async function POST(
  _request: Request,
  context: { params: { companyId: string; userId: string } },
) {
  const params = context.params;
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requesterMembership = await prisma.companyMembership.findUnique({
    where: {
      companyId_userId: {
        companyId: params.companyId,
        userId: session.userId,
      },
    },
    select: { companyRole: true },
  });

  if (!requesterMembership || !isCompanyManager(requesterMembership.companyRole)) {
    return NextResponse.json(
      { error: "Insufficient permissions." },
      { status: 403 },
    );
  }

  const membership = await prisma.companyMembership.findUnique({
    where: {
      companyId_userId: {
        companyId: params.companyId,
        userId: params.userId,
      },
    },
    select: {
      id: true,
      companyRole: true,
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  if (membership.companyRole === CompanyRole.OWNER) {
    return NextResponse.json(
      { error: "Owner cannot be removed." },
      { status: 403 },
    );
  }

  if (
    membership.companyRole === CompanyRole.CO_OWNER &&
    !canAssignCoOwner(requesterMembership.companyRole)
  ) {
    return NextResponse.json(
      { error: "Only owners can remove co-owners." },
      { status: 403 },
    );
  }

  await prisma.companyMembership.delete({
    where: { id: membership.id },
  });

  return NextResponse.json({ ok: true });
}
