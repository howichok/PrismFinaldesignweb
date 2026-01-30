import { Router } from "express";
import { prisma } from "@prismmtr/db";
import { authMiddleware, requireUser } from "../middleware/auth.js";
import { ModerationDecisionInput, hasRolePermission } from "@prismmtr/shared";
import { getUserCompanyMembership, canApproveCompanyContent, requiresDualReview } from "../services/company.js";
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
// Company Moderation Queue - Projects
// ============================================

/**
 * GET /company/:id/hub/moderation/projects
 * List projects pending company moderation
 */
router.get("/:id/hub/moderation/projects", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const status = req.query.status as string ?? "PENDING";

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership || !canApproveCompanyContent(membership.role)) {
      res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
      return;
    }

    const items = await prisma.moderationItem.findMany({
      where: {
        scopeCompanyId: id,
        subjectType: "PROJECT",
        status: status as any,
        isGlobalReview: false
      },
      include: {
        project: {
          include: {
            author: { select: { id: true, username: true, avatarUrl: true } },
            ownerCompany: { select: { id: true, name: true, slug: true } }
          }
        },
        decidedBy: { select: { id: true, username: true } }
      },
      orderBy: { createdAt: "asc" }
    });

    res.json({
      items: items.map(formatModerationItem),
      total: items.length
    });
  } catch (err) {
    console.error("Failed to get company moderation queue:", err);
    res.status(500).json({ error: "Failed to get moderation queue" });
  }
});

/**
 * POST /company/:id/hub/moderation/projects/:projectId/approve
 * Approve a project (company-level)
 */
router.post("/:id/hub/moderation/projects/:projectId/approve", async (req, res) => {
  const { id, projectId } = req.params;
  const userId = req.user!.id;

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership || !canApproveCompanyContent(membership.role)) {
      res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
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

    const company = project.ownerCompany!;
    const needsDualReview = requiresDualReview(company.publishingMode as any);

    const result = await prisma.$transaction(async (tx) => {
      if (needsDualReview) {
        // Mark for global review
        const updatedModeration = await tx.moderationItem.update({
          where: { id: project.moderation!.id },
          data: {
            isGlobalReview: true,
            decidedById: userId,
            decidedAt: new Date()
          }
        });

        // Keep project as PENDING for global review
        return { project, moderation: updatedModeration, needsGlobalReview: true };
      } else {
        // Publish directly
        const updatedProject = await tx.project.update({
          where: { id: projectId },
          data: { status: "PUBLISHED" },
          include: {
            author: { select: { id: true, username: true, avatarUrl: true } },
            ownerCompany: { select: { id: true, name: true, slug: true } }
          }
        });

        const updatedModeration = await tx.moderationItem.update({
          where: { id: project.moderation!.id },
          data: {
            status: "PUBLISHED",
            decidedById: userId,
            decidedAt: new Date(),
            reason: null
          }
        });

        return { project: updatedProject, moderation: updatedModeration, needsGlobalReview: false };
      }
    });

    // Notify author
    if (!result.needsGlobalReview) {
      const { notification } = await notifyCompanyContentApproved({
        targetUserId: project.authorId,
        companyId: id,
        companyName: company.name,
        companySlug: company.slug,
        contentType: "PROJECT",
        contentId: projectId,
        contentTitle: project.title,
        approverId: userId,
        approverUsername: req.user!.username
      });

      if (notification) {
        await pushNotificationToUser(project.authorId, notification);
      }
    }

    res.json({
      ok: true,
      needsGlobalReview: result.needsGlobalReview,
      project: formatProject(result.project),
      moderation: {
        id: result.moderation.id,
        status: result.moderation.status,
        isGlobalReview: result.moderation.isGlobalReview,
        decidedAt: result.moderation.decidedAt?.toISOString()
      }
    });
  } catch (err) {
    console.error("Failed to approve project:", err);
    res.status(500).json({ error: "Failed to approve project" });
  }
});

/**
 * POST /company/:id/hub/moderation/projects/:projectId/needs-changes
 * Request changes on a project
 */
