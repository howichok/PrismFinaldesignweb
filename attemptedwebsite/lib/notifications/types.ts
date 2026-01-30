export type NotificationItem = {
  id: string;
  type: "MODERATION" | "INVITE" | "TICKET" | "SYSTEM" | "ADMIN";
  title: string;
  body: string;
  link: string;
  isRead: boolean;
  createdAt: string;
};
