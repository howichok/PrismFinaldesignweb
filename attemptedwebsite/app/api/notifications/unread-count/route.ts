import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const unreadCount = await prisma.notification.count({
    where: {
      userId: auth.session!.userId,
      isRead: false,
    },
  });

  return NextResponse.json({ unreadCount });
}
