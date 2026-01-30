import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/api";
import { apiError } from "@/lib/api/errors";
import { parseBody } from "@/lib/validation/request";
import { uploadPresignSchema } from "@/lib/validation/schemas";
import {
  SUPABASE_BUCKET,
  UPLOAD_MAX_BYTES,
  isAllowedMime,
} from "@/lib/uploads/config";
import { buildStoragePath } from "@/lib/uploads/paths";
import { getSupabaseAdmin } from "@/lib/uploads/supabase";
import { requireUploadAccess } from "@/lib/uploads/permissions";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await parseBody(request, uploadPresignSchema);
  if (error) return error;

  if (data.sizeBytes > UPLOAD_MAX_BYTES) {
    return apiError(400, "UPLOAD_TOO_LARGE", "File exceeds upload limit.");
  }
  if (!isAllowedMime(data.mimeType)) {
    return apiError(400, "INVALID_MIME", "Unsupported file type.");
  }

  const access = await requireUploadAccess({
    scope: data.scope,
    entityId: data.entityId,
    userId: auth.session!.userId,
  });
  if (access.response) return access.response;

  let storagePath: string;
  try {
    storagePath = buildStoragePath(data.scope, data.entityId, data.mimeType);
  } catch (err) {
    return apiError(
      400,
      "INVALID_MIME",
      err instanceof Error ? err.message : "Unsupported file type.",
    );
  }

  const { data: signedData, error: signedError } =
    await supabaseAdmin.storage
      .from(SUPABASE_BUCKET)
      .createSignedUploadUrl(storagePath);

  if (signedError || !signedData) {
    return apiError(500, "UPLOAD_PRESIGN_FAILED", "Unable to create upload URL.");
  }

  const { data: publicData } = supabaseAdmin.storage
    .from(SUPABASE_BUCKET)
    .getPublicUrl(storagePath);

  return NextResponse.json({
    storagePath,
    bucket: SUPABASE_BUCKET,
    token: signedData.token,
    signedUrl: signedData.signedUrl,
    publicUrl: publicData.publicUrl,
    expiresInHint: "2h",
  });
}
