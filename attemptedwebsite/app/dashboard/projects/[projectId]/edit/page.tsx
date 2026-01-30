import { redirect } from "next/navigation";

import ProjectEditor from "@/app/dashboard/projects/ProjectEditor";
import { getSession } from "@/lib/auth/session";

type PageProps = {
  params: {
    projectId: string;
  };
};

export default async function EditProjectPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) {
    redirect("/unauthorized");
  }

  return (
    <ProjectEditor
      mode="edit"
      projectId={params.projectId}
      siteRole={session.siteRole}
    />
  );
}
