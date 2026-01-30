import { Router } from "express";
import { prisma } from "@prismmtr/db";
import { authMiddleware, requireUser } from "../middleware/auth.js";
import { rateLimiters } from "../middleware/security.js";
import {
  CreateProjectInput,
  UpdateProjectInput,
  isEditable,
  canSubmit,
  canWithdraw
} from "@prismmtr/shared";
import { userMiniSelect, formatProjectDTO } from "../utils/serializers.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware, requireUser);

/**
 * POST /personal/projects
 * Create a new draft project for the current user
 */
router.post("/", rateLimiters.contentCreate, async (req, res) => {
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
    const project = await prisma.project.create({
      data: {
        title,
        description: description ?? null,
        type,
        ownership: "PERSONAL",
        status: "DRAFT",
        authorId: userId,
        ownerUserId: userId
      },
      include: {
        author: {
          select: userMiniSelect
        }
      }
    });

    res.status(201).json(formatProjectDTO(project));
  } catch (err) {
    console.error("Failed to create project:", err);
    res.status(500).json({ error: "Failed to create project" });
  }
});

/**
 * GET /personal/projects/:id
 * Get a project by ID (must be owner)
 */
router.get("/:id", async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        author: {
          select: userMiniSelect
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

    if (!project) {
      res.status(404).json({ error: "Project not found", code: "NOT_FOUND" });
      return;
    }

    // Check ownership
    if (project.ownerUserId !== userId) {
      res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      return;
    }

    res.json(formatProjectDTO(project));
  } catch (err) {
    console.error("Failed to get project:", err);
    res.status(500).json({ error: "Failed to get project" });
  }
});

/**
 * PATCH /personal/projects/:id
 * Update a project (only if DRAFT or NEEDS_CHANGES)
 */
router.patch("/:id", async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

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
    const project = await prisma.project.findUnique({ where: { id } });

    if (!project) {
      res.status(404).json({ error: "Project not found", code: "NOT_FOUND" });
      return;
    }

    if (project.ownerUserId !== userId) {
      res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
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
      where: { id },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.type !== undefined && { type: parsed.data.type })
      },
      include: {
        author: {
          select: userMiniSelect
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

    res.json(formatProjectDTO(updated));
  } catch (err) {
    console.error("Failed to update project:", err);
    res.status(500).json({ error: "Failed to update project" });
  }
});

/**
 * POST /personal/projects/:id/submit
 * Submit a project for moderation
 */
router.post("/:id/submit", rateLimiters.contentSubmit, async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { moderation: true }
    });

    if (!project) {
      res.status(404).json({ error: "Project not found", code: "NOT_FOUND" });
      return;
    }

    if (project.ownerUserId !== userId) {
      res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      return;
    }

    if (!canSubmit(project.status)) {
      res.status(409).json({
        error: `Cannot submit project in ${project.status} status`,
        code: "INVALID_STATUS_TRANSITION"
      });
      return;
    }

    // Use transaction to update project and create/update moderation item
    const result = await prisma.$transaction(async (tx) => {
      // Update project status
      const updatedProject = await tx.project.update({
        where: { id },
        data: { status: "PENDING" },
        include: {
          author: {
            select: userMiniSelect
          }
        }
      });

      // Create or update moderation item
      let moderation;
      if (project.moderation) {
        moderation = await tx.moderationItem.update({
          where: { id: project.moderation.id },
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
            subjectType: "PROJECT",
            projectId: id,
            status: "PENDING",
            scopeUserId: userId
          }
        });
      }

      return { project: updatedProject, moderation };
    });

    res.json({
      ...formatProjectDTO(result.project),
      moderation: {
        id: result.moderation.id,
        status: result.moderation.status,
        reason: result.moderation.reason,
        checklistJson: result.moderation.checklistJson,
        decidedAt: result.moderation.decidedAt?.toISOString() ?? null
      }
    });
  } catch (err) {
    console.error("Failed to submit project:", err);
    res.status(500).json({ error: "Failed to submit project" });
  }
});

/**
 * POST /personal/projects/:id/withdraw
 * Withdraw a pending project back to draft
 */
router.post("/:id/withdraw", async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { moderation: true }
    });

    if (!project) {
      res.status(404).json({ error: "Project not found", code: "NOT_FOUND" });
      return;
    }

    if (project.ownerUserId !== userId) {
      res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      return;
    }

    if (!canWithdraw(project.status)) {
      res.status(409).json({
        error: `Cannot withdraw project in ${project.status} status`,
        code: "INVALID_STATUS_TRANSITION"
      });
      return;
    }

    // Use transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedProject = await tx.project.update({
        where: { id },
        data: { status: "DRAFT" },
        include: {
          author: {
            select: userMiniSelect
          }
        }
      });

      // Update moderation item status
      if (project.moderation) {
        await tx.moderationItem.update({
          where: { id: project.moderation.id },
          data: { status: "WITHDRAWN" }
        });
      }

      return updatedProject;
    });

    res.json(formatProjectDTO(result));
  } catch (err) {
    console.error("Failed to withdraw project:", err);
    res.status(500).json({ error: "Failed to withdraw project" });
  }
});

/**
 * DELETE /personal/projects/:id
 * Delete a draft project
 */
router.delete("/:id", async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const project = await prisma.project.findUnique({ where: { id } });

    if (!project) {
      res.status(404).json({ error: "Project not found", code: "NOT_FOUND" });
      return;
    }

    if (project.ownerUserId !== userId) {
      res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      return;
    }

    // Only allow deleting drafts
    if (project.status !== "DRAFT") {
      res.status(409).json({
        error: "Can only delete draft projects",
        code: "INVALID_STATUS_TRANSITION"
      });
      return;
    }

    await prisma.project.delete({ where: { id } });

    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete project:", err);
    res.status(500).json({ error: "Failed to delete project" });
  }
});



export default router;
