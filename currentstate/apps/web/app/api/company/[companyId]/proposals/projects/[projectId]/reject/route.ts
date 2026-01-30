import { NextResponse } from "next/server";
import { ContentStatus, NotificationType } from "@prisma/client";

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

  const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { 
          ownerCompanyId: true, 
          moderationStatus: true,
          createdByUserId: true,
          name: true,
        }
  });

  if (!project || project.ownerCompanyId !== params.companyId) {
      return NextResponse.json({ error: "Project not found or doesn't belong to this company." }, { status: 404 });
  }

  if (project.moderationStatus !== ContentStatus.PENDING) {
      return NextResponse.json({ error: "This proposal is not pending and cannot be rejected." }, { status: 400 });
  }

  const payload = (await request.json()) as RejectPayload;
  const reason = payload.reason?.trim();

  if (!reason) {
      return NextResponse.json({ error: "A reason for rejection is required." }, { status: 400 });
  }

  const updatedProject = await prisma.project.update({
      where: { id: params.projectId },
      data: {
          moderationStatus: ContentStatus.REJECTED,
          rejectionReason: reason,
      }
  });

  if(project.createdByUserId) {
    await prisma.notification.create({
        data: {
            userId: project.createdByUserId,
            type: NotificationType.SYSTEM,
            title: "Your project proposal was rejected",
            body: `Your proposal "${project.name}" was rejected. Reason: ${reason}`,
            link: `/company/${params.companyId}/hub/proposals/projects/${params.projectId}`,
        }
    });
  }

  return NextResponse.json({ item: updatedProject });
}
