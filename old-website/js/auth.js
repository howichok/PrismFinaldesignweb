/* ═══════════════════════════════════════════════════════════════════════════
   PrismMTR - Auth System v7 (Cookie-Based)
   
   Uses HttpOnly cookie sessions via Netlify Functions.
   NO localStorage, sessionStorage, or IndexedDB.
   
   Session is managed entirely server-side:
   - GET /.netlify/functions/session → check session
   - POST /.netlify/functions/logout → clear session
   - GET /.netlify/functions/auth-discord?next=/path → start OAuth
   
   Client stores session in window.__session (in-memory only)
   ═══════════════════════════════════════════════════════════════════════════ */

const PrismAuth = (function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // DEBUG LOGGING
  // ═══════════════════════════════════════════════════════════════════════════

  const DEBUG = !window.location.origin.includes('prismmtr.org') && 
                !window.location.origin.includes('netlify.app');
  
  const log = DEBUG ? console.log.bind(console, '[Auth]') : () => {};

  // ═══════════════════════════════════════════════════════════════════════════
  // ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  const SESSION_ENDPOINT = '/.netlify/functions/session';
  const LOGOUT_ENDPOINT = '/.netlify/functions/logout';
  const AUTH_DISCORD_ENDPOINT = '/.netlify/functions/auth-discord';

  // ═══════════════════════════════════════════════════════════════════════════
  // IN-MEMORY STATE (NO STORAGE)
  // ═══════════════════════════════════════════════════════════════════════════

  // Session is stored ONLY in memory
  // window.__session is set by guards.js after fetching from server
  
  function getSession() {
    return window.__session || null;
  }

  function setSession(user) {
    window.__session = user;
    window.__sessionChecked = true;
  }

  function clearSession() {
    window.__session = null;
    window.__sessionChecked = false;
    // Invalidate session cache in apiFetch
    if (typeof apiFetch !== 'undefined') {
      apiFetch.invalidate('/session');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fetch session from server
   * Uses window.__session if already checked by guards.js (NO duplicate request)
   */
  async function fetchSession() {
    // If guards.js already checked, use cached result
    if (window.__sessionChecked) {
      const user = getSession();
      // Dispatch events for components that are waiting
      if (user) {
        window.dispatchEvent(new CustomEvent('prism:login:success', {
          detail: {
            user: user,
            requiresMcNickname: !user.mc_nickname && !user.mcNickname
          }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('prism:auth:checked', { detail: { user: null } }));
      }
      return user;
    }

    // If guards.js is fetching, wait for it
    if (window.__sessionPromise) {
      log('Waiting for guards.js session fetch...');
      const result = await window.__sessionPromise;
      const user = result?.user || null;
      if (user) {
        window.dispatchEvent(new CustomEvent('prism:login:success', {
          detail: { user, requiresMcNickname: !user.mc_nickname && !user.mcNickname }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('prism:auth:checked', { detail: { user: null } }));
      }
      return user;
    }

    // Otherwise fetch ourselves (fallback - should rarely happen)
    log('Fetching session (auth.js fallback)...');
    
    try {
      const response = await fetch(SESSION_ENDPOINT, {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.authenticated && data.user) {
          setSession(data.user);
          log('Session loaded:', data.user.id);
          
          window.dispatchEvent(new CustomEvent('prism:login:success', {
            detail: {
              user: data.user,
              requiresMcNickname: !data.user.mc_nickname && !data.user.mcNickname
            }
          }));
          
          return data.user;
        }
      }
      
      // No session
      window.dispatchEvent(new CustomEvent('prism:auth:checked', { detail: { user: null } }));
      clearSession();
      return null;
    } catch (error) {
      log('Session fetch error:', error.message);
      window.dispatchEvent(new CustomEvent('prism:auth:checked', { detail: { user: null } }));
      clearSession();
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API - USER STATE
  // ═══════════════════════════════════════════════════════════════════════════

  function isLoggedIn() {
    return !!getSession();
  }

  function getUser() {
    return getSession();
  }

  function getUserRole() {
    return getSession()?.role || null;
  }

  function isStaff() {
    const role = getUserRole();
    return role === 'mod' || role === 'admin';
  }

  function isAdmin() {
    return getUserRole() === 'admin';
  }

  function hasDiscord() {
    const connections = getSession()?.connections;
    return connections?.discord?.connected === true;
  }

  function requiresMcNickname() {
    const user = getSession();
    return user && !user.mcNickname;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API - AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Start OAuth login with a provider
   * Redirects to auth endpoint which handles the OAuth flow
   * @param {string} provider - 'discord', 'google', or 'github'
   */
  function loginWithProvider(provider) {
    if (provider !== 'discord') {
      throw new Error(`Provider ${provider} not yet supported`);
    }

    // Get current path for redirect after login
    const currentPath = window.location.pathname + window.location.search;
    const next = encodeURIComponent(currentPath || '/dashboard.html');
    
    // Redirect to auth endpoint
    const authUrl = `${AUTH_DISCORD_ENDPOINT}?next=${next}`;
    log('Redirecting to OAuth:', authUrl);
    
    window.location.href = authUrl;
  }

  /**
   * Logout user
   * Calls server to clear session cookie, then redirects to home
   */
  async function logout() {
    log('Logging out...');

    // Set flag to prevent re-auth during redirect
    window.__loggingOut = true;

    // Clear in-memory session
    clearSession();

    // Clear data caches
    if (typeof PrismBin !== 'undefined') {
      try { PrismBin.clearCache(); } catch (e) {}
    }
    if (typeof PrismData !== 'undefined') {
      try { PrismData.clearCache(); } catch (e) {}
    }

    // Clear Service Worker private cache
    if (window.PrismPrefetch?.handleLogout) {
      try {
        window.PrismPrefetch.handleLogout();
      } catch (e) {}
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

    // Dispatch logout event
    window.dispatchEvent(new CustomEvent('prism:logout'));

    // Redirect to home with cache buster
    window.location.replace(window.location.origin + '/index.html?logged_out=' + Date.now());
  }

  /**
   * Refresh user data from server
   */
  async function refreshUser() {
    window.__sessionChecked = false;
    const user = await fetchSession();
    
    if (user) {
      window.dispatchEvent(new CustomEvent('prism:auth:changed', { detail: { user } }));
    }
    
    return user;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API - USER ACTIONS (require Supabase)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set Minecraft nickname for current user
   */
  async function setMcNickname(nickname) {
    const user = getSession();
    if (!user) throw new Error('Not logged in');

    if (!nickname || nickname.length < 3 || nickname.length > 16) {
      throw new Error('Minecraft nickname must be 3-16 characters');
    }
    if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
      throw new Error('Nickname can only contain letters, numbers, and underscores');
    }

    // Update via PrismBin (which calls Supabase)
    if (typeof PrismBin !== 'undefined') {
      await PrismBin.updateUser(user.id, { mcNickname: nickname });
      
      // Refresh session to get updated user
      await refreshUser();
      return getSession();
    }
    
    throw new Error('PrismBin not available');
  }

  /**
   * Request nickname change (creates pending request)
   */
  async function requestNicknameChange(newNickname) {
    const user = getSession();
    if (!user) throw new Error('Not logged in');

    if (!newNickname || newNickname.length < 3 || newNickname.length > 16) {
      throw new Error('Nickname must be 3-16 characters');
    }
    if (!/^[a-zA-Z0-9_]+$/.test(newNickname)) {
      throw new Error('Nickname can only contain letters, numbers, and underscores');
    }

    if (typeof PrismBin !== 'undefined') {
      return PrismBin.createNicknameRequest(user.id, user.mcNickname, newNickname);
    }
    
    throw new Error('PrismBin not available');
  }

  /**
   * Connect additional OAuth provider to account
   */
  function connectProvider(provider) {
    if (!getSession()) throw new Error('Not logged in');
    return loginWithProvider(provider);
  }

  /**
   * Disconnect OAuth provider from account
   */
  async function disconnectProvider(provider) {
    const user = getSession();
    if (!user) throw new Error('Not logged in');

    // Can't disconnect the provider you're logged in with
    // (This is now handled server-side, but we keep basic check)
    
    if (typeof PrismBin !== 'undefined') {
      const connections = { ...user.connections };
      if (connections[provider]) {
        connections[provider] = { connected: false };
        await PrismBin.updateUser(user.id, { connections });
        await refreshUser();
        return getSession();
      }
    }
    
    throw new Error('Cannot disconnect provider');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API - SETTINGS (session-only, not persisted)
  // ═══════════════════════════════════════════════════════════════════════════

  function getSettings() {
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return {
      darkMode: prefersDark,
      starsEnabled: true,
      soundsEnabled: false
    };
  }

  function setSettings(settings) {
    if (settings.darkMode !== undefined) {
      document.body.classList.toggle('dark-mode', settings.darkMode);
    }
  }

  function setDarkMode(enabled) {
    document.body.classList.toggle('dark-mode', enabled);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API - NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async function getNotifications() {
    const user = getSession();
    if (!user || typeof PrismBin === 'undefined') return [];
    return PrismBin.getUserNotifications(user.id);
  }

  async function markNotificationRead(notificationId) {
    if (typeof PrismBin !== 'undefined') {
      return PrismBin.markNotificationRead(notificationId);
    }
  }

  async function markAllNotificationsRead() {
    const user = getSession();
    if (!user || typeof PrismBin === 'undefined') return;
    return PrismBin.markAllNotificationsRead(user.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API - REDIRECTS (URL params only, no storage)
  // ═══════════════════════════════════════════════════════════════════════════

  function setRedirect(path) {
    // Redirect is now encoded in OAuth state, not stored
    log('setRedirect called (no-op):', path);
  }

  function consumeRedirect() {
    // Check URL params for ?next=
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');
    if (next && next.startsWith('/')) {
      return next;
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API - ADMIN
  // ═══════════════════════════════════════════════════════════════════════════

  async function getAllUsers() {
    if (typeof PrismBin !== 'undefined') {
      return PrismBin.getUsers();
    }
    return [];
  }

  async function setUserRole(userId, role) {
    if (!['user', 'mod', 'admin'].includes(role)) {
      throw new Error('Invalid role');
    }
    if (typeof PrismBin !== 'undefined') {
      return PrismBin.updateUser(userId, { role });
    }
    throw new Error('PrismBin not available');
  }

  async function deleteUser(userId) {
    if (typeof PrismBin !== 'undefined') {
      return PrismBin.deleteUser(userId);
    }
    throw new Error('PrismBin not available');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY API - for backwards compatibility
  // ═══════════════════════════════════════════════════════════════════════════

  function read() {
    const user = getSession();
    return {
      isLoggedIn: !!user,
      userId: user?.id || null,
      username: user?.nickname || user?.mcNickname || 'User',
      email: user?.email || '',
      avatar: user?.avatar || null,
      darkMode: getSettings().darkMode,
      provider: 'discord'
    };
  }

  // handleOAuthCallback is no longer needed - callback handled server-side
  function handleOAuthCallback() {
    log('handleOAuthCallback called (no-op - handled server-side)');
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  function init() {
    log('PrismAuth v7 initialized (cookie-based)');
    
    // Apply dark mode from system preference
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      document.body.classList.add('dark-mode');
    }

    // Check if we just logged out
    const params = new URLSearchParams(window.location.search);
    if (params.has('logged_out')) {
      log('Just logged out, cleaning URL');
      params.delete('logged_out');
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      clearSession();
      return;
    }

    // Check for OAuth error
    if (params.has('error')) {
      const error = params.get('error');
      log('OAuth error:', error);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('prism:login:error', { 
          detail: { error } 
        }));
        if (window.PrismUI?.showToast) {
          window.PrismUI.showToast('Login Failed', error, 5000);
        }
      }, 100);
      
      // Clean URL
      params.delete('error');
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }

    // Session will be fetched by guards.js on protected pages
    // or we can fetch it here for public pages
    if (!window.__sessionPromise && !window.__sessionChecked) {
      // On public pages, optionally check session for header UI
      // But don't block - let guards.js handle protected pages
    }
    
    // Listen for auth expiry (401 from any endpoint)
    window.addEventListener('prism:auth:expired', () => {
      log('Auth expired - clearing session');
      clearSession();
      window.dispatchEvent(new CustomEvent('prism:auth:changed'));
      // Optionally redirect to login
      if (document.body?.dataset?.page === 'dashboard') {
        window.location.href = '/index.html?session_expired=1';
      }
    });
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // Authentication
    loginWithProvider,
    handleOAuthCallback,
    logout,
    
    // User state
    isLoggedIn,
    getUser,
    getUserRole,
    refreshUser,
    get currentUser() { return getUser(); },
    
    // User actions
    setMcNickname,
    requestNicknameChange,
    requiresMcNickname,
    hasDiscord,
    connectProvider,
    disconnectProvider,
    isStaff,
    isAdmin,
    
    // Settings
    getSettings,
    setSettings,
    setDarkMode,
    
    // Notifications
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    
    // Redirects
    setRedirect,
    consumeRedirect,
    
    // Admin
    getAllUsers,
    setUserRole,
    deleteUser,
    
    // Legacy
    read
  };

})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrismAuth;
}
