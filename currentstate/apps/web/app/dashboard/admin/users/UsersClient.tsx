"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { buttonStyles } from "@/components/ui/Button";
import { formatDate } from "@/lib/dashboard/format";
import UserChip from "@/components/users/UserChip";

type UserItem = {
  id: string;
  displayName: string;
  discordId: string;
  avatarUrl: string | null;
  siteRole: "USER" | "MOD" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  createdAt: string;
};

type UsersResponse = {
  items: UserItem[];
  nextCursor: string | null;
};

const roleOptions = ["All", "USER", "MOD", "ADMIN"] as const;
const statusOptions = ["All", "ACTIVE", "SUSPENDED", "BANNED"] as const;

const roleStyles: Record<UserItem["siteRole"], string> = {
  USER: "border-slate-200 text-slate-600 bg-slate-50/70",
  MOD: "border-amber-200 text-amber-700 bg-amber-50/70",
  ADMIN: "border-purple-200 text-purple-700 bg-purple-50/70",
};

const statusStyles: Record<UserItem["status"], string> = {
  ACTIVE: "border-green-200 text-green-700 bg-green-50/70",
  SUSPENDED: "border-amber-200 text-amber-700 bg-amber-50/70",
  BANNED: "border-red-200 text-red-700 bg-red-50/70",
};

export default function UsersClient() {
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<(typeof roleOptions)[number]>("All");
  const [status, setStatus] =
    useState<(typeof statusOptions)[number]>("All");
  const [items, setItems] = useState<UserItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(
    async (cursor?: string | null, replace = false) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (query) params.set("query", query);
        if (role !== "All") params.set("role", role);
        if (status !== "All") params.set("status", status);
        if (cursor) params.set("cursor", cursor);
        const response = await csrfFetch(`/api/admin/users?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Failed to load users.");
        }
        const data = (await response.json()) as UsersResponse;
        setItems((prev) => (replace ? data.items : [...prev, ...data.items]));
        setNextCursor(data.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load users.");
      } finally {
        setLoading(false);
      }
    },
    [query, role, status],
  );

  useEffect(() => {
    fetchUsers(null, true);
  }, [fetchUsers]);

  const applyFilters = () => {
    setQuery(queryInput.trim());
  };

  useEffect(() => {
    fetchUsers(null, true);
  }, [query, role, status, fetchUsers]);

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
          <Input
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="Search display name or Discord ID"
          />
          <select
            value={role}
            onChange={(event) =>
              setRole(event.target.value as (typeof roleOptions)[number])
            }
            className="h-11 rounded-2xl border border-[color:var(--color-line)] bg-white/80 px-4 text-sm text-[color:var(--color-ink)] shadow-[var(--shadow-soft)]"
          >
            {roleOptions.map((option) => (
              <option key={option} value={option}>
                Role: {option}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as (typeof statusOptions)[number])
            }
            className="h-11 rounded-2xl border border-[color:var(--color-line)] bg-white/80 px-4 text-sm text-[color:var(--color-ink)] shadow-[var(--shadow-soft)]"
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                Status: {option}
              </option>
            ))}
          </select>
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
            onClick={() => fetchUsers(null, true)}
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
          No users matched your filters.
        </Card>
      ) : null}

      {items.length > 0 ? (
        <div className="grid gap-3">
          {items.map((user) => (
            <Card key={user.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <UserChip
                    userId={user.id}
                    displayName={user.displayName}
                    avatarUrl={user.avatarUrl}
                  />
                  <p className="text-xs text-[color:var(--color-muted)]">
                    Discord ID: {user.discordId}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wide ${roleStyles[user.siteRole]}`}
                  >
                    {user.siteRole}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wide ${statusStyles[user.status]}`}
                  >
                    {user.status}
                  </span>
                  <span className="text-[color:var(--color-muted)]">
                    Joined {formatDate(user.createdAt)}
                  </span>
                </div>
              </div>
              <div>
                <Link
                  href={`/dashboard/admin/users/${user.id}`}
                  className={buttonStyles({ variant: "outline", size: "sm" })}
                >
                  Open
                </Link>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {nextCursor ? (
        <button
          type="button"
          className={buttonStyles({ variant: "outline", size: "sm" })}
          onClick={() => fetchUsers(nextCursor)}
          disabled={loading}
        >
          {loading ? "Loading..." : "Load more"}
        </button>
      ) : null}
    </div>
  );
}
