import { NextResponse } from "next/server";
import { ContentStatus, OwnerType } from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { isCompanyEditor } from "@/lib/company/roles";
import { apiError } from "@/lib/api/errors";
import { parseBody } from "@/lib/validation/request";
import { postUpdateSchema } from "@/lib/validation/schemas";

function parseTags(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function GET(
  _request: Request,
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

  if (!membership) {
    return apiError(403, "FORBIDDEN", "Forbidden");
  }

  const post = await prisma.post.findFirst({
    where: {
      id: params.postId,
      ownerType: OwnerType.COMPANY,
      ownerCompanyId: params.companyId,
    },
    select: {
      id: true,
      title: true,
      content: true,
      tags: true,
      coverAsset: {
        select: {
          id: true,
          publicUrl: true,
        },
      },
      status: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  if (!post) {
    return apiError(404, "NOT_FOUND", "Post not found.");
  }

  return NextResponse.json({ item: post });
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
    select: {
      companyRole: true,
    },
  });

  if (!membership || !isCompanyEditor(membership.companyRole)) {
    return apiError(403, "FORBIDDEN", "Insufficient permissions.");
  }

  const { data, error } = await parseBody(request, postUpdateSchema);
  if (error) return error;

  const existing = await prisma.post.findFirst({
    where: {
      id: params.postId,
      ownerType: OwnerType.COMPANY,
      ownerCompanyId: params.companyId,
    },
    select: {
      id: true,
      status: true,
      publishedAt: true,
    },
  });

  if (!existing) {
    return apiError(404, "NOT_FOUND", "Post not found.");
  }

  const intent = data.intent ?? "save";
  let status: ContentStatus | undefined;
  let publishedAt: Date | null | undefined;

  if (intent === "publish") {
    status = ContentStatus.APPROVED;
    publishedAt = existing.publishedAt ?? new Date();
  } else if (intent === "draft") {
    status = ContentStatus.DRAFT;
    publishedAt = null;
  }

  const post = await prisma.post.update({
    where: { id: existing.id },
    data: {
      title: data.title,
      content: data.content,
      tags: parseTags(data.tags),
      ...(status ? { status } : {}),
      ...(publishedAt !== undefined ? { publishedAt } : {}),
      rejectionReason: null,
    },
    select: {
      id: true,
      title: true,
      content: true,
      tags: true,
      coverAsset: {
        select: {
          id: true,
          publicUrl: true,
        },
      },
      status: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  return NextResponse.json({ item: post });
}
