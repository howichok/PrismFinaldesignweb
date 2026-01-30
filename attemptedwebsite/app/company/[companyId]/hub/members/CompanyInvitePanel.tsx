"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useEffect, useMemo, useState } from "react";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button, { buttonStyles } from "@/components/ui/Button";
import UserChip from "@/components/users/UserChip";
import {
  canAssignCoOwner,
  companyRoleLabels,
  isCompanyManager,
  type CompanyRoleValue,
} from "@/lib/company/roles";

type UserResult = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

type CompanyInvitePanelProps = {
  companyId: string;
  viewerRole: CompanyRoleValue;
  onInviteSent?: () => void;
};

const inviteRoleLabels: Record<"MEMBER" | "TRUSTED" | "CO_OWNER", string> = {
  MEMBER: companyRoleLabels.MEMBER,
  TRUSTED: companyRoleLabels.TRUSTED,
  CO_OWNER: companyRoleLabels.CO_OWNER,
};

export default function CompanyInvitePanel({
  companyId,
  viewerRole,
  onInviteSent,
}: CompanyInvitePanelProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [offeredRole, setOfferedRole] =
    useState<"MEMBER" | "TRUSTED" | "CO_OWNER">("MEMBER");
  const [error, setError] = useState<string | null>(null);

  const canManage = isCompanyManager(viewerRole);
  const canInviteCoOwner = canAssignCoOwner(viewerRole);

  const inviteRoles = useMemo(() => {
    const base: Array<"MEMBER" | "TRUSTED" | "CO_OWNER"> = [
      "MEMBER",
      "TRUSTED",
    ];
    if (canInviteCoOwner) {
      base.push("CO_OWNER");
    }
    return base;
  }, [canInviteCoOwner]);

  useEffect(() => {
    if (!canInviteCoOwner && offeredRole === "CO_OWNER") {
      setOfferedRole("MEMBER");
    }
  }, [canInviteCoOwner, offeredRole]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebounced(query.trim());
    }, 400);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (!canManage) return;
    if (debounced.length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    csrfFetch(`/api/users/search?query=${encodeURIComponent(debounced)}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to search users.");
        }
        return response.json() as Promise<{ items: UserResult[] }>;
      })
      .then((data) => {
        setResults(data.items);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(
          err instanceof Error ? err.message : "Failed to search users.",
        );
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [debounced, canManage]);

  const handleInvite = async () => {
    if (!selectedUser) return;
    setError(null);
    try {
      const response = await csrfFetch(`/api/company/${companyId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId: selectedUser.id,
          offeredRole,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to send invite.");
      }

      setSelectedUser(null);
      setQuery("");
      setResults([]);
      onInviteSent?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send invite.",
      );
    }
  };

  if (!canManage) {
    return null;
  }

  return (
    <Card className="space-y-4">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold">Invite member</h3>
        <p className="text-sm text-[color:var(--color-muted)]">
          Invite a teammate by display name. Invitations are required to join.
        </p>
      </header>

      <div className="space-y-2">
        <Input
          placeholder="Search users by display name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {debounced.length > 0 && debounced.length < 2 ? (
          <p className="text-xs text-[color:var(--color-muted)]">
            Enter at least 2 characters to search.
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50/70 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

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

      {!loading && results.length > 0 ? (
        <div className="space-y-2">
          {results.map((user) => (
            <div
              key={user.id}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[color:var(--color-line)] bg-white/80 p-3 text-left shadow-[var(--shadow-soft)]"
            >
              <UserChip
                userId={user.id}
                displayName={user.displayName}
                avatarUrl={user.avatarUrl}
              />
              <button
                type="button"
                className={buttonStyles({ size: "sm", variant: "outline" })}
                onClick={() => setSelectedUser(user)}
              >
                Select
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && debounced.length >= 2 && results.length === 0 ? (
        <p className="text-sm text-[color:var(--color-muted)]">
          No matching users found.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={offeredRole}
          onChange={(event) =>
            setOfferedRole(event.target.value as "MEMBER" | "TRUSTED" | "CO_OWNER")
          }
          className="h-11 rounded-2xl border border-[color:var(--color-line)] bg-white/80 px-4 text-sm text-[color:var(--color-ink)] shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]"
        >
          {inviteRoles.map((role) => (
            <option key={role} value={role}>
              {inviteRoleLabels[role]}
            </option>
          ))}
        </select>

        <Button
          type="button"
          disabled={!selectedUser}
          onClick={handleInvite}
        >
          Send invite
        </Button>

        {selectedUser ? (
          <button
            type="button"
            className={buttonStyles({ variant: "ghost", size: "sm" })}
            onClick={() => setSelectedUser(null)}
          >
            Clear selection
          </button>
        ) : null}
      </div>

      {selectedUser ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-muted)]">
          <span>Inviting</span>
          <UserChip
            userId={selectedUser.id}
            displayName={selectedUser.displayName}
            avatarUrl={selectedUser.avatarUrl}
          />
          <span>as {inviteRoleLabels[offeredRole]}.</span>
        </div>
      ) : null}
    </Card>
  );
}
