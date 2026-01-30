/**
 * PrismMTR - Page Guards System
 *
 * Provides client-side page protection based on authentication and roles.
 * Must be loaded BEFORE page-specific scripts.
 *
 * USAGE:
 * Include this script on protected pages:
 * <script src="js/guards.js" data-require-auth="true" data-require-role="mod"></script>
 *
 * ATTRIBUTES:
 * - data-require-auth="true"  : Page requires login
 * - data-require-role="mod"   : Page requires mod or admin role
 * - data-require-role="admin" : Page requires admin role only
 * - data-redirect="/custom"   : Custom redirect URL (default: index.html)
 *
 * AUTH FLOW:
 * 1. Single GET /api/session request (uses HttpOnly cookie)
 * 2. Response stored in window.__session (in-memory only)
 * 3. userId sent to Service Worker via postMessage
 * 4. NO localStorage/sessionStorage/IndexedDB - ever
 *
 * REDIRECT FLOW (no storage):
 * - Access denied → redirect to index.html?next=/protected/path&reason=auth
 * - After login → read ?next param, validate as relative path, redirect
 *
 * PREFETCH INTEGRATION:
 * After successful session check:
 * - Registers Service Worker for caching
 * - Triggers prefetchPublic() for all users
 * - Triggers prefetchPrivate(userId) for authenticated users
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  const ROLE_HIERARCHY = {
    user: 1,
    mod: 2,
    admin: 3,
  };

  // REST endpoints
  const SESSION_ENDPOINT = '/.netlify/functions/session';
  const LOGOUT_ENDPOINT = '/.netlify/functions/logout';
  const SESSION_TIMEOUT_MS = 8000;

  const DEBUG = !window.location.origin.includes('prismmtr.org') &&
                !window.location.origin.includes('netlify.app');
  
  const log = DEBUG ? console.log.bind(console, '[Guards]') : () => {};

  // Get script tag attributes
  const scriptTag = document.currentScript;
  const requireAuth = scriptTag?.getAttribute('data-require-auth') === 'true';
  const requireRole = scriptTag?.getAttribute('data-require-role');
  const redirectUrl = scriptTag?.getAttribute('data-redirect') || 'index.html';

  // In-memory session store (NO localStorage/sessionStorage)
  window.__session = null;
  window.__sessionChecked = false;
  window.__sessionPromise = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION API (HttpOnly Cookie Auth)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fetch session from server using HttpOnly cookie
   * GET /api/session - returns user if authenticated
   * @returns {Promise<{user: Object|null, session: Object|null}>}
   */
  async function fetchSession() {
    // Return cached promise if already fetching
    if (window.__sessionPromise) {
      return window.__sessionPromise;
    }

    // Return cached result if already checked
    if (window.__sessionChecked) {
      return { user: window.__session, session: window.__session };
    }

    log('Fetching session from GET /api/session...');

    window.__sessionPromise = (async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SESSION_TIMEOUT_MS);

        const response = await fetch(SESSION_ENDPOINT, {
          method: 'GET',
          credentials: 'include', // Send HttpOnly cookies
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          log('Session request failed:', response.status);
          window.__session = null;
          window.__sessionChecked = true;
          return { user: null, session: null };
        }

        const data = await response.json();
        
        if (data.user) {
          window.__session = data.user;
          log('Session loaded:', { id: data.user.id, role: data.user.role });
        } else {
          window.__session = null;
          log('No active session');
        }

        window.__sessionChecked = true;
        return { user: window.__session, session: window.__session };
      } catch (error) {
        if (error.name === 'AbortError') {
          log('Session request timed out');
        } else {
          log('Session request error:', error.message);
        }
        window.__session = null;
        window.__sessionChecked = true;
        return { user: null, session: null };
      } finally {
        window.__sessionPromise = null;
      }
    })();

    return window.__sessionPromise;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GUARD LOGIC
  // ═══════════════════════════════════════════════════════════════════════════

  function hasPermission(userRole, requiredRole) {
    return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
  }

  /**
   * Check access - async, fetches session from server
   * @returns {Promise<boolean>}
   */
  async function checkAccess() {
    const { user } = await fetchSession();
    const isLoggedIn = !!user;
    const userRole = user?.role || 'user';

    log('Checking access:', {
      page: document.body?.dataset?.page,
      requireAuth,
      requireRole,
      isLoggedIn,
      userRole,
    });

    // Check authentication
    if (requireAuth && !isLoggedIn) {
      log('Access denied: Not logged in');
      handleAccessDenied('auth');
      return false;
    }

    // Check role
    if (requireRole && !hasPermission(userRole, requireRole)) {
      log('Access denied: Insufficient role');
      handleAccessDenied('role');
      return false;
    }

    log('Access granted');
    
    // Trigger prefetch after successful access check
    triggerPrefetch(user);
    
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PREFETCH INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Trigger prefetch after session check
   * @param {Object|null} user - User data from /api/session
   */
  async function triggerPrefetch(user) {
    // Wait for prefetch module to be available
    const waitForPrefetch = () => {
      return new Promise((resolve) => {
        if (window.PrismPrefetch?.isReady) {
          resolve(window.PrismPrefetch);
          return;
        }
        
        // Check periodically
        let attempts = 0;
        const checkInterval = setInterval(() => {
          attempts++;
          if (window.PrismPrefetch) {
            clearInterval(checkInterval);
            // Wait for SW to be ready
            if (window.PrismPrefetch.isReady) {
              resolve(window.PrismPrefetch);
            } else {
              window.PrismPrefetch.ensureServiceWorker().then(() => {
                resolve(window.PrismPrefetch);
              });
            }
          } else if (attempts > 50) { // ~5 seconds
            clearInterval(checkInterval);
            resolve(null);
          }
        }, 100);
      });
    };
    
    const prefetch = await waitForPrefetch();
    
    if (!prefetch) {
      log('Prefetch module not available');
      return;
    }
    
    log('Triggering prefetch...');
    
    // Always prefetch public data
    try {
      await prefetch.prefetchPublic();
      log('Public prefetch triggered');
    } catch (error) {
      log('Public prefetch failed:', error);
    }
    
    // If authenticated, send userId to SW and prefetch private data
    if (user?.id) {
      try {
        // Send userId to Service Worker via postMessage (in-memory only)
        prefetch.setUser(user.id);
        await prefetch.prefetchPrivate(user.id);
        log('Private prefetch triggered for user:', user.id);
      } catch (error) {
        log('Private prefetch failed:', error);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REDIRECT URL HELPERS (no storage - query params only)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validate that a URL is a safe relative path (no external redirects)
   * @param {string} url - URL to validate
   * @returns {string|null} - Validated relative path or null
   */
  function validateRelativePath(url) {
    if (!url || typeof url !== 'string') return null;
    
    // Decode URL
    try {
      url = decodeURIComponent(url);
    } catch {
      return null;
    }
    
    // Must start with / (relative to origin)
    if (!url.startsWith('/')) return null;
    
    // No protocol injection
    if (url.includes('://') || url.startsWith('//')) return null;
    
    // No javascript: or data: schemes
    if (/^\/*(javascript|data|vbscript):/i.test(url)) return null;
    
    // Remove any .. path traversal that could escape
    const normalized = url.split('?')[0]; // Check path only
    if (normalized.includes('..')) return null;
    
    // Max reasonable length
    if (url.length > 500) return null;
    
    return url;
  }

  /**
   * Get the return URL from query params (for post-login redirect)
   * @returns {string|null} - Validated return URL or null
   */
  function getReturnUrl() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');
    return validateRelativePath(next);
  }

  /**
   * Build redirect URL with next param
   * @param {string} baseUrl - Base redirect URL
   * @param {string} nextPath - Path to return to after login
   * @param {string} reason - Access denied reason
   * @returns {string} - Full redirect URL
   */
  function buildRedirectUrl(baseUrl, nextPath, reason) {
    const url = new URL(baseUrl, window.location.origin);
    
    // Add next param (current page path + search)
    const currentPath = window.location.pathname + window.location.search;
    if (validateRelativePath(currentPath)) {
      url.searchParams.set('next', currentPath);
    }
    
    // Add reason
    if (reason) {
      url.searchParams.set('reason', reason);
    }
    
    return url.pathname + url.search;
  }

  function handleAccessDenied(reason) {
    log('Redirecting to:', redirectUrl);

    // Build redirect URL with next param (no storage!)
    const targetUrl = buildRedirectUrl(redirectUrl, window.location.pathname, reason);

    // Use replace to prevent back button returning to protected page
    window.location.replace(targetUrl);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGOUT HANDLER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Handle user logout
   * POST /api/logout - clears HttpOnly cookie
   */
  async function handleLogout() {
    log('Processing logout...');
    
    // Clear SW private cache
    if (window.PrismPrefetch) {
      try {
        await window.PrismPrefetch.handleLogout();
        log('Private cache cleared');
      } catch (error) {
        log('Failed to clear private cache:', error);
      }
    }
    
    // Clear in-memory session (NO localStorage/sessionStorage)
    window.__session = null;
    window.__sessionChecked = false;
    
    // Call server logout endpoint to clear HttpOnly cookie
    try {
      await fetch(LOGOUT_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {}
    
    // Redirect to home
    window.location.replace('index.html');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  // Run guard check (async - fetches session from server)
  if (requireAuth || requireRole) {
    // Hide page until auth check completes
    document.documentElement.style.visibility = 'hidden';
    
    checkAccess().then(hasAccess => {
      if (hasAccess) {
        // Show page content
        document.documentElement.style.visibility = '';
      }
      // If no access, handleAccessDenied already redirected
    }).catch(error => {
      log('Access check failed:', error);
      // On error, deny access
      handleAccessDenied('auth');
    });
  } else {
    // No auth required, but still fetch session for prefetch
    fetchSession().then(({ user }) => {
      triggerPrefetch(user);
    });
  }

  // Handle access_denied parameter on landing page (show login modal)
  // Also handles ?next= param for post-login redirect
  function handleAccessDeniedParam() {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get('reason');
    const next = params.get('next');

    // Store next URL in window for auth module to use after login
    if (next && validateRelativePath(next)) {
      window.__postLoginRedirect = next;
    }

    if (reason) {
      // Clean URL (keep next param for login flow)
      params.delete('reason');
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, '', newUrl);

      // Show toast and open login modal
      setTimeout(() => {
        if (window.PrismUI?.showToast) {
          const messages = {
            auth: 'Please sign in to access that page',
            role: 'You need elevated permissions to access that page',
          };
          window.PrismUI.showToast('Access Required', messages[reason] || 'Please sign in');
        }

        // Open login modal
        window.dispatchEvent(new CustomEvent('open-login-modal'));
      }, 500);
    }
  }

  // Wait for DOM to handle access_denied param
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleAccessDeniedParam);
  } else {
    setTimeout(handleAccessDeniedParam, 100);
  }

  // Export for potential use by other scripts
  window.PrismGuards = {
    checkAccess,
    hasPermission,
    triggerPrefetch,
    handleLogout,
    fetchSession, // Expose for other scripts that need session
    getSession: () => window.__session, // Sync getter for cached session
    getReturnUrl, // Get validated return URL from ?next param
    validateRelativePath, // Validate relative paths
  };
})();
