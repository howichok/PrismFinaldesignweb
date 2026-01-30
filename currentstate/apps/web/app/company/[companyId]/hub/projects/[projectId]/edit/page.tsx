"use client";

import CompanyProjectEditor from "@/app/company/[companyId]/hub/projects/CompanyProjectEditor";
import { useCompanyHub } from "@/components/company/CompanyHubShell";
import { isCompanyEditor } from "@/lib/company/roles";

export default function CompanyProjectEditPage({
  params,
}: {
  params: any;
}) {
  const { company, role } = useCompanyHub();

  return (
    <CompanyProjectEditor
      mode="edit"
      companyId={company.id}
      projectId={params.projectId}
      role={role}
    />
  );
}
