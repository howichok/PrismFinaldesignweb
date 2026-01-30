import Link from "next/link";

import TicketsClient from "@/app/dashboard/tickets/TicketsClient";
import { buttonStyles } from "@/components/ui/Button";

export default function DashboardTicketsPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">My Tickets</h2>
          <p className="text-sm text-[color:var(--color-muted)]">
            Track your support requests and responses from the team.
          </p>
        </div>
        <Link
          href="/help/ticket"
          className={buttonStyles({ variant: "primary", size: "sm" })}
        >
          New ticket
        </Link>
      </header>

      <TicketsClient />
    </div>
  );
}
