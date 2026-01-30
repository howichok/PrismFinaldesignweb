import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ContentStatus,
  ProjectStatus,
  UpdateStatus,
} from "@prisma/client";

import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import { buttonStyles } from "@/components/ui/Button";
import UserChip from "@/components/users/UserChip";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/cn";
import ProjectTabs from "@/app/project/[projectId]/ProjectTabs";

type PageProps = { params?: any; searchParams?: any };

type ProjectResult = {
  project: {
    id: string;
    name: string;
    description: string;
    tags: string[];
    projectStatus: ProjectStatus;
    ownerType: "USER" | "COMPANY";
    updatedAt: Date;
    publishedAt: Date | null;
    coverAsset: { publicUrl: string } | null;
    ownerUser: { id: string; displayName: string; avatarUrl: string | null } | null;
    ownerCompany: { id: string; name: string; logoUrl: string | null } | null;
    updates: {
      id: string;
      title: string;
      summary: string;
      details: string | null;
      updateType: "PROGRESS" | "RELEASE" | "FIX" | "ANNOUNCEMENT";
      importance: "MAJOR" | "MINOR";
      createdAt: Date;
      publishedAt: Date | null;
    }[];
    collaborators: {
      company: { id: string; name: string; logoUrl: string | null };
    }[];
  } | null;
  error: boolean;
};

const statusStyles: Record<ProjectStatus, string> = {
  IN_PROGRESS: "border-[color:var(--color-line)] text-[color:var(--color-muted)]",
  RELEASED: "border-green-200 text-green-700 bg-green-50/60",
  FROZEN: "border-blue-200 text-blue-700 bg-blue-50/60",
};

function formatDate(value: Date | null) {
  if (!value) return "Unpublished";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatProjectStatus(status: ProjectStatus) {
  switch (status) {
    case "RELEASED":
      return "Released";
    case "FROZEN":
      return "Frozen";
    default:
      return "In progress";
  }
}

async function getProject(projectId: string): Promise<ProjectResult> {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        moderationStatus: ContentStatus.APPROVED,
        isHidden: false,
      },
      select: {
        id: true,
        name: true,
        description: true,
        tags: true,
        projectStatus: true,
        ownerType: true,
        updatedAt: true,
        publishedAt: true,
        coverAsset: {
          select: {
            publicUrl: true,
          },
        },
        ownerUser: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        ownerCompany: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
        updates: {
          where: {
            status: UpdateStatus.PUBLISHED,
            isHidden: false,
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            title: true,
            summary: true,
            details: true,
            updateType: true,
            importance: true,
            createdAt: true,
            publishedAt: true,
          },
        },
        collaborators: {
          select: {
            company: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
              },
            },
          },
        },
      },
    });

    return { project, error: false };
  } catch (error) {
    console.error("Failed to load project", error);
    return { project: null, error: true };
  }
}

export default async function ProjectPage({ params }: PageProps) {
  const result = await getProject(params.projectId);

  if (result.error) {
    return (
      <main className="py-12 md:py-16">
        <Container className="space-y-6">
          <header className="space-y-2">
            <Link
              href="/discovery"
              className={buttonStyles({ variant: "ghost", size: "sm" })}
            >
              Back to Discovery
            </Link>
            <h1 className="text-3xl font-semibold md:text-4xl font-[var(--font-display)]">
              Project
            </h1>
          </header>
          <Card className="text-sm text-[color:var(--color-muted)]">
            Service unavailable. Please try again soon.
          </Card>
        </Container>
      </main>
    );
  }

  if (!result.project) {
    notFound();
  }

  const ownerLabel =
    result.project.ownerType === "COMPANY"
      ? result.project.ownerCompany?.name ?? "Unknown company"
      : result.project.ownerUser?.displayName ?? "Unknown owner";

  const collaboratorCompanies = result.project.collaborators
    .map((collaborator) => collaborator.company)
    .filter((company) => company.id !== result.project?.ownerCompany?.id);

  const ownerCompany =
    result.project.ownerType === "COMPANY" ? result.project.ownerCompany : null;

  const updateItems = result.project.updates.map((update) => ({
    ...update,
    dateLabel: formatDate(update.publishedAt ?? update.createdAt),
  }));

  return (
    <main className="py-12 md:py-16">
      <Container className="space-y-8">
        <div>
          <Link
            href="/discovery"
            className={buttonStyles({ variant: "ghost", size: "sm" })}
          >
            Back to Discovery
          </Link>
        </div>

        <header className="space-y-4">
          {result.project.coverAsset?.publicUrl ? (
            <div className="overflow-hidden rounded-2xl border border-[color:var(--color-line)]">
              <img
                src={result.project.coverAsset.publicUrl}
                alt={`${result.project.name} cover`}
                className="h-56 w-full object-cover md:h-72"
              />
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--color-muted)]">
            <span className="font-semibold uppercase tracking-[0.2em]">
              Project
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                statusStyles[result.project.projectStatus],
              )}
            >
              {formatProjectStatus(result.project.projectStatus)}
            </span>
          </div>
          <h1 className="text-3xl font-semibold md:text-4xl font-[var(--font-display)]">
            {result.project.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--color-muted)] md:text-sm">
            <span>Owned by</span>
            {result.project.ownerType === "USER" && result.project.ownerUser ? (
              <UserChip
                userId={result.project.ownerUser.id}
                displayName={result.project.ownerUser.displayName}
                avatarUrl={result.project.ownerUser.avatarUrl}
              />
            ) : result.project.ownerCompany ? (
              <Link href={`/company/${result.project.ownerCompany.id}`}>
                {result.project.ownerCompany.name}
              </Link>
            ) : (
              <span>{ownerLabel}</span>
            )}
            <span>Published {formatDate(result.project.publishedAt)}</span>
            <span>Last updated {formatDate(result.project.updatedAt)}</span>
          </div>
          {result.project.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {result.project.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[color:var(--color-line)] bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </header>

        <ProjectTabs
          description={result.project.description}
          updates={updateItems}
          collaborators={collaboratorCompanies}
          ownerCompany={ownerCompany}
        />
      </Container>
    </main>
  );
}
