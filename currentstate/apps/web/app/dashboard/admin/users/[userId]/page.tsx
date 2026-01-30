import Link from "next/link";

import UserDetailClient from "./UserDetailClient";

type PageProps = { params?: any; searchParams?: any };

export default async function AdminUserDetailPage({ params }: PageProps) {
  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <Link
          href="/dashboard/admin/users"
          className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--color-muted)]"
        >
          Back to users
        </Link>
        <h2 className="text-2xl font-semibold">User Detail</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Review roles, content, memberships, and tickets.
        </p>
      </header>
      <UserDetailClient userId={params.userId} />
    </div>
  );
}
