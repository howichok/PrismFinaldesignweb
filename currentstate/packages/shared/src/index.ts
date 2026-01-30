import { z } from "zod";

// ============================================
// Enums
// ============================================

export const GlobalRole = z.enum(["ADMIN", "MOD", "USER"]);
export type GlobalRole = z.infer<typeof GlobalRole>;

export const CompanyRole = z.enum(["OWNER", "CO_OWNER", "TRUSTED", "MEMBER"]);
export type CompanyRole = z.infer<typeof CompanyRole>;

export const PublishingMode = z.enum([
  "OWNER_REVIEW",        // Members submit to company queue; OWNER/CO_OWNER approve
  "TRUSTED_AUTOPUBLISH", // TRUSTED+ publish directly; MEMBER goes to queue
  "DUAL_REVIEW",         // After company approval, requires global MOD/ADMIN approval
  "OPEN_AUTOPUBLISH"     // Everyone can publish directly
]);
export type PublishingMode = z.infer<typeof PublishingMode>;

export const JoinMode = z.enum(["INVITES_ONLY", "REQUEST_TO_JOIN", "OFF"]);
export type JoinMode = z.infer<typeof JoinMode>;

export const JoinMessageMode = z.enum(["OFF", "OPTIONAL", "REQUIRED"]);
export type JoinMessageMode = z.infer<typeof JoinMessageMode>;

export const JoinRequestStatus = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type JoinRequestStatus = z.infer<typeof JoinRequestStatus>;

export const TicketCategory = z.enum([
  "WEBSITE_BUG",
  "LAUNCHER",
  "ACCOUNT_ACCESS",
  "FEATURE_REQUEST",
  "OTHER"
]);
export type TicketCategory = z.infer<typeof TicketCategory>;

export const TicketStatus = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "WAITING_USER",
  "RESOLVED",
  "CLOSED"
]);
export type TicketStatus = z.infer<typeof TicketStatus>;

export const ContentStatus = z.enum([
  "DRAFT",
  "PENDING",
  "NEEDS_CHANGES",
  "REJECTED",
  "PUBLISHED",
  "WITHDRAWN"
]);
export type ContentStatus = z.infer<typeof ContentStatus>;

export const OwnershipType = z.enum(["PERSONAL", "COMPANY"]);
export type OwnershipType = z.infer<typeof OwnershipType>;

// ============================================
// User DTOs (for embedding in other DTOs)
// ============================================

/** Minimal user info for embedding in author/user fields across all DTOs */
export const UserMiniDTO = z.object({
  id: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  globalRole: GlobalRole
});
export type UserMiniDTO = z.infer<typeof UserMiniDTO>;

/** Public profile response */
export const UserPublicProfileDTO = z.object({
  user: UserMiniDTO,
  isBanned: z.boolean(),
  stats: z.object({
    publishedProjects: z.number(),
    publishedPosts: z.number(),
    companies: z.number()
  }),
  createdAt: z.string()
});
export type UserPublicProfileDTO = z.infer<typeof UserPublicProfileDTO>;

// ============================================
// Project DTOs
// ============================================

export const CreateProjectInput = z.object({
  title: z.string().min(1, "Title is required").max(120, "Title too long"),
  description: z.string().max(5000, "Description too long").optional().nullable(),
  type: z.string().min(1, "Type is required").max(50, "Type too long")
});
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

export const UpdateProjectInput = z.object({
  title: z.string().min(1, "Title is required").max(120, "Title too long").optional(),
  description: z.string().max(5000, "Description too long").optional().nullable(),
  type: z.string().min(1, "Type is required").max(50, "Type too long").optional()
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectInput>;

// Alias for backward compatibility
export const CreatePersonalProjectInput = CreateProjectInput;
export type CreatePersonalProjectInput = CreateProjectInput;

// Project response DTO
export const ProjectDTO = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  type: z.string(),
  ownership: OwnershipType,
  status: ContentStatus,
  authorId: z.string(),
  ownerUserId: z.string().nullable(),
  ownerCompanyId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Optional relations
  author: z.object({
    id: z.string(),
    username: z.string(),
    avatarUrl: z.string().nullable(),
    globalRole: GlobalRole
  }).optional(),
  ownerCompany: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string()
  }).optional().nullable(),
  moderation: z.object({
    id: z.string(),
    status: ContentStatus,
    reason: z.string().nullable(),
    checklistJson: z.any().nullable(),
    decidedAt: z.string().nullable()
  }).optional().nullable()
});
export type ProjectDTO = z.infer<typeof ProjectDTO>;

