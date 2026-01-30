"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import ImageUploader from "@/components/uploads/ImageUploader";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { buttonStyles } from "@/components/ui/Button";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { cn } from "@/lib/cn";
import { formatDate, formatProjectStatus } from "@/lib/dashboard/format";
import { isCompanyEditor } from "@/lib/company/roles";
import { type CompanyRole } from "@prisma/client";

type ContentStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
type ProjectStatus = "IN_PROGRESS" | "RELEASED" | "FROZEN";

type CompanyProjectEditorProps = {
  mode: "create" | "edit";
  companyId: string;
  projectId?: string;
  role: CompanyRole;
};

type ProjectPayload = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  projectStatus: ProjectStatus;
  moderationStatus: ContentStatus;
  coverAsset?: { id: string; publicUrl: string } | null;
  updatedAt: string;
};

type Notice = { type: "success" | "error"; message: string } | null;

const statusStyles: Record<ProjectStatus, string> = {
  IN_PROGRESS: "border-[color:var(--color-line)] text-[color:var(--color-muted)]",
  RELEASED: "border-green-200 text-green-700 bg-green-50/60",
  FROZEN: "border-blue-200 text-blue-700 bg-blue-50/60",
};

export default function CompanyProjectEditor({
  mode,
  companyId,
  projectId,
  role,
}: CompanyProjectEditorProps) {
  const router = useRouter();
  const isReviewer = isCompanyEditor(role);
  const isMember = role === "MEMBER";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [projectStatus, setProjectStatus] =
    useState<ProjectStatus>("IN_PROGRESS");
  const [moderationStatus, setModerationStatus] =
    useState<ContentStatus>("DRAFT");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const response = await csrfFetch(
        `/api/company/${companyId}/projects/${projectId}`,
      );
      if (!response.ok) {
        throw new Error("Project not found.");
      }
      const data = (await response.json()) as { item: ProjectPayload };
      setName(data.item.name);
      setDescription(data.item.description);
      setTags(data.item.tags.join(", "));
      setProjectStatus(data.item.projectStatus);
      setModerationStatus(data.item.moderationStatus);
      setUpdatedAt(data.item.updatedAt);
      setCoverUrl(data.item.coverAsset?.publicUrl ?? null);
    } catch (err) {
      setNotice({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to load project.",
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, projectId]);

  useEffect(() => {
    if (mode === "edit") {
      fetchProject();
    }
  }, [mode, fetchProject]);

  const handleProposalSubmit = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const response = await csrfFetch(`/api/company/${companyId}/proposals/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, tags, projectStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to submit proposal.");
      setNotice({ type: "success", message: "Proposal submitted for review." });
      router.push(`/company/${companyId}/hub/proposals`);
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Unable to save proposal.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (intent: "draft" | "publish" | "save") => {
    if (!isReviewer) {
      setNotice({
        type: "error",
        message: "Insufficient permissions.",
      });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const response = await csrfFetch(
        mode === "create"
          ? `/api/company/${companyId}/projects`
          : `/api/company/${companyId}/projects/${projectId}`,
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
        error?: string;
      };

      if (!response.ok || !data.item) {
        throw new Error(data.error ?? "Unable to save project.");
      }

      setModerationStatus(data.item.moderationStatus);
      setUpdatedAt(data.item.updatedAt);
      setNotice({ type: "success", message: "Project saved." });

      if (mode === "create") {
        router.push(
          `/company/${companyId}/hub/projects/${data.item.id}/edit`,
        );
      }
    } catch (err) {
      setNotice({
        type: "error",
        message:
          err instanceof Error ? err.message : "Unable to save project.",
      });
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = name.trim().length > 0 && description.trim().length > 0;
  const headerText = mode === "create" ? (isReviewer ? "Create Project" : "Create Project Proposal") : "Edit Project";
  const subHeaderText = isReviewer ? "Publish instantly or save as a draft." : "Your proposal will be reviewed by the company owners.";

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">{headerText}</h2>
        <p className="text-sm text-[color:var(--color-muted)]">{subHeaderText}</p>
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
        <p>Loading...</p>
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

          {mode === 'edit' && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-muted)]">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  statusStyles[projectStatus],
                )}
              >
                {formatProjectStatus(projectStatus)}
              </span>
              <StatusBadge status={moderationStatus} />
              {updatedAt ? <span>Last updated {formatDate(updatedAt)}</span> : null}
            </div>
          )}
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {isReviewer && (
          <>
            {mode === 'create' ? (
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
                Save Changes
              </button>
            )}
            <button
              type="button"
              className={buttonStyles({ variant: "primary", size: "sm" })}
              onClick={() => handleSubmit("publish")}
              disabled={!canSubmit || saving}
            >
              Publish
            </button>
          </>
        )}

        {isMember && mode === 'create' && (
          <button
            type="button"
            className={buttonStyles({ variant: "primary", size: "sm" })}
            onClick={handleProposalSubmit}
            disabled={!canSubmit || saving}
          >
            Submit Proposal
          </button>
        )}
      </div>
    </div>
  );
}
