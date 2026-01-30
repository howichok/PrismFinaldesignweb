import { prisma, type User, type AuthSession } from "@prismmtr/db";

// How often to update lastSeenAt (5 minutes)
const LAST_SEEN_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

// In-memory mapping of userId -> Set<socketId>
// This allows us to emit to all sockets for a user
const userSockets = new Map<string, Set<string>>();

// Reference to Socket.io server, set by initSocketAuth
let io: import("socket.io").Server | null = null;

/**
 * Initialize the socket server reference for session invalidation.
 */
export function setSocketServer(socketServer: import("socket.io").Server) {
  io = socketServer;
}

/**
 * Register a socket for a user.
 */
export function registerSocket(userId: string, socketId: string) {
  let sockets = userSockets.get(userId);
  if (!sockets) {
    sockets = new Set();
    userSockets.set(userId, sockets);
  }
  sockets.add(socketId);
}

/**
 * Unregister a socket for a user.
 */
export function unregisterSocket(userId: string, socketId: string) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) {
      userSockets.delete(userId);
    }
  }
}

/**
 * Get all socket IDs for a user.
 */
export function getUserSocketIds(userId: string): string[] {
  const sockets = userSockets.get(userId);
  return sockets ? Array.from(sockets) : [];
}

/**
 * Validates a session by ID.
 * Returns the session with user if valid, null otherwise.
 * Also checks rolesVersion and revokes if mismatched.
 */
export async function validateSession(
  sessionId: string
): Promise<{ session: AuthSession; user: User } | null> {
  const session = await prisma.authSession.findUnique({
    where: { id: sessionId },
    include: { user: true }
  });

  if (!session) {
    return null;
  }

  // Check if revoked
  if (session.revokedAt !== null) {
    return null;
  }

  // Check if expired
  if (session.expiresAt < new Date()) {
    return null;
  }

  // Check rolesVersion - if user's rolesVersion has changed, invalidate session
  if (session.user.rolesVersion !== session.rolesVersionAtIssue) {
    // Auto-revoke the session
    await prisma.authSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() }
    });
    return null;
  }

  // Update lastSeenAt if older than threshold
  const now = new Date();
  if (now.getTime() - session.lastSeenAt.getTime() > LAST_SEEN_UPDATE_INTERVAL_MS) {
    // Fire and forget - don't await
    prisma.authSession
      .update({
        where: { id: sessionId },
        data: { lastSeenAt: now }
      })
      .catch((err) => console.error("Failed to update lastSeenAt:", err));
  }

  return { session, user: session.user };
}

/**
 * Revoke all active sessions for a user.
 * Called when roles change or user is being forcefully logged out.
 */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  const result = await prisma.authSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() }
    },
    data: {
      revokedAt: new Date()
    }
  });

  return result.count;
}

/**
 * Invalidate all sessions for a user and notify via Socket.io.
 * This is the main function to call when you need to force logout a user.
 */
export async function invalidateUserSessions(
  userId: string,
  reason: string
): Promise<void> {
  // Revoke all sessions in database
  const revokedCount = await revokeAllUserSessions(userId);
  console.log(`Revoked ${revokedCount} sessions for user ${userId}, reason: ${reason}`);

  // Emit to all connected sockets for this user
  if (io) {
    const socketIds = getUserSocketIds(userId);
    for (const socketId of socketIds) {
      io.to(socketId).emit("session.invalidate", { reason });
    }
  }
}

/**
 * Increment a user's rolesVersion and invalidate all their sessions.
 * Call this when roles, permissions, or company roles change.
 */
export async function bumpRolesVersion(
  userId: string,
  cause: string
): Promise<void> {
  // Increment rolesVersion
  await prisma.user.update({
    where: { id: userId },
    data: {
      rolesVersion: { increment: 1 }
    }
  });

  // Invalidate all sessions
  await invalidateUserSessions(userId, cause);
}

/**
 * Clean up expired sessions (can be run periodically).
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.authSession.deleteMany({
    where: {
      expiresAt: { lt: new Date() }
    }
  });

  return result.count;
}
