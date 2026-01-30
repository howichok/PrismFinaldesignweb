"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import Card from "@/components/ui/Card";
import Tabs from "@/components/ui/Tabs";
import { buttonStyles } from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import StatusBadge from "@/components/dashboard/StatusBadge";
import UserChip from "@/components/users/UserChip";
import { formatDate } from "@/lib/dashboard/format";

type UserDetail = {
  id: string;
  displayName: string;
  discordId: string;
  avatarUrl: string | null;
  siteRole: "USER" | "MOD" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  rolesVersion: number;
  createdAt: string;
  updatedAt: string;
};

type ContentItem = {
  id: string;
  title?: string;
  name?: string;
  status: string;
  isHidden: boolean;
  updatedAt?: string;
  createdAt?: string;
  publishedAt?: string | null;
};

type UpdateItem = {
  id: string;
  title: string;
  status: "PUBLISHED" | "PENDING" | "REJECTED";
  isHidden: boolean;
  createdAt: string;
  publishedAt: string | null;
  project: { id: string; name: string };
};

type MembershipItem = {
  companyRole: "OWNER" | "CO_OWNER" | "TRUSTED" | "MEMBER";
  company: { id: string; name: string; logoUrl: string | null };
};

type TicketItem = {
  id: string;
  subject: string;
  status: "OPEN" | "ANSWERED" | "CLOSED";
  updatedAt: string;
};

type UserDetailResponse = {
  viewerRole: "USER" | "MOD" | "ADMIN";
  user: UserDetail;
  posts: ContentItem[];
  projects: ContentItem[];
  companies: ContentItem[];
  updates: UpdateItem[];
  memberships: MembershipItem[];
  tickets: TicketItem[];
};

const tabs = ["Overview", "Roles & Status", "Content", "Companies", "Tickets"] as const;
type TabKey = (typeof tabs)[number];
type BadgeStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "PUBLISHED";

const roleStyles: Record<UserDetail["siteRole"], string> = {
  USER: "border-slate-200 text-slate-600 bg-slate-50/70",
  MOD: "border-amber-200 text-amber-700 bg-amber-50/70",
  ADMIN: "border-purple-200 text-purple-700 bg-purple-50/70",
};

const statusStyles: Record<UserDetail["status"], string> = {
  ACTIVE: "border-green-200 text-green-700 bg-green-50/70",
  SUSPENDED: "border-amber-200 text-amber-700 bg-amber-50/70",
  BANNED: "border-red-200 text-red-700 bg-red-50/70",
};

type UserDetailClientProps = {
  userId: string;
};

