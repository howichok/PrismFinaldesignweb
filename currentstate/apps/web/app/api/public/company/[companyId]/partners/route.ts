import { NextResponse } from "next/server";
import { PartnershipStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export async function GET(
  _request: Request,
  context: { params: any },
) {
  const params = context.params;
  const partnerships = await prisma.partnership.findMany({
    where: {
      status: PartnershipStatus.ACTIVE,
      OR: [
        { companyAId: params.companyId },
        { companyBId: params.companyId },
      ],
    },
    select: {
      companyA: { select: { id: true, name: true, logoUrl: true } },
      companyB: { select: { id: true, name: true, logoUrl: true } },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const response = NextResponse.json({
    items: partnerships.map((partnership) =>
      partnership.companyA.id === params.companyId
        ? partnership.companyB
        : partnership.companyA,
    ),
  });
  response.headers.set(
    "Cache-Control",
    "public, max-age=60, stale-while-revalidate=60",
  );
  return response;
}
