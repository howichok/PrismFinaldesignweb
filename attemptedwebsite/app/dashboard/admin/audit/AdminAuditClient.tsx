"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import Card from "@/components/ui/Card";
import UserChip from "@/components/users/UserChip";
import Input from "@/components/ui/Input";
import { buttonStyles } from "@/components/ui/Button";
import { formatDate } from "@/lib/dashboard/format";

type AuditItem = {
  id: string;
  createdAt: string;
  actionType: string;
  targetType: string;
  targetId: string;
  meta: unknown | null;
  actor: { id: string; displayName: string; avatarUrl: string | null } | null;
};

type AuditResponse = {
  items: AuditItem[];
  nextCursor: string | null;
};

export default function AdminAuditClient() {
  const [actorInput, setActorInput] = useState("");
  const [actionInput, setActionInput] = useState("");
  const [targetInput, setTargetInput] = useState("");
  const [actorId, setActorId] = useState("");
  const [actionType, setActionType] = useState("");
  const [targetType, setTargetType] = useState("");
  const [items, setItems] = useState<AuditItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(
    async (cursor?: string | null, replace = false) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (actorId) params.set("actorId", actorId);
        if (actionType) params.set("actionType", actionType);
        if (targetType) params.set("targetType", targetType);
        if (cursor) params.set("cursor", cursor);

        const response = await csrfFetch(`/api/admin/audit?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Failed to load audit logs.");
        }
        const payload = (await response.json()) as AuditResponse;
        setItems((prev) => (replace ? payload.items : [...prev, ...payload.items]));
        setNextCursor(payload.nextCursor);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load audit logs.",
        );
      } finally {
        setLoading(false);
      }
    },
    [actionType, actorId, targetType],
  );

  useEffect(() => {
    fetchLogs(null, true);
  }, [fetchLogs]);

  const applyFilters = () => {
    setActorId(actorInput.trim());
    setActionType(actionInput.trim());
    setTargetType(targetInput.trim());
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_auto]">
          <Input
            value={actorInput}
            onChange={(event) => setActorInput(event.target.value)}
            placeholder="Filter by actor user ID"
          />
          <Input
            value={actionInput}
            onChange={(event) => setActionInput(event.target.value)}
            placeholder="Action type"
          />
          <Input
            value={targetInput}
            onChange={(event) => setTargetInput(event.target.value)}
            placeholder="Target type"
          />
          <button
            type="button"
            className={buttonStyles({ variant: "primary", size: "sm" })}
            onClick={applyFilters}
          >
            Apply
          </button>
        </div>
      </Card>

      {error ? (
        <Card className="space-y-2 text-sm text-[color:var(--color-muted)]">
          <p>{error}</p>
          <button
            type="button"
            className={buttonStyles({ variant: "outline", size: "sm" })}
            onClick={() => fetchLogs(null, true)}
          >
            Retry
          </button>
        </Card>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((item) => (
            <Card key={item} className="space-y-3">
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-[color:var(--color-line)]" />
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-[color:var(--color-line)]" />
            </Card>
          ))}
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <Card className="text-sm text-[color:var(--color-muted)]">
          No audit logs match your filters.
        </Card>
      ) : null}

      {items.length > 0 ? (
        <div className="grid gap-3">
          {items.map((log) => (
            <Card key={log.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{log.actionType}</p>
                  <p className="text-xs text-[color:var(--color-muted)]">
                    {log.targetType} {log.targetId}
                  </p>
                  {log.actor ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-muted)]">
                      <span>Actor:</span>
                      <UserChip
                        userId={log.actor.id}
                        displayName={log.actor.displayName}
                        avatarUrl={log.actor.avatarUrl}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-[color:var(--color-muted)]">
                      Actor: Unknown
                    </p>
                  )}
                </div>
                <span className="text-xs text-[color:var(--color-muted)]">
                  {formatDate(log.createdAt)}
                </span>
              </div>
              {log.meta ? (
                <pre className="whitespace-pre-wrap rounded-2xl border border-[color:var(--color-line)] bg-white/70 p-3 text-xs text-[color:var(--color-muted)]">
                  {JSON.stringify(log.meta, null, 2)}
                </pre>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}

      {nextCursor ? (
        <button
          type="button"
          className={buttonStyles({ variant: "outline", size: "sm" })}
          onClick={() => fetchLogs(nextCursor)}
          disabled={loading}
        >
          {loading ? "Loading..." : "Load more"}
        </button>
      ) : null}
    </div>
  );
}
