import { redirect } from "next/navigation";

import CompanyEditor from "@/app/dashboard/companies/CompanyEditor";
import { getSession } from "@/lib/auth/session";

type PageProps = { params?: any; searchParams?: any };

export default async function EditCompanyPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) {
    redirect("/unauthorized");
  }

  return (
    <CompanyEditor companyId={params.companyId} siteRole={session.siteRole} />
  );
}
