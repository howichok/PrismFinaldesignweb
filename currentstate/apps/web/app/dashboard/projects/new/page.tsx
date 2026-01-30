import { redirect } from "next/navigation";

import ProjectEditor from "@/app/dashboard/projects/ProjectEditor";
import { getSession } from "@/lib/auth/session";

export default async function NewProjectPage() {
  const session = await getSession();
  if (!session) {
    redirect("/unauthorized");
  }

  return <ProjectEditor mode="create" siteRole={session.siteRole} />;
}
