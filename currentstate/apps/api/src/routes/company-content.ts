import { Router } from "express";
import { prisma } from "@prismmtr/db";
import { authMiddleware, requireUser } from "../middleware/auth.js";
import {
  CreateProjectInput,
  UpdateProjectInput,
  CreatePostInput,
  UpdatePostInput,
  isEditable,
  canSubmit,
  canWithdraw,
  hasRolePermission
} from "@prismmtr/shared";
import {
  getUserCompanyMembership,
  shouldAutoPublish,
  canApproveCompanyContent,
  requiresDualReview
} from "../services/company.js";
import {
  notifyCompanyContentApproved,
  notifyCompanyContentNeedsChanges,
  notifyCompanyContentRejected,
  pushNotificationToUser
} from "../services/notifications.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware, requireUser);

// ============================================
// Company Projects
// ============================================

/**
 * GET /company/:id/hub/projects
 * List company projects (requires membership)
 */
router.get("/:id/hub/projects", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const status = req.query.status as string | undefined;

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership) {
      res.status(403).json({ error: "Not a member of this company", code: "FORBIDDEN" });
      return;
    }

    const where: any = {
      ownerCompanyId: id,
      ownership: "COMPANY"
    };

    if (status) {
      where.status = status;
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        moderation: {
          select: { id: true, status: true, reason: true, checklistJson: true, decidedAt: true }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    res.json({
      items: projects.map(formatProject),
      total: projects.length
    });
  } catch (err) {
    console.error("Failed to list company projects:", err);
    res.status(500).json({ error: "Failed to list company projects" });
  }
});

/**
 * POST /company/:id/hub/projects
 * Create a new company project (draft)
 */
router.post("/:id/hub/projects", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const parsed = CreateProjectInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const { title, description, type } = parsed.data;

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership) {
      res.status(403).json({ error: "Not a member of this company", code: "FORBIDDEN" });
      return;
    }

    const project = await prisma.project.create({
      data: {
        title,
        description: description ?? null,
        type,
        ownership: "COMPANY",
        status: "DRAFT",
        authorId: userId,
        ownerCompanyId: id
      },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        ownerCompany: { select: { id: true, name: true, slug: true } }
      }
    });

    res.status(201).json(formatProject(project));
  } catch (err) {
    console.error("Failed to create company project:", err);
    res.status(500).json({ error: "Failed to create company project" });
  }
});

/**
 * GET /company/:id/hub/projects/:projectId
 * Get a company project
 */
router.get("/:id/hub/projects/:projectId", async (req, res) => {
  const { id, projectId } = req.params;
  const userId = req.user!.id;

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership) {
      res.status(403).json({ error: "Not a member of this company", code: "FORBIDDEN" });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        ownerCompany: { select: { id: true, name: true, slug: true } },
        moderation: {
          select: { id: true, status: true, reason: true, checklistJson: true, decidedAt: true }
        }
      }
    });

    if (!project || project.ownerCompanyId !== id) {
      res.status(404).json({ error: "Project not found", code: "NOT_FOUND" });
      return;
    }

    res.json(formatProject(project));
  } catch (err) {
    console.error("Failed to get company project:", err);
    res.status(500).json({ error: "Failed to get company project" });
  }
});

/**
 * PATCH /company/:id/hub/projects/:projectId
 * Update a company project
 */
router.patch("/:id/hub/projects/:projectId", async (req, res) => {
  const { id, projectId } = req.params;
  const userId = req.user!.id;

  const parsed = UpdateProjectInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership) {
      res.status(403).json({ error: "Not a member of this company", code: "FORBIDDEN" });
      return;
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });

    if (!project || project.ownerCompanyId !== id) {
      res.status(404).json({ error: "Project not found", code: "NOT_FOUND" });
      return;
    }

    // Only author or OWNER/CO_OWNER can edit
    const canEdit = project.authorId === userId || hasRolePermission(membership.role, "CO_OWNER");
    if (!canEdit) {
      res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
      return;
    }

    if (!isEditable(project.status)) {
      res.status(409).json({
        error: `Cannot edit project in ${project.status} status`,
        code: "INVALID_STATUS_TRANSITION"
      });
      return;
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.type !== undefined && { type: parsed.data.type })
      },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        ownerCompany: { select: { id: true, name: true, slug: true } },
        moderation: {
          select: { id: true, status: true, reason: true, checklistJson: true, decidedAt: true }
        }
      }
    });

    res.json(formatProject(updated));
  } catch (err) {
    console.error("Failed to update company project:", err);
    res.status(500).json({ error: "Failed to update company project" });
  }
});

