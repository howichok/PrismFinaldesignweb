/**
 * Microsoft Account Linking Routes
 *
 * Handles the OAuth flow for linking Microsoft accounts to PrismMTR users.
 * Requires user to already be authenticated via Discord (prism_session cookie).
 */

import { Router } from "express";
import { prisma } from "@prismmtr/db";
import { authMiddleware, requireUser } from "../middleware/auth.js";
import {
  buildMicrosoftAuthUrl,
  exchangeCodeForTokens,
  verifyMinecraftAccessWithToken,
  encryptToken,
  decryptToken,
  extractMsSub,
  verifyMinecraftAccess,
  MicrosoftAuthError
} from "../services/microsoft-minecraft.js";
import { revokeAllLauncherSessions } from "../services/launcher-session.js";
import { emitEventAndNotify, pushNotificationToUser } from "../services/notifications.js";

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
// Start Microsoft OAuth Flow
// ============================================

/**
 * POST /auth/microsoft/start
 * Initiates the Microsoft OAuth flow.
 * Returns the authorization URL for the client to redirect to.
 */
router.post("/start", authMiddleware, requireUser, async (req, res) => {
  const userId = req.user!.id;

  // Rate limit
  if (!checkRateLimit(`ms_start:${userId}`)) {
    res.status(429).json({
      error: "Too many requests",
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

  // Check if already linked
  const existingLink = await prisma.microsoftLink.findUnique({
    where: { userId }
  });

  if (existingLink) {
    res.status(409).json({
      error: "Microsoft account already linked. Unlink first to link a different account.",
      code: "ALREADY_LINKED"
    });
    return;
  }

  try {
    // Generate PKCE + state
    const { url, state, codeVerifier } = buildMicrosoftAuthUrl();

    // Store state in database (short-lived)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.microsoftOAuthState.create({
      data: {
        state,
        userId,
        codeVerifier,
        expiresAt
      }
    });

    res.json({
      authUrl: url,
      state
    });
  } catch (err) {
    console.error("Failed to start Microsoft OAuth:", err);
    res.status(500).json({
      error: "Failed to start Microsoft authentication",
      code: "INTERNAL_ERROR"
    });
  }
});

// ============================================
// Microsoft OAuth Callback
// ============================================

/**
 * GET /auth/microsoft/callback
 * Handles the OAuth callback from Microsoft.
 * Exchanges the code for tokens, verifies Minecraft access, and stores the link.
 */
router.get("/callback", authMiddleware, requireUser, async (req, res) => {
  const userId = req.user!.id;
  const { code, state, error, error_description } = req.query as {
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  };

  const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";
  const redirectWithError = (errorCode: string, message: string) => {
    const params = new URLSearchParams({ error: errorCode, message });
    res.redirect(`${WEB_ORIGIN}/dashboard/settings?${params.toString()}`);
  };

  const redirectWithSuccess = () => {
    res.redirect(`${WEB_ORIGIN}/dashboard/settings?microsoft=linked`);
  };

  // Rate limit
  if (!checkRateLimit(`ms_callback:${userId}`)) {
    redirectWithError("RATE_LIMITED", "Too many requests");
    return;
  }

  // Check for OAuth errors
  if (error) {
    console.error("Microsoft OAuth error:", error, error_description);
    redirectWithError(error, error_description || "Microsoft authentication failed");
    return;
  }

  if (!code || !state) {
    redirectWithError("MISSING_PARAMS", "Missing code or state parameter");
    return;
  }

  try {
    // Validate state
    const oauthState = await prisma.microsoftOAuthState.findUnique({
      where: { state }
    });

    if (!oauthState) {
      redirectWithError("INVALID_STATE", "Invalid or expired OAuth state");
      return;
    }

    if (oauthState.userId !== userId) {
      redirectWithError("STATE_MISMATCH", "OAuth state does not match current user");
      return;
    }

    if (oauthState.expiresAt < new Date()) {
      await prisma.microsoftOAuthState.delete({ where: { state } });
      redirectWithError("STATE_EXPIRED", "OAuth state has expired. Please try again.");
      return;
    }

    // Delete the state (one-time use)
    await prisma.microsoftOAuthState.delete({ where: { state } });

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, oauthState.codeVerifier);

    // Extract Microsoft subject ID from id_token (if available)
    const msSub = extractMsSub(tokens.idToken);
    if (!msSub) {
      // Fallback: we need some identifier. For now, generate from refresh token hash
      // This is less ideal but works for the flow
      redirectWithError(
        "NO_MS_SUB",
        "Could not extract Microsoft account identifier. Please try again."
      );
      return;
    }

    // Check if this Microsoft account is already linked to another user
    const existingLinkByMsSub = await prisma.microsoftLink.findUnique({
      where: { msSub }
    });

    if (existingLinkByMsSub && existingLinkByMsSub.userId !== userId) {
      redirectWithError(
        "MS_ACCOUNT_IN_USE",
        "This Microsoft account is already linked to another PrismMTR account."
      );
      return;
    }

    // Verify Minecraft access
    const verification = await verifyMinecraftAccessWithToken(tokens.accessToken);

    // Check if Minecraft UUID is already linked to another user
    if (verification.mcUuid) {
      const existingLinkByMcUuid = await prisma.microsoftLink.findUnique({
        where: { mcUuid: verification.mcUuid }
      });

      if (existingLinkByMcUuid && existingLinkByMcUuid.userId !== userId) {
        redirectWithError(
          "MC_ACCOUNT_IN_USE",
          "This Minecraft account is already linked to another PrismMTR account."
        );
        return;
      }
    }

    // Encrypt refresh token with versioned key
    const { encrypted, iv, tag, keyVersion } = encryptToken(tokens.refreshToken);

    // Create or update the link
    await prisma.microsoftLink.upsert({
      where: { userId },
      create: {
        userId,
        msSub,
        xuid: verification.xuid,
        gamertag: verification.gamertag,
        mcUuid: verification.mcUuid,
        mcName: verification.mcName,
        hasMinecraftEntitlement: verification.hasMinecraftEntitlement,
        verifiedAt: new Date(),
        refreshTokenEnc: encrypted,
        refreshTokenIv: iv,
        refreshTokenTag: tag,
        keyVersion
      },
      update: {
        msSub,
        xuid: verification.xuid,
        gamertag: verification.gamertag,
        mcUuid: verification.mcUuid,
        mcName: verification.mcName,
        hasMinecraftEntitlement: verification.hasMinecraftEntitlement,
        verifiedAt: new Date(),
        refreshTokenEnc: encrypted,
        refreshTokenIv: iv,
        refreshTokenTag: tag,
        keyVersion
      }
    });

    // Log event
    await prisma.eventLog.create({
      data: {
        type: "MICROSOFT_LINKED",
        actorUserId: userId,
        targetUserId: userId,
        entityType: "MICROSOFT_LINK",
        entityId: userId,
        payload: {
          mcUuid: verification.mcUuid,
          mcName: verification.mcName,
          hasEntitlement: verification.hasMinecraftEntitlement
        }
      }
    });

    redirectWithSuccess();
  } catch (err) {
    console.error("Microsoft OAuth callback error:", err);

    if (err instanceof MicrosoftAuthError) {
      redirectWithError(err.code, err.message);
    } else {
      redirectWithError("INTERNAL_ERROR", "An unexpected error occurred");
    }
  }
});

