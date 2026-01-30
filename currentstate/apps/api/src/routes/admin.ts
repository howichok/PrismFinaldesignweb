import { Router } from "express";
import { prisma, type Prisma } from "@prismmtr/db";
import { authMiddleware, requireUser, requireRole } from "../middleware/auth.js";
import { rateLimiters } from "../middleware/security.js";
import {
  AdminUserSearchQuery,
  AdminModerationQuery,
  UpdateUserInput,
  ModerationDecisionInput
} from "@prismmtr/shared";
import { bumpRolesVersion } from "../services/session.js";
import {
  emitEventAndNotify,
  pushNotificationToUser,
  notifyProjectApproved,
  notifyProjectNeedsChanges,
  notifyProjectRejected,
  notifyPostApproved,
  notifyPostNeedsChanges,
  notifyPostRejected
} from "../services/notifications.js";

const router = Router();

// All admin routes require authentication and ADMIN role
router.use(authMiddleware, requireUser, requireRole("ADMIN"));

// Apply admin rate limiting to all routes
router.use(rateLimiters.admin);

// ============================================
// User Search & Management
// ============================================

/**
 * GET /admin/users/search
 * Search users by username or discordId
 */
router.get("/users/search", async (req, res) => {
  const parsed = AdminUserSearchQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const { q, cursor, limit } = parsed.data;

  try {
    const where: Prisma.UserWhereInput = {
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { discordId: { contains: q, mode: "insensitive" } }
      ]
    };

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        discordId: true,
        avatarUrl: true,
        globalRole: true,
        isBanned: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    const hasMore = users.length > limit;
    const items = hasMore ? users.slice(0, -1) : users;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    res.json({
      items: items.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString()
      })),
      nextCursor
    });
  } catch (err) {
    console.error("Failed to search users:", err);
    res.status(500).json({ error: "Failed to search users" });
  }
});

/**
 * GET /admin/users/:id
 * Get detailed user information
 */
router.get("/users/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        overrides: true,
        companyMemberships: {
          include: {
            company: { select: { id: true, name: true, slug: true } }
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({ error: "User not found", code: "NOT_FOUND" });
      return;
    }

    // Get stats
    const [projectCount, postCount, ticketCount, companyCount] = await Promise.all([
      prisma.project.count({ where: { authorId: id } }),
      prisma.post.count({ where: { authorId: id } }),
      prisma.ticket.count({ where: { authorId: id } }),
      prisma.companyMember.count({ where: { userId: id } })
    ]);

    res.json({
      id: user.id,
      username: user.username,
      discordId: user.discordId,
      avatarUrl: user.avatarUrl,
      globalRole: user.globalRole,
      rolesVersion: user.rolesVersion,
      isBanned: user.isBanned,
      bannedReason: user.bannedReason,
      bannedAt: user.bannedAt?.toISOString() ?? null,
      bannedUntil: user.bannedUntil?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      overrides: user.overrides
        ? {
            canCreateProjects: user.overrides.canCreateProjects,
            canCreatePosts: user.overrides.canCreatePosts,
            canCreateCompanies: user.overrides.canCreateCompanies,
            canPublishPersonalWithoutPremod: user.overrides.canPublishPersonalWithoutPremod,
            canCreateCompanyWithoutPremod: user.overrides.canCreateCompanyWithoutPremod,
            canPublishCompanyWithoutPremod: user.overrides.canPublishCompanyWithoutPremod
          }
        : null,
      stats: {
        projectCount,
        postCount,
        ticketCount,
        companyCount
      },
      memberships: user.companyMemberships.map((m) => ({
        companyId: m.company.id,
        companyName: m.company.name,
        companySlug: m.company.slug,
        role: m.role
      }))
    });
  } catch (err) {
    console.error("Failed to get user:", err);
    res.status(500).json({ error: "Failed to get user" });
  }
});

/**
 * PATCH /admin/users/:id
 * Update user role, permissions, or ban status
 */