router.post("/:id/hub/moderation/projects/:projectId/needs-changes", async (req, res) => {
  const { id, projectId } = req.params;
  const userId = req.user!.id;

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
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership || !canApproveCompanyContent(membership.role)) {
      res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
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

    const company = project.ownerCompany!;

    const result = await prisma.$transaction(async (tx) => {
      const updatedProject = await tx.project.update({
        where: { id: projectId },
        data: { status: "NEEDS_CHANGES" },
        include: {
          author: { select: { id: true, username: true, avatarUrl: true } },
          ownerCompany: { select: { id: true, name: true, slug: true } }
        }
      });

      const updatedModeration = await tx.moderationItem.update({
        where: { id: project.moderation!.id },
        data: {
          status: "NEEDS_CHANGES",
          decidedById: userId,
          decidedAt: new Date(),
          reason: reason ?? null,
          checklistJson: checklist ?? null
        }
      });

      return { project: updatedProject, moderation: updatedModeration };
    });

    // Notify author
    const { notification } = await notifyCompanyContentNeedsChanges({
      targetUserId: project.authorId,
      companyId: id,
      companyName: company.name,
      companySlug: company.slug,
      contentType: "PROJECT",
      contentId: projectId,
      contentTitle: project.title,
      reviewerId: userId,
      reviewerUsername: req.user!.username,
      reason,
      checklist
    });

    if (notification) {
      await pushNotificationToUser(project.authorId, notification);
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
 * POST /company/:id/hub/moderation/projects/:projectId/reject
 * Reject a project
 */
router.post("/:id/hub/moderation/projects/:projectId/reject", async (req, res) => {
  const { id, projectId } = req.params;
  const userId = req.user!.id;

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
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership || !canApproveCompanyContent(membership.role)) {
      res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
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

    const company = project.ownerCompany!;

    const result = await prisma.$transaction(async (tx) => {
      const updatedProject = await tx.project.update({
        where: { id: projectId },
        data: { status: "REJECTED" },
        include: {
          author: { select: { id: true, username: true, avatarUrl: true } },
          ownerCompany: { select: { id: true, name: true, slug: true } }
        }
      });

      const updatedModeration = await tx.moderationItem.update({
        where: { id: project.moderation!.id },
        data: {
          status: "REJECTED",
          decidedById: userId,
          decidedAt: new Date(),
          reason: reason ?? null
        }
      });

      return { project: updatedProject, moderation: updatedModeration };
    });

    // Notify author
    const { notification } = await notifyCompanyContentRejected({
      targetUserId: project.authorId,
      companyId: id,
      companyName: company.name,
      companySlug: company.slug,
      contentType: "PROJECT",
      contentId: projectId,
      contentTitle: project.title,
      reviewerId: userId,
      reviewerUsername: req.user!.username,
      reason
    });

    if (notification) {
      await pushNotificationToUser(project.authorId, notification);
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
// Company Moderation Queue - Posts
// ============================================

/**
 * GET /company/:id/hub/moderation/posts
 * List posts pending company moderation
 */
router.get("/:id/hub/moderation/posts", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const status = req.query.status as string ?? "PENDING";

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership || !canApproveCompanyContent(membership.role)) {
      res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
      return;
    }

    const items = await prisma.moderationItem.findMany({
      where: {
        scopeCompanyId: id,
        subjectType: "POST",
        status: status as any,
        isGlobalReview: false
      },
      include: {
        post: {
          include: {
            author: { select: { id: true, username: true, avatarUrl: true } },
            ownerCompany: { select: { id: true, name: true, slug: true } }
          }
        },
        decidedBy: { select: { id: true, username: true } }
      },
      orderBy: { createdAt: "asc" }
    });

    res.json({
      items: items.map(formatModerationItem),
      total: items.length
    });
  } catch (err) {
    console.error("Failed to get company post moderation queue:", err);
    res.status(500).json({ error: "Failed to get moderation queue" });
  }
});

/**
 * POST /company/:id/hub/moderation/posts/:postId/approve
 * Approve a post (company-level)
 */
router.post("/:id/hub/moderation/posts/:postId/approve", async (req, res) => {
  const { id, postId } = req.params;
  const userId = req.user!.id;

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership || !canApproveCompanyContent(membership.role)) {
      res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
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

    const company = post.ownerCompany!;
    const needsDualReview = requiresDualReview(company.publishingMode as any);

    const result = await prisma.$transaction(async (tx) => {
      if (needsDualReview) {
        // Mark for global review
        const updatedModeration = await tx.moderationItem.update({
          where: { id: post.moderation!.id },
          data: {
            isGlobalReview: true,
            decidedById: userId,
            decidedAt: new Date()
          }
        });

        return { post, moderation: updatedModeration, needsGlobalReview: true };
      } else {
        // Publish directly
        const updatedPost = await tx.post.update({
          where: { id: postId },
          data: { status: "PUBLISHED" },
          include: {
            author: { select: { id: true, username: true, avatarUrl: true } },
            ownerCompany: { select: { id: true, name: true, slug: true } }
          }
        });

        const updatedModeration = await tx.moderationItem.update({
          where: { id: post.moderation!.id },
          data: {
            status: "PUBLISHED",
            decidedById: userId,
            decidedAt: new Date(),
            reason: null
          }
        });

        return { post: updatedPost, moderation: updatedModeration, needsGlobalReview: false };
      }
    });

    // Notify author
    if (!result.needsGlobalReview) {
      const { notification } = await notifyCompanyContentApproved({
        targetUserId: post.authorId,
        companyId: id,
        companyName: company.name,
        companySlug: company.slug,
        contentType: "POST",
        contentId: postId,
        contentTitle: post.title,
        approverId: userId,
        approverUsername: req.user!.username
      });

      if (notification) {
        await pushNotificationToUser(post.authorId, notification);
      }
    }

    res.json({
      ok: true,
      needsGlobalReview: result.needsGlobalReview,
      post: formatPost(result.post),
      moderation: {
        id: result.moderation.id,
        status: result.moderation.status,
        isGlobalReview: result.moderation.isGlobalReview,
        decidedAt: result.moderation.decidedAt?.toISOString()
      }
    });
  } catch (err) {
    console.error("Failed to approve post:", err);
    res.status(500).json({ error: "Failed to approve post" });
  }
});

/**
 * POST /company/:id/hub/moderation/posts/:postId/needs-changes
 * Request changes on a post
 */
router.post("/:id/hub/moderation/posts/:postId/needs-changes", async (req, res) => {
  const { id, postId } = req.params;
  const userId = req.user!.id;

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
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership || !canApproveCompanyContent(membership.role)) {
      res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
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

    const company = post.ownerCompany!;

    const result = await prisma.$transaction(async (tx) => {
      const updatedPost = await tx.post.update({
        where: { id: postId },
        data: { status: "NEEDS_CHANGES" },
        include: {
          author: { select: { id: true, username: true, avatarUrl: true } },
          ownerCompany: { select: { id: true, name: true, slug: true } }
        }
      });

      const updatedModeration = await tx.moderationItem.update({
        where: { id: post.moderation!.id },
        data: {
          status: "NEEDS_CHANGES",
          decidedById: userId,
          decidedAt: new Date(),
          reason: reason ?? null,
          checklistJson: checklist ?? null
        }
      });

      return { post: updatedPost, moderation: updatedModeration };
    });

    // Notify author
    const { notification } = await notifyCompanyContentNeedsChanges({
      targetUserId: post.authorId,
      companyId: id,
      companyName: company.name,
      companySlug: company.slug,
      contentType: "POST",
      contentId: postId,
      contentTitle: post.title,
      reviewerId: userId,
      reviewerUsername: req.user!.username,
      reason,
      checklist
    });

    if (notification) {
      await pushNotificationToUser(post.authorId, notification);
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
 * POST /company/:id/hub/moderation/posts/:postId/reject
 * Reject a post
 */
router.post("/:id/hub/moderation/posts/:postId/reject", async (req, res) => {
  const { id, postId } = req.params;
  const userId = req.user!.id;

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
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership || !canApproveCompanyContent(membership.role)) {
      res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
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

    const company = post.ownerCompany!;

    const result = await prisma.$transaction(async (tx) => {
      const updatedPost = await tx.post.update({
        where: { id: postId },
        data: { status: "REJECTED" },
        include: {
          author: { select: { id: true, username: true, avatarUrl: true } },
          ownerCompany: { select: { id: true, name: true, slug: true } }
        }
      });

      const updatedModeration = await tx.moderationItem.update({
        where: { id: post.moderation!.id },
        data: {
          status: "REJECTED",
          decidedById: userId,
          decidedAt: new Date(),
          reason: reason ?? null
        }
      });

      return { post: updatedPost, moderation: updatedModeration };
    });

    // Notify author
    const { notification } = await notifyCompanyContentRejected({
      targetUserId: post.authorId,
      companyId: id,
      companyName: company.name,
      companySlug: company.slug,
      contentType: "POST",
      contentId: postId,
      contentTitle: post.title,
      reviewerId: userId,
      reviewerUsername: req.user!.username,
      reason
    });

    if (notification) {
      await pushNotificationToUser(post.authorId, notification);
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
// Helpers
// ============================================

function formatModerationItem(item: any) {
  return {
    id: item.id,
    subjectType: item.subjectType,
    projectId: item.projectId,
    postId: item.postId,
    status: item.status,
    scopeUserId: item.scopeUserId,
    scopeCompanyId: item.scopeCompanyId,
    isGlobalReview: item.isGlobalReview,
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
    ownerCompany: project.ownerCompany
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
    ownerCompany: post.ownerCompany
  };
}

export default router;
