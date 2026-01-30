"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import Card from "@/components/ui/Card";
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
};

type TicketResponse = {
  items: TicketItem[];
  nextCursor: string | null;
};

const categoryLabels: Record<TicketItem["category"], string> = {
  LAUNCHER: "Launcher",
  SERVER: "Server",
  WEBSITE: "Website",
  REPORT: "Report",
  OTHER: "Other",
};

export default function TicketsClient() {
  const [items, setItems] = useState<TicketItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTickets = useCallback(async (cursor: string | null, replace: boolean) => {
    if (replace) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);
    try {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      const response = await csrfFetch(`/api/tickets/mine?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to load tickets.");
      }
      const data = (await response.json()) as TicketResponse;
      setItems((prev) => (replace ? data.items : [...prev, ...data.items]));
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadTickets(null, true);
  }, [loadTickets]);

  if (loading) {
    return (
      <div className="grid gap-3">
        {[0, 1, 2].map((item) => (
          <Card key={item} className="space-y-3">
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-[color:var(--color-line)]" />
            <div className="h-3 w-1/2 animate-pulse rounded-full bg-[color:var(--color-line)]" />
          </Card>
        ))}
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
          onClick={() => loadTickets(null, true)}
        >
          Retry
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <Card className="text-sm text-[color:var(--color-muted)]">
          No tickets yet. Submit one from the Help page when you need support.
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((ticket) => (
            <Link key={ticket.id} href={`/ticket/${ticket.id}`}>
              <Card className="space-y-3 transition-colors hover:border-[color:var(--color-brand)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
                      {categoryLabels[ticket.category]}
                    </p>
                    <h3 className="text-lg font-semibold">
                      {ticket.subject}
                    </h3>
                    <p className="text-xs text-[color:var(--color-muted)]">
                      Updated {formatDate(ticket.updatedAt)}
                    </p>
                  </div>
                  <TicketStatusBadge status={ticket.status} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {nextCursor ? (
        <button
          type="button"
          className={buttonStyles({ variant: "outline", size: "sm" })}
          onClick={() => loadTickets(nextCursor, false)}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading..." : "Load more"}
        </button>
      ) : null}
    </div>
  );
}
