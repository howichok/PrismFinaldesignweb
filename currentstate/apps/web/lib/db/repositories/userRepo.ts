import { prisma } from "@/lib/db/prisma";

export async function findByDiscordId(discordId: string) {
  return prisma.user.findUnique({
    where: { discordId },
  });
}

export async function getById(id: string) {
  return prisma.user.findUnique({
    where: { id },
  });
}
