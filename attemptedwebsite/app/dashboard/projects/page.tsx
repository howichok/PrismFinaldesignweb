import Link from "next/link";

import ProjectsClient from "@/app/dashboard/projects/ProjectsClient";
import { buttonStyles } from "@/components/ui/Button";

export default function DashboardProjectsPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">My Projects</h2>
          <p className="text-sm text-[color:var(--color-muted)]">
            Keep track of your project submissions and releases.
          </p>
        </div>
        <Link
          href="/dashboard/projects/new"
          className={buttonStyles({ variant: "primary", size: "sm" })}
        >
          Create project
        </Link>
      </header>

      <ProjectsClient />
    </div>
  );
}
