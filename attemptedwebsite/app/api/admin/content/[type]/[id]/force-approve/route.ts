import { NextResponse } from "next/server";
import { ContentStatus, UpdateStatus } from "@prisma/client";

import { requireAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { logInfo } from "@/lib/security/logger";
import { getRequestId } from "@/lib/security/request";

function targetTypeFor(type: string) {
  switch (type) {
    case "posts":
      return "POST";
    case "projects":
      return "PROJECT";
    case "companies":
      return "COMPANY";
    case "updates":
      return "UPDATE";
    default:
      return "UNKNOWN";
  }
}

export async function POST(
  request: Request,
  context: { params: { type: string; id: string } },
) {
  const params = context.params;
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const now = new Date();

  try {
    let updatedId = params.id;

    if (params.type === "posts") {
      const post = await prisma.post.update({
        where: { id: params.id },
        data: {
          status: ContentStatus.APPROVED,
          publishedAt: now,
          rejectionReason: null,
          isHidden: false,
        },
        select: { id: true },
      });
      updatedId = post.id;
    } else if (params.type === "projects") {
      const project = await prisma.project.update({
        where: { id: params.id },
        data: {
          moderationStatus: ContentStatus.APPROVED,
          publishedAt: now,
          rejectionReason: null,
          isHidden: false,
        },
        select: { id: true },
      });
      updatedId = project.id;
    } else if (params.type === "companies") {
      const company = await prisma.company.update({
        where: { id: params.id },
        data: {
          visibilityStatus: ContentStatus.APPROVED,
          publishedAt: now,
          rejectionReason: null,
          isHidden: false,
        },
        select: { id: true },
      });
      updatedId = company.id;
    } else if (params.type === "updates") {
      const update = await prisma.projectUpdate.update({
        where: { id: params.id },
        data: {
          status: UpdateStatus.PUBLISHED,
          publishedAt: now,
          rejectionReason: null,
          isHidden: false,
        },
        select: { id: true },
      });
      updatedId = update.id;
    } else {
      return NextResponse.json({ error: "Invalid type." }, { status: 400 });
    }

    await prisma.auditLog.create({
      data: {
        actorUserId: auth.session!.userId,
        actionType: "ADMIN_CONTENT_FORCE_APPROVE",
        targetType: targetTypeFor(params.type),
        targetId: updatedId,
      },
    });
    logInfo("admin_content_force_approve", {
      requestId: getRequestId(request),
      actorUserId: auth.session!.userId,
      targetType: targetTypeFor(params.type),
      targetId: updatedId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