/**
 * POST /company/:id/hub/projects/:projectId/submit
 * Submit a company project for review
 */
router.post("/:id/hub/projects/:projectId/submit", async (req, res) => {
  const { id, projectId } = req.params;
  const userId = req.user!.id;

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership) {
      res.status(403).json({ error: "Not a member of this company", code: "FORBIDDEN" });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { moderation: true, ownerCompany: true }
    });

    if (!project || project.ownerCompanyId !== id) {
      res.status(404).json({ error: "Project not found", code: "NOT_FOUND" });
      return;
    }

    // Only author can submit
    if (project.authorId !== userId) {
      res.status(403).json({ error: "Only the author can submit", code: "FORBIDDEN" });
      return;
    }

    if (!canSubmit(project.status)) {
      res.status(409).json({
        error: `Cannot submit project in ${project.status} status`,
        code: "INVALID_STATUS_TRANSITION"
      });
      return;
    }

    const company = project.ownerCompany!;
    const autoPublish = shouldAutoPublish(company.publishingMode as any, membership.role);

    if (autoPublish) {
      // Auto-publish
      const updated = await prisma.project.update({
        where: { id: projectId },
        data: { status: "PUBLISHED" },
        include: {
          author: { select: { id: true, username: true, avatarUrl: true } },
          ownerCompany: { select: { id: true, name: true, slug: true } }
        }
      });

      res.json(formatProject(updated));
    } else {
      // Submit to moderation queue
      const result = await prisma.$transaction(async (tx) => {
        const updatedProject = await tx.project.update({
          where: { id: projectId },
          data: { status: "PENDING" },
          include: {
            author: { select: { id: true, username: true, avatarUrl: true } },
            ownerCompany: { select: { id: true, name: true, slug: true } }
          }
        });

        // Create or update moderation item
        let moderation;
        if (project.moderation) {
          moderation = await tx.moderationItem.update({
            where: { id: project.moderation.id },
            data: {
              status: "PENDING",
              scopeCompanyId: id,
              isGlobalReview: false,
              reason: null,
              checklistJson: null,
              decidedById: null,
              decidedAt: null
            }
          });
        } else {
          moderation = await tx.moderationItem.create({
            data: {
              subjectType: "PROJECT",
              projectId,
              status: "PENDING",
              scopeCompanyId: id,
              isGlobalReview: false
            }
          });
        }

        return { project: updatedProject, moderation };
      });

      res.json({
        ...formatProject(result.project),
        moderation: {
          id: result.moderation.id,
          status: result.moderation.status,
          reason: result.moderation.reason,
          checklistJson: result.moderation.checklistJson,
          decidedAt: result.moderation.decidedAt?.toISOString() ?? null
        }
      });
    }
  } catch (err) {
    console.error("Failed to submit company project:", err);
    res.status(500).json({ error: "Failed to submit company project" });
  }
});

/**
 * POST /company/:id/hub/projects/:projectId/withdraw
 * Withdraw a company project from review
 */
