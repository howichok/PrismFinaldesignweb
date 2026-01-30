"use client";

import type { PropsWithChildren } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import UserChip from "@/components/users/UserChip";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { isModOrAdmin } from "@/lib/auth/guards";
import { csrfFetch } from "@/lib/security/csrf-client";

type DashboardUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  siteRole: "USER" | "MOD" | "ADMIN";
};

type DashboardShellProps = PropsWithChildren<{
  user: DashboardUser;
}>;

const navItems = [
  { label: "Overview", href: "/dashboard" },
  { label: "My Posts", href: "/dashboard/posts" },
  { label: "My Projects", href: "/dashboard/projects" },
  { label: "My Companies", href: "/dashboard/companies" },
  { label: "Invites", href: "/dashboard/invites" },
  { label: "Tickets", href: "/dashboard/tickets" },
  { label: "Notifications", href: "/dashboard/notifications" },
  { label: "Settings", href: "/dashboard/settings" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }
  return pathname.startsWith(href);
}

export default function DashboardShell({
  user,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await csrfFetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar p-4 space-y-4">
        {/* User Profile Section */}
        <div className="space-y-3 p-3 rounded-xl border" style={{ background: "var(--glass-bg)", borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-3">
            <UserChip
              userId={user.id}
              displayName={user.displayName}
              avatarUrl={user.avatarUrl}
              viewerId={user.id}
            />
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {user.siteRole === "ADMIN"
                ? "Administrator"
                : user.siteRole === "MOD"
                  ? "Moderator"
                  : "Member"}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                isActivePath(pathname, item.href)
                  ? "text-white"
                  : "hover:bg-white/70"
              )}
              style={{
                background: isActivePath(pathname, item.href) ? "var(--color-accent)" : undefined,
                color: isActivePath(pathname, item.href) ? "#fff" : "var(--color-text)",
              }}
            >
              {item.label}
            </Link>
          ))}
          {isModOrAdmin(user.siteRole) ? (
            <Link
              href="/dashboard/admin"
              className={cn(
                "block rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                isActivePath(pathname, "/dashboard/admin")
                  ? "text-white"
                  : "hover:bg-white/70"
              )}
              style={{
                background: isActivePath(pathname, "/dashboard/admin") ? "var(--color-accent)" : undefined,
                color: isActivePath(pathname, "/dashboard/admin") ? "#fff" : "var(--color-text)",
              }}
            >
              Admin Panel
            </Link>
          ) : null}
        </nav>

        {/* Logout */}
        <button
          type="button"
          className={cn(
            buttonStyles({ variant: "ghost", size: "sm" }),
            "w-full justify-center"
          )}
          style={{ color: "var(--color-text-muted)" }}
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? "Logging out..." : "Log out"}
        </button>
      </aside>

      <div className="dashboard-main">
        <div className="container py-8 space-y-8">
          <header className="space-y-2">
            <p className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.3em", color: "var(--color-text-muted)" }}>
              Dashboard
            </p>
            <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              Welcome back, {user.displayName}
            </h1>
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
