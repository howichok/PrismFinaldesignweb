"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import type { SessionData } from "@/lib/auth/types";
import NavLink from "@/components/NavLink";
import HeaderProfile from "@/components/HeaderProfile";
import NotificationsBell from "@/components/notifications/NotificationsBell"; // Container removed
import { csrfFetch } from "@/lib/security/csrf-client";

type HeaderClientProps = {
  session: SessionData | null;
};

export default function HeaderClient({ session }: HeaderClientProps) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const currentPath = searchParams?.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname;
  const signInUrl = `/api/auth/discord/start?next=${encodeURIComponent(
    currentPath,
  )}`;

  const handleLogout = async () => {
    await csrfFetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <header className="header">
      <div className="header__inner">
        {/* Logo */}
        <Link href="/" className="header__logo">
          <picture>
            <source
              srcSet="/assets/img/prismmtrlogo.webp"
              type="image/webp"
            />
            <img
              src="/assets/img/prismmtrlogo-optimized.png"
              alt="PrismMTR"
              className="logo-img"
              width={40}
              height={40}
            />
          </picture>
          <span>PrismMTR</span>
        </Link>

        {/* Navigation */}
        <nav className="header__nav">
          <NavLink href="/">Home</NavLink>
          <NavLink href="/download">Download</NavLink>
          <NavLink href="/discovery">Discovery</NavLink>
          <NavLink href="/posts">Posts</NavLink>
          <NavLink href="/help">Help</NavLink>
        </nav>

        {/* Header Actions */}
        <div className="header__actions">
          {session ? (
            <>
              <NotificationsBell />
              <HeaderProfile session={session} />
            </>
          ) : (
            <Link href={signInUrl} className="btn btn--primary btn--sm">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
