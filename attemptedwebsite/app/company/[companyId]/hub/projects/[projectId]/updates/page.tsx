import { notFound } from "next/navigation";
import { ContentStatus, OwnerType } from "@prisma/client";

import CompanyProjectUpdatesClient from "@/app/company/[companyId]/hub/projects/[projectId]/updates/CompanyProjectUpdatesClient";
import Card from "@/components/ui/Card";
import { buttonStyles } from "@/components/ui/Button";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";

type PageProps = {
  params: {
    companyId: string;
    projectId: string;
  };
};

export default async function CompanyProjectUpdatesPage({ params }: PageProps) {
  const project = await prisma.project.findFirst({
    where: {
      id: params.projectId,
      ownerType: OwnerType.COMPANY,
      ownerCompanyId: params.companyId,
    },
    select: {
      id: true,
      name: true,
      moderationStatus: true,
    },
  });

  if (!project) {
    notFound();
  }

  if (project.moderationStatus !== ContentStatus.APPROVED) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <h2 className="text-2xl font-semibold">Project updates</h2>
          <p className="text-sm text-[color:var(--color-muted)]">
            Publish the project before sharing updates.
          </p>
        </header>
        <Card className="text-sm text-[color:var(--color-muted)]">
          This project must be approved before updates can be posted.
        </Card>
        <Link
          href={`/company/${params.companyId}/hub/projects`}
          className={buttonStyles({ variant: "outline", size: "sm" })}
        >
          Back to projects
        </Link>
      </div>
    );
  }

  return (
    <CompanyProjectUpdatesClient
      projectId={project.id}
      projectName={project.name}
    />
  );
}
