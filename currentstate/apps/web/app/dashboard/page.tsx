import Link from "next/link";

import Card from "@/components/ui/Card";
import { buttonStyles } from "@/components/ui/Button";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Overview</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Manage your personal posts, projects, and companies from one place.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Create something new</h3>
          <p className="text-sm text-[color:var(--color-muted)]">
            Start with a draft and submit it for moderation when ready.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/posts/new"
              className={buttonStyles({ variant: "outline", size: "sm" })}
            >
              New post
            </Link>
            <Link
              href="/dashboard/projects/new"
              className={buttonStyles({ variant: "outline", size: "sm" })}
            >
              New project
            </Link>
            <Link
              href="/dashboard/companies/new"
              className={buttonStyles({ variant: "outline", size: "sm" })}
            >
              New company
            </Link>
          </div>
        </Card>

        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Stay on top of reviews</h3>
          <p className="text-sm text-[color:var(--color-muted)]">
            Track submissions and update drafts before they go live.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/posts"
              className={buttonStyles({ variant: "ghost", size: "sm" })}
            >
              My posts
            </Link>
            <Link
              href="/dashboard/projects"
              className={buttonStyles({ variant: "ghost", size: "sm" })}
            >
              My projects
            </Link>
            <Link
              href="/dashboard/companies"
              className={buttonStyles({ variant: "ghost", size: "sm" })}
            >
              My companies
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