router.patch("/users/:id", async (req, res) => {
  const { id } = req.params;
  const adminId = req.user!.id;

  const parsed = UpdateUserInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const { globalRole, isBanned, bannedReason, bannedUntil, overrides } = parsed.data;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { overrides: true }
    });

    if (!user) {
      res.status(404).json({ error: "User not found", code: "NOT_FOUND" });
      return;
    }

    // Prevent admin from modifying their own role
    if (globalRole && id === adminId) {
      res.status(403).json({
        error: "Cannot change your own role",
        code: "SELF_ROLE_CHANGE"
      });
      return;
    }

    let needsInvalidation = false;
    const changes: Record<string, any> = {};

    // Build update data
    const userUpdateData: any = {};

    // Handle role change
    if (globalRole && globalRole !== user.globalRole) {
      userUpdateData.globalRole = globalRole;
      needsInvalidation = true;
      changes.globalRole = { from: user.globalRole, to: globalRole };
    }

    // Handle ban status
    if (isBanned !== undefined && isBanned !== user.isBanned) {
      userUpdateData.isBanned = isBanned;
      if (isBanned) {
        userUpdateData.bannedAt = new Date();
        userUpdateData.bannedReason = bannedReason ?? null;
        userUpdateData.bannedUntil = bannedUntil ? new Date(bannedUntil) : null;
        changes.banned = true;
      } else {
        userUpdateData.bannedAt = null;
        userUpdateData.bannedReason = null;
        userUpdateData.bannedUntil = null;
        changes.unbanned = true;
      }
      needsInvalidation = true;
    }

    // Handle permission overrides
    let overridesChanged = false;
    if (overrides) {
      const overrideData = {
        canCreateProjects: overrides.canCreateProjects ?? user.overrides?.canCreateProjects ?? true,
        canCreatePosts: overrides.canCreatePosts ?? user.overrides?.canCreatePosts ?? true,
        canCreateCompanies: overrides.canCreateCompanies ?? user.overrides?.canCreateCompanies ?? true,
        canPublishPersonalWithoutPremod:
          overrides.canPublishPersonalWithoutPremod ??
          user.overrides?.canPublishPersonalWithoutPremod ??
          false,
        canCreateCompanyWithoutPremod:
          overrides.canCreateCompanyWithoutPremod ??
          user.overrides?.canCreateCompanyWithoutPremod ??
          false,
        canPublishCompanyWithoutPremod:
          overrides.canPublishCompanyWithoutPremod ??
          user.overrides?.canPublishCompanyWithoutPremod ??
          false
      };

      // Check if any permission changed
      const currentOverrides = user.overrides || {
        canCreateProjects: true,
        canCreatePosts: true,
        canCreateCompanies: true,
        canPublishPersonalWithoutPremod: false,
        canCreateCompanyWithoutPremod: false,
        canPublishCompanyWithoutPremod: false
      };

      for (const [key, value] of Object.entries(overrideData)) {
        if ((currentOverrides as any)[key] !== value) {
          overridesChanged = true;
          changes[key] = { from: (currentOverrides as any)[key], to: value };
        }
      }

      if (overridesChanged) {
        await prisma.userPermissionOverrides.upsert({
          where: { userId: id },
          create: { userId: id, ...overrideData },
          update: overrideData
        });
        needsInvalidation = true;
      }
    }

    // Update user if there are changes
    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id },
        data: userUpdateData
      });
    }

    // Invalidate sessions if needed
    if (needsInvalidation) {
      await bumpRolesVersion(id, "admin_update");
    }

    // Log event
    await prisma.eventLog.create({
      data: {
        type: "ADMIN_USER_UPDATED",
        actorUserId: adminId,
        targetUserId: id,
        entityType: "USER",
        entityId: id,
        payload: changes
      }
    });

    // Send notification to user about changes
    if (Object.keys(changes).length > 0) {
      let notificationType: string | null = null;
      let message = "";

      if (changes.globalRole) {
        notificationType = "ADMIN_ROLE_CHANGED";
        message = `Your role has been changed to ${changes.globalRole.to}.`;
      } else if (changes.banned) {
        notificationType = "ADMIN_USER_BANNED";
        message = "Your account has been restricted.";
      } else if (changes.unbanned) {
        notificationType = "ADMIN_USER_UNBANNED";
        message = "Your account restrictions have been lifted.";
      } else if (overridesChanged) {
        notificationType = "ADMIN_PERMISSIONS_CHANGED";
        message = "Your account permissions have been updated.";
      }

      if (notificationType) {
        const { notification } = await emitEventAndNotify({
          type: notificationType,
          actorUserId: adminId,
          targetUserId: id,
          entityType: "USER",
          entityId: id,
          payload: {
            title: message,
            message,
            link: "/dashboard",
            changes
          }
        });

        if (notification) {
          await pushNotificationToUser(id, notification);
        }
      }
    }

    // Return updated user
    const updatedUser = await prisma.user.findUnique({
      where: { id },
      include: { overrides: true }
    });

    res.json({
      ok: true,
      user: {
        id: updatedUser!.id,
        username: updatedUser!.username,
        globalRole: updatedUser!.globalRole,
        isBanned: updatedUser!.isBanned,
        rolesVersion: updatedUser!.rolesVersion
      },
      changes,
      invalidated: needsInvalidation
    });
  } catch (err) {
    console.error("Failed to update user:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

/**
 * POST /admin/users/:id/invalidate
 * Invalidate all user sessions
 */
router.post("/users/:id/invalidate", async (req, res) => {
  const { id } = req.params;
  const adminId = req.user!.id;
  const { reason } = req.body as { reason?: string };

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: "User not found", code: "NOT_FOUND" });
      return;
    }

    await bumpRolesVersion(id, reason ?? "admin_invalidation");

    // Log event
    await prisma.eventLog.create({
      data: {
        type: "ADMIN_SESSION_INVALIDATED",
        actorUserId: adminId,
        targetUserId: id,
        entityType: "USER",
        entityId: id,
        payload: { reason }
      }
    });

    res.json({
      ok: true,
      message: `All sessions for user ${id} have been invalidated`,
      newRolesVersion: user.rolesVersion + 1
    });
  } catch (err) {
    console.error("Failed to invalidate sessions:", err);
    res.status(500).json({ error: "Failed to invalidate sessions" });
  }
});

