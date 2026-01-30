/**
 * Launcher SSO Routes
 *
 * Handles the launcher authentication flow:
 * 1. User logs in on website (via Discord)
 * 2. Website generates a one-time login code
 * 3. Launcher opens custom protocol URL with the code
 * 4. Launcher exchanges code for a launcher session token
 * 5. Launcher uses token for API requests
 */

import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "@prismmtr/db";
import { authMiddleware, requireUser } from "../middleware/auth.js";
import {
  generateLoginCode,
  exchangeLoginCode,
  validateLauncherSession,
  revokelauncherSession,
  revokeAllLauncherSessions,
  getUserLauncherSessions,
  LauncherSessionError
} from "../services/launcher-session.js";
import {
  verifyMinecraftAccess,
  needsReverification,
  MicrosoftAuthError
} from "../services/microsoft-minecraft.js";

const router = Router();

// Rate limiting (simple in-memory)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(key);

  if (!limit || limit.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (limit.count >= RATE_LIMIT_MAX) {
    return false;
  }

  limit.count++;
  return true;
}

// ============================================
// Launcher Auth Middleware
// ============================================

/**
 * Middleware to authenticate launcher requests using Bearer token.
 */
async function launcherAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Missing or invalid authorization header",
      code: "UNAUTHORIZED"
    });
    return;
  }

  const token = authHeader.slice(7);

  if (!token) {
    res.status(401).json({
      error: "Missing launcher token",
      code: "UNAUTHORIZED"
    });
    return;
  }

  try {
    const result = await validateLauncherSession(token);

    if (!result) {
      res.status(401).json({
        error: "Invalid or expired launcher session",
        code: "SESSION_INVALID"
      });
      return;
    }

    // Attach to request
    (req as any).launcherSession = result.session;
    (req as any).user = result.user;
    (req as any).microsoftLink = result.microsoftLink;

    next();
  } catch (err) {
    console.error("Launcher auth error:", err);
    res.status(500).json({
      error: "Authentication failed",
      code: "AUTH_ERROR"
    });
  }
}

// ============================================
// Generate Login Code (Web)
// ============================================

/**
 * POST /launcher/login-code
 * Generates a one-time login code for the launcher.
 * Requires user to be logged in via web session.
 */
router.post("/login-code", authMiddleware, requireUser, async (req, res) => {
  const userId = req.user!.id;
  const { deviceName } = req.body as { deviceName?: string };

  // Rate limit by user ID
  if (!checkRateLimit(`launcher_code:${userId}`)) {
    res.status(429).json({
      error: "Too many requests. Please wait a minute.",
      code: "RATE_LIMITED"
    });
    return;
  }

  // Check if user is banned
  if (req.user!.isBanned) {
    res.status(403).json({
      error: "Your account is suspended",
      code: "USER_BANNED"
    });
    return;
  }

  // Check if Microsoft account is linked
  const link = await prisma.microsoftLink.findUnique({
    where: { userId }
  });

  if (!link) {
    res.status(400).json({
      error: "Please link your Microsoft account first",
      code: "NO_MICROSOFT_LINK"
    });
    return;
  }

  // Check entitlement
  if (!link.hasMinecraftEntitlement) {
    res.status(403).json({
      error: "No Minecraft license found on your Microsoft account",
      code: "NO_MINECRAFT_LICENSE"
    });
    return;
  }

  try {
    const { code, expiresAt } = await generateLoginCode(userId, deviceName);

    res.json({
      code,
      expiresAt: expiresAt.toISOString(),
      expiresIn: Math.floor((expiresAt.getTime() - Date.now()) / 1000)
    });
  } catch (err) {
    console.error("Failed to generate login code:", err);

    if (err instanceof LauncherSessionError) {
      res.status(400).json({
        error: err.message,
        code: err.code
      });
    } else {
      res.status(500).json({
        error: "Failed to generate login code",
        code: "INTERNAL_ERROR"
      });
    }
  }
});

// ============================================
// Exchange Code for Session (Launcher)
// ============================================

/**
 * POST /launcher/exchange
 * Exchanges a one-time login code for a launcher session token.
 * Called by the launcher application.
 */
router.post("/exchange", async (req, res) => {
  const { code, deviceName } = req.body as { code?: string; deviceName?: string };

  if (!code) {
    res.status(400).json({
      error: "Missing login code",
      code: "MISSING_CODE"
    });
    return;
  }

  // Rate limit by IP
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  if (!checkRateLimit(`launcher_exchange:${clientIp}`)) {
    res.status(429).json({
      error: "Too many requests. Please wait a minute.",
      code: "RATE_LIMITED"
    });
    return;
  }

  try {
    const { session, user, microsoftLink } = await exchangeLoginCode(code, deviceName);

    // Check if re-verification is needed
    let verification = null;
    if (microsoftLink && needsReverification(microsoftLink.verifiedAt, 24)) {
      try {
        // Attempt re-verification (with short timeout)
        verification = await Promise.race([
          verifyMinecraftAccess(user.id),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("Verification timeout")), 10000)
          )
        ]);
      } catch (err) {
        console.warn("Background re-verification failed:", err);
        // Continue with existing data if re-verification fails
      }
    }

    // Get the latest link data
    const link = await prisma.microsoftLink.findUnique({
      where: { userId: user.id }
    });

    // Log event
    await prisma.eventLog.create({
      data: {
        type: "LAUNCHER_SESSION_CREATED",
        actorUserId: user.id,
        targetUserId: user.id,
        entityType: "LAUNCHER_SESSION",
        entityId: session.id,
        payload: {
          deviceName: session.deviceName
        }
      }
    });

    res.json({
      launcherToken: session.id,
      expiresAt: session.expiresAt.toISOString(),
      user: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        globalRole: user.globalRole,
        mcUuid: link?.mcUuid,
        mcName: link?.mcName,
        hasMinecraftEntitlement: link?.hasMinecraftEntitlement ?? false
      }
    });
  } catch (err) {
    console.error("Failed to exchange login code:", err);

    if (err instanceof LauncherSessionError) {
      const statusMap: Record<string, number> = {
        INVALID_CODE: 400,
        CODE_USED: 400,
        CODE_EXPIRED: 400,
        USER_BANNED: 403,
        NO_MICROSOFT_LINK: 400,
        NO_MINECRAFT_LICENSE: 403,
        RATE_LIMITED: 429
      };

      res.status(statusMap[err.code] || 400).json({
        error: err.message,
        code: err.code
      });
    } else {
      res.status(500).json({
        error: "Failed to exchange login code",
        code: "INTERNAL_ERROR"
      });
    }
  }
});

