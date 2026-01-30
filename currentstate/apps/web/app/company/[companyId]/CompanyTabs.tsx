"use client";

import { useState } from "react";
import Link from "next/link";

import UserChip from "@/components/users/UserChip";
import Card from "@/components/ui/Card";
import Tabs from "@/components/ui/Tabs";
import { cn } from "@/lib/cn";

type ProjectStatus = "IN_PROGRESS" | "RELEASED" | "FROZEN";
type CompanyRole = "OWNER" | "CO_OWNER" | "TRUSTED" | "MEMBER";

type ProjectItem = {
  id: string;
  name: string;
  description: string;
  projectStatus: ProjectStatus;
  dateLabel: string;
};

type PostItem = {
  id: string;
  title: string;
  excerpt: string;
  dateLabel: string;
};

type MemberItem = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: CompanyRole;
};

type CompanyTabsProps = {
  description: string;
  categories: string[];
  projects: ProjectItem[];
  posts: PostItem[];
  members: MemberItem[];
};

const tabItems = ["About", "Projects", "Posts", "Members"] as const;
type TabKey = (typeof tabItems)[number];

const statusStyles: Record<ProjectStatus, string> = {
  IN_PROGRESS: "border-[color:var(--color-line)] text-[color:var(--color-muted)]",
  RELEASED: "border-green-200 text-green-700 bg-green-50/60",
  FROZEN: "border-blue-200 text-blue-700 bg-blue-50/60",
};

function formatProjectStatus(status: ProjectStatus) {
  switch (status) {
    case "RELEASED":
      return "Released";
    case "FROZEN":
      return "Frozen";
    default:
      return "In progress";
  }
}

function formatRole(role: CompanyRole) {
  switch (role) {
    case "OWNER":
      return "Owner";
    case "CO_OWNER":
      return "Co-owner";
    case "TRUSTED":
      return "Trusted";
    default:
      return "Member";
  }
}

export default function CompanyTabs({
  description,
  categories,
  projects,
  posts,
  members,
}: CompanyTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(tabItems[0]);

  return (
    <div className="space-y-6">
      <Tabs
        items={[...tabItems]}
        value={activeTab}
        onChange={(value) => setActiveTab(value as TabKey)}
      />

      {activeTab === "About" ? (
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold">About</h2>
            <p className="text-sm leading-relaxed text-[color:var(--color-muted)] md:text-base">
              {description}
            </p>
          </Card>
          <Card className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Categories
            </h3>
            {categories.length === 0 ? (
              <p className="text-sm text-[color:var(--color-muted)]">
                No categories added yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <span
                    key={category}
                    className="rounded-full border border-[color:var(--color-line)] bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]"
                  >
                    {category}
                  </span>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {activeTab === "Projects" ? (
        <div className="space-y-4">
          {projects.length === 0 ? (
            <Card className="text-sm text-[color:var(--color-muted)]">
              No approved projects yet.
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {projects.map((project) => (
                <Link key={project.id} href={`/project/${project.id}`}>
                  <Card className="space-y-3 transition-colors hover:border-[color:var(--color-brand)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
                        Project
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          statusStyles[project.projectStatus],
                        )}
                      >
                        {formatProjectStatus(project.projectStatus)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">{project.name}</h3>
                      <p className="text-sm text-[color:var(--color-muted)]">
                        {project.description}
                      </p>
                    </div>
                    <p className="text-xs text-[color:var(--color-muted)]">
                      Updated {project.dateLabel}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {activeTab === "Posts" ? (
        <div className="space-y-4">
          {posts.length === 0 ? (
            <Card className="text-sm text-[color:var(--color-muted)]">
              No approved posts yet.
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {posts.map((post) => (
                <Link key={post.id} href={`/post/${post.id}`}>
                  <Card className="space-y-2 transition-colors hover:border-[color:var(--color-brand)]">
                    <h3 className="text-lg font-semibold">{post.title}</h3>
                    <p className="text-sm text-[color:var(--color-muted)]">
                      {post.excerpt}
                    </p>
                    <p className="text-xs text-[color:var(--color-muted)]">
                      Updated {post.dateLabel}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {activeTab === "Members" ? (
        <div className="space-y-4">
          {members.length === 0 ? (
            <Card className="text-sm text-[color:var(--color-muted)]">
              No members listed yet.
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {members.map((member) => (
                <Card key={member.id} className="flex items-center gap-3">
                  <UserChip
                    userId={member.id}
                    displayName={member.displayName}
                    avatarUrl={member.avatarUrl}
                  />
                  <span className="text-xs text-[color:var(--color-muted)]">
                    {formatRole(member.role)}
                  </span>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
