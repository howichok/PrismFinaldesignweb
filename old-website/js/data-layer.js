/* ═══════════════════════════════════════════════════════════════════════════
   PrismMTR — Unified Data Layer

   Central module for all data operations. Provides:
   - Constants for all modules/domains
   - Adapters for each entity type
   - Unified API that abstracts the storage backend
   - Transition support from JSONBin to Supabase

   USAGE:
   Replace PrismBin calls with PrismDB calls for new code.
   PrismDB automatically uses Supabase when available, falls back to JSONBin.
   ═══════════════════════════════════════════════════════════════════════════ */

const PrismDB = (function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  const CONFIG = {
    // Debug mode
    DEBUG: !window.location.origin.includes('prismmtr.org') &&
           !window.location.origin.includes('netlify.app'),

    // Cache TTL in milliseconds
    CACHE_TTL: 30000,
  };

  const log = CONFIG.DEBUG ? console.log.bind(console, '[PrismDB]') : () => {};
  const warn = CONFIG.DEBUG ? console.warn.bind(console, '[PrismDB]') : () => {};

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════

  const MODULES = {
    USERS: 'users',
    COMPANIES: 'companies',
    COMPANY_MEMBERS: 'company_members',
    PROJECTS: 'projects',
    PROJECT_MEMBERS: 'project_members',
    POSTS: 'posts',
    NOTIFICATIONS: 'notifications',
    INVITATIONS: 'invitations',
    COLLABORATIONS: 'collaborations',
    COMPANY_CONTENT: 'company_content',
    MODERATION_REQUESTS: 'moderation_requests',
    NICKNAME_REQUESTS: 'nickname_requests',
    ROLE_PERMISSIONS: 'role_permissions',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // USER CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════

  const USER_ROLES = {
    USER: 'user',
    MOD: 'mod',
    ADMIN: 'admin',
  };

  const ROLE_HIERARCHY = {
    user: 1,
    mod: 2,
    admin: 3,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════

  const PROJECT_CATEGORIES = {
    BUILDING: 'building',
    STATION: 'station',
    LINE_SECTION: 'line_section',
    LINE: 'line',
  };

  const CATEGORY_LABELS = {
    building: 'Building',
    station: 'Station',
    line_section: 'Line Section',
    line: 'Line',
  };

  const PROJECT_ROLES = {
    OWNER: 'owner',
    COOWNER: 'coowner',
    MEMBER: 'member',
  };

  const PROJECT_STATUS = {
    DRAFT: 'draft',
    PENDING: 'pending',
    PUBLISHED: 'published',
    ARCHIVED: 'archived',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // POST CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════

  const POST_CATEGORIES = {
    NEWS: 'news',
    UPDATE: 'update',
    ANNOUNCEMENT: 'announcement',
    GUIDE: 'guide',
    SHOWCASE: 'showcase',
  };

  const POST_STATUS = {
    DRAFT: 'draft',
    PENDING: 'pending',
    PUBLISHED: 'published',
    ARCHIVED: 'archived',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPANY CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════

  const COMPANY_ROLES = {
    OWNER: 'owner',
    ADMIN: 'admin',
    MEMBER: 'member',
  };

  const COMPANY_ROLE_HIERARCHY = {
    member: 1,
    admin: 2,
    owner: 3,
  };

  const COMPANY_CATEGORIES = {
    TRANSIT: 'transit',
    RAILWAY: 'railway',
    METRO: 'metro',
    AIRLINE: 'airline',
    OTHER: 'other',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // INVITATION CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════

  const INVITATION_STATUS = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    DECLINED: 'declined',
    EXPIRED: 'expired',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MODERATION CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════

  const MODERATION_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    REVISION_REQUESTED: 'revision_requested',
  };

  const MODERATION_TYPES = {
    CREATE_CONTENT: 'create_content',
    EDIT_CONTENT: 'edit_content',
    CREATE_PROJECT: 'create_project',
    CREATE_POST: 'create_post',
    CHANGE_NICKNAME: 'change_nickname',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISSION CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════

  const PERMISSION_TYPES = {
    CREATE_PROJECT: 'create_project',
    CREATE_POST: 'create_post',
    TRUSTED_MEMBER: 'trusted_member',
    ADMIN_ACCESS: 'admin_access',
  };

  const DEFAULT_ROLE_PERMISSIONS = {
    user: {
      create_project: false,
      create_post: false,
      trusted_member: false,
      admin_access: false,
    },
    mod: {
      create_project: true,
      create_post: true,
      trusted_member: true,
      admin_access: true,
    },
    admin: {
      create_project: true,
      create_post: true,
      trusted_member: true,
      admin_access: true,
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTENT TYPE CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════

  const CONTENT_TYPES = {
    LINE: 'line',
    STATION: 'station',
    BUILDING: 'building',
  };

  const COLLABORATION_STATUS = {
    PENDING: 'pending',
    ACTIVE: 'active',
    DECLINED: 'declined',
    CANCELLED: 'cancelled',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CACHE
  // ═══════════════════════════════════════════════════════════════════════════

  const cache = {
    data: {},
    lastFetch: {},
  };

  function isCacheValid(key) {
    const lastFetch = cache.lastFetch[key];
    return lastFetch && (Date.now() - lastFetch < CONFIG.CACHE_TTL);
  }

  function setCache(key, data) {
    cache.data[key] = data;
    cache.lastFetch[key] = Date.now();
  }

  function getCache(key) {
    if (isCacheValid(key)) {
      return cache.data[key];
    }
    return null;
  }

  /**
   * Invalidate cache after mutation
   * Clears: data-layer cache, apiFetch cache, SW cache
   */
  function invalidateCache(key) {
    // 1. Clear data-layer in-memory cache
    if (key) {
      delete cache.data[key];
      delete cache.lastFetch[key];
    } else {
      cache.data = {};
      cache.lastFetch = {};
    }
    
    // 2. Clear apiFetch cache
    if (typeof apiFetch !== 'undefined' && key) {
      apiFetch.invalidateEntity(key);
    }
    
    // 3. Notify Service Worker to clear its cache
    if (navigator.serviceWorker?.controller && key) {
      const actionMap = {
        users: ['getUsers', 'getUserById', 'getMyProfile'],
        companies: ['getCompanies', 'getPublicCompanies', 'getMyCompanies'],
        projects: ['getProjects', 'getPublicProjects', 'getMyProjects'],
        posts: ['getPosts', 'getPublicPosts', 'getMyPosts'],
        notifications: ['getNotifications', 'getMyNotifications'],
      };
      
      const actions = actionMap[key] || [];
      actions.forEach(action => {
        navigator.serviceWorker.controller.postMessage({
          type: 'INVALIDATE_CACHE',
          payload: { action, isPrivate: key !== 'companies' && key !== 'projects' && key !== 'posts' }
        });
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BACKEND SELECTION
  // ═══════════════════════════════════════════════════════════════════════════

  function getBackend() {
    // PrismData (Supabase) is the only backend now
    if (window.PrismData) {
      return window.PrismData;
    }
    // PrismBin is an alias for PrismData (set in supabase.js)
    if (window.PrismBin) {
      return window.PrismBin;
    }
    throw new Error('No data backend available. Make sure supabase.js is loaded.');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISSION HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  function hasPermission(userRole, requiredRole) {
    return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
  }

  function hasCompanyPermission(userRole, requiredRole) {
    return (COMPANY_ROLE_HIERARCHY[userRole] || 0) >= (COMPANY_ROLE_HIERARCHY[requiredRole] || 0);
  }

  function getRolePermissions(role) {
    return DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.user;
  }

  function checkUserPermissionSync(user, permissionType) {
    if (!user) return false;

    // Check user-specific override first
    if (user.permissionOverrides && typeof user.permissionOverrides[permissionType] === 'boolean') {
      return user.permissionOverrides[permissionType];
    }

    // Fall back to role permissions
    const rolePerms = getRolePermissions(user.role || 'user');
    return rolePerms[permissionType] || false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER ADAPTER
  // ═══════════════════════════════════════════════════════════════════════════

  const Users = {
    async getAll(forceRefresh = false) {
      if (!forceRefresh) {
        const cached = getCache(MODULES.USERS);
        if (cached) return cached;
      }

      const backend = getBackend();
      const data = await backend.getUsers(forceRefresh);
      setCache(MODULES.USERS, data);
      return data;
    },

    async getById(userId) {
      const users = await this.getAll();
      return users.find(u => u.id === userId) || null;
    },

    async getByEmail(email) {
      const users = await this.getAll();
      return users.find(u => u.email?.toLowerCase() === email?.toLowerCase()) || null;
    },

    async create(userData) {
      const backend = getBackend();
      const result = await backend.createUser?.(userData) || await backend.saveUsers?.([...(await this.getAll()), userData]);
      invalidateCache(MODULES.USERS);
      return result;
    },

    async update(userId, updates) {
      const backend = getBackend();
      const result = await backend.updateUser(userId, updates);
      invalidateCache(MODULES.USERS);
      return result;
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPANY ADAPTER
  // ═══════════════════════════════════════════════════════════════════════════

  const Companies = {
    async getAll(forceRefresh = false) {
      if (!forceRefresh) {
        const cached = getCache(MODULES.COMPANIES);
        if (cached) return cached;
      }

      const backend = getBackend();
      const data = await backend.getCompanies(forceRefresh);
      setCache(MODULES.COMPANIES, data);
      return data;
    },

    async getById(companyId) {
      const companies = await this.getAll();
      return companies.find(c => c.id === companyId) || null;
    },

    async getByUser(userId) {
      const companies = await this.getAll();
      return companies.filter(c =>
        c.ownerId === userId ||
        c.members?.some(m => m.userId === userId || m.id === userId)
      );
    },

    async create(companyData) {
      const backend = getBackend();
      const result = await backend.createCompany(companyData);
      invalidateCache(MODULES.COMPANIES);
      return result;
    },

    async update(companyId, updates) {
      const backend = getBackend();
      const result = await backend.updateCompany(companyId, updates);
      invalidateCache(MODULES.COMPANIES);
      return result;
    },

    async delete(companyId) {
      const backend = getBackend();
      await backend.deleteCompany(companyId);
      invalidateCache(MODULES.COMPANIES);
    },

    async getUserRole(companyId, userId) {
      const company = await this.getById(companyId);
      if (!company) return null;
      if (company.ownerId === userId) return 'owner';
      const member = company.members?.find(m => m.userId === userId || m.id === userId);
      return member?.role || null;
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT ADAPTER
  // ═══════════════════════════════════════════════════════════════════════════

  const Projects = {
    async getAll(forceRefresh = false) {
      if (!forceRefresh) {
        const cached = getCache(MODULES.PROJECTS);
        if (cached) return cached;
      }

      const backend = getBackend();
      const data = await backend.getProjects(forceRefresh);
      setCache(MODULES.PROJECTS, data);
      return data;
    },

    async getById(projectId) {
      const projects = await this.getAll();
      return projects.find(p => p.id === projectId) || null;
    },

    async getByUser(userId) {
      const projects = await this.getAll();
      return projects.filter(p =>
        p.ownerId === userId ||
        p.coowners?.includes(userId) ||
        p.members?.includes(userId)
      );
    },

    async getByCompany(companyId) {
      const projects = await this.getAll();
      return projects.filter(p => p.companyId === companyId);
    },

    async create(projectData) {
      const backend = getBackend();
      const result = await backend.createProject(projectData);
      invalidateCache(MODULES.PROJECTS);
      return result;
    },

    async update(projectId, updates) {
      const backend = getBackend();
      const result = await backend.updateProject(projectId, updates);
      invalidateCache(MODULES.PROJECTS);
      return result;
    },

    async delete(projectId) {
      const backend = getBackend();
      await backend.deleteProject(projectId);
      invalidateCache(MODULES.PROJECTS);
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // POST ADAPTER
  // ═══════════════════════════════════════════════════════════════════════════

  const Posts = {
    async getAll(forceRefresh = false) {
      if (!forceRefresh) {
        const cached = getCache(MODULES.POSTS);
        if (cached) return cached;
      }

      const backend = getBackend();
      const data = await backend.getPosts?.(forceRefresh) || [];
      setCache(MODULES.POSTS, data);
      return data;
    },

    async getById(postId) {
      const posts = await this.getAll();
      return posts.find(p => p.id === postId) || null;
    },

    async getByUser(userId) {
      const posts = await this.getAll();
      return posts.filter(p => p.authorId === userId);
    },

    async getPublished() {
      const posts = await this.getAll();
      return posts.filter(p => p.status === 'published');
    },

    async create(postData) {
      const backend = getBackend();
      const result = await backend.createPost(postData);
      invalidateCache(MODULES.POSTS);
      return result;
    },

    async update(postId, updates) {
      const backend = getBackend();
      const result = await backend.updatePost(postId, updates);
      invalidateCache(MODULES.POSTS);
      return result;
    },

    async delete(postId) {
      const backend = getBackend();
      await backend.deletePost(postId);
      invalidateCache(MODULES.POSTS);
    },

    async publish(postId) {
      return this.update(postId, {
        status: 'published',
        publishedAt: new Date().toISOString()
      });
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATION ADAPTER
  // ═══════════════════════════════════════════════════════════════════════════

  const Notifications = {
    async getForUser(userId, forceRefresh = false) {
      const cacheKey = `${MODULES.NOTIFICATIONS}_${userId}`;
      if (!forceRefresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
      }

      const backend = getBackend();
      const data = await backend.getNotifications?.(userId, forceRefresh) || [];
      setCache(cacheKey, data);
      return data;
    },

    async create(notificationData) {
      const backend = getBackend();
      const result = await backend.createNotification(notificationData);
      invalidateCache(MODULES.NOTIFICATIONS);
      return result;
    },

    async markRead(notificationId) {
      const backend = getBackend();
      await backend.markNotificationRead(notificationId);
      invalidateCache(MODULES.NOTIFICATIONS);
    },

    async markAllRead(userId) {
      const backend = getBackend();
      await backend.markAllNotificationsRead(userId);
      invalidateCache(MODULES.NOTIFICATIONS);
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MODERATION ADAPTER
  // ═══════════════════════════════════════════════════════════════════════════

  const Moderation = {
    async getAll(forceRefresh = false) {
      if (!forceRefresh) {
        const cached = getCache(MODULES.MODERATION_REQUESTS);
        if (cached) return cached;
      }

      const backend = getBackend();
      const data = await backend.getModerationRequests?.(forceRefresh) || [];
      setCache(MODULES.MODERATION_REQUESTS, data);
      return data;
    },

    async getPending() {
      const all = await this.getAll();
      return all.filter(r => r.status === MODERATION_STATUS.PENDING);
    },

    async create(requestData) {
      const backend = getBackend();
      const result = await backend.createModerationRequest(requestData);
      invalidateCache(MODULES.MODERATION_REQUESTS);
      return result;
    },

    async approve(requestId, moderatorId, reason = '') {
      const backend = getBackend();
      const result = await backend.updateModerationRequest(requestId, {
        status: MODERATION_STATUS.APPROVED,
        moderatorId,
        reason,
        resolvedAt: new Date().toISOString(),
      });
      invalidateCache(MODULES.MODERATION_REQUESTS);
      return result;
    },

    async reject(requestId, moderatorId, reason = '') {
      const backend = getBackend();
      const result = await backend.updateModerationRequest(requestId, {
        status: MODERATION_STATUS.REJECTED,
        moderatorId,
        reason,
        resolvedAt: new Date().toISOString(),
      });
      invalidateCache(MODULES.MODERATION_REQUESTS);
      return result;
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // NICKNAME REQUEST ADAPTER (Username Change Moderation)
  // ═══════════════════════════════════════════════════════════════════════════

  const NicknameRequests = {
    async getAll(forceRefresh = false) {
      if (!forceRefresh) {
        const cached = getCache(MODULES.NICKNAME_REQUESTS);
        if (cached) return cached;
      }

      const backend = getBackend();
      const data = await backend.getNicknameRequests?.(forceRefresh) || [];
      setCache(MODULES.NICKNAME_REQUESTS, data);
      return data;
    },

    async getPending() {
      const all = await this.getAll();
      return all.filter(r => r.status === 'pending');
    },

    async getByUser(userId) {
      const all = await this.getAll();
      return all.filter(r => r.userId === userId);
    },

    async hasPendingRequest(userId) {
      const userRequests = await this.getByUser(userId);
      return userRequests.some(r => r.status === 'pending');
    },

    async create(userId, currentNickname, requestedNickname) {
      // Check if user already has a pending request
      const hasPending = await this.hasPendingRequest(userId);
      if (hasPending) {
        throw new Error('You already have a pending nickname request');
      }

      const backend = getBackend();
      const request = {
        id: crypto.randomUUID(),
        userId,
        currentNickname,
        requestedNickname,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      const result = await backend.createNicknameRequest?.(request) ||
                     await this._legacySave(request);

      invalidateCache(MODULES.NICKNAME_REQUESTS);
      return result;
    },

    async approve(requestId, moderatorId, reason = '') {
      const requests = await this.getAll(true);
      const request = requests.find(r => r.id === requestId);

      if (!request) throw new Error('Request not found');
      if (request.status !== 'pending') throw new Error('Request already processed');

      // Update the user's nickname
      await Users.update(request.userId, {
        mcNickname: request.requestedNickname
      });

      // Update the request status
      const backend = getBackend();
      const updatedRequest = {
        ...request,
        status: 'approved',
        moderatorId,
        reason,
        resolvedAt: new Date().toISOString(),
      };

      await backend.updateNicknameRequest?.(requestId, updatedRequest) ||
            await this._legacyUpdate(requests, requestId, updatedRequest);

      invalidateCache(MODULES.NICKNAME_REQUESTS);
      invalidateCache(MODULES.USERS);

      // Create notification for user
      await Notifications.create({
        userId: request.userId,
        type: 'nickname_approved',
        title: 'Nickname Change Approved',
        message: `Your nickname has been changed to "${request.requestedNickname}"`,
        data: { newNickname: request.requestedNickname },
      });

      return updatedRequest;
    },

    async reject(requestId, moderatorId, reason = '') {
      const requests = await this.getAll(true);
      const request = requests.find(r => r.id === requestId);

      if (!request) throw new Error('Request not found');
      if (request.status !== 'pending') throw new Error('Request already processed');

      const backend = getBackend();
      const updatedRequest = {
        ...request,
        status: 'rejected',
        moderatorId,
        reason,
        resolvedAt: new Date().toISOString(),
      };

      await backend.updateNicknameRequest?.(requestId, updatedRequest) ||
            await this._legacyUpdate(requests, requestId, updatedRequest);

      invalidateCache(MODULES.NICKNAME_REQUESTS);

      // Create notification for user
      await Notifications.create({
        userId: request.userId,
        type: 'nickname_rejected',
        title: 'Nickname Change Rejected',
        message: reason || 'Your nickname change request was not approved',
        data: { requestedNickname: request.requestedNickname, reason },
      });

      return updatedRequest;
    },

    // Legacy fallback for JSONBin
    async _legacySave(request) {
      const all = await this.getAll(true);
      all.push(request);
      await getBackend().saveNicknameRequests?.({ requests: all });
      return request;
    },

    async _legacyUpdate(requests, requestId, updatedRequest) {
      const index = requests.findIndex(r => r.id === requestId);
      if (index !== -1) {
        requests[index] = updatedRequest;
        await getBackend().saveNicknameRequests?.({ requests });
      }
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // INVITATION ADAPTER
  // ═══════════════════════════════════════════════════════════════════════════

  const Invitations = {
    async getAll(forceRefresh = false) {
      if (!forceRefresh) {
        const cached = getCache(MODULES.INVITATIONS);
        if (cached) return cached;
      }

      const backend = getBackend();
      const data = await backend.getInvitations?.(forceRefresh) || [];
      setCache(MODULES.INVITATIONS, data);
      return data;
    },

    async getForUser(email) {
      const all = await this.getAll();
      return all.filter(i =>
        i.inviteeEmail?.toLowerCase() === email?.toLowerCase() &&
        i.status === 'pending'
      );
    },

    async getByCompany(companyId) {
      const all = await this.getAll();
      return all.filter(i => i.companyId === companyId);
    },

    async create(invitationData) {
      const backend = getBackend();
      const result = await backend.createInvitation(invitationData);
      invalidateCache(MODULES.INVITATIONS);
      return result;
    },

    async accept(invitationId, userId) {
      const backend = getBackend();
      const result = await backend.updateInvitation(invitationId, {
        status: 'accepted',
        inviteeId: userId,
        respondedAt: new Date().toISOString(),
      });
      invalidateCache(MODULES.INVITATIONS);
      invalidateCache(MODULES.COMPANIES);
      return result;
    },

    async decline(invitationId) {
      const backend = getBackend();
      const result = await backend.updateInvitation(invitationId, {
        status: 'declined',
        respondedAt: new Date().toISOString(),
      });
      invalidateCache(MODULES.INVITATIONS);
      return result;
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // Configuration
    CONFIG,

    // Module names
    MODULES,

    // User constants
    USER_ROLES,
    ROLE_HIERARCHY,
    PERMISSION_TYPES,
    DEFAULT_ROLE_PERMISSIONS,

    // Project constants
    PROJECT_CATEGORIES,
    CATEGORY_LABELS,
    PROJECT_ROLES,
    PROJECT_STATUS,

    // Post constants
    POST_CATEGORIES,
    POST_STATUS,

    // Company constants
    COMPANY_ROLES,
    COMPANY_ROLE_HIERARCHY,
    COMPANY_CATEGORIES,

    // Other constants
    INVITATION_STATUS,
    MODERATION_STATUS,
    MODERATION_TYPES,
    CONTENT_TYPES,
    COLLABORATION_STATUS,

    // Permission helpers
    hasPermission,
    hasCompanyPermission,
    getRolePermissions,
    checkUserPermissionSync,

    // Adapters
    Users,
    Companies,
    Projects,
    Posts,
    Notifications,
    Moderation,
    NicknameRequests,
    Invitations,

    // Cache control
    invalidateCache,

    // Backend access (for advanced use)
    getBackend,
  };
})();

// Export to window for browser use
if (typeof window !== 'undefined') {
  window.PrismDB = PrismDB;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrismDB;
}
