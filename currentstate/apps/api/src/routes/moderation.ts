import { Router } from "express";
import { prisma } from "@prismmtr/db";
import { authMiddleware, requireUser, requireRole } from "../middleware/auth.js";
import { rateLimiters } from "../middleware/security.js";
import { ModerationDecisionInput } from "@prismmtr/shared";
import {
  notifyProjectApproved,
  notifyProjectNeedsChanges,
  notifyProjectRejected,
  notifyPostApproved,
  notifyPostNeedsChanges,
  notifyPostRejected,
  pushNotificationToUser
} from "../services/notifications.js";

const router = Router();

// All routes require MOD or ADMIN role
router.use(authMiddleware, requireUser, requireRole("MOD", "ADMIN"));

// Apply moderation rate limiting to all routes
router.use(rateLimiters.moderation);

// ============================================
// Project Moderation
// ============================================

/**
 * GET /dashboard/mod/projects
 * List moderation queue for projects
 */
router.get("/projects", async (req, res) => {
  const status = req.query.status as string ?? "PENDING";

  try {
    const items = await prisma.moderationItem.findMany({
      where: {
        subjectType: "PROJECT",
        status: status as any
      },
      include: {
        project: {
          include: {
            author: {
              select: { id: true, username: true, avatarUrl: true, globalRole: true }
            }
          }
        },
        decidedBy: {
          select: { id: true, username: true }
        }
      },
      orderBy: { createdAt: "asc" } // FIFO order
    });

    res.json({
      items: items.map(formatModerationItem),
      total: items.length
    });
  } catch (err) {
    console.error("Failed to get moderation queue:", err);
    res.status(500).json({ error: "Failed to get moderation queue" });
  }
});

/**
 * GET /dashboard/mod/projects/:id
 * Get a specific project for moderation review
 */
router.get("/projects/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const moderation = await prisma.moderationItem.findFirst({
      where: {
        subjectType: "PROJECT",
        projectId: id
      },
      include: {
        project: {
          include: {
            author: {
              select: { id: true, username: true, avatarUrl: true, globalRole: true }
            }
          }
        },
        decidedBy: {
          select: { id: true, username: true }
        }
      }
    });

    if (!moderation) {
      res.status(404).json({ error: "Moderation item not found", code: "NOT_FOUND" });
      return;
    }

    res.json(formatModerationItem(moderation));
  } catch (err) {
    console.error("Failed to get moderation item:", err);
    res.status(500).json({ error: "Failed to get moderation item" });
  }
});

/**
 * POST /dashboard/mod/projects/:id/approve
 * Approve a project (sets status to PUBLISHED)
 */
router.post("/projects/:id/approve", async (req, res) => {
  const { id } = req.params;
  const modId = req.user!.id;

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { moderation: true }
    });

    if (!project) {
      res.status(404).json({ error: "Project not found", code: "NOT_FOUND" });
      return;
    }

    if (project.status !== "PENDING") {
      res.status(409).json({
        error: `Cannot approve project in ${project.status} status`,
        code: "INVALID_STATUS_TRANSITION"
      });
      return;
    }

    if (!project.moderation) {
      res.status(404).json({ error: "Moderation item not found", code: "NOT_FOUND" });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update project status
      const updatedProject = await tx.project.update({
        where: { id },
        data: { status: "PUBLISHED" },
        include: {
          author: {
            select: { id: true, username: true, avatarUrl: true, globalRole: true }
          }
        }
      });

      // Update moderation item
      const moderation = await tx.moderationItem.update({
        where: { id: project.moderation!.id },
        data: {
          status: "PUBLISHED",
          decidedById: modId,
          decidedAt: new Date(),
          reason: null
        }
      });

      // Create notification for project owner
      const { notification } = await notifyProjectApproved({
        projectId: id,
        projectTitle: project.title,
        ownerUserId: project.ownerUserId,
        moderatorId: modId,
        moderatorUsername: req.user!.username
      }, tx);

      return { project: updatedProject, moderation, notification };
    });

    // Push notification via socket after transaction commits
    if (result.notification) {
      await pushNotificationToUser(project.ownerUserId, result.notification);
    }

    res.json({
      ok: true,
      project: formatProject(result.project),
      moderation: {
        id: result.moderation.id,
        status: result.moderation.status,
        decidedAt: result.moderation.decidedAt?.toISOString()
      }
    });
  } catch (err) {
    console.error("Failed to approve project:", err);
    res.status(500).json({ error: "Failed to approve project" });
  }
});

/**
 * POST /dashboard/mod/projects/:id/needs-changes
 * Request changes on a project
 */
