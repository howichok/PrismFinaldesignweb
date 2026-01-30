import { Router } from "express";
import { prisma } from "@prismmtr/db";
import { authMiddleware, requireUser } from "../middleware/auth.js";
import {
  UpdateCompanyInput,
  UpdateMemberRoleInput,
  CreateInviteInput,
  CreateJoinRequestInput,
  ModerationDecisionInput,
  hasRolePermission,
  canManageRole
} from "@prismmtr/shared";
import {
  getUserCompanyMembership,
  hasCompanyRole,
  getCompanyApprovers,
  changeCompanyMemberRole,
  transferCompanyOwnership,
  removeCompanyMember,
  addCompanyMember
} from "../services/company.js";
import {
  notifyCompanyInviteReceived,
  notifyCompanyInviteAccepted,
  notifyCompanyJoinRequestReceived,
  notifyCompanyJoinRequestApproved,
  notifyCompanyJoinRequestRejected,
  notifyCompanyRoleChanged,
  notifyCompanyMemberRemoved,
  pushNotificationToUser
} from "../services/notifications.js";
import { bumpRolesVersion } from "../services/session.js";
import crypto from "crypto";

const router = Router();

// All routes require authentication
router.use(authMiddleware, requireUser);

// ============================================
// Company Hub Overview & Settings
// ============================================

/**
 * GET /company/:id/hub
 * Get company hub overview (requires membership)
 */
router.get("/:id/hub", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership) {
      res.status(403).json({ error: "Not a member of this company", code: "FORBIDDEN" });
      return;
    }

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, username: true, avatarUrl: true } },
        _count: {
          select: {
            members: true,
            projects: true,
            posts: true,
            invites: { where: { acceptedAt: null } },
            joinRequests: { where: { status: "PENDING" } }
          }
        }
      }
    });

    if (!company) {
      res.status(404).json({ error: "Company not found", code: "NOT_FOUND" });
      return;
    }

    res.json({
      company: formatCompany(company, membership.role),
      stats: {
        memberCount: company._count.members,
        projectCount: company._count.projects,
        postCount: company._count.posts,
        pendingInvites: company._count.invites,
        pendingJoinRequests: company._count.joinRequests
      },
      myRole: membership.role
    });
  } catch (err) {
    console.error("Failed to get company hub:", err);
    res.status(500).json({ error: "Failed to get company hub" });
  }
});

/**
 * PATCH /company/:id/hub/settings
 * Update company settings (OWNER/CO_OWNER only)
 */
router.patch("/:id/hub/settings", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const parsed = UpdateCompanyInput.safeParse(req.body);
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
    if (!membership || !hasRolePermission(membership.role, "CO_OWNER")) {
      res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
      return;
    }

    const updated = await prisma.company.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.publishingMode !== undefined && { publishingMode: parsed.data.publishingMode }),
        ...(parsed.data.joinMode !== undefined && { joinMode: parsed.data.joinMode }),
        ...(parsed.data.joinMessageMode !== undefined && { joinMessageMode: parsed.data.joinMessageMode }),
        ...(parsed.data.allowTrustedApproveJoinRequests !== undefined && {
          allowTrustedApproveJoinRequests: parsed.data.allowTrustedApproveJoinRequests
        })
      }
    });

    res.json(formatCompany(updated, membership.role));
  } catch (err) {
    console.error("Failed to update company settings:", err);
    res.status(500).json({ error: "Failed to update company settings" });
  }
});

// ============================================
// Members Management
// ============================================

/**
 * GET /company/:id/hub/members
 * List company members
 */
router.get("/:id/hub/members", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership) {
      res.status(403).json({ error: "Not a member of this company", code: "FORBIDDEN" });
      return;
    }

    const members = await prisma.companyMember.findMany({
      where: { companyId: id },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } }
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }]
    });

    res.json({
      items: members.map(formatMember),
      total: members.length
    });
  } catch (err) {
    console.error("Failed to list members:", err);
    res.status(500).json({ error: "Failed to list members" });
  }
});

