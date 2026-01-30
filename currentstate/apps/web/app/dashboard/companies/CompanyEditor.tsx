"use client";

import { csrfFetch, getErrorMessage } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import ImageUploader from "@/components/uploads/ImageUploader";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { buttonStyles } from "@/components/ui/Button";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { isModOrAdmin } from "@/lib/auth/guards";
import { companyCategories } from "@/content/companyCategories";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dashboard/format";

type ContentStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

type CompanyEditorProps = {
  companyId: string;
  siteRole: "USER" | "MOD" | "ADMIN";
};

type CompanyPayload = {
  id: string;
  name: string;
  description: string;
  logoUrl: string | null;
  logoAsset?: { id: string; publicUrl: string } | null;
  categories: string[];
  visibilityStatus: ContentStatus;
  rejectionReason: string | null;
  updatedAt: string;
};

type Notice = { type: "success" | "error"; message: string } | null;

export default function CompanyEditor({
  companyId,
  siteRole,
}: CompanyEditorProps) {
  const router = useRouter();
  const privileged = isModOrAdmin(siteRole);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [status, setStatus] = useState<ContentStatus>("DRAFT");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const fetchCompany = useCallback(async () => {
    setLoading(true);
    try {
      const response = await csrfFetch(`/api/dashboard/companies/${companyId}`);
      if (!response.ok) {
        throw new Error("Company not found.");
      }
      const data = (await response.json()) as { item: CompanyPayload };
      setName(data.item.name);
      setDescription(data.item.description);
      setLogoUrl(data.item.logoAsset?.publicUrl ?? data.item.logoUrl ?? "");
      setCategories(data.item.categories);
      setStatus(data.item.visibilityStatus);
      setRejectionReason(data.item.rejectionReason);
      setUpdatedAt(data.item.updatedAt);
    } catch (err) {
      setNotice({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to load company.",
      });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  const toggleCategory = (value: string) => {
    setCategories((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  };

  const handleSubmit = async (
    intent: "save" | "draft" | "submit" | "publish",
  ) => {
    setSaving(true);
    setNotice(null);
    try {
      const response = await csrfFetch(`/api/dashboard/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          logoUrl,
          categories,
          intent,
        }),
      });

      const data = (await response.json()) as {
        item?: CompanyPayload;
        error?: unknown;
      };

      if (!response.ok || !data.item) {
        throw new Error(getErrorMessage(data, "Unable to save company."));
      }

      setStatus(data.item.visibilityStatus);
      setRejectionReason(data.item.rejectionReason ?? null);
      setUpdatedAt(data.item.updatedAt);
      setNotice({ type: "success", message: "Company saved." });
      router.refresh();
    } catch (err) {
      setNotice({
        type: "error",
        message:
          err instanceof Error ? err.message : "Unable to save company.",
      });
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = name.trim().length > 0 && description.trim().length > 0;
  const showSubmit =
    !privileged && (status === "DRAFT" || status === "REJECTED");
  const showPublish = privileged;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Edit company</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Update your company profile before it goes live.
        </p>
      </header>

      {notice ? (
        <Card
          className={
            notice.type === "error"
              ? "border-red-200 text-red-700"
              : "border-green-200 text-green-700"
          }
        >
          {notice.message}
        </Card>
      ) : null}

      {loading ? (
        <Card className="space-y-3">
          <div className="h-4 w-1/2 animate-pulse rounded-full bg-[color:var(--color-line)]" />
          <div className="h-10 w-full animate-pulse rounded-2xl bg-[color:var(--color-line)]" />
          <div className="h-36 w-full animate-pulse rounded-2xl bg-[color:var(--color-line)]" />
        </Card>
      ) : (
        <Card className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Name
            </label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Company name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Description
            </label>
            <Textarea
              rows={6}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What does your company do?"
            />
          </div>

          <ImageUploader
            scope="COMPANY_LOGO"
            entityId={companyId}
            currentUrl={logoUrl}
            onUploaded={(url) => setLogoUrl(url)}
          />

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Categories
            </label>
            <div className="flex flex-wrap gap-2">
              {companyCategories.map((category) => {
                const active = categories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors",
                      active
                        ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-white"
                        : "border-[color:var(--color-line)] text-[color:var(--color-muted)] hover:border-[color:var(--color-brand)]",
                    )}
                    onClick={() => toggleCategory(category)}
                    disabled={!active && categories.length >= 3}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-muted)]">
            <StatusBadge status={status} />
            {updatedAt ? <span>Last updated {formatDate(updatedAt)}</span> : null}
          </div>

          {status === "REJECTED" && rejectionReason ? (
            <p className="text-sm text-red-600">{rejectionReason}</p>
          ) : null}
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonStyles({ variant: "outline", size: "sm" })}
          onClick={() => handleSubmit("save")}
          disabled={!canSubmit || saving}
        >
          Save
        </button>

        {showSubmit ? (
          <button
            type="button"
            className={buttonStyles({ variant: "primary", size: "sm" })}
            onClick={() => handleSubmit("submit")}
            disabled={!canSubmit || saving}
          >
            {status === "REJECTED" ? "Resubmit" : "Submit for moderation"}
          </button>
        ) : null}

        {showPublish ? (
          <button
            type="button"
            className={buttonStyles({ variant: "soft", size: "sm" })}
            onClick={() => handleSubmit("publish")}
            disabled={!canSubmit || saving}
          >
            Publish now
          </button>
        ) : null}
      </div>
    </div>
  );
}
