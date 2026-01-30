"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Card from "@/components/ui/Card";
import UserChip from "@/components/users/UserChip";
import Input from "@/components/ui/Input";
import Tabs from "@/components/ui/Tabs";
import { buttonStyles } from "@/components/ui/Button";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { formatDate } from "@/lib/dashboard/format";

type ModerationItem = {
  id: string;
  targetType: "POST" | "PROJECT" | "COMPANY";
  targetId: string;
  targetTitle: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  submittedBy: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

type ModerationResponse = {
  items: ModerationItem[];
  nextPage: number | null;
};

const statusTabs = ["Pending", "Approved", "Rejected"] as const;
const typeOptions = ["All", "Post", "Project", "Company"] as const;

type StatusFilter = (typeof statusTabs)[number];
type TypeFilter = (typeof typeOptions)[number];

function statusToQuery(status: StatusFilter) {
  return status.toUpperCase();
}

function typeToQuery(type: TypeFilter) {
  return type === "All" ? "" : type.toUpperCase();
}

export default function ModerationListClient() {
  const [status, setStatus] = useState<StatusFilter>("Pending");
  const [type, setType] = useState<TypeFilter>("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);
    return () => clearTimeout(handle);
  }, [search]);

  const fetchRequests = useCallback(
    async (page: number, replace: boolean) => {
      if (replace) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("status", statusToQuery(status));
        if (type !== "All") {
          params.set("type", typeToQuery(type));
        }
        if (debouncedSearch.length >= 2) {
          params.set("search", debouncedSearch);
        }
        params.set("page", String(page));

        const response = await csrfFetch(`/api/moderation?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Failed to load moderation requests.");
        }
        const data = (await response.json()) as ModerationResponse;
        setItems((prev) => (replace ? data.items : [...prev, ...data.items]));
        setNextPage(data.nextPage);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load moderation requests.",
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [status, type, debouncedSearch],
  );

  useEffect(() => {
    fetchRequests(1, true);
  }, [fetchRequests]);

  const emptyState = useMemo(() => {
    if (status === "Pending") return "No pending requests.";
    return `No ${status.toLowerCase()} requests yet.`;
  }, [status]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            items={[...statusTabs]}
            value={status}
            onChange={(value) => setStatus(value as StatusFilter)}
          />
          <select
            value={type}
            onChange={(event) => setType(event.target.value as TypeFilter)}
            className="h-11 rounded-2xl border border-[color:var(--color-line)] bg-white/80 px-4 text-sm text-[color:var(--color-ink)] shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]"
          >
            {typeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="h-11 w-full animate-pulse rounded-2xl bg-[color:var(--color-line)]" />
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          items={[...statusTabs]}
          value={status}
          onChange={(value) => setStatus(value as StatusFilter)}
        />
        <select
          value={type}
          onChange={(event) => setType(event.target.value as TypeFilter)}
          className="h-11 rounded-2xl border border-[color:var(--color-line)] bg-white/80 px-4 text-sm text-[color:var(--color-ink)] shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]"
        >
          {typeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <div className="min-w-[220px] flex-1">
          <Input
            placeholder="Search by title or name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {error ? (
        <Card className="space-y-2 text-sm text-[color:var(--color-muted)]">
          <p>{error}</p>
          <button
            type="button"
            className={buttonStyles({ variant: "outline", size: "sm" })}
            onClick={() => fetchRequests(1, true)}
          >
            Retry
          </button>
        </Card>
      ) : null}

      {!error && items.length === 0 ? (
        <Card className="text-sm text-[color:var(--color-muted)]">
          {emptyState}
        </Card>
      ) : null}

      <div className="grid gap-3">
        {items.map((item) => (
          <Link key={item.id} href={`/dashboard/admin/moderation/${item.id}`}>
            <Card className="space-y-3 transition-colors hover:border-[color:var(--color-brand)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
                    {item.targetType}
                  </p>
                  <h3 className="text-lg font-semibold">{item.targetTitle}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-muted)]">
                    <span>Submitted by</span>
                    <UserChip
                      userId={item.submittedBy.id}
                      displayName={item.submittedBy.displayName}
                      avatarUrl={item.submittedBy.avatarUrl}
                    />
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                </div>
                <StatusBadge status={item.status} />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {nextPage ? (
        <button
          type="button"
          className={buttonStyles({ variant: "outline", size: "sm" })}
          onClick={() => fetchRequests(nextPage, false)}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading..." : "Load more"}
        </button>
      ) : null}
    </div>
  );
}
