import { NextResponse } from "next/server";
import { NotificationType, UserStatus } from "@prisma/client";

import { requireAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { parseBody } from "@/lib/validation/request";
import { adminStatusSchema } from "@/lib/validation/schemas";
import { logInfo } from "@/lib/security/logger";
import { getRequestId } from "@/lib/security/request";

export async function POST(
  request: Request,
  context: { params: { userId: string } },
) {
  const params = context.params;
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { data, error } = await parseBody(request, adminStatusSchema);
  if (error) return error;
  const nextStatus = data.status.toUpperCase();

  const updated = await prisma.user.update({
    where: { id: params.userId },
    data: {
      status: nextStatus as UserStatus,
      rolesVersion: { increment: 1 },
    },
    select: {
      id: true,
      status: true,
      rolesVersion: true,
    },
  });

  await prisma.$transaction([
    prisma.auditLog.create({
      data: {
        actorUserId: auth.session!.userId,
        actionType: "ADMIN_USER_STATUS_UPDATE",
        targetType: "USER",
        targetId: params.userId,
        meta: {
          status: updated.status,
        },
      },
    }),
    prisma.notification.create({
      data: {
        userId: params.userId,
        type: NotificationType.ADMIN,
        title: "Account updated",
        body: "Your account status was updated by an administrator.",
        link: "/dashboard/settings",
      },
    }),
  ]);

  logInfo("admin_user_status_update", {
    requestId: getRequestId(request),
    actorUserId: auth.session!.userId,
    targetUserId: params.userId,
    status: updated.status,
  });

  return NextResponse.json({ item: updated });
}
