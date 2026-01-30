import { prisma } from "@/lib/db/prisma";

export async function listPosts() {
  return prisma.post.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function listProjects() {
  return prisma.project.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function listCompanies() {
  return prisma.company.findMany({
    orderBy: { createdAt: "desc" },
  });
}