// ============================================
// Post DTOs
// ============================================

export const CreatePostInput = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  body: z.string().min(1, "Body is required").max(50000, "Body too long")
});
export type CreatePostInput = z.infer<typeof CreatePostInput>;

export const UpdatePostInput = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long").optional(),
  body: z.string().min(1, "Body is required").max(50000, "Body too long").optional()
});
export type UpdatePostInput = z.infer<typeof UpdatePostInput>;

// Post response DTO
export const PostDTO = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  ownership: OwnershipType,
  status: ContentStatus,
  authorId: z.string(),
  ownerUserId: z.string().nullable(),
  ownerCompanyId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Optional relations
  author: z.object({
    id: z.string(),
    username: z.string(),
    avatarUrl: z.string().nullable(),
    globalRole: GlobalRole
  }).optional(),
  ownerCompany: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string()
  }).optional().nullable(),
  moderation: z.object({
    id: z.string(),
    status: ContentStatus,
    reason: z.string().nullable(),
    checklistJson: z.any().nullable(),
    decidedAt: z.string().nullable()
  }).optional().nullable()
});
export type PostDTO = z.infer<typeof PostDTO>;

// ============================================
// Company DTOs
// ============================================

export const CreateCompanyInput = z.object({
  name: z.string().min(2, "Name too short").max(100, "Name too long"),
  slug: z.string().min(2, "Slug too short").max(50, "Slug too long")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  description: z.string().max(2000, "Description too long").optional()
});
export type CreateCompanyInput = z.infer<typeof CreateCompanyInput>;

export const UpdateCompanyInput = z.object({
  name: z.string().min(2, "Name too short").max(100, "Name too long").optional(),
  description: z.string().max(2000, "Description too long").optional().nullable(),
  publishingMode: PublishingMode.optional(),
  joinMode: JoinMode.optional(),
  joinMessageMode: JoinMessageMode.optional(),
  allowTrustedApproveJoinRequests: z.boolean().optional()
});
export type UpdateCompanyInput = z.infer<typeof UpdateCompanyInput>;

export const CompanyDTO = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  publishingMode: PublishingMode,
  joinMode: JoinMode,
  joinMessageMode: JoinMessageMode,
  allowTrustedApproveJoinRequests: z.boolean(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Optional relations
  createdBy: z.object({
    id: z.string(),
    username: z.string(),
    avatarUrl: z.string().nullable(),
    globalRole: GlobalRole
  }).optional(),
  memberCount: z.number().optional(),
  myRole: CompanyRole.optional().nullable()
});
export type CompanyDTO = z.infer<typeof CompanyDTO>;

export const CompanyMemberDTO = z.object({
  id: z.string(),
  companyId: z.string(),
  userId: z.string(),
  role: CompanyRole,
  createdAt: z.string(),
  user: z.object({
    id: z.string(),
    username: z.string(),
    avatarUrl: z.string().nullable(),
    globalRole: GlobalRole
  }).optional()
});
export type CompanyMemberDTO = z.infer<typeof CompanyMemberDTO>;

export const CompanyInviteDTO = z.object({
  id: z.string(),
  companyId: z.string(),
  invitedById: z.string(),
  invitedUserId: z.string().nullable(),
  invitedEmail: z.string().nullable(),
  role: CompanyRole,
  token: z.string().nullable(),
  expiresAt: z.string(),
  acceptedAt: z.string().nullable(),
  createdAt: z.string(),
  // Optional relations
  company: CompanyDTO.optional(),
  invitedBy: z.object({
    id: z.string(),
    username: z.string()
  }).optional(),
  invitedUser: z.object({
    id: z.string(),
    username: z.string()
  }).optional().nullable()
});
export type CompanyInviteDTO = z.infer<typeof CompanyInviteDTO>;

