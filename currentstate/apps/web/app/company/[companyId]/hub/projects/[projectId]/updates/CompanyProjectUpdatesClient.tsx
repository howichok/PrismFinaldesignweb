"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Card from "@/components/ui/Card";
import UserChip from "@/components/users/UserChip";
import Tabs from "@/components/ui/Tabs";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dashboard/format";
import { useCompanyHub } from "@/components/company/CompanyHubShell";
import { isCompanyEditor } from "@/lib/company/roles";

type UpdateItem = {
  id: string;
  title: string;
  summary: string;
  details: string | null;
  updateType: "PROGRESS" | "RELEASE" | "FIX" | "ANNOUNCEMENT";
  importance: "MAJOR" | "MINOR";
  status: "PUBLISHED" | "PENDING" | "REJECTED";
  rejectionReason: string | null;
  createdAt: string;
  publishedAt: string | null;
  createdBy: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

const filters = ["All", "Published", "Pending", "Rejected"] as const;
type FilterKey = (typeof filters)[number];

const updateTypeStyles: Record<UpdateItem["updateType"], string> = {
  PROGRESS: "border-blue-200 text-blue-700 bg-blue-50/70",
  RELEASE: "border-green-200 text-green-700 bg-green-50/70",
  FIX: "border-amber-200 text-amber-700 bg-amber-50/70",
  ANNOUNCEMENT: "border-purple-200 text-purple-700 bg-purple-50/70",
};

const importanceStyles: Record<UpdateItem["importance"], string> = {
  MAJOR: "border-[color:var(--color-line)] text-[color:var(--color-ink)]",
  MINOR: "border-[color:var(--color-line)] text-[color:var(--color-muted)]",
};

function formatUpdateType(type: UpdateItem["updateType"]) {
  switch (type) {
    case "RELEASE":
      return "Release";
    case "FIX":
      return "Fix";
    case "ANNOUNCEMENT":
      return "Announcement";
    default:
      return "Progress";
  }
}

function statusToQuery(status: FilterKey) {
  return status === "All" ? "all" : status.toUpperCase();
}

type CompanyProjectUpdatesClientProps = {
  projectId: string;
  projectName: string;
};

export default function CompanyProjectUpdatesClient({
  projectId,
  projectName,
}: CompanyProjectUpdatesClientProps) {
  const { company, role, userId } = useCompanyHub();
  const canPublish = isCompanyEditor(role);
  const isMember = role === "MEMBER";
  const [filter, setFilter] = useState<FilterKey>("All");
  const [items, setItems] = useState<UpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUpdates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await csrfFetch(
        `/api/company/${company.id}/projects/${projectId}/updates?status=${statusToQuery(filter)}`,
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to load updates.");
      }
      const data = (await response.json()) as { items: UpdateItem[] };
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load updates.");
    } finally {
      setLoading(false);
    }
  }, [company.id, filter, projectId]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  const emptyState = useMemo(() => {
    if (filter === "All") return "No updates yet.";
    return `No ${filter.toLowerCase()} updates yet.`;
  }, [filter]);

  const pendingCount =
    filter === "All"
      ? items.filter((item) => item.status === "PENDING").length
      : null;

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
          onClick={fetchUpdates}
        >
          Retry
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Project updates</h2>
          <p className="text-sm text-[color:var(--color-muted)]">
            Share progress notes for {projectName}.
          </p>
        </div>
        <Link
          href={`/company/${company.id}/hub/projects/${projectId}/updates/new`}
          className={buttonStyles({ variant: "primary", size: "sm" })}
        >
          {canPublish ? "New update" : "Submit proposal"}
        </Link>
      </header>

      <Card className="text-sm text-[color:var(--color-muted)]">
        Major updates are limited to one per 24 hours per project.
        {pendingCount && pendingCount > 0 ? (
          <span className="ml-2">
            Pending proposals: {pendingCount}.{" "}
            <Link
              href={`/company/${company.id}/hub/proposals`}
              className="font-semibold text-[color:var(--color-brand-strong)]"
            >
              Review proposals
            </Link>
          </span>
        ) : null}
      </Card>

      {isMember ? (
        <Card className="text-sm text-[color:var(--color-muted)]">
          Members submit update proposals for review by trusted editors.
        </Card>
      ) : null}

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
          {items.map((update) => {
            const isAuthor = update.createdBy.id === userId;
            const canEdit =
              canPublish ||
              (isAuthor &&
                (update.status === "PENDING" || update.status === "REJECTED"));

            return (
              <Card key={update.id} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      updateTypeStyles[update.updateType],
                    )}
                  >
                    {formatUpdateType(update.updateType)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      importanceStyles[update.importance],
                    )}
                  >
                    {update.importance === "MAJOR" ? "Major" : "Minor"}
                  </span>
                  <StatusBadge status={update.status} />
                  <span className="text-xs text-[color:var(--color-muted)]">
                    {update.status === "PUBLISHED"
                      ? `Published ${formatDate(update.publishedAt)}`
                      : `Created ${formatDate(update.createdAt)}`}
                  </span>
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">{update.title}</h3>
                  <p className="text-sm text-[color:var(--color-muted)]">
                    {update.summary}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-muted)]">
                  <span>Proposed by</span>
                  <UserChip
                    userId={update.createdBy.id}
                    displayName={update.createdBy.displayName}
                    avatarUrl={update.createdBy.avatarUrl}
                    viewerId={userId}
                  />
                </div>
                {update.status === "REJECTED" && update.rejectionReason ? (
                  <p className="text-sm text-red-600">
                    {update.rejectionReason}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {canEdit ? (
                    <Link
                      href={`/company/${company.id}/hub/projects/${projectId}/updates/${update.id}/edit`}
                      className={buttonStyles({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      Edit
                    </Link>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