/**
 * PATCH /company/:id/hub/members/:userId/role
 * Change a member's role
 */
router.patch("/:id/hub/members/:targetUserId/role", async (req, res) => {
  const { id, targetUserId } = req.params;
  const actorId = req.user!.id;

  const parsed = UpdateMemberRoleInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const { role: newRole } = parsed.data;

  try {
    // Get actor's membership
    const actorMembership = await getUserCompanyMembership(actorId, id);
    if (!actorMembership) {
      res.status(403).json({ error: "Not a member of this company", code: "FORBIDDEN" });
      return;
    }

    // Get target's current membership
    const targetMembership = await getUserCompanyMembership(targetUserId, id);
    if (!targetMembership) {
      res.status(404).json({ error: "Target user is not a member", code: "NOT_FOUND" });
      return;
    }

    // Check if actor can manage this role change
    if (!canManageRole(actorMembership.role, targetMembership.role)) {
      res.status(403).json({ error: "Cannot manage this member's role", code: "FORBIDDEN" });
      return;
    }

    if (!canManageRole(actorMembership.role, newRole)) {
      res.status(403).json({ error: "Cannot assign this role", code: "FORBIDDEN" });
      return;
    }

    const oldRole = targetMembership.role;

    // Change role
    const result = await changeCompanyMemberRole(id, targetUserId, newRole);
    if (!result.success) {
      res.status(409).json({ error: result.error, code: "INVALID_OPERATION" });
      return;
    }

    // Get company for notification
    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true }
    });

    // Notify target user
    if (company) {
      const { notification } = await notifyCompanyRoleChanged({
        targetUserId,
        companyId: id,
        companyName: company.name,
        companySlug: company.slug,
        changedById: actorId,
        changedByUsername: req.user!.username,
        oldRole,
        newRole
      });

      if (notification) {
        await pushNotificationToUser(targetUserId, notification);
      }
    }

    res.json({ ok: true, newRole });
  } catch (err) {
    console.error("Failed to change member role:", err);
    res.status(500).json({ error: "Failed to change member role" });
  }
});

/**
 * POST /company/:id/hub/members/:userId/remove
 * Remove a member from the company
 */
router.post("/:id/hub/members/:targetUserId/remove", async (req, res) => {
  const { id, targetUserId } = req.params;
  const actorId = req.user!.id;
  const { reason } = req.body as { reason?: string };

  try {
    const actorMembership = await getUserCompanyMembership(actorId, id);
    if (!actorMembership) {
      res.status(403).json({ error: "Not a member of this company", code: "FORBIDDEN" });
      return;
    }

    const targetMembership = await getUserCompanyMembership(targetUserId, id);
    if (!targetMembership) {
      res.status(404).json({ error: "Target user is not a member", code: "NOT_FOUND" });
      return;
    }

    // Check if actor can manage this member
    if (!canManageRole(actorMembership.role, targetMembership.role)) {
      res.status(403).json({ error: "Cannot remove this member", code: "FORBIDDEN" });
      return;
    }

    const result = await removeCompanyMember(id, targetUserId);
    if (!result.success) {
      res.status(409).json({ error: result.error, code: "INVALID_OPERATION" });
      return;
    }

    // Notify removed user
    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true }
    });

    if (company) {
      const { notification } = await notifyCompanyMemberRemoved({
        targetUserId,
        companyId: id,
        companyName: company.name,
        companySlug: company.slug,
        removedById: actorId,
        removedByUsername: req.user!.username,
        reason
      });

      if (notification) {
        await pushNotificationToUser(targetUserId, notification);
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to remove member:", err);
    res.status(500).json({ error: "Failed to remove member" });
  }
});

/**
 * POST /company/:id/hub/leave
 * Leave the company
 */
