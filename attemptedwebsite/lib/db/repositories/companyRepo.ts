import { prisma } from "@/lib/db/prisma";

export async function getCompany(id: string) {
  return prisma.company.findUnique({
    where: { id },
    include: {
      memberships: true,
      owner: true,
    },
  });
}

export async function listCompanies() {
  return prisma.company.findMany({
    orderBy: { createdAt: "desc" },
  });
}
