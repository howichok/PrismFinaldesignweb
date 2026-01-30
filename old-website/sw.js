  /* ═══════════════════════════════════════════════════════════════════════════
   PrismMTR — Service Worker
   
   Implements caching and prefetching without localStorage/sessionStorage/IndexedDB.
   Uses Cache API with stale-while-revalidate strategy.
   
   Features:
   - Public data caching with ETag/Last-Modified support
   - Private (user-specific) data caching isolated by userId
   - Background revalidation with throttling (min 5 minutes between requests)
   - Prefetch support for faster navigation
   - Auto-clear private cache on 401 or logout
   ═══════════════════════════════════════════════════════════════════════════ */

const SW_VERSION = '1.0.2';
const PUBLIC_CACHE_NAME = `prism-public-v${SW_VERSION}`;
const STATIC_CACHE_NAME = `prism-static-v${SW_VERSION}`;

// Revalidation throttling (minimum time between network requests per endpoint)
const REVALIDATE_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes
const lastRevalidation = new Map(); // action -> timestamp

// Current authenticated user ID (set via message)
let currentUserId = null;

// API endpoints to cache
const PUBLIC_API_PATTERNS = [
  '/.netlify/functions/supabase-proxy',
];

// Public actions that can be cached (shared between all users)
const CACHEABLE_PUBLIC_ACTIONS = [
  'getPublicProjects',
  'getPublicPosts',
  'getPublicCompanies',
  'getProjects',
  'getPosts',
  'getCompanies',
  'getUsers',
];

// Private actions (cached per-user in isolated cache)
const PRIVATE_ACTIONS = [
  'getMyProjects',
  'getMyProfile',
  'getMyCompanies',
  'getMyNotifications',
  'getNotificationsForUser',
  'getInvitationsForUser',
  'getCollaborationsForUser',
  'getUserById',
  'getUserProjects',
  'getUserCompanies',
];

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a cache key for an API request
 */
function getCacheKey(request, action, data) {
  const url = new URL(request.url);
  const baseKey = `${url.origin}${url.pathname}`;
  
  // For POST requests to the proxy, include action in key
  if (action) {
    const dataHash = data ? simpleHash(JSON.stringify(data)) : '';
    return `${baseKey}?action=${action}${dataHash ? `&hash=${dataHash}` : ''}`;
  }
  
  return request.url;
}

/**
 * Simple hash function for data
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get private cache name for a user
 */
function getPrivateCacheName(userId) {
  return `prism-private-${userId}-v${SW_VERSION}`;
}

/**
 * Check if action is cacheable public data
 */
function isPublicCacheableAction(action) {
  return CACHEABLE_PUBLIC_ACTIONS.includes(action);
}

/**
 * Check if action is private user data
 */
function isPrivateAction(action) {
  return PRIVATE_ACTIONS.includes(action);
}

/**
 * Extract userId from private action data
 */
function extractUserIdFromData(action, data) {
  if (!data) return currentUserId;
  
  // Try to get userId from common patterns
  if (data.userId) return data.userId;
  if (data.id && action.includes('User')) return data.id;
  
  return currentUserId;
}

/**
 * Create a cacheable response with metadata
 */
function createCacheableResponse(response, etag, timestamp) {
  const headers = new Headers(response.headers);
  headers.set('X-SW-Cached', 'true');
  headers.set('X-SW-Timestamp', timestamp.toString());
  if (etag) {
    headers.set('X-SW-ETag', etag);
  }
  
  return response.clone().blob().then(blob => {
    return new Response(blob, {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
    });
  });
}

/**
 * Generate ETag from response body
 */
