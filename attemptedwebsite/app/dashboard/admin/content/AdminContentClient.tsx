"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Tabs from "@/components/ui/Tabs";
import { buttonStyles } from "@/components/ui/Button";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { formatDate } from "@/lib/dashboard/format";

type ContentTab = "Posts" | "Projects" | "Companies" | "Updates";
type ContentType = "posts" | "projects" | "companies" | "updates";

type ContentItem = {
  id: string;
  title?: string;
  name?: string;
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "PUBLISHED";
  isHidden: boolean;
  updatedAt?: string;
  createdAt?: string;
  publishedAt?: string | null;
  ownerDisplay?: string;
  project?: { id: string; name: string };
};

type ContentResponse = {
  items: ContentItem[];
};

type MeResponse = {
  authed: boolean;
  user?: { siteRole: "USER" | "MOD" | "ADMIN" };
};

const tabs: ContentTab[] = ["Posts", "Projects", "Companies", "Updates"];

const tabTypeMap: Record<ContentTab, ContentType> = {
  Posts: "posts",
  Projects: "projects",
  Companies: "companies",
  Updates: "updates",
};

const contentStatusOptions = [
  "All",
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;
const updateStatusOptions = [
  "All",
  "PUBLISHED",
  "PENDING",
  "REJECTED",
] as const;
const ownerTypeOptions = ["All", "USER", "COMPANY"] as const;
const hiddenOptions = ["All", "Visible", "Hidden"] as const;

export default function AdminContentClient() {
  const [activeTab, setActiveTab] = useState<ContentTab>("Posts");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  type StatusOption =
    | (typeof contentStatusOptions)[number]
    | (typeof updateStatusOptions)[number];
  const [status, setStatus] = useState<StatusOption>("All");
  const [ownerType, setOwnerType] =
    useState<(typeof ownerTypeOptions)[number]>("All");
  const [hidden, setHidden] =
    useState<(typeof hiddenOptions)[number]>("All");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [viewerRole, setViewerRole] =
    useState<MeResponse["user"] | null>(null);

  const contentType = tabTypeMap[activeTab];
  const statusOptions = useMemo(
    () => (activeTab === "Updates" ? updateStatusOptions : contentStatusOptions),
    [activeTab],
  );

  const isAdmin = viewerRole?.siteRole === "ADMIN";

  useEffect(() => {
    const loadRole = async () => {
      try {
        const response = await csrfFetch("/api/me");
        if (!response.ok) return;
        const payload = (await response.json()) as MeResponse;
        if (payload.authed) {
          setViewerRole(payload.user ?? null);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadRole();
  }, []);

  useEffect(() => {
    if (!statusOptions.includes(status as any)) {
      setStatus("All");
    }
    if (activeTab === "Companies" || activeTab === "Updates") {
      setOwnerType("All");
    }
  }, [activeTab, statusOptions, status]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (status !== "All") params.set("status", status);
      if (ownerType !== "All" && (activeTab === "Posts" || activeTab === "Projects")) {
        params.set("ownerType", ownerType);
      }
      if (hidden === "Visible") params.set("hidden", "false");
      if (hidden === "Hidden") params.set("hidden", "true");

      const response = await csrfFetch(
        `/api/admin/content/${contentType}?${params.toString()}`,
      );
      if (!response.ok) {
        throw new Error("Failed to load content.");
      }
      const payload = (await response.json()) as ContentResponse;
      setItems(payload.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load content.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, contentType, hidden, ownerType, query, status]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const applyFilters = () => {
    setQuery(queryInput.trim());
  };

  const runAction = async (
    itemId: string,
    action: "hide" | "unhide" | "force-approve" | "force-reject",
  ) => {
    if (action === "force-approve" || action === "force-reject") {
      if (!isAdmin) {
        setNotice("Only admins can force actions.");
        return;
      }
    }

    if (!window.confirm(`Confirm ${action.replace("-", " ")}?`)) return;

    const payload =
      action === "force-reject"
        ? { reason: window.prompt("Enter rejection reason")?.trim() }
        : undefined;

    if (action === "force-reject" && !payload?.reason) {
      setNotice("A rejection reason is required.");
      return;
    }

    setActionId(itemId);
    setNotice(null);
    setError(null);

    try {
      const response = await csrfFetch(
        `/api/admin/content/${contentType}/${itemId}/${action}`,
        {
          method: "POST",
          headers: payload ? { "Content-Type": "application/json" } : undefined,
          body: payload ? JSON.stringify(payload) : undefined,
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Request failed.");
      }
      setNotice("Action completed.");
      await fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setActionId(null);
    }
  };

  const titleForItem = (item: ContentItem) =>
    item.title ?? item.name ?? "Untitled";

  const metaLines = (item: ContentItem) => {
    const lines: string[] = [];
    if (item.ownerDisplay) lines.push(`Owner: ${item.ownerDisplay}`);
    if (item.project) lines.push(`Project: ${item.project.name}`);
    if (item.publishedAt) lines.push(`Published ${formatDate(item.publishedAt)}`);
    if (item.updatedAt) lines.push(`Updated ${formatDate(item.updatedAt)}`);
    if (!item.updatedAt && item.createdAt) {
      lines.push(`Created ${formatDate(item.createdAt)}`);
    }
    return lines;
  };

  const openLinkForItem = (item: ContentItem) => {
    if (activeTab === "Posts") return `/post/${item.id}`;
    if (activeTab === "Projects") return `/project/${item.id}`;
    if (activeTab === "Companies") return `/company/${item.id}`;
    if (activeTab === "Updates" && item.project) {
      return `/project/${item.project.id}`;
    }
    return "#";
  };

  return (
    <div className="space-y-4">
      <Tabs
        items={tabs}
        value={activeTab}
        onChange={(value) => setActiveTab(value as ContentTab)}
      />

      <Card className="space-y-3">
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <Input
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="Search by title or name"
          />
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as StatusOption)
            }
            className="h-11 rounded-2xl border border-[color:var(--color-line)] bg-white/80 px-4 text-sm text-[color:var(--color-ink)] shadow-[var(--shadow-soft)]"
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                Status: {option}
              </option>
            ))}
          </select>
          <select
            value={ownerType}
            onChange={(event) =>
              setOwnerType(event.target.value as (typeof ownerTypeOptions)[number])
            }
            className="h-11 rounded-2xl border border-[color:var(--color-line)] bg-white/80 px-4 text-sm text-[color:var(--color-ink)] shadow-[var(--shadow-soft)]"
            disabled={activeTab === "Companies" || activeTab === "Updates"}
          >
            {ownerTypeOptions.map((option) => (
              <option key={option} value={option}>
                Owner: {option}
              </option>
            ))}
          </select>
          <select
            value={hidden}
            onChange={(event) =>
              setHidden(event.target.value as (typeof hiddenOptions)[number])
            }
            className="h-11 rounded-2xl border border-[color:var(--color-line)] bg-white/80 px-4 text-sm text-[color:var(--color-ink)] shadow-[var(--shadow-soft)]"
          >
            {hiddenOptions.map((option) => (
              <option key={option} value={option}>
                Visibility: {option}
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

      {notice ? (
        <Card className="text-sm text-[color:var(--color-muted)]">
          {notice}
        </Card>
      ) : null}

      {error ? (
        <Card className="space-y-2 text-sm text-[color:var(--color-muted)]">
          <p>{error}</p>
          <button
            type="button"
            className={buttonStyles({ variant: "outline", size: "sm" })}
            onClick={fetchItems}
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
          No items matched your filters.
        </Card>
      ) : null}

      {items.length > 0 ? (
        <div className="grid gap-3">
          {items.map((item) => {
            const meta = metaLines(item);
            const isBusy = actionId === item.id;
            return (
              <Card key={item.id} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{titleForItem(item)}</p>
                    {meta.length ? (
                      <p className="text-xs text-[color:var(--color-muted)]">
                        {meta.join(" | ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <StatusBadge status={item.status} />
                    {item.isHidden ? (
                      <span className="rounded-full border border-red-200 bg-red-50/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                        Hidden
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={openLinkForItem(item)}
                    className={buttonStyles({ variant: "outline", size: "sm" })}
                  >
                    Open
                  </Link>
                  {item.isHidden ? (
                    <button
                      type="button"
                      className={buttonStyles({ variant: "ghost", size: "sm" })}
                      onClick={() => runAction(item.id, "unhide")}
                      disabled={isBusy}
                    >
                      Unhide
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={buttonStyles({ variant: "ghost", size: "sm" })}
                      onClick={() => runAction(item.id, "hide")}
                      disabled={isBusy}
                    >
                      Hide
                    </button>
                  )}
                  <button
                    type="button"
                    className={buttonStyles({ variant: "outline", size: "sm" })}
                    onClick={() => runAction(item.id, "force-approve")}
                    disabled={isBusy || !isAdmin}
                  >
                    Force approve
                  </button>
                  <button
                    type="button"
                    className={buttonStyles({ variant: "outline", size: "sm" })}
                    onClick={() => runAction(item.id, "force-reject")}
                    disabled={isBusy || !isAdmin}
                  >
                    Force reject
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