router.post("/:id/hub/leave", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership) {
      res.status(403).json({ error: "Not a member of this company", code: "FORBIDDEN" });
      return;
    }

    if (membership.role === "OWNER") {
      res.status(409).json({
        error: "Owner cannot leave. Transfer ownership first.",
        code: "INVALID_OPERATION"
      });
      return;
    }

    await prisma.companyMember.delete({
      where: { companyId_userId: { companyId: id, userId } }
    });

    // Bump rolesVersion
    await bumpRolesVersion(userId, `left_company_${id}`);

    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to leave company:", err);
    res.status(500).json({ error: "Failed to leave company" });
  }
});

/**
 * POST /company/:id/hub/transfer-ownership
 * Transfer ownership to another member
 */
router.post("/:id/hub/transfer-ownership", async (req, res) => {
  const { id } = req.params;
  const currentOwnerId = req.user!.id;
  const { newOwnerId } = req.body as { newOwnerId: string };

  if (!newOwnerId) {
    res.status(422).json({ error: "newOwnerId is required", code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const result = await transferCompanyOwnership(id, currentOwnerId, newOwnerId);
    if (!result.success) {
      res.status(409).json({ error: result.error, code: "INVALID_OPERATION" });
      return;
    }

    // Get company and new owner for notifications
    const [company, newOwner] = await Promise.all([
      prisma.company.findUnique({ where: { id }, select: { id: true, name: true, slug: true } }),
      prisma.user.findUnique({ where: { id: newOwnerId }, select: { id: true, username: true } })
    ]);

    if (company && newOwner) {
      // Notify new owner
      const { notification } = await notifyCompanyRoleChanged({
        targetUserId: newOwnerId,
        companyId: id,
        companyName: company.name,
        companySlug: company.slug,
        changedById: currentOwnerId,
        changedByUsername: req.user!.username,
        oldRole: "CO_OWNER", // Best guess
        newRole: "OWNER"
      });

      if (notification) {
        await pushNotificationToUser(newOwnerId, notification);
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to transfer ownership:", err);
    res.status(500).json({ error: "Failed to transfer ownership" });
  }
});

// ============================================
// Invites
// ============================================

/**
 * GET /company/:id/hub/invites
 * List pending invites
 */
router.get("/:id/hub/invites", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership || !hasRolePermission(membership.role, "CO_OWNER")) {
      res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
      return;
    }

    const invites = await prisma.companyInvite.findMany({
      where: { companyId: id, acceptedAt: null },
      include: {
        invitedBy: { select: { id: true, username: true } },
        invitedUser: { select: { id: true, username: true } }
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
 * POST /company/:id/hub/invites
 * Create an invite
 */
router.post("/:id/hub/invites", async (req, res) => {
  const { id } = req.params;
  const inviterId = req.user!.id;

  const parsed = CreateInviteInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const { userId: invitedUserId, email: invitedEmail, role } = parsed.data;

  try {
    const membership = await getUserCompanyMembership(inviterId, id);
    if (!membership || !hasRolePermission(membership.role, "CO_OWNER")) {
      res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
      return;
    }

    // Cannot invite to a role higher than your own (except OWNER can invite CO_OWNER)
    if (!canManageRole(membership.role, role)) {
      res.status(403).json({ error: "Cannot invite to this role", code: "FORBIDDEN" });
      return;
    }

    // Check if user is already a member
    if (invitedUserId) {
      const existingMember = await prisma.companyMember.findUnique({
        where: { companyId_userId: { companyId: id, userId: invitedUserId } }
      });
      if (existingMember) {
        res.status(409).json({ error: "User is already a member", code: "ALREADY_MEMBER" });
        return;
      }

      // Check for existing pending invite
      const existingInvite = await prisma.companyInvite.findFirst({
        where: { companyId: id, invitedUserId, acceptedAt: null }
      });
      if (existingInvite) {
        res.status(409).json({ error: "User already has a pending invite", code: "ALREADY_INVITED" });
        return;
      }
    }

    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true }
    });

    if (!company) {
      res.status(404).json({ error: "Company not found", code: "NOT_FOUND" });
      return;
    }

    const token = invitedEmail ? crypto.randomBytes(32).toString("hex") : null;

    const invite = await prisma.companyInvite.create({
      data: {
        companyId: id,
        invitedById: inviterId,
        invitedUserId: invitedUserId ?? null,
        invitedEmail: invitedEmail ?? null,
        role,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      },
      include: {
        invitedBy: { select: { id: true, username: true } },
        invitedUser: { select: { id: true, username: true } }
      }
    });

    // Notify invitee if it's a user invite
    if (invitedUserId) {
      const { notification } = await notifyCompanyInviteReceived({
        targetUserId: invitedUserId,
        companyId: id,
        companyName: company.name,
        companySlug: company.slug,
        inviterId,
        inviterUsername: req.user!.username,
        role
      });

      if (notification) {
        await pushNotificationToUser(invitedUserId, notification);
      }
    }

    // TODO: Send email for email-based invites

    res.status(201).json(formatInvite(invite));
  } catch (err) {
    console.error("Failed to create invite:", err);
    res.status(500).json({ error: "Failed to create invite" });
  }
});

/**
 * DELETE /company/:id/hub/invites/:inviteId
 * Cancel an invite
 */
router.delete("/:id/hub/invites/:inviteId", async (req, res) => {
  const { id, inviteId } = req.params;
  const userId = req.user!.id;

  try {
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership || !hasRolePermission(membership.role, "CO_OWNER")) {
      res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
      return;
    }

    const invite = await prisma.companyInvite.findUnique({
      where: { id: inviteId }
    });

    if (!invite || invite.companyId !== id) {
      res.status(404).json({ error: "Invite not found", code: "NOT_FOUND" });
      return;
    }

    if (invite.acceptedAt) {
      res.status(409).json({ error: "Invite already accepted", code: "INVALID_OPERATION" });
      return;
    }

    await prisma.companyInvite.delete({ where: { id: inviteId } });

    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to cancel invite:", err);
    res.status(500).json({ error: "Failed to cancel invite" });
  }
});

// ============================================
// Join Requests
// ============================================

/**
 * POST /company/:id/join-requests
 * Create a join request (if joinMode allows)
 */
router.post("/:id/join-requests", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const parsed = CreateJoinRequestInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const { message } = parsed.data;

  try {
    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, joinMode: true, joinMessageMode: true }
    });

    if (!company) {
      res.status(404).json({ error: "Company not found", code: "NOT_FOUND" });
      return;
    }

    if (company.joinMode !== "REQUEST_TO_JOIN") {
      res.status(409).json({ error: "Company does not accept join requests", code: "INVALID_OPERATION" });
      return;
    }

    // Check message requirement
    if (company.joinMessageMode === "REQUIRED" && !message?.trim()) {
      res.status(422).json({ error: "A message is required", code: "MESSAGE_REQUIRED" });
      return;
    }

    // Check if already a member
    const existingMember = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId: id, userId } }
    });
    if (existingMember) {
      res.status(409).json({ error: "You are already a member", code: "ALREADY_MEMBER" });
      return;
    }

    // Check for existing pending request
    const existingRequest = await prisma.companyJoinRequest.findUnique({
      where: { companyId_userId: { companyId: id, userId } }
    });
    if (existingRequest && existingRequest.status === "PENDING") {
      res.status(409).json({ error: "You already have a pending request", code: "ALREADY_REQUESTED" });
      return;
    }

    // Create or update request
    const joinRequest = existingRequest
      ? await prisma.companyJoinRequest.update({
          where: { id: existingRequest.id },
          data: {
            message: message ?? null,
            status: "PENDING",
            decidedById: null,
            decidedAt: null,
            reason: null
          },
          include: { user: { select: { id: true, username: true, avatarUrl: true } } }
        })
      : await prisma.companyJoinRequest.create({
          data: {
            companyId: id,
            userId,
            message: message ?? null
          },
          include: { user: { select: { id: true, username: true, avatarUrl: true } } }
        });

    // Notify approvers
    const approverIds = await getCompanyApprovers(id);
    for (const approverId of approverIds) {
      const { notification } = await notifyCompanyJoinRequestReceived({
        targetUserId: approverId,
        companyId: id,
        companyName: company.name,
        companySlug: company.slug,
        requesterId: userId,
        requesterUsername: req.user!.username
      });

      if (notification) {
        await pushNotificationToUser(approverId, notification);
      }
    }

    res.status(201).json(formatJoinRequest(joinRequest));
  } catch (err) {
    console.error("Failed to create join request:", err);
    res.status(500).json({ error: "Failed to create join request" });
  }
});