async function generateETag(response) {
  const clone = response.clone();
  const text = await clone.text();
  return `"${simpleHash(text)}"`;
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE WORKER EVENTS
// ═══════════════════════════════════════════════════════════════════════════

self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker v' + SW_VERSION);
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker v' + SW_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => {
              // Delete old version caches
              return name.startsWith('prism-') && 
                     !name.includes(`-v${SW_VERSION}`);
            })
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim(),
    ])
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// FETCH HANDLER
// ═══════════════════════════════════════════════════════════════════════════

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only handle API requests to our proxy
  if (!PUBLIC_API_PATTERNS.some(pattern => url.pathname.includes(pattern))) {
    return; // Let browser handle other requests
  }
  
  // Only handle POST requests to the proxy
  if (event.request.method !== 'POST') {
    return;
  }
  
  event.respondWith(handleApiRequest(event.request));
});

/**
 * Handle API requests with stale-while-revalidate strategy
 */
async function handleApiRequest(request) {
  // Clone request to read body
  const requestClone = request.clone();
  let body;
  
  try {
    body = await requestClone.json();
  } catch {
    // If we can't parse the body, just pass through
    return fetch(request);
  }
  
  const { action, data } = body;
  
  // Determine if this is cacheable
  if (!isPublicCacheableAction(action) && !isPrivateAction(action)) {
    // Not cacheable, pass through
    return fetch(request);
  }
  
  // For private actions, cache in user-isolated cache
  if (isPrivateAction(action)) {
    const userId = extractUserIdFromData(action, data);
    if (!userId) {
      // No user context, can't cache privately - pass through
      console.log('[SW] Private action without userId, passing through:', action);
      return fetch(request);
    }
    return staleWhileRevalidatePrivate(request, action, data, userId);
  }
  
  // Public cacheable action - use stale-while-revalidate
  return staleWhileRevalidate(request, action, data, PUBLIC_CACHE_NAME);
}

/**
 * Stale-while-revalidate for private (user-specific) data
 */
async function staleWhileRevalidatePrivate(request, action, data, userId) {
  const cacheName = getPrivateCacheName(userId);
  return staleWhileRevalidate(request, action, data, cacheName, true);
}

/**
 * Check if we should throttle revalidation for this action
 */
function shouldThrottleRevalidation(action) {
  const lastTime = lastRevalidation.get(action);
  if (!lastTime) return false;
  return (Date.now() - lastTime) < REVALIDATE_THROTTLE_MS;
}

/**
 * Stale-while-revalidate strategy with throttling
 * 1. Return cached response immediately if available
 * 2. Fetch fresh data in background (throttled to max once per 5 minutes)
 * 3. Update cache with fresh data
 * 4. Notify clients if data changed
 * @param {boolean} isPrivate - If true, handle 401 by clearing private cache
 */
async function staleWhileRevalidate(request, action, data, cacheName, isPrivate = false) {
  const cache = await caches.open(cacheName);
  const cacheKey = getCacheKey(request, action, data);
  
  // Try to get from cache
  const cachedResponse = await cache.match(cacheKey);
  
  if (cachedResponse) {
    // Return cached response immediately
    console.log('[SW] Returning cached response for:', action, isPrivate ? '(private)' : '(public)');
    
    // Check if revalidation is throttled
    if (shouldThrottleRevalidation(action)) {
      console.log('[SW] Revalidation throttled for:', action);
      return cachedResponse;
    }
    
    // Check cache age - if too old, wait for network
    const cachedTimestamp = cachedResponse.headers.get('X-SW-Timestamp');
    const cacheAge = cachedTimestamp ? Date.now() - parseInt(cachedTimestamp) : Infinity;
    // Private: 60 sec (user data can change), Public: 2 min (shared data)
    const MAX_CACHE_AGE = isPrivate ? 60 * 1000 : 2 * 60 * 1000;
    
    if (cacheAge > MAX_CACHE_AGE) {
      console.log('[SW] Cache expired, waiting for network:', action);
      lastRevalidation.set(action, Date.now());
      try {
        return await fetchAndCache(request, action, data, cache, cacheKey, cachedResponse, isPrivate, cacheName);
      } catch (error) {
        console.log('[SW] Network failed, returning stale cache:', action);
        return cachedResponse;
      }
    }
    
    // Fresh enough - return cache, skip background revalidation
    return cachedResponse;
  }
  
  // No cache, fetch from network
  console.log('[SW] No cache, fetching from network:', action);
  lastRevalidation.set(action, Date.now());
  return fetchAndCache(request, action, data, cache, cacheKey, cachedResponse, isPrivate, cacheName);
}

