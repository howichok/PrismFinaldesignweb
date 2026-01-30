import { NextResponse } from "next/server";
import { TicketCategory, TicketStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { rateLimitError } from "@/lib/api/errors";
import {
  buildRateLimitKey,
  rateLimit,
} from "@/lib/security/rateLimit";
import { parseBody } from "@/lib/validation/request";
import { ticketCreateSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const rate = await rateLimit({
    key: buildRateLimitKey(["tickets", "create", auth.session!.userId]),
    limit: 3,
    windowSeconds: 600,
  });
  if (!rate.allowed) {
    return rateLimitError(rate.retryAfter);
  }

  const { data, error } = await parseBody(request, ticketCreateSchema);
  if (error) return error;

  const ticket = await prisma.$transaction(async (tx) => {
    const createdTicket = await tx.ticket.create({
      data: {
        createdByUserId: auth.session!.userId,
        category: data.category as TicketCategory,
        subject: data.subject,
        status: TicketStatus.OPEN,
      },
      select: { id: true },
    });

    await tx.ticketMessage.create({
      data: {
        ticketId: createdTicket.id,
        authorUserId: auth.session!.userId,
        message: data.message,
      },
    });

    return createdTicket;
  });

  return NextResponse.json({ id: ticket.id });
}
