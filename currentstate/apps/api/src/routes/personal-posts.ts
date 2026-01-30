import { Router } from "express";
import { prisma } from "@prismmtr/db";
import { authMiddleware, requireUser } from "../middleware/auth.js";
import {
  CreatePostInput,
  UpdatePostInput,
  isEditable,
  canSubmit,
  canWithdraw
} from "@prismmtr/shared";

const router = Router();

// All routes require authentication
router.use(authMiddleware, requireUser);

/**
 * POST /personal/posts
 * Create a new draft post for the current user
 */
router.post("/", async (req, res) => {
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
    const post = await prisma.post.create({
      data: {
        title,
        body,
        ownership: "PERSONAL",
        status: "DRAFT",
        authorId: userId,
        ownerUserId: userId
      },
      include: {
        author: {
          select: { id: true, username: true, avatarUrl: true }
        }
      }
    });

    res.status(201).json(formatPost(post));
  } catch (err) {
    console.error("Failed to create post:", err);
    res.status(500).json({ error: "Failed to create post" });
  }
});

/**
 * GET /personal/posts/:id
 * Get a post by ID (must be owner or MOD/ADMIN)
 */
router.get("/:id", async (req, res) => {
  const userId = req.user!.id;
  const userRole = req.user!.globalRole;
  const { id } = req.params;

  try {
    const post = await prisma.post.findUnique({
      where: { id },
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
      }
    });

    if (!post) {
      res.status(404).json({ error: "Post not found", code: "NOT_FOUND" });
      return;
    }

    // Check ownership or mod/admin role
    const isMod = userRole === "MOD" || userRole === "ADMIN";
    if (post.ownerUserId !== userId && !isMod) {
      res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      return;
    }

    res.json(formatPost(post));
  } catch (err) {
    console.error("Failed to get post:", err);
    res.status(500).json({ error: "Failed to get post" });
  }
});

/**
 * PATCH /personal/posts/:id
 * Update a post (only if DRAFT or NEEDS_CHANGES)
 */
router.patch("/:id", async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

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
    const post = await prisma.post.findUnique({ where: { id } });

    if (!post) {
      res.status(404).json({ error: "Post not found", code: "NOT_FOUND" });
      return;
    }

    if (post.ownerUserId !== userId) {
      res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
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
      where: { id },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.body !== undefined && { body: parsed.data.body })
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
      }
    });

    res.json(formatPost(updated));
  } catch (err) {
    console.error("Failed to update post:", err);
    res.status(500).json({ error: "Failed to update post" });
  }
});

/**
 * POST /personal/posts/:id/submit
 * Submit a post for moderation
 */
router.post("/:id/submit", async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const post = await prisma.post.findUnique({
      where: { id },
      include: { moderation: true }
    });

    if (!post) {
      res.status(404).json({ error: "Post not found", code: "NOT_FOUND" });
      return;
    }

    if (post.ownerUserId !== userId) {
      res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      return;
    }

    if (!canSubmit(post.status)) {
      res.status(409).json({
        error: `Cannot submit post in ${post.status} status`,
        code: "INVALID_STATUS_TRANSITION"
      });
      return;
    }

    // Use transaction to update post and create/update moderation item
    const result = await prisma.$transaction(async (tx) => {
      // Update post status
      const updatedPost = await tx.post.update({
        where: { id },
        data: { status: "PENDING" },
        include: {
          author: {
            select: { id: true, username: true, avatarUrl: true }
          }
        }
      });

      // Create or update moderation item
      let moderation;
      if (post.moderation) {
        moderation = await tx.moderationItem.update({
          where: { id: post.moderation.id },
          data: {
            status: "PENDING",
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
            postId: id,
            status: "PENDING",
            scopeUserId: userId
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
  } catch (err) {
    console.error("Failed to submit post:", err);
    res.status(500).json({ error: "Failed to submit post" });
  }
});

/**
 * POST /personal/posts/:id/withdraw
 * Withdraw a pending post back to draft
 */
router.post("/:id/withdraw", async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const post = await prisma.post.findUnique({
      where: { id },
      include: { moderation: true }
    });

    if (!post) {
      res.status(404).json({ error: "Post not found", code: "NOT_FOUND" });
      return;
    }

    if (post.ownerUserId !== userId) {
      res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      return;
    }

    if (!canWithdraw(post.status)) {
      res.status(409).json({
        error: `Cannot withdraw post in ${post.status} status`,
        code: "INVALID_STATUS_TRANSITION"
      });
      return;
    }

    // Use transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedPost = await tx.post.update({
        where: { id },
        data: { status: "DRAFT" },
        include: {
          author: {
            select: { id: true, username: true, avatarUrl: true }
          }
        }
      });

      // Update moderation item status
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
    console.error("Failed to withdraw post:", err);
    res.status(500).json({ error: "Failed to withdraw post" });
  }
});

/**
 * DELETE /personal/posts/:id
 * Delete a draft post
 */
router.delete("/:id", async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const post = await prisma.post.findUnique({ where: { id } });

    if (!post) {
      res.status(404).json({ error: "Post not found", code: "NOT_FOUND" });
      return;
    }

    if (post.ownerUserId !== userId) {
      res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      return;
    }

    // Only allow deleting drafts
    if (post.status !== "DRAFT") {
      res.status(409).json({
        error: "Can only delete draft posts",
        code: "INVALID_STATUS_TRANSITION"
      });
      return;
    }

    await prisma.post.delete({ where: { id } });

    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete post:", err);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

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
    ownerCompanyId: post.ownerCompanyId ?? null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    author: post.author,
    ownerCompany: post.ownerCompany ?? null,
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
