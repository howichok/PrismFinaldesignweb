/* ═══════════════════════════════════════════════════════════════════════════
   PrismMTR - API Fetch Wrapper (Simplified)
   
   Features:
   - Request deduplication (concurrent identical requests share one fetch)
   - Short TTL cache for PUBLIC data only (not session!)
   - NO session caching - AuthManager handles that
   
   Session requests go through AuthManager, not here.
   ═══════════════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  const PUBLIC_CACHE_TTL = 60 * 1000; // 60 seconds for public data only

  const DEBUG = !window.location.origin.includes('prismmtr.org') &&
                !window.location.origin.includes('netlify.app');
  
  const log = DEBUG ? console.log.bind(console, '[apiFetch]') : () => {};

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  const pendingRequests = new Map(); // For deduplication
  const publicCache = new Map(); // TTL cache for public endpoints only

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  function getCacheKey(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    let bodyKey = '';
    if (options.body) {
      bodyKey = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }
    return `${method}:${url}:${bodyKey}`;
  }

  function isPublicEndpoint(url) {
    // Only cache public data endpoints, NEVER session
    return url.includes('/public/') || 
           url.includes('getProjects') || 
           url.includes('getPosts') ||
           url.includes('getCompanies') ||
           url.includes('getUsers');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN FETCH
  // ═══════════════════════════════════════════════════════════════════════════

  async function apiFetch(url, options = {}, extra = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const cacheKey = getCacheKey(url, options);
    
    // Only cache public GET requests
    const useCache = extra.cache !== false && 
                     method === 'GET' && 
                     isPublicEndpoint(url);

    // 1. Check public cache
    if (useCache) {
      const cached = publicCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < PUBLIC_CACHE_TTL)) {
        log('Cache HIT:', url);
        return cached.data;
      }
    }

    // 2. Dedupe concurrent identical requests
    if (pendingRequests.has(cacheKey)) {
      log('Dedupe:', url);
      return pendingRequests.get(cacheKey);
    }

    // 3. Execute fetch
    const fetchPromise = (async () => {
      try {
        log('Fetch:', method, url);
        
        const fetchOptions = { ...options, method };
        
        // Include credentials for auth endpoints
        if (url.includes('/session') || url.includes('/auth') || url.includes('/logout')) {
          fetchOptions.credentials = 'include';
        }

        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}`);
          error.status = response.status;
          throw error;
        }

        const contentType = response.headers.get('Content-Type') || '';
        const data = contentType.includes('application/json') 
          ? await response.json() 
          : await response.text();

        // Cache public data only
        if (useCache) {
          publicCache.set(cacheKey, { data, timestamp: Date.now() });
          log('Cached public data:', url);
        }

        return data;

      } finally {
        pendingRequests.delete(cacheKey);
      }
    })();

    pendingRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONVENIENCE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  apiFetch.get = (url, options = {}) => apiFetch(url, { ...options, method: 'GET' });

  apiFetch.post = (url, body, options = {}) => apiFetch(url, {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(body)
  }, { cache: false });

  apiFetch.put = (url, body, options = {}) => apiFetch(url, {
    ...options,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(body)
  }, { cache: false });

  apiFetch.delete = (url, options = {}) => apiFetch(url, { ...options, method: 'DELETE' }, { cache: false });

  // ═══════════════════════════════════════════════════════════════════════════
  // CACHE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  apiFetch.invalidate = (pattern) => {
    if (!pattern) {
      publicCache.clear();
      log('Public cache cleared');
      return;
    }
    
    for (const key of publicCache.keys()) {
      if (key.includes(pattern)) {
        publicCache.delete(key);
        log('Invalidated:', key);
      }
    }
  };

  apiFetch.clearAll = () => {
    publicCache.clear();
    pendingRequests.clear();
    log('All cleared');
  };

  window.apiFetch = apiFetch;
  log('apiFetch initialized (simplified)');

})();
