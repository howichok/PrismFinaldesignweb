/* ═══════════════════════════════════════════════════════════════════════════
   PrismMTR - Centralized API Fetch Wrapper
   
   Features:
   - Request deduplication (same concurrent requests share one fetch)
   - In-memory cache with TTL for GET requests
   - ETag support for conditional requests
   - Zero localStorage/sessionStorage/IndexedDB
   
   Usage:
   - apiFetch('/api/endpoint', { method: 'GET' })
   - apiFetch.get('/api/endpoint')
   - apiFetch.post('/api/endpoint', { body: data })
   ═══════════════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  const DEFAULT_CACHE_TTL = 60 * 1000; // 60 seconds for public data
  const SESSION_CACHE_TTL = 30 * 1000; // 30 seconds for session (short - role can change)
  
  const DEBUG = !window.location.origin.includes('prismmtr.org') &&
                !window.location.origin.includes('netlify.app');
  
  const log = DEBUG ? console.log.bind(console, '[apiFetch]') : () => {};

  // ═══════════════════════════════════════════════════════════════════════════
  // IN-MEMORY STORES (NO PERSISTENT STORAGE)
  // ═══════════════════════════════════════════════════════════════════════════

  // Pending requests for deduplication
  const pendingRequests = new Map();
  
  // Cache store: { data, etag, timestamp, ttl }
  const cache = new Map();
  
  // ETag store for conditional requests
  const etags = new Map();

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate cache/dedupe key from request
   * Includes: method + full URL (with query params) + body hash
   */
  function getCacheKey(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    // Body can be string or object - normalize to string
    let bodyKey = '';
    if (options.body) {
      bodyKey = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }
    // Full URL is already passed, includes query params
    return `${method}:${url}:${bodyKey}`;
  }

  /**
   * Check if cache entry is valid
   */
  function isCacheValid(entry) {
    if (!entry) return false;
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Get TTL for endpoint
   */
  function getTTL(url) {
    if (url.includes('/session')) return SESSION_CACHE_TTL;
    if (url.includes('/public/')) return DEFAULT_CACHE_TTL * 2; // 2 minutes for public
    return DEFAULT_CACHE_TTL;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN FETCH WRAPPER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Centralized fetch with deduplication and caching
   * @param {string} url - API endpoint
   * @param {Object} options - fetch options
   * @param {Object} extra - { cache: boolean, ttl: number, skipDedupe: boolean }
   */
  async function apiFetch(url, options = {}, extra = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const cacheKey = getCacheKey(url, options);
    const useCache = extra.cache !== false && method === 'GET';
    const ttl = extra.ttl || getTTL(url);

    // 1. Check in-memory cache for GET requests
    if (useCache) {
      const cached = cache.get(cacheKey);
      if (isCacheValid(cached)) {
        log('Cache HIT:', url);
        return cached.data;
      }
    }

    // 2. Deduplicate concurrent identical requests
    if (!extra.skipDedupe && pendingRequests.has(cacheKey)) {
      log('Dedupe:', url);
      return pendingRequests.get(cacheKey);
    }

    // 3. Build request with ETag if available
    const headers = new Headers(options.headers || {});
    
    // Add credentials for session/auth endpoints
    const fetchOptions = {
      ...options,
      method,
      headers
    };

    // Always include credentials for session-related endpoints
    if (url.includes('/session') || url.includes('/auth') || url.includes('/logout')) {
      fetchOptions.credentials = 'include';
    }

    // Add If-None-Match for cached requests with ETag
    const storedEtag = etags.get(url);
    if (useCache && storedEtag) {
      headers.set('If-None-Match', storedEtag);
    }

    // 4. Execute fetch
    const fetchPromise = (async () => {
      try {
        log('Fetch:', method, url);
        const response = await fetch(url, fetchOptions);

        // Handle 304 Not Modified
        if (response.status === 304) {
          const cached = cache.get(cacheKey);
          if (cached) {
            log('ETag 304:', url);
            cached.timestamp = Date.now(); // Refresh TTL
            return cached.data;
          }
        }

        // Store ETag from response
        const responseEtag = response.headers.get('ETag');
        if (responseEtag) {
          etags.set(url, responseEtag);
        }

        // Handle 401 Unauthorized - invalidate session cache immediately
        if (response.status === 401) {
          log('401 Unauthorized - invalidating session cache');
          invalidateSessionCache();
          // Dispatch event for auth.js/guards.js to handle
          window.dispatchEvent(new CustomEvent('prism:auth:expired'));
        }

        // Handle errors
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}`);
          error.status = response.status;
          error.response = response;
          throw error;
        }

        // Parse response
        const contentType = response.headers.get('Content-Type') || '';
        let data;
        
        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }

        // Cache successful GET responses
        if (useCache && method === 'GET') {
          cache.set(cacheKey, {
            data,
            etag: responseEtag,
            timestamp: Date.now(),
            ttl
          });
          log('Cached:', url, 'TTL:', ttl / 1000, 's');
        }

        return data;

      } finally {
        // Remove from pending after completion
        pendingRequests.delete(cacheKey);
      }
    })();

    // Store pending promise for deduplication
    if (!extra.skipDedupe) {
      pendingRequests.set(cacheKey, fetchPromise);
    }

    return fetchPromise;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONVENIENCE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  apiFetch.get = (url, options = {}, extra = {}) => {
    return apiFetch(url, { ...options, method: 'GET' }, extra);
  };

  apiFetch.post = (url, body, options = {}, extra = {}) => {
    return apiFetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: JSON.stringify(body)
    }, { ...extra, cache: false });
  };

  apiFetch.put = (url, body, options = {}, extra = {}) => {
    return apiFetch(url, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: JSON.stringify(body)
    }, { ...extra, cache: false });
  };

  apiFetch.delete = (url, options = {}, extra = {}) => {
    return apiFetch(url, { ...options, method: 'DELETE' }, { ...extra, cache: false });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CACHE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Invalidate session cache specifically
   * Called on 401 or role/version change
   */
  function invalidateSessionCache() {
    for (const key of cache.keys()) {
      if (key.includes('/session')) {
        cache.delete(key);
        log('Session cache invalidated');
      }
    }
    // Also clear in-memory session
    window.__session = null;
    window.__sessionChecked = false;
  }

  /**
   * Invalidate cache for URL pattern or specific keys
   * @param {string|string[]} pattern - URL pattern or array of patterns
   */
  apiFetch.invalidate = (pattern) => {
    if (!pattern) {
      // Clear all cache
      cache.clear();
      log('Cache cleared');
      return;
    }
    
    const patterns = Array.isArray(pattern) ? pattern : [pattern];
    let invalidated = 0;
    
    for (const key of cache.keys()) {
      for (const p of patterns) {
        if (key.includes(p)) {
          cache.delete(key);
          invalidated++;
          log('Invalidated:', key);
          break;
        }
      }
    }
    
    return invalidated;
  };

  /**
   * Invalidate after mutation (create/update/delete)
   * Call this after POST/PUT/DELETE to related endpoints
   * @param {string} entityType - 'projects', 'posts', 'companies', 'users'
   */
  apiFetch.invalidateEntity = (entityType) => {
    const patterns = [];
    
    switch (entityType) {
      case 'projects':
        patterns.push('getProjects', 'getPublicProjects', 'getMyProjects', 'getUserProjects');
        break;
      case 'posts':
        patterns.push('getPosts', 'getPublicPosts', 'getMyPosts');
        break;
      case 'companies':
        patterns.push('getCompanies', 'getPublicCompanies', 'getMyCompanies', 'getUserCompanies');
        break;
      case 'users':
        patterns.push('getUsers', 'getUserById', 'getMyProfile');
        break;
      case 'notifications':
        patterns.push('getNotifications', 'getMyNotifications');
        break;
      case 'session':
        invalidateSessionCache();
        return;
    }
    
    // Invalidate all matching patterns
    for (const key of cache.keys()) {
      for (const p of patterns) {
        if (key.includes(p)) {
          cache.delete(key);
          log('Entity invalidated:', entityType, key);
          break;
        }
      }
    }
  };

  /**
   * Clear all caches
   */
  apiFetch.clearAll = () => {
    cache.clear();
    etags.clear();
    pendingRequests.clear();
    log('All caches cleared');
  };

  /**
   * Get cache stats (for debugging)
   */
  apiFetch.stats = () => ({
    cached: cache.size,
    etags: etags.size,
    pending: pendingRequests.size
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════

  window.apiFetch = apiFetch;
  
  log('apiFetch initialized');

})();
