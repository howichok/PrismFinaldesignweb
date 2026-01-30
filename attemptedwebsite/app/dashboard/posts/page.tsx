import Link from "next/link";

import PostsClient from "@/app/dashboard/posts/PostsClient";
import { buttonStyles } from "@/components/ui/Button";

export default function DashboardPostsPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">My Posts</h2>
          <p className="text-sm text-[color:var(--color-muted)]">
            Draft, submit, and track the status of your posts.
          </p>
        </div>
        <Link
          href="/dashboard/posts/new"
          className={buttonStyles({ variant: "primary", size: "sm" })}
        >
          Create post
        </Link>
      </header>

      <PostsClient />
    </div>
  );
}
