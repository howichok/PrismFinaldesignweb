import { NextResponse } from "next/server";
import { CompanyRole } from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { canAssignCoOwner, isCompanyManager } from "@/lib/company/roles";

type RolePayload = {
  role?: string;
};

const roleValues = new Set(["MEMBER", "TRUSTED", "CO_OWNER"]);

export async function POST(
  request: Request,
  context: { params: any },
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

  const payload = (await request.json()) as RolePayload;
  const roleInput = payload.role?.trim().toUpperCase() ?? "";

  if (!roleValues.has(roleInput)) {
    return NextResponse.json(
      { error: "Role is invalid." },
      { status: 400 },
    );
  }

  if (roleInput === "CO_OWNER" && !canAssignCoOwner(requesterMembership.companyRole)) {
    return NextResponse.json(
      { error: "Only owners can assign co-owner." },
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
      { error: "Owner role cannot be changed." },
      { status: 403 },
    );
  }

  if (
    membership.companyRole === CompanyRole.CO_OWNER &&
    !canAssignCoOwner(requesterMembership.companyRole)
  ) {
    return NextResponse.json(
      { error: "Only owners can modify co-owners." },
      { status: 403 },
    );
  }

  const nextRole = roleInput as CompanyRole;

  const updated = await prisma.companyMembership.update({
    where: { id: membership.id },
    data: {
      companyRole: nextRole,
    },
    select: {
      userId: true,
      companyRole: true,
    },
  });

  return NextResponse.json({ member: updated });
}