// ============================================
// Launcher Session Info (Launcher)
// ============================================

/**
 * GET /launcher/me
 * Returns the current user info for the launcher session.
 */
router.get("/me", launcherAuthMiddleware, async (req, res) => {
  const user = (req as any).user;
  const link = (req as any).microsoftLink;
  const session = (req as any).launcherSession;

  res.json({
    user: {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      globalRole: user.globalRole,
      mcUuid: link?.mcUuid,
      mcName: link?.mcName,
      hasMinecraftEntitlement: link?.hasMinecraftEntitlement ?? false
    },
    session: {
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      deviceName: session.deviceName
    }
  });
});

/**
 * POST /launcher/heartbeat
 * Optional heartbeat to keep the session active.
 */
router.post("/heartbeat", launcherAuthMiddleware, async (req, res) => {
  const session = (req as any).launcherSession;

  // lastSeenAt is updated automatically in validation
  res.json({
    ok: true,
    sessionId: session.id,
    lastSeenAt: new Date().toISOString()
  });
});

// ============================================
// Session Management (Web)
// ============================================

/**
 * GET /launcher/sessions
 * Lists all active launcher sessions for the current user.
 * Requires web session.
 */
router.get("/sessions", authMiddleware, requireUser, async (req, res) => {
  const userId = req.user!.id;

  try {
    const sessions = await getUserLauncherSessions(userId);

    res.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        deviceName: s.deviceName,
        createdAt: s.createdAt.toISOString(),
        lastSeenAt: s.lastSeenAt.toISOString(),
        expiresAt: s.expiresAt.toISOString()
      }))
    });
  } catch (err) {
    console.error("Failed to get launcher sessions:", err);
    res.status(500).json({
      error: "Failed to get sessions",
      code: "INTERNAL_ERROR"
    });
  }
});

/**
 * POST /launcher/sessions/:id/revoke
 * Revokes a specific launcher session.
 * Requires web session.
 */
router.post("/sessions/:id/revoke", authMiddleware, requireUser, async (req, res) => {
  const userId = req.user!.id;
  const sessionId = req.params.id;

  try {
    // Verify the session belongs to the user
    const session = await prisma.launcherSession.findUnique({
      where: { id: sessionId }
    });

    if (!session || session.userId !== userId) {
      res.status(404).json({
        error: "Session not found",
        code: "NOT_FOUND"
      });
      return;
    }

    const revoked = await revokelauncherSession(sessionId);

    if (revoked) {
      // Log event
      await prisma.eventLog.create({
        data: {
          type: "LAUNCHER_SESSION_REVOKED",
          actorUserId: userId,
          targetUserId: userId,
          entityType: "LAUNCHER_SESSION",
          entityId: sessionId,
          payload: {
            deviceName: session.deviceName
          }
        }
      });
    }

    res.json({
      ok: true,
      revoked
    });
  } catch (err) {
    console.error("Failed to revoke launcher session:", err);
    res.status(500).json({
      error: "Failed to revoke session",
      code: "INTERNAL_ERROR"
    });
  }
});

/**
 * POST /launcher/sessions/revoke-all
 * Revokes all launcher sessions for the current user.
 * Requires web session.
 */
router.post("/sessions/revoke-all", authMiddleware, requireUser, async (req, res) => {
  const userId = req.user!.id;

  try {
    const count = await revokeAllLauncherSessions(userId);

    // Log event
    await prisma.eventLog.create({
      data: {
        type: "LAUNCHER_SESSIONS_REVOKED_ALL",
        actorUserId: userId,
        targetUserId: userId,
        entityType: "USER",
        entityId: userId,
        payload: {
          revokedCount: count
        }
      }
    });

    res.json({
      ok: true,
      revokedCount: count
    });
  } catch (err) {
    console.error("Failed to revoke all launcher sessions:", err);
    res.status(500).json({
      error: "Failed to revoke sessions",
      code: "INTERNAL_ERROR"
    });
  }
});

// ============================================
// Logout (Launcher)
// ============================================

/**
 * POST /launcher/logout
 * Logs out the current launcher session.
 * Called by the launcher application.
 */
router.post("/logout", launcherAuthMiddleware, async (req, res) => {
  const session = (req as any).launcherSession;
  const user = (req as any).user;

  try {
    await revokelauncherSession(session.id);

    // Log event
    await prisma.eventLog.create({
      data: {
        type: "LAUNCHER_SESSION_LOGOUT",
        actorUserId: user.id,
        targetUserId: user.id,
        entityType: "LAUNCHER_SESSION",
        entityId: session.id,
        payload: {
          deviceName: session.deviceName
        }
      }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to logout launcher session:", err);
    res.status(500).json({
      error: "Failed to logout",
      code: "INTERNAL_ERROR"
    });
  }
});

export default router;
