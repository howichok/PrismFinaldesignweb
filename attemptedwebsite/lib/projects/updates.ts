import { UpdateImportance, UpdateStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

const MAJOR_WINDOW_MS = 24 * 60 * 60 * 1000;

type MajorLimitCheck = {
  allowed: boolean;
  windowStart: Date;
};

export async function checkMajorUpdateLimit(params: {
  projectId: string;
  excludeUpdateId?: string;
}): Promise<MajorLimitCheck> {
  const windowStart = new Date(Date.now() - MAJOR_WINDOW_MS);

  const recent = await prisma.projectUpdate.findFirst({
    where: {
      projectId: params.projectId,
      importance: UpdateImportance.MAJOR,
      status: UpdateStatus.PUBLISHED,
      ...(params.excludeUpdateId ? { NOT: { id: params.excludeUpdateId } } : {}),
      OR: [
        { publishedAt: { gte: windowStart } },
        { publishedAt: null, createdAt: { gte: windowStart } },
      ],
    },
    select: { id: true },
  });

  return {
    allowed: !recent,
    windowStart,
  };
}

export const majorLimitMessage =
  "Major updates are limited to one per 24 hours for this project.";
