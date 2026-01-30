"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Tabs from "@/components/ui/Tabs";
import { buttonStyles } from "@/components/ui/Button";
import TicketStatusBadge from "@/components/dashboard/TicketStatusBadge";
import { formatDate } from "@/lib/dashboard/format";

type TicketItem = {
  id: string;
  subject: string;
  category: "LAUNCHER" | "SERVER" | "WEBSITE" | "REPORT" | "OTHER";
  status: "OPEN" | "ANSWERED" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

type TicketResponse = {
  items: TicketItem[];
  nextCursor: string | null;
};

const statusTabs = ["Open", "Answered", "Closed"] as const;
type StatusFilter = (typeof statusTabs)[number];

const categoryLabels: Record<TicketItem["category"], string> = {
  LAUNCHER: "Launcher",
  SERVER: "Server",
  WEBSITE: "Website",
  REPORT: "Report",
  OTHER: "Other",
};

function statusToQuery(status: StatusFilter) {
  return status.toUpperCase();
}

export default function AdminTicketsClient() {
  const [status, setStatus] = useState<StatusFilter>("Open");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [items, setItems] = useState<TicketItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);
    return () => clearTimeout(handle);
  }, [search]);

  const fetchTickets = useCallback(
    async (cursor: string | null, replace: boolean) => {
      if (replace) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("status", statusToQuery(status));
        if (debouncedSearch.length >= 2) {
          params.set("search", debouncedSearch);
        }
        if (cursor) {
          params.set("cursor", cursor);
        }

        const response = await csrfFetch(`/api/tickets/inbox?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Failed to load tickets.");
        }
        const data = (await response.json()) as TicketResponse;
        setItems((prev) => (replace ? data.items : [...prev, ...data.items]));
        setNextCursor(data.nextCursor);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load tickets.",
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [status, debouncedSearch],
  );

  useEffect(() => {
    fetchTickets(null, true);
  }, [fetchTickets]);

  const emptyState = useMemo(() => {
    return `No ${status.toLowerCase()} tickets right now.`;
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
          <div className="min-w-[220px] flex-1">
            <Input
              placeholder="Search by subject"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
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
        <div className="min-w-[220px] flex-1">
          <Input
            placeholder="Search by subject"
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
            onClick={() => fetchTickets(null, true)}
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
        {items.map((ticket) => (
          <Link key={ticket.id} href={`/ticket/${ticket.id}`}>
            <Card className="space-y-3 transition-colors hover:border-[color:var(--color-brand)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
                    {categoryLabels[ticket.category]}
                  </p>
                  <h3 className="text-lg font-semibold">{ticket.subject}</h3>
                  <p className="text-xs text-[color:var(--color-muted)]">
                    Submitted by {ticket.createdBy} - Updated{" "}
                    {formatDate(ticket.updatedAt)}
                  </p>
                </div>
                <TicketStatusBadge status={ticket.status} />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {nextCursor ? (
        <button
          type="button"
          className={buttonStyles({ variant: "outline", size: "sm" })}
          onClick={() => fetchTickets(nextCursor, false)}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading..." : "Load more"}
        </button>
      ) : null}
    </div>
  );
}
