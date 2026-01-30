# PrismMTR Launch Runbook

## Overview
- Web: Netlify (Next.js App Router, SSR/ISR)
- API + Socket.io: external host (Fly/Render/Railway/VPS)
- Realtime: Socket.io from browser to API host (no polling)

## Sites and Domains
- Production: `https://prismmtr.com` (Netlify site `prismmtr`)
- Staging: `https://staging.prismmtr.com` (Netlify site `prismmtr-staging`)
- API: `https://api.prismmtr.com` and `https://staging-api.prismmtr.com`

## Netlify Configuration
- Base directory: `apps/web`
- Build command:
  - `pnpm -C ../.. install --frozen-lockfile`
  - `pnpm -C ../.. --filter @prismmtr/web build`
- Publish: `.next` (handled by `@netlify/plugin-nextjs`)
- Deploy preview env: `NEXT_PUBLIC_E2E_TEST_MODE=true`, `NEXT_PUBLIC_OAUTH_DISABLED=true`

## Environment Variables (Web)
See `docs/NETLIFY_ENV_MATRIX.md` for per-context values.

## Environment Variables (API)
- `ALLOWED_ORIGINS` must include:
  - `https://prismmtr.com`
  - `https://staging.prismmtr.com`
  - `https://<site>.netlify.app`
  - `https://deploy-preview-*--<site>.netlify.app`
- Set `ALLOW_NETLIFY_PREVIEWS=true` to enable wildcard origin for Netlify previews.
- If using preview test login across domains:
  - `E2E_TEST_MODE=true`
  - `E2E_TEST_COOKIE_SAMESITE=none`
  - `E2E_TEST_COOKIE_SECURE=true`

## OAuth Redirect URLs
Configure only production and staging URLs (no deploy previews).

Discord + Supabase redirect URLs:
- `https://prismmtr.com/auth/callback`
- `https://staging.prismmtr.com/auth/callback`

Supabase provider callback (Discord app):
- `https://YOUR-PROJECT.supabase.co/auth/v1/callback`

## Cookie and CORS Strategy
- Production cookie domain: `.prismmtr.com`
- Cookies are `httpOnly`, `SameSite=Lax`, `Secure=true` in production.
- Ensure all browser fetches use `credentials: "include"` (already in web API client).
- Socket.io uses `withCredentials: true`.

## Retention Jobs
Recommended: run on the API host scheduler (cron).

Daily at 03:00 UTC:
```
0 3 * * * cd /srv/prismmtr/apps/api && npx tsx src/scripts/run-retention.ts >> /var/log/retention.log 2>&1
```

Verify logs contain:
```
{"event":"retention.job.end","status":"success",...}
```

## Deploy Flow
1) Deploy API to staging host.
2) Deploy Netlify staging site.
3) Smoke test staging.
4) Deploy API to production host.
5) Deploy Netlify production site.
6) Smoke test production.

## Smoke Tests
- Web loads SSR routes: `/projects`, `/posts`, `/c/<slug>`
- Sign in works (Discord OAuth on prod/staging, test login on preview)
- Search and command palette work (Ctrl+K)
- Socket.io connects (notifications badge updates)
- `/health/live`, `/health/ready`, `/health/version` return ok on API
- Create content and verify published content appears publicly

## Rollback
- Netlify: redeploy previous successful build.
- API: redeploy last stable image and verify `/health/ready`.
- Re-run smoke tests.
