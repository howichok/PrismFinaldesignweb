# PrismMTR Community Portal

Единый портал, собранный из трёх прототипов:
- Glassmorphism UI (old-website)
- PostgreSQL + Prisma, Discord OAuth, Redis-кэш (attemptedwebsite)
- Монорепо на pnpm workspaces (currentstate)

## Быстрый запуск (локально)

1. Поднять инфраструктуру:

```bash
docker compose up -d
```

2. Скопировать переменные окружения:

```bash
cp .env.example .env
```

3. Сгенерировать Prisma Client и применить миграции:

```bash
pnpm db:generate
pnpm db:migrate
```

4. (Опционально) Сидирование админа:

```bash
pnpm db:seed
```

5. Запуск портала:

```bash
pnpm dev
```

## Ключевые маршруты портала

- `/` — Главная
- `/discovery` — Лента Discovery (Redis SWR)
- `/help` — Help-форма → Discord Webhook
- `/portal/companies` — Компании (owner/member)
- `/portal/companies/create` — Создание компании
- `/portal/company/[companyId]/invites` — Инвайты (owner)
- `/portal/company/[companyId]/accept-invite?token=...` — Принятие инвайта

## Важные переменные окружения

См. `.env.example`:
- `DATABASE_URL`, `DIRECT_URL`
- `REDIS_URL`
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`
- `DISCORD_HELP_WEBHOOK_URL`
- `SEED_ADMIN_DISCORD_ID`