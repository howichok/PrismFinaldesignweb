import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { parseBody } from "@/lib/validation/request";
import { notificationMarkReadSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const { data, error } = await parseBody(
    request,
    notificationMarkReadSchema,
  );
  if (error) return error;

  await prisma.notification.updateMany({
    where: {
      id: { in: data.ids },
      userId: auth.session!.userId,
    },
    data: {
      isRead: true,
    },
  });

  return NextResponse.json({ ok: true });
}
