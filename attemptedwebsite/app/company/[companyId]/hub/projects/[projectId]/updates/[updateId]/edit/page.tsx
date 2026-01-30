import { notFound } from "next/navigation";
import { ContentStatus, OwnerType } from "@prisma/client";

import CompanyProjectUpdateEditor from "@/app/company/[companyId]/hub/projects/[projectId]/updates/CompanyProjectUpdateEditor";
import { prisma } from "@/lib/db/prisma";

type PageProps = {
  params: {
    companyId: string;
    projectId: string;
    updateId: string;
  };
};

export default async function EditCompanyProjectUpdatePage({ params }: PageProps) {
  const project = await prisma.project.findFirst({
    where: {
      id: params.projectId,
      ownerType: OwnerType.COMPANY,
      ownerCompanyId: params.companyId,
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
    <CompanyProjectUpdateEditor
      mode="edit"
      projectId={project.id}
      updateId={params.updateId}
    />
  );
}
