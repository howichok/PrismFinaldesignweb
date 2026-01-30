import { z } from "zod";

const trimmedString = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`);

export const postCreateSchema = z.object({
  title: trimmedString(1, 120, "Title"),
  content: trimmedString(1, 10000, "Content"),
  tags: z.string().trim().optional().default(""),
  intent: z.enum(["draft", "submit", "publish"]).optional(),
});

export const postUpdateSchema = z.object({
  title: trimmedString(1, 120, "Title"),
  content: trimmedString(1, 10000, "Content"),
  tags: z.string().trim().optional().default(""),
  intent: z.enum(["draft", "submit", "publish", "save"]).optional(),
});

export const projectCreateSchema = z.object({
  name: trimmedString(1, 120, "Name"),
  description: trimmedString(1, 5000, "Description"),
  tags: z.string().trim().optional().default(""),
  projectStatus: z.enum(["IN_PROGRESS", "RELEASED", "FROZEN"]),
  intent: z.enum(["draft", "submit", "publish"]).optional(),
});

export const projectUpdateSchema = z.object({
  name: trimmedString(1, 120, "Name"),
  description: trimmedString(1, 5000, "Description"),
  tags: z.string().trim().optional().default(""),
  projectStatus: z.enum(["IN_PROGRESS", "RELEASED", "FROZEN"]),
  intent: z.enum(["draft", "submit", "publish", "save"]).optional(),
});

export const companyCreateSchema = z.object({
  name: trimmedString(1, 120, "Name"),
  description: trimmedString(1, 5000, "Description"),
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
  categories: z.array(z.string().trim().min(1)).min(1),
  intent: z.enum(["draft", "submit", "publish"]).optional(),
});

export const companyUpdateSchema = z.object({
  name: trimmedString(1, 120, "Name"),
  description: trimmedString(1, 5000, "Description"),
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
  categories: z.array(z.string().trim().min(1)).min(1),
  intent: z.enum(["draft", "submit", "publish", "save"]).optional(),
});

export const updateCreateSchema = z.object({
  title: trimmedString(1, 120, "Title"),
  summary: trimmedString(1, 300, "Summary"),
  details: z.string().trim().max(5000).optional().or(z.literal("")),
  updateType: z.enum(["PROGRESS", "RELEASE", "FIX", "ANNOUNCEMENT"]),
  importance: z.enum(["MAJOR", "MINOR"]),
});

export const updateEditSchema = updateCreateSchema;
export const companyUpdateEditSchema = updateCreateSchema.extend({
  intent: z.enum(["resubmit"]).optional(),
});

export const ticketCreateSchema = z.object({
  category: z.enum(["LAUNCHER", "SERVER", "WEBSITE", "REPORT", "OTHER"]),
  subject: trimmedString(1, 120, "Subject"),
  message: trimmedString(1, 5000, "Message"),
});

export const ticketMessageSchema = z.object({
  message: trimmedString(1, 5000, "Message"),
});

export const inviteCompanySchema = z.object({
  toUserId: z.string().uuid(),
  offeredRole: z.enum(["MEMBER", "TRUSTED", "CO_OWNER"]),
});

export const collabInviteSchema = z.object({
  toCompanyId: z.string().uuid(),
});

export const partnershipInviteSchema = z.object({
  toCompanyId: z.string().uuid(),
});

export const adminRoleSchema = z.object({
  siteRole: z.enum(["USER", "MOD", "ADMIN"]),
});

export const adminStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]),
});

export const rejectSchema = z.object({
  reason: trimmedString(1, 300, "Reason"),
});

export const notificationMarkReadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

const uploadScopeSchema = z.enum([
  "COMPANY_LOGO",
  "PROJECT_COVER",
  "POST_COVER",
]);

export const uploadPresignSchema = z.object({
  scope: uploadScopeSchema,
  entityId: z.string().uuid(),
  filename: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  sizeBytes: z.number().int().positive(),
});

export const uploadConfirmSchema = z.object({
  scope: uploadScopeSchema,
  entityId: z.string().uuid(),
  storagePath: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  sizeBytes: z.number().int().positive(),
  publicUrl: z.string().url(),
});
