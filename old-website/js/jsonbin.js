/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PrismMTR â€” JSONBin API Module v3 (SECURE)
   
   ALL JSONBin requests are routed through a Netlify Function proxy.
   The JSONBIN_API_KEY is NEVER exposed to the browser.
   
   SINGLE SOURCE OF TRUTH for all data:
   - USERS: User accounts, roles, OAuth connections
   - PROJECTS: Project metadata, ownership, categories, members
   - NICKNAME_REQUESTS: Minecraft nickname change requests
   - NOTIFICATIONS: System notifications for users
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const PrismBin = (function () {
  'use strict';

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // DEBUG LOGGING â€” Disabled in production
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  const DEBUG = !window.location.origin.includes('prismmtr.org') && 
                !window.location.origin.includes('netlify.app');
  
  const log = DEBUG ? console.log.bind(console) : () => {};
  const warn = DEBUG ? console.warn.bind(console) : () => {};

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // CONFIGURATION â€” NO SECRETS HERE
  // All secrets are kept server-side in Netlify Functions
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  const PROXY_ENDPOINT = '/.netlify/functions/jsonbin-proxy';

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // LOCAL DEVELOPMENT DETECTION
  // Netlify Functions require `netlify dev` to work locally
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  const LOCAL_DEV_ORIGINS = [
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];

  // netlify dev runs on 8888
  const NETLIFY_DEV_ORIGINS = [
    'http://localhost:8888',
    'http://127.0.0.1:8888',
  ];

  function isLocalDevWithoutNetlify() {
    const origin = window.location.origin;
    const isLocalServer = LOCAL_DEV_ORIGINS.some(dev => origin.startsWith(dev));
    const isNetlifyDev = NETLIFY_DEV_ORIGINS.some(dev => origin.startsWith(dev));
    return isLocalServer && !isNetlifyDev;
  }

  function isProduction() {
    return window.location.origin.includes('prismmtr.org') || 
           window.location.origin.includes('netlify.app');
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PROJECT CATEGORIES
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PROJECT ROLES
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  const PROJECT_ROLES = {
    OWNER: 'owner',
    COOWNER: 'coowner',
    MEMBER: 'member',
  };

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // USER ROLES & HIERARCHY
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

  function hasPermission(userRole, requiredRole) {
    return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISSIONS SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  const PERMISSION_TYPES = {
    CREATE_PROJECT: 'create_project',
    CREATE_POST: 'create_post',
    TRUSTED_MEMBER: 'trusted_member',
    ADMIN_ACCESS: 'admin_access',
  };

  const PERMISSION_LABELS = {
    create_project: 'Create Project',
    create_post: 'Create Post',
    trusted_member: 'Trusted Member',
    admin_access: 'Admin Access',
  };

  const PERMISSION_DESCRIPTIONS = {
    create_project: 'Can create new projects and objects',
    create_post: 'Can create and publish posts',
    trusted_member: 'Bypass moderation for content',
    admin_access: 'Access admin panel and tools',
  };

  // Default permissions by role
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

  // In-memory store for custom role permissions (loaded from users bin metadata)
  let customRolePermissions = null;

  /**
   * Get permissions for a role (default + custom overrides)
   */
  function getRolePermissions(role) {
    const defaults = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.user;
    if (!customRolePermissions || !customRolePermissions[role]) {
      return { ...defaults };
    }
    return { ...defaults, ...customRolePermissions[role] };
  }

  /**
   * Get all role permissions configuration
   * Note: In-memory only, reloaded each session from defaults
   */
  async function getAllRolePermissions() {
    // Return defaults merged with any runtime customizations
    // No localStorage - admin changes need to be saved server-side
    return {
      user: getRolePermissions('user'),
      mod: getRolePermissions('mod'),
      admin: getRolePermissions('admin'),
    };
  }

  /**
   * Save role permissions configuration
   * Note: In-memory only for this session - for persistence, save to server
   */
  async function saveRolePermissions(permissions) {
    try {
      customRolePermissions = permissions;
      // No localStorage - admin should save to server/database
      console.log('[PrismBin] Role permissions updated (in-memory only)');
      return true;
    } catch (e) {
      console.error('[PrismBin] Failed to save role permissions:', e);
      return false;
    }
  }

  /**
   * Update permissions for a specific role
   */
  async function updateRolePermissions(role, permissions) {
    const all = await getAllRolePermissions();
    all[role] = { ...all[role], ...permissions };
    return saveRolePermissions(all);
  }

  /**
   * Get user's permission overrides
   */
  async function getUserPermissionOverrides(userId) {
    const user = await getUserById(userId);
    return user?.permissionOverrides || null;
  }

  /**
   * Set user's permission overrides
   */
  async function setUserPermissionOverrides(userId, overrides) {
    return updateUser(userId, { permissionOverrides: overrides });
  }

  /**
   * Clear user's permission overrides (revert to role defaults)
   */
  async function clearUserPermissionOverrides(userId) {
    return updateUser(userId, { permissionOverrides: null });
  }

  /**
   * Check if a user has a specific permission
   * Priority: user override > role permission > default
   */
  async function checkUserPermission(userId, permissionType) {
    const user = await getUserById(userId);
    if (!user) return false;

    // Check user-specific override first
    if (user.permissionOverrides && typeof user.permissionOverrides[permissionType] === 'boolean') {
      return user.permissionOverrides[permissionType];
    }

    // Fall back to role permissions
    const rolePerms = getRolePermissions(user.role || 'user');
    return rolePerms[permissionType] || false;
  }

  /**
   * Check permission synchronously using cached user data
   * For use in UI rendering where async is not ideal
   */
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

  /**
   * Get all effective permissions for a user
   */
  async function getUserEffectivePermissions(userId) {
    const user = await getUserById(userId);
    if (!user) return null;

    const rolePerms = getRolePermissions(user.role || 'user');
    const overrides = user.permissionOverrides || {};

    const effective = {};
    for (const perm of Object.values(PERMISSION_TYPES)) {
      effective[perm] = typeof overrides[perm] === 'boolean' ? overrides[perm] : rolePerms[perm];
    }

    return {
      role: user.role || 'user',
      rolePermissions: rolePerms,
      overrides: overrides,
      effective: effective,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPANIES SYSTEM
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

  const INVITATION_STATUS = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    DECLINED: 'declined',
    EXPIRED: 'expired',
  };

  // Collaboration status
  const COLLABORATION_STATUS = {
    PENDING: 'pending',
    ACTIVE: 'active',
    DECLINED: 'declined',
    CANCELLED: 'cancelled',
  };

  // Company content types
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
    line: 'route',
    station: 'train',
    building: 'building',
  };

  // Moderation request status
  const MODERATION_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    REVISION_REQUESTED: 'revision_requested',
  };

  // Moderation request types
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

  function hasCompanyPermission(userRole, requiredRole) {
    return (COMPANY_ROLE_HIERARCHY[userRole] || 0) >= (COMPANY_ROLE_HIERARCHY[requiredRole] || 0);
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // CACHE
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

  const CACHE_TTL = 30000; // 30 seconds

  function isCacheValid(key) {
    const lastFetch = cache.lastFetch[key];
    return lastFetch && (Date.now() - lastFetch < CACHE_TTL);
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RETRY LOGIC â€” Exponential backoff for transient errors
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelayMs: 500,
    maxDelayMs: 5000,
    retryableStatuses: [429, 500, 502, 503, 504], // Rate limit + server errors
  };

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getRetryDelay(attempt) {
    // Exponential backoff with jitter
    const delay = Math.min(
      RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt) + Math.random() * 100,
      RETRY_CONFIG.maxDelayMs
    );
    return delay;
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PROXY REQUEST â€” ALL JSONBin calls go through here (with retries)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async function proxyRequest(action, data = null, options = {}) {
    // Check for local development without Netlify CLI
    if (isLocalDevWithoutNetlify()) {
      const errorMsg = `[PrismBin] Local development detected without Netlify CLI.
      
To use JSONBin API locally, run: netlify dev

This starts a local server on port 8888 with Netlify Functions support.
Current origin: ${window.location.origin}`;
      
      console.warn(errorMsg);
      
      // Return empty data instead of throwing to allow UI to render
      if (action.startsWith('get')) {
        console.log(`[PrismBin] Returning empty ${action} for local dev`);
        return action === 'getUsers' ? [] : 
               action === 'getProjects' ? [] : 
               action === 'getNicknameRequests' ? [] : 
               action === 'getNotifications' ? [] : {};
      }
      
      throw new Error('Netlify Functions unavailable. Run "netlify dev" for local development.');
    }

    const maxRetries = options.maxRetries ?? RETRY_CONFIG.maxRetries;
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = getRetryDelay(attempt - 1);
          console.log(`[PrismBin] Retry ${attempt}/${maxRetries} after ${Math.round(delay)}ms...`);
          await sleep(delay);
        }

        const response = await fetch(PROXY_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, data }),
        });

        // Check if error is retryable
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const isRetryable = RETRY_CONFIG.retryableStatuses.includes(response.status);
          
          // Special handling for 405 - indicates Netlify Functions not available
          if (response.status === 405) {
            console.error('[PrismBin] 405 Method Not Allowed - Netlify Functions not running');
            throw new Error('Server functions unavailable. If developing locally, run "netlify dev".');
          }
          
          if (isRetryable && attempt < maxRetries) {
            console.warn(`[PrismBin] Retryable error (${response.status}):`, errorData.error || 'Unknown');
            lastError = new Error(errorData.error || `Proxy request failed: ${response.status}`);
            lastError.status = response.status;
            lastError.retryable = true;
            continue; // Retry
          }
          
          throw new Error(errorData.error || `Proxy request failed: ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error;
        
        // Network errors are retryable
        const isNetworkError = error.name === 'TypeError' || error.message.includes('fetch');
        if (isNetworkError && attempt < maxRetries) {
          warn('[PrismBin] Network error, will retry:', error.message);
          continue;
        }
        
        // Don't retry other errors
        if (attempt === maxRetries) {
          console.error('[PrismBin] All retries exhausted:', error.message);
          throw lastError;
        }
      }
    }

    throw lastError || new Error('Proxy request failed after retries');
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // USERS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async function getUsers(forceRefresh = false) {
    if (!forceRefresh && cache.users && isCacheValid('users')) {
      log('[PrismBin] Using cached users');
      return cache.users;
    }

    try {
      log('[PrismBin] Fetching users from server...');
      const data = await proxyRequest('getUsers');
      cache.users = data.users || data || [];
      cache.lastFetch.users = Date.now();
      log('[PrismBin] Fetched', cache.users.length, 'users');
      return cache.users;
    } catch (error) {
      console.error('[PrismBin] Failed to fetch users:', error);
      // Return cached data on error if available
      if (cache.users) {
        log('[PrismBin] Returning cached users due to error');
        return cache.users;
      }
      throw error;
    }
  }

  async function saveUsers(users) {
    try {
      log('[PrismBin] Saving', users.length, 'users...');
      // Use retries with longer timeout for saves
      await proxyRequest('saveUsers', { users }, { maxRetries: 3 });
      cache.users = users;
      cache.lastFetch.users = Date.now();
      log('[PrismBin] Users saved successfully');
      return true;
    } catch (error) {
      console.error('[PrismBin] Failed to save users:', error);
      // Invalidate cache on save failure to force refresh
      cache.lastFetch.users = 0;
      throw error; // Re-throw so callers know it failed
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

  /**
   * Atomic user update with optimistic locking
   * This fetches the latest data, applies the update, and saves in one operation
   * to minimize race condition window
   */
  async function updateUser(userId, updates) {
    log('[PrismBin] Updating user:', userId, 'with:', Object.keys(updates));
    
    // Force refresh to get latest data
    const users = await getUsers(true);
    const index = users.findIndex(u => u.id === userId);
    
    if (index === -1) {
      console.error('[PrismBin] User not found for update:', userId);
      throw new Error('User not found');
    }

    users[index] = {
      ...users[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // saveUsers now throws on error instead of returning false
    await saveUsers(users);
    log('[PrismBin] User updated successfully:', userId);
    return users[index];
  }

  async function updateUserRole(userId, newRole) {
    if (!['user', 'mod', 'admin'].includes(newRole)) {
      throw new Error('Invalid role');
    }
    return updateUser(userId, { role: newRole });
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PROJECTS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async function getProjects(forceRefresh = false) {
    if (!forceRefresh && cache.projects && isCacheValid('projects')) {
      return cache.projects;
    }

    try {
      const data = await proxyRequest('getProjects');
      cache.projects = data.projects || data || [];
      cache.lastFetch.projects = Date.now();
      return cache.projects;
    } catch (error) {
      console.error('[PrismBin] Failed to fetch projects:', error);
      return cache.projects || [];
    }
  }

  async function saveProjects(projects) {
    try {
      await proxyRequest('saveProjects', { projects });
      cache.projects = projects;
      cache.lastFetch.projects = Date.now();
      return true;
    } catch (error) {
      console.error('[PrismBin] Failed to save projects:', error);
      return false;
    }
  }

  async function createProject(projectData) {
    const projects = await getProjects(true);

    const project = {
      id: `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...projectData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    projects.push(project);
    const success = await saveProjects(projects);
    if (!success) throw new Error('Failed to create project');
    return project;
  }

  async function updateProject(projectId, updates) {
    const projects = await getProjects(true);
    const index = projects.findIndex(p => p.id === projectId);
    if (index === -1) throw new Error('Project not found');

    projects[index] = {
      ...projects[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const success = await saveProjects(projects);
    if (!success) throw new Error('Failed to update project');
    return projects[index];
  }

  async function deleteProject(projectId) {
    const projects = await getProjects(true);
    const index = projects.findIndex(p => p.id === projectId);
    if (index === -1) throw new Error('Project not found');

    const deleted = projects.splice(index, 1)[0];
    await saveProjects(projects);
    return deleted;
  }

  async function getProjectsByUser(userId) {
    const projects = await getProjects();
    return projects.filter(p =>
      p.owner?.id === userId ||
      p.coowners?.some(c => c.id === userId) ||
      p.members?.some(m => m.id === userId)
    );
  }

  async function getProjectsByRole(userId, role) {
    const projects = await getProjects();
    return projects.filter(p => {
      if (role === 'owner') return p.owner?.id === userId;
      if (role === 'coowner') return p.coowners?.some(c => c.id === userId);
      if (role === 'member') return p.members?.some(m => m.id === userId);
      return false;
    });
  }

  async function getProjectsByCategory(category) {
    const projects = await getProjects();
    return projects.filter(p => p.category === category);
  }

  async function searchProjects(query, filters = {}) {
    let projects = await getProjects();
    const q = query?.toLowerCase().trim();

    if (q) {
      projects = projects.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.owner?.nickname?.toLowerCase().includes(q)
      );
    }

    if (filters.category) {
      projects = projects.filter(p => p.category === filters.category);
    }

    if (filters.status) {
      projects = projects.filter(p => p.status === filters.status);
    }

    return projects;
  }

  async function addProjectMember(projectId, user, role = 'member') {
    const projects = await getProjects(true);
    const project = projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    if (role === 'coowner') {
      project.coowners = project.coowners || [];
      if (!project.coowners.some(c => c.id === user.id)) {
        project.coowners.push({ id: user.id, nickname: user.nickname });
      }
    } else {
      project.members = project.members || [];
      if (!project.members.some(m => m.id === user.id)) {
        project.members.push({ id: user.id, nickname: user.nickname });
      }
    }

    project.updatedAt = new Date().toISOString();
    await saveProjects(projects);
    return project;
  }

  async function removeProjectMember(projectId, userId) {
    const projects = await getProjects(true);
    const project = projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    project.coowners = (project.coowners || []).filter(c => c.id !== userId);
    project.members = (project.members || []).filter(m => m.id !== userId);
    project.updatedAt = new Date().toISOString();

    await saveProjects(projects);
    return project;
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // NICKNAME REQUESTS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async function getNicknameRequests(forceRefresh = false) {
    if (!forceRefresh && cache.nicknameRequests && isCacheValid('nicknameRequests')) {
      return cache.nicknameRequests;
    }

    try {
      const data = await proxyRequest('getNicknameRequests');
      cache.nicknameRequests = data.requests || data || [];
      cache.lastFetch.nicknameRequests = Date.now();
      return cache.nicknameRequests;
    } catch (error) {
      console.error('[PrismBin] Failed to fetch nickname requests:', error);
      return cache.nicknameRequests || [];
    }
  }

  async function saveNicknameRequests(requests) {
    try {
      await proxyRequest('saveNicknameRequests', { requests });
      cache.nicknameRequests = requests;
      cache.lastFetch.nicknameRequests = Date.now();
      return true;
    } catch (error) {
      console.error('[PrismBin] Failed to save nickname requests:', error);
      return false;
    }
  }

  async function createNicknameRequest(userId, oldNickname, newNickname) {
    const requests = await getNicknameRequests(true);

    const request = {
      id: `nr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      oldNickname: oldNickname || null,
      nickname: newNickname,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    requests.push(request);
    await saveNicknameRequests(requests);
    return request;
  }

  async function reviewNicknameRequest(requestId, status, reviewerId) {
    const requests = await getNicknameRequests(true);
    const index = requests.findIndex(r => r.id === requestId);
    if (index === -1) throw new Error('Request not found');

    requests[index] = {
      ...requests[index],
      status,
      reviewedBy: reviewerId,
      reviewedAt: new Date().toISOString(),
    };

    await saveNicknameRequests(requests);
    return requests[index];
  }

  async function getPendingNicknameRequests() {
    const requests = await getNicknameRequests();
    return requests.filter(r => r.status === 'pending');
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // NOTIFICATIONS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async function getNotifications(forceRefresh = false) {
    if (!forceRefresh && cache.notifications && isCacheValid('notifications')) {
      return cache.notifications;
    }

    try {
      const data = await proxyRequest('getNotifications');
      cache.notifications = data.notifications || data || [];
      cache.lastFetch.notifications = Date.now();
      return cache.notifications;
    } catch (error) {
      console.error('[PrismBin] Failed to fetch notifications:', error);
      return cache.notifications || [];
    }
  }

  async function saveNotifications(notifications) {
    try {
      // Enforce limit: keep only last 50 notifications to stay under 100KB
      const MAX_NOTIFICATIONS = 50;
      if (notifications.length > MAX_NOTIFICATIONS) {
        // Sort by date descending and keep newest
        notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        notifications = notifications.slice(0, MAX_NOTIFICATIONS);
      }
      
      await proxyRequest('saveNotifications', { notifications });
      cache.notifications = notifications;
      cache.lastFetch.notifications = Date.now();
      return true;
    } catch (error) {
      console.error('[PrismBin] Failed to save notifications:', error);
      return false;
    }
  }

  async function createNotification(userId, type, title, message, target = 'specific') {
    const notifications = await getNotifications(true);

    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type,
      title,
      message,
      read: false,
      createdAt: new Date().toISOString(),
    };

    notifications.push(notification);
    await saveNotifications(notifications);
    return notification;
  }

  async function getUserNotifications(userId, includeRead = false) {
    const notifications = await getNotifications();
    return notifications
      .filter(n => n.userId === userId && (includeRead || !n.read))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async function getUnreadCount(userId) {
    const notifications = await getNotifications();
    return notifications.filter(n => n.userId === userId && !n.read).length;
  }

  async function markNotificationRead(notificationId) {
    const notifications = await getNotifications(true);
    const index = notifications.findIndex(n => n.id === notificationId);
    if (index === -1) return false;

    notifications[index].read = true;
    await saveNotifications(notifications);
    return true;
  }

  async function markAllNotificationsRead(userId) {
    const notifications = await getNotifications(true);
    let changed = false;

    notifications.forEach(n => {
      if (n.userId === userId && !n.read) {
        n.read = true;
        changed = true;
      }
    });

    if (changed) await saveNotifications(notifications);
    return changed;
  }

  async function broadcastNotification(type, title, message, userIds = null) {
    const notifications = await getNotifications(true);
    const now = new Date().toISOString();

    let targetUsers = userIds;
    if (!targetUsers) {
      const users = await getUsers();
      targetUsers = users.map(u => u.id);
    }

    const newNotifications = targetUsers.map(userId => ({
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type,
      title,
      message,
      read: false,
      createdAt: now,
    }));

    notifications.push(...newNotifications);
    await saveNotifications(notifications);
    return newNotifications;
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // CACHE MANAGEMENT
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  function clearCache() {
    cache.users = null;
    cache.projects = null;
    cache.posts = null;
    cache.companies = null;
    cache.invitations = null;
    cache.collaborations = null;
    cache.companyContent = null;
    cache.moderationRequests = null;
    cache.nicknameRequests = null;
    cache.notifications = null;
    cache.lastFetch = {};
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POSTS
  // ═══════════════════════════════════════════════════════════════════════════

  const POST_CATEGORIES = {
    NEWS: 'news',
    UPDATE: 'update',
    ANNOUNCEMENT: 'announcement',
    GUIDE: 'guide',
    SHOWCASE: 'showcase',
  };

  const POST_CATEGORY_LABELS = {
    news: 'News',
    update: 'Update',
    announcement: 'Announcement',
    guide: 'Guide',
    showcase: 'Showcase',
  };

  async function getPosts(forceRefresh = false) {
    if (!forceRefresh && cache.posts && isCacheValid('posts')) {
      return cache.posts;
    }

    try {
      const data = await proxyRequest('getPosts');
      cache.posts = data.posts || data || [];
      cache.lastFetch.posts = Date.now();
      return cache.posts;
    } catch (error) {
      console.error('[PrismBin] Failed to fetch posts:', error);
      return cache.posts || [];
    }
  }

  async function savePosts(posts) {
    try {
      await proxyRequest('savePosts', { posts });
      cache.posts = posts;
      cache.lastFetch.posts = Date.now();
      return true;
    } catch (error) {
      console.error('[PrismBin] Failed to save posts:', error);
      return false;
    }
  }

  async function createPost(postData) {
    const posts = await getPosts(true);

    const post = {
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...postData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    posts.unshift(post);
    const success = await savePosts(posts);
    if (!success) throw new Error('Failed to create post');
    return post;
  }

  async function updatePost(postId, updates) {
    const posts = await getPosts(true);
    const index = posts.findIndex(p => p.id === postId);
    if (index === -1) throw new Error('Post not found');

    posts[index] = {
      ...posts[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const success = await savePosts(posts);
    if (!success) throw new Error('Failed to update post');
    return posts[index];
  }

  async function deletePost(postId) {
    const posts = await getPosts(true);
    const index = posts.findIndex(p => p.id === postId);
    if (index === -1) throw new Error('Post not found');

    const deleted = posts.splice(index, 1)[0];
    await savePosts(posts);
    return deleted;
  }

  async function getPostsByUser(userId) {
    const posts = await getPosts();
    return posts.filter(p => p.author?.id === userId);
  }

  async function getPostsByCategory(category) {
    const posts = await getPosts();
    return posts.filter(p => p.category === category);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPANIES API
  // ═══════════════════════════════════════════════════════════════════════════

  async function getCompanies(forceRefresh = false) {
    if (!forceRefresh && cache.companies && isCacheValid('companies')) {
      return cache.companies;
    }

    try {
      const data = await proxyRequest('getCompanies');
      cache.companies = data.companies || data || [];
      cache.lastFetch.companies = Date.now();
      return cache.companies;
    } catch (error) {
      console.error('[PrismBin] Failed to fetch companies:', error);
      return cache.companies || [];
    }
  }

  async function saveCompanies(companies) {
    try {
      await proxyRequest('saveCompanies', { companies });
      cache.companies = companies;
      cache.lastFetch.companies = Date.now();
      return true;
    } catch (error) {
      console.error('[PrismBin] Failed to save companies:', error);
      return false;
    }
  }

  async function getCompanyById(companyId) {
    const companies = await getCompanies();
    return companies.find(c => c.id === companyId) || null;
  }

  async function createCompany(companyData) {
    const companies = await getCompanies(true);

    const company = {
      id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...companyData,
      members: companyData.members || [],
      trustedMembers: companyData.trustedMembers || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Ensure owner is in members list with owner role
    if (company.owner && !company.members.find(m => m.id === company.owner.id)) {
      company.members.push({
        id: company.owner.id,
        nickname: company.owner.nickname,
        role: 'owner',
        joinedAt: company.createdAt,
      });
    }

    companies.push(company);
    const success = await saveCompanies(companies);
    if (!success) throw new Error('Failed to create company');
    return company;
  }

  async function updateCompany(companyId, updates) {
    const companies = await getCompanies(true);
    const index = companies.findIndex(c => c.id === companyId);
    if (index === -1) throw new Error('Company not found');

    companies[index] = {
      ...companies[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const success = await saveCompanies(companies);
    if (!success) throw new Error('Failed to update company');
    return companies[index];
  }

  async function deleteCompany(companyId) {
    const companies = await getCompanies(true);
    const index = companies.findIndex(c => c.id === companyId);
    if (index === -1) throw new Error('Company not found');

    const deleted = companies.splice(index, 1)[0];
    await saveCompanies(companies);
    return deleted;
  }

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

    if (company.owner?.id === userId) return 'owner';

    const member = company.members?.find(m => m.id === userId);
    return member?.role || null;
  }

  async function isCompanyTrustedMember(companyId, userId) {
    const company = await getCompanyById(companyId);
    if (!company) return false;
    return company.trustedMembers?.includes(userId) || false;
  }

  async function setCompanyTrustedMember(companyId, userId, isTrusted) {
    const companies = await getCompanies(true);
    const company = companies.find(c => c.id === companyId);
    if (!company) throw new Error('Company not found');

    company.trustedMembers = company.trustedMembers || [];

    if (isTrusted && !company.trustedMembers.includes(userId)) {
      company.trustedMembers.push(userId);
    } else if (!isTrusted) {
      company.trustedMembers = company.trustedMembers.filter(id => id !== userId);
    }

    company.updatedAt = new Date().toISOString();
    await saveCompanies(companies);
    return company;
  }

  async function addCompanyMember(companyId, user, role = 'member') {
    const companies = await getCompanies(true);
    const company = companies.find(c => c.id === companyId);
    if (!company) throw new Error('Company not found');

    company.members = company.members || [];

    // Check if already a member
    const existingIndex = company.members.findIndex(m => m.id === user.id);
    if (existingIndex !== -1) {
      company.members[existingIndex].role = role;
    } else {
      company.members.push({
        id: user.id,
        nickname: user.nickname || user.mcNickname,
        role: role,
        joinedAt: new Date().toISOString(),
      });
    }

    company.updatedAt = new Date().toISOString();
    await saveCompanies(companies);
    return company;
  }

  async function removeCompanyMember(companyId, userId) {
    const companies = await getCompanies(true);
    const company = companies.find(c => c.id === companyId);
    if (!company) throw new Error('Company not found');

    // Cannot remove owner
    if (company.owner?.id === userId) {
      throw new Error('Cannot remove company owner');
    }

    company.members = (company.members || []).filter(m => m.id !== userId);
    company.trustedMembers = (company.trustedMembers || []).filter(id => id !== userId);
    company.updatedAt = new Date().toISOString();

    await saveCompanies(companies);
    return company;
  }

  async function updateCompanyMemberRole(companyId, userId, newRole) {
    if (!['admin', 'member'].includes(newRole)) {
      throw new Error('Invalid role. Use "admin" or "member"');
    }

    const companies = await getCompanies(true);
    const company = companies.find(c => c.id === companyId);
    if (!company) throw new Error('Company not found');

    const member = company.members?.find(m => m.id === userId);
    if (!member) throw new Error('Member not found');

    if (company.owner?.id === userId) {
      throw new Error('Cannot change owner role');
    }

    member.role = newRole;
    company.updatedAt = new Date().toISOString();

    await saveCompanies(companies);
    return company;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INVITATIONS API
  // ═══════════════════════════════════════════════════════════════════════════

  async function getInvitations(forceRefresh = false) {
    if (!forceRefresh && cache.invitations && isCacheValid('invitations')) {
      return cache.invitations;
    }

    try {
      const data = await proxyRequest('getInvitations');
      cache.invitations = data.invitations || data || [];
      cache.lastFetch.invitations = Date.now();
      return cache.invitations;
    } catch (error) {
      console.error('[PrismBin] Failed to fetch invitations:', error);
      return cache.invitations || [];
    }
  }

  async function saveInvitations(invitations) {
    try {
      await proxyRequest('saveInvitations', { invitations });
      cache.invitations = invitations;
      cache.lastFetch.invitations = Date.now();
      return true;
    } catch (error) {
      console.error('[PrismBin] Failed to save invitations:', error);
      return false;
    }
  }

  async function createInvitation(companyId, inviterId, inviteeUsername, role = 'member') {
    const invitations = await getInvitations(true);
    const company = await getCompanyById(companyId);
    const users = await getUsers();

    if (!company) throw new Error('Company not found');

    // Find user by username (mcNickname or nickname)
    const invitee = users.find(u =>
      u.mcNickname?.toLowerCase() === inviteeUsername.toLowerCase() ||
      u.nickname?.toLowerCase() === inviteeUsername.toLowerCase()
    );

    if (!invitee) throw new Error('User not found');

    // Check if already a member
    if (company.members?.some(m => m.id === invitee.id)) {
      throw new Error('User is already a member');
    }

    // Check if invitation already exists
    const existing = invitations.find(
      inv => inv.companyId === companyId &&
             inv.inviteeId === invitee.id &&
             inv.status === 'pending'
    );
    if (existing) throw new Error('Invitation already sent');

    const invitation = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      companyId,
      companyName: company.name,
      inviterId,
      inviteeId: invitee.id,
      inviteeUsername: invitee.mcNickname || invitee.nickname,
      role,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    invitations.push(invitation);
    await saveInvitations(invitations);

    // Create notification for invitee
    await createNotification(
      invitee.id,
      'company_invite',
      'Company Invitation',
      `You've been invited to join ${company.name}`
    );

    return invitation;
  }

  async function getInvitationsForUser(userId) {
    const invitations = await getInvitations();
    return invitations.filter(
      inv => inv.inviteeId === userId && inv.status === 'pending'
    );
  }

  async function getInvitationsByCompany(companyId) {
    const invitations = await getInvitations();
    return invitations.filter(inv => inv.companyId === companyId);
  }

  async function getPendingInvitationsByCompany(companyId) {
    const invitations = await getInvitations();
    return invitations.filter(
      inv => inv.companyId === companyId && inv.status === 'pending'
    );
  }

  async function acceptInvitation(invitationId, userId) {
    const invitations = await getInvitations(true);
    const index = invitations.findIndex(inv => inv.id === invitationId);
    if (index === -1) throw new Error('Invitation not found');

    const invitation = invitations[index];

    // Verify the invitation is for this user
    if (invitation.inviteeId !== userId) {
      throw new Error('This invitation is not for you');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Invitation is no longer valid');
    }

    // Check expiration
    if (new Date(invitation.expiresAt) < new Date()) {
      invitation.status = 'expired';
      await saveInvitations(invitations);
      throw new Error('Invitation has expired');
    }

    // Get user info
    const user = await getUserById(userId);
    if (!user) throw new Error('User not found');

    // Add user to company
    await addCompanyMember(invitation.companyId, {
      id: user.id,
      nickname: user.mcNickname || user.nickname,
    }, invitation.role);

    // Update invitation status
    invitation.status = 'accepted';
    invitation.acceptedAt = new Date().toISOString();
    await saveInvitations(invitations);

    return invitation;
  }

  async function declineInvitation(invitationId, userId) {
    const invitations = await getInvitations(true);
    const index = invitations.findIndex(inv => inv.id === invitationId);
    if (index === -1) throw new Error('Invitation not found');

    const invitation = invitations[index];

    // Verify the invitation is for this user
    if (invitation.inviteeId !== userId) {
      throw new Error('This invitation is not for you');
    }

    invitation.status = 'declined';
    invitation.declinedAt = new Date().toISOString();
    await saveInvitations(invitations);

    return invitation;
  }

  async function cancelInvitation(invitationId, companyId, userId) {
    const invitations = await getInvitations(true);
    const index = invitations.findIndex(inv => inv.id === invitationId);
    if (index === -1) throw new Error('Invitation not found');

    const invitation = invitations[index];

    // Verify the invitation belongs to the company
    if (invitation.companyId !== companyId) {
      throw new Error('Invitation does not belong to this company');
    }

    // Verify user has permission (owner or admin)
    const userRole = await getUserCompanyRole(companyId, userId);
    if (!hasCompanyPermission(userRole, 'admin')) {
      throw new Error('No permission to cancel invitations');
    }

    const deleted = invitations.splice(index, 1)[0];
    await saveInvitations(invitations);
    return deleted;
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ===============================================================================
  // COLLABORATIONS API
  // ===============================================================================

  async function getCollaborations(forceRefresh = false) {
    if (!forceRefresh && cache.collaborations && isCacheValid('collaborations')) {
      return cache.collaborations;
    }

    try {
      const data = await proxyRequest('getCollaborations');
      cache.collaborations = data.collaborations || data || [];
      cache.lastFetch.collaborations = Date.now();
      return cache.collaborations;
    } catch (error) {
      console.error('[PrismBin] Failed to fetch collaborations:', error);
      return cache.collaborations || [];
    }
  }

  async function saveCollaborations(collaborations) {
    try {
      await proxyRequest('saveCollaborations', { collaborations });
      cache.collaborations = collaborations;
      cache.lastFetch.collaborations = Date.now();
      return true;
    } catch (error) {
      console.error('[PrismBin] Failed to save collaborations:', error);
      return false;
    }
  }

  async function createCollaborationRequest(fromCompanyId, toCompanyId, requesterId) {
    const collaborations = await getCollaborations(true);
    const fromCompany = await getCompanyById(fromCompanyId);
    const toCompany = await getCompanyById(toCompanyId);

    if (!fromCompany) throw new Error('Source company not found');
    if (!toCompany) throw new Error('Target company not found');

    const requesterRole = await getUserCompanyRole(fromCompanyId, requesterId);
    if (!hasCompanyPermission(requesterRole, 'admin')) {
      throw new Error('No permission to create collaboration requests');
    }

    const existing = collaborations.find(
      c => (c.companyA === fromCompanyId && c.companyB === toCompanyId) ||
           (c.companyA === toCompanyId && c.companyB === fromCompanyId)
    );
    if (existing) {
      if (existing.status === 'active') {
        throw new Error('Collaboration already exists');
      }
      if (existing.status === 'pending') {
        throw new Error('Collaboration request already pending');
      }
    }

    const collaboration = {
      id: `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      companyA: fromCompanyId,
      companyAName: fromCompany.name,
      companyB: toCompanyId,
      companyBName: toCompany.name,
      requestedBy: requesterId,
      status: 'pending',
      sharedObjects: [],
      createdAt: new Date().toISOString(),
    };

    collaborations.push(collaboration);
    await saveCollaborations(collaborations);

    if (toCompany.owner?.id) {
      await createNotification(
        toCompany.owner.id,
        'collaboration_request',
        'Collaboration Request',
        `${fromCompany.name} wants to collaborate with ${toCompany.name}`
      );
    }

    return collaboration;
  }

  async function getCollaborationsByCompany(companyId) {
    const collaborations = await getCollaborations();
    return collaborations.filter(
      c => c.companyA === companyId || c.companyB === companyId
    );
  }

  async function getActiveCollaborations(companyId) {
    const collaborations = await getCollaborations();
    return collaborations.filter(
      c => (c.companyA === companyId || c.companyB === companyId) && c.status === 'active'
    );
  }

  async function getPendingCollaborationRequests(companyId) {
    const collaborations = await getCollaborations();
    return collaborations.filter(
      c => c.companyB === companyId && c.status === 'pending'
    );
  }

  async function getOutgoingCollaborationRequests(companyId) {
    const collaborations = await getCollaborations();
    return collaborations.filter(
      c => c.companyA === companyId && c.status === 'pending'
    );
  }

  async function acceptCollaboration(collaborationId, companyId, userId) {
    const collaborations = await getCollaborations(true);
    const index = collaborations.findIndex(c => c.id === collaborationId);
    if (index === -1) throw new Error('Collaboration not found');

    const collaboration = collaborations[index];

    if (collaboration.companyB !== companyId) {
      throw new Error('Only the receiving company can accept');
    }

    const userRole = await getUserCompanyRole(companyId, userId);
    if (!hasCompanyPermission(userRole, 'admin')) {
      throw new Error('No permission to accept collaborations');
    }

    if (collaboration.status !== 'pending') {
      throw new Error('Collaboration is not pending');
    }

    collaboration.status = 'active';
    collaboration.acceptedBy = userId;
    collaboration.acceptedAt = new Date().toISOString();

    await saveCollaborations(collaborations);

    const fromCompany = await getCompanyById(collaboration.companyA);
    if (fromCompany?.owner?.id) {
      await createNotification(
        fromCompany.owner.id,
        'collaboration_accepted',
        'Collaboration Accepted',
        `${collaboration.companyBName} accepted your collaboration request!`
      );
    }

    return collaboration;
  }

  async function declineCollaboration(collaborationId, companyId, userId) {
    const collaborations = await getCollaborations(true);
    const index = collaborations.findIndex(c => c.id === collaborationId);
    if (index === -1) throw new Error('Collaboration not found');

    const collaboration = collaborations[index];

    if (collaboration.companyB !== companyId) {
      throw new Error('Only the receiving company can decline');
    }

    const userRole = await getUserCompanyRole(companyId, userId);
    if (!hasCompanyPermission(userRole, 'admin')) {
      throw new Error('No permission to decline collaborations');
    }

    if (collaboration.status !== 'pending') {
      throw new Error('Collaboration is not pending');
    }

    collaboration.status = 'declined';
    collaboration.declinedBy = userId;
    collaboration.declinedAt = new Date().toISOString();

    await saveCollaborations(collaborations);

    return collaboration;
  }

  async function cancelCollaboration(collaborationId, companyId, userId) {
    const collaborations = await getCollaborations(true);
    const index = collaborations.findIndex(c => c.id === collaborationId);
    if (index === -1) throw new Error('Collaboration not found');

    const collaboration = collaborations[index];

    if (collaboration.companyA !== companyId && collaboration.companyB !== companyId) {
      throw new Error('Company is not part of this collaboration');
    }

    const userRole = await getUserCompanyRole(companyId, userId);
    if (!hasCompanyPermission(userRole, 'admin')) {
      throw new Error('No permission to cancel collaborations');
    }

    collaboration.status = 'cancelled';
    collaboration.cancelledBy = userId;
    collaboration.cancelledAt = new Date().toISOString();

    await saveCollaborations(collaborations);

    const otherCompanyId = collaboration.companyA === companyId
      ? collaboration.companyB
      : collaboration.companyA;
    const otherCompany = await getCompanyById(otherCompanyId);
    const thisCompany = await getCompanyById(companyId);

    if (otherCompany?.owner?.id) {
      await createNotification(
        otherCompany.owner.id,
        'collaboration_cancelled',
        'Collaboration Ended',
        `${thisCompany?.name || 'A company'} has ended the collaboration`
      );
    }

    return collaboration;
  }

  async function hasActiveCollaborationCheck(companyIdA, companyIdB) {
    const collaborations = await getCollaborations();
    return collaborations.some(
      c => c.status === 'active' &&
           ((c.companyA === companyIdA && c.companyB === companyIdB) ||
            (c.companyA === companyIdB && c.companyB === companyIdA))
    );
  }

  function getCollaborationPartner(collaboration, myCompanyId) {
    if (collaboration.companyA === myCompanyId) return collaboration.companyB;
    if (collaboration.companyB === myCompanyId) return collaboration.companyA;
    return null;
  }

  // ===============================================================================
  // COMPANY CONTENT API (Lines, Stations, Buildings)
  // ===============================================================================

  async function getCompanyContent(forceRefresh = false) {
    if (!forceRefresh && cache.companyContent && isCacheValid('companyContent')) {
      return cache.companyContent;
    }

    try {
      const data = await proxyRequest('getCompanyContent');
      cache.companyContent = data.content || data || [];
      cache.lastFetch.companyContent = Date.now();
      return cache.companyContent;
    } catch (error) {
      console.error('[PrismBin] Failed to fetch company content:', error);
      return cache.companyContent || [];
    }
  }

  async function saveCompanyContent(content) {
    try {
      await proxyRequest('saveCompanyContent', { content });
      cache.companyContent = content;
      cache.lastFetch.companyContent = Date.now();
      return true;
    } catch (error) {
      console.error('[PrismBin] Failed to save company content:', error);
      return false;
    }
  }

  /**
   * Create a new content item (line, station, or building)
   */
  async function createCompanyContentItem(companyId, contentData, creatorId) {
    const content = await getCompanyContent(true);
    const company = await getCompanyById(companyId);

    if (!company) throw new Error('Company not found');

    // Verify creator has permission
    const creatorRole = await getUserCompanyRole(companyId, creatorId);
    if (!creatorRole) {
      throw new Error('Not a member of this company');
    }

    const item = {
      id: `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      companyId: companyId,
      companyName: company.name,
      type: contentData.type, // 'line', 'station', 'building'
      name: contentData.name,
      description: contentData.description || '',
      metadata: contentData.metadata || {},
      shared: false, // Default: not shared with collaborators
      sharedWith: [], // List of company IDs that can edit
      createdBy: creatorId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    content.push(item);
    await saveCompanyContent(content);

    return item;
  }

  /**
   * Get all content for a company
   */
  async function getContentByCompany(companyId) {
    const content = await getCompanyContent();
    return content.filter(c => c.companyId === companyId);
  }

  /**
   * Get content by type for a company
   */
  async function getContentByType(companyId, type) {
    const content = await getCompanyContent();
    return content.filter(c => c.companyId === companyId && c.type === type);
  }

  /**
   * Get a single content item by ID
   */
  async function getContentById(contentId) {
    const content = await getCompanyContent();
    return content.find(c => c.id === contentId);
  }

  /**
   * Update a content item
   */
  async function updateContentItem(contentId, updates, userId) {
    const content = await getCompanyContent(true);
    const index = content.findIndex(c => c.id === contentId);
    if (index === -1) throw new Error('Content not found');

    const item = content[index];

    // Check if user can edit
    const canEdit = await canEditContent(contentId, userId);
    if (!canEdit) {
      throw new Error('No permission to edit this content');
    }

    // Apply updates
    content[index] = {
      ...item,
      ...updates,
      id: item.id, // Prevent ID change
      companyId: item.companyId, // Prevent company change
      createdBy: item.createdBy, // Preserve creator
      createdAt: item.createdAt, // Preserve creation date
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    };

    await saveCompanyContent(content);
    return content[index];
  }

  /**
   * Delete a content item
   */
  async function deleteContentItem(contentId, userId) {
    const content = await getCompanyContent(true);
    const index = content.findIndex(c => c.id === contentId);
    if (index === -1) throw new Error('Content not found');

    const item = content[index];

    // Only company admins/owners can delete
    const userRole = await getUserCompanyRole(item.companyId, userId);
    if (!hasCompanyPermission(userRole, 'admin')) {
      throw new Error('No permission to delete this content');
    }

    const deleted = content.splice(index, 1)[0];
    await saveCompanyContent(content);
    return deleted;
  }

  /**
   * Toggle shared status for a content item
   */
  async function toggleContentShared(contentId, userId) {
    const content = await getCompanyContent(true);
    const index = content.findIndex(c => c.id === contentId);
    if (index === -1) throw new Error('Content not found');

    const item = content[index];

    // Only company admins/owners can toggle shared
    const userRole = await getUserCompanyRole(item.companyId, userId);
    if (!hasCompanyPermission(userRole, 'admin')) {
      throw new Error('No permission to share this content');
    }

    content[index].shared = !item.shared;
    content[index].updatedAt = new Date().toISOString();

    await saveCompanyContent(content);
    return content[index];
  }

  /**
   * Check if a user can edit content
   * User can edit if:
   * 1. They are a member of the owning company, OR
   * 2. They are a member of a collaborating company AND the content is marked as shared
   */
  async function canEditContent(contentId, userId) {
    const item = await getContentById(contentId);
    if (!item) return false;

    // Check if user is member of the owning company
    const userRole = await getUserCompanyRole(item.companyId, userId);
    if (userRole) return true;

    // Check if content is shared with any company the user belongs to
    if (!item.shared) return false;

    // Get active collaborations for the content's company
    const collaborations = await getActiveCollaborations(item.companyId);
    for (const collab of collaborations) {
      const partnerCompanyId = getCollaborationPartner(collab, item.companyId);
      if (partnerCompanyId) {
        const partnerRole = await getUserCompanyRole(partnerCompanyId, userId);
        if (partnerRole) {
          return true; // User is member of a collaborating company
        }
      }
    }

    return false;
  }

  /**
   * Get all shared content from collaborating companies
   */
  async function getSharedContentFromCollaborators(companyId) {
    const collaborations = await getActiveCollaborations(companyId);
    const sharedContent = [];

    for (const collab of collaborations) {
      const partnerCompanyId = getCollaborationPartner(collab, companyId);
      if (partnerCompanyId) {
        const partnerContent = await getContentByCompany(partnerCompanyId);
        const shared = partnerContent.filter(c => c.shared);
        sharedContent.push(...shared);
      }
    }

    return sharedContent;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODERATION REQUESTS API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get all moderation requests
   */
  async function getModerationRequests(forceRefresh = false) {
    if (!forceRefresh && cache.moderationRequests && isCacheValid('moderationRequests')) {
      return cache.moderationRequests;
    }

    try {
      const data = await proxyRequest('getModerationRequests');
      cache.moderationRequests = data.requests || data || [];
      cache.lastFetch.moderationRequests = Date.now();
      return cache.moderationRequests;
    } catch (error) {
      console.error('[PrismBin] Failed to fetch moderation requests:', error);
      return cache.moderationRequests || [];
    }
  }

  /**
   * Save moderation requests
   */
  async function saveModerationRequests(requests) {
    try {
      await proxyRequest('saveModerationRequests', { requests });
      cache.moderationRequests = requests;
      cache.lastFetch.moderationRequests = Date.now();
      return true;
    } catch (error) {
      console.error('[PrismBin] Failed to save moderation requests:', error);
      throw error;
    }
  }

  /**
   * Create a new moderation request
   * @param {Object} requestData - Request data
   * @param {string} requestData.type - Type from MODERATION_TYPES
   * @param {string} requestData.userId - User ID who created the request
   * @param {Object} requestData.data - Request-specific data (content details, etc.)
   * @param {string} [requestData.companyId] - Company ID if related to company content
   */
  async function createModerationRequest(requestData) {
    const requests = await getModerationRequests();

    const newRequest = {
      id: generateId(),
      type: requestData.type,
      status: MODERATION_STATUS.PENDING,
      userId: requestData.userId,
      companyId: requestData.companyId || null,
      data: requestData.data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reviewedBy: null,
      reviewedAt: null,
      reviewComment: null,
    };

    requests.push(newRequest);
    await saveModerationRequests(requests);

    // Notify moderators
    const users = await getUsers();
    const moderators = users.filter(u =>
      u.role === USER_ROLES.MOD || u.role === USER_ROLES.ADMIN
    );

    const typeLabel = MODERATION_TYPE_LABELS[requestData.type] || requestData.type;
    const user = users.find(u => u.id === requestData.userId);
    const userName = user?.nickname || user?.name || 'Пользователь';

    for (const mod of moderators) {
      await createNotification({
        userId: mod.id,
        type: 'moderation_request',
        title: 'Новая заявка на модерацию',
        message: `${userName} отправил заявку: ${typeLabel}`,
        data: { requestId: newRequest.id },
      });
    }

    return newRequest;
  }

  /**
   * Review a moderation request (approve/reject)
   * @param {string} requestId - Request ID
   * @param {string} reviewerId - Moderator/Admin user ID
   * @param {string} status - New status (approved, rejected, revision_requested)
   * @param {string} [comment] - Review comment
   */
  async function reviewModerationRequest(requestId, reviewerId, status, comment = null) {
    const requests = await getModerationRequests();
    const index = requests.findIndex(r => r.id === requestId);

    if (index === -1) {
      throw new Error('Request not found');
    }

    const request = requests[index];

    // Check reviewer permissions
    const reviewer = await getUserById(reviewerId);
    if (!reviewer || (reviewer.role !== USER_ROLES.MOD && reviewer.role !== USER_ROLES.ADMIN)) {
      throw new Error('No permission to review requests');
    }

    requests[index] = {
      ...request,
      status,
      reviewedBy: reviewerId,
      reviewedAt: new Date().toISOString(),
      reviewComment: comment,
      updatedAt: new Date().toISOString(),
    };

    await saveModerationRequests(requests);

    // Notify the requester
    const typeLabel = MODERATION_TYPE_LABELS[request.type] || request.type;
    let statusMessage = '';
    switch (status) {
      case MODERATION_STATUS.APPROVED:
        statusMessage = 'одобрена';
        break;
      case MODERATION_STATUS.REJECTED:
        statusMessage = 'отклонена';
        break;
      case MODERATION_STATUS.REVISION_REQUESTED:
        statusMessage = 'требует доработки';
        break;
    }

    await createNotification({
      userId: request.userId,
      type: 'moderation_result',
      title: 'Результат модерации',
      message: `Ваша заявка "${typeLabel}" ${statusMessage}${comment ? `: ${comment}` : ''}`,
      data: { requestId: request.id, status },
    });

    // If approved, execute the requested action
    if (status === MODERATION_STATUS.APPROVED) {
      await executeModerationAction(request);
    }

    return requests[index];
  }

  /**
   * Execute the action from an approved moderation request
   */
  async function executeModerationAction(request) {
    try {
      switch (request.type) {
        case MODERATION_TYPES.CREATE_CONTENT:
          // Create the content item
          await createCompanyContentItem({
            companyId: request.companyId,
            type: request.data.contentType,
            name: request.data.name,
            description: request.data.description,
            createdBy: request.userId,
          });
          break;

        case MODERATION_TYPES.EDIT_CONTENT:
          // Update the content item
          await updateContentItem(request.data.contentId, request.userId, {
            name: request.data.name,
            description: request.data.description,
          });
          break;

        case MODERATION_TYPES.CREATE_PROJECT:
          // Create the project
          await createProject({
            ...request.data,
            createdBy: request.userId,
          });
          break;

        case MODERATION_TYPES.CREATE_POST:
          // Create the post
          await createPost({
            ...request.data,
            authorId: request.userId,
          });
          break;
      }
    } catch (error) {
      console.error('Error executing moderation action:', error);
      throw error;
    }
  }

  /**
   * Get pending moderation requests
   */
  async function getPendingModerationRequests() {
    const requests = await getModerationRequests();
    return requests.filter(r => r.status === MODERATION_STATUS.PENDING);
  }

  /**
   * Get moderation requests by user
   */
  async function getUserModerationRequests(userId) {
    const requests = await getModerationRequests();
    return requests.filter(r => r.userId === userId);
  }

  /**
   * Get moderation requests by company
   */
  async function getCompanyModerationRequests(companyId) {
    const requests = await getModerationRequests();
    return requests.filter(r => r.companyId === companyId);
  }

  /**
   * Get moderation request by ID
   */
  async function getModerationRequestById(requestId) {
    const requests = await getModerationRequests();
    return requests.find(r => r.id === requestId) || null;
  }

  /**
   * Cancel a pending moderation request (by the requester)
   */
  async function cancelModerationRequest(requestId, userId) {
    const requests = await getModerationRequests();
    const index = requests.findIndex(r => r.id === requestId);

    if (index === -1) {
      throw new Error('Request not found');
    }

    const request = requests[index];

    // Only the requester can cancel
    if (request.userId !== userId) {
      throw new Error('No permission to cancel this request');
    }

    // Can only cancel pending requests
    if (request.status !== MODERATION_STATUS.PENDING) {
      throw new Error('Can only cancel pending requests');
    }

    requests.splice(index, 1);
    await saveModerationRequests(requests);

    return true;
  }

  /**
   * Check if a user needs moderation for an action
   * Returns true if the user is NOT trusted in the company
   */
  async function needsModeration(userId, companyId) {
    // Check if user is a trusted member of the company
    if (companyId) {
      const isTrusted = await isCompanyTrustedMember(companyId, userId);
      if (isTrusted) return false;
    }

    // Check global role - mods and admins don't need moderation
    const user = await getUserById(userId);
    if (user && (user.role === USER_ROLES.MOD || user.role === USER_ROLES.ADMIN)) {
      return false;
    }

    return true;
  }

  // EXPORT
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  return {
    // Constants
    PROJECT_CATEGORIES,
    CATEGORY_LABELS,
    PROJECT_ROLES,
    USER_ROLES,
    ROLE_HIERARCHY,
    hasPermission,

    // Permissions
    PERMISSION_TYPES,
    PERMISSION_LABELS,
    PERMISSION_DESCRIPTIONS,
    DEFAULT_ROLE_PERMISSIONS,
    getRolePermissions,
    getAllRolePermissions,
    saveRolePermissions,
    updateRolePermissions,
    getUserPermissionOverrides,
    setUserPermissionOverrides,
    clearUserPermissionOverrides,
    checkUserPermission,
    checkUserPermissionSync,
    getUserEffectivePermissions,

    // Users
    getUsers,
    saveUsers,
    getUserById,
    getUserByEmail,
    updateUser,
    updateUserRole,

    // Projects
    getProjects,
    saveProjects,
    createProject,
    updateProject,
    deleteProject,
    getProjectsByUser,
    getProjectsByRole,
    getProjectsByCategory,
    searchProjects,
    addProjectMember,
    removeProjectMember,

    // Posts
    POST_CATEGORIES,
    POST_CATEGORY_LABELS,
    getPosts,
    savePosts,
    createPost,
    updatePost,
    deletePost,
    getPostsByUser,
    getPostsByCategory,

    // Companies
    COMPANY_ROLES,
    COMPANY_ROLE_HIERARCHY,
    INVITATION_STATUS,
    hasCompanyPermission,
    getCompanies,
    saveCompanies,
    getCompanyById,
    createCompany,
    updateCompany,
    deleteCompany,
    getCompaniesByUser,
    getUserCompanyRole,
    isCompanyTrustedMember,
    setCompanyTrustedMember,
    addCompanyMember,
    removeCompanyMember,
    updateCompanyMemberRole,

    // Invitations
    getInvitations,
    saveInvitations,
    createInvitation,
    getInvitationsForUser,
    getInvitationsByCompany,
    getPendingInvitationsByCompany,
    acceptInvitation,
    declineInvitation,
    cancelInvitation,

    // Collaborations
    COLLABORATION_STATUS,
    getCollaborations,
    saveCollaborations,
    createCollaborationRequest,
    getCollaborationsByCompany,
    getActiveCollaborations,
    getPendingCollaborationRequests,
    getOutgoingCollaborationRequests,
    acceptCollaboration,
    declineCollaboration,
    cancelCollaboration,
    hasActiveCollaborationCheck,
    getCollaborationPartner,

    // Company Content (Lines, Stations, Buildings)
    CONTENT_TYPES,
    CONTENT_TYPE_LABELS,
    CONTENT_TYPE_ICONS,
    getCompanyContent,
    saveCompanyContent,
    createCompanyContentItem,
    getContentByCompany,
    getContentByType,
    getContentById,
    updateContentItem,
    deleteContentItem,
    toggleContentShared,
    canEditContent,
    getSharedContentFromCollaborators,

    // Moderation Requests
    MODERATION_STATUS,
    MODERATION_TYPES,
    MODERATION_TYPE_LABELS,
    getModerationRequests,
    saveModerationRequests,
    createModerationRequest,
    reviewModerationRequest,
    executeModerationAction,
    getPendingModerationRequests,
    getUserModerationRequests,
    getCompanyModerationRequests,
    getModerationRequestById,
    cancelModerationRequest,
    needsModeration,

    // Nickname Requests
    getNicknameRequests,
    saveNicknameRequests,
    createNicknameRequest,
    reviewNicknameRequest,
    getPendingNicknameRequests,

    // Notifications
    getNotifications,
    saveNotifications,
    createNotification,
    getUserNotifications,
    getUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    broadcastNotification,

    // Cache
    clearCache,
    
    // Environment detection
    isLocalDevWithoutNetlify,
    isProduction,
  };

})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrismBin;
}
