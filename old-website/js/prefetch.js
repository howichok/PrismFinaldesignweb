/* ═══════════════════════════════════════════════════════════════════════════
   PrismMTR — Prefetch Module
   
   Manages Service Worker registration and data prefetching.
   Coordinates with SW for caching without localStorage/sessionStorage.
   
   Features:
   - SW registration and lifecycle management
   - Public data prefetch for guests
   - Private data prefetch for authenticated users
   - Anti-spam protection (in-memory rate limiting)
   - Client-side data update notifications
   ═══════════════════════════════════════════════════════════════════════════ */

const PrismPrefetch = (function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  const CONFIG = {
    // Service Worker path
    SW_PATH: '/sw.js',
    
    // Minimum interval between prefetch calls (in-memory, milliseconds)
    PREFETCH_COOLDOWN: 60000, // 1 minute
    
    // Maximum concurrent prefetch requests
    MAX_CONCURRENT_PREFETCH: 3,
    
    // Prefetch timeout
    PREFETCH_TIMEOUT: 30000, // 30 seconds
    
    // Debug mode
    DEBUG: !window.location.origin.includes('prismmtr.org') &&
           !window.location.origin.includes('netlify.app'),
  };

  const log = CONFIG.DEBUG ? console.log.bind(console, '[Prefetch]') : () => {};
  const warn = CONFIG.DEBUG ? console.warn.bind(console, '[Prefetch]') : () => {};

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE (in-memory only, no localStorage)
  // ═══════════════════════════════════════════════════════════════════════════

  const state = {
    swRegistration: null,
    swReady: false,
    lastPublicPrefetch: 0,
    lastPrivatePrefetch: 0,
    prefetchInProgress: false,
    currentUserId: null,
    updateListeners: new Set(),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVICE WORKER REGISTRATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Register the Service Worker
   * @returns {Promise<ServiceWorkerRegistration|null>}
   */
  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      warn('Service Workers not supported');
      return null;
    }

    try {
      log('Registering Service Worker...');
      
      const registration = await navigator.serviceWorker.register(CONFIG.SW_PATH, {
        scope: '/',
      });

      state.swRegistration = registration;

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        log('New Service Worker found');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            log('New Service Worker installed, refresh to activate');
            notifyListeners('sw-update-available', {});
          }
        });
      });

      // Wait for SW to be ready
      await navigator.serviceWorker.ready;
      state.swReady = true;
      log('Service Worker ready');

      // Set up message listener
      navigator.serviceWorker.addEventListener('message', handleSWMessage);

      return registration;
    } catch (error) {
      warn('Service Worker registration failed:', error);
      return null;
    }
  }

  /**
   * Ensure SW is registered and ready
   */
  async function ensureServiceWorker() {
    if (state.swReady && state.swRegistration) {
      return state.swRegistration;
    }
    return registerServiceWorker();
  }

  /**
   * Send message to Service Worker
   */
  function sendToSW(type, payload = {}) {
    if (!navigator.serviceWorker?.controller) {
      warn('No active Service Worker');
      return false;
    }

    navigator.serviceWorker.controller.postMessage({ type, payload });
    return true;
  }

  /**
   * Handle messages from Service Worker
   */
  function handleSWMessage(event) {
    const { type, ...data } = event.data || {};
    
    log('Received from SW:', type, data);

    switch (type) {
      case 'SET_USER_ACK':
        log('User set in SW:', data.userId);
        break;
        
      case 'data-updated':
        notifyListeners('data-updated', data);
        break;
        
      case 'auth-expired':
        log('Auth expired, clearing state');
        state.currentUserId = null;
        notifyListeners('auth-expired', data);
        break;

      case 'cache-invalidated':
        notifyListeners('cache-invalidated', data);
        break;

      case 'PREFETCH_PUBLIC_COMPLETE':
        log('Public prefetch complete:', data.results);
        state.prefetchInProgress = false;
        break;

      case 'PREFETCH_PRIVATE_COMPLETE':
        log('Private prefetch complete:', data.results);
        state.prefetchInProgress = false;
        break;

      case 'CLEAR_PRIVATE_CACHE_COMPLETE':
        log('Private cache cleared:', data);
        break;

      case 'CLEAR_ALL_CACHE_COMPLETE':
        log('All caches cleared:', data);
        break;

      case 'CACHE_STATUS':
        log('Cache status:', data.status);
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set current user ID in SW for private cache isolation
   * @param {string} userId - User ID
   */
  function setUser(userId) {
    state.currentUserId = userId;
    sendToSW('SET_USER', { userId });
    log('Set user:', userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PREFETCH FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Prefetch public data (for guests and authenticated users)
   * Uses SW cache for storage
   */
  async function prefetchPublic() {
    const now = Date.now();
    
    // Anti-spam: Check cooldown (in-memory)
    if (now - state.lastPublicPrefetch < CONFIG.PREFETCH_COOLDOWN) {
      log('Public prefetch on cooldown, skipping');
      return false;
    }

    // Check if prefetch already in progress
    if (state.prefetchInProgress) {
      log('Prefetch already in progress, skipping');
      return false;
    }

    state.lastPublicPrefetch = now;
    state.prefetchInProgress = true;

    await ensureServiceWorker();

    // Try to use SW for prefetch
    if (sendToSW('PREFETCH_PUBLIC')) {
      log('Triggered SW public prefetch');
      
      // Set timeout to reset state
      setTimeout(() => {
        if (state.prefetchInProgress) {
          state.prefetchInProgress = false;
          warn('Public prefetch timed out');
        }
      }, CONFIG.PREFETCH_TIMEOUT);
      
      return true;
    }

    // Fallback: Direct fetch without SW caching
    log('SW not available, using direct prefetch');
    state.prefetchInProgress = false;
    return directPrefetchPublic();
  }

  /**
   * Direct prefetch without SW (fallback)
   */
  async function directPrefetchPublic() {
    const endpoints = [
      { action: 'getProjects' },
      { action: 'getPosts' },
      { action: 'getCompanies' },
      { action: 'getUsers' },
    ];

    const results = [];
    
    // Process in batches
    for (let i = 0; i < endpoints.length; i += CONFIG.MAX_CONCURRENT_PREFETCH) {
      const batch = endpoints.slice(i, i + CONFIG.MAX_CONCURRENT_PREFETCH);
      
      const batchResults = await Promise.allSettled(
        batch.map(({ action }) => 
          fetch('/.netlify/functions/supabase-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
          })
        )
      );
      
      results.push(...batchResults);
    }

    log('Direct prefetch complete:', results.length, 'requests');
    return true;
  }

  /**
   * Prefetch private data for authenticated user
   * Uses SW cache isolated by userId
   * @param {string} userId - Current user ID
   */
  async function prefetchPrivate(userId) {
    if (!userId) {
      warn('Cannot prefetch private data without userId');
      return false;
    }

    const now = Date.now();
    
    // Anti-spam: Check cooldown
    if (now - state.lastPrivatePrefetch < CONFIG.PREFETCH_COOLDOWN) {
      log('Private prefetch on cooldown, skipping');
      return false;
    }

    state.lastPrivatePrefetch = now;
    state.currentUserId = userId;

    await ensureServiceWorker();
    
    // Set user in SW for cache isolation
    setUser(userId);

    log('Starting private prefetch for user:', userId);

    // Try to use SW for prefetch (will cache in user-isolated cache)
    if (sendToSW('PREFETCH_PRIVATE', { userId })) {
      log('Triggered SW private prefetch');
      
      // Set timeout to reset state
      setTimeout(() => {
        if (state.prefetchInProgress) {
          state.prefetchInProgress = false;
          warn('Private prefetch timed out');
        }
      }, CONFIG.PREFETCH_TIMEOUT);
      
      return true;
    }

    // Fallback: Direct fetch without SW caching
    log('SW not available, using direct private prefetch');
    return directPrefetchPrivate(userId);
  }

  /**
   * Direct private prefetch without SW (fallback)
   */
  async function directPrefetchPrivate(userId) {
    const privateEndpoints = [
      { action: 'getNotificationsForUser', data: { userId } },
      { action: 'getInvitationsForUser', data: { userId } },
      { action: 'getCollaborationsForUser', data: { userId } },
    ];

    const results = [];

    for (let i = 0; i < privateEndpoints.length; i += CONFIG.MAX_CONCURRENT_PREFETCH) {
      const batch = privateEndpoints.slice(i, i + CONFIG.MAX_CONCURRENT_PREFETCH);
      
      const batchResults = await Promise.allSettled(
        batch.map(({ action, data }) =>
          fetch('/.netlify/functions/supabase-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, data }),
            credentials: 'include',
          })
        )
      );
      
      results.push(...batchResults);
    }

    log('Direct private prefetch complete:', results.length, 'requests');
    return true;
  }

  /**
   * Prefetch all data (public + private if authenticated)
   * @param {Object|null} session - User session if authenticated
   */
  async function prefetchAll(session = null) {
    // Always prefetch public data
    await prefetchPublic();

    // If authenticated, also prefetch private data
    if (session?.id) {
      await prefetchPrivate(session.id);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CACHE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Clear private cache for current user (on logout)
   */
  async function clearPrivateCache() {
    if (state.currentUserId) {
      sendToSW('CLEAR_PRIVATE_CACHE', { userId: state.currentUserId });
      state.currentUserId = null;
    }
    state.lastPrivatePrefetch = 0;
  }

  /**
   * Clear all caches
   */
  function clearAllCache() {
    sendToSW('CLEAR_ALL_CACHE');
    state.lastPublicPrefetch = 0;
    state.lastPrivatePrefetch = 0;
  }

  /**
   * Invalidate cache for specific action
   * @param {string} action - API action to invalidate
   */
  function invalidateCache(action) {
    sendToSW('INVALIDATE_CACHE', { action });
  }

  /**
   * Get cache status
   */
  function getCacheStatus() {
    sendToSW('GET_CACHE_STATUS');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UPDATE LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Add listener for data updates
   * @param {Function} callback - Called with (eventType, data)
   * @returns {Function} Unsubscribe function
   */
  function onUpdate(callback) {
    state.updateListeners.add(callback);
    return () => state.updateListeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  function notifyListeners(eventType, data) {
    state.updateListeners.forEach(callback => {
      try {
        callback(eventType, data);
      } catch (error) {
        warn('Listener error:', error);
      }
    });

    // Also dispatch custom event for non-listener consumers
    window.dispatchEvent(new CustomEvent(`prism-${eventType}`, { detail: data }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGOUT HANDLER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Handle user logout
   * Clears private cache and resets state
   */
  async function handleLogout() {
    log('Handling logout, clearing private cache...');
    
    await clearPrivateCache();
    
    // Reset in-memory state
    state.currentUserId = null;
    state.lastPrivatePrefetch = 0;
    
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialize prefetch system
   * Called automatically on page load
   */
  async function init() {
    log('Initializing prefetch system...');
    
    // Register SW
    await registerServiceWorker();
    
    // Listen for visibility changes to pause/resume prefetch
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && state.swReady) {
        // Page became visible, check if we should prefetch
        const now = Date.now();
        const publicStale = now - state.lastPublicPrefetch > CONFIG.PREFETCH_COOLDOWN * 2;
        
        if (publicStale) {
          log('Page visible, data may be stale, triggering prefetch');
          prefetchPublic();
        }
      }
    });

    log('Prefetch system initialized');
  }

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Delay slightly to not block page load
    setTimeout(init, 100);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // Registration
    registerServiceWorker,
    ensureServiceWorker,
    
    // Prefetch
    prefetchPublic,
    prefetchPrivate,
    prefetchAll,
    
    // User management
    setUser,
    
    // Cache management
    clearPrivateCache,
    clearAllCache,
    invalidateCache,
    getCacheStatus,
    
    // Event handling
    onUpdate,
    handleLogout,
    
    // State (read-only)
    get isReady() { return state.swReady; },
    get currentUserId() { return state.currentUserId; },
  };
})();

// Export to window for global access
window.PrismPrefetch = PrismPrefetch;

// Also expose convenience functions
window.prefetchPublic = PrismPrefetch.prefetchPublic;
window.prefetchPrivate = PrismPrefetch.prefetchPrivate;
