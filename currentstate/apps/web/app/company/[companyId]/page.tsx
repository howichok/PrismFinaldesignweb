import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentStatus, PartnershipStatus, ProjectStatus } from "@prisma/client";

import Avatar from "@/components/ui/Avatar";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import { buttonStyles } from "@/components/ui/Button";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import CompanyTabs from "@/app/company/[companyId]/CompanyTabs";
import UserChip from "@/components/users/UserChip";

type PageProps = { params?: any; searchParams?: any };

type CompanyResult = {
  company: {
    id: string;
    name: string;
    description: string;
    logoUrl: string | null;
    logoAsset: { publicUrl: string } | null;
    categories: string[];
    createdAt: Date;
    updatedAt: Date;
    owner: { id: string; displayName: string; avatarUrl: string | null };
    memberships: {
      userId: string;
      companyRole: "OWNER" | "CO_OWNER" | "TRUSTED" | "MEMBER";
      user: { displayName: string; avatarUrl: string | null };
    }[];
    projects: {
      id: string;
      name: string;
      description: string;
      projectStatus: ProjectStatus;
      updatedAt: Date;
      publishedAt: Date | null;
    }[];
    posts: {
      id: string;
      title: string;
      content: string;
      updatedAt: Date;
      publishedAt: Date | null;
    }[];
    partners: {
      id: string;
      name: string;
      logoUrl: string | null;
    }[];
  } | null;
  error: boolean;
};

const rolePriority: Record<
  "OWNER" | "CO_OWNER" | "TRUSTED" | "MEMBER",
  number
> = {
  OWNER: 0,
  CO_OWNER: 1,
  TRUSTED: 2,
  MEMBER: 3,
};

function formatDate(value: Date | null) {
  if (!value) return "Unpublished";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function truncateText(value: string, limit = 140) {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit).trim()}...`;
}

async function getCompany(companyId: string): Promise<CompanyResult> {
  try {
    const company = await prisma.company.findFirst({
      where: {
        id: companyId,
        visibilityStatus: ContentStatus.APPROVED,
        isHidden: false,
      },
      select: {
        id: true,
        name: true,
        description: true,
        logoUrl: true,
        logoAsset: {
          select: {
            publicUrl: true,
          },
        },
        categories: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        memberships: {
          select: {
            userId: true,
            companyRole: true,
            user: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        projects: {
          where: {
            moderationStatus: ContentStatus.APPROVED,
            isHidden: false,
          },
          select: {
            id: true,
            name: true,
            description: true,
            projectStatus: true,
            updatedAt: true,
            publishedAt: true,
          },
          orderBy: {
            updatedAt: "desc",
          },
        },
        posts: {
          where: {
            status: ContentStatus.APPROVED,
            isHidden: false,
          },
          select: {
            id: true,
            title: true,
            content: true,
            updatedAt: true,
            publishedAt: true,
          },
          orderBy: {
            updatedAt: "desc",
          },
        },
      },
    });

    if (!company) {
      return { company: null, error: false };
    }

    const partnerships = await prisma.partnership.findMany({
      where: {
        status: PartnershipStatus.ACTIVE,
        OR: [{ companyAId: companyId }, { companyBId: companyId }],
      },
      select: {
        companyA: { select: { id: true, name: true, logoUrl: true } },
        companyB: { select: { id: true, name: true, logoUrl: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const partners = partnerships.map((partnership) =>
      partnership.companyA.id === companyId
        ? partnership.companyB
        : partnership.companyA,
    );

    return { company: { ...company, partners }, error: false };
  } catch (error) {
    console.error("Failed to load company", error);
    return { company: null, error: true };
  }
}

export default async function CompanyPage({ params }: PageProps) {
  const [session, result] = await Promise.all([
    getSession(),
    getCompany(params.companyId),
  ]);

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
              Company
            </h1>
          </header>
          <Card className="text-sm text-[color:var(--color-muted)]">
            Service unavailable. Please try again soon.
          </Card>
        </Container>
      </main>
    );
  }

  if (!result.company) {
    notFound();
  }

  const memberList = [...result.company.memberships].sort(
    (a, b) => rolePriority[a.companyRole] - rolePriority[b.companyRole],
  );

  const memberItems = memberList.map((member) => ({
    id: member.userId,
    displayName: member.user.displayName,
    avatarUrl: member.user.avatarUrl,
    role: member.companyRole,
  }));

  const isMember = session
    ? memberList.some((member) => member.userId === session.userId)
    : false;

  const projectItems = result.company.projects.map((project) => ({
    id: project.id,
    name: project.name,
    description: truncateText(project.description, 140),
    projectStatus: project.projectStatus,
    dateLabel: formatDate(project.publishedAt ?? project.updatedAt),
  }));

  const postItems = result.company.posts.map((post) => ({
    id: post.id,
    title: post.title,
    excerpt: truncateText(post.content, 140),
    dateLabel: formatDate(post.publishedAt ?? post.updatedAt),
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
          <div className="flex flex-wrap items-start gap-4">
            <Avatar
              size="lg"
              label={result.company.name}
              src={result.company.logoAsset?.publicUrl ?? result.company.logoUrl}
            />
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold md:text-4xl font-[var(--font-display)]">
                {result.company.name}
              </h1>
              <p className="text-sm text-[color:var(--color-muted)] md:text-base">
                {result.company.description}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--color-muted)] md:text-sm">
            <span>Owner</span>
            <UserChip
              userId={result.company.owner.id}
              displayName={result.company.owner.displayName}
              avatarUrl={result.company.owner.avatarUrl}
            />
            <span>Established {formatDate(result.company.createdAt)}</span>
            <span>Last updated {formatDate(result.company.updatedAt)}</span>
          </div>
          {result.company.partners.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[color:var(--color-brand)]/40 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-brand-strong)]">
                Partnered
              </span>
              <span className="text-xs text-[color:var(--color-muted)]">
                {result.company.partners.length} active partner
                {result.company.partners.length > 1 ? "s" : ""}
              </span>
            </div>
          ) : null}
          {result.company.categories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {result.company.categories.map((category) => (
                <span
                  key={category}
                  className="rounded-full border border-[color:var(--color-line)] bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]"
                >
                  {category}
                </span>
              ))}
            </div>
          ) : null}
        {isMember ? (
          <div>
            <Link
              href={`/company/${result.company.id}/hub`}
              className={buttonStyles({ variant: "outline", size: "sm" })}
            >
              Open Hub
            </Link>
          </div>
        ) : null}
      </header>

      {result.company.partners.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Partners</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {result.company.partners.map((partner) => (
              <Link key={partner.id} href={`/company/${partner.id}`}>
                <Card className="flex items-center gap-3 transition-colors hover:border-[color:var(--color-brand)]">
                  <Avatar
                    size="sm"
                    label={partner.name}
                    src={partner.logoUrl}
                  />
                  <div>
                    <p className="text-sm font-semibold">{partner.name}</p>
                    <p className="text-xs text-[color:var(--color-muted)]">
                      Partner company
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <CompanyTabs
        description={result.company.description}
        categories={result.company.categories}
          projects={projectItems}
          posts={postItems}
          members={memberItems}
        />
      </Container>
    </main>
  );
}
