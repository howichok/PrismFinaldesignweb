import { notFound, redirect } from "next/navigation";

import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import TicketThreadClient from "@/app/ticket/[ticketId]/TicketThreadClient";
import { getSession } from "@/lib/auth/session";
import { isModOrAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

type TicketMessagePayload = {
  id: string;
  message: string;
  createdAt: string;
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    siteRole: "USER" | "MOD" | "ADMIN";
  };
};

type TicketPayload = {
  id: string;
  subject: string;
  category: "LAUNCHER" | "SERVER" | "WEBSITE" | "REPORT" | "OTHER";
  status: "OPEN" | "ANSWERED" | "CLOSED";
  createdAt: string;
  updatedAt: string;
    createdBy: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
    };
};

export default async function TicketThreadPage({
  params,
}: {
  params: any;
}) {
  const session = await getSession();

  if (!session) {
    redirect(`/unauthorized?next=/ticket/${params.ticketId}`);
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.ticketId },
    select: {
      id: true,
      subject: true,
      category: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      createdByUserId: true,
      createdBy: {
        select: { id: true, displayName: true, avatarUrl: true },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          message: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              siteRole: true,
            },
          },
        },
      },
    },
  });

  if (!ticket) {
    notFound();
  }

  const isStaff = isModOrAdmin(session.siteRole);
  const isOwner = ticket.createdByUserId === session.userId;

  if (!isStaff && !isOwner) {
    return (
      <main className="py-12 md:py-16">
        <Container className="space-y-6">
          <header className="space-y-2">
            <h1 className="text-3xl font-semibold md:text-4xl font-[var(--font-display)]">
              Ticket access
            </h1>
            <p className="text-sm text-[color:var(--color-muted)]">
              You do not have access to this ticket.
            </p>
          </header>
          <Card className="text-sm text-[color:var(--color-muted)]">
            If you believe this is an error, contact an administrator.
          </Card>
        </Container>
      </main>
    );
  }

  const ticketPayload: TicketPayload = {
    id: ticket.id,
    subject: ticket.subject,
    category: ticket.category,
    status: ticket.status,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    createdBy: {
      id: ticket.createdBy.id,
      displayName: ticket.createdBy.displayName,
      avatarUrl: ticket.createdBy.avatarUrl,
    },
  };

  const messagePayload: TicketMessagePayload[] = ticket.messages.map(
    (message) => ({
      id: message.id,
      message: message.message,
      createdAt: message.createdAt.toISOString(),
      author: {
        id: message.author.id,
        displayName: message.author.displayName,
        avatarUrl: message.author.avatarUrl,
        siteRole: message.author.siteRole,
      },
    }),
  );

  return (
    <main className="py-12 md:py-16">
      <Container className="space-y-6">
        <TicketThreadClient
          initialTicket={ticketPayload}
          initialMessages={messagePayload}
          viewer={{
            id: session.userId,
            displayName: session.displayName,
            siteRole: session.siteRole,
          }}
        />
      </Container>
    </main>
  );
}