export default function UserDetailClient({ userId }: UserDetailClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("Overview");
  const [data, setData] = useState<UserDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roleInput, setRoleInput] = useState<UserDetail["siteRole"]>("USER");
  const [statusInput, setStatusInput] = useState<UserDetail["status"]>("ACTIVE");

  const loadUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await csrfFetch(`/api/admin/users/${userId}`);
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to load user.");
      }
      const payload = (await response.json()) as UserDetailResponse;
      setData(payload);
      setRoleInput(payload.user.siteRole);
      setStatusInput(payload.user.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const isAdmin = data?.viewerRole === "ADMIN";

  const updateRole = async () => {
    if (!data) return;
    if (!isAdmin) {
      setNotice("Only admins can update roles.");
      return;
    }
    if (!window.confirm(`Change role to ${roleInput}?`)) return;
    setNotice(null);
    try {
      const response = await csrfFetch(`/api/admin/users/${userId}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteRole: roleInput }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update role.");
      }
      setNotice("Role updated.");
      await loadUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role.");
    }
  };

  const updateStatus = async () => {
    if (!data) return;
    if (!isAdmin) {
      setNotice("Only admins can update status.");
      return;
    }
    if (!window.confirm(`Change status to ${statusInput}?`)) return;
    setNotice(null);
    try {
      const response = await csrfFetch(`/api/admin/users/${userId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusInput }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update status.");
      }
      setNotice("Status updated.");
      await loadUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    }
  };

  const bumpRoles = async () => {
    if (!data) return;
    if (!isAdmin) {
      setNotice("Only admins can refresh sessions.");
      return;
    }
    if (!window.confirm("Force session refresh for this user?")) return;
    setNotice(null);
    try {
      const response = await csrfFetch(
        `/api/admin/users/${userId}/bump-roles-version`,
        { method: "POST" },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to refresh roles.");
      }
      setNotice("Roles version bumped.");
      await loadUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh roles.");
    }
  };

  const removeMembership = async (companyId: string) => {
    if (!isAdmin) {
      setNotice("Only admins can remove memberships.");
      return;
    }
    if (!window.confirm("Remove this user from the company?")) return;
    setNotice(null);
    try {
      const response = await csrfFetch(
        `/api/admin/users/${userId}/memberships/${companyId}/remove`,
        { method: "POST" },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to remove membership.");
      }
      setNotice("Membership removed.");
      await loadUser();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove membership.",
      );
    }
  };

  if (loading) {
    return (
      <Card className="space-y-3">
        <div className="h-4 w-1/2 animate-pulse rounded-full bg-[color:var(--color-line)]" />
        <div className="h-10 w-full animate-pulse rounded-2xl bg-[color:var(--color-line)]" />
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="space-y-2 text-sm text-[color:var(--color-muted)]">
        <p>{error ?? "User not found."}</p>
        <button
          type="button"
          className={buttonStyles({ variant: "outline", size: "sm" })}
          onClick={loadUser}
        >
          Retry
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <UserChip
          userId={data.user.id}
          displayName={data.user.displayName}
          avatarUrl={data.user.avatarUrl}
        />
        <p className="text-sm text-[color:var(--color-muted)]">
          Discord ID: {data.user.discordId}
        </p>
      </header>

      {notice ? (
        <Card className="text-sm text-[color:var(--color-muted)]">
          {notice}
        </Card>
      ) : null}

      <Tabs
        items={[...tabs]}
        value={activeTab}
        onChange={(value) => setActiveTab(value as TabKey)}
      />

      {activeTab === "Overview" ? (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wide ${roleStyles[data.user.siteRole]}`}
            >
              {data.user.siteRole}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wide ${statusStyles[data.user.status]}`}
            >
              {data.user.status}
            </span>
          </div>
          <p className="text-sm text-[color:var(--color-muted)]">
            Joined {formatDate(data.user.createdAt)} | Updated{" "}
            {formatDate(data.user.updatedAt)}
          </p>
          <p className="text-sm text-[color:var(--color-muted)]">
            Roles version: {data.user.rolesVersion}
          </p>
        </Card>
      ) : null}

      {activeTab === "Roles & Status" ? (
        <Card className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                Site role
              </label>
              <select
                value={roleInput}
                onChange={(event) =>
                  setRoleInput(event.target.value as UserDetail["siteRole"])
                }
                className="h-11 rounded-2xl border border-[color:var(--color-line)] bg-white/80 px-4 text-sm"
                disabled={!isAdmin}
              >
                <option value="USER">USER</option>
                <option value="MOD">MOD</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                Status
              </label>
              <select
                value={statusInput}
                onChange={(event) =>
                  setStatusInput(event.target.value as UserDetail["status"])
                }
                className="h-11 rounded-2xl border border-[color:var(--color-line)] bg-white/80 px-4 text-sm"
                disabled={!isAdmin}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="BANNED">BANNED</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonStyles({ variant: "primary", size: "sm" })}
              onClick={updateRole}
              disabled={!isAdmin}
            >
              Update role
            </button>
            <button
              type="button"
              className={buttonStyles({ variant: "outline", size: "sm" })}
              onClick={updateStatus}
              disabled={!isAdmin}
            >
              Update status
            </button>
            <button
              type="button"
              className={buttonStyles({ variant: "ghost", size: "sm" })}
              onClick={bumpRoles}
              disabled={!isAdmin}
            >
              Force session refresh
            </button>
          </div>
        </Card>
      ) : null}

      {activeTab === "Content" ? (
        <div className="space-y-4">
          <Card className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Posts
            </h3>
            {data.posts.length === 0 ? (
              <p className="text-sm text-[color:var(--color-muted)]">
                No posts created.
              </p>
            ) : (
              data.posts.map((post) => (
                <div key={post.id} className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/post/${post.id}`}
                    className="text-sm font-semibold"
                  >
                    {post.title}
                  </Link>
                  <StatusBadge status={post.status as BadgeStatus} />
                  {post.isHidden ? (
                    <span className="text-xs text-red-600">Hidden</span>
                  ) : null}
                </div>
              ))
            )}
          </Card>
          <Card className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Projects
            </h3>
            {data.projects.length === 0 ? (
              <p className="text-sm text-[color:var(--color-muted)]">
                No projects created.
              </p>
            ) : (
              data.projects.map((project) => (
                <div key={project.id} className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/project/${project.id}`}
                    className="text-sm font-semibold"
                  >
                    {project.name}
                  </Link>
                  <StatusBadge status={project.status as BadgeStatus} />
                  {project.isHidden ? (
                    <span className="text-xs text-red-600">Hidden</span>
                  ) : null}
                </div>
              ))
            )}
          </Card>
          <Card className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Companies
            </h3>
            {data.companies.length === 0 ? (
              <p className="text-sm text-[color:var(--color-muted)]">
                No companies created.
              </p>
            ) : (
              data.companies.map((company) => (
                <div key={company.id} className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/company/${company.id}`}
                    className="text-sm font-semibold"
                  >
                    {company.name}
                  </Link>
                  <StatusBadge status={company.status as BadgeStatus} />
                  {company.isHidden ? (
                    <span className="text-xs text-red-600">Hidden</span>
                  ) : null}
                </div>
              ))
            )}
          </Card>
          <Card className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Updates
            </h3>
            {data.updates.length === 0 ? (
              <p className="text-sm text-[color:var(--color-muted)]">
                No updates created.
              </p>
            ) : (
              data.updates.map((update) => (
                <div key={update.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{update.title}</span>
                  <StatusBadge status={update.status} />
                  <Link
                    href={`/project/${update.project.id}`}
                    className="text-xs text-[color:var(--color-muted)]"
                  >
                    {update.project.name}
                  </Link>
                  {update.isHidden ? (
                    <span className="text-xs text-red-600">Hidden</span>
                  ) : null}
                </div>
              ))
            )}
          </Card>
        </div>
      ) : null}

      {activeTab === "Companies" ? (
        <Card className="space-y-3">
          {data.memberships.length === 0 ? (
            <p className="text-sm text-[color:var(--color-muted)]">
              No company memberships.
            </p>
          ) : (
            data.memberships.map((membership) => (
              <div
                key={membership.company.id}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    size="sm"
                    label={membership.company.name}
                    src={membership.company.logoUrl ?? undefined}
                  />
                  <div>
                    <p className="text-sm font-semibold">
                      {membership.company.name}
                    </p>
                    <p className="text-xs text-[color:var(--color-muted)]">
                      Role: {membership.companyRole}
                    </p>
                  </div>
                </div>
                {isAdmin ? (
                  <button
                    type="button"
                    className={buttonStyles({ variant: "outline", size: "sm" })}
                    onClick={() => removeMembership(membership.company.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))
          )}
        </Card>
      ) : null}

      {activeTab === "Tickets" ? (
        <Card className="space-y-2">
          {data.tickets.length === 0 ? (
            <p className="text-sm text-[color:var(--color-muted)]">
              No tickets created.
            </p>
          ) : (
            data.tickets.map((ticket) => (
              <div key={ticket.id} className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/ticket/${ticket.id}`}
                  className="text-sm font-semibold"
                >
                  {ticket.subject}
                </Link>
                <span className="text-xs text-[color:var(--color-muted)]">
                  {ticket.status}
                </span>
                <span className="text-xs text-[color:var(--color-muted)]">
                  Updated {formatDate(ticket.updatedAt)}
                </span>
              </div>
            ))
          )}
        </Card>
      ) : null}
    </div>
  );
}
