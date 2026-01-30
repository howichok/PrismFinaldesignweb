# Security Regression Checklist

This document outlines security measures implemented in Phase 17 and manual verification steps.

## 1. Security Headers

**Implementation:** Global headers via `next.config.ts`

**Verification:**
```bash
# Check headers on any public page
curl -I https://your-domain.com/

# Should include:
# - Content-Security-Policy
# - X-Frame-Options: DENY
# - X-Content-Type-Options: nosniff
# - Referrer-Policy: strict-origin-when-cross-origin
# - Permissions-Policy
# - Strict-Transport-Security (production only)
```

## 2. CSRF Protection

**Implementation:** Double submit cookie pattern in `middleware.ts`

**Verification:**
```bash
# Should fail (403)
curl -X POST https://your-domain.com/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"category":"LAUNCHER","subject":"Test","message":"Test"}'

# Should succeed with valid CSRF token
curl -X POST https://your-domain.com/api/tickets \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: <token-from-cookie>" \
  -H "Cookie: prism_csrf=<token>" \
  -d '{"category":"LAUNCHER","subject":"Test","message":"Test"}'
```

**Exempt endpoints:**
- `/api/auth/discord/*` (OAuth callbacks)
- `/api/csrf` (token endpoint)

## 3. Rate Limiting

**Implementation:** Redis-based rate limiting with configurable limits

**Rate Limit Configuration:**

| Endpoint | Limit | Window | Key Basis |
|----------|-------|--------|-----------|
| `/api/auth/discord/start` | 30 | 10 min | IP |
| `/api/auth/discord/callback` | 10 | 10 min | IP |
| `/api/tickets` (POST) | 3 | 10 min | User ID |
| `/api/tickets/[id]/message` | 10 | 1 min | User ID |
| `/api/moderation/*/approve` | 30 | 1 min | User ID |
| `/api/moderation/*/deny` | 30 | 1 min | User ID |
| `/api/company/[id]/invites` | 20 | 1 hour | User ID + Company ID |
| `/api/company/[id]/partnerships/invite` | 10 | 1 hour | User ID + Company ID |
| `/api/company/[id]/projects/[id]/collab-invites` | 20 | 1 hour | User ID + Company ID |
| `/api/company/[id]/proposals/posts` | 20 | 1 hour | User ID + Company ID |
| `/api/company/[id]/proposals/projects` | 20 | 1 hour | User ID + Company ID |
| `/api/company/[id]/projects/[id]/proposals/updates` | 20 | 1 hour | User ID + Company ID |
| `/api/notifications/mark-all-read` | 10 | 1 min | User ID |

**Verification:**
```bash
# Rapid requests should return 429
for i in {1..5}; do
  curl -X POST https://your-domain.com/api/tickets \
    -H "x-csrf-token: <token>" \
    -H "Cookie: prism_csrf=<token>; prism_session=<session>" \
    -H "Content-Type: application/json" \
    -d '{"category":"LAUNCHER","subject":"Test","message":"Test"}'
done

# Check for:
# - Status 429 on 4th+ request
# - Retry-After header present
# - Error message: "Too many requests."
```

## 4. Input Validation

**Implementation:** Zod schemas with centralized parsing via `lib/validation/request.ts`

**Verification:**
```bash
# Invalid payload should return 400
curl -X POST https://your-domain.com/api/tickets \
  -H "x-csrf-token: <token>" \
  -H "Cookie: prism_csrf=<token>" \
  -H "Content-Type: application/json" \
  -d '{"category":"INVALID","subject":"","message":""}'

# Should return:
# {
#   "error": {
#     "code": "VALIDATION_ERROR",
#     "message": "Invalid payload.",
#     "details": { "issues": [...] }
#   }
# }
```

## 5. Authentication & Authorization

**Centralized Guards:**
- `requireAuth()` - Base authentication check
- `requireModOrAdmin()` - Site moderator/admin check
- `requireAdmin()` - Admin-only check
- `requireCompanyMembership()` - Company membership check
- `requireCompanyRole()` - Specific company role check
- `requireProjectOwnershipOrCompanyRole()` - Project access check

**Verification:**

### Unauthorized Access (401)
```bash
# Should redirect to /unauthorized
curl -I https://your-domain.com/dashboard

# API should return 401
curl https://your-domain.com/api/me
```

### Insufficient Permissions (403)
```bash
# Regular user accessing admin endpoint
curl -X POST https://your-domain.com/api/moderation/[id]/approve \
  -H "Cookie: prism_session=<regular-user-session>" \
  -H "x-csrf-token: <token>"

# Should return 403 FORBIDDEN
```

### Invite Access Control
```bash
# User attempting to accept invite not meant for them
curl -X POST https://your-domain.com/api/invites/[other-user-invite-id]/accept \
  -H "Cookie: prism_session=<user-session>" \
  -H "x-csrf-token: <token>"

# Should return 404 (invite not found) or 403
```

## 6. Idempotency

**Implementation:** Status checks before transactions, double-check in transaction

