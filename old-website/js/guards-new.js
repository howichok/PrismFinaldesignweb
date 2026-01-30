/**
 * PrismMTR - Page Guards (Thin Wrapper)
 *
 * Uses AuthManager for all auth logic.
 * Just reads script attributes and calls AuthManager.initAuth()
 *
 * USAGE:
 * <script src="js/auth-manager.js"></script>
 * <script src="js/guards.js" data-require-auth="true" data-require-role="mod"></script>
 */

(function () {
  'use strict';

  const DEBUG = !window.location.origin.includes('prismmtr.org') &&
                !window.location.origin.includes('netlify.app');
  
  const log = DEBUG ? console.log.bind(console, '[Guards]') : () => {};

  // ═══════════════════════════════════════════════════════════════════════════
  // READ SCRIPT ATTRIBUTES
  // ═══════════════════════════════════════════════════════════════════════════

  const scriptTag = document.currentScript;
  const requireAuth = scriptTag?.getAttribute('data-require-auth') === 'true';
  const requireRole = scriptTag?.getAttribute('data-require-role') || null;

  log('Guards loaded:', { requireAuth, requireRole });

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════════════

  async function init() {
    // Wait for AuthManager
    if (typeof AuthManager === 'undefined') {
      console.error('[Guards] AuthManager not loaded! Include auth-manager.js before guards.js');
      return;
    }

    // Only check session on protected pages
    if (!requireAuth && !requireRole) {
      log('Public page, skipping auth check');
      window.dispatchEvent(new CustomEvent('prism:guards:ready', { detail: { user: null } }));
      return;
    }

    // Call AuthManager
    const { user, allowed } = await AuthManager.initAuth(requireAuth, requireRole);

    log('Auth result:', { user: user?.id, allowed });

    // Handle access denied
    if (!allowed) {
      const reason = !user ? 'auth' : 'role';
      AuthManager.handleAccessDenied(reason);
      return;
    }

    // Notify SW of user for private cache isolation
    if (user && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SET_USER',
        payload: { userId: user.id }
      });
    }

    // Dispatch ready event
    window.dispatchEvent(new CustomEvent('prism:guards:ready', { detail: { user } }));

    log('Page access granted');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT (minimal, for backward compat)
  // ═══════════════════════════════════════════════════════════════════════════

  window.PrismGuards = {
    getSession: () => AuthManager?.getSession() || null,
    isLoggedIn: () => AuthManager?.isLoggedIn() || false,
    hasRole: (role) => AuthManager?.hasRole(role) || false,
    logout: () => AuthManager?.logout(),
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
