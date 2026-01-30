"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Card from "@/components/ui/Card";
import Tabs from "@/components/ui/Tabs";
import { buttonStyles } from "@/components/ui/Button";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { formatDate } from "@/lib/dashboard/format";

type ContentStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

type PostItem = {
  id: string;
  title: string;
  status: ContentStatus;
  updatedAt: string;
  publishedAt: string | null;
};

type CompanyPostsClientProps = {
  companyId: string;
  canWrite: boolean;
};

const filters = ["All", "Draft", "Pending", "Approved", "Rejected"] as const;
type FilterKey = (typeof filters)[number];

function statusToQuery(status: FilterKey) {
  return status === "All" ? "all" : status.toUpperCase();
}

export default function CompanyPostsClient({
  companyId,
  canWrite,
}: CompanyPostsClientProps) {
  const [filter, setFilter] = useState<FilterKey>("All");
  const [items, setItems] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await csrfFetch(
        `/api/company/${companyId}/posts?status=${statusToQuery(filter)}`,
      );
      if (!response.ok) {
        throw new Error("Failed to load company posts.");
      }
      const data = (await response.json()) as { items: PostItem[] };
      setItems(data.items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load company posts.",
      );
    } finally {
      setLoading(false);
    }
  }, [companyId, filter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const emptyState = useMemo(() => {
    if (filter === "All") return "No company posts yet.";
    return `No ${filter.toLowerCase()} posts yet.`;
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
          onClick={fetchPosts}
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
          {items.map((post) => (
            <Card key={post.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold">{post.title}</h3>
                  <p className="text-xs text-[color:var(--color-muted)]">
                    Updated {formatDate(post.updatedAt)}
                  </p>
                </div>
                <StatusBadge status={post.status} />
              </div>
              <div className="flex flex-wrap gap-2">
                {canWrite ? (
                  <Link
                    href={`/company/${companyId}/hub/posts/${post.id}/edit`}
                    className={buttonStyles({ variant: "outline", size: "sm" })}
                  >
                    Edit
                  </Link>
                ) : null}
                {post.status === "APPROVED" ? (
                  <Link
                    href={`/post/${post.id}`}
                    className={buttonStyles({ variant: "ghost", size: "sm" })}
                  >
                    View
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
