import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentStatus, OwnerType } from "@prisma/client";

import ProjectUpdatesClient from "@/app/dashboard/projects/[projectId]/updates/ProjectUpdatesClient";
import Card from "@/components/ui/Card";
import { buttonStyles } from "@/components/ui/Button";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

type PageProps = { params?: any; searchParams?: any };

export default async function ProjectUpdatesPage({ params }: PageProps) {
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
          This project must be approved and published before updates can be
          posted.
        </Card>
        <Link
          href={`/dashboard/projects/${project.id}/edit`}
          className={buttonStyles({ variant: "outline", size: "sm" })}
        >
          Back to project
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Project updates</h2>
          <p className="text-sm text-[color:var(--color-muted)]">
            Manage update notes for {project.name}.
          </p>
        </div>
        <Link
          href={`/dashboard/projects/${project.id}/updates/new`}
          className={buttonStyles({ variant: "primary", size: "sm" })}
        >
          New update
        </Link>
      </header>

      <Card className="text-sm text-[color:var(--color-muted)]">
        Major updates are limited to one per 24 hours per project.
      </Card>

      <ProjectUpdatesClient projectId={project.id} />
    </div>
  );
}
