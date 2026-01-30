"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { useDebouncedValue } from "@/lib/discovery/useDebounce";
import { useDiscovery } from "@/lib/discovery/useDiscovery";
import type { DiscoveryTab, DiscoveryItem } from "@/lib/discovery/types";

const LIMIT = 12;

function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function truncate(text: string, maxLength = 100) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function getItemLink(item: DiscoveryItem) {
  switch (item.type) {
    case "post":
      return `/post/${item.id}`;
    case "project":
      return `/project/${item.id}`;
    case "company":
      return `/company/${item.id}`;
    default:
      return "#";
  }
}

function getTypeColor(type: string) {
  switch (type) {
    case "post":
      return "var(--color-accent)";
    case "project":
      return "#8b5cf6";
    case "company":
      return "#10b981";
    default:
      return "var(--color-text)";
  }
}

export default function DiscoveryPage() {
  const [tab, setTab] = useState<DiscoveryTab>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const debouncedQuery = useDebouncedValue(query, 400);

  const {
    items,
    nextCursor,
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    loadMore,
    refresh,
  } = useDiscovery({
    tab,
    query: debouncedQuery,
    limit: LIMIT,
  });

  const counts = useMemo(() => {
    return {
      lines: items.filter((item) => item.type === "post").length,
      projects: items.filter((item) => item.type === "project").length,
      companies: items.filter((item) => item.type === "company").length,
    };
  }, [items]);

  const tabs: { id: DiscoveryTab; label: string; countId?: string; count?: number; icon: React.ReactNode }[] = [
    {
      id: "all",
      label: "All",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      id: "posts",
      label: "Lines",
      countId: "linesCount",
      count: counts.lines,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      ),
    },
    {
      id: "projects",
      label: "Projects",
      countId: "projectsCount",
      count: counts.projects,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      id: "companies",
      label: "Companies",
      countId: "companiesCount",
      count: counts.companies,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 21h18" />
          <path d="M9 21v-8H5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2h-4v8" />
          <path d="M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4" />
          <circle cx="12" cy="3" r="1" />
        </svg>
      ),
    },
  ];

  return (
    <main className="discovery-page">
      <section className="discovery-hero">
        <div className="discovery-hero__content">
          <span className="hero-badge">Explore</span>
          <h1 className="discovery-hero__title">Discovery</h1>
          <p className="discovery-hero__subtitle">
            Explore metro infrastructure created by the community
          </p>

          <div className="discovery-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              id="globalSearch"
              placeholder="Search lines, stations, buildings, projects..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <kbd className="discovery-search__shortcut">/</kbd>
          </div>
        </div>
      </section>

      <section className="discovery-tabs">
        <div className="discovery-tabs__container">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`discovery-tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.countId ? (
                <span className="discovery-tab__count" id={t.countId}>
                  {t.count ?? 0}
                </span>
              ) : null}
            </button>
          ))}
          <button className="discovery-tab" data-tab="stations" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>Stations</span>
            <span className="discovery-tab__count" id="stationsCount">
              0
            </span>
          </button>
          <button className="discovery-tab" data-tab="buildings" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 21h18" />
              <path d="M5 21V7l8-4v18" />
              <path d="M19 21V11l-6-4" />
            </svg>
            <span>Buildings</span>
            <span className="discovery-tab__count" id="buildingsCount">
              0
            </span>
          </button>
        </div>
      </section>

      <section className="discovery-filters">
        <div className="discovery-filters__left">
          <span className="discovery-filters__label">Sort by:</span>
          <select className="discovery-select" id="sortSelect" defaultValue="newest">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Name (A-Z)</option>
            <option value="name_desc">Name (Z-A)</option>
          </select>
        </div>

        <div className="discovery-filters__right">
          <div className="discovery-view-toggle">
            <button
              className={`view-btn ${view === "grid" ? "active" : ""}`}
              data-view="grid"
              title="Grid View"
              onClick={() => setView("grid")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              className={`view-btn ${view === "list" ? "active" : ""}`}
              data-view="list"
              title="List View"
              onClick={() => setView("list")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      <section className="discovery-stats">
        <span className="discovery-stats__text" id="resultsText">
          {isLoading
            ? "Loading..."
            : isRefreshing
              ? "Refreshing..."
              : `${items.length} result${items.length !== 1 ? "s" : ""}`}
        </span>
      </section>

      <section className="discovery-content">
        {error ? (
          <div className="discovery-empty">
            <div className="discovery-empty__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3>Error loading content</h3>
            <p>{error}</p>
            <button className="btn btn--outline" onClick={refresh}>
              Try again
            </button>
          </div>
        ) : isLoading ? (
          <div className="discovery-loading" id="discoveryLoading">
            <div className="spinner"></div>
            <p>Loading content...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="discovery-empty" id="discoveryEmpty">
            <div className="discovery-empty__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <h3>No results found</h3>
            <p id="emptyMessage">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div
            className={`discovery-grid ${view === "list" ? "discovery-grid--list" : ""}`}
            id="discoveryGrid"
          >
            {items.map((item) => (
              <Link
                key={`${item.type}-${item.id}`}
                href={getItemLink(item)}
                className="discovery-card"
              >
                <div className="discovery-card__media">
                  <div className="discovery-card__placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                  <div
                    className="discovery-card__type"
                    style={{ "--type-color": getTypeColor(item.type) } as React.CSSProperties}
                  >
                    {item.type}
                  </div>
                </div>
                <div className="discovery-card__content">
                  <h3 className="discovery-card__title">
                    {"title" in item ? item.title : "name" in item ? item.name : "Untitled"}
                  </h3>
                  <p className="discovery-card__description">
                    {"excerpt" in item ? truncate(item.excerpt || "No description") : "No description"}
                  </p>
                  <div className="discovery-card__meta">
                    <span className="discovery-card__author">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      {"ownerDisplay" in item ? item.ownerDisplay : "Unknown"}
                    </span>
                    <span className="discovery-card__date">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {formatDate(item.updatedAt)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {!isLoading && items.length > 0 ? (
        <section
          className="discovery-load-more"
          id="loadMoreSection"
          style={{ display: "flex" }}
        >
          <button
            className="btn btn--outline btn--lg"
            id="loadMoreBtn"
            onClick={loadMore}
            disabled={!nextCursor || isLoadingMore}
          >
            {isLoadingMore ? "Loading..." : nextCursor ? "Load More" : "No more results"}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </section>
      ) : null}

      <div className="modal" id="detailModal">
        <div className="modal__backdrop" data-action="close-detail-modal" aria-hidden="true"></div>
        <div className="modal__container modal__container--lg">
          <button className="modal__close" data-action="close-detail-modal" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div className="detail-view" id="detailView"></div>
        </div>
      </div>
    </main>
  );
}
