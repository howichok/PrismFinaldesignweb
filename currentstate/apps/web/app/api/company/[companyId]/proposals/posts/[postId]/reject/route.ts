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

  // 1. Check membership and reviewer role
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

  // 2. Find the post, check status and ownership
  const post = await prisma.post.findUnique({
      where: { id: params.postId },
      select: { 
          ownerCompanyId: true, 
          status: true,
          createdByUserId: true,
          title: true,
        }
  });

  if (!post || post.ownerCompanyId !== params.companyId) {
      return NextResponse.json({ error: "Post not found or doesn't belong to this company." }, { status: 404 });
  }

  if (post.status !== ContentStatus.PENDING) {
      return NextResponse.json({ error: "This proposal is not pending and cannot be rejected." }, { status: 400 });
  }

  // 3. Parse reason from body
  const payload = (await request.json()) as RejectPayload;
  const reason = payload.reason?.trim();

  if (!reason) {
      return NextResponse.json({ error: "A reason for rejection is required." }, { status: 400 });
  }

  // 4. Update post status
  const updatedPost = await prisma.post.update({
      where: { id: params.postId },
      data: {
          status: ContentStatus.REJECTED,
          rejectionReason: reason,
      }
  });

  // 5. Notify author
  if(post.createdByUserId) {
    await prisma.notification.create({
        data: {
            userId: post.createdByUserId,
            type: NotificationType.SYSTEM,
            title: "Your post proposal was rejected",
            body: `Your proposal "${post.title}" was rejected. Reason: ${reason}`,
            link: `/company/${params.companyId}/hub/proposals/posts/${params.postId}`,
        }
    });
  }

  return NextResponse.json({ item: updatedPost });
}
