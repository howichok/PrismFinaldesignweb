import { Router } from "express";
import { prisma } from "@prismmtr/db";
import { authMiddleware, requireUser, requireRole } from "../middleware/auth.js";
import { rateLimiters } from "../middleware/security.js";
import {
  CreateTicketInput,
  AddTicketMessageInput,
  UpdateTicketStatusInput,
  AssignTicketInput,
  ListTicketsQuery,
  isTicketOpen,
  getTicketStatusLabel
} from "@prismmtr/shared";
import {
  notifyTicketCreated,
  notifyTicketNewMessage,
  notifyTicketStatusUpdated,
  notifyTicketAssigned,
  pushNotificationToUser
} from "../services/notifications.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware, requireUser);

// ============================================
// User Ticket Routes
// ============================================

/**
 * POST /tickets
 * Create a new ticket with initial message
 */
router.post("/", rateLimiters.ticketCreate, async (req, res) => {
  const userId = req.user!.id;

  const parsed = CreateTicketInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const { category, title, body } = parsed.data;

  try {
    const now = new Date();

    // Create ticket and first message in transaction
    const ticket = await prisma.$transaction(async (tx) => {
      const newTicket = await tx.ticket.create({
        data: {
          authorId: userId,
          category,
          title,
          status: "OPEN",
          lastMessageAt: now
        },
        include: {
          author: { select: { id: true, username: true, avatarUrl: true } }
        }
      });

      // Create first message
      await tx.ticketMessage.create({
        data: {
          ticketId: newTicket.id,
          authorId: userId,
          body
        }
      });

      return newTicket;
    });

    // Notify MOD/ADMIN users about new ticket
    const modAdmins = await prisma.user.findMany({
      where: {
        globalRole: { in: ["MOD", "ADMIN"] }
      },
      select: { id: true }
    });

    for (const mod of modAdmins) {
      const { notification } = await notifyTicketCreated({
        targetUserId: mod.id,
        ticketId: ticket.id,
        ticketTitle: ticket.title,
        authorId: userId,
        authorUsername: req.user!.username
      });

      if (notification) {
        await pushNotificationToUser(mod.id, notification);
      }
    }

    res.status(201).json(formatTicket(ticket));
  } catch (err) {
    console.error("Failed to create ticket:", err);
    res.status(500).json({ error: "Failed to create ticket" });
  }
});

/**
 * GET /tickets
 * List user's tickets
 */
router.get("/", async (req, res) => {
  const userId = req.user!.id;
  const userRole = req.user!.globalRole;

  const parsed = ListTicketsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const { status, mineOnly, cursor, limit } = parsed.data;

  try {
    const where: any = {};

    // For regular users, always show only their own tickets
    // For MOD/ADMIN, respect mineOnly flag
    if (userRole === "USER" || mineOnly) {
      where.authorId = userId;
    }

    if (status) {
      where.status = status;
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        assignedTo: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { messages: true } }
      },
      orderBy: { lastMessageAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    const hasMore = tickets.length > limit;
    const items = hasMore ? tickets.slice(0, -1) : tickets;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    res.json({
      items: items.map(t => ({
        ...formatTicket(t),
        messageCount: t._count.messages
      })),
      total: items.length,
      nextCursor
    });
  } catch (err) {
    console.error("Failed to list tickets:", err);
    res.status(500).json({ error: "Failed to list tickets" });
  }
});

/**
 * GET /tickets/:id
 * Get ticket details with messages
 */
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const userRole = req.user!.globalRole;

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        assignedTo: { select: { id: true, username: true, avatarUrl: true } },
        messages: {
          include: {
            author: {
              select: { id: true, username: true, avatarUrl: true, globalRole: true }
            }
          },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found", code: "NOT_FOUND" });
      return;
    }

    // Check access: author can view, MOD/ADMIN can view any
    if (ticket.authorId !== userId && userRole === "USER") {
      res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      return;
    }

    res.json({
      ...formatTicket(ticket),
      messages: ticket.messages.map(formatMessage)
    });
  } catch (err) {
    console.error("Failed to get ticket:", err);
    res.status(500).json({ error: "Failed to get ticket" });
  }
});

/**
 * POST /tickets/:id/messages
 * Add a message to a ticket
 */
