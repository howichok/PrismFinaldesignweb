import { NextResponse } from "next/server";
import { NotificationType, TicketStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { isModOrAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { apiError, rateLimitError } from "@/lib/api/errors";
import {
  buildRateLimitKey,
  rateLimit,
} from "@/lib/security/rateLimit";
import { parseBody } from "@/lib/validation/request";
import { ticketMessageSchema } from "@/lib/validation/schemas";

function truncateMessage(value: string, limit = 160) {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 3)}...`;
}

export async function POST(
  request: Request,
  context: { params: { ticketId: string } },
) {
  const params = context.params;
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const rate = await rateLimit({
    key: buildRateLimitKey(["tickets", "message", auth.session!.userId]),
    limit: 10,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return rateLimitError(rate.retryAfter);
  }

  const { data, error } = await parseBody(request, ticketMessageSchema);
  if (error) return error;

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.ticketId },
    select: {
      id: true,
      subject: true,
      status: true,
      createdByUserId: true,
    },
  });

  if (!ticket) {
    return apiError(404, "NOT_FOUND", "Ticket not found.");
  }

  const isStaff = isModOrAdmin(auth.session!.siteRole);
  const isOwner = ticket.createdByUserId === auth.session!.userId;

  if (!isStaff && !isOwner) {
    return apiError(403, "FORBIDDEN", "Forbidden");
  }

  if (ticket.status === TicketStatus.CLOSED) {
    return apiError(400, "TICKET_CLOSED", "Ticket closed.");
  }

  const nextStatus = isStaff ? TicketStatus.ANSWERED : TicketStatus.OPEN;

  await prisma.$transaction(async (tx) => {
    await tx.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        authorUserId: auth.session!.userId,
        message: data.message,
      },
    });

    await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        status: nextStatus,
      },
    });

    if (isStaff && ticket.createdByUserId !== auth.session!.userId) {
      await tx.notification.create({
        data: {
          userId: ticket.createdByUserId,
          type: NotificationType.TICKET,
          title: `Ticket reply: ${ticket.subject}`,
          body: truncateMessage(data.message),
          link: `/ticket/${ticket.id}`,
        },
      });
    }
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}
