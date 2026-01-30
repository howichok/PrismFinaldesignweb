"use client";

import { csrfFetch, getErrorMessage } from "@/lib/security/csrf-client";
import type { FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";

import Card from "@/components/ui/Card";
import UserChip from "@/components/users/UserChip";
import Textarea from "@/components/ui/Textarea";
import Button, { buttonStyles } from "@/components/ui/Button";
import TicketStatusBadge from "@/components/dashboard/TicketStatusBadge";
import { cn } from "@/lib/cn";
import { isModOrAdmin } from "@/lib/auth/guards";

type Viewer = {
  id: string;
  displayName: string;
  siteRole: "USER" | "MOD" | "ADMIN";
};

type TicketPayload = {
  id: string;
  subject: string;
  category: "LAUNCHER" | "SERVER" | "WEBSITE" | "REPORT" | "OTHER";
  status: "OPEN" | "ANSWERED" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

type TicketMessagePayload = {
  id: string;
  message: string;
  createdAt: string;
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    siteRole: "USER" | "MOD" | "ADMIN";
  };
};

type TicketThreadClientProps = {
  initialTicket: TicketPayload;
  initialMessages: TicketMessagePayload[];
  viewer: Viewer;
};

const categoryLabels: Record<TicketPayload["category"], string> = {
  LAUNCHER: "Launcher",
  SERVER: "Server",
  WEBSITE: "Website",
  REPORT: "Report",
  OTHER: "Other",
};

const MAX_MESSAGE_LENGTH = 2000;

function formatDateTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function TicketThreadClient({
  initialTicket,
  initialMessages,
  viewer,
}: TicketThreadClientProps) {
  const [ticket, setTicket] = useState(initialTicket);
  const [messages, setMessages] = useState(initialMessages);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<"close" | "reopen" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isStaff = isModOrAdmin(viewer.siteRole);
  const isClosed = ticket.status === "CLOSED";

  const backHref = isStaff ? "/dashboard/admin/tickets" : "/dashboard/tickets";

  const refreshTicket = useCallback(async () => {
    try {
      const response = await csrfFetch(`/api/tickets/${ticket.id}`);
      if (!response.ok) {
        throw new Error("Failed to refresh ticket.");
      }
      const data = (await response.json()) as {
        ticket: TicketPayload;
        messages: TicketMessagePayload[];
      };
      setTicket(data.ticket);
      setMessages(data.messages);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh ticket.",
      );
    }
  }, [ticket.id]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmed = message.trim();
    if (!trimmed) {
      setError("Message is required.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await csrfFetch(`/api/tickets/${ticket.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: unknown };
        throw new Error(getErrorMessage(data, "Failed to send message."));
      }
      setMessage("");
      await refreshTicket();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send message.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async () => {
    setError(null);
    setActionLoading("close");
    try {
      const response = await csrfFetch(`/api/tickets/${ticket.id}/close`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: unknown };
        throw new Error(getErrorMessage(data, "Failed to close ticket."));
      }
      await refreshTicket();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to close ticket.",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleReopen = async () => {
    setError(null);
    setActionLoading("reopen");
    try {
      const response = await csrfFetch(`/api/tickets/${ticket.id}/reopen`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: unknown };
        throw new Error(getErrorMessage(data, "Failed to reopen ticket."));
      }
      await refreshTicket();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reopen ticket.",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const staffLabel = useMemo(() => {
    if (!isStaff) return null;
    return viewer.siteRole === "ADMIN" ? "Admin view" : "Moderator view";
  }, [isStaff, viewer.siteRole]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className={buttonStyles({ variant: "ghost", size: "sm" })}
        >
          Back to tickets
        </Link>
        {staffLabel ? (
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
            {staffLabel}
          </span>
        ) : null}
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
              {categoryLabels[ticket.category]}
            </p>
            <h1 className="text-2xl font-semibold md:text-3xl">
              {ticket.subject}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-muted)]">
              <span>Opened by</span>
              <UserChip
                userId={ticket.createdBy.id}
                displayName={ticket.createdBy.displayName}
                avatarUrl={ticket.createdBy.avatarUrl}
                viewerId={viewer.id}
              />
              <span>on {formatDateTime(ticket.createdAt)}</span>
            </div>
          </div>
          <TicketStatusBadge status={ticket.status} />
        </div>

        {isStaff ? (
          <div className="flex flex-wrap gap-2">
            {isClosed ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReopen}
                disabled={actionLoading === "reopen"}
              >
                {actionLoading === "reopen" ? "Reopening..." : "Reopen ticket"}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={actionLoading === "close"}
              >
                {actionLoading === "close" ? "Closing..." : "Close ticket"}
              </Button>
            )}
          </div>
        ) : null}
      </Card>

      <div className="space-y-3">
        {messages.map((entry) => {
          const isMine = entry.author.id === viewer.id;
          const messageIsStaff = isModOrAdmin(entry.author.siteRole);
          return (
            <div
              key={entry.id}
              className={cn(
                "flex w-full",
                isMine ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[680px] space-y-2 rounded-2xl border border-[color:var(--color-line)] px-4 py-3 shadow-[var(--shadow-soft)]",
                  isMine
                    ? "bg-[color:var(--color-brand)] text-white"
                    : "bg-white/80 text-[color:var(--color-ink)]",
                )}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <UserChip
                    userId={entry.author.id}
                    displayName={entry.author.displayName}
                    avatarUrl={entry.author.avatarUrl}
                    viewerId={viewer.id}
                  />
                  {messageIsStaff ? (
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        isMine
                          ? "border-white/40 text-white/80"
                          : "border-slate-200 text-slate-600",
                      )}
                    >
                      Staff
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "text-[11px]",
                      isMine ? "text-white/70" : "text-[color:var(--color-muted)]",
                    )}
                  >
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm">
                  {entry.message}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <Card className="space-y-4">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold">Reply</h2>
          {isClosed ? (
            <p className="text-xs text-[color:var(--color-muted)]">
              This ticket is closed. Staff can reopen it if needed.
            </p>
          ) : null}
        </header>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write your reply..."
            maxLength={MAX_MESSAGE_LENGTH}
            rows={6}
            disabled={isClosed || submitting}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[color:var(--color-muted)]">
            <span>
              {message.length}/{MAX_MESSAGE_LENGTH}
            </span>
            <Button type="submit" size="sm" disabled={isClosed || submitting}>
              {submitting ? "Sending..." : "Send reply"}
            </Button>
          </div>
        </form>
      </Card>

      {error ? (
        <Card className="text-sm text-red-700">
          {error}
        </Card>
      ) : null}
    </div>
  );
}
