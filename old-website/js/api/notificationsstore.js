/* ═══════════════════════════════════════════════════════════════════════════
   PrismMTR — Notifications Store
   CRUD operations for user notifications
   ═══════════════════════════════════════════════════════════════════════════ */

const NotificationsStore = (function () {
  'use strict';

  const BIN_ID = JSONBin.CONFIG.BINS.NOTIFICATIONS;

  // Notification types
  const TYPES = {
    PROJECT_INVITE: 'project_invite',
    PROJECT_REMOVED: 'project_removed',
    ROLE_CHANGED: 'role_changed',
    NICKNAME_APPROVED: 'nickname_approved',
    NICKNAME_DENIED: 'nickname_denied',
    SYSTEM: 'system',
    TICKET_RESPONSE: 'ticket_response',
  };

  const CATEGORIES = {
    PROJECTS: 'Projects',
    ACCOUNT: 'Account',
    SYSTEM: 'System',
    SUPPORT: 'Support',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async function getAll() {
    const data = await JSONBin.read(BIN_ID);
    return data.notifications || [];
  }

  async function getByUser(userId) {
    const notifications = await getAll();
    return notifications
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async function getUnread(userId) {
    const notifications = await getAll();
    return notifications.filter(n => n.userId === userId && !n.read);
  }

  async function getUnreadCount(userId) {
    const unread = await getUnread(userId);
    return unread.length;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async function create(notificationData) {
    const notifications = await getAll();
    
    const newNotification = {
      id: JSONBin.generateId('ntf'),
      userId: notificationData.userId,
      type: notificationData.type,
      category: notificationData.category || CATEGORIES.SYSTEM,
      title: notificationData.title,
      message: notificationData.message,
      projectId: notificationData.projectId || null,
      createdAt: JSONBin.getTimestamp(),
      read: false,
    };

    notifications.push(newNotification);
    await JSONBin.write(BIN_ID, { notifications });
    
    return newNotification;
  }

  async function markAsRead(notificationId, userId) {
    const notifications = await getAll();
    const index = notifications.findIndex(n => n.id === notificationId);
    
    if (index === -1) {
      throw new Error(`Notification not found: ${notificationId}`);
    }

    // Verify ownership
    if (notifications[index].userId !== userId) {
      throw new Error('Cannot mark another user\'s notification as read');
    }

    notifications[index].read = true;
    await JSONBin.write(BIN_ID, { notifications });
    
    return notifications[index];
  }

  async function markAllAsRead(userId) {
    const notifications = await getAll();
    
    let updated = 0;
    for (const n of notifications) {
      if (n.userId === userId && !n.read) {
        n.read = true;
        updated++;
      }
    }

    if (updated > 0) {
      await JSONBin.write(BIN_ID, { notifications });
    }
    
    return updated;
  }

  async function deleteNotification(notificationId, userId) {
    const notifications = await getAll();
    const notification = notifications.find(n => n.id === notificationId);
    
    if (!notification) {
      throw new Error(`Notification not found: ${notificationId}`);
    }

    if (notification.userId !== userId) {
      throw new Error('Cannot delete another user\'s notification');
    }

    const filtered = notifications.filter(n => n.id !== notificationId);
    await JSONBin.write(BIN_ID, { notifications: filtered });
    
    return true;
  }

  async function deleteAllForUser(userId) {
    const notifications = await getAll();
    const filtered = notifications.filter(n => n.userId !== userId);
    await JSONBin.write(BIN_ID, { notifications: filtered });
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATION CREATORS (Helper methods)
  // ═══════════════════════════════════════════════════════════════════════════

  async function notifyProjectInvite(userId, projectTitle, projectId) {
    return create({
      userId,
      type: TYPES.PROJECT_INVITE,
      category: CATEGORIES.PROJECTS,
      title: 'You were added to a project',
      message: `You are now a member of ${projectTitle}`,
      projectId,
    });
  }

  async function notifyProjectRemoved(userId, projectTitle, projectId) {
    return create({
      userId,
      type: TYPES.PROJECT_REMOVED,
      category: CATEGORIES.PROJECTS,
      title: 'Removed from project',
      message: `You have been removed from ${projectTitle}`,
      projectId,
    });
  }

  async function notifyRoleChanged(userId, newRole) {
    return create({
      userId,
      type: TYPES.ROLE_CHANGED,
      category: CATEGORIES.ACCOUNT,
      title: 'Role updated',
      message: `Your role has been changed to ${newRole}`,
    });
  }

  async function notifyNicknameApproved(userId, nickname) {
    return create({
      userId,
      type: TYPES.NICKNAME_APPROVED,
      category: CATEGORIES.ACCOUNT,
      title: 'Nickname approved',
      message: `Your nickname "${nickname}" has been approved`,
    });
  }

  async function notifyNicknameDenied(userId, reason) {
    return create({
      userId,
      type: TYPES.NICKNAME_DENIED,
      category: CATEGORIES.ACCOUNT,
      title: 'Nickname request denied',
      message: reason || 'Your nickname request was not approved',
    });
  }

  async function notifyTicketResponse(userId, ticketSubject) {
    return create({
      userId,
      type: TYPES.TICKET_RESPONSE,
      category: CATEGORIES.SUPPORT,
      title: 'Ticket response',
      message: `You received a response to: ${ticketSubject}`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    TYPES,
    CATEGORIES,
    getAll,
    getByUser,
    getUnread,
    getUnreadCount,
    create,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllForUser,
    // Notification creators
    notifyProjectInvite,
    notifyProjectRemoved,
    notifyRoleChanged,
    notifyNicknameApproved,
    notifyNicknameDenied,
    notifyTicketResponse,
  };

})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotificationsStore;
}
