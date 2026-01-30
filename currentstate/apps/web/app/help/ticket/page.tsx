import { redirect } from "next/navigation";

import Container from "@/components/ui/Container";
import HelpTicketClient from "@/app/help/ticket/HelpTicketClient";
import { getSession } from "@/lib/auth/session";

export default async function HelpTicketPage() {
  const session = await getSession();

  if (!session) {
    redirect("/unauthorized?next=/help/ticket");
  }

  return (
    <main className="py-12 md:py-16">
      <Container className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--color-muted)]">
            Support
          </p>
          <h1 className="text-3xl font-semibold md:text-4xl font-[var(--font-display)]">
            Create a ticket
          </h1>
          <p className="text-sm text-[color:var(--color-muted)] md:text-base">
            Share your issue and we will follow up with the right team.
          </p>
        </header>

        <HelpTicketClient />
      </Container>
    </main>
  );
}
