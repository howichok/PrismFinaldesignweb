import { NextResponse } from "next/server";
import { ModerationTargetType } from "@prisma/client";

import { requireModOrAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

type ModerationTarget =
  | {
      type: "POST";
      id: string;
      title: string;
      content: string;
      tags: string[];
      ownerType: "USER" | "COMPANY";
      ownerDisplay: string;
    }
  | {
      type: "PROJECT";
      id: string;
      name: string;
      description: string;
      tags: string[];
      projectStatus: "IN_PROGRESS" | "RELEASED" | "FROZEN";
      ownerType: "USER" | "COMPANY";
      ownerDisplay: string;
    }
  | {
      type: "COMPANY";
      id: string;
      name: string;
      description: string;
      categories: string[];
      logoUrl: string | null;
      ownerDisplay: string;
    };

export async function GET(
  request: Request,
  context: { params: any },
) {
  const params = context.params;
  const auth = await requireModOrAdmin();
  if (auth.response) return auth.response;

  const requestRecord = await prisma.moderationRequest.findUnique({
    where: { id: params.requestId },
    select: {
      id: true,
      targetType: true,
      targetId: true,
      status: true,
      reason: true,
      createdAt: true,
      reviewedAt: true,
      submittedBy: { select: { id: true, displayName: true, avatarUrl: true } },
      reviewedBy: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  });

  if (!requestRecord) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let target: ModerationTarget | null = null;

  if (requestRecord.targetType === ModerationTargetType.POST) {
    const post = await prisma.post.findUnique({
      where: { id: requestRecord.targetId },
      select: {
        id: true,
        title: true,
        content: true,
        tags: true,
        ownerType: true,
        ownerUser: { select: { displayName: true } },
        ownerCompany: { select: { name: true } },
      },
    });

    if (post) {
      target = {
        type: "POST",
        id: post.id,
        title: post.title,
        content: post.content,
        tags: post.tags,
        ownerType: post.ownerType,
        ownerDisplay:
          post.ownerType === "COMPANY"
            ? post.ownerCompany?.name ?? "Company"
            : post.ownerUser?.displayName ?? "User",
      };
    }
  } else if (requestRecord.targetType === ModerationTargetType.PROJECT) {
    const project = await prisma.project.findUnique({
      where: { id: requestRecord.targetId },
      select: {
        id: true,
        name: true,
        description: true,
        tags: true,
        projectStatus: true,
        ownerType: true,
        ownerUser: { select: { displayName: true } },
        ownerCompany: { select: { name: true } },
      },
    });

    if (project) {
      target = {
        type: "PROJECT",
        id: project.id,
        name: project.name,
        description: project.description,
        tags: project.tags,
        projectStatus: project.projectStatus,
        ownerType: project.ownerType,
        ownerDisplay:
          project.ownerType === "COMPANY"
            ? project.ownerCompany?.name ?? "Company"
            : project.ownerUser?.displayName ?? "User",
      };
    }
  } else if (requestRecord.targetType === ModerationTargetType.COMPANY) {
    const company = await prisma.company.findUnique({
      where: { id: requestRecord.targetId },
      select: {
        id: true,
        name: true,
        description: true,
        categories: true,
        logoUrl: true,
        owner: { select: { displayName: true } },
      },
    });

    if (company) {
      target = {
        type: "COMPANY",
        id: company.id,
        name: company.name,
        description: company.description,
        categories: company.categories,
        logoUrl: company.logoUrl,
        ownerDisplay: company.owner.displayName,
      };
    }
  }

  if (!target) {
    return NextResponse.json(
      { error: "Target not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    request: {
      id: requestRecord.id,
      status: requestRecord.status,
      targetType: requestRecord.targetType,
      createdAt: requestRecord.createdAt.toISOString(),
      reviewedAt: requestRecord.reviewedAt?.toISOString() ?? null,
      reason: requestRecord.reason,
      submittedBy: requestRecord.submittedBy,
      reviewedBy: requestRecord.reviewedBy,
    },
    target,
  });
}
