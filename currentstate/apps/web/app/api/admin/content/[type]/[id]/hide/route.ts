import { NextResponse } from "next/server";

import { requireModOrAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { logInfo } from "@/lib/security/logger";
import { getRequestId } from "@/lib/security/request";

async function setHidden(type: string, id: string, hidden: boolean) {
  switch (type) {
    case "posts":
      return prisma.post.update({
        where: { id },
        data: { isHidden: hidden },
        select: { id: true },
      });
    case "projects":
      return prisma.project.update({
        where: { id },
        data: { isHidden: hidden },
        select: { id: true },
      });
    case "companies":
      return prisma.company.update({
        where: { id },
        data: { isHidden: hidden },
        select: { id: true },
      });
    case "updates":
      return prisma.projectUpdate.update({
        where: { id },
        data: { isHidden: hidden },
        select: { id: true },
      });
    default:
      throw new Error("INVALID_TYPE");
  }
}

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
  context: { params: any },
) {
  const params = context.params;
  const auth = await requireModOrAdmin();
  if (auth.response) return auth.response;

  try {
    const updated = await setHidden(params.type, params.id, true);
    await prisma.auditLog.create({
      data: {
        actorUserId: auth.session!.userId,
        actionType: "ADMIN_CONTENT_HIDE",
        targetType: targetTypeFor(params.type),
        targetId: updated.id,
      },
    });
    logInfo("admin_content_hide", {
      requestId: getRequestId(request),
      actorUserId: auth.session!.userId,
      targetType: targetTypeFor(params.type),
      targetId: updated.id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_TYPE") {
      return NextResponse.json({ error: "Invalid type." }, { status: 400 });
    }
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
