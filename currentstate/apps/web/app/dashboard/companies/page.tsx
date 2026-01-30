import Link from "next/link";

import CompaniesClient from "@/app/dashboard/companies/CompaniesClient";
import { buttonStyles } from "@/components/ui/Button";

export default function DashboardCompaniesPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">My Companies</h2>
          <p className="text-sm text-[color:var(--color-muted)]">
            Create companies and manage your memberships.
          </p>
        </div>
        <Link
          href="/dashboard/companies/new"
          className={buttonStyles({ variant: "primary", size: "sm" })}
        >
          Create company
        </Link>
      </header>

      <CompaniesClient />
    </div>
  );
}