export const CreateInviteInput = z.object({
  userId: z.string().optional(),
  email: z.string().email().optional(),
  role: CompanyRole.default("MEMBER")
}).refine(data => data.userId || data.email, {
  message: "Either userId or email must be provided"
});
export type CreateInviteInput = z.infer<typeof CreateInviteInput>;

export const CompanyJoinRequestDTO = z.object({
  id: z.string(),
  companyId: z.string(),
  userId: z.string(),
  message: z.string().nullable(),
  status: JoinRequestStatus,
  decidedById: z.string().nullable(),
  decidedAt: z.string().nullable(),
  reason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Optional relations
  user: z.object({
    id: z.string(),
    username: z.string(),
    avatarUrl: z.string().nullable(),
    globalRole: GlobalRole
  }).optional(),
  decidedBy: z.object({
    id: z.string(),
    username: z.string()
  }).optional().nullable()
});
export type CompanyJoinRequestDTO = z.infer<typeof CompanyJoinRequestDTO>;

export const CreateJoinRequestInput = z.object({
  message: z.string().max(1000, "Message too long").optional()
});
export type CreateJoinRequestInput = z.infer<typeof CreateJoinRequestInput>;

export const UpdateMemberRoleInput = z.object({
  role: CompanyRole
});
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleInput>;

// Company role helpers
export const COMPANY_ROLE_HIERARCHY: Record<CompanyRole, number> = {
  OWNER: 4,
  CO_OWNER: 3,
  TRUSTED: 2,
  MEMBER: 1
};

/** Check if role1 has higher or equal permissions than role2 */
export function hasRolePermission(userRole: CompanyRole, requiredRole: CompanyRole): boolean {
  return COMPANY_ROLE_HIERARCHY[userRole] >= COMPANY_ROLE_HIERARCHY[requiredRole];
}

/** Check if user can manage the target role */
export function canManageRole(managerRole: CompanyRole, targetRole: CompanyRole): boolean {
  // Only OWNER can manage CO_OWNER
  if (targetRole === "CO_OWNER" || targetRole === "OWNER") {
    return managerRole === "OWNER";
  }
  // OWNER and CO_OWNER can manage TRUSTED and MEMBER
  return hasRolePermission(managerRole, "CO_OWNER");
}

/** Check if content auto-publishes based on publishing mode and role */
export function canAutoPublish(publishingMode: PublishingMode, role: CompanyRole): boolean {
  switch (publishingMode) {
    case "OPEN_AUTOPUBLISH":
      return true;
    case "TRUSTED_AUTOPUBLISH":
      return hasRolePermission(role, "TRUSTED");
    case "OWNER_REVIEW":
    case "DUAL_REVIEW":
      return false;
  }
}

/** Check if user can approve company content */
export function canApproveCompanyContent(role: CompanyRole): boolean {
  return hasRolePermission(role, "CO_OWNER");
}

// ============================================
// Ticket DTOs
// ============================================

export const CreateTicketInput = z.object({
  category: TicketCategory,
  title: z.string().min(5, "Title too short").max(200, "Title too long"),
  body: z.string().min(10, "Message too short").max(10000, "Message too long")
});
export type CreateTicketInput = z.infer<typeof CreateTicketInput>;

export const AddTicketMessageInput = z.object({
  body: z.string().min(1, "Message is required").max(10000, "Message too long")
});
export type AddTicketMessageInput = z.infer<typeof AddTicketMessageInput>;

export const UpdateTicketStatusInput = z.object({
  status: TicketStatus
});
export type UpdateTicketStatusInput = z.infer<typeof UpdateTicketStatusInput>;

export const AssignTicketInput = z.object({
  assignedToId: z.string().nullable()
});
export type AssignTicketInput = z.infer<typeof AssignTicketInput>;

