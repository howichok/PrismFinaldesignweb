import { NextResponse } from "next/server";
import { ContentStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { isCompanyReviewer } from "@/lib/company/roles";

type ProjectUpdatePayload = {
    name?: string;
    description?: string;
    tags?: string;
};

function parseTags(value?: string) {
    if (!value) return [];
    return value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
}

export async function GET(
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
    });

    if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const project = await prisma.project.findFirst({
        where: {
            id: params.projectId,
            ownerCompanyId: params.companyId,
        },
        include: {
            createdBy: {
                select: {
                    id: true,
                    displayName: true,
                    avatarUrl: true,
                }
            }
        }
    });

    if (!project) {
        return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const canEdit = project.createdByUserId === session.userId || isCompanyReviewer(membership.companyRole);
    if (project.moderationStatus !== ContentStatus.PENDING && !isCompanyReviewer(membership.companyRole)) {
        if (project.moderationStatus !== ContentStatus.REJECTED || project.createdByUserId !== session.userId) {
             return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
    }

    const { moderationStatus, ...rest } = project;
    return NextResponse.json({ item: { ...rest, status: moderationStatus }, canEdit });
}


export async function PATCH(
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
        select: { companyRole: true },
    });

    if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    const project = await prisma.project.findUnique({
        where: { id: params.projectId },
        select: { createdByUserId: true, moderationStatus: true, ownerCompanyId: true }
    });

    if (!project || project.ownerCompanyId !== params.companyId) {
        return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    
    const canEdit = project.createdByUserId === session.userId || isCompanyReviewer(membership.companyRole);

    if (!canEdit) {
        return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    if (project.moderationStatus !== ContentStatus.PENDING) {
        return NextResponse.json({ error: "Only pending proposals can be edited." }, { status: 400 });
    }

    const payload = (await request.json()) as ProjectUpdatePayload;

    const updatedProject = await prisma.project.update({
        where: {
            id: params.projectId,
        },
        data: {
            name: payload.name?.trim(),
            description: payload.description?.trim(),
            tags: parseTags(payload.tags),
        },
    });

    return NextResponse.json({ item: updatedProject });
}
