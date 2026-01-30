import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/api";
import { isModOrAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _request: Request,
  context: { params: any },
) {
  const params = context.params;
  const auth = await requireAuth();
  if (auth.response) return auth.response;

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
        select: { id: true, displayName: true },
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
              siteRole: true,
            },
          },
        },
      },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isStaff = isModOrAdmin(auth.session!.siteRole);
  const isOwner = ticket.createdByUserId === auth.session!.userId;

  if (!isStaff && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    ticket: {
      id: ticket.id,
      subject: ticket.subject,
      category: ticket.category,
      status: ticket.status,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      createdBy: {
        id: ticket.createdBy.id,
        displayName: ticket.createdBy.displayName,
      },
    },
    messages: ticket.messages.map((message: typeof ticket.messages[0]) => ({
      id: message.id,
      message: message.message,
      createdAt: message.createdAt.toISOString(),
      author: {
        id: message.author.id,
        displayName: message.author.displayName,
        siteRole: message.author.siteRole,
      },
    })),
  });
}
