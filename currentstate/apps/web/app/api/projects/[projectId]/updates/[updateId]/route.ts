import { NextResponse } from "next/server";
import {
  ContentStatus,
  OwnerType,
  UpdateImportance,
  UpdateStatus,
} from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { checkMajorUpdateLimit, majorLimitMessage } from "@/lib/projects/updates";
import { apiError } from "@/lib/api/errors";
import { parseBody } from "@/lib/validation/request";
import { updateEditSchema } from "@/lib/validation/schemas";

async function getOwnedProject(
  projectId: string,
  userId: string,
) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      ownerType: OwnerType.USER,
      ownerUserId: userId,
    },
    select: {
      id: true,
      moderationStatus: true,
    },
  });
}

export async function GET(
  request: Request,
  context: { params: any },
) {
  const params = context.params;
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getOwnedProject(params.projectId, session.userId);
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

  const update = await prisma.projectUpdate.findFirst({
    where: {
      id: params.updateId,
      projectId: project.id,
      createdByUserId: session.userId,
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

  if (!update) {
    return apiError(404, "NOT_FOUND", "Update not found.");
  }

  return NextResponse.json({ item: update });
}

export async function PATCH(
  request: Request,
  context: { params: any },
) {
  const params = context.params;
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getOwnedProject(params.projectId, session.userId);
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

  const existing = await prisma.projectUpdate.findFirst({
    where: {
      id: params.updateId,
      projectId: project.id,
      createdByUserId: session.userId,
    },
    select: {
      id: true,
      status: true,
      title: true,
      summary: true,
      details: true,
      updateType: true,
      importance: true,
    },
  });

  if (!existing) {
    return apiError(404, "NOT_FOUND", "Update not found.");
  }

  if (
    existing.status !== UpdateStatus.PUBLISHED &&
    existing.status !== UpdateStatus.PENDING
  ) {
    return apiError(400, "INVALID_STATE", "This update cannot be edited.");
  }

  const { data, error } = await parseBody(request, updateEditSchema);
  if (error) return error;

  if (
    existing.status === UpdateStatus.PUBLISHED &&
    data.importance === UpdateImportance.MAJOR &&
    existing.importance !== UpdateImportance.MAJOR
  ) {
    const limit = await checkMajorUpdateLimit({
      projectId: project.id,
      excludeUpdateId: existing.id,
    });
    if (!limit.allowed) {
      return apiError(409, "LIMIT_REACHED", majorLimitMessage);
    }
  }

  const update = await prisma.projectUpdate.update({
    where: { id: existing.id },
    data: {
      title: data.title,
      summary: data.summary,
      details: data.details && data.details.length > 0 ? data.details : null,
      updateType: data.updateType,
      importance: data.importance,
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

  return NextResponse.json({ item: update });
}
