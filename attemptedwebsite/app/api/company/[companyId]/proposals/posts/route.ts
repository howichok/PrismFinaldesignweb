import { NextResponse } from "next/server";
import { CompanyRole, ContentStatus, NotificationType, OwnerType } from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { apiError, rateLimitError } from "@/lib/api/errors";
import {
  buildRateLimitKey,
  rateLimit,
} from "@/lib/security/rateLimit";
import { parseBody } from "@/lib/validation/request";
import { postCreateSchema } from "@/lib/validation/schemas";

function parseTags(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function POST(
  request: Request,
  context: { params: { companyId: string } },
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
      company: {
        select: {
          name: true,
        },
      }
    },
  });

  // For now, only members can create proposals.
  // In the future, we might allow Trusted+ to create proposals too.
  if (!membership || membership.companyRole !== CompanyRole.MEMBER) {
    return apiError(
      403,
      "FORBIDDEN",
      "Only members can create proposals.",
    );
  }

  const rate = await rateLimit({
    key: buildRateLimitKey([
      "proposal",
      "post",
      params.companyId,
      session.userId,
    ]),
    limit: 20,
    windowSeconds: 3600,
  });
  if (!rate.allowed) {
    return rateLimitError(rate.retryAfter);
  }

  const { data, error } = await parseBody(request, postCreateSchema);
  if (error) return error;

  const post = await prisma.post.create({
    data: {
      title: data.title,
      content: data.content,
      tags: parseTags(data.tags),
      ownerType: OwnerType.COMPANY,
      ownerCompanyId: params.companyId,
      createdByUserId: session.userId,
      status: ContentStatus.PENDING,
      rejectionReason: null,
      publishedAt: null,
    },
    select: {
      id: true,
      title: true,
      status: true,
    },
  });

  // Notify reviewers
  const reviewers = await prisma.companyMembership.findMany({
      where: {
          companyId: params.companyId,
          companyRole: {
              in: [CompanyRole.OWNER, CompanyRole.CO_OWNER, CompanyRole.TRUSTED],
          },
      },
      select: {
          userId: true,
      }
  });

  const notificationTitle = `New post proposal in ${membership.company.name}`;
  const notificationLink = `/company/${params.companyId}/hub/proposals/posts/${post.id}`;

  if (reviewers.length > 0) {
    await prisma.notification.createMany({
      data: reviewers.map((reviewer) => ({
        userId: reviewer.userId,
        type: NotificationType.SYSTEM,
        title: notificationTitle,
        body: `A new post proposal "${post.title}" has been submitted for review.`,
        link: notificationLink,
      })),
    });
  }


  return NextResponse.json({ item: post }, { status: 201 });
}
