import { NextResponse } from "next/server";
import { UpdateStatus, ProjectUpdateType, UpdateImportance } from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { isCompanyReviewer } from "@/lib/company/roles";

type UpdateProposalPayload = {
    title: string;
    summary: string;
    details?: string;
    updateType: ProjectUpdateType;
    importance: UpdateImportance;
};

export async function GET(
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
    });

    if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const projectUpdate = await prisma.projectUpdate.findFirst({
        where: {
            id: params.updateId,
            project: {
                ownerCompanyId: params.companyId,
            }
        },
        include: {
            createdBy: {
                select: {
                    id: true,
                    displayName: true,
                    avatarUrl: true,
                }
            },
            project: {
                select: {
                    id: true,
                    name: true,
                },
            },
        }
    });

    if (!projectUpdate) {
        return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const canEdit = projectUpdate.createdByUserId === session.userId || isCompanyReviewer(membership.companyRole);
    if (projectUpdate.status !== UpdateStatus.PENDING && !isCompanyReviewer(membership.companyRole)) {
        if (projectUpdate.status !== UpdateStatus.REJECTED || projectUpdate.createdByUserId !== session.userId) {
             return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
    }


    return NextResponse.json({ item: projectUpdate, canEdit });
}


export async function PATCH(
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
        select: { companyRole: true },
    });

    if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    const projectUpdate = await prisma.projectUpdate.findUnique({
        where: { id: params.updateId },
        select: { createdByUserId: true, status: true, project: { select: { ownerCompanyId: true } } }
    });

    if (!projectUpdate || projectUpdate.project.ownerCompanyId !== params.companyId) {
        return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    
    const canEdit = projectUpdate.createdByUserId === session.userId || isCompanyReviewer(membership.companyRole);

    if (!canEdit) {
        return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    if (projectUpdate.status !== UpdateStatus.PENDING) {
        return NextResponse.json({ error: "Only pending proposals can be edited." }, { status: 400 });
    }

    const payload = (await request.json()) as UpdateProposalPayload;

    const updatedItem = await prisma.projectUpdate.update({
        where: {
            id: params.updateId,
        },
        data: {
            title: payload.title?.trim(),
            summary: payload.summary?.trim(),
            details: payload.details,
            updateType: payload.updateType,
            importance: payload.importance,
        },
    });

    return NextResponse.json({ item: updatedItem });
}
