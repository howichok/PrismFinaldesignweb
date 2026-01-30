import type { PropsWithChildren } from "react";
import { notFound, redirect } from "next/navigation";

import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import CompanyHubShell from "@/components/company/CompanyHubShell";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

type LayoutProps = PropsWithChildren<{
  params: any;
}>;

export default async function CompanyHubLayout({
  params,
  children,
}: LayoutProps) {
  const session = await getSession();
  if (!session) {
    redirect(`/unauthorized?next=/company/${params.companyId}/hub`);
  }

  const [company, membership] = await Promise.all([
    prisma.company.findUnique({
      where: { id: params.companyId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        logoAsset: {
          select: {
            publicUrl: true,
          },
        },
        description: true,
        categories: true,
      },
    }),
    prisma.companyMembership.findUnique({
      where: {
        companyId_userId: {
          companyId: params.companyId,
          userId: session.userId,
        },
      },
      select: {
        companyRole: true,
      },
    }),
  ]);

  if (!company) {
    notFound();
  }

  if (!membership) {
    return (
      <main className="py-12 md:py-16">
        <Container className="space-y-6">
          <header className="space-y-2">
            <h1 className="text-3xl font-semibold md:text-4xl font-[var(--font-display)]">
              Access denied
            </h1>
            <p className="text-sm text-[color:var(--color-muted)] md:text-base">
              You are not a member of this company.
            </p>
          </header>
          <Card className="text-sm text-[color:var(--color-muted)]">
            Contact a company owner if you need access to the hub.
          </Card>
        </Container>
      </main>
    );
  }

  const companyInfo = {
    ...company,
    logoUrl: company.logoAsset?.publicUrl ?? company.logoUrl,
  };

  return (
    <CompanyHubShell
      company={companyInfo}
      role={membership.companyRole}
      userId={session.userId}
    >
      {children}
    </CompanyHubShell>
  );
}
