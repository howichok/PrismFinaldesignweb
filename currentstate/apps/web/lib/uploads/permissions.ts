import { FileAssetScope, OwnerType } from "@prisma/client";

import { apiError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { isCompanyEditor } from "@/lib/company/roles";
import { requireProjectOwnershipOrCompanyRole } from "@/lib/auth/permissions";

type AccessResult<T> = { data: T | null; response: Response | null };

export async function requireUploadAccess(params: {
  scope: FileAssetScope;
  entityId: string;
  userId: string;
}): Promise<AccessResult<{ id: string }>> {
  const { scope, entityId, userId } = params;

  if (scope === "COMPANY_LOGO") {
    const company = await prisma.company.findUnique({
      where: { id: entityId },
      select: { id: true, createdByUserId: true },
    });
    if (!company) {
      return { data: null, response: apiError(404, "NOT_FOUND", "Company not found.") };
    }
    if (company.createdByUserId === userId) {
      return { data: { id: company.id }, response: null };
    }
    const membership = await prisma.companyMembership.findUnique({
      where: {
        companyId_userId: {
          companyId: entityId,
          userId,
        },
      },
      select: { companyRole: true },
    });
    if (!membership || !isCompanyEditor(membership.companyRole)) {
      return {
        data: null,
        response: apiError(403, "FORBIDDEN", "Insufficient permissions."),
      };
    }
    return { data: { id: company.id }, response: null };
  }

  if (scope === "PROJECT_COVER") {
    const result = await requireProjectOwnershipOrCompanyRole({
      projectId: entityId,
      userId,
      companyRoles: ["TRUSTED", "CO_OWNER", "OWNER"],
    });
    if (result.response || !result.data) {
      return { data: null, response: result.response };
    }
    return { data: { id: result.data.id }, response: null };
  }

  if (scope === "POST_COVER") {
    const post = await prisma.post.findUnique({
      where: { id: entityId },
      select: { id: true, ownerType: true, ownerUserId: true, ownerCompanyId: true },
    });
    if (!post) {
      return { data: null, response: apiError(404, "NOT_FOUND", "Post not found.") };
    }
    if (post.ownerType === OwnerType.USER && post.ownerUserId === userId) {
      return { data: { id: post.id }, response: null };
    }
    if (post.ownerType === OwnerType.COMPANY && post.ownerCompanyId) {
      const membership = await prisma.companyMembership.findUnique({
        where: {
          companyId_userId: {
            companyId: post.ownerCompanyId,
            userId,
          },
        },
        select: { companyRole: true },
      });
      if (!membership || !isCompanyEditor(membership.companyRole)) {
        return {
          data: null,
          response: apiError(403, "FORBIDDEN", "Insufficient permissions."),
        };
      }
      return { data: { id: post.id }, response: null };
    }
    return { data: null, response: apiError(403, "FORBIDDEN", "Insufficient permissions.") };
  }

  return { data: null, response: apiError(400, "INVALID_SCOPE", "Invalid upload scope.") };
}
