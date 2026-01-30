import type { PropsWithChildren } from "react";

import Header from "@/components/Header";
import LayoutShellClient from "@/components/LayoutShellClient";

export default function LayoutShell({ children }: PropsWithChildren) {
  return (
    <LayoutShellClient>
      <Header />
      {children}
    </LayoutShellClient>
  );
}