// ============================================
// Unlink Microsoft Account
// ============================================

/**
 * POST /auth/microsoft/unlink
 * Unlinks the Microsoft account from the user.
 * Also revokes all launcher sessions.
 */
router.post("/unlink", authMiddleware, requireUser, async (req, res) => {
  const userId = req.user!.id;

  try {
    const link = await prisma.microsoftLink.findUnique({
      where: { userId }
    });

    if (!link) {
      res.status(404).json({
        error: "No Microsoft account linked",
        code: "NOT_LINKED"
      });
      return;
    }

    // Delete the link
    await prisma.microsoftLink.delete({
      where: { userId }
    });

    // Revoke all launcher sessions
    const revokedCount = await revokeAllLauncherSessions(userId);

    // Log event
    await prisma.eventLog.create({
      data: {
        type: "MICROSOFT_UNLINKED",
        actorUserId: userId,
        targetUserId: userId,
        entityType: "MICROSOFT_LINK",
        entityId: userId,
        payload: {
          mcUuid: link.mcUuid,
          mcName: link.mcName,
          launcherSessionsRevoked: revokedCount
        }
      }
    });

    res.json({
      ok: true,
      message: "Microsoft account unlinked",
      launcherSessionsRevoked: revokedCount
    });
  } catch (err) {
    console.error("Failed to unlink Microsoft account:", err);
    res.status(500).json({
      error: "Failed to unlink Microsoft account",
      code: "INTERNAL_ERROR"
    });
  }
});

// ============================================
// Re-verify Microsoft/Minecraft
// ============================================

/**
 * POST /auth/microsoft/verify
 * Re-verifies Minecraft ownership and profile.
 */
router.post("/verify", authMiddleware, requireUser, async (req, res) => {
  const userId = req.user!.id;

  // Rate limit
  if (!checkRateLimit(`ms_verify:${userId}`)) {
    res.status(429).json({
      error: "Too many requests",
      code: "RATE_LIMITED"
    });
    return;
  }

  try {
    const result = await verifyMinecraftAccess(userId);

    // Log event
    await prisma.eventLog.create({
      data: {
        type: "MICROSOFT_VERIFIED",
        actorUserId: userId,
        targetUserId: userId,
        entityType: "MICROSOFT_LINK",
        entityId: userId,
        payload: {
          mcUuid: result.mcUuid,
          mcName: result.mcName,
          hasEntitlement: result.hasMinecraftEntitlement
        }
      }
    });

    res.json({
      ok: true,
      xuid: result.xuid,
      gamertag: result.gamertag,
      mcUuid: result.mcUuid,
      mcName: result.mcName,
      hasMinecraftEntitlement: result.hasMinecraftEntitlement,
      verifiedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error("Failed to verify Microsoft/Minecraft:", err);

    if (err instanceof MicrosoftAuthError) {
      res.status(400).json({
        error: err.message,
        code: err.code
      });
    } else {
      res.status(500).json({
        error: "Failed to verify Minecraft access",
        code: "INTERNAL_ERROR"
      });
    }
  }
});

// ============================================
// Get Link Status
// ============================================

/**
 * GET /auth/microsoft/status
 * Returns the current Microsoft link status for the user.
 */
router.get("/status", authMiddleware, requireUser, async (req, res) => {
  const userId = req.user!.id;

  try {
    const link = await prisma.microsoftLink.findUnique({
      where: { userId },
      select: {
        msSub: true,
        xuid: true,
        gamertag: true,
        mcUuid: true,
        mcName: true,
        hasMinecraftEntitlement: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!link) {
      res.json({ linked: false });
      return;
    }

    res.json({
      linked: true,
      gamertag: link.gamertag,
      mcUuid: link.mcUuid,
      mcName: link.mcName,
      hasMinecraftEntitlement: link.hasMinecraftEntitlement,
      verifiedAt: link.verifiedAt?.toISOString(),
      linkedAt: link.createdAt.toISOString()
    });
  } catch (err) {
    console.error("Failed to get Microsoft link status:", err);
    res.status(500).json({
      error: "Failed to get link status",
      code: "INTERNAL_ERROR"
    });
  }
});

export default router;