/**
 * GET /company/:id/hub/join-requests
 * List pending join requests
 */
router.get("/:id/hub/join-requests", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const status = req.query.status as string ?? "PENDING";

  try {
    // Check if user can approve join requests
    const membership = await getUserCompanyMembership(userId, id);
    if (!membership) {
      res.status(403).json({ error: "Not a member of this company", code: "FORBIDDEN" });
      return;
    }

    const company = await prisma.company.findUnique({
      where: { id },
      select: { allowTrustedApproveJoinRequests: true }
    });

    const canApprove = hasRolePermission(membership.role, "CO_OWNER") ||
      (company?.allowTrustedApproveJoinRequests && membership.role === "TRUSTED");

    if (!canApprove) {
      res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
      return;
    }

    const requests = await prisma.companyJoinRequest.findMany({
      where: { companyId: id, status: status as any },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        decidedBy: { select: { id: true, username: true } }
      },
      orderBy: { createdAt: "asc" }
    });

    res.json({
      items: requests.map(formatJoinRequest),
      total: requests.length
    });
  } catch (err) {
    console.error("Failed to list join requests:", err);
    res.status(500).json({ error: "Failed to list join requests" });
  }
});

/**
 * POST /company/:id/hub/join-requests/:requestId/approve
 * Approve a join request
 */
