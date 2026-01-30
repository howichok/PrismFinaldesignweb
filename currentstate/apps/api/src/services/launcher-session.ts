/**
 * Launcher Session Management
 *
 * Handles creation, validation, and revocation of launcher sessions.
 * Launcher sessions are separate from web sessions (AuthSession) and
 * are used by the desktop launcher to authenticate API requests.
 */

import crypto from "crypto";
import { prisma, type User, type LauncherSession, type MicrosoftLink } from "@prismmtr/db";

// Session defaults
const LAUNCHER_SESSION_EXPIRY_DAYS = 7;
const LOGIN_CODE_EXPIRY_SECONDS = 60;

// In-memory tracking for rate limiting (simple approach)
const codeGenerationAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_CODE_ATTEMPTS_PER_MINUTE = 5;

// ============================================
// Login Code Generation & Exchange
// ============================================

/**
 * Generate a one-time login code for launcher authentication.
 * The code is short-lived and can only be used once.
 */
export async function generateLoginCode(
  userId: string,
  deviceName?: string
): Promise<{ code: string; expiresAt: Date }> {
  // Simple rate limiting
  const now = Date.now();
  const attempts = codeGenerationAttempts.get(userId);

  if (attempts && attempts.resetAt > now && attempts.count >= MAX_CODE_ATTEMPTS_PER_MINUTE) {
    throw new LauncherSessionError(
      "RATE_LIMITED",
      "Too many login code requests. Please wait a minute."
    );
  }

  // Update rate limit counter
  if (!attempts || attempts.resetAt <= now) {
    codeGenerationAttempts.set(userId, { count: 1, resetAt: now + 60000 });
  } else {
    attempts.count++;
  }

  // Clean up any expired codes for this user
  await prisma.launcherLoginCode.deleteMany({
    where: {
      userId,
      OR: [
        { expiresAt: { lt: new Date() } },
        { consumedAt: { not: null } }
      ]
    }
  });

  // Generate a random code (URL-safe, 32 characters)
  const code = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + LOGIN_CODE_EXPIRY_SECONDS * 1000);

  await prisma.launcherLoginCode.create({
    data: {
      code,
      userId,
      deviceName,
      expiresAt
    }
  });

  return { code, expiresAt };
}

/**
 * Exchange a one-time login code for a launcher session.
 * Validates the code, checks user eligibility, and creates a session.
 */
export async function exchangeLoginCode(
  code: string,
  deviceName?: string
): Promise<{
  session: LauncherSession;
  user: User;
  microsoftLink: MicrosoftLink | null;
}> {
  // Find and validate the code
  const loginCode = await prisma.launcherLoginCode.findUnique({
    where: { code },
    include: {
      user: {
        include: {
          microsoftLink: true
        }
      }
    }
  });

  if (!loginCode) {
    throw new LauncherSessionError("INVALID_CODE", "Invalid or expired login code");
  }

  if (loginCode.consumedAt) {
    throw new LauncherSessionError("CODE_USED", "Login code has already been used");
  }

  if (loginCode.expiresAt < new Date()) {
    throw new LauncherSessionError("CODE_EXPIRED", "Login code has expired");
  }

  const user = loginCode.user;
  const microsoftLink = user.microsoftLink;

  // Check if user is banned
  if (user.isBanned) {
    throw new LauncherSessionError(
      "USER_BANNED",
      "Your account has been suspended. Please contact support."
    );
  }

  // Check if Microsoft account is linked
  if (!microsoftLink) {
    throw new LauncherSessionError(
      "NO_MICROSOFT_LINK",
      "Please link your Microsoft account on the website first."
    );
  }

  // Check Minecraft entitlement
  if (!microsoftLink.hasMinecraftEntitlement) {
    throw new LauncherSessionError(
      "NO_MINECRAFT_LICENSE",
      "No Minecraft license found on your Microsoft account."
    );
  }

  // Mark code as consumed
  await prisma.launcherLoginCode.update({
    where: { id: loginCode.id },
    data: { consumedAt: new Date() }
  });

  // Create launcher session
  const expiresAt = new Date(Date.now() + LAUNCHER_SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const session = await prisma.launcherSession.create({
    data: {
      userId: user.id,
      rolesVersionAtIssue: user.rolesVersion,
      expiresAt,
      deviceName: deviceName || loginCode.deviceName,
      deviceIdHash: deviceName
        ? crypto.createHash("sha256").update(deviceName).digest("hex").slice(0, 16)
        : null
    }
  });

  return {
    session,
    user,
    microsoftLink
  };
}

// ============================================
// Session Validation
// ============================================

export interface LauncherSessionValidation {
  session: LauncherSession;
  user: User;
  microsoftLink: MicrosoftLink | null;
}

/**
 * Validate a launcher session token (session ID).
 */
export async function validateLauncherSession(
  sessionId: string
): Promise<LauncherSessionValidation | null> {
  const session = await prisma.launcherSession.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        include: {
          microsoftLink: true
        }
      }
    }
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

  // Check rolesVersion match
  if (session.user.rolesVersion !== session.rolesVersionAtIssue) {
    // Auto-revoke
    await prisma.launcherSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() }
    });
    return null;
  }

  // Check if user is banned
  if (session.user.isBanned) {
    // Auto-revoke
    await prisma.launcherSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() }
    });
    return null;
  }

  // Update lastSeenAt periodically (every 5 minutes)
  const now = new Date();
  const lastSeen = session.lastSeenAt;
  if (now.getTime() - lastSeen.getTime() > 5 * 60 * 1000) {
    prisma.launcherSession
      .update({
        where: { id: sessionId },
        data: { lastSeenAt: now }
      })
      .catch((err) => console.error("Failed to update launcher session lastSeenAt:", err));
  }

  return {
    session,
    user: session.user,
    microsoftLink: session.user.microsoftLink
  };
}

// ============================================
// Session Revocation
// ============================================

/**
 * Revoke a specific launcher session.
 */
export async function revokelauncherSession(sessionId: string): Promise<boolean> {
  const result = await prisma.launcherSession.updateMany({
    where: {
      id: sessionId,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });

  return result.count > 0;
}

/**
 * Revoke all launcher sessions for a user.
 */
export async function revokeAllLauncherSessions(userId: string): Promise<number> {
  const result = await prisma.launcherSession.updateMany({
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
 * Get all active launcher sessions for a user.
 */
export async function getUserLauncherSessions(
  userId: string
): Promise<LauncherSession[]> {
  return prisma.launcherSession.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: { lastSeenAt: "desc" }
  });
}

// ============================================
// Cleanup
// ============================================

/**
 * Clean up expired login codes and sessions.
 * Can be run periodically.
 */
export async function cleanupExpiredLauncherData(): Promise<{
  codes: number;
  sessions: number;
}> {
  const now = new Date();

  const [codesResult, sessionsResult] = await Promise.all([
    prisma.launcherLoginCode.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { consumedAt: { not: null }, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
        ]
      }
    }),
    prisma.launcherSession.deleteMany({
      where: {
        expiresAt: { lt: now }
      }
    })
  ]);

  return {
    codes: codesResult.count,
    sessions: sessionsResult.count
  };
}

// ============================================
// Error Types
// ============================================

export class LauncherSessionError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "LauncherSessionError";
  }
}
