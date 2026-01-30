import { Router } from "express";
import { authMiddleware, requireUser } from "../middleware/auth.js";
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
} from "../services/notifications.js";
import { ListNotificationsQuery } from "@prismmtr/shared";

const router = Router();

// All routes require authentication
router.use(authMiddleware, requireUser);

/**
 * GET /notifications
 * List notifications for the current user
 * Query params: cursor, limit, unreadOnly
 */
router.get("/", async (req, res) => {
  const userId = req.user!.id;

  // Parse and validate query params
  const parsed = ListNotificationsQuery.safeParse({
    cursor: req.query.cursor,
    limit: req.query.limit,
    unreadOnly: req.query.unreadOnly === "1" || req.query.unreadOnly === "true"
  });

  if (!parsed.success) {
    res.status(422).json({
      error: "Invalid query parameters",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  try {
    const result = await listNotifications({
      userId,
      cursor: parsed.data.cursor,
      limit: parsed.data.limit,
      unreadOnly: parsed.data.unreadOnly
    });

    res.json(result);
  } catch (err) {
    console.error("Failed to list notifications:", err);
    res.status(500).json({ error: "Failed to list notifications" });
  }
});

/**
 * GET /notifications/unread-count
 * Get the count of unread notifications for the current user
 */
router.get("/unread-count", async (req, res) => {
  const userId = req.user!.id;

  try {
    const unread = await getUnreadCount(userId);
    res.json({ unread });
  } catch (err) {
    console.error("Failed to get unread count:", err);
    res.status(500).json({ error: "Failed to get unread count" });
  }
});

/**
 * POST /notifications/:id/read
 * Mark a single notification as read
 * Returns updated unread count for authoritative client update
 */
router.post("/:id/read", async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const success = await markAsRead(id, userId);

    if (!success) {
      // Either notification doesn't exist, doesn't belong to user, or already read
      res.status(404).json({
        error: "Notification not found or already read",
        code: "NOT_FOUND"
      });
      return;
    }

    // Return authoritative unread count
    const unread = await getUnreadCount(userId);
    res.json({ ok: true, unread });
  } catch (err) {
    console.error("Failed to mark notification as read:", err);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

/**
 * POST /notifications/read-all
 * Mark all notifications as read for the current user
 * Returns updated unread count (should be 0)
 */
router.post("/read-all", async (req, res) => {
  const userId = req.user!.id;

  try {
    const count = await markAllAsRead(userId);
    // Unread count should be 0 after marking all as read
    res.json({ ok: true, count, unread: 0 });
  } catch (err) {
    console.error("Failed to mark all notifications as read:", err);
    res.status(500).json({ error: "Failed to mark all as read" });
  }
});

export default router;
