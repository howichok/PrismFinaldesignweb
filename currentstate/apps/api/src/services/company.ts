import { prisma, type Prisma, type CompanyRole } from "@prismmtr/db";
import { bumpRolesVersion } from "./session.js";

// ============================================
// Company Member Queries
// ============================================

export interface CompanyMembershipResult {
  companyId: string;
  role: CompanyRole;
}

/**
 * Get a user's membership in a specific company
 */
export async function getUserCompanyMembership(
  userId: string,
  companyId: string
): Promise<CompanyMembershipResult | null> {
  const member = await prisma.companyMember.findUnique({
    where: {
      companyId_userId: { companyId, userId }
    },
    select: { companyId: true, role: true }
  });

  return member;
}

/**
 * Check if user has at least the required role in a company
 */
export async function hasCompanyRole(
  userId: string,
  companyId: string,
  requiredRole: CompanyRole
): Promise<boolean> {
  const member = await getUserCompanyMembership(userId, companyId);
  if (!member) return false;

  const hierarchy: Record<CompanyRole, number> = {
    OWNER: 4,
    CO_OWNER: 3,
    TRUSTED: 2,
    MEMBER: 1
  };

  return hierarchy[member.role] >= hierarchy[requiredRole];
}

/**
 * Get all approvers for a company (for join requests)
 */
export async function getCompanyApprovers(companyId: string): Promise<string[]> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { allowTrustedApproveJoinRequests: true }
  });

  if (!company) return [];

  const roles: CompanyRole[] = company.allowTrustedApproveJoinRequests
    ? ["OWNER", "CO_OWNER", "TRUSTED"]
    : ["OWNER", "CO_OWNER"];

  const members = await prisma.companyMember.findMany({
    where: {
      companyId,
      role: { in: roles }
    },
    select: { userId: true }
  });

  return members.map(m => m.userId);
}

/**
 * Get company owner
 */
export async function getCompanyOwner(companyId: string): Promise<string | null> {
  const owner = await prisma.companyMember.findFirst({
    where: { companyId, role: "OWNER" },
    select: { userId: true }
  });
  return owner?.userId ?? null;
}

/**
 * Count co-owners in a company
 */
export async function countCoOwners(companyId: string): Promise<number> {
  return prisma.companyMember.count({
    where: { companyId, role: "CO_OWNER" }
  });
}

// ============================================
// Company Member Management
// ============================================

/**
 * Add a member to a company with the specified role.
 * Bumps the user's rolesVersion to invalidate existing sessions.
 */
export async function addCompanyMember(
  companyId: string,
  userId: string,
  role: CompanyRole,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? prisma;

  // Create the membership
  await client.companyMember.create({
    data: {
      companyId,
      userId,
      role
    }
  });

  // Bump user's rolesVersion to reflect new permissions
  await bumpRolesVersion(userId, `joined_company_${companyId}`);
}

/**
 * Change a member's role in a company.
 * Validates constraints (1 owner, max 5 co-owners).
 * Bumps the user's rolesVersion.
 */
export async function changeCompanyMemberRole(
  companyId: string,
  userId: string,
  newRole: CompanyRole,
  tx?: Prisma.TransactionClient
): Promise<{ success: boolean; error?: string }> {
  const client = tx ?? prisma;

  // Get current membership
  const member = await client.companyMember.findUnique({
    where: { companyId_userId: { companyId, userId } }
  });

  if (!member) {
    return { success: false, error: "Member not found" };
  }

  const oldRole = member.role;

  // Cannot change owner role this way - must transfer ownership
  if (oldRole === "OWNER" && newRole !== "OWNER") {
    return { success: false, error: "Cannot demote owner. Transfer ownership first." };
  }

  // Cannot promote to owner this way - must transfer ownership
  if (newRole === "OWNER" && oldRole !== "OWNER") {
    return { success: false, error: "Cannot promote to owner. Use transfer ownership." };
  }

  // Check co-owner limit
  if (newRole === "CO_OWNER" && oldRole !== "CO_OWNER") {
    const coOwnerCount = await countCoOwners(companyId);
    if (coOwnerCount >= 5) {
      return { success: false, error: "Maximum 5 co-owners allowed" };
    }
  }

  // Update role
  await client.companyMember.update({
    where: { companyId_userId: { companyId, userId } },
    data: { role: newRole }
  });

  // Bump user's rolesVersion
  await bumpRolesVersion(userId, `role_changed_in_company_${companyId}`);

  return { success: true };
}