export const ListTicketsQuery = z.object({
  status: TicketStatus.optional(),
  mineOnly: z.coerce.boolean().optional().default(true),
  assignedToMe: z.coerce.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20)
});
export type ListTicketsQuery = z.infer<typeof ListTicketsQuery>;

export const TicketMessageDTO = z.object({
  id: z.string(),
  ticketId: z.string(),
  authorId: z.string(),
  body: z.string(),
  createdAt: z.string(),
  author: z.object({
    id: z.string(),
    username: z.string(),
    avatarUrl: z.string().nullable(),
    globalRole: GlobalRole
  }).optional()
});
export type TicketMessageDTO = z.infer<typeof TicketMessageDTO>;

export const TicketDTO = z.object({
  id: z.string(),
  authorId: z.string(),
  category: TicketCategory,
  status: TicketStatus,
  title: z.string(),
  assignedToId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastMessageAt: z.string(),
  // Optional relations
  author: z.object({
    id: z.string(),
    username: z.string(),
    avatarUrl: z.string().nullable(),
    globalRole: GlobalRole
  }).optional(),
  assignedTo: z.object({
    id: z.string(),
    username: z.string(),
    avatarUrl: z.string().nullable(),
    globalRole: GlobalRole
  }).optional().nullable(),
  messages: z.array(TicketMessageDTO).optional(),
  messageCount: z.number().optional()
});
export type TicketDTO = z.infer<typeof TicketDTO>;

/** Check if a ticket status is considered "open" (can receive messages) */
export function isTicketOpen(status: TicketStatus): boolean {
  return status !== "CLOSED" && status !== "RESOLVED";
}

/** Get human-readable label for ticket category */
export function getTicketCategoryLabel(category: TicketCategory): string {
  const labels: Record<TicketCategory, string> = {
    WEBSITE_BUG: "Website Bug",
    LAUNCHER: "Launcher Issue",
    ACCOUNT_ACCESS: "Account Access",
    FEATURE_REQUEST: "Feature Request",
    OTHER: "Other"
  };
  return labels[category];
}

/** Get human-readable label for ticket status */
export function getTicketStatusLabel(status: TicketStatus): string {
  const labels: Record<TicketStatus, string> = {
    OPEN: "Open",
    IN_PROGRESS: "In Progress",
    WAITING_USER: "Waiting for User",
    RESOLVED: "Resolved",
    CLOSED: "Closed"
  };
  return labels[status];
}

// ============================================
// Moderation DTOs
// ============================================

export const ModerationDecisionInput = z.object({
  reason: z.string().max(2000).optional(),
  checklist: z.any().optional()
});
export type ModerationDecisionInput = z.infer<typeof ModerationDecisionInput>;

export const ModerationItemDTO = z.object({
  id: z.string(),
  subjectType: z.string(),
  projectId: z.string().nullable(),
  postId: z.string().nullable(),
  status: ContentStatus,
  scopeUserId: z.string().nullable(),
  scopeCompanyId: z.string().nullable(),
  isGlobalReview: z.boolean(),
  reason: z.string().nullable(),
  checklistJson: z.any().nullable(),
  decidedById: z.string().nullable(),
  decidedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Optional relations
  project: ProjectDTO.optional().nullable(),
  post: PostDTO.optional().nullable(),
  scopeCompany: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string()
  }).optional().nullable(),
  decidedBy: z.object({
    id: z.string(),
    username: z.string()
  }).optional().nullable()
});
export type ModerationItemDTO = z.infer<typeof ModerationItemDTO>;

// ============================================
// API Response Types
// ============================================

export const ApiError = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.any().optional()
});
export type ApiError = z.infer<typeof ApiError>;

export const PaginatedResponse = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    hasMore: z.boolean()
  });

// ============================================
// Admin DTOs
// ============================================

export const UserPermissionOverridesDTO = z.object({
  canCreateProjects: z.boolean(),
  canCreatePosts: z.boolean(),
  canCreateCompanies: z.boolean(),
  canPublishPersonalWithoutPremod: z.boolean(),
  canCreateCompanyWithoutPremod: z.boolean(),
  canPublishCompanyWithoutPremod: z.boolean()
});
export type UserPermissionOverridesDTO = z.infer<typeof UserPermissionOverridesDTO>;

