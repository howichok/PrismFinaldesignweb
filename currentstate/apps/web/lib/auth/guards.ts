export function isModOrAdmin(siteRole?: string | null) {
  return siteRole === "MOD" || siteRole === "ADMIN";
}

export function isAdmin(siteRole?: string | null) {
  return siteRole === "ADMIN";
}
