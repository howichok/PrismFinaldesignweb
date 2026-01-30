import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/api";
import { apiError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { parseBody } from "@/lib/validation/request";
import { uploadConfirmSchema } from "@/lib/validation/schemas";
import {
  SUPABASE_BUCKET,
  UPLOAD_MAX_BYTES,
  isAllowedMime,
} from "@/lib/uploads/config";
import { getExtensionForMime, isPathForScope } from "@/lib/uploads/paths";
import { getSupabaseAdmin } from "@/lib/uploads/supabase";
import { requireUploadAccess } from "@/lib/uploads/permissions";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await parseBody(request, uploadConfirmSchema);
  if (error) return error;

  if (data.sizeBytes > UPLOAD_MAX_BYTES) {
    return apiError(400, "UPLOAD_TOO_LARGE", "File exceeds upload limit.");
  }
  if (!isAllowedMime(data.mimeType)) {
    return apiError(400, "INVALID_MIME", "Unsupported file type.");
  }

  if (!isPathForScope(data.scope, data.entityId, data.storagePath)) {
    return apiError(400, "INVALID_PATH", "Storage path does not match scope.");
  }

  const expectedExt = getExtensionForMime(data.mimeType);
  if (!expectedExt || !data.storagePath.endsWith(`.${expectedExt}`)) {
    return apiError(400, "INVALID_PATH", "Storage path extension mismatch.");
  }

  const access = await requireUploadAccess({
    scope: data.scope,
    entityId: data.entityId,
    userId: auth.session!.userId,
  });
  if (access.response) return access.response;

  const { data: publicData } = supabaseAdmin.storage
    .from(SUPABASE_BUCKET)
    .getPublicUrl(data.storagePath);

  const result = await prisma.$transaction(async (tx) => {
    const asset = await tx.fileAsset.create({
      data: {
        scope: data.scope,
        storageBucket: SUPABASE_BUCKET,
        storagePath: data.storagePath,
        publicUrl: publicData.publicUrl,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        uploadedByUserId: auth.session!.userId,
      },
    });

    if (data.scope === "COMPANY_LOGO") {
      const company = await tx.company.update({
        where: { id: data.entityId },
        data: { logoAssetId: asset.id },
        select: { id: true, logoAssetId: true },
      });
      return { asset, entity: company };
    }

    if (data.scope === "PROJECT_COVER") {
      const project = await tx.project.update({
        where: { id: data.entityId },
        data: { coverAssetId: asset.id },
        select: { id: true, coverAssetId: true },
      });
      return { asset, entity: project };
    }

    const post = await tx.post.update({
      where: { id: data.entityId },
      data: { coverAssetId: asset.id },
      select: { id: true, coverAssetId: true },
    });
    return { asset, entity: post };
  });

  return NextResponse.json(result);
}
