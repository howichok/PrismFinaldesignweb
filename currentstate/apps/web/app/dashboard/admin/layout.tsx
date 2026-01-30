import type { PropsWithChildren } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isModOrAdmin } from "@/lib/auth/guards";
import { destroySession, getSessionById } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import AdminShell from "@/components/dashboard/AdminShell";

export default async function AdminLayout({ children }: PropsWithChildren) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("prism_session")?.value;
  const session = await getSessionById(sessionId);

  if (!session) {
    redirect("/unauthorized");
  }

  if (!isModOrAdmin(session.siteRole)) {
    redirect("/forbidden");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { rolesVersion: true },
  });

  if (!user || user.rolesVersion !== session.rolesVersion) {
    await destroySession(sessionId);
    redirect("/unauthorized?reason=refresh");
  }

  return <AdminShell>{children}</AdminShell>;
}