router.post("/:id/hub/projects/:projectId/withdraw", async (req, res) => {
  const { id, projectId } = req.params;
  const userId = req.user!.id;

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership) {
      res.status(403).json({ error: "Not a member of this company", code: "FORBIDDEN" });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { moderation: true }
    });

    if (!project || project.ownerCompanyId !== id) {
      res.status(404).json({ error: "Project not found", code: "NOT_FOUND" });
      return;
    }

    // Only author can withdraw
    if (project.authorId !== userId) {
      res.status(403).json({ error: "Only the author can withdraw", code: "FORBIDDEN" });
      return;
    }

    if (!canWithdraw(project.status)) {
      res.status(409).json({
        error: `Cannot withdraw project in ${project.status} status`,
        code: "INVALID_STATUS_TRANSITION"
      });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedProject = await tx.project.update({
        where: { id: projectId },
        data: { status: "DRAFT" },
        include: {
          author: { select: { id: true, username: true, avatarUrl: true } },
          ownerCompany: { select: { id: true, name: true, slug: true } }
        }
      });

      if (project.moderation) {
        await tx.moderationItem.update({
          where: { id: project.moderation.id },
          data: { status: "WITHDRAWN" }
        });
      }

      return updatedProject;
    });

    res.json(formatProject(result));
  } catch (err) {
    console.error("Failed to withdraw company project:", err);
    res.status(500).json({ error: "Failed to withdraw company project" });
  }
});

/**
 * DELETE /company/:id/hub/projects/:projectId
 * Delete a company project
 */
router.delete("/:id/hub/projects/:projectId", async (req, res) => {
  const { id, projectId } = req.params;
  const userId = req.user!.id;

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership) {
      res.status(403).json({ error: "Not a member of this company", code: "FORBIDDEN" });
      return;
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });

    if (!project || project.ownerCompanyId !== id) {
      res.status(404).json({ error: "Project not found", code: "NOT_FOUND" });
      return;
    }

    // Only author or OWNER/CO_OWNER can delete
    const canDelete = project.authorId === userId || hasRolePermission(membership.role, "CO_OWNER");
    if (!canDelete) {
      res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
      return;
    }

    if (project.status !== "DRAFT") {
      res.status(409).json({
        error: "Can only delete draft projects",
        code: "INVALID_STATUS_TRANSITION"
      });
      return;
    }

    await prisma.project.delete({ where: { id: projectId } });

    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete company project:", err);
    res.status(500).json({ error: "Failed to delete company project" });
  }
});

// ============================================
// Company Posts
// ============================================

/**
 * GET /company/:id/hub/posts
 * List company posts (requires membership)
 */
router.get("/:id/hub/posts", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const status = req.query.status as string | undefined;

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership) {
      res.status(403).json({ error: "Not a member of this company", code: "FORBIDDEN" });
      return;
    }

    const where: any = {
      ownerCompanyId: id,
      ownership: "COMPANY"
    };

    if (status) {
      where.status = status;
    }

    const posts = await prisma.post.findMany({
      where,
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        moderation: {
          select: { id: true, status: true, reason: true, checklistJson: true, decidedAt: true }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    res.json({
      items: posts.map(formatPost),
      total: posts.length
    });
  } catch (err) {
    console.error("Failed to list company posts:", err);
    res.status(500).json({ error: "Failed to list company posts" });
  }
});

/**
 * POST /company/:id/hub/posts
 * Create a new company post (draft)
 */
router.post("/:id/hub/posts", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const parsed = CreatePostInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const { title, body } = parsed.data;

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership) {
      res.status(403).json({ error: "Not a member of this company", code: "FORBIDDEN" });
      return;
    }

    const post = await prisma.post.create({
      data: {
        title,
        body,
        ownership: "COMPANY",
        status: "DRAFT",
        authorId: userId,
        ownerCompanyId: id
      },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        ownerCompany: { select: { id: true, name: true, slug: true } }
      }
    });

    res.status(201).json(formatPost(post));
  } catch (err) {
    console.error("Failed to create company post:", err);
    res.status(500).json({ error: "Failed to create company post" });
  }
});

/**
 * GET /company/:id/hub/posts/:postId
 * Get a company post
 */
