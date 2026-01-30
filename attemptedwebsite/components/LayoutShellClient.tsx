"use client";

import { usePathname } from "next/navigation";
import { useEffect, type PropsWithChildren } from "react";
import Starfield from "@/components/Starfield";

export default function LayoutShellClient({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const isApp = pathname?.startsWith("/dashboard") || pathname?.startsWith("/company");

  useEffect(() => {
    if (isApp) {
      document.documentElement.classList.add("app-shell");
    } else {
      document.documentElement.classList.remove("app-shell");
    }
  }, [isApp]);

  useEffect(() => {
    if (!pathname) return;
    const pageKey = (() => {
      if (pathname === "/") return "home";
      if (pathname.startsWith("/download")) return "download";
      if (pathname.startsWith("/discovery")) return "discovery";
      if (pathname.startsWith("/posts")) return "posts";
      if (pathname.startsWith("/projects")) return "projects";
      if (pathname.startsWith("/help")) return "help";
      if (pathname.startsWith("/terms")) return "terms";
      if (pathname.startsWith("/company")) return "company";
      if (pathname.startsWith("/dashboard/admin")) return "admin";
      if (pathname.startsWith("/dashboard")) return "dashboard";
      return "page";
    })();
    document.body.dataset.page = pageKey;
  }, [pathname]);

  return (
    <>
      <Starfield />
      {children}
    </>
  );
}
