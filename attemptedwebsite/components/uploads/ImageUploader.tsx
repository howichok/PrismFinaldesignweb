"use client";

import { useEffect, useMemo, useState } from "react";

import Card from "@/components/ui/Card";
import { buttonStyles } from "@/components/ui/Button";
import { csrfFetch, getErrorMessage } from "@/lib/security/csrf-client";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

type UploadScope = "COMPANY_LOGO" | "PROJECT_COVER" | "POST_COVER";

type UploadResult = {
  asset: { id: string; publicUrl: string };
};

type PresignResponse = {
  storagePath: string;
  bucket: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
};

type ImageUploaderProps = {
  scope: UploadScope;
  entityId: string;
  currentUrl?: string | null;
  onUploaded?: (url: string, assetId: string) => void;
};

export default function ImageUploader({
  scope,
  entityId,
  currentUrl,
  onUploaded,
}: ImageUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const displayUrl = useMemo(
    () => previewUrl ?? currentUrl ?? null,
    [previewUrl, currentUrl],
  );

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    if (!nextFile) {
      setFile(null);
      setNotice(null);
      return;
    }

    if (!ALLOWED_MIME.has(nextFile.type)) {
      setNotice("Only PNG, JPEG, and WebP images are allowed.");
      setFile(null);
      return;
    }

    if (nextFile.size > MAX_BYTES) {
      setNotice("File exceeds the 5MB limit.");
      setFile(null);
      return;
    }

    setNotice(null);
    setFile(nextFile);
  };

  const handleUpload = async () => {
    if (!file) {
      setNotice("Choose an image before uploading.");
      return;
    }

    setUploading(true);
    setNotice(null);
    try {
      const presignResponse = await csrfFetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          entityId,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });

      const presignDataRaw = (await presignResponse.json()) as
        | PresignResponse
        | { error?: unknown };

      if (!presignResponse.ok || "error" in presignDataRaw) {
        throw new Error(
          getErrorMessage(presignDataRaw, "Unable to start upload."),
        );
      }

      const presignData = presignDataRaw as PresignResponse;

      const uploadResponse = await fetch(presignData.signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
          Authorization: `Bearer ${presignData.token}`,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(
          errorText || "Upload failed. Please try again.",
        );
      }

      const confirmResponse = await csrfFetch("/api/uploads/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          entityId,
          storagePath: presignData.storagePath,
          mimeType: file.type,
          sizeBytes: file.size,
          publicUrl: presignData.publicUrl,
        }),
      });

      const confirmDataRaw = (await confirmResponse.json()) as
        | UploadResult
        | { error?: unknown };

      if (!confirmResponse.ok || "error" in confirmDataRaw) {
        throw new Error(
          getErrorMessage(confirmDataRaw, "Unable to confirm upload."),
        );
      }

      const confirmData = confirmDataRaw as UploadResult;

      setNotice("Upload complete.");
      setFile(null);
      onUploaded?.(confirmData.asset.publicUrl, confirmData.asset.id);
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Upload failed. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="space-y-3">
      <div className="text-sm font-semibold">Image upload</div>
      {displayUrl ? (
        <div className="overflow-hidden rounded-lg border border-[color:var(--color-line)]">
          <img
            src={displayUrl}
            alt="Uploaded preview"
            className="h-48 w-full object-cover"
          />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[color:var(--color-line)] p-4 text-sm text-[color:var(--color-muted)]">
          No image uploaded yet.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          disabled={uploading}
        />
        <button
          type="button"
          className={buttonStyles({ size: "sm" })}
          onClick={handleUpload}
          disabled={uploading}
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>
      {notice ? (
        <p className="text-xs text-[color:var(--color-muted)]">{notice}</p>
      ) : null}
    </Card>
  );
}