router.post("/:id/messages", rateLimiters.ticketMessage, async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const userRole = req.user!.globalRole;

  const parsed = AddTicketMessageInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const { body } = parsed.data;

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, username: true } },
        assignedTo: { select: { id: true, username: true } }
      }
    });

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found", code: "NOT_FOUND" });
      return;
    }

    // Check access: author or MOD/ADMIN can post
    const isAuthor = ticket.authorId === userId;
    const isStaff = userRole === "MOD" || userRole === "ADMIN";

    if (!isAuthor && !isStaff) {
      res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      return;
    }

    // Check if ticket is open
    if (!isTicketOpen(ticket.status as any)) {
      res.status(409).json({
        error: "Cannot add message to closed ticket",
        code: "TICKET_CLOSED"
      });
      return;
    }

    const now = new Date();

    // Create message and update ticket
    const message = await prisma.$transaction(async (tx) => {
      const newMessage = await tx.ticketMessage.create({
        data: {
          ticketId: id,
          authorId: userId,
          body
        },
        include: {
          author: {
            select: { id: true, username: true, avatarUrl: true, globalRole: true }
          }
        }
      });

      await tx.ticket.update({
        where: { id },
        data: { lastMessageAt: now }
      });

      return newMessage;
    });

    // Send notifications
    if (isStaff && !isAuthor) {
      // Staff replied to user's ticket
      const { notification } = await notifyTicketNewMessage({
        targetUserId: ticket.authorId,
        ticketId: id,
        ticketTitle: ticket.title,
        actorId: userId,
        actorUsername: req.user!.username,
        isStaffReply: true
      });

      if (notification) {
        await pushNotificationToUser(ticket.authorId, notification);
      }
    } else if (isAuthor && !isStaff) {
      // User replied, notify assigned mod or all mods
      if (ticket.assignedToId) {
        const { notification } = await notifyTicketNewMessage({
          targetUserId: ticket.assignedToId,
          ticketId: id,
          ticketTitle: ticket.title,
          actorId: userId,
          actorUsername: req.user!.username,
          isStaffReply: false
        });

        if (notification) {
          await pushNotificationToUser(ticket.assignedToId, notification);
        }
      } else {
        // Notify all MOD/ADMIN
        const modAdmins = await prisma.user.findMany({
          where: { globalRole: { in: ["MOD", "ADMIN"] } },
          select: { id: true }
        });

        for (const mod of modAdmins) {
          const { notification } = await notifyTicketNewMessage({
            targetUserId: mod.id,
            ticketId: id,
            ticketTitle: ticket.title,
            actorId: userId,
            actorUsername: req.user!.username,
            isStaffReply: false
          });

          if (notification) {
            await pushNotificationToUser(mod.id, notification);
          }
        }
      }
    }

    res.status(201).json(formatMessage(message));
  } catch (err) {
    console.error("Failed to add message:", err);
    res.status(500).json({ error: "Failed to add message" });
  }
});

/**
 * POST /tickets/:id/close
 * Allow author to close their own ticket
 */
router.post("/:id/close", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const ticket = await prisma.ticket.findUnique({ where: { id } });

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found", code: "NOT_FOUND" });
      return;
    }

    if (ticket.authorId !== userId) {
      res.status(403).json({ error: "Only the author can close this ticket", code: "FORBIDDEN" });
      return;
    }

    if (ticket.status === "CLOSED") {
      res.status(409).json({ error: "Ticket is already closed", code: "ALREADY_CLOSED" });
      return;
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data: { status: "CLOSED" },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        assignedTo: { select: { id: true, username: true, avatarUrl: true } }
      }
    });

    res.json(formatTicket(updated));
  } catch (err) {
    console.error("Failed to close ticket:", err);
    res.status(500).json({ error: "Failed to close ticket" });
  }
});

// ============================================
// MOD/ADMIN Ticket Routes
// ============================================

/**
 * GET /dashboard/mod/tickets
 * List tickets for moderation queue
 */
