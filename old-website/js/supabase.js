/* ═══════════════════════════════════════════════════════════════════════════
   PrismMTR — Supabase Data Module

   Main data layer for PrismMTR using Supabase as the backend.
   Exports as both PrismData and PrismBin (for backward compatibility).

   IMPORTANT: Add these environment variables to Netlify:
   - SUPABASE_URL: Your Supabase project URL
   - SUPABASE_ANON_KEY: Your Supabase anon/public key
   - SUPABASE_SERVICE_KEY: Your Supabase service role key (for server-side only)
   ═══════════════════════════════════════════════════════════════════════════ */

const PrismData = (function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // DEBUG LOGGING
  // ═══════════════════════════════════════════════════════════════════════════

  const DEBUG = !window.location.origin.includes('prismmtr.org') &&
                !window.location.origin.includes('netlify.app');

  const log = DEBUG ? console.log.bind(console) : () => {};
  const warn = DEBUG ? console.warn.bind(console) : () => {};

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  const PROXY_ENDPOINT = '/.netlify/functions/supabase-proxy';

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTANTS
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

  const PERMISSION_TYPES = {
    CREATE_PROJECT: 'create_project',
    CREATE_POST: 'create_post',
    CREATE_COMPANY: 'create_company',
    TRUSTED_MEMBER: 'trusted_member',
    ADMIN_ACCESS: 'admin_access',
  };

  const PERMISSION_LABELS = {
    create_project: 'Create Project',
    create_post: 'Create Post',
    create_company: 'Create Company',
    trusted_member: 'Trusted Member',
    admin_access: 'Admin Access',
  };

  const PERMISSION_DESCRIPTIONS = {
    create_project: 'Can create new projects and objects',
    create_post: 'Can create and publish posts',
    create_company: 'Can create new companies',
    trusted_member: 'Bypass moderation for content',
    admin_access: 'Access admin panel and tools',
  };

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

  const INVITATION_STATUS = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    DECLINED: 'declined',
    EXPIRED: 'expired',
  };

  const COLLABORATION_STATUS = {
    PENDING: 'pending',
    ACTIVE: 'active',
    DECLINED: 'declined',
    CANCELLED: 'cancelled',
  };

  const CONTENT_TYPES = {
    LINE: 'line',
    STATION: 'station',
    BUILDING: 'building',
  };

  const CONTENT_TYPE_LABELS = {
    line: 'Line',
    station: 'Station',
    building: 'Building',
  };

  const CONTENT_TYPE_ICONS = {
    line: '🚇',
    station: '🚉',
    building: '🏢',
  };

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
  };

  const MODERATION_TYPE_LABELS = {
    create_content: 'Create Content',
    edit_content: 'Edit Content',
    create_project: 'Create Project',
    create_post: 'Create Post',
  };

  const POST_CATEGORIES = {
    UPDATE: 'update',
    ANNOUNCEMENT: 'announcement',
    TUTORIAL: 'tutorial',
    SHOWCASE: 'showcase',
  };

  const POST_CATEGORY_LABELS = {
    update: 'Update',
    announcement: 'Announcement',
    tutorial: 'Tutorial',
    showcase: 'Showcase',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CACHE
  // ═══════════════════════════════════════════════════════════════════════════

  const cache = {
    users: null,
    projects: null,
    posts: null,
    companies: null,
    invitations: null,
    collaborations: null,
    companyContent: null,
    moderationRequests: null,
    nicknameRequests: null,
    notifications: null,
    lastFetch: {},
  };

  const CACHE_TTL = 10000; // 10 seconds - short TTL to keep data fresh
  const CACHE_CLEAN_INTERVAL = 15000; // 15 seconds - auto-prune stale cache
  const CACHE_REFRESH_AGE = 5000; // 5 seconds - background refresh threshold
  const AUTO_REFRESH_INTERVAL = 12000; // 12 seconds - background refresh cadence

  function isCacheValid(key) {
    const lastFetch = cache.lastFetch[key];
    if (!lastFetch) return false;
    if (Date.now() - lastFetch >= CACHE_TTL) {
      cache[key] = null;
      cache.lastFetch[key] = 0;
      return false;
    }
    return true;
  }

  function pruneCache() {
    const now = Date.now();
    Object.keys(cache.lastFetch).forEach(key => {
      const lastFetch = cache.lastFetch[key];
      if (!lastFetch || (now - lastFetch >= CACHE_TTL)) {
        cache[key] = null;
        cache.lastFetch[key] = 0;
      }
    });
  }

  function refreshKey(key) {
    switch (key) {
      case 'projects':
        return getProjects(true);
      case 'posts':
        return getPosts(true);
      case 'users':
        return getUsers(true);
      case 'companies':
        return getCompanies(true);
      default:
        return Promise.resolve();
    }
  }

  function startAutoRefresh() {
    if (typeof window === 'undefined') return;
    if (startAutoRefresh._timer) return;

    const keys = ['projects', 'posts', 'users', 'companies'];
    startAutoRefresh._timer = setInterval(() => {
      if (document.hidden) return;
      const now = Date.now();
      keys.forEach(key => {
        const lastFetch = cache.lastFetch[key];
        if (lastFetch && (now - lastFetch >= CACHE_REFRESH_AGE)) {
          refreshKey(key).catch(() => {});
        }
      });
    }, AUTO_REFRESH_INTERVAL);
  }

  // Auto-clean cache periodically to avoid stale data
  if (typeof window !== 'undefined') {
    setInterval(pruneCache, CACHE_CLEAN_INTERVAL);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) pruneCache();
    });
    startAutoRefresh();
  }

  function invalidateCache(key) {
    if (key) {
      cache[key] = null;
      cache.lastFetch[key] = 0;
    } else {
      // Invalidate all
      Object.keys(cache).forEach(k => {
        if (k !== 'lastFetch') cache[k] = null;
      });
      cache.lastFetch = {};
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BACKGROUND PREFETCHING
  // ═══════════════════════════════════════════════════════════════════════════

  const prefetchState = {
    isRunning: false,
    completed: new Set(),
    queue: [],
  };

  // Priority levels for prefetching (lower = higher priority)
  const PREFETCH_PRIORITY = {
    projects: 1,    // Most commonly accessed
    posts: 2,       // Second most common
    users: 3,       // Needed for display names
    companies: 4,   // Less frequent
  };

  /**
   * Start background prefetching of commonly used data
   * Uses requestIdleCallback for minimal impact on page performance
   */
  function startPrefetch() {
    if (prefetchState.isRunning) return;
    
    prefetchState.isRunning = true;
    prefetchState.queue = Object.keys(PREFETCH_PRIORITY)
      .sort((a, b) => PREFETCH_PRIORITY[a] - PREFETCH_PRIORITY[b]);
    
    log('[PrismData] Starting background prefetch...');
    
    // Use requestIdleCallback if available, otherwise setTimeout
    const scheduleNext = window.requestIdleCallback || 
      ((cb) => setTimeout(cb, 100));
    
    function processQueue(deadline) {
      // Process items while we have idle time (at least 10ms)
      while (prefetchState.queue.length > 0) {
        const hasIdleTime = deadline?.timeRemaining?.() > 10 || !deadline;
        
        if (!hasIdleTime) {
          // Schedule next batch
          scheduleNext(processQueue);
          return;
        }
        
        const key = prefetchState.queue.shift();
        if (!prefetchState.completed.has(key) && !isCacheValid(key)) {
          prefetchItem(key);
          prefetchState.completed.add(key);
        }
      }
      
      prefetchState.isRunning = false;
      log('[PrismData] Background prefetch complete');
    }
    
    // Start after a small delay to let critical resources load first
    setTimeout(() => scheduleNext(processQueue), 500);
  }

  /**
   * Prefetch a single data type without blocking
   */
  async function prefetchItem(key) {
    try {
      log(`[PrismData] Prefetching ${key}...`);
      
      switch (key) {
        case 'projects':
          await getProjects();
          break;
        case 'posts':
          await getPosts();
          break;
        case 'users':
          await getUsers();
          break;
        case 'companies':
          await getCompanies();
          break;
      }
    } catch (error) {
      // Silent fail for prefetch - it's just optimization
      warn(`[PrismData] Prefetch failed for ${key}:`, error.message);
    }
  }

  /**
   * Prefetch specific data types on demand
   * Useful when navigating to a page that will need certain data
   */
  function prefetchFor(page) {
    const pageData = {
      'projects': ['projects', 'users'],
      'posts': ['posts', 'users'],
      'discovery': ['projects', 'posts', 'companies'],
      'dashboard': ['users', 'companies', 'projects', 'posts'],
    };
    
    const keys = pageData[page] || [];
    keys.forEach(key => {
      if (!isCacheValid(key)) {
        prefetchItem(key);
      }
    });
  }

  // Auto-start prefetch when page loads and is idle
  if (typeof window !== 'undefined') {
    // Start prefetch after page is fully loaded
    if (document.readyState === 'complete') {
      startPrefetch();
    } else {
      window.addEventListener('load', () => {
        // Additional delay to not compete with other scripts
        setTimeout(startPrefetch, 1000);
      });
    }
    
    // Prefetch when user is about to navigate (hover on nav links)
    document.addEventListener('mouseover', (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;
      
      const href = link.getAttribute('href') || '';
      if (href.includes('projects')) prefetchFor('projects');
      else if (href.includes('posts')) prefetchFor('posts');
      else if (href.includes('discovery')) prefetchFor('discovery');
      else if (href.includes('dashboard')) prefetchFor('dashboard');
    }, { passive: true });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROXY REQUEST
  // ═══════════════════════════════════════════════════════════════════════════

  async function proxyRequest(action, data = null) {
    console.log(`[PrismData] proxyRequest: ${action}`, data ? JSON.stringify(data, null, 2) : 'no data');
    try {
      const response = await fetch(PROXY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[PrismData] Request failed (${response.status}):`, errorData);
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      const result = await response.json();
      console.log(`[PrismData] proxyRequest ${action} result:`, result);
      return result;
    } catch (error) {
      console.error('[PrismData] Request failed:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISSION HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  function hasPermission(userRole, requiredRole) {
    return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
  }

  /**
   * Check if a user role has permission for a specific action in a company
   * @param {string} role - User's role in company (owner, admin, member)
   * @param {string} action - Action to check: 'manage_company', 'manage_members', 'create_post_as_company', 'create_project_as_company'
   * @returns {boolean}
   */
  function hasCompanyPermission(role, action) {
    if (!role) return false;
    
    // Role hierarchy check for simple comparisons
    if (typeof action === 'string' && ['owner', 'admin', 'member'].includes(action)) {
      return (COMPANY_ROLE_HIERARCHY[role] || 0) >= (COMPANY_ROLE_HIERARCHY[action] || 0);
    }
    
    // Action-based permission check
    switch (action) {
      case 'manage_company':
        // Only owner can manage company settings
        return role === 'owner';
      
      case 'manage_members':
        // Owner and admin can manage members
        return role === 'owner' || role === 'admin';
      
      case 'create_post_as_company':
        // Owner and admin can post as company
        return role === 'owner' || role === 'admin';
      
      case 'create_project_as_company':
        // Owner and admin can create projects as company
        return role === 'owner' || role === 'admin';
      
      case 'view':
        // All members can view
        return !!role;
      
      default:
        // Default: check role hierarchy
        return (COMPANY_ROLE_HIERARCHY[role] || 0) >= (COMPANY_ROLE_HIERARCHY[action] || 0);
    }
  }

  // Default permissions by role
  const DEFAULT_ROLE_PERMISSIONS = {
    user: {
      create_project: false,
      create_post: false,
      create_company: false,
      trusted_member: false,
      admin_access: false,
    },
    mod: {
      create_project: true,
      create_post: true,
      create_company: true,
      trusted_member: true,
      admin_access: true,
    },
    admin: {
      create_project: true,
      create_post: true,
      create_company: true,
      trusted_member: true,
      admin_access: true,
    },
  };

  let customRolePermissions = null;

  function getRolePermissions(role) {
    const defaults = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.user;
    if (!customRolePermissions || !customRolePermissions[role]) {
      return { ...defaults };
    }
    return { ...defaults, ...customRolePermissions[role] };
  }

  function checkUserPermissionSync(user, permissionType) {
    if (!user) return false;

    if (user.permissionOverrides && typeof user.permissionOverrides[permissionType] === 'boolean') {
      return user.permissionOverrides[permissionType];
    }

    const rolePerms = getRolePermissions(user.role || 'user');
    return rolePerms[permissionType] || false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════════════════════════════════════════

  async function getUsers(forceRefresh = false) {
    if (!forceRefresh && cache.users && isCacheValid('users')) {
      log('[PrismData] Using cached users');
      return cache.users;
    }

    try {
      log('[PrismData] Fetching users...');
      const data = await proxyRequest('getUsers');
      cache.users = data || [];
      cache.lastFetch.users = Date.now();
      return cache.users;
    } catch (error) {
      console.error('[PrismData] Failed to fetch users:', error);
      if (cache.users) return cache.users;
      throw error;
    }
  }

  async function getUserById(userId) {
    const users = await getUsers();
    return users.find(u => u.id === userId) || null;
  }

  async function getUserByEmail(email) {
    const users = await getUsers();
    return users.find(u => u.email?.toLowerCase() === email?.toLowerCase()) || null;
  }

  async function createUser(userData) {
    try {
      const result = await proxyRequest('createUser', userData);
      invalidateCache('users');
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to create user:', error);
      throw error;
    }
  }

  async function updateUser(userId, updates) {
    try {
      const result = await proxyRequest('updateUser', { userId, updates });
      invalidateCache('users');
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to update user:', error);
      throw error;
    }
  }

  async function saveUsers(users) {
    // Use the dedicated saveUsers proxy endpoint for batch operations
    try {
      const result = await proxyRequest('saveUsers', { users });
      invalidateCache('users');
      // Return the result which includes saved users with real database UUIDs
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to save users:', error);
      throw error;
    }
  }

  async function deleteUser(userId) {
    try {
      await proxyRequest('deleteUser', { userId });
      invalidateCache('users');
      return true;
    } catch (error) {
      console.error('[PrismData] Failed to delete user:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECTS
  // ═══════════════════════════════════════════════════════════════════════════

  async function getProjects(forceRefresh = false) {
    if (!forceRefresh && cache.projects && isCacheValid('projects')) {
      return cache.projects;
    }

    try {
      const data = await proxyRequest('getProjects');
      cache.projects = data || [];
      cache.lastFetch.projects = Date.now();
      return cache.projects;
    } catch (error) {
      console.error('[PrismData] Failed to fetch projects:', error);
      if (cache.projects) return cache.projects;
      throw error;
    }
  }

  async function getProjectById(projectId) {
    const projects = await getProjects();
    return projects.find(p => p.id === projectId) || null;
  }

  async function createProject(projectData) {
    try {
      const result = await proxyRequest('createProject', projectData);
      invalidateCache('projects');
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to create project:', error);
      throw error;
    }
  }

  async function updateProject(projectId, updates) {
    try {
      const result = await proxyRequest('updateProject', { projectId, updates });
      invalidateCache('projects');
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to update project:', error);
      throw error;
    }
  }

  async function deleteProject(projectId) {
    try {
      await proxyRequest('deleteProject', { projectId });
      invalidateCache('projects');
      return true;
    } catch (error) {
      console.error('[PrismData] Failed to delete project:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POSTS
  // ═══════════════════════════════════════════════════════════════════════════

  async function getPosts(forceRefresh = false) {
    if (!forceRefresh && cache.posts && isCacheValid('posts')) {
      return cache.posts;
    }

    try {
      const data = await proxyRequest('getPosts');
      cache.posts = data || [];
      cache.lastFetch.posts = Date.now();
      return cache.posts;
    } catch (error) {
      console.error('[PrismData] Failed to fetch posts:', error);
      if (cache.posts) return cache.posts;
      throw error;
    }
  }

  async function getPostById(postId) {
    const posts = await getPosts();
    return posts.find(p => p.id === postId) || null;
  }

  async function createPost(postData) {
    try {
      const result = await proxyRequest('createPost', postData);
      invalidateCache('posts');
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to create post:', error);
      throw error;
    }
  }

  async function updatePost(postId, updates) {
    try {
      const result = await proxyRequest('updatePost', { postId, updates });
      invalidateCache('posts');
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to update post:', error);
      throw error;
    }
  }

  async function deletePost(postId) {
    try {
      await proxyRequest('deletePost', { postId });
      invalidateCache('posts');
      return true;
    } catch (error) {
      console.error('[PrismData] Failed to delete post:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPANIES
  // ═══════════════════════════════════════════════════════════════════════════

  async function getCompanies(forceRefresh = false) {
    if (!forceRefresh && cache.companies && isCacheValid('companies')) {
      return cache.companies;
    }

    try {
      const data = await proxyRequest('getCompanies');
      cache.companies = data || [];
      cache.lastFetch.companies = Date.now();
      return cache.companies;
    } catch (error) {
      console.error('[PrismData] Failed to fetch companies:', error);
      if (cache.companies) return cache.companies;
      throw error;
    }
  }

  async function getCompanyById(companyId) {
    const companies = await getCompanies();
    return companies.find(c => c.id === companyId) || null;
  }

  async function getCompanyBySlug(slug) {
    const companies = await getCompanies();
    return companies.find(c => c.slug === slug) || null;
  }

  async function createCompany(companyData) {
    try {
      console.log('[PrismData] createCompany called with:', JSON.stringify(companyData, null, 2));
      const result = await proxyRequest('createCompany', companyData);
      console.log('[PrismData] createCompany result:', result);
      
      if (!result) {
        throw new Error('No result returned from createCompany');
      }
      
      // Invalidate cache to force refresh
      invalidateCache('companies');
      cache.companies = null;
      cache.lastFetch.companies = 0;
      
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to create company:', error);
      console.error('[PrismData] Error details:', error.message, error.stack);
      throw error;
    }
  }

  async function updateCompany(companyId, updates) {
    try {
      const result = await proxyRequest('updateCompany', { companyId, updates });
      invalidateCache('companies');
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to update company:', error);
      throw error;
    }
  }

  async function deleteCompany(companyId) {
    try {
      await proxyRequest('deleteCompany', { companyId });
      invalidateCache('companies');
      return true;
    } catch (error) {
      console.error('[PrismData] Failed to delete company:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async function getNotifications(userId, forceRefresh = false) {
    // Ensure userId is a string UUID, not an object
    const userIdStr = typeof userId === 'string' ? userId : (userId?.id || String(userId));
    
    const cacheKey = `notifications_${userIdStr}`;
    if (!forceRefresh && cache.notifications && isCacheValid('notifications')) {
      return cache.notifications.filter(n => n.user_id === userIdStr || n.userId === userIdStr);
    }

    try {
      const data = await proxyRequest('getNotifications', { userId: userIdStr });
      cache.notifications = data || [];
      cache.lastFetch.notifications = Date.now();
      return cache.notifications.filter(n => n.user_id === userIdStr || n.userId === userIdStr);
    } catch (error) {
      console.error('[PrismData] Failed to fetch notifications:', error);
      if (cache.notifications) return cache.notifications.filter(n => n.user_id === userIdStr || n.userId === userIdStr);
      throw error;
    }
  }

  async function createNotification(userIdOrData, type, title, message) {
    // Support both old API (4 args) and new API (object)
    let notificationData;
    if (typeof userIdOrData === 'object') {
      notificationData = userIdOrData;
    } else {
      notificationData = {
        user_id: userIdOrData,
        type: type,
        title: title,
        message: message
      };
    }
    
    try {
      const result = await proxyRequest('createNotification', notificationData);
      invalidateCache('notifications');
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to create notification:', error);
      throw error;
    }
  }

  async function markNotificationRead(notificationId) {
    try {
      await proxyRequest('markNotificationRead', { notificationId });
      invalidateCache('notifications');
      return true;
    } catch (error) {
      console.error('[PrismData] Failed to mark notification read:', error);
      throw error;
    }
  }

  async function markAllNotificationsRead(userId) {
    try {
      await proxyRequest('markAllNotificationsRead', { userId });
      invalidateCache('notifications');
      return true;
    } catch (error) {
      console.error('[PrismData] Failed to mark all notifications read:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INVITATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async function getInvitations(forceRefresh = false) {
    if (!forceRefresh && cache.invitations && isCacheValid('invitations')) {
      return cache.invitations;
    }

    try {
      const data = await proxyRequest('getInvitations');
      cache.invitations = data || [];
      cache.lastFetch.invitations = Date.now();
      return cache.invitations;
    } catch (error) {
      console.error('[PrismData] Failed to fetch invitations:', error);
      if (cache.invitations) return cache.invitations;
      throw error;
    }
  }

  async function createInvitation(companyIdOrData, inviterId, invitedUsername, role) {
    // Support both old API (4 args) and new API (object)
    let invitationData;
    if (typeof companyIdOrData === 'object') {
      invitationData = companyIdOrData;
    } else {
      invitationData = {
        companyId: companyIdOrData,
        inviterId,
        invitedUsername,
        role
      };
    }
    
    try {
      const result = await proxyRequest('createInvitation', invitationData);
      invalidateCache('invitations');
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to create invitation:', error);
      throw error;
    }
  }

  async function updateInvitation(invitationId, updates) {
    try {
      const result = await proxyRequest('updateInvitation', { invitationId, updates });
      invalidateCache('invitations');
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to update invitation:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODERATION REQUESTS
  // ═══════════════════════════════════════════════════════════════════════════

  async function getModerationRequests(forceRefresh = false) {
    if (!forceRefresh && cache.moderationRequests && isCacheValid('moderationRequests')) {
      return cache.moderationRequests;
    }

    try {
      const data = await proxyRequest('getModerationRequests');
      cache.moderationRequests = data || [];
      cache.lastFetch.moderationRequests = Date.now();
      return cache.moderationRequests;
    } catch (error) {
      console.error('[PrismData] Failed to fetch moderation requests:', error);
      if (cache.moderationRequests) return cache.moderationRequests;
      throw error;
    }
  }

  async function createModerationRequest(requestData) {
    // Map userId to requester_id for database compatibility
    const dbData = {
      ...requestData,
      requester_id: requestData.userId || requestData.requester_id,
    };
    delete dbData.userId;
    
    try {
      const result = await proxyRequest('createModerationRequest', dbData);
      invalidateCache('moderationRequests');
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to create moderation request:', error);
      throw error;
    }
  }

  async function updateModerationRequest(requestId, updates) {
    try {
      const result = await proxyRequest('updateModerationRequest', { requestId, updates });
      invalidateCache('moderationRequests');
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to update moderation request:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NICKNAME REQUESTS
  // ═══════════════════════════════════════════════════════════════════════════

  async function getNicknameRequests(forceRefresh = false) {
    if (!forceRefresh && cache.nicknameRequests && isCacheValid('nicknameRequests')) {
      return cache.nicknameRequests;
    }

    try {
      const data = await proxyRequest('getNicknameRequests');
      cache.nicknameRequests = data || [];
      cache.lastFetch.nicknameRequests = Date.now();
      return cache.nicknameRequests;
    } catch (error) {
      console.error('[PrismData] Failed to fetch nickname requests:', error);
      if (cache.nicknameRequests) return cache.nicknameRequests;
      throw error;
    }
  }

  async function createNicknameRequest(userIdOrData, currentNickname, requestedNickname) {
    // Support both old API (3 args) and new API (object)
    let requestData;
    if (typeof userIdOrData === 'object') {
      requestData = userIdOrData;
    } else {
      requestData = {
        user_id: userIdOrData,
        current_nickname: currentNickname,
        requested_nickname: requestedNickname
      };
    }
    
    try {
      const result = await proxyRequest('createNicknameRequest', requestData);
      invalidateCache('nicknameRequests');
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to create nickname request:', error);
      throw error;
    }
  }

  async function updateNicknameRequest(requestId, updates) {
    try {
      const result = await proxyRequest('updateNicknameRequest', { requestId, updates });
      invalidateCache('nicknameRequests');
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to update nickname request:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL PERMISSION METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  // In-memory role permissions (not persisted)
  let inMemoryRolePermissions = null;

  async function getAllRolePermissions() {
    // Return cached or defaults (no localStorage)
    if (inMemoryRolePermissions) {
      return inMemoryRolePermissions;
    }
    return {
      user: getRolePermissions('user'),
      mod: getRolePermissions('mod'),
      admin: getRolePermissions('admin'),
    };
  }

  async function saveRolePermissions(permissions) {
    // In-memory only - admin should persist to server/database
    inMemoryRolePermissions = permissions;
    console.log('[PrismData] Role permissions updated (in-memory only)');
    return true;
  }

  async function setUserPermissionOverrides(userId, overrides) {
    try {
      const result = await proxyRequest('setUserPermissionOverrides', { userId, overrides });
      invalidateCache('users');
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to set permission overrides:', error);
      throw error;
    }
  }

  async function clearUserPermissionOverrides(userId) {
    try {
      const result = await proxyRequest('clearUserPermissionOverrides', { userId });
      invalidateCache('users');
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to clear permission overrides:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL COMPANY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  async function getCompaniesByUser(userId) {
    const companies = await getCompanies();
    return companies.filter(c => 
      c.owner?.id === userId || 
      c.members?.some(m => m.id === userId)
    );
  }

  async function getUserCompanyRole(companyId, userId) {
    const company = await getCompanyById(companyId);
    if (!company) return null;
    if (company.owner?.id === userId || company.ownerId === userId) return 'owner';
    const member = company.members?.find(m => m.id === userId || m.userId === userId);
    return member?.role || null;
  }

  /**
   * Get companies where user can create posts/projects as company
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Companies where user has posting permission
   */
  async function getCompaniesForPosting(userId) {
    const companies = await getCompanies();
    return companies.filter(c => {
      // Check if owner
      if (c.owner?.id === userId || c.ownerId === userId) return true;
      // Check if admin member
      const member = c.members?.find(m => m.id === userId || m.userId === userId);
      return member && (member.role === 'admin' || member.role === 'owner');
    });
  }

  async function setCompanyTrustedMember(companyId, memberId, isTrusted) {
    try {
      const result = await proxyRequest('setCompanyTrustedMember', { companyId, memberId, isTrusted });
      invalidateCache('companies');
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to set trusted member:', error);
      throw error;
    }
  }

  async function removeCompanyMember(companyId, memberId) {
    try {
      const result = await proxyRequest('removeCompanyMember', { companyId, memberId });
      invalidateCache('companies');
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to remove member:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL INVITATION METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  async function getInvitationsForUser(userId) {
    const invitations = await getInvitations();
    return invitations.filter(i => 
      i.invitedUserId === userId && i.status === INVITATION_STATUS.PENDING
    );
  }

  async function getPendingInvitationsByCompany(companyId) {
    const invitations = await getInvitations();
    return invitations.filter(i => 
      i.companyId === companyId && i.status === INVITATION_STATUS.PENDING
    );
  }

  async function acceptInvitation(invitationId, userId) {
    try {
      const result = await proxyRequest('acceptInvitation', { invitationId, userId });
      invalidateCache('invitations');
      invalidateCache('companies');
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to accept invitation:', error);
      throw error;
    }
  }

  async function declineInvitation(invitationId, userId) {
    try {
      const result = await proxyRequest('declineInvitation', { invitationId, userId });
      invalidateCache('invitations');
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to decline invitation:', error);
      throw error;
    }
  }

  async function cancelInvitation(invitationId, companyId, userId) {
    try {
      const result = await proxyRequest('cancelInvitation', { invitationId, companyId, userId });
      invalidateCache('invitations');
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to cancel invitation:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COLLABORATION METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  async function getCollaborationsByCompany(companyId) {
    try {
      const result = await proxyRequest('getCollaborationsByCompany', { companyId });
      return result || [];
    } catch (error) {
      console.error('[PrismData] Failed to get collaborations:', error);
      return [];
    }
  }

  async function createCollaborationRequest(fromCompanyId, toCompanyId, userId) {
    try {
      const result = await proxyRequest('createCollaborationRequest', { fromCompanyId, toCompanyId, userId });
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to create collaboration request:', error);
      throw error;
    }
  }

  async function acceptCollaboration(collabId, companyId, userId) {
    try {
      const result = await proxyRequest('acceptCollaboration', { collabId, companyId, userId });
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to accept collaboration:', error);
      throw error;
    }
  }

  async function declineCollaboration(collabId, companyId, userId) {
    try {
      const result = await proxyRequest('declineCollaboration', { collabId, companyId, userId });
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to decline collaboration:', error);
      throw error;
    }
  }

  async function cancelCollaboration(collabId, companyId, userId) {
    try {
      const result = await proxyRequest('cancelCollaboration', { collabId, companyId, userId });
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to cancel collaboration:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPANY CONTENT METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  async function getCompanyContent() {
    try {
      const result = await proxyRequest('getCompanyContent');
      return result || [];
    } catch (error) {
      console.error('[PrismData] Failed to get company content:', error);
      return [];
    }
  }

  async function getContentByCompany(companyId) {
    const allContent = await getCompanyContent();
    return allContent.filter(c => c.companyId === companyId);
  }

  async function getContentById(contentId) {
    const allContent = await getCompanyContent();
    return allContent.find(c => c.id === contentId) || null;
  }

  async function createCompanyContentItem(companyId, data, userId) {
    try {
      const result = await proxyRequest('createCompanyContentItem', { companyId, data, userId });
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to create content item:', error);
      throw error;
    }
  }

  async function updateContentItem(itemId, updates, userId) {
    try {
      const result = await proxyRequest('updateContentItem', { itemId, updates, userId });
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to update content item:', error);
      throw error;
    }
  }

  async function deleteContentItem(contentId, userId) {
    try {
      const result = await proxyRequest('deleteContentItem', { contentId, userId });
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to delete content item:', error);
      throw error;
    }
  }

  async function toggleContentShared(contentId, userId) {
    try {
      const result = await proxyRequest('toggleContentShared', { contentId, userId });
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to toggle content shared:', error);
      throw error;
    }
  }

  async function getSharedContentFromCollaborators(companyId) {
    try {
      const result = await proxyRequest('getSharedContentFromCollaborators', { companyId });
      return result || [];
    } catch (error) {
      console.error('[PrismData] Failed to get shared content:', error);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL MODERATION METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  async function getModerationRequestById(requestId) {
    const requests = await getModerationRequests();
    return requests.find(r => r.id === requestId) || null;
  }

  async function reviewModerationRequest(requestId, reviewerId, status, comment = '') {
    try {
      const result = await proxyRequest('reviewModerationRequest', { 
        requestId, reviewerId, status, comment 
      });
      invalidateCache('moderationRequests');
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to review moderation request:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATION METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  async function getUserNotifications(userId) {
    return getNotifications(userId);
  }

  async function getUnreadCount(userId) {
    const notifications = await getNotifications(userId);
    return notifications.filter(n => !n.read).length;
  }

  /**
   * Send bulk notifications (admin only)
   * @param {object} params - { title, message, type, targets, projectId, companyId }
   */
  async function sendBulkNotifications(params) {
    try {
      const result = await proxyRequest('sendBulkNotifications', params);
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to send bulk notifications:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  function clearCache() {
    invalidateCache();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMAGE UPLOAD
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Upload an image to Supabase Storage
   * @param {string} imageData - Base64 data URL (data:image/png;base64,...)
   * @param {string} bucket - Storage bucket name (default: 'images')
   * @param {string} folder - Folder path within bucket (default: 'uploads')
   * @param {string} filename - Optional filename (auto-generated if not provided)
   * @returns {Promise<{path: string, url: string, filename: string}>}
   */
  async function uploadImage(imageData, bucket = 'images', folder = 'uploads', filename = null) {
    try {
      const result = await proxyRequest('uploadImage', {
        imageData,
        bucket,
        folder,
        filename,
      });
      return result;
    } catch (error) {
      console.error('[PrismData] Failed to upload image:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // Constants
    PROJECT_CATEGORIES,
    CATEGORY_LABELS,
    PROJECT_ROLES,
    USER_ROLES,
    ROLE_HIERARCHY,
    PERMISSION_TYPES,
    PERMISSION_LABELS,
    PERMISSION_DESCRIPTIONS,
    COMPANY_ROLES,
    COMPANY_ROLE_HIERARCHY,
    INVITATION_STATUS,
    COLLABORATION_STATUS,
    CONTENT_TYPES,
    CONTENT_TYPE_LABELS,
    CONTENT_TYPE_ICONS,
    MODERATION_STATUS,
    MODERATION_TYPES,
    MODERATION_TYPE_LABELS,
    POST_CATEGORIES,
    POST_CATEGORY_LABELS,
    DEFAULT_ROLE_PERMISSIONS,

    // Permission helpers
    hasPermission,
    hasCompanyPermission,
    getRolePermissions,
    getAllRolePermissions,
    saveRolePermissions,
    setUserPermissionOverrides,
    clearUserPermissionOverrides,
    checkUserPermissionSync,

    // Users
    getUsers,
    getUserById,
    getUserByEmail,
    createUser,
    updateUser,
    deleteUser,
    saveUsers,

    // Projects
    getProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,

    // Posts
    getPosts,
    getPostById,
    createPost,
    updatePost,
    deletePost,

    // Companies
    getCompanies,
    getCompanyById,
    getCompanyBySlug,
    createCompany,
    updateCompany,
    deleteCompany,
    getCompaniesByUser,
    getUserCompanyRole,
    getCompaniesForPosting,
    setCompanyTrustedMember,
    removeCompanyMember,

    // Notifications
    getNotifications,
    createNotification,
    markNotificationRead,
    markAllNotificationsRead,
    getUserNotifications,
    getUnreadCount,
    sendBulkNotifications,

    // Invitations
    getInvitations,
    createInvitation,
    updateInvitation,
    getInvitationsForUser,
    getPendingInvitationsByCompany,
    acceptInvitation,
    declineInvitation,
    cancelInvitation,

    // Collaborations
    getCollaborationsByCompany,
    createCollaborationRequest,
    acceptCollaboration,
    declineCollaboration,
    cancelCollaboration,

    // Company Content
    getCompanyContent,
    getContentByCompany,
    getContentById,
    createCompanyContentItem,
    updateContentItem,
    deleteContentItem,
    toggleContentShared,
    getSharedContentFromCollaborators,

    // Moderation
    getModerationRequests,
    getModerationRequestById,
    createModerationRequest,
    updateModerationRequest,
    reviewModerationRequest,

    // Nickname requests
    getNicknameRequests,
    createNicknameRequest,
    updateNicknameRequest,

    // Image upload
    uploadImage,

    // Cache control
    invalidateCache,
    clearCache,
    
    // Prefetching
    startPrefetch,
    prefetchFor,
  };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrismData;
}

// Create PrismBin alias for backward compatibility
// This allows all existing code that uses PrismBin to work with PrismData
window.PrismBin = PrismData;
