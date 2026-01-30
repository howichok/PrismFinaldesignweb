import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const users = await prisma.user.findMany({
    where: {
      displayName: {
        contains: query,
        mode: "insensitive",
      },
      id: { not: session.userId },
    },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
    },
    take: 10,
  });

  return NextResponse.json({ items: users });
}
