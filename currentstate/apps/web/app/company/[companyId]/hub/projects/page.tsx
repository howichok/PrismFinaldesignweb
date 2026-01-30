"use client";

import Link from "next/link";

import CompanyProjectsClient from "@/app/company/[companyId]/hub/projects/CompanyProjectsClient";
import Card from "@/components/ui/Card";
import { buttonStyles } from "@/components/ui/Button";
import { useCompanyHub } from "@/components/company/CompanyHubShell";
import { isCompanyEditor } from "@/lib/company/roles";

export default function CompanyProjectsPage() {
  const { company, role } = useCompanyHub();
  const canWrite = isCompanyEditor(role);
  const isMember = role === "MEMBER";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Company Projects</h2>
          <p className="text-sm text-[color:var(--color-muted)]">
            Build and publish projects on behalf of {company.name}.
          </p>
        </div>
        {canWrite || isMember ? (
          <Link
            href={`/company/${company.id}/hub/projects/new`}
            className={buttonStyles({ variant: "primary", size: "sm" })}
          >
            {canWrite ? "Create project" : "Create proposal"}
          </Link>
        ) : null}
      </header>

      {isMember ? (
        <Card className="text-sm text-[color:var(--color-muted)]">
          Submit a project proposal for review by trusted company members.
        </Card>
      ) : null}

      <CompanyProjectsClient companyId={company.id} canWrite={canWrite} />
    </div>
  );
}