router.get("/:id/hub/posts/:postId", async (req, res) => {
  const { id, postId } = req.params;
  const userId = req.user!.id;

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership) {
      res.status(403).json({ error: "Not a member of this company", code: "FORBIDDEN" });
      return;
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        ownerCompany: { select: { id: true, name: true, slug: true } },
        moderation: {
          select: { id: true, status: true, reason: true, checklistJson: true, decidedAt: true }
        }
      }
    });

    if (!post || post.ownerCompanyId !== id) {
      res.status(404).json({ error: "Post not found", code: "NOT_FOUND" });
      return;
    }

    res.json(formatPost(post));
  } catch (err) {
    console.error("Failed to get company post:", err);
    res.status(500).json({ error: "Failed to get company post" });
  }
});

/**
 * PATCH /company/:id/hub/posts/:postId
 * Update a company post
 */
router.patch("/:id/hub/posts/:postId", async (req, res) => {
  const { id, postId } = req.params;
  const userId = req.user!.id;

  const parsed = UpdatePostInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership) {
      res.status(403).json({ error: "Not a member of this company", code: "FORBIDDEN" });
      return;
    }

    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post || post.ownerCompanyId !== id) {
      res.status(404).json({ error: "Post not found", code: "NOT_FOUND" });
      return;
    }

    // Only author or OWNER/CO_OWNER can edit
    const canEdit = post.authorId === userId || hasRolePermission(membership.role, "CO_OWNER");
    if (!canEdit) {
      res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
      return;
    }

    if (!isEditable(post.status)) {
      res.status(409).json({
        error: `Cannot edit post in ${post.status} status`,
        code: "INVALID_STATUS_TRANSITION"
      });
      return;
    }

    const updated = await prisma.post.update({
      where: { id: postId },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.body !== undefined && { body: parsed.data.body })
      },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        ownerCompany: { select: { id: true, name: true, slug: true } },
        moderation: {
          select: { id: true, status: true, reason: true, checklistJson: true, decidedAt: true }
        }
      }
    });

    res.json(formatPost(updated));
  } catch (err) {
    console.error("Failed to update company post:", err);
    res.status(500).json({ error: "Failed to update company post" });
  }
});

/**
 * POST /company/:id/hub/posts/:postId/submit
 * Submit a company post for review
 */
router.post("/:id/hub/posts/:postId/submit", async (req, res) => {
  const { id, postId } = req.params;
  const userId = req.user!.id;

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership) {
      res.status(403).json({ error: "Not a member of this company", code: "FORBIDDEN" });
      return;
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { moderation: true, ownerCompany: true }
    });

    if (!post || post.ownerCompanyId !== id) {
      res.status(404).json({ error: "Post not found", code: "NOT_FOUND" });
      return;
    }

    // Only author can submit
    if (post.authorId !== userId) {
      res.status(403).json({ error: "Only the author can submit", code: "FORBIDDEN" });
      return;
    }

    if (!canSubmit(post.status)) {
      res.status(409).json({
        error: `Cannot submit post in ${post.status} status`,
        code: "INVALID_STATUS_TRANSITION"
      });
      return;
    }

    const company = post.ownerCompany!;
    const autoPublish = shouldAutoPublish(company.publishingMode as any, membership.role);

    if (autoPublish) {
      // Auto-publish
      const updated = await prisma.post.update({
        where: { id: postId },
        data: { status: "PUBLISHED" },
        include: {
          author: { select: { id: true, username: true, avatarUrl: true } },
          ownerCompany: { select: { id: true, name: true, slug: true } }
        }
      });

      res.json(formatPost(updated));
    } else {
      // Submit to moderation queue
      const result = await prisma.$transaction(async (tx) => {
        const updatedPost = await tx.post.update({
          where: { id: postId },
          data: { status: "PENDING" },
          include: {
            author: { select: { id: true, username: true, avatarUrl: true } },
            ownerCompany: { select: { id: true, name: true, slug: true } }
          }
        });

        // Create or update moderation item
        let moderation;
        if (post.moderation) {
          moderation = await tx.moderationItem.update({
            where: { id: post.moderation.id },
            data: {
              status: "PENDING",
              scopeCompanyId: id,
              isGlobalReview: false,
              reason: null,
              checklistJson: null,
              decidedById: null,
              decidedAt: null
            }
          });
        } else {
          moderation = await tx.moderationItem.create({
            data: {
              subjectType: "POST",
              postId,
              status: "PENDING",
              scopeCompanyId: id,
              isGlobalReview: false
            }
          });
        }

        return { post: updatedPost, moderation };
      });

      res.json({
        ...formatPost(result.post),
        moderation: {
          id: result.moderation.id,
          status: result.moderation.status,
          reason: result.moderation.reason,
          checklistJson: result.moderation.checklistJson,
          decidedAt: result.moderation.decidedAt?.toISOString() ?? null
        }
      });
    }
  } catch (err) {
    console.error("Failed to submit company post:", err);
    res.status(500).json({ error: "Failed to submit company post" });
  }
});

