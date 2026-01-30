# Production Runbook

## 1. Discord OAuth stops working

- Check `DEPLOY_NETLIFY.md` for the canonical `BASE_URL` / `DISCORD_REDIRECT_URI`. Ensure the Discord app, Netlify env, and site all use the same protocol/domain/path.
- Confirm the Netlify deploy log shows the OAuth request hitting `/api/auth/discord/callback`. Use the browser console to inspect the redirect URI that Discord returns.
- If Discord rejects the callback, update the OAuth settings and re-deploy. Use `GET /api/health` to verify the API is reachable over HTTPS.
- Look at Netlify function logs (`netlify logs --path /api/auth/discord/callback`) for rate-limit or status issues. Rate limits are enforced via Redis, so repeated errors might also mention `Retry-After`.

## 2. Postgres becomes unavailable or slow

- Check the Postgres provider (Neon, Supabase, etc.) dashboard for outages or failovers. Restart/fail over per provider instructions.
- Ensure `DATABASE_URL` in Netlify uses the correct production credentials and includes `sslmode=require` (or equivalent). Changing it requires a redeploy.
- Run `npx prisma migrate status` locally against the same `DATABASE_URL` to confirm the schema matches the codebase.
- After you restore access or fix credentials, trigger a Netlify deploy so `npx prisma migrate deploy` runs again and the site rebuilds.
- If you restore from backup, follow `BACKUP_AND_RESTORE.md` to re-point Netlify and validate the health endpoint.

## 3. Redis is unreachable (sessions stop working)

- Check the Redis provider’s status page. Failover or restart the instance if the provider offers that.
- Update `REDIS_URL` in Netlify if the endpoint changed (for example, a failover host). Redeploy afterwards.
- Use `GET /api/health` to verify the Redis check. The response `{ redis: false }` indicates the connection cannot be established.
- After Redis is restored, existing sessions may still be invalidated. Instruct users to log in again if necessary.

## 4. General diagnostics

- Use `/api/health` as the first screen for both Redis and Postgres. Its JSON output includes timestamps for logging correlation.
- Netlify build logs show `prisma generate` + `migrate deploy` steps. Failures there are usually `DATABASE_URL` or migration errors.
- Inspect server logs (Netlify function logs, or `console.*` output forwarded to Netlify) for stack traces or rate-limit warnings.
