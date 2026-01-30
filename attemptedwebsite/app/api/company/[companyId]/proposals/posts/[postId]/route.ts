import { NextResponse } from "next/server";
import { ContentStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { isCompanyReviewer } from "@/lib/company/roles";

type PostUpdatePayload = {
    title?: string;
    content?: string;
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
  context: { params: { companyId: string; postId: string } },
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

    const post = await prisma.post.findFirst({
        where: {
            id: params.postId,
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

    if (!post) {
        return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const canEdit = post.createdByUserId === session.userId || isCompanyReviewer(membership.companyRole);
    if (post.status !== ContentStatus.PENDING && !isCompanyReviewer(membership.companyRole)) {
        // If not pending, only reviewers should be able to see it via this endpoint.
        // Members who authored it can see rejected ones.
        if (post.status !== ContentStatus.REJECTED || post.createdByUserId !== session.userId) {
             return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
    }


    return NextResponse.json({ item: post, canEdit });
}


export async function PATCH(
  request: Request,
  context: { params: { companyId: string; postId: string } },
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
    
    const post = await prisma.post.findUnique({
        where: { id: params.postId },
        select: { createdByUserId: true, status: true, ownerCompanyId: true }
    });

    if (!post || post.ownerCompanyId !== params.companyId) {
        return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    
    const canEdit = post.createdByUserId === session.userId || isCompanyReviewer(membership.companyRole);

    if (!canEdit) {
        return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    if (post.status !== ContentStatus.PENDING) {
        return NextResponse.json({ error: "Only pending proposals can be edited." }, { status: 400 });
    }

    const payload = (await request.json()) as PostUpdatePayload;

    const updatedPost = await prisma.post.update({
        where: {
            id: params.postId,
        },
        data: {
            title: payload.title?.trim(),
            content: payload.content?.trim(),
            tags: parseTags(payload.tags),
        },
    });

    return NextResponse.json({ item: updatedPost });
}
