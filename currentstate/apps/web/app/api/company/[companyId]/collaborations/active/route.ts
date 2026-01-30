import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _request: Request,
  context: { params: any },
) {
  const params = context.params;
  const { session, response } = await requireAuth();
  if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await prisma.companyMembership.findUnique({
    where: {
      companyId_userId: {
        companyId: params.companyId,
        userId: session.userId,
      },
    },
    select: { id: true },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const collaborations = await prisma.projectCollaboratorCompany.findMany({
    where: {
      companyId: params.companyId,
    },
    orderBy: {
      addedAt: "desc",
    },
    select: {
      addedAt: true,
      project: {
        select: {
          id: true,
          name: true,
          ownerCompany: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    items: collaborations.map((item) => ({
      addedAt: item.addedAt.toISOString(),
      project: {
        id: item.project.id,
        name: item.project.name,
      },
      ownerCompany: item.project.ownerCompany,
    })),
  });
}
