"use client";

import { useState } from "react";

import Card from "@/components/ui/Card";
import CompanyMembersClient from "@/app/company/[companyId]/hub/members/CompanyMembersClient";
import CompanyInvitePanel from "@/app/company/[companyId]/hub/members/CompanyInvitePanel";
import PendingInvitesList from "@/app/company/[companyId]/hub/members/PendingInvitesList";
import { useCompanyHub } from "@/components/company/CompanyHubShell";
import { isCompanyManager } from "@/lib/company/roles";

export default function CompanyMembersPage() {
  const { company, role } = useCompanyHub();
  const canInvite = isCompanyManager(role);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Members</h2>
          <p className="text-sm text-[color:var(--color-muted)]">
            Manage the {company.name} team and permissions.
          </p>
        </div>
      </header>

      {canInvite ? (
        <CompanyInvitePanel
          companyId={company.id}
          viewerRole={role}
          onInviteSent={handleRefresh}
        />
      ) : (
        <Card className="text-sm text-[color:var(--color-muted)]">
          Invites are managed by owners and co-owners.
        </Card>
      )}

      {canInvite ? (
        <PendingInvitesList
          companyId={company.id}
          viewerRole={role}
          refreshKey={refreshKey}
          onChange={handleRefresh}
        />
      ) : null}

      <CompanyMembersClient
        companyId={company.id}
        viewerRole={role}
        refreshKey={refreshKey}
        onChange={handleRefresh}
      />
    </div>
  );
}
