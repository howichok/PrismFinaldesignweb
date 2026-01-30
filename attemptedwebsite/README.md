# PrismMTR Site

UI skeleton (Phase 0) plus database foundations (Phase 1) for the PrismMTR
community portal.

## Run locally

```bash
npm install
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

Then open `http://localhost:3000`.

## Environment

Copy `.env.example` to `.env` and adjust if needed:

```bash
DATABASE_URL="postgresql://prisma:prisma@localhost:5432/prismmtr?schema=public"
REDIS_URL="redis://localhost:6379"
SESSION_SECRET="replace-me"
DISCORD_CLIENT_ID="replace-me"
DISCORD_CLIENT_SECRET="replace-me"
DISCORD_REDIRECT_URI="http://localhost:3000/api/auth/discord/callback"
BASE_URL="http://localhost:3000"
DISCORD_INVITE_URL="https://discord.gg/placeholder"
PUBLIC_LAUNCHER_URL="https://example.com/PrismMTRLauncher.exe"
PUBLIC_MODRINTH_URL="https://modrinth.com/modpack/prismmtr"
SEED_ADMIN_DISCORD_ID="admin-seed"
```

## Database commands

```bash
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:seed
npm run db:studio
```

## Auth setup

1. Create a Discord application and add `http://localhost:3000/api/auth/discord/callback`
   as the redirect URI.
2. Fill in `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` in `.env`.
3. Start Redis (`docker compose up -d` already includes it).

## Discovery caching

- Discovery uses a lightweight client cache with a 2-minute TTL.
- When stale, cached results render immediately and revalidate in the background.
- Active tabs auto-refresh every 120 seconds and on window focus.

## Company invites (Phase 11)

- User search (auth required): `GET /api/users/search?query=...`
- Company invites:
  - Create: `POST /api/company/:companyId/invites`
  - Pending list: `GET /api/company/:companyId/invites?status=pending`
  - Cancel: `POST /api/company/:companyId/invites/:inviteId/cancel`
- My invites:
  - List pending: `GET /api/invites/mine?type=company_membership&status=pending`
  - Accept: `POST /api/invites/:inviteId/accept`
  - Decline: `POST /api/invites/:inviteId/decline`
- Member management:
  - Change role: `POST /api/company/:companyId/members/:userId/role`
  - Remove member: `POST /api/company/:companyId/members/:userId/remove`

## Routes

- `/`
- `/download`
- `/discovery`
- `/help`
- `/dashboard`
- `/dashboard/invites`
- `/company/:companyId/hub/*`

## Notes

- Fixed header uses a `ResizeObserver` to set page padding dynamically.
- Components live under `components/` with UI primitives in `components/ui/`.
- Company ownership is enforced by `Company.ownerUserId` (single owner). The
  membership role `OWNER` should mirror this in application logic.
- Post and project ownership relies on `ownerType` plus either
  `ownerUserId` or `ownerCompanyId` being set (enforce in app logic).
- Partnership pairs are stored with ordered company IDs to keep the unique
  constraint stable.
