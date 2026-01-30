# Netlify Environment Matrix

This matrix documents the web app environment variables for Netlify contexts.
See `docs/LAUNCH_RUNBOOK.md` for the full deployment flow.

## Shared (all contexts)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SOCKET_URL`
- `NEXT_PUBLIC_SENTRY_DSN` (optional)

## Production (prismmtr.com)
- `NEXT_PUBLIC_SITE_URL=https://prismmtr.com`
- `NEXT_PUBLIC_API_BASE_URL=https://api.prismmtr.com` (or `/api` if using Netlify proxy)
- `NEXT_PUBLIC_SOCKET_URL=https://api.prismmtr.com`
- `NEXT_PUBLIC_E2E_TEST_MODE=false`
- `NEXT_PUBLIC_OAUTH_DISABLED=false`

## Staging (staging.prismmtr.com)
- `NEXT_PUBLIC_SITE_URL=https://staging.prismmtr.com`
- `NEXT_PUBLIC_API_BASE_URL=https://staging-api.prismmtr.com`
- `NEXT_PUBLIC_SOCKET_URL=https://staging-api.prismmtr.com`
- `NEXT_PUBLIC_E2E_TEST_MODE=false`
- `NEXT_PUBLIC_OAUTH_DISABLED=false`

## Deploy Preview (Netlify previews)
- `NEXT_PUBLIC_SITE_URL=https://deploy-preview-<n>--<site>.netlify.app`
- `NEXT_PUBLIC_API_BASE_URL=https://staging-api.prismmtr.com`
- `NEXT_PUBLIC_SOCKET_URL=https://staging-api.prismmtr.com`
- `NEXT_PUBLIC_E2E_TEST_MODE=true`
- `NEXT_PUBLIC_OAUTH_DISABLED=true`

Notes:
- Deploy previews must not be used for OAuth callbacks. Use test login only.
- If using `/api` proxying, keep `NEXT_PUBLIC_API_BASE_URL` as a full URL in staging and previews.
