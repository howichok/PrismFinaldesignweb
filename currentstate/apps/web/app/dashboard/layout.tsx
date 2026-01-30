import type { PropsWithChildren } from "react";
import { redirect } from "next/navigation";

import DashboardShell from "@/components/dashboard/DashboardShell";
import { getSession } from "@/lib/auth/session";

type LayoutProps = PropsWithChildren;

export default async function DashboardLayout({ children }: LayoutProps) {
  const session = await getSession();

  if (!session) {
    redirect("/unauthorized");
  }

  return (
    <DashboardShell
      user={{
        id: session.userId,
        displayName: session.displayName,
        avatarUrl: session.avatarUrl,
        siteRole: session.siteRole,
      }}
    >
      {children}
    </DashboardShell>
  );
}
