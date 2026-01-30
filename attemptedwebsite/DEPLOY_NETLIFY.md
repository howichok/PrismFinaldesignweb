# Netlify Deployment Guide

This project is configured for deployment on Netlify using Next.js 14 and Prisma 5.

## ⚠️ Critical Setup Instructions

1.  **Do NOT** run `prisma migrate deploy` in the build command.
2.  **Environment Variables**: Configured in Netlify Site Settings.

## Environment Variables (Required)

| Variable              | Description                                          | Use in Netlify? |
| :-------------------- | :--------------------------------------------------- | :-------------- |
| `DATABASE_URL`        | Postgres Connection String (Transaction Pool / 6543) | **YES**         |
| `DIRECT_URL`          | Postgres Connection String (Session / 5432)          | **YES**         |
| `NEXT_PUBLIC_SITE_URL`| `https://<your-site>.netlify.app`                    | **YES**         |
| `NEXTAUTH_SECRET`     | Random string for auth encryption                    | **YES**         |
| `DISCORD_CLIENT_ID`   | Discord Application ID                               | **YES**         |
| `DISCORD_CLIENT_SECRET`| Discord Application Secret                          | **YES**         |

## Database Migrations

You must run migrations **manually** or via a separate CI process (e.g. GitHub Actions). Netlify Build is for building the frontend/serverless functions only.

**Run locally before deploying:**
```bash
# Ensure .env has your production DATABASE_URL
npx prisma migrate deploy
```

## Netlify Configuration Checklist

*   **Build Command:** `npm run build:netlify` (which runs `next build`)
*   **Publish Directory:** Leave empty (Next.js plugin handles it) typically `.next` implied but handled by plugin.
*   **Node Version:** Set `NODE_VERSION` env var to `20`.

## Troubleshooting

*   **Build fails on `prisma generate`**: Ensure `postinstall` script is present in `package.json`.
*   **Runtime Error `P1001`**: Database connection failed. Check `DATABASE_URL`.
