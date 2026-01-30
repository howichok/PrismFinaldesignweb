/* ═══════════════════════════════════════════════════════════════════════════
   PrismMTR - Admin API Client (SECURE)
   
   This module handles ALL privileged admin operations through the secure
   server-side admin-api Netlify Function.
   
   SECURITY ARCHITECTURE:
   - All role changes go through /.netlify/functions/admin-api
   - Session verification is done server-side
   - Role hierarchy is enforced server-side
   - Client cannot escalate privileges directly
   
   This replaces direct PrismBin.updateUserRole() calls which were INSECURE.
   ═══════════════════════════════════════════════════════════════════════════ */

const PrismAdmin = (function () {
  'use strict';

  const ADMIN_ENDPOINT = '/.netlify/functions/admin-api';

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER: Make secure admin request
  // ═══════════════════════════════════════════════════════════════════════════

  async function adminRequest(action, data = {}) {
    // Get current session user ID
    const currentUser = typeof PrismAuth !== 'undefined' ? PrismAuth.getUser() : null;
    
    if (!currentUser?.id) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(ADMIN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          sessionUserId: currentUser.id,
          data,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Request failed: ${response.status}`);
      }

      return result;
    } catch (error) {
      console.error('[PrismAdmin] Request failed:', error.message);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Update user role (SECURE - server-side verified)
   * @param {string} targetUserId - The user to update
   * @param {string} newRole - 'user' | 'mod' | 'admin'
   */
  async function updateUserRole(targetUserId, newRole) {
    return adminRequest('updateUserRole', { targetUserId, newRole });
  }

  /**
   * Update user data (non-role fields)
   * @param {string} targetUserId - The user to update
   * @param {object} updates - Fields to update (role is stripped server-side)
   */
  async function updateUser(targetUserId, updates) {
    return adminRequest('updateUser', { targetUserId, updates });
  }

  /**
   * Delete user (Admin only)
   * @param {string} targetUserId - The user to delete
   */
  async function deleteUser(targetUserId) {
    return adminRequest('deleteUser', { targetUserId });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create project (Admin panel)
   * @param {object} project - Project data
   */
  async function createProject(project) {
    return adminRequest('createProject', { project });
  }

  /**
   * Update project
   * @param {string} projectId - Project to update
   * @param {object} updates - Fields to update
   */
  async function updateProject(projectId, updates) {
    return adminRequest('updateProject', { projectId, updates });
  }

  /**
   * Delete project
   * @param {string} projectId - Project to delete
   */
  async function deleteProject(projectId) {
    return adminRequest('deleteProject', { projectId });
  }

  /**
   * Add member to project
   * @param {string} projectId - Project ID
   * @param {string} userId - User to add
   * @param {string} role - 'coowner' | 'member'
   */
  async function addProjectMember(projectId, userId, role = 'member') {
    return adminRequest('addProjectMember', { projectId, userId, role });
  }

  /**
   * Remove member from project
   * @param {string} projectId - Project ID
   * @param {string} userId - User to remove
   */
  async function removeProjectMember(projectId, userId) {
    return adminRequest('removeProjectMember', { projectId, userId });
  }

  /**
   * Change project owner (Admin only)
   * @param {string} projectId - Project ID
   * @param {string} newOwnerId - New owner's user ID
   */
  async function changeProjectOwner(projectId, newOwnerId) {
    return adminRequest('changeProjectOwner', { projectId, newOwnerId });
  }

  /**
   * Change member role within project
   * @param {string} projectId - Project ID
   * @param {string} userId - User whose role to change
   * @param {string} newRole - 'coowner' | 'member'
   */
  async function changeProjectMemberRole(projectId, userId, newRole) {
    // Remove from current position and add to new
    await removeProjectMember(projectId, userId);
    await addProjectMember(projectId, userId, newRole);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISSION HELPERS (Client-side hints only - real enforcement is server-side)
  // ═══════════════════════════════════════════════════════════════════════════

  const ROLE_HIERARCHY = { user: 1, mod: 2, admin: 3 };

  function hasPermission(userRole, requiredRole) {
    return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
  }

  function canEditUser(actorRole, targetRole) {
    if (actorRole === 'admin') return true;
    if (actorRole === 'mod' && targetRole === 'user') return true;
    return false;
  }

  function canAssignRole(actorRole, newRole) {
    if (newRole === 'admin') return actorRole === 'admin';
    if (actorRole === 'admin') return true;
    if (actorRole === 'mod') return newRole === 'user';
    return false;
  }

  function isStaff() {
    const user = typeof PrismAuth !== 'undefined' ? PrismAuth.getUser() : null;
    const role = user?.role || 'user';
    return role === 'mod' || role === 'admin';
  }

  function isAdmin() {
    const user = typeof PrismAuth !== 'undefined' ? PrismAuth.getUser() : null;
    return user?.role === 'admin';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // User Management
    updateUserRole,
    updateUser,
    deleteUser,

    // Project Management
    createProject,
    updateProject,
    deleteProject,
    addProjectMember,
    removeProjectMember,
    changeProjectOwner,
    changeProjectMemberRole,

    // Permission Helpers
    hasPermission,
    canEditUser,
    canAssignRole,
    isStaff,
    isAdmin,
    ROLE_HIERARCHY,
  };

})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrismAdmin;
}
