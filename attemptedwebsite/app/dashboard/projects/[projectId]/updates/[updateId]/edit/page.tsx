import { notFound, redirect } from "next/navigation";
import { ContentStatus, OwnerType } from "@prisma/client";

import ProjectUpdateEditor from "@/app/dashboard/projects/[projectId]/updates/ProjectUpdateEditor";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

type PageProps = {
  params: {
    projectId: string;
    updateId: string;
  };
};

export default async function EditProjectUpdatePage({ params }: PageProps) {
  const session = await getSession();
  if (!session) {
    redirect("/unauthorized");
  }

  const project = await prisma.project.findFirst({
    where: {
      id: params.projectId,
      ownerType: OwnerType.USER,
      ownerUserId: session.userId,
    },
    select: {
      id: true,
      moderationStatus: true,
    },
  });

  if (!project) {
    notFound();
  }

  if (project.moderationStatus !== ContentStatus.APPROVED) {
    notFound();
  }

  return (
    <ProjectUpdateEditor
      mode="edit"
      projectId={project.id}
      updateId={params.updateId}
    />
  );
}
