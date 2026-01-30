"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useCompanyHub } from "@/components/company/CompanyHubShell";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { buttonStyles } from "@/components/ui/Button";

type ProjectUpdateTypeValue = "PROGRESS" | "RELEASE" | "FIX" | "ANNOUNCEMENT";
type UpdateImportanceValue = "MAJOR" | "MINOR";

const updateTypeOptions: ProjectUpdateTypeValue[] = [
  "PROGRESS",
  "RELEASE",
  "FIX",
  "ANNOUNCEMENT",
];

const importanceOptions: UpdateImportanceValue[] = ["MINOR", "MAJOR"];

type ProjectOption = {
  id: string;
  name: string;
};

type Notice = { type: "success" | "error"; message: string } | null;

export default function NewUpdateProposalPage() {
  const router = useRouter();
  const { company, role } = useCompanyHub();

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [updateType, setUpdateType] =
    useState<ProjectUpdateTypeValue>("PROGRESS");
  const [importance, setImportance] =
    useState<UpdateImportanceValue>("MINOR");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const response = await csrfFetch(
        `/api/company/${company.id}/projects?status=APPROVED`,
      );
      if (!response.ok) {
        throw new Error("Failed to load company projects.");
      }
      const data = (await response.json()) as {
        items: Array<{ id: string; name: string }>;
      };
      setProjects(data.items);
      if (data.items.length > 0) {
        setProjectId((current) => current || data.items[0].id);
      }
    } catch (err) {
      setNotice({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to load projects.",
      });
    } finally {
      setLoading(false);
    }
  }, [company.id]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleSubmit = async () => {
    if (!projectId) {
      setNotice({ type: "error", message: "Select a project first." });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const response = await csrfFetch(
        `/api/company/${company.id}/projects/${projectId}/proposals/updates`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            summary,
            details,
            updateType,
            importance,
          }),
        },
      );

      const data = (await response.json()) as {
        item?: { id: string };
        error?: string;
      };

      if (!response.ok || !data.item) {
        throw new Error(data.error ?? "Failed to submit update proposal.");
      }

      setNotice({ type: "success", message: "Proposal submitted." });
      router.push(
        `/company/${company.id}/hub/proposals/updates/${data.item.id}`,
      );
    } catch (err) {
      setNotice({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to submit proposal.",
      });
    } finally {
      setSaving(false);
    }
  };

  const canSubmit =
    title.trim().length > 0 && summary.trim().length > 0 && !!projectId;
  const isMember = role === "MEMBER";

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">New Update Proposal</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Proposals are reviewed by trusted company members.
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
        <Card className="text-sm text-[color:var(--color-muted)]">
          Loading company projects...
        </Card>
      ) : projects.length === 0 ? (
        <Card className="text-sm text-[color:var(--color-muted)]">
          No published projects found. Create and publish a project first.
        </Card>
      ) : (
        <Card className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Project
            </label>
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="h-11 w-full rounded-2xl border border-[color:var(--color-line)] bg-white/80 px-4 text-sm text-[color:var(--color-ink)] shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

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

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                Update type
              </label>
              <select
                value={updateType}
                onChange={(event) =>
                  setUpdateType(event.target.value as ProjectUpdateTypeValue)
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--color-line)] bg-white/80 px-4 text-sm text-[color:var(--color-ink)] shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]"
              >
                {updateTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
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
                  setImportance(event.target.value as UpdateImportanceValue)
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--color-line)] bg-white/80 px-4 text-sm text-[color:var(--color-ink)] shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]"
              >
                {importanceOptions.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
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

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Details (optional)
            </label>
            <Textarea
              rows={8}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Extra details, changelog, or context..."
            />
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonStyles({ variant: "primary", size: "sm" })}
          onClick={handleSubmit}
          disabled={!canSubmit || saving || loading || !isMember}
        >
          {saving ? "Submitting..." : "Submit proposal"}
        </button>
        <button
          type="button"
          className={buttonStyles({ variant: "outline", size: "sm" })}
          onClick={() => router.back()}
        >
          Cancel
        </button>
      </div>

      {!isMember ? (
        <Card className="text-sm text-[color:var(--color-muted)]">
          Only company members can submit update proposals.
        </Card>
      ) : null}
    </div>
  );
}
