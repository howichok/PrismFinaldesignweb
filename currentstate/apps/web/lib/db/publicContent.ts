import "server-only";

import { ContentStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type ProjectTeaser = {
  id: string;
  name: string;
  description: string;
  updatedAt: Date;
  ownerDisplay: string;
};

export async function getLatestApprovedProjects(limit = 6) {
  try {
    const projects = await prisma.project.findMany({
      where: {
        moderationStatus: ContentStatus.APPROVED,
        isHidden: false,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: limit,
      select: {
        id: true,
        name: true,
        description: true,
        updatedAt: true,
        ownerType: true,
        ownerUser: {
          select: {
            displayName: true,
          },
        },
        ownerCompany: {
          select: {
            name: true,
          },
        },
      },
    });

    const data: ProjectTeaser[] = projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      updatedAt: project.updatedAt,
      ownerDisplay:
        project.ownerType === "COMPANY"
          ? project.ownerCompany?.name ?? "Company"
          : project.ownerUser?.displayName ?? "User",
    }));

    return { data, error: false };
  } catch (error) {
    console.error("Failed to load approved projects", error);
    return { data: [] as ProjectTeaser[], error: true };
  }
}
