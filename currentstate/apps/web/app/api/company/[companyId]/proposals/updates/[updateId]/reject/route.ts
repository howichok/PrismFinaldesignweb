import { NextResponse } from "next/server";
import { NotificationType, UpdateStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { isCompanyReviewer } from "@/lib/company/roles";

type RejectPayload = {
    reason: string;
}

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

  if (!membership || !isCompanyReviewer(membership.companyRole)) {
    return NextResponse.json(
      { error: "Insufficient permissions. Only reviewers can reject proposals." },
      { status: 403 },
    );
  }

  const projectUpdate = await prisma.projectUpdate.findUnique({
    where: { id: params.updateId },
    include: {
        project: {
            select: {
                ownerCompanyId: true,
                id: true,
            }
        }
    }
  });

  if (!projectUpdate || projectUpdate.project.ownerCompanyId !== params.companyId) {
      return NextResponse.json({ error: "Project update not found or doesn't belong to this company." }, { status: 404 });
  }

  if (projectUpdate.status !== UpdateStatus.PENDING) {
      return NextResponse.json({ error: "This proposal is not pending and cannot be rejected." }, { status: 400 });
  }

  const payload = (await request.json()) as RejectPayload;
  const reason = payload.reason?.trim();

  if (!reason) {
      return NextResponse.json({ error: "A reason for rejection is required." }, { status: 400 });
  }

  const updatedProjectUpdate = await prisma.projectUpdate.update({
      where: { id: params.updateId },
      data: {
          status: UpdateStatus.REJECTED,
          rejectionReason: reason,
          reviewedByUserId: session.userId,
          reviewedAt: new Date(),
      }
  });

  if(projectUpdate.createdByUserId) {
    await prisma.notification.create({
        data: {
            userId: projectUpdate.createdByUserId,
            type: NotificationType.SYSTEM,
            title: "Your project update proposal was rejected",
            body: `Your proposal "${projectUpdate.title}" was rejected. Reason: ${reason}`,
            link: `/company/${params.companyId}/hub/proposals/updates/${params.updateId}`,
        }
    });
  }

  return NextResponse.json({ item: updatedProjectUpdate });
}