router.post("/:id/hub/join-requests/:requestId/approve", async (req, res) => {
  const { id, requestId } = req.params;
  const deciderId = req.user!.id;

  try {
    const membership = await getUserCompanyMembership(deciderId, id);
    if (!membership) {
      res.status(403).json({ error: "Not a member of this company", code: "FORBIDDEN" });
      return;
    }

    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, allowTrustedApproveJoinRequests: true }
    });

    if (!company) {
      res.status(404).json({ error: "Company not found", code: "NOT_FOUND" });
      return;
    }

    const canApprove = hasRolePermission(membership.role, "CO_OWNER") ||
      (company.allowTrustedApproveJoinRequests && membership.role === "TRUSTED");

    if (!canApprove) {
      res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
      return;
    }

    const request = await prisma.companyJoinRequest.findUnique({
      where: { id: requestId },
      include: { user: { select: { id: true, username: true } } }
    });

    if (!request || request.companyId !== id) {
      res.status(404).json({ error: "Join request not found", code: "NOT_FOUND" });
      return;
    }

    if (request.status !== "PENDING") {
      res.status(409).json({ error: "Request is not pending", code: "INVALID_STATUS" });
      return;
    }

    // Approve in transaction
    await prisma.$transaction(async (tx) => {
      // Update request status
      await tx.companyJoinRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          decidedById: deciderId,
          decidedAt: new Date()
        }
      });

      // Create membership
      await tx.companyMember.create({
        data: {
          companyId: id,
          userId: request.userId,
          role: "MEMBER"
        }
      });
    });

    // Bump user's rolesVersion
    await bumpRolesVersion(request.userId, `joined_company_${id}`);

    // Notify the user
    const { notification } = await notifyCompanyJoinRequestApproved({
      targetUserId: request.userId,
      companyId: id,
      companyName: company.name,
      companySlug: company.slug,
      decidedById: deciderId,
      decidedByUsername: req.user!.username
    });

    if (notification) {
      await pushNotificationToUser(request.userId, notification);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to approve join request:", err);
    res.status(500).json({ error: "Failed to approve join request" });
  }
});

