"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useMemo, useState } from "react";

import UserChip from "@/components/users/UserChip";
import Card from "@/components/ui/Card";
import CompanyRoleBadge from "@/components/company/CompanyRoleBadge";
import { buttonStyles } from "@/components/ui/Button";
import { formatDate } from "@/lib/dashboard/format";
import {
  canAssignCoOwner,
  companyRoleLabels,
  isCompanyManager,
  type CompanyRoleValue,
} from "@/lib/company/roles";

type MemberItem = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  companyRole: CompanyRoleValue;
  joinedAt: string;
};

type CompanyMembersClientProps = {
  companyId: string;
  viewerRole: CompanyRoleValue;
  refreshKey?: number;
  onChange?: () => void;
};

export default function CompanyMembersClient({
  companyId,
  viewerRole,
  refreshKey,
  onChange,
}: CompanyMembersClientProps) {
  const [items, setItems] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const canManage = isCompanyManager(viewerRole);
  const canPromoteCoOwner = canAssignCoOwner(viewerRole);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await csrfFetch(`/api/company/${companyId}/members`);
      if (!response.ok) {
        throw new Error("Failed to load company members.");
      }
      const data = (await response.json()) as { items: MemberItem[] };
      setItems(data.items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load company members.",
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers, refreshKey]);

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
      <Card className="text-sm text-[color:var(--color-muted)]">
        {error}
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="text-sm text-[color:var(--color-muted)]">
        No members yet.
      </Card>
    );
  }

  const roleOptions = useMemo(() => {
    const base: CompanyRoleValue[] = ["MEMBER", "TRUSTED"];
    if (canPromoteCoOwner) {
      base.push("CO_OWNER");
    }
    return base;
  }, [canPromoteCoOwner]);

  const handleRoleChange = async (
    member: MemberItem,
    nextRole: CompanyRoleValue,
  ) => {
    setActionError(null);
    setSavingId(member.id);
    try {
      const response = await csrfFetch(
        `/api/company/${companyId}/members/${member.id}/role`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: nextRole }),
        },
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to update role.");
      }
      await fetchMembers();
      onChange?.();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update role.",
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleRemove = async (member: MemberItem) => {
    setActionError(null);
    setRemovingId(member.id);
    try {
      const response = await csrfFetch(
        `/api/company/${companyId}/members/${member.id}/remove`,
        { method: "POST" },
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to remove member.");
      }
      await fetchMembers();
      onChange?.();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to remove member.",
      );
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {actionError ? (
        <Card className="text-sm text-red-700">{actionError}</Card>
      ) : null}
      <div className="grid gap-3">
        {items.map((member) => {
          const isOwner = member.companyRole === "OWNER";
          const isCoOwner = member.companyRole === "CO_OWNER";
          const canEditMember =
            canManage &&
            !isOwner &&
            (!isCoOwner || canPromoteCoOwner);

          return (
            <Card
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <UserChip
                  userId={member.id}
                  displayName={member.displayName}
                  avatarUrl={member.avatarUrl}
                />
                <p className="text-xs text-[color:var(--color-muted)]">
                  Joined {formatDate(member.joinedAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canEditMember ? (
                  <select
                    value={member.companyRole}
                    onChange={(event) =>
                      handleRoleChange(
                        member,
                        event.target.value as CompanyRoleValue,
                      )
                    }
                    className="h-9 rounded-2xl border border-[color:var(--color-line)] bg-white/80 px-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)] shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]"
                    disabled={savingId === member.id}
                  >
                    <option value={member.companyRole}>
                      {companyRoleLabels[member.companyRole]}
                    </option>
                    {roleOptions
                      .filter((role) => role !== member.companyRole)
                      .map((role) => (
                        <option key={role} value={role}>
                          {companyRoleLabels[role]}
                        </option>
                      ))}
                  </select>
                ) : (
                  <CompanyRoleBadge role={member.companyRole} />
                )}
                {canEditMember ? (
                  <button
                    type="button"
                    className={buttonStyles({ variant: "ghost", size: "sm" })}
                    onClick={() => handleRemove(member)}
                    disabled={removingId === member.id}
                  >
                    {removingId === member.id ? "Removing..." : "Remove"}
                  </button>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
