import { NextResponse } from "next/server";
import { OwnerType } from "@prisma/client";

import { requireModOrAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _request: Request,
  context: { params: any },
) {
  const params = context.params;
  const auth = await requireModOrAdmin();
  if (auth.response) return auth.response;

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      displayName: true,
      discordId: true,
      avatarUrl: true,
      siteRole: true,
      status: true,
      rolesVersion: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const [posts, projects, companies, updates, memberships, tickets] =
    await Promise.all([
      prisma.post.findMany({
        where: {
          ownerType: OwnerType.USER,
          ownerUserId: params.userId,
        },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
          publishedAt: true,
          isHidden: true,
        },
      }),
      prisma.project.findMany({
        where: {
          ownerType: OwnerType.USER,
          ownerUserId: params.userId,
        },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          moderationStatus: true,
          updatedAt: true,
          publishedAt: true,
          isHidden: true,
        },
      }),
      prisma.company.findMany({
        where: {
          createdByUserId: params.userId,
        },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          visibilityStatus: true,
          updatedAt: true,
          publishedAt: true,
          isHidden: true,
        },
      }),
      prisma.projectUpdate.findMany({
        where: {
          createdByUserId: params.userId,
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          publishedAt: true,
          isHidden: true,
          project: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.companyMembership.findMany({
        where: { userId: params.userId },
        select: {
          companyRole: true,
          company: {
            select: { id: true, name: true, logoUrl: true },
          },
        },
      }),
      prisma.ticket.findMany({
        where: { createdByUserId: params.userId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          subject: true,
          status: true,
          updatedAt: true,
        },
      }),
    ]);

  return NextResponse.json({
    viewerRole: auth.session?.siteRole,
    user: {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    posts: posts.map((post) => ({
      ...post,
      updatedAt: post.updatedAt.toISOString(),
      publishedAt: post.publishedAt?.toISOString() ?? null,
    })),
    projects: projects.map((project) => ({
      ...project,
      updatedAt: project.updatedAt.toISOString(),
      publishedAt: project.publishedAt?.toISOString() ?? null,
    })),
    companies: companies.map((company) => ({
      ...company,
      updatedAt: company.updatedAt.toISOString(),
      publishedAt: company.publishedAt?.toISOString() ?? null,
    })),
    updates: updates.map((update) => ({
      ...update,
      createdAt: update.createdAt.toISOString(),
      publishedAt: update.publishedAt?.toISOString() ?? null,
    })),
    memberships,
    tickets: tickets.map((ticket) => ({
      ...ticket,
      updatedAt: ticket.updatedAt.toISOString(),
    })),
  });
}
