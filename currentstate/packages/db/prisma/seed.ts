import { prisma } from "../src/index.ts";

type SeedAdminResult = {
  id: string;
  discordId: string;
  username: string;
};

function getSeedAdminDiscordId(): string {
  const discordId = process.env.SEED_ADMIN_DISCORD_ID;

  // Явно валидируем обязательную переменную окружения для сидирования.
  if (!discordId || discordId.trim().length === 0) {
    throw new Error(
      "SEED_ADMIN_DISCORD_ID is required to seed the admin user.",
    );
  }

  return discordId.trim();
}

async function seedAdminUser(): Promise<SeedAdminResult> {
  const discordId = getSeedAdminDiscordId();

  // Используем upsert, чтобы сид можно было безопасно запускать повторно.
  const admin = await prisma.user.upsert({
    where: { discordId },
    update: {
      // Обновляем базовые поля, чтобы сид выравнивал состояние.
      username: "Prism Admin",
      avatarUrl: null,
    },
    create: {
      discordId,
      username: "Prism Admin",
      avatarUrl: null,
    },
    select: {
      id: true,
      discordId: true,
      username: true,
    },
  });

  return admin;
}

async function main(): Promise<void> {
  const admin = await seedAdminUser();

  // Лог оставляем коротким и информативным для CI/локального запуска.
  console.log(
    `[prisma:seed] Admin ready: id=${admin.id} discordId=${admin.discordId} username=${admin.username}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("[prisma:seed] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
