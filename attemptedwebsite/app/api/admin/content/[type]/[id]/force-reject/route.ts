import { NextResponse } from "next/server";
import { ContentStatus, UpdateStatus } from "@prisma/client";

import { requireAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { logInfo } from "@/lib/security/logger";
import { getRequestId } from "@/lib/security/request";
import { parseBody } from "@/lib/validation/request";
import { rejectSchema } from "@/lib/validation/schemas";

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

  const { data, error } = await parseBody(request, rejectSchema);
  if (error) return error;
  const reason = data.reason;

  try {
    let updatedId = params.id;

    if (params.type === "posts") {
      const post = await prisma.post.update({
        where: { id: params.id },
        data: {
          status: ContentStatus.REJECTED,
          rejectionReason: reason,
          publishedAt: null,
        },
        select: { id: true },
      });
      updatedId = post.id;
    } else if (params.type === "projects") {
      const project = await prisma.project.update({
        where: { id: params.id },
        data: {
          moderationStatus: ContentStatus.REJECTED,
          rejectionReason: reason,
          publishedAt: null,
        },
        select: { id: true },
      });
      updatedId = project.id;
    } else if (params.type === "companies") {
      const company = await prisma.company.update({
        where: { id: params.id },
        data: {
          visibilityStatus: ContentStatus.REJECTED,
          rejectionReason: reason,
          publishedAt: null,
        },
        select: { id: true },
      });
      updatedId = company.id;
    } else if (params.type === "updates") {
      const update = await prisma.projectUpdate.update({
        where: { id: params.id },
        data: {
          status: UpdateStatus.REJECTED,
          rejectionReason: reason,
          publishedAt: null,
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
        actionType: "ADMIN_CONTENT_FORCE_REJECT",
        targetType: targetTypeFor(params.type),
        targetId: updatedId,
        meta: {
          reason,
        },
      },
    });
    logInfo("admin_content_force_reject", {
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