router.post("/projects/:id/needs-changes", async (req, res) => {
  const { id } = req.params;
  const modId = req.user!.id;

  const parsed = ModerationDecisionInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const { reason, checklist } = parsed.data;

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { moderation: true }
    });

    if (!project) {
      res.status(404).json({ error: "Project not found", code: "NOT_FOUND" });
      return;
    }

    if (project.status !== "PENDING") {
      res.status(409).json({
        error: `Cannot request changes on project in ${project.status} status`,
        code: "INVALID_STATUS_TRANSITION"
      });
      return;
    }

    if (!project.moderation) {
      res.status(404).json({ error: "Moderation item not found", code: "NOT_FOUND" });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedProject = await tx.project.update({
        where: { id },
        data: { status: "NEEDS_CHANGES" },
        include: {
          author: {
            select: { id: true, username: true, avatarUrl: true, globalRole: true }
          }
        }
      });

      const moderation = await tx.moderationItem.update({
        where: { id: project.moderation!.id },
        data: {
          status: "NEEDS_CHANGES",
          decidedById: modId,
          decidedAt: new Date(),
          reason: reason ?? null,
          checklistJson: checklist ?? null
        }
      });

      // Create notification for project owner
      const { notification } = await notifyProjectNeedsChanges({
        projectId: id,
        projectTitle: project.title,
        ownerUserId: project.ownerUserId,
        moderatorId: modId,
        moderatorUsername: req.user!.username,
        reason,
        checklist
      }, tx);

      return { project: updatedProject, moderation, notification };
    });

    // Push notification via socket after transaction commits
    if (result.notification) {
      await pushNotificationToUser(project.ownerUserId, result.notification);
    }

    res.json({
      ok: true,
      project: formatProject(result.project),
      moderation: {
        id: result.moderation.id,
        status: result.moderation.status,
        reason: result.moderation.reason,
        checklistJson: result.moderation.checklistJson,
        decidedAt: result.moderation.decidedAt?.toISOString()
      }
    });
  } catch (err) {
    console.error("Failed to request changes:", err);
    res.status(500).json({ error: "Failed to request changes" });
  }
});

/**
 * POST /dashboard/mod/projects/:id/reject
 * Reject a project
 */
router.post("/projects/:id/reject", async (req, res) => {
  const { id } = req.params;
  const modId = req.user!.id;

  const parsed = ModerationDecisionInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const { reason } = parsed.data;

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { moderation: true }
    });

    if (!project) {
      res.status(404).json({ error: "Project not found", code: "NOT_FOUND" });
      return;
    }

    if (project.status !== "PENDING") {
      res.status(409).json({
        error: `Cannot reject project in ${project.status} status`,
        code: "INVALID_STATUS_TRANSITION"
      });
      return;
    }

    if (!project.moderation) {
      res.status(404).json({ error: "Moderation item not found", code: "NOT_FOUND" });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedProject = await tx.project.update({
        where: { id },
        data: { status: "REJECTED" },
        include: {
          author: {
            select: { id: true, username: true, avatarUrl: true, globalRole: true }
          }
        }
      });

      const moderation = await tx.moderationItem.update({
        where: { id: project.moderation!.id },
        data: {
          status: "REJECTED",
          decidedById: modId,
          decidedAt: new Date(),
          reason: reason ?? null
        }
      });

      // Create notification for project owner
      const { notification } = await notifyProjectRejected({
        projectId: id,
        projectTitle: project.title,
        ownerUserId: project.ownerUserId,
        moderatorId: modId,
        moderatorUsername: req.user!.username,
        reason
      }, tx);

      return { project: updatedProject, moderation, notification };
    });

    // Push notification via socket after transaction commits
    if (result.notification) {
      await pushNotificationToUser(project.ownerUserId, result.notification);
    }

    res.json({
      ok: true,
      project: formatProject(result.project),
      moderation: {
        id: result.moderation.id,
        status: result.moderation.status,
        reason: result.moderation.reason,
        decidedAt: result.moderation.decidedAt?.toISOString()
      }
    });
  } catch (err) {
    console.error("Failed to reject project:", err);
    res.status(500).json({ error: "Failed to reject project" });
  }
});

// ============================================
// Post Moderation
// ============================================

/**
 * GET /dashboard/mod/posts
 * List moderation queue for posts
 */
router.get("/posts", async (req, res) => {
  const status = req.query.status as string ?? "PENDING";

  try {
    const items = await prisma.moderationItem.findMany({
      where: {
        subjectType: "POST",
        status: status as any
      },
      include: {
        post: {
          include: {
            author: {
              select: { id: true, username: true, avatarUrl: true, globalRole: true }
            }
          }
        },
        decidedBy: {
          select: { id: true, username: true }
        }
      },
      orderBy: { createdAt: "asc" } // FIFO order
    });

    res.json({
      items: items.map(formatModerationItem),
      total: items.length
    });
  } catch (err) {
    console.error("Failed to get post moderation queue:", err);
    res.status(500).json({ error: "Failed to get moderation queue" });
  }
});

