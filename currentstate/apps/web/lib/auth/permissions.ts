import { CompanyRole } from "@prisma/client";

import { apiError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";

type PermissionResult<T> = {
  data: T | null;
  response: Response | null;
};

export async function requireCompanyMembership(params: {
  companyId: string;
  userId: string;
}) {
  const membership = await prisma.companyMembership.findUnique({
    where: {
      companyId_userId: {
        companyId: params.companyId,
        userId: params.userId,
      },
    },
    select: {
      companyRole: true,
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!membership) {
    return {
      data: null,
      response: apiError(403, "FORBIDDEN", "Access denied."),
    } satisfies PermissionResult<typeof membership>;
  }

  return { data: membership, response: null } satisfies PermissionResult<
    typeof membership
  >;
}

export async function requireCompanyRole(params: {
  companyId: string;
  userId: string;
  roles: CompanyRole[];
}) {
  const { data, response } = await requireCompanyMembership({
    companyId: params.companyId,
    userId: params.userId,
  });

  if (response || !data) {
    return { data: null, response };
  }

  if (!params.roles.includes(data.companyRole)) {
    return {
      data,
      response: apiError(403, "FORBIDDEN", "Insufficient permissions."),
    } satisfies PermissionResult<typeof data>;
  }

  return { data, response: null } satisfies PermissionResult<typeof data>;
}

export async function requireProjectOwnershipOrCompanyRole(params: {
  projectId: string;
  userId: string;
  companyRoles?: CompanyRole[];
}) {
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: {
      id: true,
      ownerUserId: true,
      ownerCompanyId: true,
      ownerType: true,
    },
  });

  if (!project) {
    return {
      data: null,
      response: apiError(404, "NOT_FOUND", "Project not found."),
    } satisfies PermissionResult<typeof project>;
  }

  // User-owned project
  if (project.ownerType === "USER" && project.ownerUserId === params.userId) {
    return { data: project, response: null } satisfies PermissionResult<
      typeof project
    >;
  }

  // Company-owned project - check membership and role
  if (
    project.ownerType === "COMPANY" &&
    project.ownerCompanyId &&
    params.companyRoles
  ) {
    const membership = await prisma.companyMembership.findUnique({
      where: {
        companyId_userId: {
          companyId: project.ownerCompanyId,
          userId: params.userId,
        },
      },
      select: { companyRole: true },
    });

    if (!membership || !params.companyRoles.includes(membership.companyRole)) {
      return {
        data: null,
        response: apiError(403, "FORBIDDEN", "Insufficient permissions."),
      } satisfies PermissionResult<typeof project>;
    }

    return { data: project, response: null } satisfies PermissionResult<
      typeof project
    >;
  }

  return {
    data: null,
    response: apiError(403, "FORBIDDEN", "Access denied."),
  } satisfies PermissionResult<typeof project>;
}
