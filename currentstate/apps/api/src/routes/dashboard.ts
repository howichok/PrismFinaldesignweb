import { Router } from "express";
import { prisma } from "@prismmtr/db";
import { authMiddleware, requireUser } from "../middleware/auth.js";
import { ContentStatus } from "@prismmtr/shared";

const router = Router();

// All routes require authentication
router.use(authMiddleware, requireUser);

/**
 * GET /dashboard/drafts
 * Get user's draft and needs-changes content
 * Query: type=project|post (defaults to project)
 */
router.get("/drafts", async (req, res) => {
  const userId = req.user!.id;
  const type = req.query.type as string ?? "project";

  try {
    if (type === "post") {
      const posts = await prisma.post.findMany({
        where: {
          ownerUserId: userId,
          status: { in: ["DRAFT", "NEEDS_CHANGES"] }
        },
        include: {
          author: {
            select: { id: true, username: true, avatarUrl: true }
          },
          moderation: {
            select: {
              id: true,
              status: true,
              reason: true,
              checklistJson: true,
              decidedAt: true
            }
          }
        },
        orderBy: { updatedAt: "desc" }
      });

      res.json({
        items: posts.map(formatPost),
        total: posts.length
      });
    } else if (type === "project") {
      const projects = await prisma.project.findMany({
        where: {
          ownerUserId: userId,
          status: { in: ["DRAFT", "NEEDS_CHANGES"] }
        },
        include: {
          author: {
            select: { id: true, username: true, avatarUrl: true }
          },
          moderation: {
            select: {
              id: true,
              status: true,
              reason: true,
              checklistJson: true,
              decidedAt: true
            }
          }
        },
        orderBy: { updatedAt: "desc" }
      });

      res.json({
        items: projects.map(formatProject),
        total: projects.length
      });
    } else {
      res.status(400).json({ error: "Unsupported type", code: "INVALID_TYPE" });
    }
  } catch (err) {
    console.error("Failed to get drafts:", err);
    res.status(500).json({ error: "Failed to get drafts" });
  }
});

/**
 * GET /dashboard/submissions
 * Get user's submitted content (pending, needs-changes, rejected)
 * Query: type=project|post (defaults to project), status=PENDING|NEEDS_CHANGES|REJECTED
 */
router.get("/submissions", async (req, res) => {
  const userId = req.user!.id;
  const type = req.query.type as string ?? "project";
  const status = req.query.status as ContentStatus | undefined;

  const statusFilter: ContentStatus[] = status
    ? [status]
    : ["PENDING", "NEEDS_CHANGES", "REJECTED"];

  try {
    if (type === "post") {
      const posts = await prisma.post.findMany({
        where: {
          ownerUserId: userId,
          status: { in: statusFilter }
        },
        include: {
          author: {
            select: { id: true, username: true, avatarUrl: true }
          },
          moderation: {
            select: {
              id: true,
              status: true,
              reason: true,
              checklistJson: true,
              decidedAt: true
            }
          }
        },
        orderBy: { updatedAt: "desc" }
      });

      res.json({
        items: posts.map(formatPost),
        total: posts.length
      });
    } else if (type === "project") {
      const projects = await prisma.project.findMany({
        where: {
          ownerUserId: userId,
          status: { in: statusFilter }
        },
        include: {
          author: {
            select: { id: true, username: true, avatarUrl: true }
          },
          moderation: {
            select: {
              id: true,
              status: true,
              reason: true,
              checklistJson: true,
              decidedAt: true
            }
          }
        },
        orderBy: { updatedAt: "desc" }
      });

      res.json({
        items: projects.map(formatProject),
        total: projects.length
      });
    } else {
      res.status(400).json({ error: "Unsupported type", code: "INVALID_TYPE" });
    }
  } catch (err) {
    console.error("Failed to get submissions:", err);
    res.status(500).json({ error: "Failed to get submissions" });
  }
});

/**
 * GET /dashboard/projects
 * Get all user's personal projects with optional status filter
 */