/**
 * Fetch from network and update cache
 * @param {boolean} isPrivate - If true, handle 401 by clearing private cache
 * @param {string} cacheName - Name of the cache being used
 */
async function fetchAndCache(request, action, data, cache, cacheKey, previousCachedResponse, isPrivate = false, cacheName = PUBLIC_CACHE_NAME) {
  try {
    // Build headers for conditional request
    const headers = new Headers(request.headers);
    
    // Add ETag if we have a cached response
    if (previousCachedResponse) {
      const cachedETag = previousCachedResponse.headers.get('X-SW-ETag');
      if (cachedETag) {
        headers.set('If-None-Match', cachedETag);
      }
    }
    
    // Make the request
    const response = await fetch(new Request(request.url, {
      method: request.method,
      headers: headers,
      body: JSON.stringify({ action, data }),
      mode: request.mode,
      credentials: request.credentials,
    }));
    
    // Handle 304 Not Modified
    if (response.status === 304 && previousCachedResponse) {
      console.log('[SW] 304 Not Modified, keeping cache:', action);
      return previousCachedResponse;
    }
    
    // Handle 401 Unauthorized - clear private cache and notify
    if (response.status === 401 && isPrivate) {
      console.log('[SW] 401 Unauthorized, clearing private cache:', cacheName);
      await caches.delete(cacheName);
      currentUserId = null;
      notifyClients('auth-expired', { action, cacheName });
      return response;
    }
    
    // Handle other errors
    if (!response.ok) {
      console.warn('[SW] Network error:', response.status);
      if (previousCachedResponse) {
        return previousCachedResponse;
      }
      return response;
    }
    
    // Generate ETag and cache the response
    const responseClone = response.clone();
    const etag = await generateETag(response.clone());
    const timestamp = Date.now();
    
    const cacheableResponse = await createCacheableResponse(responseClone, etag, timestamp);
    
    // Check if data changed
    if (previousCachedResponse) {
      const previousETag = previousCachedResponse.headers.get('X-SW-ETag');
      if (previousETag && previousETag !== etag) {
        console.log('[SW] Data changed, notifying clients:', action);
        notifyClients('data-updated', { action, cacheKey, isPrivate });
      }
    }
    
    // Store in cache
    await cache.put(cacheKey, cacheableResponse);
    console.log('[SW] Cached response for:', action, isPrivate ? '(private)' : '(public)');
    
    return response;
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    if (previousCachedResponse) {
      return previousCachedResponse;
    }
    throw error;
  }
}

/**
 * Notify all clients about an event
 */
async function notifyClients(type, data) {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.postMessage({ type, ...data });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════════════════

self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  
  console.log('[SW] Received message:', type, payload);
  
  switch (type) {
    case 'SET_USER':
      // Set current user ID for private cache isolation
      currentUserId = payload?.userId || null;
      console.log('[SW] User set:', currentUserId);
      event.source?.postMessage({ type: 'SET_USER_ACK', userId: currentUserId });
      break;
      
    case 'PREFETCH_PUBLIC':
      handlePrefetchPublic(event);
      break;
      
    case 'PREFETCH_PRIVATE':
      handlePrefetchPrivate(event, payload?.userId);
      break;
      
    case 'CLEAR_PRIVATE_CACHE':
      handleClearPrivateCache(event, payload?.userId);
      break;
      
    case 'CLEAR_ALL_CACHE':
      handleClearAllCache(event);
      break;
      
    case 'GET_CACHE_STATUS':
      handleGetCacheStatus(event);
      break;
      
    case 'INVALIDATE_CACHE':
      handleInvalidateCache(event, payload?.action, payload?.isPrivate, payload?.userId);
      break;
  }
});

