# Service Worker Caching & Prefetch Implementation

This document describes the Service Worker-based caching system for PrismMTR that provides:
- Fast page navigation without full data reloads
- Background data prefetching for guests and authenticated users
- Protection against stale/deleted content
- No use of localStorage/sessionStorage/IndexedDB for data caching
- Private data caching isolated per-user

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser                                      │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   Page JS   │    │  prefetch.js │    │    sw.js    │              │
│  │ (data-layer)│◄──►│  (manager)   │◄──►│ (Service    │              │
│  │             │    │              │    │  Worker)    │              │
│  └──────┬──────┘    └──────┬───────┘    └──────┬──────┘              │
│         │                  │                    │                     │
│         │     ┌────────────┴─────────────┐     │                     │
│         │     │      Cache API           │◄────┘                     │
│         │     │  ┌─────────────────────┐ │                           │
│         │     │  │ prism-public-v1.0.1 │ │ (shared)                  │
│         │     │  ├─────────────────────┤ │                           │
│         │     │  │prism-private-<uid>  │ │ (per-user isolated)       │
│         │     │  └─────────────────────┘ │                           │
│         │     └──────────────────────────┘                           │
└─────────┼───────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Netlify Functions (Server)                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    supabase-proxy.js                           │  │
│  │  - Stable ETag: max(updatedAt) + count (not MD5)              │  │
│  │  - Returns 304 Not Modified when data unchanged                │  │
│  │  - Separates public vs private data caching                    │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Auth Request Flow on Dashboard

On dashboard page load, there is **ONE auth API call**:

1. **guards.js**: Fetches `GET /.netlify/functions/session` with HttpOnly cookie
2. **guards.js**: Stores user in `window.__session` (in-memory only)
3. **guards.js**: Sends userId to Service Worker via `postMessage`
4. **guards.js**: Triggers `prefetchPublic()` + `prefetchPrivate(userId)` - background prefetch
5. **dashboard.js**: Uses `window.__session` or `PrismGuards.getSession()` for user data

**ABSOLUTE RULE: NO localStorage/sessionStorage/IndexedDB for ANY purpose.**

Session is:
- Stored server-side with HttpOnly cookie (`prism_session`)
- Fetched once per page load via `GET /api/session`
- Kept in-memory only (`window.__session`)
- Sent to SW via `postMessage` for private cache isolation

Redirect URLs:
- Passed via `?next=/path` query param (validated as relative path)
- NEVER stored in any client-side storage

## Files

### 1. `/sw.js` - Service Worker

The Service Worker handles:
- Intercepting API requests to `/.netlify/functions/supabase-proxy`
- Implementing stale-while-revalidate caching strategy
- Managing cache with ETag-based validation
- Notifying pages when data changes

**Caching Strategy:**
1. Check Cache API for existing response
2. If cached and fresh (<30s), return immediately + revalidate in background
3. If cached but stale, wait for network (fallback to cache on error)
4. On network response, compare ETags to detect changes
5. Notify all clients if data changed

### 2. `/js/prefetch.js` - Prefetch Manager

The prefetch module provides:
- Service Worker registration and lifecycle management
- `prefetchPublic()` - Prefetch public data (projects, posts, companies, users)
- `prefetchPrivate(userId)` - Prefetch user-specific data (notifications, invitations)
- Anti-spam protection (in-memory cooldown, not localStorage)
- Event listeners for data updates

**Usage:**
```javascript
// Automatic: Called by guards.js after session check

// Manual prefetch
await window.PrismPrefetch.prefetchPublic();
await window.PrismPrefetch.prefetchPrivate(userId);

// Listen for updates
window.PrismPrefetch.onUpdate((eventType, data) => {
  if (eventType === 'data-updated') {
    // Refresh UI
  }
});

// On logout
await window.PrismPrefetch.handleLogout();
```

### 3. `/js/guards.js` - Auth via /api/session

Auth flow (NO localStorage/sessionStorage/IndexedDB):
1. Fetches `GET /.netlify/functions/session` with HttpOnly cookie
2. Stores user in `window.__session` (in-memory)
3. Registers Service Worker
4. Sends userId to SW via `postMessage`
5. Calls `prefetchPublic()` for all users
6. Calls `prefetchPrivate(userId)` for authenticated users

On logout:
1. Calls `POST /.netlify/functions/logout` (clears HttpOnly cookie)
2. Clears Service Worker private cache
3. Clears `window.__session`
4. Redirects to home

Redirect flow (no storage):
- Access denied → redirect to `index.html?next=/path&reason=auth`
- After login → read `?next` param, validate as relative path, redirect

### 4. `/netlify/functions/supabase-proxy.js` - ETag Support

Added features:
- `generateETag(data)` - Creates stable ETag using `max(updatedAt) + count` (not MD5)
- `isNotModified(clientETag, serverETag)` - Compares ETags
- `notModified(etag)` - Returns 304 response
- Cacheable actions: `getUsers`, `getProjects`, `getPosts`, `getCompanies`
- Private actions: `getNotificationsForUser`, `getInvitationsForUser`, etc.