/**
 * GET /dashboard/mod/posts/:id
 * Get a specific post for moderation review
 */
router.get("/posts/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const moderation = await prisma.moderationItem.findFirst({
      where: {
        subjectType: "POST",
        postId: id
      },
      include: {
        post: {
          include: {
            author: {
              select: { id: true, username: true, avatarUrl: true, globalRole: true }
            }
          }
        },
        decidedBy: {
          select: { id: true, username: true }
        }
      }
    });

    if (!moderation) {
      res.status(404).json({ error: "Moderation item not found", code: "NOT_FOUND" });
      return;
    }

    res.json(formatModerationItem(moderation));
  } catch (err) {
    console.error("Failed to get moderation item:", err);
    res.status(500).json({ error: "Failed to get moderation item" });
  }
});

/**
 * POST /dashboard/mod/posts/:id/approve
 * Approve a post (sets status to PUBLISHED)
 */
router.post("/posts/:id/approve", async (req, res) => {
  const { id } = req.params;
  const modId = req.user!.id;

  try {
    const post = await prisma.post.findUnique({
      where: { id },
      include: { moderation: true }
    });

    if (!post) {
      res.status(404).json({ error: "Post not found", code: "NOT_FOUND" });
      return;
    }

    if (post.status !== "PENDING") {
      res.status(409).json({
        error: `Cannot approve post in ${post.status} status`,
        code: "INVALID_STATUS_TRANSITION"
      });
      return;
    }

    if (!post.moderation) {
      res.status(404).json({ error: "Moderation item not found", code: "NOT_FOUND" });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update post status
      const updatedPost = await tx.post.update({
        where: { id },
        data: { status: "PUBLISHED" },
        include: {
          author: {
            select: { id: true, username: true, avatarUrl: true, globalRole: true }
          }
        }
      });

      // Update moderation item
      const moderation = await tx.moderationItem.update({
        where: { id: post.moderation!.id },
        data: {
          status: "PUBLISHED",
          decidedById: modId,
          decidedAt: new Date(),
          reason: null
        }
      });

      // Create notification for post owner
      const { notification } = await notifyPostApproved({
        postId: id,
        postTitle: post.title,
        ownerUserId: post.ownerUserId,
        moderatorId: modId,
        moderatorUsername: req.user!.username
      }, tx);

      return { post: updatedPost, moderation, notification };
    });

    // Push notification via socket after transaction commits
    if (result.notification) {
      await pushNotificationToUser(post.ownerUserId, result.notification);
    }

    res.json({
      ok: true,
      post: formatPost(result.post),
      moderation: {
        id: result.moderation.id,
        status: result.moderation.status,
        decidedAt: result.moderation.decidedAt?.toISOString()
      }
    });
  } catch (err) {
    console.error("Failed to approve post:", err);
    res.status(500).json({ error: "Failed to approve post" });
  }
});

/**
 * POST /dashboard/mod/posts/:id/needs-changes
 * Request changes on a post
 */
router.post("/posts/:id/needs-changes", async (req, res) => {
  const { id } = req.params;
  const modId = req.user!.id;

  const parsed = ModerationDecisionInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const { reason, checklist } = parsed.data;

  try {
    const post = await prisma.post.findUnique({
      where: { id },
      include: { moderation: true }
    });

    if (!post) {
      res.status(404).json({ error: "Post not found", code: "NOT_FOUND" });
      return;
    }

    if (post.status !== "PENDING") {
      res.status(409).json({
        error: `Cannot request changes on post in ${post.status} status`,
        code: "INVALID_STATUS_TRANSITION"
      });
      return;
    }

    if (!post.moderation) {
      res.status(404).json({ error: "Moderation item not found", code: "NOT_FOUND" });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedPost = await tx.post.update({
        where: { id },
        data: { status: "NEEDS_CHANGES" },
        include: {
          author: {
            select: { id: true, username: true, avatarUrl: true, globalRole: true }
          }
        }
      });

      const moderation = await tx.moderationItem.update({
        where: { id: post.moderation!.id },
        data: {
          status: "NEEDS_CHANGES",
          decidedById: modId,
          decidedAt: new Date(),
          reason: reason ?? null,
          checklistJson: checklist ?? null
        }
      });

      // Create notification for post owner
      const { notification } = await notifyPostNeedsChanges({
        postId: id,
        postTitle: post.title,
        ownerUserId: post.ownerUserId,
        moderatorId: modId,
        moderatorUsername: req.user!.username,
        reason,
        checklist
      }, tx);

      return { post: updatedPost, moderation, notification };
    });

    // Push notification via socket after transaction commits
    if (result.notification) {
      await pushNotificationToUser(post.ownerUserId, result.notification);
    }

    res.json({
      ok: true,
      post: formatPost(result.post),
      moderation: {
        id: result.moderation.id,
        status: result.moderation.status,
        reason: result.moderation.reason,
        checklistJson: result.moderation.checklistJson,
        decidedAt: result.moderation.decidedAt?.toISOString()
      }
    });
  } catch (err) {
    console.error("Failed to request changes:", err);
    res.status(500).json({ error: "Failed to request changes" });
  }
});

