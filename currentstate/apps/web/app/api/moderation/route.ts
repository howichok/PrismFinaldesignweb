import { NextRequest, NextResponse } from "next/server";
import {
  ModerationRequestStatus,
  ModerationTargetType,
  Prisma,
} from "@prisma/client";

import { requireModOrAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

const statusValues = new Set([
  "PENDING",
  "APPROVED",
  "REJECTED",
]);
const typeValues = new Set(["POST", "PROJECT", "COMPANY"]);

function parseLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(50, Math.floor(parsed));
}

function parsePage(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.floor(parsed);
}

export async function GET(request: NextRequest) {
  const auth = await requireModOrAdmin();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status")?.toUpperCase() ?? "PENDING";
  const typeParam = searchParams.get("type")?.toUpperCase();
  const searchParam = searchParams.get("search")?.trim() ?? "";
  const limit = parseLimit(searchParams.get("limit"));
  const page = parsePage(searchParams.get("page"));

  const status = statusValues.has(statusParam)
    ? (statusParam as ModerationRequestStatus)
    : ModerationRequestStatus.PENDING;

  const type = typeParam && typeValues.has(typeParam)
    ? (typeParam as ModerationTargetType)
    : undefined;

  let where: Prisma.ModerationRequestWhereInput =
  {
    status,
    ...(type ? { targetType: type } : {}),
  };

  if (searchParam.length >= 2) {
    const search = searchParam;
    const orFilters: Prisma.ModerationRequestWhereInput[] = [];

    if (!type || type === ModerationTargetType.POST) {
      const posts = await prisma.post.findMany({
        where: {
          title: { contains: search, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (posts.length) {
        orFilters.push({
          targetType: ModerationTargetType.POST,
          targetId: { in: posts.map((post) => post.id) },
        });
      }
    }

    if (!type || type === ModerationTargetType.PROJECT) {
      const projects = await prisma.project.findMany({
        where: {
          name: { contains: search, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (projects.length) {
        orFilters.push({
          targetType: ModerationTargetType.PROJECT,
          targetId: { in: projects.map((project) => project.id) },
        });
      }
    }

    if (!type || type === ModerationTargetType.COMPANY) {
      const companies = await prisma.company.findMany({
        where: {
          name: { contains: search, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (companies.length) {
        orFilters.push({
          targetType: ModerationTargetType.COMPANY,
          targetId: { in: companies.map((company) => company.id) },
        });
      }
    }

    if (orFilters.length === 0) {
      return NextResponse.json({
        items: [],
        nextPage: null,
        fetchedAt: new Date().toISOString(),
      });
    }

    where = {
      ...where,
      OR: orFilters,
    };
  }

  const requests = await prisma.moderationRequest.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    skip: (page - 1) * limit,
    select: {
      id: true,
      targetType: true,
      targetId: true,
      status: true,
      createdAt: true,
      submittedBy: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  const postIds = requests
    .filter((request) => request.targetType === "POST")
    .map((request) => request.targetId);
  const projectIds = requests
    .filter((request) => request.targetType === "PROJECT")
    .map((request) => request.targetId);
  const companyIds = requests
    .filter((request) => request.targetType === "COMPANY")
    .map((request) => request.targetId);

  const [posts, projects, companies] = await Promise.all([
    postIds.length
      ? prisma.post.findMany({
        where: { id: { in: postIds } },
        select: { id: true, title: true },
      })
      : Promise.resolve([]),
    projectIds.length
      ? prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, name: true },
      })
      : Promise.resolve([]),
    companyIds.length
      ? prisma.company.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, name: true },
      })
      : Promise.resolve([]),
  ]);

  const postMap = new Map(posts.map((post) => [post.id, post.title]));
  const projectMap = new Map(
    projects.map((project) => [project.id, project.name]),
  );
  const companyMap = new Map(
    companies.map((company) => [company.id, company.name]),
  );

  const items = requests.map((request) => {
    const targetTitle =
      request.targetType === "POST"
        ? postMap.get(request.targetId) ?? "Untitled post"
        : request.targetType === "PROJECT"
          ? projectMap.get(request.targetId) ?? "Untitled project"
          : companyMap.get(request.targetId) ?? "Untitled company";

    return {
      id: request.id,
      targetType: request.targetType,
      targetId: request.targetId,
      targetTitle,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      submittedBy: {
        id: request.submittedBy.id,
        displayName: request.submittedBy.displayName,
        avatarUrl: request.submittedBy.avatarUrl,
      },
    };
  });

  const nextPage = requests.length === limit ? page + 1 : null;

  return NextResponse.json({
    items,
    nextPage,
    fetchedAt: new Date().toISOString(),
  });
}
