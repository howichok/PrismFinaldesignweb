"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import Textarea from "@/components/ui/Textarea";
import { buttonStyles } from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import StatusBadge from "@/components/dashboard/StatusBadge";
import UserChip from "@/components/users/UserChip";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dashboard/format";

type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

type ModerationRequestPayload = {
  id: string;
  status: RequestStatus;
  targetType: "POST" | "PROJECT" | "COMPANY";
  createdAt: string;
  reviewedAt: string | null;
  reason: string | null;
  submittedBy: { id: string; displayName: string; avatarUrl: string | null };
  reviewedBy:
    | { id: string; displayName: string; avatarUrl: string | null }
    | null;
};

type ModerationTarget =
  | {
      type: "POST";
      id: string;
      title: string;
      content: string;
      tags: string[];
      ownerType: "USER" | "COMPANY";
      ownerDisplay: string;
    }
  | {
      type: "PROJECT";
      id: string;
      name: string;
      description: string;
      tags: string[];
      projectStatus: "IN_PROGRESS" | "RELEASED" | "FROZEN";
      ownerType: "USER" | "COMPANY";
      ownerDisplay: string;
    }
  | {
      type: "COMPANY";
      id: string;
      name: string;
      description: string;
      categories: string[];
      logoUrl: string | null;
      ownerDisplay: string;
    };

type ModerationDetail = {
  request: ModerationRequestPayload;
  target: ModerationTarget;
};

type Notice = { type: "success" | "error"; message: string } | null;

const projectStatusStyles: Record<
  "IN_PROGRESS" | "RELEASED" | "FROZEN",
  string
> = {
  IN_PROGRESS: "border-[color:var(--color-line)] text-[color:var(--color-muted)]",
  RELEASED: "border-green-200 text-green-700 bg-green-50/60",
  FROZEN: "border-blue-200 text-blue-700 bg-blue-50/60",
};

function formatProjectStatus(status: "IN_PROGRESS" | "RELEASED" | "FROZEN") {
  switch (status) {
    case "RELEASED":
      return "Released";
    case "FROZEN":
      return "Frozen";
    default:
      return "In progress";
  }
}

export default function ModerationDetailClient({
  requestId,
}: {
  requestId: string;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<ModerationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const canDeny = reason.trim().length > 0;

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const response = await csrfFetch(`/api/moderation/${requestId}`);
      if (!response.ok) {
        throw new Error("Request not found.");
      }
      const payload = (await response.json()) as ModerationDetail;
      setDetail(payload);
      setReason(payload.request.reason ?? "");
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to load request.",
      });
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleApprove = async () => {
    if (!detail) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await csrfFetch(
        `/api/moderation/${detail.request.id}/approve`,
        { method: "POST" },
      );
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to approve request.");
      }
      setNotice({ type: "success", message: "Request approved." });
      await fetchDetail();
      router.refresh();
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to approve request.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeny = async () => {
    if (!detail) return;
    if (!reason.trim()) {
      setNotice({ type: "error", message: "Reason is required to deny." });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const response = await csrfFetch(
        `/api/moderation/${detail.request.id}/deny`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to deny request.");
      }
      setNotice({ type: "success", message: "Request rejected." });
      await fetchDetail();
      router.refresh();
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unable to deny request.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="space-y-3">
          <div className="h-4 w-1/3 animate-pulse rounded-full bg-[color:var(--color-line)]" />
          <div className="h-3 w-1/2 animate-pulse rounded-full bg-[color:var(--color-line)]" />
        </Card>
        <Card className="space-y-3">
          <div className="h-4 w-1/2 animate-pulse rounded-full bg-[color:var(--color-line)]" />
          <div className="h-20 w-full animate-pulse rounded-2xl bg-[color:var(--color-line)]" />
        </Card>
      </div>
    );
  }

  if (!detail) {
    return (
      <Card className="text-sm text-[color:var(--color-muted)]">
        Request not found.
      </Card>
    );
  }

  const { request, target } = detail;
  const isPending = request.status === "PENDING";

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Moderation request</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Review submission details and approve or deny.
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

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
              {request.targetType}
            </p>
            <h3 className="text-lg font-semibold">Request {request.id}</h3>
          </div>
          <StatusBadge status={request.status} />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--color-muted)]">
          <span>Submitted by</span>
          <UserChip
            userId={request.submittedBy.id}
            displayName={request.submittedBy.displayName}
            avatarUrl={request.submittedBy.avatarUrl}
          />
          <span>Created {formatDate(request.createdAt)}</span>
        </div>
        {request.reviewedAt && request.reviewedBy ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-muted)]">
            <span>Reviewed by</span>
            <UserChip
              userId={request.reviewedBy.id}
              displayName={request.reviewedBy.displayName}
              avatarUrl={request.reviewedBy.avatarUrl}
            />
            <span>on {formatDate(request.reviewedAt)}</span>
          </div>
        ) : null}
        {request.status === "REJECTED" && request.reason ? (
          <p className="text-sm text-red-600">Reason: {request.reason}</p>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
              Target preview
            </p>
            <p className="text-sm text-[color:var(--color-muted)]">
              Owner {target.ownerDisplay}
              {"ownerType" in target ? ` (${target.ownerType})` : ""}
            </p>
          </div>
          {target.type === "PROJECT" ? (
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                projectStatusStyles[target.projectStatus],
              )}
            >
              {formatProjectStatus(target.projectStatus)}
            </span>
          ) : null}
        </div>

        {target.type === "POST" ? (
          <div className="space-y-3">
            <h3 className="text-xl font-semibold">{target.title}</h3>
            <div className="flex flex-wrap gap-2">
              {target.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[color:var(--color-line)] bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="max-h-64 overflow-y-auto rounded-2xl border border-[color:var(--color-line)] bg-white/70 p-4 text-sm text-[color:var(--color-muted)]">
              {target.content}
            </div>
          </div>
        ) : null}

        {target.type === "PROJECT" ? (
          <div className="space-y-3">
            <h3 className="text-xl font-semibold">{target.name}</h3>
            <p className="text-sm text-[color:var(--color-muted)]">
              {target.description}
            </p>
            <div className="flex flex-wrap gap-2">
              {target.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[color:var(--color-line)] bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {target.type === "COMPANY" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar
                size="sm"
                label={target.name}
                src={target.logoUrl}
              />
              <h3 className="text-xl font-semibold">{target.name}</h3>
            </div>
            <p className="text-sm text-[color:var(--color-muted)]">
              {target.description}
            </p>
            <div className="flex flex-wrap gap-2">
              {target.categories.map((category) => (
                <span
                  key={category}
                  className="rounded-full border border-[color:var(--color-line)] bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]"
                >
                  {category}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="space-y-3">
        <h3 className="text-lg font-semibold">Decision</h3>
        <p className="text-sm text-[color:var(--color-muted)]">
          Denials require a clear reason that will be shared with the author.
        </p>
        <Textarea
          rows={4}
          placeholder="Reason for denial (required)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={!isPending || saving}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonStyles({ variant: "primary", size: "sm" })}
            onClick={handleApprove}
            disabled={!isPending || saving}
          >
            Approve
          </button>
          <button
            type="button"
            className={cn(
              buttonStyles({ variant: "outline", size: "sm" }),
              "border-red-200 text-red-700 hover:border-red-300 hover:text-red-800",
            )}
            onClick={handleDeny}
            disabled={!isPending || saving || !canDeny}
          >
            Deny
          </button>
        </div>
      </Card>
    </div>
  );
}
