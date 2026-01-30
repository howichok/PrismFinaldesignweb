"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import { buttonStyles } from "@/components/ui/Button";

type MiniCompany = {
  id: string;
  name: string;
  logoUrl: string | null;
  myRole: "OWNER" | "CO_OWNER" | "TRUSTED" | "MEMBER";
};

type MiniItem = {
  id: string;
  title?: string;
  name?: string;
  updatedAt: string;
};

type MiniProfileData = {
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    siteRole: "USER" | "MOD" | "ADMIN";
  };
  companyCount: number;
  companies: MiniCompany[];
  recent: {
    posts: MiniItem[];
    projects: MiniItem[];
  };
};

const CACHE_TTL_MS = 3 * 60 * 1000;
const miniProfileCache = new Map<
  string,
  { data: MiniProfileData; expiresAt: number }
>();

type MiniProfilePopoverProps = {
  userId: string;
  viewerId?: string | null;
  onClose: () => void;
};

export default function MiniProfilePopover({
  userId,
  viewerId,
  onClose,
}: MiniProfilePopoverProps) {
  const [data, setData] = useState<MiniProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cacheKey = useMemo(() => userId, [userId]);

  useEffect(() => {
    let cancelled = false;
    const cached = miniProfileCache.get(cacheKey);
    const now = Date.now();

    if (cached) {
      setData(cached.data);
      setLoading(cached.expiresAt < now);
    }

    const shouldFetch = !cached || cached.expiresAt < now;
    if (!shouldFetch) {
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/users/${userId}/mini`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Profile unavailable.");
        }
        return (await response.json()) as MiniProfileData;
      })
      .then((payload) => {
        if (cancelled) return;
        miniProfileCache.set(cacheKey, {
          data: payload,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        setData(payload);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Profile unavailable.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, userId]);

  if (loading && !data) {
    return (
      <Card className="w-[320px] animate-in fade-in zoom-in-95">
        <div className="space-y-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-[color:var(--color-line)]" />
          <div className="h-4 w-1/2 animate-pulse rounded-full bg-[color:var(--color-line)]" />
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-[color:var(--color-line)]" />
          <div className="h-16 w-full animate-pulse rounded-2xl bg-[color:var(--color-line)]" />
        </div>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="w-[320px] animate-in fade-in zoom-in-95">
        <p className="text-sm text-[color:var(--color-muted)]">
          {error ?? "Profile unavailable."}
        </p>
      </Card>
    );
  }

  const roleLabel =
    data.user.siteRole === "ADMIN"
      ? "Admin"
      : data.user.siteRole === "MOD"
        ? "Mod"
        : "User";

  return (
    <Card className="w-[320px] space-y-4 animate-in fade-in zoom-in-95">
      <div className="flex items-center gap-3">
        <Avatar
          size="md"
          label={data.user.displayName}
          src={data.user.avatarUrl ?? undefined}
        />
        <div>
          <p className="text-sm font-semibold">{data.user.displayName}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-muted)]">
            <span className="rounded-full border border-[color:var(--color-line)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              {roleLabel}
            </span>
            <span>{data.companyCount} companies</span>
          </div>
        </div>
      </div>

      {data.companies.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
            Companies
          </p>
          <div className="space-y-2">
            {data.companies.map((company) => (
              <Link
                key={company.id}
                href={`/company/${company.id}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-[color:var(--color-line)] bg-white/70 px-3 py-2 text-xs transition-colors hover:border-[color:var(--color-brand)]"
                onClick={onClose}
              >
                <div className="flex items-center gap-2">
                  <Avatar
                    size="sm"
                    label={company.name}
                    src={company.logoUrl ?? undefined}
                  />
                  <span className="font-semibold">{company.name}</span>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-[color:var(--color-muted)]">
                  {company.myRole.replace("_", " ")}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {data.recent.posts.length > 0 || data.recent.projects.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
            Recent activity
          </p>
          <div className="space-y-2 text-xs text-[color:var(--color-muted)]">
            {data.recent.posts.map((post) => (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                className="block truncate hover:text-[color:var(--color-brand-strong)]"
                onClick={onClose}
              >
                Post: {post.title ?? "Untitled"}
              </Link>
            ))}
            {data.recent.projects.map((project) => (
              <Link
                key={project.id}
                href={`/project/${project.id}`}
                className="block truncate hover:text-[color:var(--color-brand-strong)]"
                onClick={onClose}
              >
                Project: {project.name ?? "Untitled"}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/u/${data.user.id}`}
          className={buttonStyles({ size: "sm", variant: "outline" })}
          onClick={onClose}
        >
          View profile
        </Link>
        {viewerId && viewerId === data.user.id ? (
          <Link
            href="/dashboard"
            className={buttonStyles({ size: "sm" })}
            onClick={onClose}
          >
            Open dashboard
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
