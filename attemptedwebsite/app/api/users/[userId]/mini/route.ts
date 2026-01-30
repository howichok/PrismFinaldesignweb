import { NextResponse } from "next/server";
import { ContentStatus, OwnerType, UserStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { apiError } from "@/lib/api/errors";

export async function GET(
  _request: Request,
  context: { params: { userId: string } },
) {
  const params = context.params;
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      siteRole: true,
      status: true,
    },
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    return apiError(404, "NOT_FOUND", "User not found.");
  }

  const [companyCount, companies, posts, projects] = await Promise.all([
    prisma.companyMembership.count({
      where: {
        userId: user.id,
        company: {
          visibilityStatus: ContentStatus.APPROVED,
          isHidden: false,
        },
      },
    }),
    prisma.companyMembership.findMany({
      where: {
        userId: user.id,
        company: {
          visibilityStatus: ContentStatus.APPROVED,
          isHidden: false,
        },
      },
      orderBy: { joinedAt: "desc" },
      take: 3,
      select: {
        companyRole: true,
        company: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            logoAsset: { select: { publicUrl: true } },
          },
        },
      },
    }),
    prisma.post.findMany({
      where: {
        ownerType: OwnerType.USER,
        ownerUserId: user.id,
        status: ContentStatus.APPROVED,
        isHidden: false,
      },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        updatedAt: true,
      },
    }),
    prisma.project.findMany({
      where: {
        ownerType: OwnerType.USER,
        ownerUserId: user.id,
        moderationStatus: ContentStatus.APPROVED,
        isHidden: false,
      },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: {
        id: true,
        name: true,
        updatedAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    user: {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      siteRole: user.siteRole,
    },
    companyCount,
    companies: companies.map((membership) => ({
      id: membership.company.id,
      name: membership.company.name,
      logoUrl: membership.company.logoAsset?.publicUrl ?? membership.company.logoUrl,
      myRole: membership.companyRole,
    })),
    recent: {
      posts: posts.map((post) => ({
        id: post.id,
        title: post.title,
        updatedAt: post.updatedAt.toISOString(),
      })),
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        updatedAt: project.updatedAt.toISOString(),
      })),
    },
  });
}
