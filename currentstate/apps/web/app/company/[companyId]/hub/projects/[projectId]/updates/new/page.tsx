import { notFound } from "next/navigation";
import { ContentStatus, OwnerType } from "@prisma/client";

import CompanyProjectUpdateEditor from "@/app/company/[companyId]/hub/projects/[projectId]/updates/CompanyProjectUpdateEditor";
import { prisma } from "@/lib/db/prisma";

type PageProps = { params?: any; searchParams?: any };

export default async function NewCompanyProjectUpdatePage({ params }: PageProps) {
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
    <CompanyProjectUpdateEditor mode="create" projectId={project.id} />
  );
}
