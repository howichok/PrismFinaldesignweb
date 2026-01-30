import { prisma, type EventLog, type Notification, type Prisma } from "@prismmtr/db";
import type { NotificationPayload } from "@prismmtr/shared";
import { emitToUser } from "./socket-emitter.js";

export interface EmitEventParams {
  type: string;
  actorUserId?: string | null;
  targetUserId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface EmitEventResult {
  event: EventLog;
  notification: Notification | null;
}

/**
 * Emit an event and optionally create a notification for the target user.
 * This is the main entry point for all event logging and notifications.
 *
 * @param params Event parameters
 * @param tx Optional Prisma transaction client for transactional writes
 * @returns The created event and notification (if targetUserId was provided)
 */
export async function emitEventAndNotify(
  params: EmitEventParams,
  tx?: Prisma.TransactionClient
): Promise<EmitEventResult> {
  const client = tx ?? prisma;

  const { type, actorUserId, targetUserId, entityType, entityId, payload } = params;

  // Create the event log
  const event = await client.eventLog.create({
    data: {
      type,
      actorUserId: actorUserId ?? null,
      targetUserId: targetUserId ?? null,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      payload: payload ?? null
    }
  });

  // Create notification if there's a target user
  let notification: Notification | null = null;

  if (targetUserId) {
    notification = await client.notification.create({
      data: {
        userId: targetUserId,
        type,
        payload: payload ?? null,
        eventId: event.id
      }
    });

    // Push notification to user via Socket.io in a non-blocking way
    // We schedule this after the transaction commits to avoid emitting
    // for notifications that may be rolled back
    if (!tx) {
      // If no transaction, emit immediately
      await pushNotificationToUser(targetUserId, notification);
    } else {
      // If in transaction, schedule emission after this function returns
      // The caller should call pushNotificationToUser after commit
      // We'll store the notification to emit in the result
    }
  }

  return { event, notification };
}

/**
 * Push a notification to a user via Socket.io.
 * Fetches the authoritative unread count and emits to the user's room.
 */
export async function pushNotificationToUser(
  userId: string,
  notification: Notification
): Promise<void> {
  try {
    // Get authoritative unread count
    const unreadCount = await getUnreadCount(userId);

    // Emit to user's socket room
    emitToUser(userId, "notifications.new", {
      notification: formatNotification(notification),
      unreadCount
    });
  } catch (err) {
    console.error("[Notifications] Failed to push notification via socket:", err);
  }
}

/**
 * Create a moderation notification for project approval.
 */
export async function notifyProjectApproved(
  params: {
    projectId: string;
    projectTitle: string;
    ownerUserId: string;
    moderatorId: string;
    moderatorUsername: string;
  },
  tx?: Prisma.TransactionClient
): Promise<EmitEventResult> {
  const payload: NotificationPayload = {
    title: "Project Approved",
    message: `Your project "${params.projectTitle}" has been approved and is now published!`,
    link: `/projects/${params.projectId}`,
    projectId: params.projectId,
    projectTitle: params.projectTitle,
    moderatorId: params.moderatorId,
    moderatorUsername: params.moderatorUsername
  };

  return emitEventAndNotify(
    {
      type: "MODERATION_PROJECT_APPROVED",
      actorUserId: params.moderatorId,
      targetUserId: params.ownerUserId,
      entityType: "PROJECT",
      entityId: params.projectId,
      payload
    },
    tx
  );
}

/**
 * Create a moderation notification for project needs changes.
 */
export async function notifyProjectNeedsChanges(
  params: {
    projectId: string;
    projectTitle: string;
    ownerUserId: string;
    moderatorId: string;
    moderatorUsername: string;
    reason?: string | null;
    checklist?: unknown;
  },
  tx?: Prisma.TransactionClient
): Promise<EmitEventResult> {
  const payload: NotificationPayload = {
    title: "Changes Requested",
    message: params.reason
      ? `Your project "${params.projectTitle}" needs changes: ${params.reason.slice(0, 100)}${params.reason.length > 100 ? "..." : ""}`
      : `Your project "${params.projectTitle}" needs some changes before it can be published.`,
    link: `/dashboard/projects/${params.projectId}/edit`,
    projectId: params.projectId,
    projectTitle: params.projectTitle,
    moderatorId: params.moderatorId,
    moderatorUsername: params.moderatorUsername,
    reason: params.reason ?? undefined,
    checklist: params.checklist
  };

  return emitEventAndNotify(
    {
      type: "MODERATION_PROJECT_NEEDS_CHANGES",
      actorUserId: params.moderatorId,
      targetUserId: params.ownerUserId,
      entityType: "PROJECT",
      entityId: params.projectId,
      payload
    },
    tx
  );
}

/**
 * Create a moderation notification for project rejection.
 */
export async function notifyProjectRejected(
  params: {
    projectId: string;
    projectTitle: string;
    ownerUserId: string;
    moderatorId: string;
    moderatorUsername: string;
    reason?: string | null;
  },
  tx?: Prisma.TransactionClient
): Promise<EmitEventResult> {
  const payload: NotificationPayload = {
    title: "Project Rejected",
    message: params.reason
      ? `Your project "${params.projectTitle}" was rejected: ${params.reason.slice(0, 100)}${params.reason.length > 100 ? "..." : ""}`
      : `Your project "${params.projectTitle}" was rejected.`,
    link: `/dashboard/submissions`,
    projectId: params.projectId,
    projectTitle: params.projectTitle,
    moderatorId: params.moderatorId,
    moderatorUsername: params.moderatorUsername,
    reason: params.reason ?? undefined
  };

  return emitEventAndNotify(
    {
      type: "MODERATION_PROJECT_REJECTED",
      actorUserId: params.moderatorId,
      targetUserId: params.ownerUserId,
      entityType: "PROJECT",
      entityId: params.projectId,
      payload
    },
    tx
  );
}

// ============================================
// Post Notification Helpers
// ============================================

/**
 * Create a moderation notification for post approval.
 */
export async function notifyPostApproved(
  params: {
    postId: string;
    postTitle: string;
    ownerUserId: string;
    moderatorId: string;
    moderatorUsername: string;
  },
  tx?: Prisma.TransactionClient
): Promise<EmitEventResult> {
  const payload: NotificationPayload = {
    title: "Post Approved",
    message: `Your post "${params.postTitle}" has been approved and is now published!`,
    link: `/posts/${params.postId}`,
    postId: params.postId,
    postTitle: params.postTitle,
    moderatorId: params.moderatorId,
    moderatorUsername: params.moderatorUsername
  };

  return emitEventAndNotify(
    {
      type: "MODERATION_POST_APPROVED",
      actorUserId: params.moderatorId,
      targetUserId: params.ownerUserId,
      entityType: "POST",
      entityId: params.postId,
      payload
    },
    tx
  );
}

/**
 * Create a moderation notification for post needs changes.
 */
export async function notifyPostNeedsChanges(
  params: {
    postId: string;
    postTitle: string;
    ownerUserId: string;
    moderatorId: string;
    moderatorUsername: string;
    reason?: string | null;
    checklist?: unknown;
  },
  tx?: Prisma.TransactionClient
): Promise<EmitEventResult> {
  const payload: NotificationPayload = {
    title: "Changes Requested",
    message: params.reason
      ? `Your post "${params.postTitle}" needs changes: ${params.reason.slice(0, 100)}${params.reason.length > 100 ? "..." : ""}`
      : `Your post "${params.postTitle}" needs some changes before it can be published.`,
    link: `/dashboard/posts/${params.postId}/edit`,
    postId: params.postId,
    postTitle: params.postTitle,
    moderatorId: params.moderatorId,
    moderatorUsername: params.moderatorUsername,
    reason: params.reason ?? undefined,
    checklist: params.checklist
  };

  return emitEventAndNotify(
    {
      type: "MODERATION_POST_NEEDS_CHANGES",
      actorUserId: params.moderatorId,
      targetUserId: params.ownerUserId,
      entityType: "POST",
      entityId: params.postId,
      payload
    },
    tx
  );
}

/**
 * Create a moderation notification for post rejection.
 */
export async function notifyPostRejected(
  params: {
    postId: string;
    postTitle: string;
    ownerUserId: string;
    moderatorId: string;
    moderatorUsername: string;
    reason?: string | null;
  },
  tx?: Prisma.TransactionClient
): Promise<EmitEventResult> {
  const payload: NotificationPayload = {
    title: "Post Rejected",
    message: params.reason
      ? `Your post "${params.postTitle}" was rejected: ${params.reason.slice(0, 100)}${params.reason.length > 100 ? "..." : ""}`
      : `Your post "${params.postTitle}" was rejected.`,
    link: `/dashboard/submissions?tab=posts`,
    postId: params.postId,
    postTitle: params.postTitle,
    moderatorId: params.moderatorId,
    moderatorUsername: params.moderatorUsername,
    reason: params.reason ?? undefined
  };

  return emitEventAndNotify(
    {
      type: "MODERATION_POST_REJECTED",
      actorUserId: params.moderatorId,
      targetUserId: params.ownerUserId,
      entityType: "POST",
      entityId: params.postId,
      payload
    },
    tx
  );
}

// ============================================
// Company Notification Helpers
// ============================================

/**
 * Notify user they received a company invite
 */
export async function notifyCompanyInviteReceived(
  params: {
    targetUserId: string;
    companyId: string;
    companyName: string;
    companySlug: string;
    inviterId: string;
    inviterUsername: string;
    role: string;
  },
  tx?: Prisma.TransactionClient
): Promise<EmitEventResult> {
  const payload: NotificationPayload = {
    title: "Company Invitation",
    message: `${params.inviterUsername} invited you to join "${params.companyName}" as ${params.role}`,
    link: `/dashboard/invites`,
    companyId: params.companyId,
    companyName: params.companyName,
    companySlug: params.companySlug,
    inviterId: params.inviterId,
    inviterUsername: params.inviterUsername,
    newRole: params.role
  };

  return emitEventAndNotify(
    {
      type: "COMPANY_INVITE_RECEIVED",
      actorUserId: params.inviterId,
      targetUserId: params.targetUserId,
      entityType: "COMPANY",
      entityId: params.companyId,
      payload
    },
    tx
  );
}

/**
 * Notify inviter that their invite was accepted
 */
export async function notifyCompanyInviteAccepted(
  params: {
    targetUserId: string; // The inviter
    companyId: string;
    companyName: string;
    companySlug: string;
    acceptedByUserId: string;
    acceptedByUsername: string;
  },
  tx?: Prisma.TransactionClient
): Promise<EmitEventResult> {
  const payload: NotificationPayload = {
    title: "Invite Accepted",
    message: `${params.acceptedByUsername} accepted your invitation to join "${params.companyName}"`,
    link: `/company/${params.companyId}/hub/members`,
    companyId: params.companyId,
    companyName: params.companyName,
    companySlug: params.companySlug
  };

  return emitEventAndNotify(
    {
      type: "COMPANY_INVITE_ACCEPTED",
      actorUserId: params.acceptedByUserId,
      targetUserId: params.targetUserId,
      entityType: "COMPANY",
      entityId: params.companyId,
      payload
    },
    tx
  );
}

/**
 * Notify company approvers about a new join request
 */
export async function notifyCompanyJoinRequestReceived(
  params: {
    targetUserId: string; // An approver
    companyId: string;
    companyName: string;
    companySlug: string;
    requesterId: string;
    requesterUsername: string;
  },
  tx?: Prisma.TransactionClient
): Promise<EmitEventResult> {
  const payload: NotificationPayload = {
    title: "Join Request",
    message: `${params.requesterUsername} requested to join "${params.companyName}"`,
    link: `/company/${params.companyId}/hub/join-requests`,
    companyId: params.companyId,
    companyName: params.companyName,
    companySlug: params.companySlug
  };

  return emitEventAndNotify(
    {
      type: "COMPANY_JOIN_REQUEST_RECEIVED",
      actorUserId: params.requesterId,
      targetUserId: params.targetUserId,
      entityType: "COMPANY",
      entityId: params.companyId,
      payload
    },
    tx
  );
}

/**
 * Notify user their join request was approved
 */
export async function notifyCompanyJoinRequestApproved(
  params: {
    targetUserId: string;
    companyId: string;
    companyName: string;
    companySlug: string;
    decidedById: string;
    decidedByUsername: string;
  },
  tx?: Prisma.TransactionClient
): Promise<EmitEventResult> {
  const payload: NotificationPayload = {
    title: "Join Request Approved",
    message: `Your request to join "${params.companyName}" was approved!`,
    link: `/company/${params.companyId}/hub`,
    companyId: params.companyId,
    companyName: params.companyName,
    companySlug: params.companySlug
  };

  return emitEventAndNotify(
    {
      type: "COMPANY_JOIN_REQUEST_APPROVED",
      actorUserId: params.decidedById,
      targetUserId: params.targetUserId,
      entityType: "COMPANY",
      entityId: params.companyId,
      payload
    },
    tx
  );
}

/**
 * Notify user their join request was rejected
 */
export async function notifyCompanyJoinRequestRejected(
  params: {
    targetUserId: string;
    companyId: string;
    companyName: string;
    companySlug: string;
    decidedById: string;
    decidedByUsername: string;
    reason?: string | null;
  },
  tx?: Prisma.TransactionClient
): Promise<EmitEventResult> {
  const payload: NotificationPayload = {
    title: "Join Request Rejected",
    message: params.reason
      ? `Your request to join "${params.companyName}" was rejected: ${params.reason.slice(0, 100)}${params.reason.length > 100 ? "..." : ""}`
      : `Your request to join "${params.companyName}" was rejected.`,
    link: `/dashboard/companies`,
    companyId: params.companyId,
    companyName: params.companyName,
    companySlug: params.companySlug,
    reason: params.reason ?? undefined
  };

  return emitEventAndNotify(
    {
      type: "COMPANY_JOIN_REQUEST_REJECTED",
      actorUserId: params.decidedById,
      targetUserId: params.targetUserId,
      entityType: "COMPANY",
      entityId: params.companyId,
      payload
    },
    tx
  );
}

/**
 * Notify user their role in a company changed
 */
export async function notifyCompanyRoleChanged(
  params: {
    targetUserId: string;
    companyId: string;
    companyName: string;
    companySlug: string;
    changedById: string;
    changedByUsername: string;
    oldRole: string;
    newRole: string;
  },
  tx?: Prisma.TransactionClient
): Promise<EmitEventResult> {
  const payload: NotificationPayload = {
    title: "Role Changed",
    message: `Your role in "${params.companyName}" was changed from ${params.oldRole} to ${params.newRole}`,
    link: `/company/${params.companyId}/hub`,
    companyId: params.companyId,
    companyName: params.companyName,
    companySlug: params.companySlug,
    oldRole: params.oldRole,
    newRole: params.newRole
  };

  return emitEventAndNotify(
    {
      type: "COMPANY_ROLE_CHANGED",
      actorUserId: params.changedById,
      targetUserId: params.targetUserId,
      entityType: "COMPANY",
      entityId: params.companyId,
      payload
    },
    tx
  );
}

/**
 * Notify user they were removed from a company
 */
export async function notifyCompanyMemberRemoved(
  params: {
    targetUserId: string;
    companyId: string;
    companyName: string;
    companySlug: string;
    removedById: string;
    removedByUsername: string;
    reason?: string | null;
  },
  tx?: Prisma.TransactionClient
): Promise<EmitEventResult> {
  const payload: NotificationPayload = {
    title: "Removed from Company",
    message: params.reason
      ? `You were removed from "${params.companyName}": ${params.reason.slice(0, 100)}${params.reason.length > 100 ? "..." : ""}`
      : `You were removed from "${params.companyName}".`,
    link: `/dashboard/companies`,
    companyId: params.companyId,
    companyName: params.companyName,
    companySlug: params.companySlug,
    reason: params.reason ?? undefined
  };

  return emitEventAndNotify(
    {
      type: "COMPANY_MEMBER_REMOVED",
      actorUserId: params.removedById,
      targetUserId: params.targetUserId,
      entityType: "COMPANY",
      entityId: params.companyId,
      payload
    },
    tx
  );
}

/**
 * Notify author their company content was approved
 */
export async function notifyCompanyContentApproved(
  params: {
    targetUserId: string;
    companyId: string;
    companyName: string;
    companySlug: string;
    contentType: "PROJECT" | "POST";
    contentId: string;
    contentTitle: string;
    approverId: string;
    approverUsername: string;
  },
  tx?: Prisma.TransactionClient
): Promise<EmitEventResult> {
  const link = params.contentType === "PROJECT"
    ? `/projects/${params.contentId}`
    : `/posts/${params.contentId}`;

  const payload: NotificationPayload = {
    title: "Content Approved",
    message: `Your ${params.contentType.toLowerCase()} "${params.contentTitle}" in "${params.companyName}" was approved!`,
    link,
    companyId: params.companyId,
    companyName: params.companyName,
    companySlug: params.companySlug,
    contentType: params.contentType,
    ...(params.contentType === "PROJECT"
      ? { projectId: params.contentId, projectTitle: params.contentTitle }
      : { postId: params.contentId, postTitle: params.contentTitle })
  };

  return emitEventAndNotify(
    {
      type: "COMPANY_CONTENT_APPROVED",
      actorUserId: params.approverId,
      targetUserId: params.targetUserId,
      entityType: params.contentType,
      entityId: params.contentId,
      payload
    },
    tx
  );
}

/**
 * Notify author their company content needs changes
 */
export async function notifyCompanyContentNeedsChanges(
  params: {
    targetUserId: string;
    companyId: string;
    companyName: string;
    companySlug: string;
    contentType: "PROJECT" | "POST";
    contentId: string;
    contentTitle: string;
    reviewerId: string;
    reviewerUsername: string;
    reason?: string | null;
    checklist?: unknown;
  },
  tx?: Prisma.TransactionClient
): Promise<EmitEventResult> {
  const link = params.contentType === "PROJECT"
    ? `/company/${params.companyId}/hub/projects/${params.contentId}/edit`
    : `/company/${params.companyId}/hub/posts/${params.contentId}/edit`;

  const payload: NotificationPayload = {
    title: "Changes Requested",
    message: params.reason
      ? `Your ${params.contentType.toLowerCase()} "${params.contentTitle}" needs changes: ${params.reason.slice(0, 100)}${params.reason.length > 100 ? "..." : ""}`
      : `Your ${params.contentType.toLowerCase()} "${params.contentTitle}" needs some changes.`,
    link,
    companyId: params.companyId,
    companyName: params.companyName,
    companySlug: params.companySlug,
    contentType: params.contentType,
    reason: params.reason ?? undefined,
    checklist: params.checklist,
    ...(params.contentType === "PROJECT"
      ? { projectId: params.contentId, projectTitle: params.contentTitle }
      : { postId: params.contentId, postTitle: params.contentTitle })
  };

  return emitEventAndNotify(
    {
      type: "COMPANY_CONTENT_NEEDS_CHANGES",
      actorUserId: params.reviewerId,
      targetUserId: params.targetUserId,
      entityType: params.contentType,
      entityId: params.contentId,
      payload
    },
    tx
  );
}

/**
 * Notify author their company content was rejected
 */
export async function notifyCompanyContentRejected(
  params: {
    targetUserId: string;
    companyId: string;
    companyName: string;
    companySlug: string;
    contentType: "PROJECT" | "POST";
    contentId: string;
    contentTitle: string;
    reviewerId: string;
    reviewerUsername: string;
    reason?: string | null;
  },
  tx?: Prisma.TransactionClient
): Promise<EmitEventResult> {
  const link = `/company/${params.companyId}/hub/${params.contentType.toLowerCase()}s`;

  const payload: NotificationPayload = {
    title: "Content Rejected",
    message: params.reason
      ? `Your ${params.contentType.toLowerCase()} "${params.contentTitle}" was rejected: ${params.reason.slice(0, 100)}${params.reason.length > 100 ? "..." : ""}`
      : `Your ${params.contentType.toLowerCase()} "${params.contentTitle}" was rejected.`,
    link,
    companyId: params.companyId,
    companyName: params.companyName,
    companySlug: params.companySlug,
    contentType: params.contentType,
    reason: params.reason ?? undefined,
    ...(params.contentType === "PROJECT"
      ? { projectId: params.contentId, projectTitle: params.contentTitle }
      : { postId: params.contentId, postTitle: params.contentTitle })
  };

  return emitEventAndNotify(
    {
      type: "COMPANY_CONTENT_REJECTED",
      actorUserId: params.reviewerId,
      targetUserId: params.targetUserId,
      entityType: params.contentType,
      entityId: params.contentId,
      payload
    },
    tx
  );
}

// ============================================
// Ticket Notification Helpers
// ============================================

/**
 * Notify MOD/ADMIN that a new ticket was created
 */
export async function notifyTicketCreated(
  params: {
    targetUserId: string;
    ticketId: string;
    ticketTitle: string;
    authorId: string;
    authorUsername: string;
  },
  tx?: Prisma.TransactionClient
): Promise<EmitEventResult> {
  const payload: NotificationPayload = {
    title: "New Ticket",
    message: `New ticket: "${params.ticketTitle}"`,
    link: `/dashboard/mod/tickets/${params.ticketId}`,
    ticketId: params.ticketId,
    ticketTitle: params.ticketTitle,
    actorId: params.authorId,
    actorUsername: params.authorUsername
  };

  return emitEventAndNotify(
    {
      type: "TICKET_CREATED",
      actorUserId: params.authorId,
      targetUserId: params.targetUserId,
      entityType: "TICKET",
      entityId: params.ticketId,
      payload
    },
    tx
  );
}

/**
 * Notify user about a new message on their ticket
 */
export async function notifyTicketNewMessage(
  params: {
    targetUserId: string;
    ticketId: string;
    ticketTitle: string;
    actorId: string;
    actorUsername: string;
    isStaffReply: boolean;
  },
  tx?: Prisma.TransactionClient
): Promise<EmitEventResult> {
  const link = params.isStaffReply
    ? `/dashboard/tickets/${params.ticketId}`
    : `/dashboard/mod/tickets/${params.ticketId}`;

  const payload: NotificationPayload = {
    title: "New Ticket Reply",
    message: `${params.actorUsername} replied to ticket: "${params.ticketTitle}"`,
    link,
    ticketId: params.ticketId,
    ticketTitle: params.ticketTitle,
    actorId: params.actorId,
    actorUsername: params.actorUsername
  };

  return emitEventAndNotify(
    {
      type: "TICKET_NEW_MESSAGE",
      actorUserId: params.actorId,
      targetUserId: params.targetUserId,
      entityType: "TICKET",
      entityId: params.ticketId,
      payload
    },
    tx
  );
}

/**
 * Notify user about ticket status change
 */
export async function notifyTicketStatusUpdated(
  params: {
    targetUserId: string;
    ticketId: string;
    ticketTitle: string;
    newStatus: string;
    actorId: string;
    actorUsername: string;
  },
  tx?: Prisma.TransactionClient
): Promise<EmitEventResult> {
  const payload: NotificationPayload = {
    title: "Ticket Status Updated",
    message: `Ticket "${params.ticketTitle}" status changed to ${params.newStatus}`,
    link: `/dashboard/tickets/${params.ticketId}`,
    ticketId: params.ticketId,
    ticketTitle: params.ticketTitle,
    ticketStatus: params.newStatus,
    actorId: params.actorId,
    actorUsername: params.actorUsername
  };

  return emitEventAndNotify(
    {
      type: "TICKET_STATUS_UPDATED",
      actorUserId: params.actorId,
      targetUserId: params.targetUserId,
      entityType: "TICKET",
      entityId: params.ticketId,
      payload
    },
    tx
  );
}

/**
 * Notify MOD/ADMIN that a ticket was assigned to them
 */
export async function notifyTicketAssigned(
  params: {
    targetUserId: string;
    ticketId: string;
    ticketTitle: string;
    actorId: string;
    actorUsername: string;
  },
  tx?: Prisma.TransactionClient
): Promise<EmitEventResult> {
  const payload: NotificationPayload = {
    title: "Ticket Assigned",
    message: `You were assigned ticket: "${params.ticketTitle}"`,
    link: `/dashboard/mod/tickets/${params.ticketId}`,
    ticketId: params.ticketId,
    ticketTitle: params.ticketTitle,
    actorId: params.actorId,
    actorUsername: params.actorUsername
  };

  return emitEventAndNotify(
    {
      type: "TICKET_ASSIGNED",
      actorUserId: params.actorId,
      targetUserId: params.targetUserId,
      entityType: "TICKET",
      entityId: params.ticketId,
      payload
    },
    tx
  );
}

// ============================================
// Notification Query Helpers
// ============================================

export interface ListNotificationsParams {
  userId: string;
  cursor?: string;
  limit?: number;
  unreadOnly?: boolean;
}

export async function listNotifications(params: ListNotificationsParams) {
  const { userId, cursor, limit = 20, unreadOnly } = params;

  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(unreadOnly ? { readAt: null } : {})
  };

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1, // Fetch one extra to determine hasMore
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
  });

  const hasMore = notifications.length > limit;
  const items = hasMore ? notifications.slice(0, -1) : notifications;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  // Get counts
  const [total, unread] = await Promise.all([
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, readAt: null } })
  ]);

  return {
    items: items.map(formatNotification),
    total,
    unread,
    nextCursor
  };
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, readAt: null }
  });
}

export async function markAsRead(notificationId: string, userId: string): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId, // Ensure user owns this notification
      readAt: null
    },
    data: { readAt: new Date() }
  });

  return result.count > 0;
}

export async function markAllAsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null
    },
    data: { readAt: new Date() }
  });

  return result.count;
}

// Helper to format notification for API response
function formatNotification(notification: Notification) {
  return {
    id: notification.id,
    type: notification.type,
    payload: notification.payload,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString()
  };
}