// ============================================
// Global Moderation Queue
// ============================================

/**
 * GET /admin/moderation
 * Get unified moderation queue with filters
 */
router.get("/moderation", async (req, res) => {
  const parsed = AdminModerationQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const { subject, status, scope, cursor, limit } = parsed.data;

  try {
    const where: Prisma.ModerationItemWhereInput = {
      subjectType: subject,
      status
    };

    // Apply scope filter
    if (scope === "personal") {
      where.scopeUserId = { not: null };
      where.scopeCompanyId = null;
    } else if (scope === "company") {
      where.scopeCompanyId = { not: null };
      where.isGlobalReview = false;
    } else if (scope === "global") {
      where.isGlobalReview = true;
    }

    const items = await prisma.moderationItem.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            title: true,
            type: true,
            ownership: true,
            authorId: true,
            author: { select: { id: true, username: true } }
          }
        },
        post: {
          select: {
            id: true,
            title: true,
            ownership: true,
            authorId: true,
            author: { select: { id: true, username: true } }
          }
        },
        scopeCompany: { select: { id: true, name: true, slug: true } }
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    const hasMore = items.length > limit;
    const result = hasMore ? items.slice(0, -1) : items;
    const nextCursor = hasMore ? result[result.length - 1]?.id : null;

    res.json({
      items: result.map((item) => ({
        id: item.id,
        subjectType: item.subjectType,
        status: item.status,
        scopeUserId: item.scopeUserId,
        scopeCompanyId: item.scopeCompanyId,
        isGlobalReview: item.isGlobalReview,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        project: item.project
          ? {
              id: item.project.id,
              title: item.project.title,
              type: item.project.type,
              ownership: item.project.ownership
            }
          : null,
        post: item.post
          ? {
              id: item.post.id,
              title: item.post.title,
              ownership: item.post.ownership
            }
          : null,
        author: item.project?.author || item.post?.author || null,
        company: item.scopeCompany
      })),
      nextCursor
    });
  } catch (err) {
    console.error("Failed to get moderation queue:", err);
    res.status(500).json({ error: "Failed to get moderation queue" });
  }
});