export const UpdatePermissionOverridesInput = z.object({
  canCreateProjects: z.boolean().optional(),
  canCreatePosts: z.boolean().optional(),
  canCreateCompanies: z.boolean().optional(),
  canPublishPersonalWithoutPremod: z.boolean().optional(),
  canCreateCompanyWithoutPremod: z.boolean().optional(),
  canPublishCompanyWithoutPremod: z.boolean().optional()
});
export type UpdatePermissionOverridesInput = z.infer<typeof UpdatePermissionOverridesInput>;

export const AdminUserSearchQuery = z.object({
  q: z.string().min(1),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20)
});
export type AdminUserSearchQuery = z.infer<typeof AdminUserSearchQuery>;

export const AdminUserListItemDTO = z.object({
  id: z.string(),
  username: z.string(),
  discordId: z.string(),
  avatarUrl: z.string().nullable(),
  globalRole: GlobalRole,
  isBanned: z.boolean(),
  createdAt: z.string()
});
export type AdminUserListItemDTO = z.infer<typeof AdminUserListItemDTO>;

export const AdminUserDetailDTO = z.object({
  id: z.string(),
  username: z.string(),
  discordId: z.string(),
  avatarUrl: z.string().nullable(),
  globalRole: GlobalRole,
  rolesVersion: z.number(),
  isBanned: z.boolean(),
  bannedReason: z.string().nullable(),
  bannedAt: z.string().nullable(),
  bannedUntil: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Permission overrides
  overrides: UserPermissionOverridesDTO.nullable(),
  // Stats
  stats: z.object({
    projectCount: z.number(),
    postCount: z.number(),
    ticketCount: z.number(),
    companyCount: z.number()
  }),
  // Company memberships summary
  memberships: z.array(z.object({
    companyId: z.string(),
    companyName: z.string(),
    companySlug: z.string(),
    role: CompanyRole
  }))
});
export type AdminUserDetailDTO = z.infer<typeof AdminUserDetailDTO>;

export const UpdateUserInput = z.object({
  globalRole: GlobalRole.optional(),
  isBanned: z.boolean().optional(),
  bannedReason: z.string().max(500).optional().nullable(),
  bannedUntil: z.string().optional().nullable(),
  overrides: UpdatePermissionOverridesInput.optional()
});
export type UpdateUserInput = z.infer<typeof UpdateUserInput>;

export const AdminModerationScope = z.enum(["personal", "company", "global"]);
export type AdminModerationScope = z.infer<typeof AdminModerationScope>;

export const AdminModerationQuery = z.object({
  subject: z.enum(["PROJECT", "POST"]),
  status: ContentStatus.default("PENDING"),
  scope: AdminModerationScope.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20)
});
export type AdminModerationQuery = z.infer<typeof AdminModerationQuery>;

export const AdminModerationItemDTO = z.object({
  id: z.string(),
  subjectType: z.string(),
  status: ContentStatus,
  scopeUserId: z.string().nullable(),
  scopeCompanyId: z.string().nullable(),
  isGlobalReview: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Content info
  project: z.object({
    id: z.string(),
    title: z.string(),
    type: z.string(),
    ownership: OwnershipType
  }).optional().nullable(),
  post: z.object({
    id: z.string(),
    title: z.string(),
    ownership: OwnershipType
  }).optional().nullable(),
  // Author info
  author: z.object({
    id: z.string(),
    username: z.string()
  }).optional(),
  // Company info (if company-owned)
  company: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string()
  }).optional().nullable()
});
export type AdminModerationItemDTO = z.infer<typeof AdminModerationItemDTO>;

// ============================================
// Microsoft/Launcher Integration DTOs
// ============================================

