import { NextResponse } from "next/server";
import { NotificationType } from "@prisma/client";

import { requireAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { logInfo } from "@/lib/security/logger";
import { getRequestId } from "@/lib/security/request";

export async function POST(
  request: Request,
  context: { params: { userId: string } },
) {
  const params = context.params;
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const updated = await prisma.user.update({
    where: { id: params.userId },
    data: {
      rolesVersion: { increment: 1 },
    },
    select: {
      id: true,
      rolesVersion: true,
    },
  });

  await prisma.$transaction([
    prisma.auditLog.create({
      data: {
        actorUserId: auth.session!.userId,
        actionType: "ADMIN_USER_BUMP_ROLES",
        targetType: "USER",
        targetId: params.userId,
      },
    }),
    prisma.notification.create({
      data: {
        userId: params.userId,
        type: NotificationType.ADMIN,
        title: "Account updated",
        body: "Your session permissions were refreshed by an administrator.",
        link: "/dashboard/settings",
      },
    }),
  ]);

  logInfo("admin_user_bump_roles", {
    requestId: getRequestId(request),
    actorUserId: auth.session!.userId,
    targetUserId: params.userId,
  });

  return NextResponse.json({ item: updated });
}