/**
 * POST /company/:id/hub/join-requests/:requestId/reject
 * Reject a join request
 */
router.post("/:id/hub/join-requests/:requestId/reject", async (req, res) => {
  const { id, requestId } = req.params;
  const deciderId = req.user!.id;

  const parsed = ModerationDecisionInput.safeParse(req.body);
  const reason = parsed.success ? parsed.data.reason : undefined;

  try {
    const membership = await getUserCompanyMembership(deciderId, id);
    if (!membership) {
      res.status(403).json({ error: "Not a member of this company", code: "FORBIDDEN" });
      return;
    }

    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, allowTrustedApproveJoinRequests: true }
    });

    if (!company) {
      res.status(404).json({ error: "Company not found", code: "NOT_FOUND" });
      return;
    }

    const canApprove = hasRolePermission(membership.role, "CO_OWNER") ||
      (company.allowTrustedApproveJoinRequests && membership.role === "TRUSTED");

    if (!canApprove) {
      res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
      return;
    }

    const request = await prisma.companyJoinRequest.findUnique({
      where: { id: requestId }
    });

    if (!request || request.companyId !== id) {
      res.status(404).json({ error: "Join request not found", code: "NOT_FOUND" });
      return;
    }

    if (request.status !== "PENDING") {
      res.status(409).json({ error: "Request is not pending", code: "INVALID_STATUS" });
      return;
    }

    // Reject request
    await prisma.companyJoinRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        decidedById: deciderId,
        decidedAt: new Date(),
        reason: reason ?? null
      }
    });

    // Notify the user
    const { notification } = await notifyCompanyJoinRequestRejected({
      targetUserId: request.userId,
      companyId: id,
      companyName: company.name,
      companySlug: company.slug,
      decidedById: deciderId,
      decidedByUsername: req.user!.username,
      reason
    });

    if (notification) {
      await pushNotificationToUser(request.userId, notification);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to reject join request:", err);
    res.status(500).json({ error: "Failed to reject join request" });
  }
});

// ============================================
// Helpers
// ============================================

function formatCompany(company: any, myRole?: string) {
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    description: company.description,
    publishingMode: company.publishingMode,
    joinMode: company.joinMode,
    joinMessageMode: company.joinMessageMode,
    allowTrustedApproveJoinRequests: company.allowTrustedApproveJoinRequests,
    createdById: company.createdById,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
    createdBy: company.createdBy,
    myRole
  };
}

function formatMember(member: any) {
  return {
    id: member.id,
    companyId: member.companyId,
    userId: member.userId,
    role: member.role,
    createdAt: member.createdAt.toISOString(),
    user: member.user
  };
}

function formatInvite(invite: any) {
  return {
    id: invite.id,
    companyId: invite.companyId,
    invitedById: invite.invitedById,
    invitedUserId: invite.invitedUserId,
    invitedEmail: invite.invitedEmail,
    role: invite.role,
    token: invite.token,
    expiresAt: invite.expiresAt.toISOString(),
    acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    createdAt: invite.createdAt.toISOString(),
    invitedBy: invite.invitedBy,
    invitedUser: invite.invitedUser
  };
}

function formatJoinRequest(request: any) {
  return {
    id: request.id,
    companyId: request.companyId,
    userId: request.userId,
    message: request.message,
    status: request.status,
    decidedById: request.decidedById,
    decidedAt: request.decidedAt?.toISOString() ?? null,
    reason: request.reason,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    user: request.user,
    decidedBy: request.decidedBy
  };
}

export default router;
