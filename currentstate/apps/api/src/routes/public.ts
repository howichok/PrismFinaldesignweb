import { Router } from "express";
import { prisma } from "@prismmtr/db";
import { z } from "zod";
import { userMiniSelect, toUserMini } from "../utils/serializers.js";

const router = Router();

// ============================================
// Query Schemas
// ============================================

const PublicProjectsQuery = z.object({
  q: z.string().optional(),
  owner: z.enum(["personal", "company", "all"]).optional(),
  companyId: z.string().optional(),
  sort: z.enum(["new", "popular"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20)
});

const PublicPostsQuery = z.object({
  q: z.string().optional(),
  companyId: z.string().optional(),
  sort: z.enum(["new", "popular"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20)
});

const PublicCompaniesQuery = z.object({
  q: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20)
});

// ============================================
// Helpers
// ============================================

const ownerCompanySelect = {
  id: true,
  name: true,
  slug: true
} as const;

function normalizeQuery(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function formatPublicProject(project: any) {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    type: project.type,
    ownership: project.ownership,
    status: project.status,
    authorId: project.authorId,
    ownerUserId: project.ownerUserId ?? null,
    ownerCompanyId: project.ownerCompanyId ?? null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    author: toUserMini(project.author),
    ownerCompany: project.ownerCompany
      ? {
        id: project.ownerCompany.id,
        name: project.ownerCompany.name,
        slug: project.ownerCompany.slug
      }
      : null
  };
}

function formatPublicPost(post: any) {
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    ownership: post.ownership,
    status: post.status,
    authorId: post.authorId,
    ownerUserId: post.ownerUserId ?? null,
    ownerCompanyId: post.ownerCompanyId ?? null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    author: toUserMini(post.author),
    ownerCompany: post.ownerCompany
      ? {
        id: post.ownerCompany.id,
        name: post.ownerCompany.name,
        slug: post.ownerCompany.slug
      }
      : null
  };
}

// ============================================
// Projects
// ============================================

/**
 * GET /public/projects/:id
 * Get a published project (public access)
 */
router.get("/projects/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const project = await prisma.project.findFirst({
      where: {
        id,
        status: "PUBLISHED"
      },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        ownership: true,
        status: true,
        authorId: true,
        ownerUserId: true,
        ownerCompanyId: true,
        createdAt: true,
        updatedAt: true,
        author: { select: userMiniSelect },
        ownerCompany: { select: ownerCompanySelect }
      }
    });

    if (!project) {
      res.status(404).json({ error: "Project not found", code: "NOT_FOUND" });
      return;
    }

    res.json(formatPublicProject(project));
  } catch (err) {
    console.error("Failed to get project:", err);
    res.status(500).json({ error: "Failed to get project" });
  }
});

/**
 * GET /public/projects
 * List all published projects (public access)
 */
router.get("/projects", async (req, res) => {
  const parsed = PublicProjectsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(422).json({
      error: "Invalid query parameters",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const { cursor, limit } = parsed.data;
  const q = normalizeQuery(parsed.data.q);
  const owner = parsed.data.owner ?? "all";
  const companyId = normalizeQuery(parsed.data.companyId);

  try {
    const where: any = { status: "PUBLISHED" };

    if (companyId) {
      where.ownerCompanyId = companyId;
      where.ownership = "COMPANY";
    } else if (owner === "personal") {
      where.ownership = "PERSONAL";
    } else if (owner === "company") {
      where.ownership = "COMPANY";
    }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } }
      ];
    }

    const projects = await prisma.project.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        ownership: true,
        status: true,
        authorId: true,
        ownerUserId: true,
        ownerCompanyId: true,
        createdAt: true,
        updatedAt: true,
        author: { select: userMiniSelect },
        ownerCompany: { select: ownerCompanySelect }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    const hasMore = projects.length > limit;
    const items = hasMore ? projects.slice(0, -1) : projects;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    res.json({
      items: items.map(formatPublicProject),
      nextCursor
    });
  } catch (err) {
    console.error("Failed to get projects:", err);
    res.status(500).json({ error: "Failed to get projects" });
  }
});

// ============================================
// Posts
// ============================================

/**
 * GET /public/posts/:id
 * Get a published post (public access)
 */
router.get("/posts/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const post = await prisma.post.findFirst({
      where: {
        id,
        status: "PUBLISHED"
      },
      select: {
        id: true,
        title: true,
        body: true,
        ownership: true,
        status: true,
        authorId: true,
        ownerUserId: true,
        ownerCompanyId: true,
        createdAt: true,
        updatedAt: true,
        author: { select: userMiniSelect },
        ownerCompany: { select: ownerCompanySelect }
      }
    });

    if (!post) {
      res.status(404).json({ error: "Post not found", code: "NOT_FOUND" });
      return;
    }

    res.json(formatPublicPost(post));
  } catch (err) {
    console.error("Failed to get post:", err);
    res.status(500).json({ error: "Failed to get post" });
  }
});

/**
 * GET /public/posts
 * List all published posts (public access)
 */