export const MicrosoftLinkStatusDTO = z.object({
  linked: z.boolean(),
  gamertag: z.string().optional(),
  mcUuid: z.string().optional(),
  mcName: z.string().optional(),
  hasMinecraftEntitlement: z.boolean().optional(),
  verifiedAt: z.string().optional(),
  linkedAt: z.string().optional()
});
export type MicrosoftLinkStatusDTO = z.infer<typeof MicrosoftLinkStatusDTO>;

export const LauncherSessionDTO = z.object({
  id: z.string(),
  deviceName: z.string().nullable(),
  createdAt: z.string(),
  lastSeenAt: z.string(),
  expiresAt: z.string()
});
export type LauncherSessionDTO = z.infer<typeof LauncherSessionDTO>;

export const LauncherLoginCodeResponse = z.object({
  code: z.string(),
  expiresAt: z.string(),
  expiresIn: z.number()
});
export type LauncherLoginCodeResponse = z.infer<typeof LauncherLoginCodeResponse>;

export const LauncherExchangeInput = z.object({
  code: z.string().min(1),
  deviceName: z.string().max(100).optional()
});
export type LauncherExchangeInput = z.infer<typeof LauncherExchangeInput>;

export const LauncherExchangeResponse = z.object({
  launcherToken: z.string(),
  expiresAt: z.string(),
  user: z.object({
    id: z.string(),
    username: z.string(),
    avatarUrl: z.string().nullable(),
    globalRole: GlobalRole,
    mcUuid: z.string().nullable(),
    mcName: z.string().nullable(),
    hasMinecraftEntitlement: z.boolean()
  })
});
export type LauncherExchangeResponse = z.infer<typeof LauncherExchangeResponse>;

export const LauncherMeResponse = z.object({
  user: z.object({
    id: z.string(),
    username: z.string(),
    avatarUrl: z.string().nullable(),
    globalRole: GlobalRole,
    mcUuid: z.string().nullable(),
    mcName: z.string().nullable(),
    hasMinecraftEntitlement: z.boolean()
  }),
  session: z.object({
    id: z.string(),
    createdAt: z.string(),
    expiresAt: z.string(),
    deviceName: z.string().nullable()
  })
});
export type LauncherMeResponse = z.infer<typeof LauncherMeResponse>;

// ============================================
// Status Transition Helpers
// ============================================

/** Statuses where the project is editable by the owner */
export const EDITABLE_STATUSES: ContentStatus[] = ["DRAFT", "NEEDS_CHANGES"];

/** Statuses that appear in the submissions view */
export const SUBMISSION_STATUSES: ContentStatus[] = ["PENDING", "NEEDS_CHANGES", "REJECTED"];

/** Statuses that can be submitted to moderation */
export const SUBMITTABLE_STATUSES: ContentStatus[] = ["DRAFT", "NEEDS_CHANGES"];