/**
 * GET /admin/moderation/stats
 * Get moderation queue counts
 */
router.get("/moderation/stats", async (_req, res) => {
  try {
    const [personalProjects, companyProjects, globalProjects, personalPosts, companyPosts, globalPosts] =
      await Promise.all([
        prisma.moderationItem.count({
          where: { subjectType: "PROJECT", status: "PENDING", scopeUserId: { not: null }, scopeCompanyId: null }
        }),
        prisma.moderationItem.count({
          where: { subjectType: "PROJECT", status: "PENDING", scopeCompanyId: { not: null }, isGlobalReview: false }
        }),
        prisma.moderationItem.count({
          where: { subjectType: "PROJECT", status: "PENDING", isGlobalReview: true }
        }),
        prisma.moderationItem.count({
          where: { subjectType: "POST", status: "PENDING", scopeUserId: { not: null }, scopeCompanyId: null }
        }),
        prisma.moderationItem.count({
          where: { subjectType: "POST", status: "PENDING", scopeCompanyId: { not: null }, isGlobalReview: false }
        }),
        prisma.moderationItem.count({
          where: { subjectType: "POST", status: "PENDING", isGlobalReview: true }
        })
      ]);

    res.json({
      projects: {
        personal: personalProjects,
        company: companyProjects,
        global: globalProjects,
        total: personalProjects + companyProjects + globalProjects
      },
      posts: {
        personal: personalPosts,
        company: companyPosts,
        global: globalPosts,
        total: personalPosts + companyPosts + globalPosts
      }
    });
  } catch (err) {
    console.error("Failed to get moderation stats:", err);
    res.status(500).json({ error: "Failed to get moderation stats" });
  }
});

/**
 * POST /admin/moderation/projects/:id/approve
 */
