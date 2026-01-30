export const SiteRole = {
  USER: "USER",
  MOD: "MOD",
  ADMIN: "ADMIN",
} as const;

export const UserStatus = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  BANNED: "BANNED",
} as const;

export const AuthProvider = {
  DISCORD: "DISCORD",
  GITHUB: "GITHUB",
  GOOGLE: "GOOGLE",
} as const;

export const CompanyRole = {
  OWNER: "OWNER",
  CO_OWNER: "CO_OWNER",
  TRUSTED: "TRUSTED",
  MEMBER: "MEMBER",
} as const;

export const OwnerType = {
  USER: "USER",
  COMPANY: "COMPANY",
} as const;

export const ContentStatus = {
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export const ProjectStatus = {
  IN_PROGRESS: "IN_PROGRESS",
  RELEASED: "RELEASED",
  FROZEN: "FROZEN",
} as const;

export const ProjectUpdateType = {
  PROGRESS: "PROGRESS",
  RELEASE: "RELEASE",
  FIX: "FIX",
  ANNOUNCEMENT: "ANNOUNCEMENT",
} as const;

export const UpdateImportance = {
  MAJOR: "MAJOR",
  MINOR: "MINOR",
} as const;

export const UpdateStatus = {
  PUBLISHED: "PUBLISHED",
  PENDING: "PENDING",
  REJECTED: "REJECTED",
} as const;

export const ModerationTargetType = {
  COMPANY: "COMPANY",
  PROJECT: "PROJECT",
  POST: "POST",
} as const;

export const ModerationRequestStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export const InviteType = {
  COMPANY_MEMBERSHIP: "COMPANY_MEMBERSHIP",
  PROJECT_COLLAB: "PROJECT_COLLAB",
  PARTNERSHIP: "PARTNERSHIP",
} as const;

export const InviteStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED",
  CANCELED: "CANCELED",
} as const;

export const CompanyInviteRole = {
  MEMBER: "MEMBER",
  TRUSTED: "TRUSTED",
  CO_OWNER: "CO_OWNER",
} as const;

export const PartnershipStatus = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  ENDED: "ENDED",
} as const;

export const TicketCategory = {
  LAUNCHER: "LAUNCHER",
  SERVER: "SERVER",
  WEBSITE: "WEBSITE",
  REPORT: "REPORT",
  OTHER: "OTHER",
} as const;

export const TicketStatus = {
  OPEN: "OPEN",
  ANSWERED: "ANSWERED",
  CLOSED: "CLOSED",
} as const;

export const NotificationType = {
  MODERATION: "MODERATION",
  INVITE: "INVITE",
  TICKET: "TICKET",
  SYSTEM: "SYSTEM",
  ADMIN: "ADMIN",
} as const;

export const FileAssetScope = {
  COMPANY_LOGO: "COMPANY_LOGO",
  PROJECT_COVER: "PROJECT_COVER",
  POST_COVER: "POST_COVER",
} as const;

export type SiteRole = (typeof SiteRole)[keyof typeof SiteRole];
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];
export type CompanyRole = (typeof CompanyRole)[keyof typeof CompanyRole];
export type OwnerType = (typeof OwnerType)[keyof typeof OwnerType];
export type ContentStatus = (typeof ContentStatus)[keyof typeof ContentStatus];
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];
export type ProjectUpdateType =
  (typeof ProjectUpdateType)[keyof typeof ProjectUpdateType];
export type UpdateImportance =
  (typeof UpdateImportance)[keyof typeof UpdateImportance];
export type UpdateStatus = (typeof UpdateStatus)[keyof typeof UpdateStatus];
export type ModerationTargetType =
  (typeof ModerationTargetType)[keyof typeof ModerationTargetType];
export type ModerationRequestStatus =
  (typeof ModerationRequestStatus)[keyof typeof ModerationRequestStatus];
export type InviteType = (typeof InviteType)[keyof typeof InviteType];
export type InviteStatus = (typeof InviteStatus)[keyof typeof InviteStatus];
export type CompanyInviteRole =
  (typeof CompanyInviteRole)[keyof typeof CompanyInviteRole];
export type PartnershipStatus =
  (typeof PartnershipStatus)[keyof typeof PartnershipStatus];
export type TicketCategory =
  (typeof TicketCategory)[keyof typeof TicketCategory];
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];
export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];
export type FileAssetScope =
  (typeof FileAssetScope)[keyof typeof FileAssetScope];
