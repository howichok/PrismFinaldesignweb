"use client";

import CompanyPostEditor from "@/app/company/[companyId]/hub/posts/CompanyPostEditor";
import { useCompanyHub } from "@/components/company/CompanyHubShell";

export default function CompanyPostCreatePage() {
  const { company, role } = useCompanyHub();

  return (
    <CompanyPostEditor
      mode="create"
      companyId={company.id}
      role={role}
    />
  );
}
