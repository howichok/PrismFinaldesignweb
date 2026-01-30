import { Router } from "express";
import { prisma } from "@prismmtr/db";
import { authMiddleware, requireUser } from "../middleware/auth.js";
import { bumpRolesVersion } from "../services/session.js";
import {
  notifyCompanyInviteAccepted,
  pushNotificationToUser
} from "../services/notifications.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware, requireUser);

/**
 * GET /dashboard/invites
 * List pending invites for the current user
 */
router.get("/", async (req, res) => {
  const userId = req.user!.id;

  try {
    const invites = await prisma.companyInvite.findMany({
      where: {
        invitedUserId: userId,
        acceptedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: {
        company: {
          select: { id: true, name: true, slug: true, description: true }
        },
        invitedBy: { select: { id: true, username: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({
      items: invites.map(formatInvite),
      total: invites.length
    });
  } catch (err) {
    console.error("Failed to list invites:", err);
    res.status(500).json({ error: "Failed to list invites" });
  }
});

/**
 * POST /dashboard/invites/:id/accept
 * Accept an invite (by ID)
 */
router.post("/:id/accept", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const invite = await prisma.companyInvite.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, slug: true } }
      }
    });

    if (!invite) {
      res.status(404).json({ error: "Invite not found", code: "NOT_FOUND" });
      return;
    }

    if (invite.invitedUserId !== userId) {
      res.status(403).json({ error: "This invite is not for you", code: "FORBIDDEN" });
      return;
    }

    if (invite.acceptedAt) {
      res.status(409).json({ error: "Invite already accepted", code: "ALREADY_ACCEPTED" });
      return;
    }

    if (invite.expiresAt < new Date()) {
      res.status(409).json({ error: "Invite has expired", code: "EXPIRED" });
      return;
    }

    // Check if already a member
    const existingMember = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId: invite.companyId, userId } }
    });

    if (existingMember) {
      // Already a member, just mark invite as accepted
      await prisma.companyInvite.update({
        where: { id },
        data: { acceptedAt: new Date() }
      });

      res.json({
        ok: true,
        company: invite.company,
        alreadyMember: true
      });
      return;
    }

    // Accept invite and create membership
    await prisma.$transaction(async (tx) => {
      // Mark invite as accepted
      await tx.companyInvite.update({
        where: { id },
        data: { acceptedAt: new Date() }
      });

      // Create membership
      await tx.companyMember.create({
        data: {
          companyId: invite.companyId,
          userId,
          role: invite.role
        }
      });
    });

    // Bump user's rolesVersion
    await bumpRolesVersion(userId, `joined_company_${invite.companyId}`);

    // Notify the inviter
    const { notification } = await notifyCompanyInviteAccepted({
      targetUserId: invite.invitedById,
      companyId: invite.companyId,
      companyName: invite.company.name,
      companySlug: invite.company.slug,
      acceptedByUserId: userId,
      acceptedByUsername: req.user!.username
    });

    if (notification) {
      await pushNotificationToUser(invite.invitedById, notification);
    }

    res.json({
      ok: true,
      company: invite.company,
      role: invite.role
    });
  } catch (err) {
    console.error("Failed to accept invite:", err);
    res.status(500).json({ error: "Failed to accept invite" });
  }
});

/**
 * POST /dashboard/invites/:id/reject
 * Reject an invite
 */
router.post("/:id/reject", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const invite = await prisma.companyInvite.findUnique({
      where: { id }
    });

    if (!invite) {
      res.status(404).json({ error: "Invite not found", code: "NOT_FOUND" });
      return;
    }

    if (invite.invitedUserId !== userId) {
      res.status(403).json({ error: "This invite is not for you", code: "FORBIDDEN" });
      return;
    }

    if (invite.acceptedAt) {
      res.status(409).json({ error: "Invite already accepted", code: "ALREADY_ACCEPTED" });
      return;
    }

    // Delete the invite
    await prisma.companyInvite.delete({ where: { id } });

    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to reject invite:", err);
    res.status(500).json({ error: "Failed to reject invite" });
  }
});

/**
 * POST /invites/token/:token/accept
 * Accept an email-based invite by token
 */
router.post("/token/:token/accept", async (req, res) => {
  const { token } = req.params;
  const userId = req.user!.id;
  const userEmail = req.user!.email; // Assuming email is available

  try {
    const invite = await prisma.companyInvite.findUnique({
      where: { token },
      include: {
        company: { select: { id: true, name: true, slug: true } }
      }
    });

    if (!invite) {
      res.status(404).json({ error: "Invite not found", code: "NOT_FOUND" });
      return;
    }

    if (invite.acceptedAt) {
      res.status(409).json({ error: "Invite already accepted", code: "ALREADY_ACCEPTED" });
      return;
    }

    if (invite.expiresAt < new Date()) {
      res.status(409).json({ error: "Invite has expired", code: "EXPIRED" });
      return;
    }

    // Check if already a member
    const existingMember = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId: invite.companyId, userId } }
    });

    if (existingMember) {
      await prisma.companyInvite.update({
        where: { token },
        data: { acceptedAt: new Date() }
      });

      res.json({
        ok: true,
        company: invite.company,
        alreadyMember: true
      });
      return;
    }

    // Accept and create membership
    await prisma.$transaction(async (tx) => {
      await tx.companyInvite.update({
        where: { token },
        data: { acceptedAt: new Date() }
      });

      await tx.companyMember.create({
        data: {
          companyId: invite.companyId,
          userId,
          role: invite.role
        }
      });
    });

    // Bump user's rolesVersion
    await bumpRolesVersion(userId, `joined_company_${invite.companyId}`);

    // Notify the inviter
    const { notification } = await notifyCompanyInviteAccepted({
      targetUserId: invite.invitedById,
      companyId: invite.companyId,
      companyName: invite.company.name,
      companySlug: invite.company.slug,
      acceptedByUserId: userId,
      acceptedByUsername: req.user!.username
    });

    if (notification) {
      await pushNotificationToUser(invite.invitedById, notification);
    }

    res.json({
      ok: true,
      company: invite.company,
      role: invite.role
    });
  } catch (err) {
    console.error("Failed to accept invite by token:", err);
    res.status(500).json({ error: "Failed to accept invite" });
  }
});

// ============================================
// Helpers
// ============================================

function formatInvite(invite: any) {
  return {
    id: invite.id,
    companyId: invite.companyId,
    invitedById: invite.invitedById,
    invitedUserId: invite.invitedUserId,
    invitedEmail: invite.invitedEmail,
    role: invite.role,
    expiresAt: invite.expiresAt.toISOString(),
    acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    createdAt: invite.createdAt.toISOString(),
    company: invite.company,
    invitedBy: invite.invitedBy
  };
}

export default router;