router.post("/moderation/projects/:id/approve", async (req, res) => {
  const { id } = req.params;
  const adminId = req.user!.id;
  const adminUsername = req.user!.username;

  try {
    const modItem = await prisma.moderationItem.findUnique({
      where: { projectId: id },
      include: {
        project: {
          include: { author: { select: { id: true, username: true } } }
        }
      }
    });

    if (!modItem || !modItem.project) {
      res.status(404).json({ error: "Project not found", code: "NOT_FOUND" });
      return;
    }

    if (modItem.status !== "PENDING") {
      res.status(409).json({ error: "Not in pending status", code: "NOT_PENDING" });
      return;
    }

    // Update both moderation item and project
    await prisma.$transaction([
      prisma.moderationItem.update({
        where: { id: modItem.id },
        data: {
          status: "PUBLISHED",
          decidedById: adminId,
          decidedAt: new Date()
        }
      }),
      prisma.project.update({
        where: { id },
        data: { status: "PUBLISHED" }
      })
    ]);

    // Send notification to author
    const { notification } = await notifyProjectApproved({
      targetUserId: modItem.project.authorId,
      projectId: id,
      projectTitle: modItem.project.title,
      moderatorId: adminId,
      moderatorUsername: adminUsername
    });

    if (notification) {
      await pushNotificationToUser(modItem.project.authorId, notification);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to approve project:", err);
    res.status(500).json({ error: "Failed to approve project" });
  }
});

/**
 * POST /admin/moderation/projects/:id/needs-changes
 */
router.post("/moderation/projects/:id/needs-changes", async (req, res) => {
  const { id } = req.params;
  const adminId = req.user!.id;
  const adminUsername = req.user!.username;

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
    const modItem = await prisma.moderationItem.findUnique({
      where: { projectId: id },
      include: {
        project: {
          include: { author: { select: { id: true, username: true } } }
        }
      }
    });

    if (!modItem || !modItem.project) {
      res.status(404).json({ error: "Project not found", code: "NOT_FOUND" });
      return;
    }

    if (modItem.status !== "PENDING") {
      res.status(409).json({ error: "Not in pending status", code: "NOT_PENDING" });
      return;
    }

    await prisma.$transaction([
      prisma.moderationItem.update({
        where: { id: modItem.id },
        data: {
          status: "NEEDS_CHANGES",
          decidedById: adminId,
          decidedAt: new Date(),
          reason,
          checklistJson: checklist ?? null
        }
      }),
      prisma.project.update({
        where: { id },
        data: { status: "NEEDS_CHANGES" }
      })
    ]);

    const { notification } = await notifyProjectNeedsChanges({
      targetUserId: modItem.project.authorId,
      projectId: id,
      projectTitle: modItem.project.title,
      moderatorId: adminId,
      moderatorUsername: adminUsername,
      reason,
      checklist
    });

    if (notification) {
      await pushNotificationToUser(modItem.project.authorId, notification);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to request changes:", err);
    res.status(500).json({ error: "Failed to request changes" });
  }
});

/**
 * POST /admin/moderation/projects/:id/reject
 */
router.post("/moderation/projects/:id/reject", async (req, res) => {
  const { id } = req.params;
  const adminId = req.user!.id;
  const adminUsername = req.user!.username;

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
    const modItem = await prisma.moderationItem.findUnique({
      where: { projectId: id },
      include: {
        project: {
          include: { author: { select: { id: true, username: true } } }
        }
      }
    });

    if (!modItem || !modItem.project) {
      res.status(404).json({ error: "Project not found", code: "NOT_FOUND" });
      return;
    }

    if (modItem.status !== "PENDING") {
      res.status(409).json({ error: "Not in pending status", code: "NOT_PENDING" });
      return;
    }

    await prisma.$transaction([
      prisma.moderationItem.update({
        where: { id: modItem.id },
        data: {
          status: "REJECTED",
          decidedById: adminId,
          decidedAt: new Date(),
          reason
        }
      }),
      prisma.project.update({
        where: { id },
        data: { status: "REJECTED" }
      })
    ]);

    const { notification } = await notifyProjectRejected({
      targetUserId: modItem.project.authorId,
      projectId: id,
      projectTitle: modItem.project.title,
      moderatorId: adminId,
      moderatorUsername: adminUsername,
      reason
    });

    if (notification) {
      await pushNotificationToUser(modItem.project.authorId, notification);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to reject project:", err);
    res.status(500).json({ error: "Failed to reject project" });
  }
});

/**
 * POST /admin/moderation/posts/:id/approve
 */
router.post("/moderation/posts/:id/approve", async (req, res) => {
  const { id } = req.params;
  const adminId = req.user!.id;
  const adminUsername = req.user!.username;

  try {
    const modItem = await prisma.moderationItem.findUnique({
      where: { postId: id },
      include: {
        post: {
          include: { author: { select: { id: true, username: true } } }
        }
      }
    });

    if (!modItem || !modItem.post) {
      res.status(404).json({ error: "Post not found", code: "NOT_FOUND" });
      return;
    }

    if (modItem.status !== "PENDING") {
      res.status(409).json({ error: "Not in pending status", code: "NOT_PENDING" });
      return;
    }

    await prisma.$transaction([
      prisma.moderationItem.update({
        where: { id: modItem.id },
        data: {
          status: "PUBLISHED",
          decidedById: adminId,
          decidedAt: new Date()
        }
      }),
      prisma.post.update({
        where: { id },
        data: { status: "PUBLISHED" }
      })
    ]);

    const { notification } = await notifyPostApproved({
      targetUserId: modItem.post.authorId,
      postId: id,
      postTitle: modItem.post.title,
      moderatorId: adminId,
      moderatorUsername: adminUsername
    });

    if (notification) {
      await pushNotificationToUser(modItem.post.authorId, notification);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to approve post:", err);
    res.status(500).json({ error: "Failed to approve post" });
  }
});

/**
 * POST /admin/moderation/posts/:id/needs-changes
 */
router.post("/moderation/posts/:id/needs-changes", async (req, res) => {
  const { id } = req.params;
  const adminId = req.user!.id;
  const adminUsername = req.user!.username;

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
    const modItem = await prisma.moderationItem.findUnique({
      where: { postId: id },
      include: {
        post: {
          include: { author: { select: { id: true, username: true } } }
        }
      }
    });

    if (!modItem || !modItem.post) {
      res.status(404).json({ error: "Post not found", code: "NOT_FOUND" });
      return;
    }

    if (modItem.status !== "PENDING") {
      res.status(409).json({ error: "Not in pending status", code: "NOT_PENDING" });
      return;
    }

    await prisma.$transaction([
      prisma.moderationItem.update({
        where: { id: modItem.id },
        data: {
          status: "NEEDS_CHANGES",
          decidedById: adminId,
          decidedAt: new Date(),
          reason,
          checklistJson: checklist ?? null
        }
      }),
      prisma.post.update({
        where: { id },
        data: { status: "NEEDS_CHANGES" }
      })
    ]);

    const { notification } = await notifyPostNeedsChanges({
      targetUserId: modItem.post.authorId,
      postId: id,
      postTitle: modItem.post.title,
      moderatorId: adminId,
      moderatorUsername: adminUsername,
      reason,
      checklist
    });

    if (notification) {
      await pushNotificationToUser(modItem.post.authorId, notification);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to request changes:", err);
    res.status(500).json({ error: "Failed to request changes" });
  }
});

/**
 * POST /admin/moderation/posts/:id/reject
 */
router.post("/moderation/posts/:id/reject", async (req, res) => {
  const { id } = req.params;
  const adminId = req.user!.id;
  const adminUsername = req.user!.username;

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
    const modItem = await prisma.moderationItem.findUnique({
      where: { postId: id },
      include: {
        post: {
          include: { author: { select: { id: true, username: true } } }
        }
      }
    });

    if (!modItem || !modItem.post) {
      res.status(404).json({ error: "Post not found", code: "NOT_FOUND" });
      return;
    }

    if (modItem.status !== "PENDING") {
      res.status(409).json({ error: "Not in pending status", code: "NOT_PENDING" });
      return;
    }

    await prisma.$transaction([
      prisma.moderationItem.update({
        where: { id: modItem.id },
        data: {
          status: "REJECTED",
          decidedById: adminId,
          decidedAt: new Date(),
          reason
        }
      }),
      prisma.post.update({
        where: { id },
        data: { status: "REJECTED" }
      })
    ]);

    const { notification } = await notifyPostRejected({
      targetUserId: modItem.post.authorId,
      postId: id,
      postTitle: modItem.post.title,
      moderatorId: adminId,
      moderatorUsername: adminUsername,
      reason
    });

    if (notification) {
      await pushNotificationToUser(modItem.post.authorId, notification);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to reject post:", err);
    res.status(500).json({ error: "Failed to reject post" });
  }
});

/**
 * GET /admin/events
 * Get recent event logs
 */
router.get("/events", async (req, res) => {
  const cursor = req.query.cursor as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const targetUserId = req.query.targetUserId as string | undefined;

  try {
    const where: Prisma.EventLogWhereInput = {};
    if (targetUserId) {
      where.targetUserId = targetUserId;
    }

    const events = await prisma.eventLog.findMany({
      where,
      include: {
        actor: { select: { id: true, username: true } },
        target: { select: { id: true, username: true } }
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    const hasMore = events.length > limit;
    const items = hasMore ? events.slice(0, -1) : events;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    res.json({
      items: items.map((e) => ({
        id: e.id,
        type: e.type,
        actorUserId: e.actorUserId,
        actorUsername: e.actor?.username ?? null,
        targetUserId: e.targetUserId,
        targetUsername: e.target?.username ?? null,
        entityType: e.entityType,
        entityId: e.entityId,
        payload: e.payload,
        createdAt: e.createdAt.toISOString()
      })),
      nextCursor
    });
  } catch (err) {
    console.error("Failed to get events:", err);
    res.status(500).json({ error: "Failed to get events" });
  }
});

export default router;