/**
 * POST /company/:id/hub/posts/:postId/withdraw
 * Withdraw a company post from review
 */
router.post("/:id/hub/posts/:postId/withdraw", async (req, res) => {
  const { id, postId } = req.params;
  const userId = req.user!.id;

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership) {
      res.status(403).json({ error: "Not a member of this company", code: "FORBIDDEN" });
      return;
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { moderation: true }
    });

    if (!post || post.ownerCompanyId !== id) {
      res.status(404).json({ error: "Post not found", code: "NOT_FOUND" });
      return;
    }

    // Only author can withdraw
    if (post.authorId !== userId) {
      res.status(403).json({ error: "Only the author can withdraw", code: "FORBIDDEN" });
      return;
    }

    if (!canWithdraw(post.status)) {
      res.status(409).json({
        error: `Cannot withdraw post in ${post.status} status`,
        code: "INVALID_STATUS_TRANSITION"
      });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedPost = await tx.post.update({
        where: { id: postId },
        data: { status: "DRAFT" },
        include: {
          author: { select: { id: true, username: true, avatarUrl: true } },
          ownerCompany: { select: { id: true, name: true, slug: true } }
        }
      });

      if (post.moderation) {
        await tx.moderationItem.update({
          where: { id: post.moderation.id },
          data: { status: "WITHDRAWN" }
        });
      }

      return updatedPost;
    });

    res.json(formatPost(result));
  } catch (err) {
    console.error("Failed to withdraw company post:", err);
    res.status(500).json({ error: "Failed to withdraw company post" });
  }
});

/**
 * DELETE /company/:id/hub/posts/:postId
 * Delete a company post
 */
router.delete("/:id/hub/posts/:postId", async (req, res) => {
  const { id, postId } = req.params;
  const userId = req.user!.id;

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership) {
      res.status(403).json({ error: "Not a member of this company", code: "FORBIDDEN" });
      return;
    }

    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post || post.ownerCompanyId !== id) {
      res.status(404).json({ error: "Post not found", code: "NOT_FOUND" });
      return;
    }

    // Only author or OWNER/CO_OWNER can delete
    const canDelete = post.authorId === userId || hasRolePermission(membership.role, "CO_OWNER");
    if (!canDelete) {
      res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
      return;
    }

    if (post.status !== "DRAFT") {
      res.status(409).json({
        error: "Can only delete draft posts",
        code: "INVALID_STATUS_TRANSITION"
      });
      return;
    }

    await prisma.post.delete({ where: { id: postId } });

    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete company post:", err);
    res.status(500).json({ error: "Failed to delete company post" });
  }
});

// ============================================
// Helpers
// ============================================

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
    ownerCompanyId: project.ownerCompanyId,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    author: project.author,
    ownerCompany: project.ownerCompany,
    moderation: project.moderation ? {
      id: project.moderation.id,
      status: project.moderation.status,
      reason: project.moderation.reason,
      checklistJson: project.moderation.checklistJson,
      decidedAt: project.moderation.decidedAt?.toISOString() ?? null
    } : null
  };
}

function formatPost(post: any) {
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    ownership: post.ownership,
    status: post.status,
    authorId: post.authorId,
    ownerUserId: post.ownerUserId,
    ownerCompanyId: post.ownerCompanyId,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    author: post.author,
    ownerCompany: post.ownerCompany,
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
