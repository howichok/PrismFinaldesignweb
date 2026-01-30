import { NextResponse } from "next/server";
import { ContentStatus, NotificationType } from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { isCompanyReviewer } from "@/lib/company/roles";

export async function POST(
  request: Request,
  context: { params: { companyId: string; projectId: string } },
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
      { error: "Insufficient permissions. Only reviewers can approve proposals." },
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
      return NextResponse.json({ error: "This proposal is not pending and cannot be approved." }, { status: 400 });
  }

  const updatedProject = await prisma.project.update({
      where: { id: params.projectId },
      data: {
          moderationStatus: ContentStatus.APPROVED,
          publishedAt: new Date(),
          rejectionReason: null,
      }
  });

  if(project.createdByUserId) {
    await prisma.notification.create({
        data: {
            userId: project.createdByUserId,
            type: NotificationType.SYSTEM,
            title: "Your project proposal was approved",
            body: `Your proposal "${project.name}" has been approved and is now public.`,
            link: `/project/${updatedProject.id}`,
        }
    });
  }

  return NextResponse.json({ item: updatedProject });
}
