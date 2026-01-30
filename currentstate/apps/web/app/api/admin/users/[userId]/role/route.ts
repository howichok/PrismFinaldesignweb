import { NextResponse } from "next/server";
import { NotificationType, SiteRole } from "@prisma/client";

import { requireAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { parseBody } from "@/lib/validation/request";
import { adminRoleSchema } from "@/lib/validation/schemas";
import { logInfo } from "@/lib/security/logger";
import { getRequestId } from "@/lib/security/request";

export async function POST(
  request: Request,
  context: { params: any },
) {
  const params = context.params;
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { data, error } = await parseBody(request, adminRoleSchema);
  if (error) return error;
  const nextRole = data.siteRole.toUpperCase();

  const updated = await prisma.user.update({
    where: { id: params.userId },
    data: {
      siteRole: nextRole as SiteRole,
      rolesVersion: { increment: 1 },
    },
    select: {
      id: true,
      siteRole: true,
      rolesVersion: true,
    },
  });

  await prisma.$transaction([
    prisma.auditLog.create({
      data: {
        actorUserId: auth.session!.userId,
        actionType: "ADMIN_USER_ROLE_UPDATE",
        targetType: "USER",
        targetId: params.userId,
        meta: {
          siteRole: updated.siteRole,
        },
      },
    }),
    prisma.notification.create({
      data: {
        userId: params.userId,
        type: NotificationType.ADMIN,
        title: "Account updated",
        body: "Your role was updated by an administrator.",
        link: "/dashboard/settings",
      },
    }),
  ]);

  logInfo("admin_user_role_update", {
    requestId: getRequestId(request),
    actorUserId: auth.session!.userId,
    targetUserId: params.userId,
    siteRole: updated.siteRole,
  });

  return NextResponse.json({ item: updated });
}
