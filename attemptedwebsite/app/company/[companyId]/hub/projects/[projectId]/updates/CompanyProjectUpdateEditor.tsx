"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { buttonStyles } from "@/components/ui/Button";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { formatDate } from "@/lib/dashboard/format";
import { useCompanyHub } from "@/components/company/CompanyHubShell";
import { isCompanyEditor } from "@/lib/company/roles";

type UpdateTypeValue = "PROGRESS" | "RELEASE" | "FIX" | "ANNOUNCEMENT";
type ImportanceValue = "MAJOR" | "MINOR";
type StatusValue = "PUBLISHED" | "PENDING" | "REJECTED";

type UpdatePayload = {
  id: string;
  title: string;
  summary: string;
  details: string | null;
  updateType: UpdateTypeValue;
  importance: ImportanceValue;
  status: StatusValue;
  rejectionReason: string | null;
  createdAt: string;
  publishedAt: string | null;
  createdBy: {
    id: string;
    displayName: string;
  };
  createdByUserId: string;
};

type Notice = { type: "success" | "error"; message: string } | null;

type CompanyProjectUpdateEditorProps = {
  mode: "create" | "edit";
  projectId: string;
  updateId?: string;
};

const updateTypeOptions: UpdateTypeValue[] = [
  "PROGRESS",
  "RELEASE",
  "FIX",
  "ANNOUNCEMENT",
];

export default function CompanyProjectUpdateEditor({
  mode,
  projectId,
  updateId,
}: CompanyProjectUpdateEditorProps) {
  const router = useRouter();
  const { company, role, userId } = useCompanyHub();
  const canPublish = isCompanyEditor(role);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [updateType, setUpdateType] =
    useState<UpdateTypeValue>("PROGRESS");
  const [importance, setImportance] = useState<ImportanceValue>("MINOR");
  const [status, setStatus] = useState<StatusValue>("PENDING");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [createdById, setCreatedById] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const fetchUpdate = useCallback(async () => {
    if (!updateId) return;
    setLoading(true);
    try {
      const response = await csrfFetch(
        `/api/company/${company.id}/projects/${projectId}/updates/${updateId}`,
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Update not found.");
      }
      const data = (await response.json()) as { item: UpdatePayload };
      setTitle(data.item.title);
      setSummary(data.item.summary);
      setDetails(data.item.details ?? "");
      setUpdateType(data.item.updateType);
      setImportance(data.item.importance);
      setStatus(data.item.status);
      setRejectionReason(data.item.rejectionReason);
      setCreatedAt(data.item.createdAt);
      setPublishedAt(data.item.publishedAt);
      setCreatedById(data.item.createdByUserId ?? data.item.createdBy.id);
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to load update.",
      });
    } finally {
      setLoading(false);
    }
  }, [company.id, projectId, updateId]);

  useEffect(() => {
    fetchUpdate();
  }, [fetchUpdate]);

  const handleSubmit = async (intent?: "resubmit") => {
    setSaving(true);
    setNotice(null);
    try {
      const response = await csrfFetch(
        mode === "create"
          ? `/api/company/${company.id}/projects/${projectId}/updates`
          : `/api/company/${company.id}/projects/${projectId}/updates/${updateId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            summary,
            details,
            updateType,
            importance,
            intent,
          }),
        },
      );

      const data = (await response.json()) as {
        item?: UpdatePayload;
        error?: string;
      };

      if (!response.ok || !data.item) {
        throw new Error(data.error ?? "Unable to save update.");
      }

      setStatus(data.item.status);
      setRejectionReason(data.item.rejectionReason ?? null);
      setCreatedAt(data.item.createdAt);
      setPublishedAt(data.item.publishedAt);
      setNotice({ type: "success", message: "Update saved." });

      if (mode === "create") {
        router.push(
          `/company/${company.id}/hub/projects/${projectId}/updates`,
        );
      }
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Unable to save update.",
      });
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = title.trim().length > 0 && summary.trim().length > 0;
  const isAuthor = createdById ? createdById === userId : true;
  const canResubmit = status === "REJECTED" && isAuthor;
  const primaryLabel = useMemo(() => {
    if (mode === "create") {
      return canPublish ? "Publish update" : "Submit proposal";
    }
    return "Save changes";
  }, [canPublish, mode]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">
          {mode === "create" ? "New update" : "Edit update"}
        </h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Major updates are limited to one per 24 hours per project.
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
          <div className="h-24 w-full animate-pulse rounded-2xl bg-[color:var(--color-line)]" />
        </Card>
      ) : (
        <Card className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Title
            </label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Update title"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Summary
            </label>
            <Textarea
              rows={4}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Short summary for the update..."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                Type
              </label>
              <select
                value={updateType}
                onChange={(event) =>
                  setUpdateType(event.target.value as UpdateTypeValue)
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--color-line)] bg-white/80 px-4 text-sm text-[color:var(--color-ink)] shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]"
              >
                {updateTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option.toLowerCase().replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                Importance
              </label>
              <select
                value={importance}
                onChange={(event) =>
                  setImportance(event.target.value as ImportanceValue)
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--color-line)] bg-white/80 px-4 text-sm text-[color:var(--color-ink)] shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]"
              >
                <option value="MINOR">Minor</option>
                <option value="MAJOR">Major</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Details (optional)
            </label>
            <Textarea
              rows={6}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Optional details, patch notes, or context..."
            />
          </div>

          {mode === "edit" ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-muted)]">
              <StatusBadge status={status} />
              {createdAt ? <span>Created {formatDate(createdAt)}</span> : null}
              {publishedAt ? (
                <span>Published {formatDate(publishedAt)}</span>
              ) : null}
            </div>
          ) : null}

          {status === "REJECTED" && rejectionReason ? (
            <p className="text-sm text-red-600">{rejectionReason}</p>
          ) : null}
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonStyles({ variant: "primary", size: "sm" })}
          onClick={() => handleSubmit()}
          disabled={!canSubmit || saving}
        >
          {primaryLabel}
        </button>

        {canResubmit ? (
          <button
            type="button"
            className={buttonStyles({ variant: "outline", size: "sm" })}
            onClick={() => handleSubmit("resubmit")}
            disabled={!canSubmit || saving}
          >
            Revise & resubmit
          </button>
        ) : null}
      </div>
    </div>
  );
}
