import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";

export async function GET(
  _request: Request,
  context: { params: { projectId: string } },
) {
  const params = context.params;
  const collaborators = await prisma.projectCollaboratorCompany.findMany({
    where: {
      projectId: params.projectId,
    },
    orderBy: {
      addedAt: "desc",
    },
    select: {
      company: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
        },
      },
    },
  });

  const response = NextResponse.json({
    items: collaborators.map((item) => item.company),
  });
  response.headers.set(
    "Cache-Control",
    "public, max-age=60, stale-while-revalidate=60",
  );
  return response;
}
