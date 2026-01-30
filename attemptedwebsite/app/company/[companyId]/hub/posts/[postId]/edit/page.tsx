"use client";

import CompanyPostEditor from "@/app/company/[companyId]/hub/posts/CompanyPostEditor";
import { useCompanyHub } from "@/components/company/CompanyHubShell";
import { isCompanyEditor } from "@/lib/company/roles";

export default function CompanyPostEditPage({
  params,
}: {
  params: { postId: string };
}) {
  const { company, role } = useCompanyHub();

  return (
    <CompanyPostEditor
      mode="edit"
      companyId={company.id}
      postId={params.postId}
      role={role}
    />
  );
}
