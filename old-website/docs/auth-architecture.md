# PrismMTR Auth Architecture

## 5 FINAL RULES

### Rule 1: Lazy /session with Dedupe
- Dashboard-click делает `/session` запрос с дедупликацией (один in-flight)
- `AuthManager.fetchSession()` использует `sessionPromise` для дедупа
- Повторные вызовы получают тот же Promise

### Rule 2: Realtime Only on Protected Pages
- `startRealtimeSubscription()` вызывается ТОЛЬКО при `requireAuth=true`
- При logout/401/403 обязательно вызывается `stopRealtimeSubscription()`
- Публичные страницы и lazy dashboard checks НЕ имеют realtime

### Rule 3: Role Downgrade = Immediate Logout
- При понижении роли на защищённой странице:
  - `logout()` вызывается НЕМЕДЛЕННО (без setTimeout)
  - `CLEAR_PRIVATE_CACHE` отправляется в SW
  - Редирект на `?reason=revoked`
- Никаких "мягких" попыток или задержек

### Rule 4: Server-Side Session/Role Verification
- Все приватные netlify functions проверяют сессию через cookie
- `verify-session.js` - shared helper для проверки
- `supabase-proxy.js` - проверяет session для write операций
- `admin-api.js` - требует mod+ role через cookie verification

### Rule 5: No /session in api-fetch or SW
- `api-fetch-simple.js` НЕ вызывает `/session` никогда
- Service Worker НЕ вызывает `/session` никогда
- `/session` вызывается ТОЛЬКО из:
  - `guards-new.js` (protected pages)
  - `gotoDashboardWithLoading()` (lazy dashboard check)

---

## Single Source of Truth: AuthManager

**File:** `js/auth-manager.js`

### Core Principle
- ONE place for all auth decisions
- NO polling, NO TTL refresh for session
- Role updates via Supabase Realtime ONLY
- **PUBLIC PAGES: 0 session requests, 0 realtime**

### API

```javascript
// Initialize auth (protected pages call this via guards-new.js)
AuthManager.initAuth(requireAuth, requireRole) → Promise<{user, allowed}>

// Get current session (sync, in-memory)
AuthManager.getSession() → user | null

// Check login status
AuthManager.isLoggedIn() → boolean

// Check role permission
AuthManager.hasRole('mod') → boolean

// Logout (clears session, SW cache, redirects)
AuthManager.logout(redirectUrl)
```

### Events Dispatched

| Event | When | Detail |
|-------|------|--------|
| `prism:auth:ready` | Session checked | `{ user, isLoggedIn }` |
| `prism:user:updated` | Realtime role/version change | `{ user, oldRole, newRole }` |
| `prism:access:revoked` | Role downgrade or session invalid | `{ reason }` |

---

## Page Protection: guards-new.js

**File:** `js/guards-new.js`

### Usage

```html
<!-- Protected page (login required) -->
<script src="js/auth-manager.js"></script>
<script src="js/guards-new.js" data-require-auth="true"></script>

<!-- Admin-only page -->
<script src="js/auth-manager.js"></script>
<script src="js/guards-new.js" data-require-auth="true" data-require-role="mod"></script>
```

### Behavior
1. Reads `data-require-auth` and `data-require-role` from script tag
2. Calls `AuthManager.initAuth(requireAuth, requireRole)`
3. If denied → redirects to `index.html?reason=auth|role`
4. If allowed → dispatches `prism:guards:ready`

---

## Public Pages - ZERO Session Requests

On public pages (index, discovery, projects, posts, etc.):
- **NO /session request on page load**
- **NO realtime subscription**
- UI shows "Sign In" button (guest state)
- Auth check happens ONLY when user clicks "Dashboard/Account"

### Lazy Auth Check

When user clicks Dashboard button on public page:
1. `gotoDashboardWithLoading()` shows loading overlay
2. Calls `AuthManager.initAuth(false, null)` - FIRST session request
3. If logged in → navigate to dashboard
4. If not logged in → show login modal (no redirect)

```javascript
// components.js gotoDashboardWithLoading()
if (!window.__sessionChecked) {
  AuthManager.initAuth(false, null).then(({ user }) => {
    if (!user) {
      openModal('loginModal');  // Show login, don't redirect
    } else {
      navigateToDashboard();
    }
  });
}
```

---

## Session Flow

### Public Page Load (index.html, discovery.html, etc.)
```
1. auth-manager.js loads → defines AuthManager
2. components.js loads → NO initAuth call
3. syncAuthToUI() → shows "Sign In" (no session data)
4. Page ready - ZERO /session requests
```

### Dashboard Button Click (on public page)
```
1. User clicks Dashboard/Account button
2. gotoDashboardWithLoading() → shows loading
3. AuthManager.initAuth(false, null) → FIRST /session request
4. If logged in → navigate to dashboard.html
5. If not logged in → show login modal
```

### Protected Page Load (dashboard.html, company.html, etc.)
```
1. auth-manager.js loads → defines AuthManager
2. guards-new.js loads → calls AuthManager.initAuth(true, role)
3. AuthManager fetches /session (SINGLE request)
4. If denied → redirect to index.html
5. If allowed → dispatch prism:guards:ready
6. AuthManager starts Realtime subscription
7. components.js receives prism:auth:ready → updates UI
```

### Realtime Role Update (on protected pages only)
```
1. Admin changes user role in Supabase
2. Supabase Realtime pushes UPDATE event
3. AuthManager receives event, checks role/version change
4. If role changed → refetch /session
5. dispatch prism:user:updated
6. If access now denied → dispatch prism:access:revoked → auto-logout
```

---

## Network Requests Summary

| Page Type | Session Requests | Realtime | Notes |
|-----------|-----------------|----------|-------|
| Public | **0** | **No** | Guest UI, lazy check on action |
| Protected | 1 | Yes | Required for access |
| After OAuth | 1 | Yes | Immediate after redirect |

**NO polling anywhere. Role updates via Realtime push on protected pages only.**

---

## File Structure

```
js/
├── auth-manager.js     # Single source of truth
├── guards-new.js       # Thin wrapper for page protection
├── api-fetch-simple.js # Simplified fetch with public caching
├── components.js       # UI components, lazy auth on action
└── [OLD] auth.js       # Legacy - can be removed
└── [OLD] guards.js     # Legacy - can be removed
└── [OLD] api-fetch.js  # Legacy - can be removed
```