/**
 * POST /dashboard/mod/posts/:id/reject
 * Reject a post
 */
router.post("/posts/:id/reject", async (req, res) => {
  const { id } = req.params;
  const modId = req.user!.id;

  const parsed = ModerationDecisionInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const { reason } = parsed.data;

  try {
    const post = await prisma.post.findUnique({
      where: { id },
      include: { moderation: true }
    });

    if (!post) {
      res.status(404).json({ error: "Post not found", code: "NOT_FOUND" });
      return;
    }

    if (post.status !== "PENDING") {
      res.status(409).json({
        error: `Cannot reject post in ${post.status} status`,
        code: "INVALID_STATUS_TRANSITION"
      });
      return;
    }

    if (!post.moderation) {
      res.status(404).json({ error: "Moderation item not found", code: "NOT_FOUND" });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedPost = await tx.post.update({
        where: { id },
        data: { status: "REJECTED" },
        include: {
          author: {
            select: { id: true, username: true, avatarUrl: true, globalRole: true }
          }
        }
      });

      const moderation = await tx.moderationItem.update({
        where: { id: post.moderation!.id },
        data: {
          status: "REJECTED",
          decidedById: modId,
          decidedAt: new Date(),
          reason: reason ?? null
        }
      });

      // Create notification for post owner
      const { notification } = await notifyPostRejected({
        postId: id,
        postTitle: post.title,
        ownerUserId: post.ownerUserId,
        moderatorId: modId,
        moderatorUsername: req.user!.username,
        reason
      }, tx);

      return { post: updatedPost, moderation, notification };
    });

    // Push notification via socket after transaction commits
    if (result.notification) {
      await pushNotificationToUser(post.ownerUserId, result.notification);
    }

    res.json({
      ok: true,
      post: formatPost(result.post),
      moderation: {
        id: result.moderation.id,
        status: result.moderation.status,
        reason: result.moderation.reason,
        decidedAt: result.moderation.decidedAt?.toISOString()
      }
    });
  } catch (err) {
    console.error("Failed to reject post:", err);
    res.status(500).json({ error: "Failed to reject post" });
  }
});

// ============================================
// Stats
// ============================================

/**
 * GET /dashboard/mod/stats
 * Get moderation queue statistics
 */
router.get("/stats", async (req, res) => {
  try {
    const [
      pendingProjects, needsChangesProjects, rejectedProjects,
      pendingPosts, needsChangesPosts, rejectedPosts
    ] = await Promise.all([
      prisma.moderationItem.count({ where: { subjectType: "PROJECT", status: "PENDING" } }),
      prisma.moderationItem.count({ where: { subjectType: "PROJECT", status: "NEEDS_CHANGES" } }),
      prisma.moderationItem.count({ where: { subjectType: "PROJECT", status: "REJECTED" } }),
      prisma.moderationItem.count({ where: { subjectType: "POST", status: "PENDING" } }),
      prisma.moderationItem.count({ where: { subjectType: "POST", status: "NEEDS_CHANGES" } }),
      prisma.moderationItem.count({ where: { subjectType: "POST", status: "REJECTED" } })
    ]);

    res.json({
      projects: {
        pending: pendingProjects,
        needsChanges: needsChangesProjects,
        rejected: rejectedProjects,
        total: pendingProjects + needsChangesProjects + rejectedProjects
      },
      posts: {
        pending: pendingPosts,
        needsChanges: needsChangesPosts,
        rejected: rejectedPosts,
        total: pendingPosts + needsChangesPosts + rejectedPosts
      }
    });
  } catch (err) {
    console.error("Failed to get moderation stats:", err);
    res.status(500).json({ error: "Failed to get moderation stats" });
  }
});

// ============================================
// Helpers
// ============================================

// Helper to format moderation item response
function formatModerationItem(item: any) {
  return {
    id: item.id,
    subjectType: item.subjectType,
    projectId: item.projectId,
    postId: item.postId,
    status: item.status,
    scopeUserId: item.scopeUserId,
    reason: item.reason,
    checklistJson: item.checklistJson,
    decidedById: item.decidedById,
    decidedAt: item.decidedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    project: item.project ? formatProject(item.project) : null,
    post: item.post ? formatPost(item.post) : null,
    decidedBy: item.decidedBy
  };
}

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
    author: project.author
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
    author: post.author
  };
}

export default router;