router.get("/mod/queue", requireRole("MOD"), async (req, res) => {
  const userId = req.user!.id;

  const parsed = ListTicketsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const { status, assignedToMe, cursor, limit } = parsed.data;

  try {
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (assignedToMe) {
      where.assignedToId = userId;
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        assignedTo: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { messages: true } }
      },
      orderBy: { lastMessageAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    const hasMore = tickets.length > limit;
    const items = hasMore ? tickets.slice(0, -1) : tickets;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    // Get counts by status
    const counts = await prisma.ticket.groupBy({
      by: ["status"],
      _count: { status: true }
    });

    const statusCounts = counts.reduce((acc, c) => {
      acc[c.status] = c._count.status;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      items: items.map(t => ({
        ...formatTicket(t),
        messageCount: t._count.messages
      })),
      total: items.length,
      nextCursor,
      counts: statusCounts
    });
  } catch (err) {
    console.error("Failed to list mod tickets:", err);
    res.status(500).json({ error: "Failed to list tickets" });
  }
});

/**
 * PATCH /tickets/:id/status
 * Change ticket status (MOD/ADMIN only)
 */
router.patch("/:id/status", requireRole("MOD"), async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const parsed = UpdateTicketStatusInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const { status } = parsed.data;

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, username: true } }
      }
    });

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found", code: "NOT_FOUND" });
      return;
    }

    if (ticket.status === status) {
      res.status(409).json({ error: "Status unchanged", code: "NO_CHANGE" });
      return;
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data: { status },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        assignedTo: { select: { id: true, username: true, avatarUrl: true } }
      }
    });

    // Notify ticket author
    const { notification } = await notifyTicketStatusUpdated({
      targetUserId: ticket.authorId,
      ticketId: id,
      ticketTitle: ticket.title,
      newStatus: getTicketStatusLabel(status),
      actorId: userId,
      actorUsername: req.user!.username
    });

    if (notification) {
      await pushNotificationToUser(ticket.authorId, notification);
    }

    res.json(formatTicket(updated));
  } catch (err) {
    console.error("Failed to update ticket status:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

/**
 * PATCH /tickets/:id/assign
 * Assign ticket to a MOD/ADMIN (MOD/ADMIN only)
 */
router.patch("/:id/assign", requireRole("MOD"), async (req, res) => {
  const { id } = req.params;
  const actorId = req.user!.id;

  const parsed = AssignTicketInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const { assignedToId } = parsed.data;

  try {
    const ticket = await prisma.ticket.findUnique({ where: { id } });

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found", code: "NOT_FOUND" });
      return;
    }

    // Verify assignee is MOD/ADMIN if specified
    if (assignedToId) {
      const assignee = await prisma.user.findUnique({
        where: { id: assignedToId },
        select: { id: true, globalRole: true, username: true }
      });

      if (!assignee) {
        res.status(404).json({ error: "Assignee not found", code: "ASSIGNEE_NOT_FOUND" });
        return;
      }

      if (assignee.globalRole === "USER") {
        res.status(422).json({ error: "Can only assign to MOD/ADMIN", code: "INVALID_ASSIGNEE" });
        return;
      }
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data: { assignedToId },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        assignedTo: { select: { id: true, username: true, avatarUrl: true } }
      }
    });

    // Notify new assignee
    if (assignedToId && assignedToId !== actorId) {
      const { notification } = await notifyTicketAssigned({
        targetUserId: assignedToId,
        ticketId: id,
        ticketTitle: ticket.title,
        actorId,
        actorUsername: req.user!.username
      });

      if (notification) {
        await pushNotificationToUser(assignedToId, notification);
      }
    }

    res.json(formatTicket(updated));
  } catch (err) {
    console.error("Failed to assign ticket:", err);
    res.status(500).json({ error: "Failed to assign ticket" });
  }
});

// ============================================
// Helpers
// ============================================

function formatTicket(ticket: any) {
  return {
    id: ticket.id,
    authorId: ticket.authorId,
    category: ticket.category,
    status: ticket.status,
    title: ticket.title,
    assignedToId: ticket.assignedToId,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    lastMessageAt: ticket.lastMessageAt.toISOString(),
    author: ticket.author,
    assignedTo: ticket.assignedTo ?? null
  };
}

function formatMessage(message: any) {
  return {
    id: message.id,
    ticketId: message.ticketId,
    authorId: message.authorId,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    author: message.author
  };
}

export default router;
