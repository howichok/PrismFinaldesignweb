"use client";

import type { ComponentPropsWithoutRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

type NavLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  href: string;
};

export default function NavLink({
  className,
  href,
  ...props
}: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "nav-link",
        isActive && "active",
        className,
      )}
      {...props}
    />
  );
}