router.get("/posts", async (req, res) => {
  const parsed = PublicPostsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(422).json({
      error: "Invalid query parameters",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const { cursor, limit } = parsed.data;
  const q = normalizeQuery(parsed.data.q);
  const companyId = normalizeQuery(parsed.data.companyId);

  try {
    const where: any = { status: "PUBLISHED" };

    if (companyId) {
      where.ownerCompanyId = companyId;
      where.ownership = "COMPANY";
    }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { body: { contains: q, mode: "insensitive" } }
      ];
    }

    const posts = await prisma.post.findMany({
      where,
      select: {
        id: true,
        title: true,
        body: true,
        ownership: true,
        status: true,
        authorId: true,
        ownerUserId: true,
        ownerCompanyId: true,
        createdAt: true,
        updatedAt: true,
        author: { select: userMiniSelect },
        ownerCompany: { select: ownerCompanySelect }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, -1) : posts;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    res.json({
      items: items.map(formatPublicPost),
      nextCursor
    });
  } catch (err) {
    console.error("Failed to get posts:", err);
    res.status(500).json({ error: "Failed to get posts" });
  }
});

// ============================================
// Companies
// ============================================

/**
 * GET /public/companies
 * List public companies for discovery (public access)
 */
router.get("/companies", async (req, res) => {
  const parsed = PublicCompaniesQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(422).json({
      error: "Invalid query parameters",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const { cursor, limit } = parsed.data;
  const q = normalizeQuery(parsed.data.q);

  try {
    const where: any = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { id: q }
      ];
    }

    const companies = await prisma.company.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: { select: { members: true } }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    const hasMore = companies.length > limit;
    const items = hasMore ? companies.slice(0, -1) : companies;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    const companyIds = items.map((company) => company.id);
    const [projectCounts, postCounts] = await Promise.all([
      companyIds.length
        ? prisma.project.groupBy({
          by: ["ownerCompanyId"],
          where: {
            status: "PUBLISHED",
            ownerCompanyId: { in: companyIds }
          },
          _count: { _all: true }
        })
        : Promise.resolve([]),
      companyIds.length
        ? prisma.post.groupBy({
          by: ["ownerCompanyId"],
          where: {
            status: "PUBLISHED",
            ownerCompanyId: { in: companyIds }
          },
          _count: { _all: true }
        })
        : Promise.resolve([])
    ]);

    const projectCountMap = new Map<string, number>();
    for (const entry of projectCounts) {
      if (entry.ownerCompanyId) {
        projectCountMap.set(entry.ownerCompanyId, entry._count._all);
      }
    }

    const postCountMap = new Map<string, number>();
    for (const entry of postCounts) {
      if (entry.ownerCompanyId) {
        postCountMap.set(entry.ownerCompanyId, entry._count._all);
      }
    }

    res.json({
      items: items.map((company) => ({
        id: company.id,
        name: company.name,
        slug: company.slug,
        avatar: null,
        memberCount: company._count.members,
        publishedProjectsCount: projectCountMap.get(company.id) ?? 0,
        publishedPostsCount: postCountMap.get(company.id) ?? 0
      })),
      nextCursor
    });
  } catch (err) {
    console.error("Failed to list companies:", err);
    res.status(500).json({ error: "Failed to list companies" });
  }
});

/**
 * GET /public/companies/:slug
 * Get public company bundle for discovery pages
 */
router.get("/companies/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    const company = await prisma.company.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        createdAt: true,
        publishingMode: true
      }
    });

    if (!company) {
      res.status(404).json({ error: "Company not found", code: "NOT_FOUND" });
      return;
    }

    const [memberCount, publishedProjectsCount, publishedPostsCount, latestProjects, latestPosts] =
      await Promise.all([
        prisma.companyMember.count({ where: { companyId: company.id } }),
        prisma.project.count({
          where: { status: "PUBLISHED", ownerCompanyId: company.id }
        }),
        prisma.post.count({
          where: { status: "PUBLISHED", ownerCompanyId: company.id }
        }),
        prisma.project.findMany({
          where: { status: "PUBLISHED", ownerCompanyId: company.id },
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            ownership: true,
            status: true,
            authorId: true,
            ownerUserId: true,
            ownerCompanyId: true,
            createdAt: true,
            updatedAt: true,
            author: { select: userMiniSelect },
            ownerCompany: { select: ownerCompanySelect }
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 6
        }),
        prisma.post.findMany({
          where: { status: "PUBLISHED", ownerCompanyId: company.id },
          select: {
            id: true,
            title: true,
            body: true,
            ownership: true,
            status: true,
            authorId: true,
            ownerUserId: true,
            ownerCompanyId: true,
            createdAt: true,
            updatedAt: true,
            author: { select: userMiniSelect },
            ownerCompany: { select: ownerCompanySelect }
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 6
        })
      ]);

    res.json({
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        description: company.description,
        createdAt: company.createdAt.toISOString(),
        memberCount,
        publishingMode: company.publishingMode
      },
      featured: {
        latestProjects: latestProjects.map(formatPublicProject),
        latestPosts: latestPosts.map(formatPublicPost)
      },
      stats: {
        memberCount,
        publishedProjects: publishedProjectsCount,
        publishedPosts: publishedPostsCount
      }
    });
  } catch (err) {
    console.error("Failed to get company bundle:", err);
    res.status(500).json({ error: "Failed to get company bundle" });
  }
});

export default router;