/**
 * Handle public data prefetch request
 */
async function handlePrefetchPublic(event) {
  const actions = [
    { action: 'getProjects', data: null },
    { action: 'getPosts', data: null },
    { action: 'getCompanies', data: null },
    { action: 'getUsers', data: null },
  ];
  
  console.log('[SW] Starting public prefetch...');
  
  const cache = await caches.open(PUBLIC_CACHE_NAME);
  const results = [];
  
  // Limit concurrent requests
  const MAX_CONCURRENT = 2;
  
  for (let i = 0; i < actions.length; i += MAX_CONCURRENT) {
    const batch = actions.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.allSettled(
      batch.map(async ({ action, data }) => {
        const cacheKey = getCacheKey(
          new Request('/.netlify/functions/supabase-proxy'),
          action,
          data
        );
        
        // Check if we have a recent cache
        const cached = await cache.match(cacheKey);
        if (cached) {
          const timestamp = cached.headers.get('X-SW-Timestamp');
          const age = timestamp ? Date.now() - parseInt(timestamp) : Infinity;
          if (age < 60000) { // Less than 1 minute old
            return { action, status: 'cached' };
          }
        }
        
        // Fetch fresh data
        const response = await fetch('/.netlify/functions/supabase-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, data }),
        });
        
        if (response.ok) {
          const etag = await generateETag(response.clone());
          const cacheableResponse = await createCacheableResponse(response, etag, Date.now());
          await cache.put(cacheKey, cacheableResponse);
          return { action, status: 'fetched' };
        }
        
        return { action, status: 'error', error: response.status };
      })
    );
    
    results.push(...batchResults);
  }
  
  console.log('[SW] Public prefetch complete:', results);
  
  event.source?.postMessage({
    type: 'PREFETCH_PUBLIC_COMPLETE',
    results: results.map(r => r.status === 'fulfilled' ? r.value : { status: 'error' }),
  });
}

/**
 * Clear private cache for a user
 */
async function handleClearPrivateCache(event, userId) {
  if (!userId) {
    event.source?.postMessage({ type: 'CLEAR_PRIVATE_CACHE_COMPLETE', success: false });
    return;
  }
  
  const privateCacheName = getPrivateCacheName(userId);
  const deleted = await caches.delete(privateCacheName);
  
  console.log('[SW] Cleared private cache for user:', userId, deleted);
  
  event.source?.postMessage({
    type: 'CLEAR_PRIVATE_CACHE_COMPLETE',
    success: true,
    userId,
  });
}

/**
 * Clear all caches
 */
async function handleClearAllCache(event) {
  const cacheNames = await caches.keys();
  const prismCaches = cacheNames.filter(name => name.startsWith('prism-'));
  
  await Promise.all(prismCaches.map(name => caches.delete(name)));
  
  console.log('[SW] Cleared all caches:', prismCaches);
  
  event.source?.postMessage({
    type: 'CLEAR_ALL_CACHE_COMPLETE',
    success: true,
    cleared: prismCaches,
  });
}

/**
 * Get cache status
 */
async function handleGetCacheStatus(event) {
  const cache = await caches.open(PUBLIC_CACHE_NAME);
  const keys = await cache.keys();
  
  const status = {
    publicCacheSize: keys.length,
    entries: await Promise.all(
      keys.slice(0, 10).map(async (request) => {
        const response = await cache.match(request);
        return {
          url: request.url,
          timestamp: response?.headers.get('X-SW-Timestamp'),
          etag: response?.headers.get('X-SW-ETag'),
        };
      })
    ),
    currentUserId,
  };
  
  // Also get private cache info if user is set
  if (currentUserId) {
    try {
      const privateCache = await caches.open(getPrivateCacheName(currentUserId));
      const privateKeys = await privateCache.keys();
      status.privateCacheSize = privateKeys.length;
    } catch {
      status.privateCacheSize = 0;
    }
  }
  
  event.source?.postMessage({
    type: 'CACHE_STATUS',
    status,
  });
}