**ETag Format:**
```
For arrays: "<max_updated_timestamp>-<count>"
For objects: "<updated_timestamp>-<id>"
```

**Headers:**
```
Cacheable (public):
  ETag: "<timestamp>-<count>"
  Last-Modified: <date>
  Cache-Control: public, max-age=30, stale-while-revalidate=60

Private:
  Cache-Control: private, max-age=60
  Cache-Control: private, no-store
```

## Caching Rules

### Public Data (Cached)
| Action | Cached | Strategy |
|--------|--------|----------|
| `getProjects` | ✅ | stale-while-revalidate |
| `getPosts` | ✅ | stale-while-revalidate |
| `getCompanies` | ✅ | stale-while-revalidate |
| `getUsers` | ✅ | stale-while-revalidate |

### Private Data (Cached with User Isolation)
| Action | Cached | Strategy |
|--------|--------|----------|
| `getNotificationsForUser` | ✅ | stale-while-revalidate (60s) |
| `getInvitationsForUser` | ✅ | stale-while-revalidate (60s) |
| `getCollaborationsForUser` | ✅ | stale-while-revalidate (60s) |

Private data is cached in user-isolated caches (`prism-private-<userId>-v1.0.1`).

### Write Operations (Never Cached)
All create/update/delete operations are never cached.

## Protection Against Stale Content

1. **ETag Validation**: Server generates ETag from `max(updatedAt) + count` for stable comparison
2. **Background Revalidation**: Even with cache hit, SW fetches fresh data
3. **Change Detection**: If ETag differs, clients are notified via `postMessage`
4. **Page Refresh**: Pages listen for `prism-data-updated` events and refresh UI
5. **401 Auto-Cleanup**: Expired sessions trigger automatic cache clear and logout

## Anti-Spam Protection

In-memory rate limiting (no localStorage):
- Minimum 60 seconds between prefetch calls
- Maximum 3 concurrent prefetch requests
- 30-second prefetch timeout

## Event Flow

### Page Load (Guest)
```
1. Page loads
2. prefetch.js registers SW
3. guards.js fetches GET /api/session → no user (guest)
4. prefetchPublic() triggered
5. SW fetches/caches: projects, posts, companies, users
6. Page makes API calls → SW returns cached data instantly
```

### Page Load (Authenticated)
```
1. Page loads
2. prefetch.js registers SW
3. guards.js fetches GET /api/session (HttpOnly cookie) → user data
4. window.__session = user (in-memory only)
5. PrismPrefetch.setUser(userId) sends userId to SW via postMessage
6. prefetchPublic() + prefetchPrivate(userId) triggered
7. SW caches public data in shared cache
8. SW caches private data in user-isolated cache (prism-private-<userId>)
9. Page makes API calls → SW returns cached data instantly
```

### Data Update Detection
```
1. User on page, SW has cached data
2. Background revalidation fetches fresh data
3. ETag differs from cached version
4. SW sends postMessage to all clients
5. Pages receive 'prism-data-updated' event
6. Pages refresh affected UI components
```

### Logout
```
1. User clicks logout
2. guards.js calls handleLogout()
3. POST /api/logout (clears HttpOnly cookie server-side)
4. SW clears user's private cache (prism-private-<userId>)
5. SW resets currentUserId to null
6. window.__session = null (in-memory cleared)
7. Redirect to home
```

### 401 Auth Expired (Automatic)
```
1. Any API returns 401 Unauthorized
2. SW detects 401, clears private cache
3. SW sends 'AUTH_EXPIRED' message to all clients
4. prefetch.js receives message, dispatches 'prism-auth-expired' event
5. main.js listens for event, calls performLogout()
6. User redirected to login
```

## Configuration

### prefetch.js
```javascript
const CONFIG = {
  SW_PATH: '/sw.js',
  PREFETCH_COOLDOWN: 60000,      // 1 minute between prefetches
  MAX_CONCURRENT_PREFETCH: 3,    // Max parallel requests
  PREFETCH_TIMEOUT: 30000,       // 30s timeout
};
```

### sw.js
```javascript
const SW_VERSION = '1.0.0';
const MAX_CACHE_AGE = 30000;     // 30s before revalidation required
```

## Debugging

Check SW status in browser DevTools:
1. Application → Service Workers
2. Application → Cache Storage → `prism-public-v1.0.0`

Console logs (debug mode only):
```
[Prefetch] Registering Service Worker...
[Prefetch] Service Worker ready
[Prefetch] Starting public prefetch for user: xxx
[SW] Returning cached response for: getProjects
[SW] Data changed, notifying clients: getPosts
```

## Browser Support

- Chrome 60+
- Firefox 44+
- Safari 11.1+
- Edge 17+

Service Workers require HTTPS (except localhost).
