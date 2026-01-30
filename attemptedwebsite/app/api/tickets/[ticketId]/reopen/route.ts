import { NextResponse } from "next/server";
import { TicketStatus } from "@prisma/client";

import { requireModOrAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

export async function POST(
  _request: Request,
  context: { params: { ticketId: string } },
) {
  const params = context.params;
  const auth = await requireModOrAdmin();
  if (auth.response) return auth.response;

  try {
    const ticket = await prisma.ticket.update({
      where: { id: params.ticketId },
      data: { status: TicketStatus.OPEN },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: ticket.id });
  } catch (error) {
    console.error("Failed to reopen ticket", error);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
