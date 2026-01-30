import { NextResponse } from "next/server";
import {
  CompanyRole,
  InviteStatus,
  InviteType,
  NotificationType,
  OwnerType,
} from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { isCompanyOwner } from "@/lib/company/roles";
import { logInfo } from "@/lib/security/logger";
import { getRequestId } from "@/lib/security/request";

const MAX_COLLABORATORS = 10;

export async function POST(
  request: Request,
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
      toCompanyId: params.companyId,
    },
    select: {
      id: true,
      status: true,
      projectId: true,
      fromCompanyId: true,
      toCompanyId: true,
    },
  });

  if (!invite || !invite.projectId || !invite.fromCompanyId || !invite.toCompanyId) { // Added !invite.toCompanyId check
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Invite not found." } },
      { status: 404 },
    );
  }

  // Idempotency: if already accepted, return success
  if (invite.status === InviteStatus.ACCEPTED) {
    return NextResponse.json({ ok: true, alreadyAccepted: true });
  }

  if (invite.status !== InviteStatus.PENDING) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_STATUS",
          message: "Invite is no longer available.",
        },
      },
      { status: 409 },
    );
  }

  const project = await prisma.project.findFirst({
    where: {
      id: invite.projectId,
      ownerType: OwnerType.COMPANY,
      ownerCompanyId: invite.fromCompanyId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!project) {
    return NextResponse.json(
      { error: "Project no longer available." },
      { status: 404 },
    );
  }

  const collaboratorCount = await prisma.projectCollaboratorCompany.count({
    where: { projectId: project.id },
  });

  if (collaboratorCount >= MAX_COLLABORATORS) {
    return NextResponse.json(
      { error: "Collaboration limit reached (10)." },
      { status: 409 },
    );
  }

  const existingLink = await prisma.projectCollaboratorCompany.findUnique({
    where: {
      projectId_companyId: {
        projectId: project.id,
        companyId: invite.toCompanyId, // Verified non-null above
      },
    },
    select: { id: true },
  });

  if (existingLink) {
    return NextResponse.json(
      { error: "Company is already a collaborator." },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    // Double-check status in transaction
    const currentInvite = await tx.invite.findUnique({
      where: { id: invite.id },
      select: { status: true },
    });

    if (!currentInvite || currentInvite.status !== InviteStatus.PENDING) {
      throw new Error("Invite status changed");
    }

    await tx.projectCollaboratorCompany.create({
      data: {
        projectId: project.id,
        companyId: invite.toCompanyId!, // Safe assertion or verified check
        addedViaInviteId: invite.id,
      },
    });

    await tx.invite.update({
      where: { id: invite.id },
      data: {
        status: InviteStatus.ACCEPTED,
        respondedAt: new Date(),
      },
    });

    const fromRecipients = await tx.companyMembership.findMany({
      where: {
        companyId: invite.fromCompanyId!, // Verified non-null
        companyRole: {
          in: [CompanyRole.OWNER, CompanyRole.CO_OWNER],
        },
      },
      select: { userId: true },
    });

    if (fromRecipients.length > 0) {
      const toCompany = await tx.company.findUnique({
        where: { id: invite.toCompanyId! }, // Verified non-null
        select: { name: true },
      });

      await tx.notification.createMany({
        data: fromRecipients.map((recipient) => ({
          userId: recipient.userId,
          type: NotificationType.INVITE,
          title: "Collaboration accepted",
          body: `${toCompany?.name ?? "A company"} accepted the collaboration invite for ${project.name}.`,
          link: `/company/${invite.fromCompanyId}/hub/projects/${project.id}/collaborators`,
        })),
      });
    }
  });

  logInfo(
    "collab_invite_accept",
    {
      inviteId: invite.id,
      companyId: params.companyId,
      userId: session.userId,
      projectId: project.id,
    },
    request,
  );

  return NextResponse.json({ ok: true });
}