/** Check if a status is editable */
export function isEditable(status: ContentStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

/** Check if a status can be submitted */
export function canSubmit(status: ContentStatus): boolean {
  return SUBMITTABLE_STATUSES.includes(status);
}

/** Check if a status can be withdrawn */
export function canWithdraw(status: ContentStatus): boolean {
  return status === "PENDING";
}

// ============================================
// Notification Types
// ============================================

export const NotificationType = z.enum([
  // Project moderation decisions
  "MODERATION_PROJECT_APPROVED",
  "MODERATION_PROJECT_NEEDS_CHANGES",
  "MODERATION_PROJECT_REJECTED",
  // Post moderation decisions
  "MODERATION_POST_APPROVED",
  "MODERATION_POST_NEEDS_CHANGES",
  "MODERATION_POST_REJECTED",
  // Company invites
  "COMPANY_INVITE_RECEIVED",
  "COMPANY_INVITE_ACCEPTED",
  // Company join requests
  "COMPANY_JOIN_REQUEST_RECEIVED",
  "COMPANY_JOIN_REQUEST_APPROVED",
  "COMPANY_JOIN_REQUEST_REJECTED",
  // Company membership
  "COMPANY_ROLE_CHANGED",
  "COMPANY_MEMBER_REMOVED",
  // Company content moderation (for company queue)
  "COMPANY_CONTENT_APPROVED",
  "COMPANY_CONTENT_NEEDS_CHANGES",
  "COMPANY_CONTENT_REJECTED",
  // System events
  "SYSTEM_SESSION_INVALIDATED",
  // Tickets
  "TICKET_CREATED",
  "TICKET_NEW_MESSAGE",
  "TICKET_STATUS_UPDATED",
  "TICKET_ASSIGNED",
  // Admin actions
  "ADMIN_PERMISSIONS_CHANGED",
  "ADMIN_ROLE_CHANGED",
  "ADMIN_USER_BANNED",
  "ADMIN_USER_UNBANNED"
]);
export type NotificationType = z.infer<typeof NotificationType>;

// ============================================
// Notification DTOs
// ============================================

export const NotificationPayload = z.object({
  // Common fields
  title: z.string().optional(),
  message: z.string().optional(),
  link: z.string().optional(),
  // Project moderation-specific
  projectId: z.string().optional(),
  projectTitle: z.string().optional(),
  // Post moderation-specific
  postId: z.string().optional(),
  postTitle: z.string().optional(),
  // Common moderation fields
  moderatorId: z.string().optional(),
  moderatorUsername: z.string().optional(),
  reason: z.string().optional(),
  checklist: z.any().optional(),
  // Company-specific fields
  companyId: z.string().optional(),
  companyName: z.string().optional(),
  companySlug: z.string().optional(),
  inviterId: z.string().optional(),
  inviterUsername: z.string().optional(),
  newRole: z.string().optional(),
  oldRole: z.string().optional(),
  contentType: z.string().optional(), // "PROJECT" | "POST"
  // Ticket-specific fields
  ticketId: z.string().optional(),
  ticketTitle: z.string().optional(),
  ticketStatus: z.string().optional(),
  actorId: z.string().optional(),
  actorUsername: z.string().optional()
}).passthrough(); // Allow additional fields
export type NotificationPayload = z.infer<typeof NotificationPayload>;

export const NotificationDTO = z.object({
  id: z.string(),
  type: z.string(),
  payload: NotificationPayload.nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string()
});
export type NotificationDTO = z.infer<typeof NotificationDTO>;

export const ListNotificationsQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  unreadOnly: z.coerce.boolean().optional()
});
export type ListNotificationsQuery = z.infer<typeof ListNotificationsQuery>;

export const NotificationListResponse = z.object({
  items: z.array(NotificationDTO),
  total: z.number(),
  unread: z.number(),
  nextCursor: z.string().nullable()
});
export type NotificationListResponse = z.infer<typeof NotificationListResponse>;

export const UnreadCountDTO = z.object({
  unread: z.number()
});
export type UnreadCountDTO = z.infer<typeof UnreadCountDTO>;

// ============================================
// Event Log Types
// ============================================

export const EventLogDTO = z.object({
  id: z.string(),
  type: z.string(),
  actorUserId: z.string().nullable(),
  targetUserId: z.string().nullable(),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  payload: z.any().nullable(),
  createdAt: z.string()
});
export type EventLogDTO = z.infer<typeof EventLogDTO>;

// ============================================
// Notification Helpers
// ============================================

