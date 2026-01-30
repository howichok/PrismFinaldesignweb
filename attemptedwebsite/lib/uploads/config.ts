import "server-only";

export const SUPABASE_BUCKET = "assets";
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const UPLOAD_ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
];

export function isAllowedMime(mimeType: string) {
  return UPLOAD_ALLOWED_MIME.includes(mimeType);
}
