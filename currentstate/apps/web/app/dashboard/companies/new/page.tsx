import { redirect } from "next/navigation";

import CompanyWizard from "@/app/dashboard/companies/CompanyWizard";
import { getSession } from "@/lib/auth/session";

export default async function NewCompanyPage() {
  const session = await getSession();
  if (!session) {
    redirect("/unauthorized");
  }

  return <CompanyWizard siteRole={session.siteRole} />;
}