/**
 * Transfer ownership from current owner to another member.
 * The current owner is demoted to CO_OWNER.
 */
export async function transferCompanyOwnership(
  companyId: string,
  currentOwnerId: string,
  newOwnerId: string,
  tx?: Prisma.TransactionClient
): Promise<{ success: boolean; error?: string }> {
  const client = tx ?? prisma;

  // Verify current owner
  const currentOwner = await client.companyMember.findUnique({
    where: { companyId_userId: { companyId, userId: currentOwnerId } }
  });

  if (!currentOwner || currentOwner.role !== "OWNER") {
    return { success: false, error: "You are not the owner" };
  }

  // Verify new owner is a member
  const newOwner = await client.companyMember.findUnique({
    where: { companyId_userId: { companyId, userId: newOwnerId } }
  });

  if (!newOwner) {
    return { success: false, error: "Target user is not a member" };
  }

  // Check co-owner limit (current owner will become CO_OWNER)
  if (newOwner.role !== "CO_OWNER") {
    const coOwnerCount = await countCoOwners(companyId);
    if (coOwnerCount >= 5) {
      return { success: false, error: "Cannot transfer: would exceed 5 co-owners" };
    }
  }

  // Transfer ownership
  await client.companyMember.update({
    where: { companyId_userId: { companyId, userId: currentOwnerId } },
    data: { role: "CO_OWNER" }
  });

  await client.companyMember.update({
    where: { companyId_userId: { companyId, userId: newOwnerId } },
    data: { role: "OWNER" }
  });

  // Bump both users' rolesVersion
  await bumpRolesVersion(currentOwnerId, `ownership_transferred_from_${companyId}`);
  await bumpRolesVersion(newOwnerId, `ownership_received_${companyId}`);

  return { success: true };
}

/**
 * Remove a member from a company.
 * Bumps the user's rolesVersion.
 */
export async function removeCompanyMember(
  companyId: string,
  userId: string,
  tx?: Prisma.TransactionClient
): Promise<{ success: boolean; error?: string }> {
  const client = tx ?? prisma;

  const member = await client.companyMember.findUnique({
    where: { companyId_userId: { companyId, userId } }
  });

  if (!member) {
    return { success: false, error: "Member not found" };
  }

  // Cannot remove owner
  if (member.role === "OWNER") {
    return { success: false, error: "Cannot remove owner. Transfer ownership first." };
  }

  // Delete membership
  await client.companyMember.delete({
    where: { companyId_userId: { companyId, userId } }
  });

  // Bump user's rolesVersion
  await bumpRolesVersion(userId, `removed_from_company_${companyId}`);

  return { success: true };
}

// ============================================
// Company Content Publishing Rules
// ============================================

export type PublishingMode = "OWNER_REVIEW" | "TRUSTED_AUTOPUBLISH" | "DUAL_REVIEW" | "OPEN_AUTOPUBLISH";

/**
 * Determine if content should auto-publish based on company settings and author role.
 */
export function shouldAutoPublish(publishingMode: PublishingMode, authorRole: CompanyRole): boolean {
  switch (publishingMode) {
    case "OPEN_AUTOPUBLISH":
      return true;
    case "TRUSTED_AUTOPUBLISH":
      return authorRole === "OWNER" || authorRole === "CO_OWNER" || authorRole === "TRUSTED";
    case "OWNER_REVIEW":
    case "DUAL_REVIEW":
      return false;
    default:
      return false;
  }
}

/**
 * Determine if user can approve company content (company-level approval).
 */
export function canApproveCompanyContent(role: CompanyRole): boolean {
  return role === "OWNER" || role === "CO_OWNER";
}

/**
 * Check if dual review is required (content needs global MOD/ADMIN approval after company approval).
 */
export function requiresDualReview(publishingMode: PublishingMode): boolean {
  return publishingMode === "DUAL_REVIEW";
}
