"use client";

import type { PropsWithChildren } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

const adminItems = [
  { label: "Moderation", href: "/dashboard/admin/moderation" },
  { label: "Manage Users", href: "/dashboard/admin/users" },
  { label: "Tickets", href: "/dashboard/admin/tickets" },
  { label: "Content Control", href: "/dashboard/admin/content" },
  { label: "Audit Log", href: "/dashboard/admin/audit" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard/admin") {
    return pathname === href;
  }
  return pathname.startsWith(href);
}

export default function AdminShell({ children }: PropsWithChildren) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--color-muted)]">
          Admin Panel
        </p>
        <h2 className="text-2xl font-semibold">Administration</h2>
      </header>

      <nav className="flex flex-wrap gap-2">
        {adminItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
              isActivePath(pathname, item.href)
                ? "bg-[color:var(--color-brand)] text-white shadow-[var(--shadow-soft)]"
                : "border border-[color:var(--color-line)] text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] hover:border-[color:var(--color-brand)]",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div>{children}</div>
    </div>
  );
}