/**
 * Handle private data prefetch request
 */
async function handlePrefetchPrivate(event, userId) {
  if (!userId) {
    event.source?.postMessage({ type: 'PREFETCH_PRIVATE_COMPLETE', success: false, error: 'No userId' });
    return;
  }
  
  // Update current user ID
  currentUserId = userId;
  
  const privateActions = [
    { action: 'getNotificationsForUser', data: { userId } },
    { action: 'getInvitationsForUser', data: { userId } },
    { action: 'getCollaborationsForUser', data: { userId } },
  ];
  
  console.log('[SW] Starting private prefetch for user:', userId);
  
  const cacheName = getPrivateCacheName(userId);
  const cache = await caches.open(cacheName);
  const results = [];
  
  // Limit concurrent requests
  const MAX_CONCURRENT = 2;
  
  for (let i = 0; i < privateActions.length; i += MAX_CONCURRENT) {
    const batch = privateActions.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.allSettled(
      batch.map(async ({ action, data }) => {
        const cacheKey = getCacheKey(
          new Request('/.netlify/functions/supabase-proxy'),
          action,
          data
        );
        
        // Check if we have a recent cache
        const cached = await cache.match(cacheKey);
        if (cached) {
          const timestamp = cached.headers.get('X-SW-Timestamp');
          const age = timestamp ? Date.now() - parseInt(timestamp) : Infinity;
          if (age < 60000) { // Less than 1 minute old
            return { action, status: 'cached' };
          }
        }
        
        // Fetch fresh data
        const response = await fetch('/.netlify/functions/supabase-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, data }),
          credentials: 'include',
        });
        
        // Handle 401 - clear cache and notify
        if (response.status === 401) {
          await caches.delete(cacheName);
          currentUserId = null;
          notifyClients('auth-expired', { action, userId });
          return { action, status: 'auth-expired' };
        }
        
        if (response.ok) {
          const etag = await generateETag(response.clone());
          const cacheableResponse = await createCacheableResponse(response, etag, Date.now());
          await cache.put(cacheKey, cacheableResponse);
          return { action, status: 'fetched' };
        }
        
        return { action, status: 'error', error: response.status };
      })
    );
    
    results.push(...batchResults);
  }
  
  console.log('[SW] Private prefetch complete:', results);
  
  event.source?.postMessage({
    type: 'PREFETCH_PRIVATE_COMPLETE',
    results: results.map(r => r.status === 'fulfilled' ? r.value : { status: 'error' }),
    userId,
  });
}

/**
 * Invalidate specific cache entry
 */
async function handleInvalidateCache(event, action, isPrivate = false, userId = null) {
  if (!action) {
    event.source?.postMessage({ type: 'INVALIDATE_CACHE_COMPLETE', success: false });
    return;
  }
  
  // Determine which cache to use
  const cacheName = (isPrivate && userId) ? getPrivateCacheName(userId) : PUBLIC_CACHE_NAME;
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  let deleted = 0;
  for (const request of keys) {
    if (request.url.includes(`action=${action}`)) {
      await cache.delete(request);
      deleted++;
    }
  }
  
  console.log('[SW] Invalidated cache for action:', action, isPrivate ? '(private)' : '(public)', deleted);
  
  event.source?.postMessage({
    type: 'INVALIDATE_CACHE_COMPLETE',
    success: true,
    action,
    deleted,
    isPrivate,
  });
  
  // Notify other clients
  notifyClients('cache-invalidated', { action, isPrivate });
}
