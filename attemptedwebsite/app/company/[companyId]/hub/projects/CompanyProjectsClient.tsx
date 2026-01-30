"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Card from "@/components/ui/Card";
import Tabs from "@/components/ui/Tabs";
import { buttonStyles } from "@/components/ui/Button";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { cn } from "@/lib/cn";
import { formatDate, formatProjectStatus } from "@/lib/dashboard/format";

type ContentStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
type ProjectStatus = "IN_PROGRESS" | "RELEASED" | "FROZEN";

type ProjectItem = {
  id: string;
  name: string;
  projectStatus: ProjectStatus;
  moderationStatus: ContentStatus;
  updatedAt: string;
  publishedAt: string | null;
};

type CompanyProjectsClientProps = {
  companyId: string;
  canWrite: boolean;
};

const filters = ["All", "Draft", "Pending", "Approved", "Rejected"] as const;
type FilterKey = (typeof filters)[number];

function statusToQuery(status: FilterKey) {
  return status === "All" ? "all" : status.toUpperCase();
}

const projectStatusStyles: Record<ProjectStatus, string> = {
  IN_PROGRESS: "border-[color:var(--color-line)] text-[color:var(--color-muted)]",
  RELEASED: "border-green-200 text-green-700 bg-green-50/60",
  FROZEN: "border-blue-200 text-blue-700 bg-blue-50/60",
};

export default function CompanyProjectsClient({
  companyId,
  canWrite,
}: CompanyProjectsClientProps) {
  const [filter, setFilter] = useState<FilterKey>("All");
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await csrfFetch(
        `/api/company/${companyId}/projects?status=${statusToQuery(filter)}`,
      );
      if (!response.ok) {
        throw new Error("Failed to load company projects.");
      }
      const data = (await response.json()) as { items: ProjectItem[] };
      setItems(data.items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load company projects.",
      );
    } finally {
      setLoading(false);
    }
  }, [companyId, filter]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const emptyState = useMemo(() => {
    if (filter === "All") return "No company projects yet.";
    return `No ${filter.toLowerCase()} projects yet.`;
  }, [filter]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Tabs
          items={[...filters]}
          value={filter}
          onChange={(value) => setFilter(value as FilterKey)}
        />
        <div className="grid gap-3">
          {[0, 1, 2].map((item) => (
            <Card key={item} className="space-y-3">
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-[color:var(--color-line)]" />
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-[color:var(--color-line)]" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="space-y-2 text-sm text-[color:var(--color-muted)]">
        <p>{error}</p>
        <button
          type="button"
          className={buttonStyles({ variant: "outline", size: "sm" })}
          onClick={fetchProjects}
        >
          Retry
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs
        items={[...filters]}
        value={filter}
        onChange={(value) => setFilter(value as FilterKey)}
      />

      {items.length === 0 ? (
        <Card className="text-sm text-[color:var(--color-muted)]">
          {emptyState}
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((project) => (
            <Card key={project.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold">{project.name}</h3>
                  <p className="text-xs text-[color:var(--color-muted)]">
                    Updated {formatDate(project.updatedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      projectStatusStyles[project.projectStatus],
                    )}
                  >
                    {formatProjectStatus(project.projectStatus)}
                  </span>
                  <StatusBadge status={project.moderationStatus} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canWrite ? (
                  <Link
                    href={`/company/${companyId}/hub/projects/${project.id}/edit`}
                    className={buttonStyles({ variant: "outline", size: "sm" })}
                  >
                    Edit
                  </Link>
                ) : null}
                {project.moderationStatus === "APPROVED" ? (
                  <Link
                    href={`/project/${project.id}`}
                    className={buttonStyles({ variant: "ghost", size: "sm" })}
                  >
                    View
                  </Link>
                ) : null}
                <Link
                  href={`/company/${companyId}/hub/projects/${project.id}/collaborators`}
                  className={buttonStyles({ variant: "outline", size: "sm" })}
                >
                  Collaborators
                </Link>
                {project.moderationStatus === "APPROVED" ? (
                  <Link
                    href={`/company/${companyId}/hub/projects/${project.id}/updates`}
                    className={buttonStyles({ variant: "outline", size: "sm" })}
                  >
                    Updates
                  </Link>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
