import { FileAssetScope } from "@prisma/client";

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function getExtensionForMime(mimeType: string) {
  return EXTENSIONS[mimeType];
}

export function getScopePrefix(scope: FileAssetScope, entityId: string) {
  switch (scope) {
    case "COMPANY_LOGO":
      return `company-logos/${entityId}`;
    case "PROJECT_COVER":
      return `project-covers/${entityId}`;
    case "POST_COVER":
      return `post-covers/${entityId}`;
    default:
      return "";
  }
}

export function buildStoragePath(
  scope: FileAssetScope,
  entityId: string,
  mimeType: string,
) {
  const ext = getExtensionForMime(mimeType);
  if (!ext) {
    throw new Error("Unsupported file type.");
  }
  const prefix = getScopePrefix(scope, entityId);
  const filename = `${crypto.randomUUID()}.${ext}`;
  return `${prefix}/${filename}`;
}

export function isPathForScope(
  scope: FileAssetScope,
  entityId: string,
  storagePath: string,
) {
  const prefix = `${getScopePrefix(scope, entityId)}/`;
  return storagePath.startsWith(prefix);
}
