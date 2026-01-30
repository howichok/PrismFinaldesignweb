export type SessionData = {
  userId: string;
  discordId: string;
  displayName: string;
  avatarUrl: string | null;
  siteRole: "USER" | "MOD" | "ADMIN";
  rolesVersion: number;
  createdAt: string;
  expiresAt: string;
};

export type SessionUser = Pick<
  SessionData,
  "userId" | "displayName" | "avatarUrl" | "siteRole"
>;
