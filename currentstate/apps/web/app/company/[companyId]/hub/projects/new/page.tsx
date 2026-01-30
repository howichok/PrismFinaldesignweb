"use client";

import CompanyProjectEditor from "@/app/company/[companyId]/hub/projects/CompanyProjectEditor";
import { useCompanyHub } from "@/components/company/CompanyHubShell";

export default function CompanyProjectCreatePage() {
  const { company, role } = useCompanyHub();

  return (
    <CompanyProjectEditor
      mode="create"
      companyId={company.id}
      role={role}
    />
  );
}
