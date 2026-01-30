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
import { cn } from "@/lib/cn";
import { formatDate, formatProjectStatus } from "@/lib/dashboard/format";

type ContentStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
type ProjectStatus = "IN_PROGRESS" | "RELEASED" | "FROZEN";

type ProjectEditorProps = {
  mode: "create" | "edit";
  projectId?: string;
  siteRole: "USER" | "MOD" | "ADMIN";
};

type ProjectPayload = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  projectStatus: ProjectStatus;
  moderationStatus: ContentStatus;
  coverAsset?: { id: string; publicUrl: string } | null;
  rejectionReason: string | null;
  updatedAt: string;
};

type Notice = { type: "success" | "error"; message: string } | null;

const statusStyles: Record<ProjectStatus, string> = {
  IN_PROGRESS: "border-[color:var(--color-line)] text-[color:var(--color-muted)]",
  RELEASED: "border-green-200 text-green-700 bg-green-50/60",
  FROZEN: "border-blue-200 text-blue-700 bg-blue-50/60",
};

export default function ProjectEditor({
  mode,
  projectId,
  siteRole,
}: ProjectEditorProps) {
  const router = useRouter();
  const privileged = isModOrAdmin(siteRole);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [projectStatus, setProjectStatus] =
    useState<ProjectStatus>("IN_PROGRESS");
  const [status, setStatus] = useState<ContentStatus>("DRAFT");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const response = await csrfFetch(`/api/dashboard/projects/${projectId}`);
      if (!response.ok) {
        throw new Error("Project not found.");
      }
      const data = (await response.json()) as { item: ProjectPayload };
      setName(data.item.name);
      setDescription(data.item.description);
      setTags(data.item.tags.join(", "));
      setProjectStatus(data.item.projectStatus);
      setStatus(data.item.moderationStatus);
      setRejectionReason(data.item.rejectionReason);
      setUpdatedAt(data.item.updatedAt);
      setCoverUrl(data.item.coverAsset?.publicUrl ?? null);
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to load project.",
      });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleSubmit = async (
    intent: "draft" | "submit" | "publish" | "save",
  ) => {
    setSaving(true);
    setNotice(null);
    try {
      const response = await csrfFetch(
        mode === "create"
          ? "/api/dashboard/projects"
          : `/api/dashboard/projects/${projectId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            tags,
            projectStatus,
            intent,
          }),
        },
      );

      const data = (await response.json()) as {
        item?: ProjectPayload;
        error?: unknown;
      };

      if (!response.ok || !data.item) {
        throw new Error(getErrorMessage(data, "Unable to save project."));
      }

      setStatus(data.item.moderationStatus);
      setRejectionReason(data.item.rejectionReason ?? null);
      setUpdatedAt(data.item.updatedAt);
      setNotice({ type: "success", message: "Project saved." });

      if (mode === "create") {
        router.push(`/dashboard/projects/${data.item.id}/edit`);
      }
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Unable to save project.",
      });
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = name.trim().length > 0 && description.trim().length > 0;
  const showSubmit =
    !privileged && (mode === "create" || status === "DRAFT" || status === "REJECTED");
  const showPublish = privileged;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">
          {mode === "create" ? "Create project" : "Edit project"}
        </h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Projects are reviewed before they appear on Discovery.
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
          {mode === "edit" && projectId ? (
            <ImageUploader
              scope="PROJECT_COVER"
              entityId={projectId}
              currentUrl={coverUrl}
              onUploaded={(url) => setCoverUrl(url)}
            />
          ) : (
            <Card className="text-sm text-[color:var(--color-muted)]">
              Upload a cover image after the project is created.
            </Card>
          )}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Name
            </label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Project name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Tags
            </label>
            <Input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="comma separated"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Project status
            </label>
            <select
              value={projectStatus}
              onChange={(event) =>
                setProjectStatus(event.target.value as ProjectStatus)
              }
              className="h-11 w-full rounded-2xl border border-[color:var(--color-line)] bg-white/80 px-4 text-sm text-[color:var(--color-ink)] shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]"
            >
              <option value="IN_PROGRESS">In progress</option>
              <option value="RELEASED">Released</option>
              <option value="FROZEN">Frozen</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Description
            </label>
            <Textarea
              rows={8}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the project scope and goals..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-muted)]">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                statusStyles[projectStatus],
              )}
            >
              {formatProjectStatus(projectStatus)}
            </span>
            <StatusBadge status={status} />
            {updatedAt ? <span>Last updated {formatDate(updatedAt)}</span> : null}
          </div>

          {status === "REJECTED" && rejectionReason ? (
            <p className="text-sm text-red-600">{rejectionReason}</p>
          ) : null}
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {mode === "create" ? (
          <button
            type="button"
            className={buttonStyles({ variant: "outline", size: "sm" })}
            onClick={() => handleSubmit("draft")}
            disabled={!canSubmit || saving}
          >
            Save draft
          </button>
        ) : (
          <button
            type="button"
            className={buttonStyles({ variant: "outline", size: "sm" })}
            onClick={() => handleSubmit("save")}
            disabled={!canSubmit || saving}
          >
            Save
          </button>
        )}

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