**Verification:**

### Invite Accept (Idempotent)
```bash
# First accept - should succeed
curl -X POST https://your-domain.com/api/invites/[id]/accept \
  -H "Cookie: prism_session=<session>" \
  -H "x-csrf-token: <token>"

# Second accept - should return success with alreadyAccepted: true
curl -X POST https://your-domain.com/api/invites/[id]/accept \
  -H "Cookie: prism_session=<session>" \
  -H "x-csrf-token: <token>"

# Should NOT create duplicate memberships
```

### Moderation Actions (Already Reviewed)
```bash
# Approve a request
curl -X POST https://your-domain.com/api/moderation/[id]/approve \
  -H "Cookie: prism_session=<mod-session>" \
  -H "x-csrf-token: <token>"

# Attempt to approve again
curl -X POST https://your-domain.com/api/moderation/[id]/approve \
  -H "Cookie: prism_session=<mod-session>" \
  -H "x-csrf-token: <token>"

# Should return 409 ALREADY_REVIEWED
```

## 7. Database Indexes

**Added Indexes:**
- `Post(status, publishedAt)` - Discovery queries
- `Post(status, updatedAt)` - Discovery queries
- `Project(moderationStatus, publishedAt)` - Discovery queries
- `Project(moderationStatus, updatedAt)` - Discovery queries
- `Company(visibilityStatus, publishedAt)` - Discovery queries
- `Company(visibilityStatus, updatedAt)` - Discovery queries
- `Invite(toUserId, status)` - User invite lookups
- `Invite(toCompanyId, status)` - Company invite lookups
- `Invite(projectId, status)` - Project invite lookups
- `Partnership(companyAId, status)` - Company partnership queries
- `Partnership(companyBId, status)` - Company partnership queries

**Verification:**
```sql
-- Check indexes exist
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('Post', 'Project', 'Company', 'Invite', 'Partnership')
ORDER BY tablename, indexname;
```

## 8. Error Pages

**Pages:**
- `/unauthorized` - 401 (sign in required)
- `/forbidden` - 403 (access denied)
- `/not-found` - 404 (page not found)
- `/error` - 500 (global error boundary)

**Verification:**
- Visit `/unauthorized` - should show friendly sign-in page
- Visit `/forbidden` - should show access denied page
- Access non-existent route - should show 404 page

## 9. Observability

**Implementation:** Structured logging with requestId

**Log Events:**
- `auth_start` - Auth flow initiated
- `auth_callback_success` - Successful authentication
- `auth_callback_failed` - Failed authentication
- `auth_callback_banned` - Banned user attempt
- `moderation_approve` - Content approved
- `moderation_deny` - Content denied
- `company_invite_accept` - Invite accepted
- `collab_invite_accept` - Collaboration invite accepted
- `partnership_invite_accept` - Partnership invite accepted
- `rate_limit_blocked` - Rate limit triggered

**Verification:**
```bash
# Check logs include requestId
# All log entries should have requestId field for tracing
```

## 10. Performance

**Cache Headers:** Public discovery endpoints have 60s cache with stale-while-revalidate

**Verification:**
```bash
curl -I https://your-domain.com/api/discovery/posts

# Should include:
# Cache-Control: public, max-age=60, stale-while-revalidate=60
```

**Private Endpoints:** Should NOT have cache headers

## 11. Transactions

**Critical Operations Use Transactions:**
- Invite accept (membership creation + invite update)
- Moderation approve/deny (status update + notification + audit log)
- Ticket creation (ticket + initial message)
- Ticket reply (message + status update + notification)
- Partnership accept (partnership + invite update + notifications)

**Verification:**
- Check code for `prisma.$transaction()` usage in critical paths
- Ensure atomic operations (all succeed or all fail)

## 12. Session Cookie Security

**Settings:**
- `httpOnly: true` - Prevents XSS access
- `sameSite: "lax"` - CSRF protection
- `secure: true` (production) - HTTPS only
- Proper domain/path settings

**Verification:**
```bash
curl -I https://your-domain.com/api/auth/discord/callback

# Check Set-Cookie header:
# HttpOnly; SameSite=Lax; Secure (in production)
```

## Manual Testing Checklist

- [ ] POST without CSRF token → 403
- [ ] POST with invalid CSRF token → 403
- [ ] Accept invite not for current user → 404/403
- [ ] Member attempting owner action → 403
- [ ] Guest accessing private endpoint → 401 redirect
- [ ] Rate limit exceeded → 429 with Retry-After
- [ ] Invalid input → 400 with validation details
- [ ] Double accept invite → Idempotent success
- [ ] Approve already-reviewed content → 409
- [ ] Public discovery endpoints → Cache headers present
- [ ] Private endpoints → No cache headers
- [ ] All error pages render correctly
- [ ] Logs include requestId for all events

## Automated Testing (Future)

Consider adding:
- E2E tests for CSRF protection
- Unit tests for rate limiting logic
- Integration tests for idempotency
- Performance tests for indexed queries
