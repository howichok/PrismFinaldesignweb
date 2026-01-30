import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentStatus } from "@prisma/client";

import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import UserChip from "@/components/users/UserChip";
import { buttonStyles } from "@/components/ui/Button";
import { prisma } from "@/lib/db/prisma";

type PageProps = {
  params: {
    postId: string;
  };
};

type PostResult = {
  post: {
    id: string;
    title: string;
    content: string;
    tags: string[];
    updatedAt: Date;
    publishedAt: Date | null;
    ownerType: "USER" | "COMPANY";
    coverAsset: { publicUrl: string } | null;
    ownerUser: { id: string; displayName: string; avatarUrl: string | null } | null;
    ownerCompany: { id: string; name: string } | null;
  } | null;
  error: boolean;
};

function formatDate(value: Date | null) {
  if (!value) return "Unpublished";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

async function getPost(postId: string): Promise<PostResult> {
  try {
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        status: ContentStatus.APPROVED,
        isHidden: false,
      },
      select: {
        id: true,
        title: true,
        content: true,
        tags: true,
        updatedAt: true,
        publishedAt: true,
        ownerType: true,
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
          },
        },
      },
    });

    return { post, error: false };
  } catch (error) {
    console.error("Failed to load post", error);
    return { post: null, error: true };
  }
}

export default async function PostPage({ params }: PageProps) {
  const result = await getPost(params.postId);

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
              Post
            </h1>
          </header>
          <Card className="text-sm text-[color:var(--color-muted)]">
            Service unavailable. Please try again soon.
          </Card>
        </Container>
      </main>
    );
  }

  if (!result.post) {
    notFound();
  }

  const ownerLabel =
    result.post.ownerType === "COMPANY"
      ? result.post.ownerCompany?.name ?? "Unknown company"
      : result.post.ownerUser?.displayName ?? "Unknown author";

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
          {result.post.coverAsset?.publicUrl ? (
            <div className="overflow-hidden rounded-2xl border border-[color:var(--color-line)]">
              <img
                src={result.post.coverAsset.publicUrl}
                alt={`${result.post.title} cover`}
                className="h-56 w-full object-cover md:h-72"
              />
            </div>
          ) : null}
          <h1 className="text-3xl font-semibold md:text-4xl font-[var(--font-display)]">
            {result.post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--color-muted)] md:text-sm">
            <span>By</span>
            {result.post.ownerType === "USER" && result.post.ownerUser ? (
              <UserChip
                userId={result.post.ownerUser.id}
                displayName={result.post.ownerUser.displayName}
                avatarUrl={result.post.ownerUser.avatarUrl}
              />
            ) : result.post.ownerCompany ? (
              <Link href={`/company/${result.post.ownerCompany.id}`}>
                {result.post.ownerCompany.name}
              </Link>
            ) : (
              <span>{ownerLabel}</span>
            )}
            <span>Published {formatDate(result.post.publishedAt)}</span>
            <span>Last updated {formatDate(result.post.updatedAt)}</span>
          </div>
          {result.post.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {result.post.tags.map((tag) => (
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

        <Card className="space-y-4">
          <p className="whitespace-pre-line text-sm leading-relaxed text-[color:var(--color-ink)] md:text-base">
            {result.post.content}
          </p>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/discovery"
            className={buttonStyles({ variant: "outline", size: "sm" })}
          >
            Back to Discovery
          </Link>
        </div>
      </Container>
    </main>
  );
}