/** Get human-readable title for a notification type */
export function getNotificationTitle(type: string): string {
  const titles: Record<string, string> = {
    MODERATION_PROJECT_APPROVED: "Project Approved",
    MODERATION_PROJECT_NEEDS_CHANGES: "Project: Changes Requested",
    MODERATION_PROJECT_REJECTED: "Project Rejected",
    MODERATION_POST_APPROVED: "Post Approved",
    MODERATION_POST_NEEDS_CHANGES: "Post: Changes Requested",
    MODERATION_POST_REJECTED: "Post Rejected",
    COMPANY_INVITE_RECEIVED: "Company Invitation",
    COMPANY_INVITE_ACCEPTED: "Invite Accepted",
    COMPANY_JOIN_REQUEST_RECEIVED: "Join Request",
    COMPANY_JOIN_REQUEST_APPROVED: "Join Request Approved",
    COMPANY_JOIN_REQUEST_REJECTED: "Join Request Rejected",
    COMPANY_ROLE_CHANGED: "Role Changed",
    COMPANY_MEMBER_REMOVED: "Removed from Company",
    COMPANY_CONTENT_APPROVED: "Content Approved",
    COMPANY_CONTENT_NEEDS_CHANGES: "Content: Changes Requested",
    COMPANY_CONTENT_REJECTED: "Content Rejected",
    SYSTEM_SESSION_INVALIDATED: "Session Ended",
    TICKET_CREATED: "New Ticket",
    TICKET_NEW_MESSAGE: "New Ticket Reply",
    TICKET_STATUS_UPDATED: "Ticket Status Updated",
    TICKET_ASSIGNED: "Ticket Assigned",
    ADMIN_PERMISSIONS_CHANGED: "Permissions Updated",
    ADMIN_ROLE_CHANGED: "Role Updated",
    ADMIN_USER_BANNED: "Account Restricted",
    ADMIN_USER_UNBANNED: "Account Restored"
  };
  return titles[type] || type;
}

/** Get icon/color class for a notification type */
export function getNotificationStyle(type: string): { color: string; bgColor: string } {
  const styles: Record<string, { color: string; bgColor: string }> = {
    MODERATION_PROJECT_APPROVED: { color: "#155724", bgColor: "#d4edda" },
    MODERATION_PROJECT_NEEDS_CHANGES: { color: "#856404", bgColor: "#fff3cd" },
    MODERATION_PROJECT_REJECTED: { color: "#721c24", bgColor: "#f8d7da" },
    MODERATION_POST_APPROVED: { color: "#155724", bgColor: "#d4edda" },
    MODERATION_POST_NEEDS_CHANGES: { color: "#856404", bgColor: "#fff3cd" },
    MODERATION_POST_REJECTED: { color: "#721c24", bgColor: "#f8d7da" },
    COMPANY_INVITE_RECEIVED: { color: "#004085", bgColor: "#cce5ff" },
    COMPANY_INVITE_ACCEPTED: { color: "#155724", bgColor: "#d4edda" },
    COMPANY_JOIN_REQUEST_RECEIVED: { color: "#004085", bgColor: "#cce5ff" },
    COMPANY_JOIN_REQUEST_APPROVED: { color: "#155724", bgColor: "#d4edda" },
    COMPANY_JOIN_REQUEST_REJECTED: { color: "#721c24", bgColor: "#f8d7da" },
    COMPANY_ROLE_CHANGED: { color: "#856404", bgColor: "#fff3cd" },
    COMPANY_MEMBER_REMOVED: { color: "#721c24", bgColor: "#f8d7da" },
    COMPANY_CONTENT_APPROVED: { color: "#155724", bgColor: "#d4edda" },
    COMPANY_CONTENT_NEEDS_CHANGES: { color: "#856404", bgColor: "#fff3cd" },
    COMPANY_CONTENT_REJECTED: { color: "#721c24", bgColor: "#f8d7da" },
    SYSTEM_SESSION_INVALIDATED: { color: "#383d41", bgColor: "#e2e3e5" },
    TICKET_CREATED: { color: "#004085", bgColor: "#cce5ff" },
    TICKET_NEW_MESSAGE: { color: "#004085", bgColor: "#cce5ff" },
    TICKET_STATUS_UPDATED: { color: "#856404", bgColor: "#fff3cd" },
    TICKET_ASSIGNED: { color: "#004085", bgColor: "#cce5ff" },
    ADMIN_PERMISSIONS_CHANGED: { color: "#856404", bgColor: "#fff3cd" },
    ADMIN_ROLE_CHANGED: { color: "#856404", bgColor: "#fff3cd" },
    ADMIN_USER_BANNED: { color: "#721c24", bgColor: "#f8d7da" },
    ADMIN_USER_UNBANNED: { color: "#155724", bgColor: "#d4edda" }
  };
  return styles[type] || { color: "#333", bgColor: "#f0f0f0" };
}
