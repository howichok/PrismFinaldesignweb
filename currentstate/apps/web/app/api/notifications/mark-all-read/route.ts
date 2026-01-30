import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { rateLimitError } from "@/lib/api/errors";
import {
  buildRateLimitKey,
  rateLimit,
} from "@/lib/security/rateLimit";

export async function POST() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const rate = await rateLimit({
    key: buildRateLimitKey([
      "notifications",
      "mark-all-read",
      auth.session!.userId,
    ]),
    limit: 10,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return rateLimitError(rate.retryAfter);
  }

  await prisma.notification.updateMany({
    where: {
      userId: auth.session!.userId,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });

  return NextResponse.json({ ok: true });
}
