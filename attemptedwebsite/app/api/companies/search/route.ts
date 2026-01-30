import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: Request) {
  const { response } = await requireAuth();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const companies = await prisma.company.findMany({
    where: {
      name: {
        contains: query,
        mode: "insensitive",
      },
    },
    orderBy: {
      name: "asc",
    },
    take: 10,
    select: {
      id: true,
      name: true,
      logoUrl: true,
      description: true,
    },
  });

  return NextResponse.json({ items: companies });
}
