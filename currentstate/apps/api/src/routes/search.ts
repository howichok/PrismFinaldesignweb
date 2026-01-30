import { Router } from "express";
import { prisma } from "@prismmtr/db";
import { z } from "zod";
import { optionalAuthMiddleware } from "../middleware/auth.js";
import { toUserMini, userMiniSelect } from "../utils/serializers.js";

const router = Router();

const SearchQuery = z.object({
  q: z.string().optional(),
  types: z.string().optional(),
  limit: z.coerce.number().min(1).max(25).default(10)
});

function parseTypes(types?: string) {
  const normalized = types
    ?.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const list = normalized?.length ? normalized : ["user", "company", "project", "post"];
  const include = (type: string) => list.includes(type);

  return {
    users: include("user"),
    companies: include("company"),
    projects: include("project"),
    posts: include("post")
  };
}

router.get("/", optionalAuthMiddleware, async (req, res) => {
  const parsed = SearchQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(422).json({
      error: "Invalid query parameters",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const q = parsed.data.q?.trim();
  if (!q) {
    res.json({ users: [], companies: [], projects: [], posts: [] });
    return;
  }

  const { limit } = parsed.data;
  const requested = parseTypes(parsed.data.types);
  const userId = req.user?.id;

  try {
    let memberCompanyIds: string[] = [];
    if (userId && (requested.projects || requested.posts)) {
      const memberships = await prisma.companyMember.findMany({
        where: { userId },
        select: { companyId: true }
      });
      memberCompanyIds = memberships.map((m) => m.companyId);
    }

    const userPromise = requested.users && userId
      ? prisma.user.findMany({
        where: {
          username: { contains: q, mode: "insensitive" },
          isBanned: false
        },
        select: userMiniSelect,
        orderBy: { username: "asc" },
        take: limit
      })
      : Promise.resolve([]);

    const companyPromise = requested.companies
      ? prisma.company.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } }
          ]
        },
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
        take: limit
      })
      : Promise.resolve([]);

    const projectPromise = requested.projects
      ? prisma.project.findMany({
        where: {
          AND: [
            {
              OR: [
                { status: "PUBLISHED" },
                ...(userId ? [{ ownerUserId: userId }] : []),
                ...(memberCompanyIds.length > 0 ? [{ ownerCompanyId: { in: memberCompanyIds } }] : [])
              ]
            },
            {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } }
              ]
            }
          ]
        },
        select: {
          id: true,
          title: true,
          ownership: true,
          status: true,
          ownerCompanyId: true,
          author: { select: userMiniSelect },
          ownerCompany: {
            select: { id: true, name: true, slug: true }
          },
          updatedAt: true
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: limit
      })
      : Promise.resolve([]);

    const postPromise = requested.posts
      ? prisma.post.findMany({
        where: {
          AND: [
            {
              OR: [
                { status: "PUBLISHED" },
                ...(userId ? [{ ownerUserId: userId }] : []),
                ...(memberCompanyIds.length > 0 ? [{ ownerCompanyId: { in: memberCompanyIds } }] : [])
              ]
            },
            {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { body: { contains: q, mode: "insensitive" } }
              ]
            }
          ]
        },
        select: {
          id: true,
          title: true,
          ownership: true,
          status: true,
          ownerCompanyId: true,
          author: { select: userMiniSelect },
          ownerCompany: {
            select: { id: true, name: true, slug: true }
          },
          updatedAt: true
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: limit
      })
      : Promise.resolve([]);

    const [users, companies, projects, posts] = await Promise.all([
      userPromise,
      companyPromise,
      projectPromise,
      postPromise
    ]);

    res.json({
      users: users.map((user) => toUserMini(user)),
      companies,
      projects: projects.map((project) => ({
        id: project.id,
        title: project.title,
        ownerType: project.ownership,
        status: project.status,
        ownerCompanyId: project.ownerCompanyId ?? null,
        companySlug: project.ownerCompany?.slug ?? null,
        companyName: project.ownerCompany?.name ?? null,
        author: toUserMini(project.author)
      })),
      posts: posts.map((post) => ({
        id: post.id,
        title: post.title,
        ownerType: post.ownership,
        status: post.status,
        ownerCompanyId: post.ownerCompanyId ?? null,
        companySlug: post.ownerCompany?.slug ?? null,
        companyName: post.ownerCompany?.name ?? null,
        author: toUserMini(post.author)
      }))
    });
  } catch (err) {
    console.error("Failed to search:", err);
    res.status(500).json({ error: "Failed to search" });
  }
});

export default router;
