import { NextResponse } from "next/server";
import {
  ContentStatus,
  OwnerType,
  ProjectUpdateType,
  UpdateImportance,
  UpdateStatus,
} from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { checkMajorUpdateLimit, majorLimitMessage } from "@/lib/projects/updates";
import { apiError } from "@/lib/api/errors";
import { parseBody } from "@/lib/validation/request";
import { updateCreateSchema } from "@/lib/validation/schemas";

function normalizeStatus(value?: string | null) {
  const normalized = value?.toUpperCase();
  const allowed = new Set(["PUBLISHED", "PENDING", "REJECTED"]);
  if (!normalized || normalized === "ALL" || !allowed.has(normalized)) {
    return undefined;
  }
  return normalized as UpdateStatus;
}

export async function GET(
  request: Request,
  context: { params: any },
) {
  const params = context.params;
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await prisma.project.findFirst({
    where: {
      id: params.projectId,
      ownerType: OwnerType.USER,
      ownerUserId: session.userId,
    },
    select: {
      id: true,
      moderationStatus: true,
    },
  });

  if (!project) {
    return apiError(404, "NOT_FOUND", "Project not found.");
  }

  if (project.moderationStatus !== ContentStatus.APPROVED) {
    return apiError(
      403,
      "FORBIDDEN",
      "Updates are available after the project is published.",
    );
  }

  const { searchParams } = new URL(request.url);
  const status = normalizeStatus(searchParams.get("status"));

  const updates = await prisma.projectUpdate.findMany({
    where: {
      projectId: params.projectId,
      ...(status ? { status } : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      title: true,
      summary: true,
      details: true,
      updateType: true,
      importance: true,
      status: true,
      rejectionReason: true,
      createdAt: true,
      publishedAt: true,
    },
  });

  return NextResponse.json({ items: updates });
}

export async function POST(
  request: Request,
  context: { params: any },
) {
  const params = context.params;
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await prisma.project.findFirst({
    where: {
      id: params.projectId,
      ownerType: OwnerType.USER,
      ownerUserId: session.userId,
    },
    select: {
      id: true,
      moderationStatus: true,
    },
  });

  if (!project) {
    return apiError(404, "NOT_FOUND", "Project not found.");
  }

  if (project.moderationStatus !== ContentStatus.APPROVED) {
    return apiError(
      403,
      "FORBIDDEN",
      "Publish the project before posting updates.",
    );
  }

  const { data, error } = await parseBody(request, updateCreateSchema);
  if (error) return error;

  if (data.importance === UpdateImportance.MAJOR) {
    const limit = await checkMajorUpdateLimit({ projectId: project.id });
    if (!limit.allowed) {
      return apiError(409, "LIMIT_REACHED", majorLimitMessage);
    }
  }

  const update = await prisma.projectUpdate.create({
    data: {
      projectId: project.id,
      title: data.title,
      summary: data.summary,
      details: data.details || null,
      updateType: data.updateType,
      importance: data.importance,
      status: UpdateStatus.PUBLISHED,
      createdByUserId: session.userId,
      publishedAt: new Date(),
      rejectionReason: null,
      reviewedByUserId: null,
      reviewedAt: null,
    },
    select: {
      id: true,
      title: true,
      summary: true,
      details: true,
      updateType: true,
      importance: true,
      status: true,
      rejectionReason: true,
      createdAt: true,
      publishedAt: true,
    },
  });

  return NextResponse.json({ item: update }, { status: 201 });
}
