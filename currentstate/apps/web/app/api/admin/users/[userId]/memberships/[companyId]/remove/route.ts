import { NextResponse } from "next/server";
import { CompanyRole } from "@prisma/client";

import { requireAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

export async function POST(
  _request: Request,
  context: { params: any },
) {
  const params = context.params;
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

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
    return NextResponse.json({ error: "Membership not found." }, { status: 404 });
  }

  if (membership.companyRole === CompanyRole.OWNER) {
    return NextResponse.json(
      { error: "Cannot remove company owner." },
      { status: 409 },
    );
  }

  await prisma.$transaction([
    prisma.companyMembership.delete({ where: { id: membership.id } }),
    prisma.auditLog.create({
      data: {
        actorUserId: auth.session!.userId,
        actionType: "ADMIN_COMPANY_MEMBER_REMOVE",
        targetType: "COMPANY_MEMBERSHIP",
        targetId: membership.id,
        meta: {
          companyId: params.companyId,
          userId: params.userId,
        },
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
