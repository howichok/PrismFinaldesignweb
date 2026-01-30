import { NextResponse } from "next/server";
import {
  ContentStatus,
  OwnerType,
  ProjectStatus,
} from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { isCompanyEditor } from "@/lib/company/roles";
import { apiError } from "@/lib/api/errors";
import { parseBody } from "@/lib/validation/request";
import { projectUpdateSchema } from "@/lib/validation/schemas";

function parseTags(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function GET(
  _request: Request,
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

  if (!membership) {
    return apiError(403, "FORBIDDEN", "Forbidden");
  }

  const project = await prisma.project.findFirst({
    where: {
      id: params.projectId,
      ownerType: OwnerType.COMPANY,
      ownerCompanyId: params.companyId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      tags: true,
      projectStatus: true,
      coverAsset: {
        select: {
          id: true,
          publicUrl: true,
        },
      },
      moderationStatus: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  if (!project) {
    return apiError(404, "NOT_FOUND", "Project not found.");
  }

  return NextResponse.json({ item: project });
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
    select: {
      companyRole: true,
    },
  });

  if (!membership || !isCompanyEditor(membership.companyRole)) {
    return apiError(403, "FORBIDDEN", "Insufficient permissions.");
  }

  const { data, error } = await parseBody(request, projectUpdateSchema);
  if (error) return error;

  const existing = await prisma.project.findFirst({
    where: {
      id: params.projectId,
      ownerType: OwnerType.COMPANY,
      ownerCompanyId: params.companyId,
    },
    select: {
      id: true,
      moderationStatus: true,
      publishedAt: true,
    },
  });

  if (!existing) {
    return apiError(404, "NOT_FOUND", "Project not found.");
  }

  const intent = data.intent ?? "save";
  let moderationStatus: ContentStatus | undefined;
  let publishedAt: Date | null | undefined;

  if (intent === "publish") {
    moderationStatus = ContentStatus.APPROVED;
    publishedAt = existing.publishedAt ?? new Date();
  } else if (intent === "draft") {
    moderationStatus = ContentStatus.DRAFT;
    publishedAt = null;
  }

  const project = await prisma.project.update({
    where: { id: existing.id },
    data: {
      name: data.name,
      description: data.description,
      tags: parseTags(data.tags),
      projectStatus: data.projectStatus as ProjectStatus,
      ...(moderationStatus ? { moderationStatus } : {}),
      ...(publishedAt !== undefined ? { publishedAt } : {}),
      rejectionReason: null,
    },
    select: {
      id: true,
      name: true,
      description: true,
      tags: true,
      projectStatus: true,
      coverAsset: {
        select: {
          id: true,
          publicUrl: true,
        },
      },
      moderationStatus: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  return NextResponse.json({ item: project });
}