router.get("/projects", async (req, res) => {
  const userId = req.user!.id;
  const status = req.query.status as ContentStatus | undefined;

  try {
    const where: any = {
      ownerUserId: userId,
      ownership: "PERSONAL"
    };

    if (status) {
      where.status = status;
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        author: {
          select: { id: true, username: true, avatarUrl: true }
        },
        moderation: {
          select: {
            id: true,
            status: true,
            reason: true,
            checklistJson: true,
            decidedAt: true
          }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    res.json({
      items: projects.map(formatProject),
      total: projects.length
    });
  } catch (err) {
    console.error("Failed to get projects:", err);
    res.status(500).json({ error: "Failed to get projects" });
  }
});

/**
 * GET /dashboard/posts
 * Get all user's personal posts with optional status filter
 */
router.get("/posts", async (req, res) => {
  const userId = req.user!.id;
  const status = req.query.status as ContentStatus | undefined;

  try {
    const where: any = {
      ownerUserId: userId,
      ownership: "PERSONAL"
    };

    if (status) {
      where.status = status;
    }

    const posts = await prisma.post.findMany({
      where,
      include: {
        author: {
          select: { id: true, username: true, avatarUrl: true }
        },
        moderation: {
          select: {
            id: true,
            status: true,
            reason: true,
            checklistJson: true,
            decidedAt: true
          }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    res.json({
      items: posts.map(formatPost),
      total: posts.length
    });
  } catch (err) {
    console.error("Failed to get posts:", err);
    res.status(500).json({ error: "Failed to get posts" });
  }
});

/**
 * GET /dashboard/stats
 * Get counts for dashboard badges (projects and posts)
 */
router.get("/stats", async (req, res) => {
  const userId = req.user!.id;

  try {
    const [
      projectDrafts, projectPending, projectNeedsChanges, projectRejected, projectPublished,
      postDrafts, postPending, postNeedsChanges, postRejected, postPublished
    ] = await Promise.all([
      prisma.project.count({ where: { ownerUserId: userId, status: "DRAFT" } }),
      prisma.project.count({ where: { ownerUserId: userId, status: "PENDING" } }),
      prisma.project.count({ where: { ownerUserId: userId, status: "NEEDS_CHANGES" } }),
      prisma.project.count({ where: { ownerUserId: userId, status: "REJECTED" } }),
      prisma.project.count({ where: { ownerUserId: userId, status: "PUBLISHED" } }),
      prisma.post.count({ where: { ownerUserId: userId, status: "DRAFT" } }),
      prisma.post.count({ where: { ownerUserId: userId, status: "PENDING" } }),
      prisma.post.count({ where: { ownerUserId: userId, status: "NEEDS_CHANGES" } }),
      prisma.post.count({ where: { ownerUserId: userId, status: "REJECTED" } }),
      prisma.post.count({ where: { ownerUserId: userId, status: "PUBLISHED" } })
    ]);

    res.json({
      projects: {
        drafts: projectDrafts,
        pending: projectPending,
        needsChanges: projectNeedsChanges,
        rejected: projectRejected,
        published: projectPublished,
        total: projectDrafts + projectPending + projectNeedsChanges + projectRejected + projectPublished
      },
      posts: {
        drafts: postDrafts,
        pending: postPending,
        needsChanges: postNeedsChanges,
        rejected: postRejected,
        published: postPublished,
        total: postDrafts + postPending + postNeedsChanges + postRejected + postPublished
      },
      // Legacy format for backward compatibility
      drafts: projectDrafts,
      pending: projectPending,
      needsChanges: projectNeedsChanges,
      rejected: projectRejected,
      published: projectPublished,
      total: projectDrafts + projectPending + projectNeedsChanges + projectRejected + projectPublished
    });
  } catch (err) {
    console.error("Failed to get stats:", err);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// Helper to format project response
function formatProject(project: any) {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    type: project.type,
    ownership: project.ownership,
    status: project.status,
    authorId: project.authorId,
    ownerUserId: project.ownerUserId,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    author: project.author,
    moderation: project.moderation ? {
      id: project.moderation.id,
      status: project.moderation.status,
      reason: project.moderation.reason,
      checklistJson: project.moderation.checklistJson,
      decidedAt: project.moderation.decidedAt?.toISOString() ?? null
    } : null
  };
}

// Helper to format post response
function formatPost(post: any) {
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    ownership: post.ownership,
    status: post.status,
    authorId: post.authorId,
    ownerUserId: post.ownerUserId,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    author: post.author,
    moderation: post.moderation ? {
      id: post.moderation.id,
      status: post.moderation.status,
      reason: post.moderation.reason,
      checklistJson: post.moderation.checklistJson,
      decidedAt: post.moderation.decidedAt?.toISOString() ?? null
    } : null
  };
}

export default router;
