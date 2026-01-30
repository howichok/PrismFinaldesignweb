import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentStatus, OwnerType, UserStatus } from "@prisma/client";

import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import Avatar from "@/components/ui/Avatar";
import { buttonStyles } from "@/components/ui/Button";
import { prisma } from "@/lib/db/prisma";

type PageProps = { params?: any; searchParams?: any };

function formatDate(value: Date | null) {
  if (!value) return "Unpublished";
  return value.toLocaleDateString();
}

export default async function UserProfilePage({ params }: PageProps) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      siteRole: true,
      status: true,
    },
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    notFound();
  }

  const [companies, posts, projects] = await Promise.all([
    prisma.companyMembership.findMany({
      where: {
        userId: user.id,
        company: {
          visibilityStatus: ContentStatus.APPROVED,
          isHidden: false,
        },
      },
      orderBy: { joinedAt: "desc" },
      take: 20,
      select: {
        companyRole: true,
        company: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            logoAsset: { select: { publicUrl: true } },
          },
        },
      },
    }),
    prisma.post.findMany({
      where: {
        ownerType: OwnerType.USER,
        ownerUserId: user.id,
        status: ContentStatus.APPROVED,
        isHidden: false,
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        publishedAt: true,
      },
    }),
    prisma.project.findMany({
      where: {
        ownerType: OwnerType.USER,
        ownerUserId: user.id,
        moderationStatus: ContentStatus.APPROVED,
        isHidden: false,
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        updatedAt: true,
        publishedAt: true,
      },
    }),
  ]);

  const roleLabel =
    user.siteRole === "ADMIN"
      ? "Admin"
      : user.siteRole === "MOD"
        ? "Mod"
        : "User";

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

        <header className="flex flex-wrap items-center gap-4">
          <Avatar
            size="lg"
            label={user.displayName}
            src={user.avatarUrl ?? undefined}
          />
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold md:text-4xl font-[var(--font-display)]">
              {user.displayName}
            </h1>
            <span className="rounded-full border border-[color:var(--color-line)] px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              {roleLabel}
            </span>
          </div>
        </header>

        {companies.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Companies</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {companies.map((membership) => (
                <Link
                  key={membership.company.id}
                  href={`/company/${membership.company.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-line)] bg-white/70 p-3 text-sm hover:border-[color:var(--color-brand)]"
                >
                  <Avatar
                    size="sm"
                    label={membership.company.name}
                    src={
                      membership.company.logoAsset?.publicUrl ??
                      membership.company.logoUrl ??
                      undefined
                    }
                  />
                  <div>
                    <p className="font-semibold">{membership.company.name}</p>
                    <p className="text-xs text-[color:var(--color-muted)]">
                      {membership.companyRole.replace("_", " ")}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 md:grid-cols-2">
          <Card className="space-y-3">
            <h3 className="text-lg font-semibold">Recent posts</h3>
            {posts.length === 0 ? (
              <p className="text-sm text-[color:var(--color-muted)]">
                No public posts yet.
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/post/${post.id}`}
                    className="block rounded-xl border border-[color:var(--color-line)] bg-white/70 px-3 py-2 hover:border-[color:var(--color-brand)]"
                  >
                    <p className="font-semibold">{post.title}</p>
                    <p className="text-xs text-[color:var(--color-muted)]">
                      Updated {formatDate(post.publishedAt ?? post.updatedAt)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <h3 className="text-lg font-semibold">Recent projects</h3>
            {projects.length === 0 ? (
              <p className="text-sm text-[color:var(--color-muted)]">
                No public projects yet.
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/project/${project.id}`}
                    className="block rounded-xl border border-[color:var(--color-line)] bg-white/70 px-3 py-2 hover:border-[color:var(--color-brand)]"
                  >
                    <p className="font-semibold">{project.name}</p>
                    <p className="text-xs text-[color:var(--color-muted)]">
                      Updated {formatDate(project.publishedAt ?? project.updatedAt)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </section>
      </Container>
    </main>
  );
}
