# Backup & Restore (Postgres)

This project stores persistent data in Postgres (users, invites, tickets, etc.) while Redis holds ephemeral sessions. Backups should focus on Postgres.

## 1. Enable Postgres backups

1. In your managed Postgres provider (Neon, Supabase, RDS, etc.), enable automated backups/snapshots for the production database.
2. Configure retention to a safe window (e.g., 7–14 days) and make sure backups are stored in a different availability zone/region if supported.
3. Optionally take manual snapshots before risky schema changes or migrations.

## 2. Restore from a backup

1. Identify the desired backup/snapshot in your provider’s console.
2. Restore it to a staging database or directly to production (only if you understand the impact).
3. Update `DATABASE_URL` in Netlify to point to the restored database if you are switching environments.
4. Re-run `npm run build:netlify` (or redeploy via Netlify) so migrations are applied on top of the restored dataset.

## 3. Redis sessions

- Redis is used only for sessions. Redis persistence/backups are optional because the application can recreate sessions during normal user activity.
- If you want to capture session data (for debugging), consult your Redis provider’s snapshot feature, but do not rely on Redis backups for critical recovery.

## 4. Verification

- After any restore, verify `GET /api/health` returns `{ db: true, redis: true }`.
- Exercise a few user flows (sign-in, notifications, tickets) to ensure the restored data behaves correctly.
