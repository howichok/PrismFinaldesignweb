import type { CompanyRole } from "@prisma/client";

export type CompanyRoleValue = CompanyRole;

export const companyRoleLabels: Record<CompanyRoleValue, string> = {
  OWNER: "Owner",
  CO_OWNER: "Co-owner",
  TRUSTED: "Trusted",
  MEMBER: "Member",
};

export function isCompanyEditor(role?: CompanyRoleValue | null) {
  return role === "OWNER" || role === "CO_OWNER" || role === "TRUSTED";
}

export function isCompanyReviewer(role?: CompanyRoleValue | null) {
  return role === "OWNER" || role === "CO_OWNER" || role === "TRUSTED";
}

export function isCompanyOwner(role?: CompanyRoleValue | null) {
  return role === "OWNER" || role === "CO_OWNER";
}

export function isCompanyManager(role?: CompanyRoleValue | null) {
  return role === "OWNER" || role === "CO_OWNER";
}

export function canAssignCoOwner(role?: CompanyRoleValue | null) {
  return role === "OWNER";
}
