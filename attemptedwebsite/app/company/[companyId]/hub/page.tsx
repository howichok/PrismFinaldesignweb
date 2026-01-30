"use client";

import Link from "next/link";

import Card from "@/components/ui/Card";
import { buttonStyles } from "@/components/ui/Button";
import { useCompanyHub } from "@/components/company/CompanyHubShell";
import { isCompanyEditor } from "@/lib/company/roles";

export default function CompanyHubPage() {
  const { company, role } = useCompanyHub();
  const canWrite = isCompanyEditor(role);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Overview</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Manage company content, collaborators, and internal workflows.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <Card className="space-y-2">
          <h3 className="text-lg font-semibold">Company summary</h3>
          <p className="text-sm text-[color:var(--color-muted)]">
            {company.description ??
              "Add a description to help collaborators understand the company focus."}
          </p>
          {company.categories.length ? (
            <div className="flex flex-wrap gap-2">
              {company.categories.map((category) => (
                <span
                  key={category}
                  className="rounded-full border border-[color:var(--color-line)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]"
                >
                  {category}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[color:var(--color-muted)]">
              No categories set yet.
            </p>
          )}
        </Card>

        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Quick actions</h3>
          {canWrite ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/company/${company.id}/hub/posts/new`}
                className={buttonStyles({ variant: "primary", size: "sm" })}
              >
                Create post
              </Link>
              <Link
                href={`/company/${company.id}/hub/projects/new`}
                className={buttonStyles({ variant: "outline", size: "sm" })}
              >
                Create project
              </Link>
            </div>
          ) : (
            <div className="space-y-2 text-sm text-[color:var(--color-muted)]">
              <p>
                Members can view drafts now. Proposal approvals arrive in Phase
                12.
              </p>
              <Link
                href={`/company/${company.id}/hub/posts`}
                className={buttonStyles({ variant: "ghost", size: "sm" })}
              >
                View drafts
              </Link>
            </div>
          )}
        </Card>
      </div>

      <Card className="text-sm text-[color:var(--color-muted)]">
        Recent activity will appear here once new posts and projects are
        created.
      </Card>
    </div>
  );
}
