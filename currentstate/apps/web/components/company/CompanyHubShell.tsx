"use client";

import type { PropsWithChildren } from "react";
import { createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import Avatar from "@/components/ui/Avatar";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import { cn } from "@/lib/cn";
import {
  companyRoleLabels,
  type CompanyRoleValue,
} from "@/lib/company/roles";

type CompanyInfo = {
  id: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  categories: string[];
};

type CompanyHubContextValue = {
  company: CompanyInfo;
  role: CompanyRoleValue;
  userId: string;
};

const CompanyHubContext = createContext<CompanyHubContextValue | null>(null);

export function useCompanyHub() {
  const context = useContext(CompanyHubContext);
  if (!context) {
    throw new Error("useCompanyHub must be used within CompanyHubShell.");
  }
  return context;
}

type CompanyHubShellProps = PropsWithChildren<{
  company: CompanyInfo;
  role: CompanyRoleValue;
  userId: string;
}>;

function isActivePath(pathname: string, href: string) {
  if (href.endsWith("/hub")) {
    return pathname === href;
  }
  return pathname.startsWith(href);
}

export default function CompanyHubShell({
  company,
  role,
  userId,
  children,
}: CompanyHubShellProps) {
  const pathname = usePathname();

  const navItems = [
    { label: "Overview", href: `/company/${company.id}/hub` },
    { label: "Posts", href: `/company/${company.id}/hub/posts` },
    { label: "Projects", href: `/company/${company.id}/hub/projects` },
    { label: "Proposals", href: `/company/${company.id}/hub/proposals` },
    { label: "Members", href: `/company/${company.id}/hub/members` },
    { label: "Partnerships", href: `/company/${company.id}/hub/partnerships` },
    {
      label: "Collaborations",
      href: `/company/${company.id}/hub/collaborations`,
    },
    { label: "Settings", href: `/company/${company.id}/hub/settings` },
  ];

  return (
    <CompanyHubContext.Provider value={{ company, role, userId }}>
      <main className="py-12 md:py-16">
        <Container className="space-y-8">
          <header className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--color-muted)]">
              Company hub
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold md:text-4xl font-[var(--font-display)]">
                {company.name}
              </h1>
              <span className="rounded-full border border-[color:var(--color-line)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                {companyRoleLabels[role]}
              </span>
            </div>
          </header>

          <section className="grid gap-6 lg:grid-cols-[240px_1fr]">
            <aside className="space-y-4">
              <Card className="space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    size="sm"
                    label={company.name}
                    src={company.logoUrl ?? undefined}
                  />
                  <div>
                    <p className="text-sm font-semibold">{company.name}</p>
                    <p className="text-xs text-[color:var(--color-muted)]">
                      {companyRoleLabels[role]}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/company/${company.id}`}
                  className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-brand-strong)]"
                >
                  View public page
                </Link>
              </Card>

              <Card className="space-y-1 p-2">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "block rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                      isActivePath(pathname ?? "", item.href)
                        ? "bg-[color:var(--color-brand)] text-white shadow-[var(--shadow-soft)]"
                        : "text-[color:var(--color-ink)] hover:bg-white/70",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </Card>
            </aside>

            <div className="space-y-6">{children}</div>
          </section>
        </Container>
      </main>
    </CompanyHubContext.Provider>
  );
}
