"use client";

import { useState } from "react";
import Link from "next/link";

import Avatar from "@/components/ui/Avatar";
import Card from "@/components/ui/Card";
import Tabs from "@/components/ui/Tabs";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type UpdateType = "PROGRESS" | "RELEASE" | "FIX" | "ANNOUNCEMENT";
type UpdateImportance = "MAJOR" | "MINOR";

type UpdateItem = {
  id: string;
  title: string;
  summary: string;
  details: string | null;
  updateType: UpdateType;
  importance: UpdateImportance;
  dateLabel: string;
};

type CollaboratorItem = {
  id: string;
  name: string;
  logoUrl: string | null;
};

type ProjectTabsProps = {
  description: string;
  updates: UpdateItem[];
  collaborators: CollaboratorItem[];
  ownerCompany?: CollaboratorItem | null;
};

const tabItems = ["Overview", "Updates", "Collaborators"] as const;
type TabKey = (typeof tabItems)[number];

const updateTypeStyles: Record<UpdateType, string> = {
  PROGRESS: "border-blue-200 text-blue-700 bg-blue-50/70",
  RELEASE: "border-green-200 text-green-700 bg-green-50/70",
  FIX: "border-amber-200 text-amber-700 bg-amber-50/70",
  ANNOUNCEMENT: "border-purple-200 text-purple-700 bg-purple-50/70",
};

const importanceStyles: Record<UpdateImportance, string> = {
  MAJOR: "border-[color:var(--color-line)] text-[color:var(--color-ink)]",
  MINOR: "border-[color:var(--color-line)] text-[color:var(--color-muted)]",
};

function formatUpdateType(type: UpdateType) {
  switch (type) {
    case "RELEASE":
      return "Release";
    case "FIX":
      return "Fix";
    case "ANNOUNCEMENT":
      return "Announcement";
    default:
      return "Progress";
  }
}

export default function ProjectTabs({
  description,
  updates,
  collaborators,
  ownerCompany,
}: ProjectTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(tabItems[0]);

  return (
    <div className="space-y-6">
      <Tabs
        items={[...tabItems]}
        value={activeTab}
        onChange={(value) => setActiveTab(value as TabKey)}
      />

      {activeTab === "Overview" ? (
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold">Overview</h2>
            <p className="text-sm leading-relaxed text-[color:var(--color-muted)] md:text-base">
              {description}
            </p>
          </Card>
          <Card className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Links
            </h3>
            <p className="text-sm text-[color:var(--color-muted)]">
              Project links and release notes will appear here in a future
              phase.
            </p>
            <Link
              href="/discovery"
              className={buttonStyles({ variant: "outline", size: "sm" })}
            >
              Back to Discovery
            </Link>
          </Card>
        </div>
      ) : null}

      {activeTab === "Updates" ? (
        <div className="space-y-4">
          {updates.length === 0 ? (
            <Card className="text-sm text-[color:var(--color-muted)]">
              No published updates yet.
            </Card>
          ) : (
            updates.map((update) => (
              <Card key={update.id} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      updateTypeStyles[update.updateType],
                    )}
                  >
                    {formatUpdateType(update.updateType)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      importanceStyles[update.importance],
                    )}
                  >
                    {update.importance === "MAJOR" ? "Major" : "Minor"}
                  </span>
                  <span className="text-xs text-[color:var(--color-muted)]">
                    {update.dateLabel}
                  </span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">{update.title}</h3>
                  <p className="text-sm text-[color:var(--color-muted)]">
                    {update.summary}
                  </p>
                </div>
                {update.details ? (
                  <details className="rounded-2xl border border-[color:var(--color-line)] bg-white/60 p-3 text-sm text-[color:var(--color-muted)]">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-[color:var(--color-ink)]">
                      Details
                    </summary>
                    <p className="mt-2 whitespace-pre-line">{update.details}</p>
                  </details>
                ) : null}
              </Card>
            ))
          )}
        </div>
      ) : null}

      {activeTab === "Collaborators" ? (
        <div className="space-y-4">
          {!ownerCompany && collaborators.length === 0 ? (
            <Card className="text-sm text-[color:var(--color-muted)]">
              No collaborators listed yet.
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {ownerCompany ? (
                <Link key={ownerCompany.id} href={`/company/${ownerCompany.id}`}>
                  <Card className="flex items-center gap-3 border-[color:var(--color-brand)]/40 bg-white/80">
                    <Avatar
                      size="sm"
                      label={ownerCompany.name}
                      src={ownerCompany.logoUrl}
                    />
                    <div>
                      <p className="text-sm font-semibold">
                        {ownerCompany.name}
                      </p>
                      <p className="text-xs text-[color:var(--color-muted)]">
                        Owner company
                      </p>
                    </div>
                  </Card>
                </Link>
              ) : null}
              {collaborators.map((company) => (
                <Link key={company.id} href={`/company/${company.id}`}>
                  <Card className="flex items-center gap-3 transition-colors hover:border-[color:var(--color-brand)]">
                    <Avatar
                      size="sm"
                      label={company.name}
                      src={company.logoUrl}
                    />
                    <div>
                      <p className="text-sm font-semibold">{company.name}</p>
                      <p className="text-xs text-[color:var(--color-muted)]">
                        Collaborating company
                      </p>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
