"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useMemo, useState } from "react";

import Card from "@/components/ui/Card";
import { buttonStyles } from "@/components/ui/Button";
import { formatDate } from "@/lib/dashboard/format";
import UserChip from "@/components/users/UserChip";
import {
  canAssignCoOwner,
  isCompanyManager,
  type CompanyRoleValue,
} from "@/lib/company/roles";

type PendingInvite = {
  id: string;
  offeredRole: "MEMBER" | "TRUSTED" | "CO_OWNER" | null;
  createdAt: string;
  toUser: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  invitedBy: string;
};

type PendingInvitesListProps = {
  companyId: string;
  viewerRole: CompanyRoleValue;
  refreshKey?: number;
  onChange?: () => void;
};

const inviteRoleLabels: Record<"MEMBER" | "TRUSTED" | "CO_OWNER", string> = {
  MEMBER: "Member",
  TRUSTED: "Trusted",
  CO_OWNER: "Co-owner",
};

export default function PendingInvitesList({
  companyId,
  viewerRole,
  refreshKey,
  onChange,
}: PendingInvitesListProps) {
  const [items, setItems] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const canManage = isCompanyManager(viewerRole);
  const canCancelCoOwner = canAssignCoOwner(viewerRole);

  const fetchInvites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await csrfFetch(
        `/api/company/${companyId}/invites?status=pending`,
      );
      if (!response.ok) {
        throw new Error("Failed to load invites.");
      }
      const data = (await response.json()) as { items: PendingInvite[] };
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invites.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites, refreshKey]);

  const emptyState = useMemo(() => {
    return "No pending invites right now.";
  }, []);

  const handleCancel = async (invite: PendingInvite) => {
    if (!canManage) return;
    if (invite.offeredRole === "CO_OWNER" && !canCancelCoOwner) return;
    setCancelingId(invite.id);
    try {
      const response = await csrfFetch(
        `/api/company/${companyId}/invites/${invite.id}/cancel`,
        { method: "POST" },
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to cancel invite.");
      }
      await fetchInvites();
      onChange?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to cancel invite.",
      );
    } finally {
      setCancelingId(null);
    }
  };

  return (
    <Card className="space-y-4">
      <header>
        <h3 className="text-lg font-semibold">Pending invites</h3>
      </header>

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="h-10 w-full animate-pulse rounded-2xl bg-[color:var(--color-line)]"
            />
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="text-sm text-red-700">{error}</div>
      ) : null}

      {!loading && items.length === 0 ? (
        <p className="text-sm text-[color:var(--color-muted)]">
          {emptyState}
        </p>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="space-y-2">
          {items.map((invite) => (
            <div
              key={invite.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--color-line)] bg-white/80 p-3 shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-center gap-3">
                {invite.toUser ? (
                  <UserChip
                    userId={invite.toUser.id}
                    displayName={invite.toUser.displayName}
                    avatarUrl={invite.toUser.avatarUrl}
                  />
                ) : (
                  <span className="text-sm font-semibold">Unknown user</span>
                )}
                <p className="text-xs text-[color:var(--color-muted)]">
                  Role{" "}
                  {invite.offeredRole
                    ? inviteRoleLabels[invite.offeredRole]
                    : "Member"}{" "}
                  · Invited by {invite.invitedBy} · {formatDate(invite.createdAt)}
                </p>
              </div>
              {canManage ? (
                <button
                  type="button"
                  className={buttonStyles({ variant: "ghost", size: "sm" })}
                  onClick={() => handleCancel(invite)}
                  disabled={
                    cancelingId === invite.id ||
                    (invite.offeredRole === "CO_OWNER" && !canCancelCoOwner)
                  }
                >
                  {cancelingId === invite.id ? "Canceling..." : "Cancel"}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
