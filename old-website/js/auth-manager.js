/* ═══════════════════════════════════════════════════════════════════════════
   PrismMTR - Auth Manager (Single Source of Truth)
   
   ONE place for all auth logic:
   - initAuth(requireAuth, requireRole) - single session check
   - getSession() - returns in-memory session
   - logout() - clear session + SW cache
   
   NO polling, NO TTL refresh. Role updates via Supabase Realtime only.
   ═══════════════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIG
  // ═══════════════════════════════════════════════════════════════════════════

  const SESSION_ENDPOINT = '/.netlify/functions/session';
  const LOGOUT_ENDPOINT = '/.netlify/functions/logout';
  const SESSION_TIMEOUT_MS = 8000;

  const ROLE_HIERARCHY = { user: 1, mod: 2, admin: 3 };

  const DEBUG = !window.location.origin.includes('prismmtr.org') &&
                !window.location.origin.includes('netlify.app');
  
  const log = DEBUG ? console.log.bind(console, '[AuthManager]') : () => {};

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE (in-memory only, NO localStorage/sessionStorage)
  // ═══════════════════════════════════════════════════════════════════════════

  let session = null;
  let sessionChecked = false;
  let sessionPromise = null;
  let realtimeSubscription = null;

  // Expose for other scripts (read-only)
  Object.defineProperty(window, '__session', {
    get: () => session,
    set: (val) => { session = val; },
    configurable: true
  });

  Object.defineProperty(window, '__sessionChecked', {
    get: () => sessionChecked,
    set: (val) => { sessionChecked = val; },
    configurable: true
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CORE: FETCH SESSION (single request)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fetch session from server - THE ONLY place that calls /session
   * @returns {Promise<Object|null>} user object or null
   */
  async function fetchSession() {
    // Dedupe: if already fetching, return same promise
    if (sessionPromise) {
      log('Waiting for existing session fetch...');
      return sessionPromise;
    }

    // Already checked? Return cached result
    if (sessionChecked) {
      return session;
    }

    log('Fetching session...');

    sessionPromise = (async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SESSION_TIMEOUT_MS);

        const response = await fetch(SESSION_ENDPOINT, {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          log('Session request failed:', response.status);
          session = null;
          sessionChecked = true;
          return null;
        }

        const data = await response.json();

        if (data.authenticated && data.user) {
          session = normalizeUser(data.user);
          log('Session loaded:', session.id, 'role:', session.role);
        } else {
          session = null;
          log('No active session');
        }

        sessionChecked = true;
        return session;

      } catch (error) {
        if (error.name === 'AbortError') {
          log('Session request timed out');
        } else {
          log('Session error:', error.message);
        }
        session = null;
        sessionChecked = true;
        return null;

      } finally {
        sessionPromise = null;
      }
    })();

    return sessionPromise;
  }

  /**
   * Normalize user object (snake_case → camelCase)
   */
  function normalizeUser(u) {
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      nickname: u.nickname,
      mcNickname: u.mc_nickname || u.mcNickname,
      role: u.role || 'user',
      avatar: u.avatar_url || u.avatar,
      connections: u.connections || {},
      version: u.version || 1,
      createdAt: u.created_at || u.createdAt,
      // Computed
      isAdmin: u.role === 'admin',
      isMod: u.role === 'mod' || u.role === 'admin',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialize auth - call on protected pages
   * @param {boolean} requireAuth - page requires login
   * @param {string} requireRole - minimum role required ('mod', 'admin')
   * @returns {Promise<{user: Object|null, allowed: boolean}>}
   */
  async function initAuth(requireAuth = false, requireRole = null) {
    const user = await fetchSession();
    const isLoggedIn = !!user;
    const userRole = user?.role || 'user';

    log('initAuth:', { requireAuth, requireRole, isLoggedIn, userRole });

    // Dispatch event for UI components
    window.dispatchEvent(new CustomEvent('prism:auth:ready', {
      detail: { user, isLoggedIn }
    }));

    // Check permissions
    let allowed = true;

    if (requireAuth && !isLoggedIn) {
      allowed = false;
      log('Access denied: not logged in');
    }

    if (requireRole && allowed) {
      const userLevel = ROLE_HIERARCHY[userRole] || 0;
      const requiredLevel = ROLE_HIERARCHY[requireRole] || 0;
      if (userLevel < requiredLevel) {
        allowed = false;
        log('Access denied: insufficient role');
      }
    }

    // Start realtime subscription ONLY on protected pages (requireAuth=true)
    // Public pages and lazy dashboard checks should NOT have realtime
    if (requireAuth && isLoggedIn) {
      startRealtimeSubscription(user.id, requireRole);
    }

    return { user, allowed };
  }

  /**
   * Get current session (sync, in-memory)
   */
  function getSession() {
    return session;
  }

  /**
   * Check if user is logged in
   */
  function isLoggedIn() {
    return !!session;
  }

  /**
   * Check if user has required role
   */
  function hasRole(requiredRole) {
    if (!session) return false;
    const userLevel = ROLE_HIERARCHY[session.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
    return userLevel >= requiredLevel;
  }

  /**
   * Logout - clear session, notify SW, redirect
   */
  async function logout(redirectUrl = '/index.html') {
    log('Logging out...');

    // Stop realtime subscription
    stopRealtimeSubscription();

    // Clear in-memory state
    session = null;
    sessionChecked = false;

    // Clear SW private cache
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CLEAR_PRIVATE_CACHE',
        payload: {}
      });
    }

    // Call server to clear cookie
    try {
      await fetch(LOGOUT_ENDPOINT, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (e) {
      log('Logout request failed:', e.message);
    }

    // Dispatch event
    window.dispatchEvent(new CustomEvent('prism:logout'));

    // Redirect
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REALTIME: SUPABASE SUBSCRIPTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Subscribe to user changes via Supabase Realtime
   * When role/version changes -> refetch session
   */
  function startRealtimeSubscription(userId, requiredRole) {
    if (realtimeSubscription) {
      log('Realtime already subscribed');
      return;
    }

    // Check if Supabase client is available
    if (!window.supabaseClient) {
      log('Supabase client not available, skipping realtime');
      return;
    }

    log('Starting realtime subscription for user:', userId);

    const channel = window.supabaseClient
      .channel(`user-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`
        },
        async (payload) => {
          log('Realtime UPDATE received:', payload.new);
          await handleUserUpdate(payload.new, requiredRole);
        }
      )
      .subscribe((status) => {
        log('Realtime subscription status:', status);
      });

    realtimeSubscription = channel;
  }

  /**
   * Stop realtime subscription
   */
  function stopRealtimeSubscription() {
    if (realtimeSubscription && window.supabaseClient) {
      log('Stopping realtime subscription');
      window.supabaseClient.removeChannel(realtimeSubscription);
      realtimeSubscription = null;
    }
  }

  /**
   * Handle user update from realtime
   */
  async function handleUserUpdate(newUserData, requiredRole) {
    const oldVersion = session?.version;
    const oldRole = session?.role;

    const newVersion = newUserData.version;
    const newRole = newUserData.role;

    log('User update:', { oldVersion, newVersion, oldRole, newRole });

    // Check if anything important changed
    if (oldVersion === newVersion && oldRole === newRole) {
      log('No significant changes, skipping refetch');
      return;
    }

    // Refetch session to get fresh data with server validation
    log('Refetching session due to user change...');
    sessionChecked = false; // Force refetch
    const user = await fetchSession();

    // Invalidate SW private cache (user data changed)
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'INVALIDATE_CACHE',
        payload: { action: 'getMyProfile', isPrivate: true }
      });
    }

    // Dispatch update event for UI
    window.dispatchEvent(new CustomEvent('prism:user:updated', {
      detail: { user, oldRole, newRole }
    }));

    // Check if access is now denied (role downgrade)
    if (requiredRole && user) {
      const userLevel = ROLE_HIERARCHY[user.role] || 0;
      const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;

      if (userLevel < requiredLevel) {
        log('Access revoked! Role changed from', oldRole, 'to', newRole);
        window.dispatchEvent(new CustomEvent('prism:access:revoked', {
          detail: { reason: 'role_changed', oldRole, newRole }
        }));
        // Immediate logout + clear cache + redirect (no soft attempts)
        logout('/index.html?reason=revoked');
        return; // Stop processing
      }
    }

    // Handle complete session invalidation
    if (!user) {
      log('Session invalidated by server');
      window.dispatchEvent(new CustomEvent('prism:access:revoked', {
        detail: { reason: 'session_invalid' }
      }));
      logout('/index.html?reason=expired');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESS DENIED HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Handle access denied - redirect with reason
   */
  function handleAccessDenied(reason = 'auth') {
    const currentPath = window.location.pathname + window.location.search;
    const redirectUrl = `index.html?next=${encodeURIComponent(currentPath)}&reason=${reason}`;
    window.location.replace(redirectUrl);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════

  window.AuthManager = {
    // Core API
    initAuth,
    getSession,
    isLoggedIn,
    hasRole,
    logout,
    
    // Access control
    handleAccessDenied,
    
    // For debugging
    _getState: () => ({ session, sessionChecked, hasRealtime: !!realtimeSubscription })
  };

  log('AuthManager initialized');

})();
