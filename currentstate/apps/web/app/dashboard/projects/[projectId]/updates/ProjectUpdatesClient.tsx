"use client";

import { csrfFetch, getErrorMessage } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Card from "@/components/ui/Card";
import Tabs from "@/components/ui/Tabs";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dashboard/format";

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

type ProjectUpdatesClientProps = {
  projectId: string;
};

export default function ProjectUpdatesClient({
  projectId,
}: ProjectUpdatesClientProps) {
  const [filter, setFilter] = useState<FilterKey>("All");
  const [items, setItems] = useState<UpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUpdates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await csrfFetch(
        `/api/projects/${projectId}/updates?status=${statusToQuery(filter)}`,
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: unknown };
        throw new Error(getErrorMessage(data, "Failed to load updates."));
      }
      const data = (await response.json()) as { items: UpdateItem[] };
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load updates.");
    } finally {
      setLoading(false);
    }
  }, [filter, projectId]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  const emptyState = useMemo(() => {
    if (filter === "All") return "No updates yet.";
    return `No ${filter.toLowerCase()} updates yet.`;
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
          onClick={fetchUpdates}
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
          {items.map((update) => (
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
              {update.status === "REJECTED" && update.rejectionReason ? (
                <p className="text-sm text-red-600">{update.rejectionReason}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {update.status !== "REJECTED" ? (
                  <Link
                    href={`/dashboard/projects/${projectId}/updates/${update.id}/edit`}
                    className={buttonStyles({ variant: "outline", size: "sm" })}
                  >
                    Edit
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
